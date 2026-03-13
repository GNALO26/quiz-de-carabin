const Quiz = require('../models/Quiz');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

exports.getAllQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find().select('-questions.correctAnswers');
    res.status(200).json({
      success: true,
      quizzes: quizzes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé.',
      });
    }

    if (!quiz.free && (!req.user || !req.user.isPremium)) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux abonnés premium.',
      });
    }

    res.status(200).json({
      success: true,
      quiz: quiz,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body;
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé. Vérifiez votre connexion',
      });
    }

    let score = 0;
    quiz.questions.forEach((question, index) => {
      const userAnswer = answers[index] || [];
      const correctAnswers = question.correctAnswers;

      if (userAnswer.length === correctAnswers.length &&
          userAnswer.every(val => correctAnswers.includes(val))) {
        score++;
      }
    });

    if (req.user) {
      const user = await User.findById(req.user.id);
      if (!user.quizHistory) {
        user.quizHistory = [];
      }
      
      user.quizHistory.push({
        quizId: quiz._id,
        score,
        totalQuestions: quiz.questions.length,
        correctAnswers: score,
        completedAt: new Date(),
      });
      
      await user.save();
    }

    // Dans backend/controllers/quizController.js
// Après calcul du score et sauvegarde dans quizHistory

// ✅ VÉRIFIER SI NOUVEAU RECORD
const NotificationService = require('../services/notificationService');

// Récupérer le meilleur score précédent pour ce quiz
const previousAttempts = user.quizHistory.filter(
  h => h.quizId.toString() === quizId.toString()
);

if (previousAttempts.length > 0) {
  const previousBest = Math.max(...previousAttempts.map(a => a.score));
  const currentScore = (correctAnswers / totalQuestions) * 100;
  
  if (currentScore > previousBest) {
    await NotificationService.notifyNewRecord(
      user._id,
      quiz.title,
      Math.round(currentScore),
      Math.round(previousBest)
    );
  }
}

    res.status(200).json({
      success: true,
      score,
      totalQuestions: quiz.questions.length,
      correctAnswers: score,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getQuizHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('quizHistory.quizId');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé. Connectez-vous',
      });
    }

    res.status(200).json({
      success: true,
      history: user.quizHistory || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Middleware pour bloquer les quiz premium
const checkQuizAccess = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz non trouvé' });
    }
    
    // Si le quiz est premium et l'utilisateur n'est pas premium
    if (!quiz.free && !req.user.hasActivePremium()) {
      return res.status(403).json({
        success: false,
        message: 'Accès premium requis pour ce quiz'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
exports.checkReviewsDaily = async () => {
  try {
    const count = await UserProgress.markQuizzesNeedingReview();
    console.log(`✅ [CRON] ${count} quiz marqués pour révision`);
    return count;
  } catch (error) {
    console.error('❌ [CRON] Erreur checkReviewsDaily:', error);
    throw error;
  }
};

/*const Quiz = require('../models/Quiz');

exports.getAllQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find();
    res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé.',
      });
    }

    // Si le quiz est premium et que l'utilisateur n'est pas premium, renvoyer une erreur
    if (!quiz.free && (!req.user || !req.user.isPremium)) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux abonnés premium.',
      });
    }

    res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body;
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé.',
      });
    }

    // Calcul du score
    let score = 0;
    quiz.questions.forEach((question, index) => {
      const userAnswer = answers[index];
      const correctAnswers = question.correctAnswers;

      if (userAnswer && userAnswer.length === correctAnswers.length &&
          userAnswer.every(val => correctAnswers.includes(val))) {
        score++;
      }
    });

    // Sauvegarder le résultat dans l'historique de l'utilisateur
    if (req.user) {
      req.user.quizHistory.push({
        quizId: quiz._id,
        score,
        totalQuestions: quiz.questions.length,
        correctAnswers: score,
        completedAt: new Date(),
      });
      await req.user.save();
    }

    res.status(200).json({
      success: true,
      data: {
        score,
        totalQuestions: quiz.questions.length,
        correctAnswers: score,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};*/