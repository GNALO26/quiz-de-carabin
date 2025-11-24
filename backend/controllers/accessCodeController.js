const AccessCode = require('../models/AccessCode');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// Logique pour valider un code d'accès
exports.validateAccessCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    console.log('Validation du code d\'accès:', { code, userId });

    // Vérifier d'abord dans les transactions
    const transaction = await Transaction.findOne({
      userId: new mongoose.Types.ObjectId(userId), 
      accessCode: code,
      accessCodeUsed: false,
      status: 'completed'
    });

    if (transaction) {
      transaction.accessCodeUsed = true;
      await transaction.save();

      // ✅ CORRECTION : CALCUL DE LA DATE D'EXPIRATION EN UTILISANT durationInMonths
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + transaction.durationInMonths);

      const user = await User.findByIdAndUpdate(
        userId,
        {
          isPremium: true,
          premiumExpiresAt: expirationDate
        },
        { new: true }
      ).select('-password');

      console.log('Accès premium activé via transaction pour l\'utilisateur:', user.email);

      return res.status(200).json({
        success: true,
        message: 'Code validé avec succès. Vous avez maintenant accès aux QCM premium.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isPremium: user.isPremium,
          premiumExpiresAt: user.premiumExpiresAt
        }
      });
    }

    // Si pas trouvé dans les transactions, vérifier dans AccessCode
    const accessCode = await AccessCode.findOne({
      code,
      userId: new mongoose.Types.ObjectId(userId), 
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!accessCode) {
      console.log('Code invalide ou expiré');
      return res.status(400).json({
        success: false,
        message: 'Code invalide ou expiré'
      });
    }

    accessCode.used = true;
    await accessCode.save();

    // Définition d'une expiration par défaut (1 mois) pour les AccessCode non liés aux transactions
    const defaultExpiration = new Date();
    defaultExpiration.setMonth(defaultExpiration.getMonth() + 1);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isPremium: true,
        premiumExpiresAt: defaultExpiration
      },
      { new: true }
    ).select('-password');

    console.log('Accès premium activé via AccessCode pour l\'utilisateur:', user.email);

    res.status(200).json({
      success: true,
      message: 'Code validé avec succès. Vous avez maintenant accès aux QCM premium.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation du code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation du code'
    });
  }
};

// Fonction pour renvoyer un code d'accès
exports.resendAccessCode = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const transaction = await Transaction.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (transaction && transaction.accessCode) {
      const { sendAccessCodeEmail } = require('./emailController');
      await sendAccessCodeEmail(user.email, transaction.accessCode, user.name, transaction.durationInMonths);

      return res.status(200).json({
        success: true,
        message: 'Code d\'accès renvoyé par email'
      });
    }

    const existingCode = await AccessCode.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (existingCode) {
      const { sendAccessCodeEmail } = require('./emailController');
      await sendAccessCodeEmail(user.email, existingCode.code, user.name, 1);

      return res.status(200).json({
        success: true,
        message: 'Code d\'accès renvoyé par email'
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Aucun code d\'accès valide trouvé'
    });

  } catch (error) {
    console.error('Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du renvoi du code'
    });
  }
};