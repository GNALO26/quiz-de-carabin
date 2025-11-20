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
  kkiapayTransactionId: {
    type: String,
    default: null
  },
  kkiapayPaymentUrl: {
    type: String,
    default: null
  },
  paymentLinkId: {
    type: String,
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  durationInMonths: {
    type: Number,
    required: true
  },
  planId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  accessCode: {
    type: String,
    default: null
  },
  userEmail: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Index pour les recherches fréquentes
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);