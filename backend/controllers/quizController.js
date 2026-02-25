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
    const { quizId, answers, timeSpent = 0 } = req.body;
    const userId = req.user._id;
    
    // Validation des données
    if (!quizId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides. quizId et answers sont requis.'
      });
    }
    
    // Récupérer le quiz
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }
    
    // Vérifier si l'utilisateur a accès (gratuit ou premium)
    if (!quiz.free && !req.user.isPremium) {
      return res.status(403).json({
        success: false,
        message: 'Ce quiz nécessite un abonnement Premium',
        requiresPremium: true
      });
    }
    
    // Validation du nombre de réponses
    if (answers.length !== quiz.questions.length) {
      return res.status(400).json({
        success: false,
        message: `Nombre de réponses incorrect. Attendu: ${quiz.questions.length}, Reçu: ${answers.length}`
      });
    }
    
    // Calculer le score et les résultats détaillés
    let correctCount = 0;
    const results = quiz.questions.map((question, index) => {
      const userAnswer = answers[index];
      const correctAnswers = question.correctAnswers;
      
      // Comparer les réponses (supporter les réponses multiples)
      let isCorrect = false;
      
      if (Array.isArray(userAnswer) && Array.isArray(correctAnswers)) {
        // Trier et comparer pour réponses multiples
        isCorrect = JSON.stringify([...userAnswer].sort()) === 
                   JSON.stringify([...correctAnswers].sort());
      } else if (Array.isArray(correctAnswers)) {
        // userAnswer est un seul nombre, correctAnswers est un tableau
        isCorrect = correctAnswers.length === 1 && correctAnswers[0] === userAnswer;
      } else {
        // Les deux sont des nombres simples
        isCorrect = userAnswer === correctAnswers;
      }
      
      if (isCorrect) correctCount++;
      
      return {
        questionIndex: index,
        questionText: question.text,
        userAnswer,
        correctAnswers,
        isCorrect,
        justification: question.justification || '',
        options: question.options
      };
    });
    
    // Calculer le pourcentage
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    
    // ============================================
    // ENREGISTRER LA PROGRESSION
    // ============================================
    
    let progress = await UserProgress.findOne({ userId, quizId });
    
    if (!progress) {
      // Première tentative : créer un nouveau document
      progress = new UserProgress({
        userId,
        quizId,
        subject: quiz.subject,
        category: quiz.category,
        attempts: []
      });
    }
    
    // Enregistrer la tentative avec la méthode du modèle
    progress.recordAttempt(
      score,
      answers,
      correctCount,
      quiz.questions.length,
      timeSpent
    );
    
    await progress.save();
    
    // ============================================
    // PRÉPARER LA RÉPONSE
    // ============================================
    
    // Déterminer le message de feedback
    let feedback = '';
    if (score === 100) {
      feedback = '🎉 Parfait ! Vous maîtrisez ce quiz !';
    } else if (score >= 80) {
      feedback = '👏 Excellent travail ! Encore un petit effort !';
    } else if (score >= 60) {
      feedback = '👍 Bien ! Continuez à vous entraîner.';
    } else if (score >= 40) {
      feedback = '💪 Vous progressez ! Révisez et réessayez.';
    } else {
      feedback = '📚 Révisez le cours et réessayez. Vous allez y arriver !';
    }
    
    res.json({
      success: true,
      data: {
        // Résultats du quiz
        score,
        correctCount,
        totalQuestions: quiz.questions.length,
        percentage: score,
        
        // Résultats détaillés par question
        results,
        
        // Informations de progression
        progress: {
          mastery: progress.mastery,
          masteryLevel: progress.getMasteryLevel(),
          bestScore: progress.bestScore,
          averageScore: progress.averageScore,
          totalAttempts: progress.totalAttempts,
          nextReviewDate: progress.nextReviewDate,
          improvement: progress.totalAttempts > 1 
            ? score - progress.attempts[progress.attempts.length - 2].score 
            : null
        },
        
        // Feedback et encouragements
        feedback,
        
        // Achievements débloqués
        newAchievements: {
          firstCompletion: progress.totalAttempts === 1,
          perfectScore: score === 100 && !progress.achievements.perfectScore,
          masteryAchieved: progress.mastery >= 90 && !progress.achievements.masteryAchieved
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur submitQuiz:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission du quiz',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

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