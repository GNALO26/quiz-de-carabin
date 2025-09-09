const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');
const router = express.Router();

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    await req.user.populate({ 
      path: 'quizHistory.quizId', 
      select: 'title category' 
    });

    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          isPremium: req.user.isPremium,
          premiumExpiresAt: req.user.premiumExpiresAt
        },
        quizHistory: req.user.quizHistory
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
});

// Obtenir l'historique des quiz de l'utilisateur
router.get('/quiz-history', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('quizHistory.quizId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Formater l'historique pour l'affichage
    const history = user.quizHistory.map(item => ({
      quizTitle: item.quizId ? item.quizId.title : 'Quiz supprimé',
      score: item.score,
      totalQuestions: item.totalQuestions,
      correctAnswers: item.correctAnswers,
      completedAt: item.completedAt
    }));

    res.json({
      success: true,
      history: history.reverse() // Du plus récent au plus ancien
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;