/**
 * ================================================================
 * NOTIFICATION ROUTES - QUIZ DE CARABIN
 * ================================================================
 * Routes pour gérer les notifications
 * ================================================================
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/emailNotificationController');
const auth = require('../middleware/auth');

// Note: Pour les routes admin, ajoute un middleware adminAuth si tu en as un
// Sinon, vérifie req.user.role === 'admin' dans le controller

/**
 * @route   POST /api/notifications/quiz/:quizId
 * @desc    Envoyer notification nouveau quiz
 * @access  Admin only
 */
router.post('/quiz/:quizId', auth, notificationController.sendNewQuizNotification);

/**
 * @route   POST /api/notifications/weekly-digest
 * @desc    Envoyer digest hebdomadaire
 * @access  Admin only
 */
router.post('/weekly-digest', auth, notificationController.sendWeeklyDigest);

/**
 * @route   POST /api/notifications/premium-expiring
 * @desc    Envoyer rappels expiration Premium
 * @access  Admin only
 */
router.post('/premium-expiring', auth, notificationController.sendPremiumExpiringNotifications);

/**
 * @route   GET /api/notifications/history
 * @desc    Historique des notifications
 * @access  Admin only
 */
router.get('/history', auth, notificationController.getNotificationHistory);

/**
 * @route   GET /api/notifications/stats
 * @desc    Statistiques notifications
 * @access  Admin only
 */
router.get('/stats', auth, notificationController.getNotificationStats);

/**
 * @route   GET /api/notifications/:id
 * @desc    Détails notification
 * @access  Admin only
 */
router.get('/:id', auth, notificationController.getNotificationDetails);

module.exports = router;