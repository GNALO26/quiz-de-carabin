const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String,
    trim: true
  },
  isPremium: { 
    type: Boolean, 
    default: false 
  },
  premiumExpiresAt: { 
    type: Date, 
    default: null 
  },
  premiumStartedAt: { 
    type: Date, 
    default: null 
  },
  subscriptionHistory: [{
    planId: String,
    amount: Number,
    startedAt: Date,
    expiresAt: Date,
    transactionId: String,
    durationInMonths: Number
  }],
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Méthode pour vérifier le mot de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Méthode pour vérifier si l'abonnement est actif
userSchema.methods.isPremiumActive = function() {
  if (!this.isPremium || !this.premiumExpiresAt) return false;
  return this.premiumExpiresAt > new Date();
};

// Méthode pour obtenir les jours restants
userSchema.methods.getDaysRemaining = function() {
  if (!this.isPremiumActive()) return 0;
  const now = new Date();
  const diffTime = this.premiumExpiresAt - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Middleware pour hacher le mot de passe avant sauvegarde
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);