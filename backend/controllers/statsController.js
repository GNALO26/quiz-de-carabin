/**
 * ================================================================
 * STATISTICS CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 * Controller pour les statistiques détaillées et graphiques
 * ================================================================
 */

const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const Result = require('../models/Result');

/**
 * ================================================================
 * GET /api/stats/dashboard
 * Récupérer les stats du dashboard principal
 * ================================================================
 */
/**
 * ================================================================
 * STATISTICS CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 */

const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

/**
 * GET /api/stats/dashboard
 * Stats dashboard principal
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Stats globales
    const globalStats = {
      totalQuizzes: user.stats?.totalQuizzes || 0,
      averageMastery: user.stats?.averageScore || 0,
      streak: user.stats?.streak || 0,
      level: user.level || 1,
      xp: user.xp || 0,
      nextLevelXP: 100 * (user.level || 1),
      badges: user.badges || []
    };

    // Par matière
    const bySubject = await UserProgress.find({ userId })
      .select('subject averageMastery totalQuizzes')
      .sort({ averageMastery: -1 })
      .limit(10);

    // Activité récente
    const recentActivity = user.quizHistory?.slice(-7) || [];

    res.json({
      success: true,
      data: {
        global: globalStats,
        bySubject: bySubject,
        recentActivity: recentActivity
      }
    });

  } catch (error) {
    console.error('❌ Erreur getDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/stats/subject/:subject
 * Stats par matière
 */
