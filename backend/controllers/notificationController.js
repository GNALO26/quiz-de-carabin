/**
 * ================================================================
 * NOTIFICATION CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 * Controller pour gérer les notifications (admin)
 * ================================================================
 */

const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const Quiz = require('../models/Quiz');

/**
 * ================================================================
 * POST /api/notifications/quiz/:quizId
 * Envoyer notification pour un nouveau quiz
 * ================================================================
 */
const sendNewQuizNotification = async (req, res) => {
  try {
    const { quizId } = req.params;

    // Vérifier que le quiz existe
    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }

    // Envoyer les notifications
    const result = await notificationService.notifyNewQuiz(quiz);

    if (result.success) {
      res.json({
        success: true,
        message: `Notification envoyée à ${result.sent} utilisateur(s)`,
        data: {
          sent: result.sent,
          failed: result.failed,
          total: result.total,
          notificationId: result.notificationId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi des notifications',
        error: result.error
      });
    }

  } catch (error) {
    console.error('❌ Erreur sendNewQuizNotification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi des notifications'
    });
  }
};

/**
 * ================================================================
 * POST /api/notifications/weekly-digest
 * Envoyer le digest hebdomadaire
 * ================================================================
 */
const sendWeeklyDigest = async (req, res) => {
  try {
    const result = await notificationService.sendWeeklyDigest();

    if (result.success) {
      res.json({
        success: true,
        message: `Digest envoyé à ${result.sent} utilisateur(s)`,
        sent: result.sent
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du digest'
      });
    }

  } catch (error) {
    console.error('❌ Erreur sendWeeklyDigest:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi'
    });
  }
};

/**
 * ================================================================
 * POST /api/notifications/premium-expiring
 * Envoyer rappels expiration Premium
 * ================================================================
 */
const sendPremiumExpiringNotifications = async (req, res) => {
  try {
    const result = await notificationService.notifyPremiumExpiring();

    if (result.success) {
      res.json({
        success: true,
        message: `Rappels envoyés à ${result.sent} utilisateur(s)`,
        sent: result.sent
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi des rappels'
      });
    }

  } catch (error) {
    console.error('❌ Erreur sendPremiumExpiringNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi'
    });
  }
};

/**
 * ================================================================
 * GET /api/notifications/history
 * Historique des notifications envoyées
 * ================================================================
 */
const getNotificationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;

    const query = {};
    if (type) query.type = type;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select('type subject stats status createdAt sentAt');

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Erreur getNotificationHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
};

/**
 * ================================================================
 * GET /api/notifications/stats
 * Statistiques des notifications
 * ================================================================
 */
const getNotificationStats = async (req, res) => {
  try {
    const { period = 30 } = req.query;

    const stats = await Notification.getGlobalStats(parseInt(period));

    res.json({
      success: true,
      period: parseInt(period),
      stats: stats
    });

  } catch (error) {
    console.error('❌ Erreur getNotificationStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des stats'
    });
  }
};

/**
 * ================================================================
 * GET /api/notifications/:id
 * Détails d'une notification
 * ================================================================
 */
const getNotificationDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id)
      .populate('recipients.userId', 'name email')
      .populate('metadata.quizId', 'title subject');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée'
      });
    }

    res.json({
      success: true,
      data: {
        id: notification._id,
        type: notification.type,
        subject: notification.subject,
        status: notification.status,
        stats: notification.stats,
        openRate: notification.getOpenRate(),
        clickRate: notification.getClickRate(),
        metadata: notification.metadata,
        recipients: notification.recipients,
        createdAt: notification.createdAt,
        sentAt: notification.sentAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur getNotificationDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails'
    });
  }
};

module.exports = {
  sendNewQuizNotification,
  sendWeeklyDigest,
  sendPremiumExpiringNotifications,
  getNotificationHistory,
  getNotificationStats,
  getNotificationDetails
};