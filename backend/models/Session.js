const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    screenResolution: String,
    timezone: String,
    deviceId: String
  },
  ipAddress: {
    type: String,
    required: true
  },
  location: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // 24 heures en secondes
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Index pour améliorer les performances
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

// Méthode pour désactiver une session
sessionSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Méthode statique pour désactiver toutes les sessions d'un utilisateur
sessionSchema.statics.deactivateAllUserSessions = function(userId) {
  return this.updateMany(
    { userId, isActive: true },
    { isActive: false }
  );
};

// Méthode statique pour trouver des sessions actives
sessionSchema.statics.findActiveSessions = function(userId) {
  return this.find({ userId, isActive: true });
};

// Méthode statique pour trouver une session par son ID
sessionSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({ sessionId, isActive: true });
};

module.exports = mongoose.model('Session', sessionSchema);