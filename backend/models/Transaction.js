const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  paydunyaInvoiceToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Suppression automatique après 24 heures
  }
});

// Index pour les recherches rapides
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ transactionId: 1 }, { unique: true });

module.exports = mongoose.model('Transaction', transactionSchema);