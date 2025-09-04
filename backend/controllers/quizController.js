const Quiz = require('../models/Quiz');

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
};