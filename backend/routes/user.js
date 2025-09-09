const express = require('express');
const auth = require('../middleware/auth');
const auth = require('../models/User');
const router = express.Router();

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    await req.user.populate({
      path: 'quizHistory.quizId',
      select: 'title category'
    });
    
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        isPremium: req.user.isPremium,
        premiumExpiry: req.user.premiumExpiry,
        quizHistory: req.user.quizHistory,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});
// Obtenir l'historique des quiz de l'utilisateur
router.get('/quiz-history', auth, async (req, res) => {
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