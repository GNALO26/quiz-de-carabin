const express = require('express');
const auth = require('../middleware/auth');
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

module.exports = router;