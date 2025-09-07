const mongoose = require('mongoose');

const AccessCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  },
  used: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour l'expiration automatique
AccessCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index pour les recherches par code et utilisateur
AccessCodeSchema.index({ code: 1, userId: 1 });

module.exports = mongoose.model('AccessCode', AccessCodeSchema);