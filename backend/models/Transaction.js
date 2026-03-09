/**
 * ================================================================
 * TRANSACTION MODEL - QUIZ DE CARABIN
 * ================================================================
 * Modèle pour les transactions avec système de code d'activation
 * ================================================================
 */

const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // Utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // ID de la transaction (FedaPay ou KKiaPay)
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Montant
  amount: {
    type: Number,
    required: true
  },

  // Plan acheté
  plan: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual', '1-month', '3-months', '12-months'],
    required: true
  },

  // Durée en mois
  durationInMonths: {
    type: Number,
    required: true
  },

  // Statut du paiement
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'canceled', 'refunded'],
    default: 'pending',
    index: true
  },

  // Provider (fedapay ou kkiapay)
  provider: {
    type: String,
    enum: ['fedapay', 'kkiapay', 'kkiapay_widget'],
    default: 'kkiapay'
  },

  // ===========================
  // SYSTÈME DE CODE D'ACTIVATION
  // ===========================
  
  // Code d'activation à 6 chiffres
  activationCode: {
    type: String,
    required: true,
    index: true
  },

  // Code utilisé ou non
  codeUsed: {
    type: Boolean,
    default: false,
    index: true
  },

  // Date d'utilisation du code
  codeUsedAt: {
    type: Date
  },

  // Expiration du code (24h après génération)
  codeExpiresAt: {
    type: Date,
    required: true,
    index: true
  },

  // Email de code envoyé
  codeEmailSent: {
    type: Boolean,
    default: false
  },

  // Date d'envoi de l'email
  codeEmailSentAt: {
    type: Date
  },

  // ===========================
  // ACTIVATION PREMIUM
  // ===========================
  
  // Premium activé ou non
  premiumActivated: {
    type: Boolean,
    default: false,
    index: true
  },

  // Date d'activation Premium
  premiumActivatedAt: {
    type: Date
  },

  // Date d'expiration Premium
  premiumExpiresAt: {
    type: Date
  },

  // Email de bienvenue Premium envoyé
  welcomeEmailSent: {
    type: Boolean,
    default: false
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

  // Dates
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
  next();
});

// ===========================
// MÉTHODES D'INSTANCE
// ===========================

/**
 * Générer un code d'activation à 6 chiffres
 */
TransactionSchema.methods.generateActivationCode = function() {
  // Générer code aléatoire 6 chiffres
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  this.activationCode = code;
  this.codeUsed = false;
  this.codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h
  
  return code;
};

/**
 * Vérifier si le code est valide
 */
TransactionSchema.methods.isCodeValid = function(inputCode) {
  // Vérifier si code correspond
  if (this.activationCode !== inputCode) {
    return { valid: false, reason: 'Code incorrect' };
  }

  // Vérifier si code déjà utilisé
  if (this.codeUsed) {
    return { valid: false, reason: 'Code déjà utilisé' };
  }

  // Vérifier si code expiré
  if (new Date() > this.codeExpiresAt) {
    return { valid: false, reason: 'Code expiré' };
  }

  // Vérifier si paiement approuvé
  if (this.status !== 'approved') {
    return { valid: false, reason: 'Paiement non validé' };
  }

  return { valid: true };
};

/**
 * Marquer le code comme utilisé
 */
TransactionSchema.methods.markCodeAsUsed = function() {
  this.codeUsed = true;
  this.codeUsedAt = new Date();
  return this.save();
};

/**
 * Activer Premium
 */
TransactionSchema.methods.activatePremium = function() {
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setMonth(expiryDate.getMonth() + this.durationInMonths);

  this.premiumActivated = true;
  this.premiumActivatedAt = now;
  this.premiumExpiresAt = expiryDate;

  return this.save();
};

// ===========================
// MÉTHODES STATIQUES
// ===========================

/**
 * Trouver une transaction par code d'activation
 */
TransactionSchema.statics.findByActivationCode = function(code) {
  return this.findOne({ 
    activationCode: code,
    status: 'approved'
  }).populate('userId', 'name email');
};

/**
 * Trouver les codes expirés non utilisés
 */
TransactionSchema.statics.findExpiredCodes = function() {
  return this.find({
    codeUsed: false,
    codeExpiresAt: { $lt: new Date() },
    status: 'approved'
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