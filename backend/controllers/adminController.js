const User = require('../models/User');
const Quiz = require('../models/Quiz');
const Transaction = require('../models/Transaction');

// GET /api/admin/stats
// Statistiques du dashboard admin
const getStats = async (req, res) => {
  try {
    // Vérifier si admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    // Total utilisateurs
    const totalUsers = await User.countDocuments();

    // Utilisateurs Premium
    const premiumUsers = await User.countDocuments({
      isPremium: true,
      premiumExpiresAt: { $gt: new Date() }
    });

    // Utilisateurs gratuits
    const freeUsers = totalUsers - premiumUsers;

    // Total quiz
    const totalQuizzes = await Quiz.countDocuments();

    // Revenus totaux (transactions complétées)
    const transactions = await Transaction.find({ status: 'completed' });
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Croissance utilisateurs (par mois - 6 derniers mois)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Formater la croissance
    const formattedGrowth = userGrowth.map(item => ({
      date: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      count: item.count
    }));

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        freeUsers,
        totalQuizzes,
        totalRevenue,
        userGrowth: formattedGrowth
      }
    });

  } catch (error) {
    console.error('Erreur getStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// GET /api/admin/users
// Liste de tous les utilisateurs
const getUsers = async (req, res) => {
  try {
    // Vérifier si admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Filtres
    const filters = {};
    if (req.query.premium === 'true') {
      filters.isPremium = true;
      filters.premiumExpiresAt = { $gt: new Date() };
    } else if (req.query.premium === 'false') {
      filters.$or = [
        { isPremium: false },
        { premiumExpiresAt: { $lte: new Date() } }
      ];
    }

    // Recherche
    if (req.query.search) {
      filters.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Récupérer utilisateurs
    const users = await User.find(filters)
      .select('name email isPremium premiumExpiresAt createdAt lastLogin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments(filters);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limit)
      }
    });

  } catch (error) {
    console.error('Erreur getUsers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// GET /api/admin/user/:id
// Détails d'un utilisateur spécifique
const getUserDetails = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    const user = await User.findById(req.params.id)
      .populate('quizHistory.quizId', 'title category');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Erreur getUserDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// PUT /api/admin/user/:id/premium
// Activer/Désactiver Premium manuellement
const togglePremium = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    const { isPremium, duration } = req.body; // duration en jours

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (isPremium) {
      user.isPremium = true;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (duration || 30));
      user.premiumExpiresAt = expiryDate;
    } else {
      user.isPremium = false;
      user.premiumExpiresAt = null;
    }

    await user.save();

    console.log(`✅ Admin ${req.user.email} a modifié le statut premium de ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Statut Premium mis à jour',
      user: {
        id: user._id,
        email: user.email,
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt
      }
    });

  } catch (error) {
    console.error('Erreur togglePremium:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// GET /api/admin/transactions
// Liste des transactions
const getTransactions = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }

    const transactions = await Transaction.find(filters)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalTransactions = await Transaction.countDocuments(filters);

    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        pages: Math.ceil(totalTransactions / limit)
      }
    });

  } catch (error) {
    console.error('Erreur getTransactions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// GET /api/admin/quizzes
// Liste des quiz avec stats
const getQuizzes = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    const quizzes = await Quiz.find()
      .select('title category subject isPremium questions createdAt')
      .sort({ createdAt: -1 });

    // Ajouter stats pour chaque quiz
    const quizzesWithStats = await Promise.all(
      quizzes.map(async (quiz) => {
        const attemptCount = await User.aggregate([
          { $unwind: '$quizHistory' },
          { $match: { 'quizHistory.quizId': quiz._id } },
          { $count: 'total' }
        ]);

        return {
          ...quiz.toObject(),
          attempts: attemptCount[0]?.total || 0,
          questionCount: quiz.questions?.length || 0
        };
      })
    );

    res.status(200).json({
      success: true,
      quizzes: quizzesWithStats
    });

  } catch (error) {
    console.error('Erreur getQuizzes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

console.log('✅ adminController chargé avec données réelles');

// ✅ EXPORTS À LA FIN
module.exports = {
  getStats,
  getUsers,
  getUserDetails,
  togglePremium,
  getTransactions,
  getQuizzes
};