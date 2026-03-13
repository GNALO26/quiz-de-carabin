const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'premium_activated',
      'premium_expiring_soon',
      'premium_expired',
      'payment_success',
      'password_changed',
      'welcome',
      'new_record',
      'new_quiz',
      'weekly_summary',
      'reengagement',
      'system',
      'achievement'
    ]
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  icon: {
    type: String,
    default: '🔔',
    maxlength: 10
  },
  link: {
    type: String,
    default: null,
    maxlength: 200
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index composé pour récupérer rapidement les notifications non lues d'un user
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// Méthode pour marquer comme lu
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Méthode statique pour marquer toutes les notifications d'un user comme lues
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { userId, read: false },
    { read: true, readAt: new Date() }
  );
};

// Méthode statique pour supprimer les notifications expirées
notificationSchema.statics.cleanExpired = function() {
  return this.deleteMany({
    expiresAt: { $lte: new Date() }
  });
};

// Méthode statique pour obtenir le nombre de non lues
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ userId, read: false });
};

// ✅ Empêcher la redéfinition du modèle
module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);