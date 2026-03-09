/**
 * ================================================================
 * NOTIFICATION MODEL - QUIZ DE CARABIN
 * ================================================================
 * Modèle pour gérer les notifications email
 * ================================================================
 */

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // Type de notification
  type: {
    type: String,
    enum: [
      'new_quiz',           // Nouveau quiz publié
      'weekly_digest',      // Résumé hebdomadaire
      'premium_expiring',   // Premium expire bientôt
      'premium_expired',    // Premium expiré
      'achievement',        // Badge débloqué
      'leaderboard',        // Position dans classement
      'inactivity',         // Utilisateur inactif
      'welcome',            // Email de bienvenue
      'custom'              // Email personnalisé
    ],
    required: true,
    index: true
  },

  // Sujet de l'email
  subject: {
    type: String,
    required: true
  },

  // Destinataires
  recipients: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: String,
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    opened: {
      type: Boolean,
      default: false
    },
    openedAt: Date,
    clicked: {
      type: Boolean,
      default: false
    },
    clickedAt: Date,
    error: String
  }],

  // Contenu (pour référence)
  content: {
    type: String
  },

  // Métadonnées
  metadata: {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    },
    subject: String,  // Matière du quiz
    category: String,
    customData: Object
  },

  // Statistiques
  stats: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    }
  },

  // Statut d'envoi
  status: {
    type: String,
    enum: ['pending', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },

  // Planification
  scheduledFor: {
    type: Date,
    index: true
  },

  // Envoyé par
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Dates
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  sentAt: {
    type: Date
  }
});

// ===========================
// MÉTHODES D'INSTANCE
// ===========================

/**
 * Marquer comme envoyé pour un destinataire
 */
NotificationSchema.methods.markAsSent = function(userId, error = null) {
  const recipient = this.recipients.find(
    r => r.userId.toString() === userId.toString()
  );

  if (recipient) {
    recipient.sent = !error;
    recipient.sentAt = new Date();
    if (error) {
      recipient.error = error;
      this.stats.failed += 1;
    } else {
      this.stats.sent += 1;
    }
  }

  // Mettre à jour le statut global
  if (this.stats.sent + this.stats.failed >= this.stats.totalRecipients) {
    this.status = 'sent';
    this.sentAt = new Date();
  }

  return this.save();
};

/**
 * Enregistrer une ouverture
 */
NotificationSchema.methods.trackOpen = function(userId) {
  const recipient = this.recipients.find(
    r => r.userId.toString() === userId.toString()
  );

  if (recipient && !recipient.opened) {
    recipient.opened = true;
    recipient.openedAt = new Date();
    this.stats.opened += 1;
    return this.save();
  }

  return Promise.resolve(this);
};

/**
 * Enregistrer un clic
 */
NotificationSchema.methods.trackClick = function(userId) {
  const recipient = this.recipients.find(
    r => r.userId.toString() === userId.toString()
  );

  if (recipient && !recipient.clicked) {
    recipient.clicked = true;
    recipient.clickedAt = new Date();
    this.stats.clicked += 1;
    return this.save();
  }

  return Promise.resolve(this);
};

/**
 * Obtenir le taux d'ouverture
 */
NotificationSchema.methods.getOpenRate = function() {
  if (this.stats.sent === 0) return 0;
  return Math.round((this.stats.opened / this.stats.sent) * 100);
};

/**
 * Obtenir le taux de clic
 */
NotificationSchema.methods.getClickRate = function() {
  if (this.stats.sent === 0) return 0;
  return Math.round((this.stats.clicked / this.stats.sent) * 100);
};

// ===========================
// MÉTHODES STATIQUES
// ===========================

/**
 * Créer une notification pour nouveaux quiz
 */
NotificationSchema.statics.createNewQuizNotification = async function(quiz, userIds) {
  const notification = new this({
    type: 'new_quiz',
    subject: `🎯 Nouveau quiz : ${quiz.title}`,
    content: `Un nouveau quiz "${quiz.title}" a été publié dans ${quiz.subject}`,
    metadata: {
      quizId: quiz._id,
      subject: quiz.subject,
      category: quiz.category
    },
    recipients: userIds.map(userId => ({
      userId: userId,
      sent: false
    })),
    stats: {
      totalRecipients: userIds.length
    },
    status: 'pending'
  });

  return await notification.save();
};

/**
 * Récupérer les notifications en attente
 */
NotificationSchema.statics.getPendingNotifications = function() {
  return this.find({
    status: 'pending',
    $or: [
      { scheduledFor: { $lte: new Date() } },
      { scheduledFor: null }
    ]
  }).sort({ createdAt: 1 });
};

/**
 * Statistiques globales
 */
NotificationSchema.statics.getGlobalStats = async function(period = 30) {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - period);

  const notifications = await this.find({
    createdAt: { $gte: daysAgo }
  });

  const stats = {
    total: notifications.length,
    sent: 0,
    opened: 0,
    clicked: 0,
    byType: {}
  };

  notifications.forEach(notif => {
    stats.sent += notif.stats.sent;
    stats.opened += notif.stats.opened;
    stats.clicked += notif.stats.clicked;

    if (!stats.byType[notif.type]) {
      stats.byType[notif.type] = 0;
    }
    stats.byType[notif.type] += 1;
  });

  stats.openRate = stats.sent > 0 
    ? Math.round((stats.opened / stats.sent) * 100) 
    : 0;

  stats.clickRate = stats.sent > 0 
    ? Math.round((stats.clicked / stats.sent) * 100) 
    : 0;

  return stats;
};

// ===========================
// INDEX
// ===========================

NotificationSchema.index({ type: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ 'recipients.userId': 1, createdAt: -1 });
NotificationSchema.index({ scheduledFor: 1, status: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);