const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  code: {
    type: String,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 heure
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour la recherche des codes non expirés
passwordResetSchema.index({ email: 1, code: 1, used: 1, expiresAt: 1 });

// Supprimer automatiquement les entrées expirées
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
