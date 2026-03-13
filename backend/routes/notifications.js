const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Toutes les routes sont protégées par auth (appliqué globalement dans server.js)

// GET /api/notifications - Récupérer les notifications
router.get('/', notificationController.getNotifications);

// GET /api/notifications/unread-count - Compter les non lues
router.get('/unread-count', notificationController.getUnreadCount);

// PUT /api/notifications/:id/read - Marquer comme lu
router.put('/:id/read', notificationController.markAsRead);

// PUT /api/notifications/read-all - Tout marquer comme lu
router.put('/read-all', notificationController.markAllAsRead);

// DELETE /api/notifications/:id - Supprimer une notification
router.delete('/:id', notificationController.deleteNotification);

// DELETE /api/notifications/read - Supprimer toutes les lues
router.delete('/read', notificationController.deleteAllRead);

console.log('✅ Routes notifications chargées');

module.exports = router;