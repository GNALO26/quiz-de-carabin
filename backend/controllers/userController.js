const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('quizHistory.quizId');
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, email },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// GET /api/user/progress
exports.getProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).populate('quizHistory.quizId');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    const quizHistory = user.quizHistory || [];
    const totalQuizzes = quizHistory.length;
    const totalQuestions = quizHistory.reduce((sum, q) => sum + (q.totalQuestions || 0), 0);
    const totalCorrect = quizHistory.reduce((sum, q) => sum + (q.correctAnswers || 0), 0);
    const averageScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const successRate = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    
    // Stats par matière
    const subjectStats = {};
    quizHistory.forEach(quiz => {
      if (quiz.quizId && quiz.quizId.subject) {
        const subject = quiz.quizId.subject;
        if (!subjectStats[subject]) {
          subjectStats[subject] = {
            subject: subject,
            quizzesCompleted: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            averageScore: 0
          };
        }
        
        subjectStats[subject].quizzesCompleted++;
        subjectStats[subject].totalQuestions += quiz.totalQuestions || 0;
        subjectStats[subject].totalCorrect += quiz.correctAnswers || 0;
      }
    });
    
    Object.keys(subjectStats).forEach(subject => {
      const stat = subjectStats[subject];
      stat.averageScore = stat.totalQuestions > 0 
        ? (stat.totalCorrect / stat.totalQuestions) * 100 
        : 0;
    });
    
    const recentQuizzes = quizHistory
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(0, 5)
      .map(q => ({
        quizTitle: q.quizId ? q.quizId.title : 'Quiz supprimé',
        score: q.totalQuestions > 0 ? Math.round((q.correctAnswers / q.totalQuestions) * 100) : 0,
        correctAnswers: q.correctAnswers,
        totalQuestions: q.totalQuestions,
        completedAt: q.completedAt
      }));
    
    res.status(200).json({
      success: true,
      totalQuizzes,
      averageScore: Math.round(averageScore),
      totalQuestions,
      successRate: Math.round(successRate),
      subjectStats: Object.values(subjectStats),
      recentQuizzes
    });
    
  } catch (error) {
    console.error('Erreur getProgress:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// GET /api/user/dashboard-stats (optionnel - pour dashboard.html)
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('quizHistory.quizId');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    
    const quizHistory = user.quizHistory || [];
    
    res.status(200).json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt
      },
      stats: {
        totalQuizzes: quizHistory.length,
        averageScore: quizHistory.length > 0 
          ? Math.round(quizHistory.reduce((sum, q) => sum + ((q.correctAnswers / q.totalQuestions) * 100), 0) / quizHistory.length)
          : 0,
        streak: 0, // À implémenter si nécessaire
        level: Math.floor(quizHistory.length / 10) + 1
      }
    });
    
  } catch (error) {
    console.error('Erreur getDashboardStats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};