const Notification = require('../models/Notification');

/**
 * Récupérer toutes les notifications de l'utilisateur connecté
 */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const query = { userId: req.user._id };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    res.status(200).json({
      success: true,
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      unreadCount
    });
  } catch (error) {
    console.error('❌ Erreur getNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notifications'
    });
  }
};

/**
 * Obtenir le nombre de notifications non lues
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('❌ Erreur getUnreadCount:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du comptage des notifications'
    });
  }
};

/**
 * Marquer une notification comme lue
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée'
      });
    }

    await notification.markAsRead();

    res.status(200).json({
      success: true,
      message: 'Notification marquée comme lue',
      notification
    });
  } catch (error) {
    console.error('❌ Erreur markAsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour'
    });
  }
};

/**
 * Marquer toutes les notifications comme lues
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Toutes les notifications marquées comme lues'
    });
  } catch (error) {
    console.error('❌ Erreur markAllAsRead:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour'
    });
  }
};

/**
 * Supprimer une notification
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification supprimée'
    });
  } catch (error) {
    console.error('❌ Erreur deleteNotification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
};

/**
 * Supprimer toutes les notifications lues
 */
const deleteAllRead = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      userId: req.user._id,
      read: true
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} notification(s) supprimée(s)`
    });
  } catch (error) {
    console.error('❌ Erreur deleteAllRead:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead
};