exports.getSubjectStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { subject } = req.params;

    const progress = await UserProgress.findOne({ userId, subject });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Aucune progression'
      });
    }

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('❌ Erreur getSubjectStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/stats/quiz-history
 * Historique quiz
 */
exports.getQuizHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('quizHistory');

    res.json({
      success: true,
      history: user.quizHistory || []
    });

  } catch (error) {
    console.error('❌ Erreur getQuizHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/stats/recommendations
 * Recommandations
 */
exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Récupérer matières avec faible score
    const weakSubjects = await UserProgress.find({
      userId,
      averageMastery: { $lt: 70 }
    })
    .select('subject averageMastery')
    .sort({ averageMastery: 1 })
    .limit(3);

    res.json({
      success: true,
      recommendations: weakSubjects.map(s => ({
        subject: s.subject,
        reason: `Score moyen : ${s.averageMastery}%`
      }))
    });

  } catch (error) {
    console.error('❌ Erreur getRecommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/stats/performance-chart
 * Graphique performance
 */
exports.getPerformanceChart = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('quizHistory');

    // Derniers 30 quiz
    const recentQuizzes = (user.quizHistory || []).slice(-30);

    const chartData = recentQuizzes.map((quiz, index) => ({
      x: index + 1,
      y: quiz.score || 0,
      date: quiz.completedAt
    }));

    res.json({
      success: true,
      data: chartData
    });

  } catch (error) {
    console.error('❌ Erreur getPerformanceChart:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};
/**
 * ================================================================
 * GET /api/stats/subject/:subject
 * Statistiques détaillées par matière
 * ================================================================
 */
exports.getSubjectStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { subject } = req.params;

    // Récupérer la progression dans cette matière
    const progress = await UserProgress.findOne({ userId, subject });

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Aucune progression trouvée pour cette matière'
      });
    }

    // Obtenir le classement
    const ranking = await UserProgress.getUserRanking(userId, subject);

    // Obtenir la tendance
    const trend = progress.getTrend();

    // Données pour graphiques
    const chartData = progress.getChartData();

    res.json({
      success: true,
      stats: {
        subject: subject,
        totalQuizzes: progress.totalQuizzes,
        totalQuestions: progress.totalQuestions,
        correctAnswers: progress.correctAnswers,
        incorrectAnswers: progress.incorrectAnswers,
        averageScore: progress.averageScore,
        bestScore: progress.bestScore,
        lastScore: progress.lastScore,
        totalTimeSpent: progress.totalTimeSpent,
        averageTimePerQuiz: progress.averageTimePerQuiz,
        level: progress.level,
        rank: progress.rank,
        xp: progress.xp,
        ranking: ranking,
        trend: trend,
        chartData: chartData,
        strongCategories: progress.strongCategories,
        weakCategories: progress.weakCategories,
        lastActivityDate: progress.lastActivityDate
      }
    });

  } catch (error) {
    console.error('❌ Erreur getSubjectStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des stats'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/progress-chart
 * Données pour graphique de progression globale
 * ================================================================
 */
exports.getProgressChart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '30' } = req.query; // 7, 30, 90 jours

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Récupérer tous les résultats dans la période
    const results = await Result.find({
      userId: userId,
      createdAt: { $gte: daysAgo }
    })
    .select('score subject createdAt timeSpent')
    .sort({ createdAt: 1 })
    .populate('quizId', 'title subject');

    // Grouper par jour
    const dailyStats = {};

    results.forEach(result => {
      const date = result.createdAt.toISOString().split('T')[0];
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date: date,
          totalQuizzes: 0,
          totalScore: 0,
          totalTime: 0,
          subjects: {}
        };
      }

      dailyStats[date].totalQuizzes += 1;
      dailyStats[date].totalScore += result.score;
      dailyStats[date].totalTime += result.timeSpent || 0;

      // Par matière
      const subject = result.subject || 'Autre';
      if (!dailyStats[date].subjects[subject]) {
        dailyStats[date].subjects[subject] = 0;
      }
      dailyStats[date].subjects[subject] += 1;
    });

    // Calculer moyennes
    const chartData = Object.values(dailyStats).map(day => ({
      date: new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      averageScore: Math.round(day.totalScore / day.totalQuizzes),
      quizCount: day.totalQuizzes,
      timeSpent: Math.round(day.totalTime / 60), // en minutes
      subjects: day.subjects
    }));

    res.json({
      success: true,
      period: parseInt(period),
      data: chartData
    });

  } catch (error) {
    console.error('❌ Erreur getProgressChart:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du graphique'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/time-by-subject
 * Temps passé par matière (pour graphique camembert)
 * ================================================================
 */
exports.getTimeBySubject = async (req, res) => {
  try {
    const userId = req.user._id;

    // Récupérer toutes les progressions
    const progresses = await UserProgress.find({ userId })
      .select('subject totalTimeSpent totalQuizzes');

    // Formater pour graphique
    const data = progresses.map(p => ({
      subject: p.subject,
      timeSpent: Math.round(p.totalTimeSpent / 60), // minutes
      percentage: 0, // calculé après
      quizCount: p.totalQuizzes
    }));

    // Calculer le total
    const totalTime = data.reduce((sum, item) => sum + item.timeSpent, 0);

    // Calculer les pourcentages
    data.forEach(item => {
      item.percentage = totalTime > 0 
        ? Math.round((item.timeSpent / totalTime) * 100)
        : 0;
    });

    // Trier par temps décroissant
    data.sort((a, b) => b.timeSpent - a.timeSpent);

    res.json({
      success: true,
      totalTime: totalTime,
      data: data
    });

  } catch (error) {
    console.error('❌ Erreur getTimeBySubject:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/performance-by-subject
 * Performance (score moyen) par matière
 * ================================================================
 */
exports.getPerformanceBySubject = async (req, res) => {
  try {
    const userId = req.user._id;

    // Récupérer toutes les progressions
    const progresses = await UserProgress.find({ userId })
      .select('subject averageScore bestScore totalQuizzes level rank')
      .sort({ averageScore: -1 });

    const data = progresses.map(p => ({
      subject: p.subject,
      averageScore: p.averageScore,
      bestScore: p.bestScore,
      quizCount: p.totalQuizzes,
      level: p.level,
      rank: p.rank
    }));

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ Erreur getPerformanceBySubject:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/leaderboard/:subject
 * Classement dans une matière
 * ================================================================
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const { subject } = req.params;
    const { limit = 10 } = req.query;

    // Récupérer le top
    const leaderboard = await UserProgress.find({ subject })
      .populate('userId', 'name university studyYear avatar')
      .select('userId averageScore totalQuizzes level rank')
      .sort({ averageScore: -1, totalQuizzes: -1 })
      .limit(parseInt(limit));

    const data = leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: {
        name: entry.userId.name,
        university: entry.userId.university,
        studyYear: entry.userId.studyYear,
        avatar: entry.userId.avatar
      },
      averageScore: entry.averageScore,
      quizCount: entry.totalQuizzes,
      level: entry.level,
      rankTitle: entry.rank
    }));

    res.json({
      success: true,
      subject: subject,
      leaderboard: data
    });

  } catch (error) {
    console.error('❌ Erreur getLeaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du classement'
    });
  }
};

/**
 * ================================================================
 * POST /api/stats/record-quiz
 * Enregistrer les résultats d'un quiz
 * ================================================================
 */
exports.recordQuizResult = async (req, res) => {
  try {
    const userId = req.user._id;
    const { quizId, subject, totalQuestions, correctAnswers, timeSpent } = req.body;

    // Mettre à jour stats globales
    const user = await User.findById(userId);
    await user.updateStats({
      totalQuestions,
      correctAnswers,
      timeSpent: timeSpent || 0
    });

    // Mettre à jour progression par matière
    const progress = await UserProgress.getOrCreate(userId, subject);
    await progress.recordQuiz({
      quizId,
      totalQuestions,
      correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      timeSpent: timeSpent || 0
    });

    // Calculer XP gagné
    const xpGained = Math.round((correctAnswers / totalQuestions) * 100);
    await user.gainXP(xpGained);

    res.json({
      success: true,
      message: 'Résultats enregistrés',
      xpGained: xpGained,
      newLevel: user.level
    });

  } catch (error) {
    console.error('❌ Erreur recordQuizResult:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement'
    });
  }
};

module.exports = {
  getDashboardStats,
  getSubjectStats,
  getProgressChart,
  getTimeBySubject,
  getPerformanceBySubject,
  getLeaderboard,
  recordQuizResult
};