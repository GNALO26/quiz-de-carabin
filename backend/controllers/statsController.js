/**
 * ================================================================
 * STATISTICS CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 * Controller pour les statistiques détaillées et graphiques
 * ================================================================
 */

const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

/**
 * ================================================================
 * GET /api/stats/dashboard
 * Récupérer les stats du dashboard principal
 * ================================================================
 */
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    // Récupérer l'utilisateur
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Stats globales de l'utilisateur
    const globalStats = {
      totalQuizzes: user.stats?.totalQuizzes || 0,
      totalQuestions: user.stats?.totalQuestions || 0,
      correctAnswers: user.stats?.correctAnswers || 0,
      averageScore: user.stats?.averageScore || 0,
      averageMastery: user.stats?.averageScore || 0,
      timeSpent: user.stats?.timeSpent || 0,
      streak: user.stats?.streak || 0,
      level: user.level || 1,
      xp: user.xp || 0,
      nextLevelXP: 100 * (user.level || 1),
      badges: user.badges || []
    };

    // Progression par matière
    let progressBySubject = [];
    try {
      progressBySubject = await UserProgress.find({ userId })
        .select('subject averageMastery totalQuizzes bestScore lastScore level')
        .sort({ averageMastery: -1 })
        .limit(10);
    } catch (error) {
      console.log('⚠️ Pas de UserProgress encore');
    }

    // Activité récente (derniers quiz)
    const recentActivity = user.quizHistory?.slice(-7).map(quiz => ({
      quizId: quiz.quizId,
      score: quiz.score,
      subject: quiz.subject,
      completedAt: quiz.completedAt,
      timeSpent: quiz.timeSpent
    })) || [];

    res.json({
      success: true,
      data: {
        global: globalStats,
        bySubject: progressBySubject,
        recentActivity: recentActivity
      }
    });

  } catch (error) {
    console.error('❌ Erreur getDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des stats',
      error: error.message
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/subject/:subject
 * Statistiques détaillées par matière
 * ================================================================
 */
const getSubjectStats = async (req, res) => {
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

    res.json({
      success: true,
      stats: {
        subject: subject,
        totalQuizzes: progress.totalQuizzes || 0,
        averageMastery: progress.averageMastery || 0,
        bestScore: progress.bestScore || 0,
        lastScore: progress.lastScore || 0,
        level: progress.level || 1,
        xp: progress.xp || 0,
        lastActivityDate: progress.lastActivityDate
      }
    });

  } catch (error) {
    console.error('❌ Erreur getSubjectStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des stats',
      error: error.message
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/quiz-history
 * Historique des quiz complétés
 * ================================================================
 */
const getQuizHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('quizHistory');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const history = user.quizHistory || [];

    res.json({
      success: true,
      history: history.slice(-50) // Derniers 50 quiz
    });

  } catch (error) {
    console.error('❌ Erreur getQuizHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/recommendations
 * Recommandations de quiz basées sur les performances
 * ================================================================
 */
const getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Récupérer matières avec faible score
    let weakSubjects = [];
    try {
      weakSubjects = await UserProgress.find({
        userId,
        averageMastery: { $lt: 70 }
      })
      .select('subject averageMastery')
      .sort({ averageMastery: 1 })
      .limit(3);
    } catch (error) {
      console.log('⚠️ Pas de UserProgress pour recommendations');
    }

    const recommendations = weakSubjects.map(s => ({
      subject: s.subject,
      currentScore: s.averageMastery,
      reason: `Score actuel : ${s.averageMastery}% - À améliorer`
    }));

    res.json({
      success: true,
      recommendations: recommendations
    });

  } catch (error) {
    console.error('❌ Erreur getRecommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des recommandations',
      error: error.message
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/performance-chart
 * Données pour graphique de progression
 * ================================================================
 */
const getPerformanceChart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '30' } = req.query; // 7, 30, 90 jours

    const user = await User.findById(userId).select('quizHistory');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Filtrer par période
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const recentQuizzes = (user.quizHistory || [])
      .filter(quiz => new Date(quiz.completedAt) >= daysAgo)
      .slice(-30); // Max 30 points

    // Formater pour Chart.js
    const chartData = recentQuizzes.map((quiz, index) => ({
      date: new Date(quiz.completedAt).toLocaleDateString('fr-FR'),
      score: quiz.score || 0,
      subject: quiz.subject,
      index: index + 1
    }));

    res.json({
      success: true,
      period: parseInt(period),
      data: chartData
    });

  } catch (error) {
    console.error('❌ Erreur getPerformanceChart:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du graphique',
      error: error.message
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/time-by-subject
 * Temps passé par matière (pour graphique camembert)
 * ================================================================
 */
const getTimeBySubject = async (req, res) => {
  try {
    const userId = req.user._id;

    let progresses = [];
    try {
      progresses = await UserProgress.find({ userId })
        .select('subject totalTimeSpent totalQuizzes');
    } catch (error) {
      console.log('⚠️ Pas de UserProgress pour temps par matière');
    }

    // Formater pour graphique
    const data = progresses.map(p => ({
      subject: p.subject,
      timeSpent: Math.round((p.totalTimeSpent || 0) / 60), // minutes
      quizCount: p.totalQuizzes || 0
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
      message: 'Erreur lors de la récupération des données',
      error: error.message
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/performance-by-subject
 * Performance (score moyen) par matière
 * ================================================================
 */
const getPerformanceBySubject = async (req, res) => {
  try {
    const userId = req.user._id;

    let progresses = [];
    try {
      progresses = await UserProgress.find({ userId })
        .select('subject averageMastery bestScore totalQuizzes level')
        .sort({ averageMastery: -1 });
    } catch (error) {
      console.log('⚠️ Pas de UserProgress pour performance par matière');
    }

    const data = progresses.map(p => ({
      subject: p.subject,
      averageScore: p.averageMastery || 0,
      bestScore: p.bestScore || 0,
      quizCount: p.totalQuizzes || 0,
      level: p.level || 1
    }));

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ Erreur getPerformanceBySubject:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données',
      error: error.message
    });
  }
};

/**
 * ================================================================
 * EXPORTS
 * ================================================================
 */
module.exports = {
  getDashboard,
  getSubjectStats,
  getQuizHistory,
  getRecommendations,
  getPerformanceChart,
  getTimeBySubject,
  getPerformanceBySubject
};