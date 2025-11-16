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
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  // Champs KkiaPay
  kkiapayTransactionId: {
    type: String,
    default: null
  },
  kkiapayPaymentUrl: {
    type: String,
    default: null
  },
  // Anciens champs PayDunya (à garder pour compatibilité)
  paydunyaInvoiceToken: {
    type: String,
    default: null
  },
  paydunyaInvoiceURL: {
    type: String,
    default: null
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

module.exports = mongoose.model('Transaction', transactionSchema);