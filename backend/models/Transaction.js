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
    sparse: true
  },
  amount: {
    type: Number,
    required: true
  },
  durationInMonths: {
    type: Number,
    required: true,
    default: 1
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
  paymentGateway: {
    type: String,
    enum: ['kkiapay_widget', 'kkiapay_direct'],
    required: true
  },
  description: {
    type: String
  },
  accessCode: {
    type: String
  },
  accessCodeUsed: {
    type: Boolean,
    default: false
  },
  subscriptionStart: {
    type: Date
  },
  subscriptionEnd: {
    type: Date
  },
  kkiapayPaymentUrl: {
    type: String
  }
}, {
  timestamps: true
});

// Index pour les recherches rapides
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ kkiapayTransactionId: 1 });
transactionSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);