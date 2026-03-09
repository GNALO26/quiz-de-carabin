const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // Utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ID de la transaction chez le provider (FedaPay / KkiaPay)
  // Non requis à la création — rempli après réponse du provider
  transactionId: {
    type: String,
    unique: true,
    sparse: true, // permet plusieurs documents sans ce champ
    index: true
  },

  // Montant
  amount: {
    type: Number,
    required: true
  },

  // Plan acheté — unifié sans tirets
  plan: {
    type: String,
    enum: ['1month', '3months', '10months', 'monthly', 'quarterly', 'annual', '1-month', '3-months', '12-months'],
    required: true
  },

  // Durée en mois (calculée automatiquement selon le plan)
  durationInMonths: {
    type: Number,
    required: true
  },

  // Statut du paiement
  status: {
    type: String,
    enum: ['pending', 'approved', 'completed', 'declined', 'canceled', 'refunded', 'failed'],
    default: 'pending',
    index: true
  },

  // Provider
  provider: {
    type: String,
    enum: ['fedapay', 'kkiapay', 'kkiapay_widget'],
    default: 'fedapay'
  },

  // Pour compatibilité avec l'ancien code
  paymentMethod: {
    type: String
  },

  // Durée en jours (ancien champ)
  planDuration: {
    type: Number
  },

  currency: {
    type: String,
    default: 'XOF'
  },

  // ===========================
  // SYSTÈME DE CODE D'ACTIVATION
  // ===========================

  activationCode: {
    type: String,
    index: true,
    sparse: true // pas requis à la création
  },

  codeUsed: {
    type: Boolean,
    default: false,
    index: true
  },

  codeUsedAt: {
    type: Date
  },

  // Expiration du code (remplie après génération)
  codeExpiresAt: {
    type: Date,
    index: true
  },

  codeEmailSent: {
    type: Boolean,
    default: false
  },

  codeEmailSentAt: {
    type: Date
  },

  // ===========================
  // ACTIVATION PREMIUM
  // ===========================

  premiumActivated: {
    type: Boolean,
    default: false,
    index: true
  },

  premiumActivatedAt: {
    type: Date
  },

  premiumExpiresAt: {
    type: Date
  },

  welcomeEmailSent: {
    type: Boolean,
    default: false
  },

  completedAt: {
    type: Date
  },

  // ===========================
  // MÉTADONNÉES
  // ===========================

  description: {
    type: String
  },

  metadata: {
    type: Object,
    default: {}
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ===========================
// MIDDLEWARE PRE-SAVE
// ===========================

TransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Calculer durationInMonths automatiquement si pas défini
  if (!this.durationInMonths) {
    const durationMap = {
      '1month':   1,
      '3months':  3,
      '10months': 10,
      '1-month':  1,
      '3-months': 3,
      '12-months': 12,
      'monthly':  1,
      'quarterly': 3,
      'annual':   12
    };
    this.durationInMonths = durationMap[this.plan] || 1;
  }

  next();
});

// ===========================
// MÉTHODES D'INSTANCE
// ===========================

TransactionSchema.methods.generateActivationCode = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.activationCode = code;
  this.codeUsed = false;
  this.codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
  return code;
};

TransactionSchema.methods.isCodeValid = function(inputCode) {
  if (this.activationCode !== inputCode) {
    return { valid: false, reason: 'Code incorrect' };
  }
  if (this.codeUsed) {
    return { valid: false, reason: 'Code déjà utilisé' };
  }
  if (this.codeExpiresAt && new Date() > this.codeExpiresAt) {
    return { valid: false, reason: 'Code expiré' };
  }
  if (!['approved', 'completed'].includes(this.status)) {
    return { valid: false, reason: 'Paiement non validé' };
  }
  return { valid: true };
};

TransactionSchema.methods.markCodeAsUsed = function() {
  this.codeUsed = true;
  this.codeUsedAt = new Date();
  return this.save();
};

TransactionSchema.methods.activatePremium = function() {
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() + (this.durationInMonths || 1));

  this.premiumActivated = true;
  this.premiumActivatedAt = now;
  this.premiumExpiresAt = expiryDate;

  return this.save();
};

// ===========================
// MÉTHODES STATIQUES
// ===========================

TransactionSchema.statics.findByActivationCode = function(code) {
  return this.findOne({
    activationCode: code,
    status: { $in: ['approved', 'completed'] }
  }).populate('userId', 'name email');
};

TransactionSchema.statics.findExpiredCodes = function() {
  return this.find({
    codeUsed: false,
    codeExpiresAt: { $lt: new Date() },
    status: { $in: ['approved', 'completed'] }
  });
};

// ===========================
// INDEX COMPOSÉS
// ===========================

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ status: 1, codeUsed: 1 });
TransactionSchema.index({ activationCode: 1, status: 1 });
TransactionSchema.index({ codeExpiresAt: 1, codeUsed: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);