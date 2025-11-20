const mongoose = require('mongoose');

const accessCodeSchema = new mongoose.Schema({
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
  transactionId: {
    type: String,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true
  },
  planId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Index pour la recherche et la validation
accessCodeSchema.index({ code: 1 });
accessCodeSchema.index({ userId: 1 });
accessCodeSchema.index({ expiresAt: 1 });
accessCodeSchema.index({ email: 1, used: 1 });

// Méthode pour vérifier si le code est valide
accessCodeSchema.methods.isValid = function() {
  return !this.used && this.expiresAt > new Date();
};

module.exports = mongoose.model('AccessCode', accessCodeSchema);