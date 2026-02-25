/**
 * ================================================================
 * STATS CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 * Gère toutes les statistiques utilisateur et recommandations
 * À placer dans: backend/controllers/statsController.js
 * ================================================================
 */

const UserProgress = require('../models/UserProgress');
const Quiz = require('../models/Quiz');
const mongoose = require('mongoose');

/**
 * ================================================================
 * GET /api/stats/dashboard
 * Obtenir le dashboard complet de l'utilisateur
 * ================================================================
 */
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // 1. Statistiques globales
    const globalStats = await UserProgress.getUserGlobalStats(userId);
    
    // 2. Progression par matière
    const progressBySubject = await UserProgress.getStatsBySubject(userId);
    
    // 3. Quiz à réviser (urgents)
    const quizzesToReview = await UserProgress.getQuizzesToReview(userId, 10);
    
    // 4. Activité récente (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentActivity = await UserProgress.find({
      userId,
      lastAttemptDate: { $gte: sevenDaysAgo }
    })
    .populate('quizId', 'title subject category')
    .sort({ lastAttemptDate: -1 })
    .limit(10);
    
    // 5. Meilleurs scores récents
    const topScores = await UserProgress.find({
      userId,
      bestScore: { $gte: 80 }
    })
    .populate('quizId', 'title subject')
    .sort({ bestScore: -1 })
    .limit(5);
    
    // 6. Points faibles (quiz avec faible maîtrise)
    const weaknesses = await UserProgress.find({
      userId,
      mastery: { $lt: 50 },
      totalAttempts: { $gte: 1 }
    })
    .populate('quizId', 'title subject category')
    .sort({ mastery: 1 })
    .limit(5);
    
    // Formatter la réponse
    res.json({
      success: true,
      data: {
        global: {
          ...globalStats,
          progressPercentage: globalStats.totalQuizzes > 0 
            ? Math.round((globalStats.masteredQuizzes / globalStats.totalQuizzes) * 100)
            : 0
        },
        
        bySubject: progressBySubject,
        
        toReview: quizzesToReview.map(progress => {
          const daysOverdue = progress.nextReviewDate 
            ? Math.floor((new Date() - progress.nextReviewDate) / (1000 * 60 * 60 * 24))
            : 0;
          
          return {
            quizId: progress.quizId._id,
            title: progress.quizId.title,
            subject: progress.quizId.subject,
            category: progress.quizId.category,
            mastery: progress.mastery,
            masteryLevel: progress.getMasteryLevel(),
            nextReviewDate: progress.nextReviewDate,
            daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
            isUrgent: daysOverdue > 2
          };
        }),
        
        recentActivity: recentActivity.map(progress => ({
          quizId: progress.quizId._id,
          title: progress.quizId.title,
          subject: progress.quizId.subject,
          lastScore: progress.attempts[progress.attempts.length - 1]?.score || 0,
          mastery: progress.mastery,
          date: progress.lastAttemptDate,
          totalAttempts: progress.totalAttempts
        })),
        
        topScores: topScores.map(progress => ({
          quizId: progress.quizId._id,
          title: progress.quizId.title,
          subject: progress.quizId.subject,
          bestScore: progress.bestScore,
          mastery: progress.mastery
        })),
        
        weaknesses: weaknesses.map(progress => ({
          quizId: progress.quizId._id,
          title: progress.quizId.title,
          subject: progress.quizId.subject,
          category: progress.quizId.category,
          mastery: progress.mastery,
          attempts: progress.totalAttempts,
          needsWork: true
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur getDashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du dashboard'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/subject/:subject
 * Obtenir les statistiques détaillées pour une matière
 * ================================================================
 */
exports.getSubjectStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { subject } = req.params;
    
    // Récupérer tous les quiz de cette matière
    const allQuizzes = await Quiz.find({ subject }).select('_id title category');
    
    // Récupérer la progression de l'utilisateur pour cette matière
    const userProgress = await UserProgress.find({
      userId,
      subject
    }).populate('quizId', 'title category');
    
    // Calculer les stats
    const completed = userProgress.filter(p => p.mastery >= 50).length;
    const mastered = userProgress.filter(p => p.mastery >= 75).length;
    const averageMastery = userProgress.length > 0
      ? Math.round(userProgress.reduce((sum, p) => sum + p.mastery, 0) / userProgress.length)
      : 0;
    
    // Identifier les quiz non commencés
    const attemptedQuizIds = userProgress.map(p => p.quizId._id.toString());
    const notStarted = allQuizzes.filter(q => !attemptedQuizIds.includes(q._id.toString()));
    
    res.json({
      success: true,
      data: {
        subject,
        totalQuizzes: allQuizzes.length,
        attempted: userProgress.length,
        completed,
        mastered,
        notStarted: notStarted.length,
        averageMastery,
        progressPercentage: Math.round((completed / allQuizzes.length) * 100),
        
        quizzes: userProgress.map(p => ({
          quizId: p.quizId._id,
          title: p.quizId.title,
          category: p.quizId.category,
          mastery: p.mastery,
          masteryLevel: p.getMasteryLevel(),
          bestScore: p.bestScore,
          averageScore: p.averageScore,
          attempts: p.totalAttempts,
          lastAttempt: p.lastAttemptDate,
          needsReview: p.shouldReview()
        })).sort((a, b) => b.mastery - a.mastery),
        
        notStartedQuizzes: notStarted.map(q => ({
          quizId: q._id,
          title: q.title,
          category: q.category
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur getSubjectStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des stats de matière'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/quiz/:quizId
 * Obtenir l'historique détaillé d'un quiz
 * ================================================================
 */
exports.getQuizHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { quizId } = req.params;
    
    const progress = await UserProgress.findOne({
      userId,
      quizId
    }).populate('quizId', 'title subject category questions');
    
    if (!progress) {
      return res.json({
        success: true,
        data: {
          hasAttempts: false,
          quiz: await Quiz.findById(quizId).select('title subject category')
        }
      });
    }
    
    // Analyser les performances par question
    const questionAnalysis = [];
    const totalQuestions = progress.quizId.questions.length;
    
    for (let i = 0; i < totalQuestions; i++) {
      const correctCount = progress.attempts.reduce((count, attempt) => {
        const userAnswer = attempt.answers[i];
        const correctAnswer = progress.quizId.questions[i].correctAnswers;
        const isCorrect = JSON.stringify(userAnswer?.sort()) === JSON.stringify(correctAnswer.sort());
        return count + (isCorrect ? 1 : 0);
      }, 0);
      
      questionAnalysis.push({
        questionIndex: i,
        questionText: progress.quizId.questions[i].text.substring(0, 100) + '...',
        successRate: Math.round((correctCount / progress.totalAttempts) * 100),
        correctCount,
        totalAttempts: progress.totalAttempts
      });
    }
    
    res.json({
      success: true,
      data: {
        hasAttempts: true,
        quiz: {
          id: progress.quizId._id,
          title: progress.quizId.title,
          subject: progress.quizId.subject,
          category: progress.quizId.category
        },
        summary: {
          mastery: progress.mastery,
          masteryLevel: progress.getMasteryLevel(),
          bestScore: progress.bestScore,
          averageScore: progress.averageScore,
          totalAttempts: progress.totalAttempts,
          lastAttempt: progress.lastAttemptDate,
          nextReview: progress.nextReviewDate,
          needsReview: progress.shouldReview()
        },
        attempts: progress.attempts.map((attempt, index) => ({
          attemptNumber: index + 1,
          score: attempt.score,
          correctCount: attempt.correctCount,
          totalQuestions: attempt.totalQuestions,
          date: attempt.completedAt,
          timeSpent: attempt.timeSpent
        })).reverse(), // Plus récent en premier
        
        questionAnalysis: questionAnalysis.sort((a, b) => a.successRate - b.successRate),
        
        achievements: progress.achievements
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur getQuizHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/recommendations
 * Obtenir des recommandations personnalisées
 * ================================================================
 */
exports.getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const recommendations = [];
    
    // 1. Quiz urgents à réviser
    const urgentReviews = await UserProgress.find({
      userId,
      needsReview: true,
      mastery: { $lt: 75 }
    })
    .populate('quizId', 'title subject')
    .sort({ nextReviewDate: 1 })
    .limit(3);
    
    urgentReviews.forEach(progress => {
      recommendations.push({
        type: 'urgent_review',
        priority: 'high',
        title: `Réviser "${progress.quizId.title}"`,
        description: `Votre maîtrise (${progress.mastery}%) nécessite une révision`,
        action: {
          type: 'start_quiz',
          quizId: progress.quizId._id
        },
        metadata: {
          subject: progress.quizId.subject,
          mastery: progress.mastery
        }
      });
    });
    
    // 2. Points faibles à améliorer
    const weaknesses = await UserProgress.find({
      userId,
      mastery: { $lt: 40 },
      totalAttempts: { $gte: 2 }
    })
    .populate('quizId', 'title subject')
    .sort({ mastery: 1 })
    .limit(2);
    
    weaknesses.forEach(progress => {
      recommendations.push({
        type: 'improve_weakness',
        priority: 'medium',
        title: `Renforcer "${progress.quizId.title}"`,
        description: `${progress.totalAttempts} tentatives mais maîtrise faible (${progress.mastery}%)`,
        action: {
          type: 'practice_quiz',
          quizId: progress.quizId._id
        },
        metadata: {
          subject: progress.quizId.subject,
          attempts: progress.totalAttempts
        }
      });
    });
    
    // 3. Nouveaux quiz à essayer (matières déjà commencées)
    const startedSubjects = await UserProgress.distinct('subject', { userId });
    
    for (const subject of startedSubjects.slice(0, 2)) {
      const attemptedQuizIds = await UserProgress.find({ userId, subject }).distinct('quizId');
      
      const newQuiz = await Quiz.findOne({
        subject,
        _id: { $nin: attemptedQuizIds }
      }).select('title subject category');
      
      if (newQuiz) {
        recommendations.push({
          type: 'new_quiz',
          priority: 'low',
          title: `Nouveau quiz disponible: "${newQuiz.title}"`,
          description: `Continuez votre progression en ${subject}`,
          action: {
            type: 'discover_quiz',
            quizId: newQuiz._id
          },
          metadata: {
            subject: newQuiz.subject,
            category: newQuiz.category
          }
        });
      }
    }
    
    // 4. Streak à maintenir (si activité récente)
    const recentActivity = await UserProgress.countDocuments({
      userId,
      lastAttemptDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    if (recentActivity > 0) {
      recommendations.push({
        type: 'maintain_streak',
        priority: 'low',
        title: '🔥 Maintenez votre rythme !',
        description: `Vous avez fait ${recentActivity} quiz aujourd'hui. Excellent !`,
        action: {
          type: 'continue_learning',
          url: '/quiz.html'
        }
      });
    }
    
    // Trier par priorité
    const priorityOrder = { high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    res.json({
      success: true,
      data: {
        count: recommendations.length,
        recommendations: recommendations.slice(0, 5) // Max 5 recommandations
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur getRecommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des recommandations'
    });
  }
};

/**
 * ================================================================
 * GET /api/stats/performance-chart
 * Obtenir les données pour graphique de performance
 * ================================================================
 */
exports.getPerformanceChart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '30' } = req.query; // 7, 30, 90 jours
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    
    const progress = await UserProgress.find({
      userId,
      lastAttemptDate: { $gte: daysAgo }
    }).sort({ lastAttemptDate: 1 });
    
    // Créer un graphique jour par jour
    const chartData = [];
    const dateMap = new Map();
    
    progress.forEach(p => {
      p.attempts.forEach(attempt => {
        if (attempt.completedAt >= daysAgo) {
          const dateKey = attempt.completedAt.toISOString().split('T')[0];
          
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, {
              date: dateKey,
              totalScore: 0,
              count: 0,
              quizzes: []
            });
          }
          
          const dayData = dateMap.get(dateKey);
          dayData.totalScore += attempt.score;
          dayData.count += 1;
          dayData.quizzes.push({
            score: attempt.score,
            timeSpent: attempt.timeSpent
          });
        }
      });
    });
    
    // Convertir en tableau et calculer moyennes
    dateMap.forEach((value, key) => {
      chartData.push({
        date: key,
        averageScore: Math.round(value.totalScore / value.count),
        quizzesCompleted: value.count
      });
    });
    
    chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json({
      success: true,
      data: {
        period: parseInt(period),
        chartData
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur getPerformanceChart:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du graphique'
    });
  }
};

/**
 * ================================================================
 * EXPORT
 * ================================================================
 */
module.exports = {
  getDashboard,
  getSubjectStats,
  getQuizHistory,
  getRecommendations,
  getPerformanceChart
};