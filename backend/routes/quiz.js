const express = require('express');
const Quiz = require('../models/Quiz');
const auth = require('../middleware/auth');
const router = express.Router();

// Get all quizzes
router.get('/', auth, async (req, res) => {
  try {
    const quizzes = await Quiz.find();
    res.json({ success: true, quizzes });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Get single quiz
router.get('/:id', auth, async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz non trouvé.' });
    }
    
    // Check if user has access to premium quiz
    if (!quiz.free && !req.user.isPremium) {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé. Abonnement premium requis.' 
      });
    }
    
    res.json({ success: true, quiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Submit quiz answers
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const { answers } = req.body;
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz non trouvé.' });
    }
    
    // Calculate score
    let score = 0;
    quiz.questions.forEach((question, index) => {
      const userAnswer = answers[index] || [];
      const correctAnswers = question.correctAnswers;
      
      if (userAnswer.length === correctAnswers.length && 
          userAnswer.every(val => correctAnswers.includes(val))) {
        score++;
      }
    });
    
    // S'assurer que quizHistory est initialisé
    if (!req.user.quizHistory) {
      req.user.quizHistory = [];
    }
    
    // Add to user's quiz history
    req.user.quizHistory.push({
      quizId: quiz._id,
      score,
      totalQuestions: quiz.questions.length,
      correctAnswers: score,
      completedAt: new Date()
    });
    
    await req.user.save();
    
    res.json({
      success: true,
      score,
      totalQuestions: quiz.questions.length,
      correctAnswers: score
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Get user's quiz history
router.get('/history/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('quizHistory.quizId');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé.' });
    }
    
    res.json({
      success: true,
      history: user.quizHistory
    });
  } catch (error) {
    console.error('Get quiz history error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;