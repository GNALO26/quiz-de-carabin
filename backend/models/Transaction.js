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
  // ✅ CHAMPS KKiaPay
  kkiapayTransactionId: {
    type: String,
    default: null
  },
  kkiapayPaymentUrl: {
    type: String,
    default: null
  },
  paymentGateway: {
    type: String,
    enum: ['kkiapay_widget', 'kkiapay_direct'],
    default: 'kkiapay_direct'
  },
  planId: {
    type: String,
    required: true,
    enum: ['5k', '12k', '25k']
  },
  accessCode: {
    type: String,
    default: null
  },
  accessCodeUsed: {
    type: Boolean,
    default: false
  },
  durationInMonths: {
    type: Number,
    required: true
  },
  subscriptionStart: {
    type: Date,
    default: null
  },
  subscriptionEnd: {
    type: Date,
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

transactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index pour les recherches courantes
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ kkiapayTransactionId: 1 });
transactionSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);