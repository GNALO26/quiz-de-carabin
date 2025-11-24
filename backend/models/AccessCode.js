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
  used: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  transactionId: {
    type: String,
    ref: 'Transaction'
  }
}, {
  timestamps: true
});

// Index pour les recherches rapides
accessCodeSchema.index({ code: 1 });
accessCodeSchema.index({ userId: 1 });
accessCodeSchema.index({ expiresAt: 1 });

// Middleware pour supprimer les codes expirés
accessCodeSchema.post('save', function() {
  // Supprimer les codes expirés
  mongoose.model('AccessCode').deleteMany({ 
    expiresAt: { $lt: new Date() } 
  }).then(result => {
    if (result.deletedCount > 0) {
      console.log(`🧹 ${result.deletedCount} code(s) d'accès expiré(s) supprimé(s)`);
    }
  });
});

module.exports = mongoose.model('AccessCode', accessCodeSchema);