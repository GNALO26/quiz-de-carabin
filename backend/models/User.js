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
    validate: {
      validator: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Format d\'email invalide'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    validate: {
      validator: function(password) {
        return password.length >= 6;
      },
      message: 'Le mot de passe doit contenir au moins 6 caractères'
    }
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpiresAt: {
    type: Date,
    default: null
  },
  // ✅ AJOUT DU CHAMP isAdmin
  isAdmin: {
    type: Boolean,
    default: false
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  activeSessionId: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  lastExpiryWarning: {
     type: Date,
     default: null
   },
  loginHistory: [{
    timestamp: Date,
    deviceId: String,
    deviceInfo: Object,
    ipAddress: String,
    location: String,
    success: Boolean,
    reason: String
  }],
  quizHistory: [{
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    },
    score: Number,
    totalQuestions: Number,
    correctAnswers: Number,
    completedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pre-save pour normaliser l'email
userSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  next();
});

// Hash du mot de passe avant sauvegarde
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

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Méthode statique pour trouver par email (insensible à la casse)
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

// Méthode pour vérifier si l'utilisateur a un abonnement premium actif
userSchema.methods.hasActivePremium = function() {
  if (!this.isPremium) return false;
  
  if (this.premiumExpiresAt) {
    return new Date() < new Date(this.premiumExpiresAt);
  }
  
  return this.isPremium;
};

// Méthode pour étendre l'abonnement
userSchema.methods.extendPremium = function(additionalMonths) {
  const now = new Date();
  let newExpiry;
  
  if (this.premiumExpiresAt && this.premiumExpiresAt > now) {
    // Étendre à partir de la date d'expiration existante
    newExpiry = new Date(this.premiumExpiresAt);
    newExpiry.setMonth(newExpiry.getMonth() + additionalMonths);
  } else {
    // Nouvel abonnement à partir de maintenant
    newExpiry = new Date();
    newExpiry.setMonth(now.getMonth() + additionalMonths);
  }
  
  this.isPremium = true;
  this.premiumExpiresAt = newExpiry;
  
  console.log(`🔄 Abonnement étendu pour ${this.email}: ${additionalMonths} mois, expire le ${newExpiry}`);
  return this.save();
};

// Méthode pour obtenir le temps restant
userSchema.methods.getPremiumTimeLeft = function() {
  if (!this.premiumExpiresAt) return 0;
  
  const now = new Date();
  const expiry = new Date(this.premiumExpiresAt);
  return Math.max(0, expiry - now);
};

// Méthode pour désactiver premium si expiré
userSchema.methods.checkAndUpdatePremiumStatus = function() {
  if (this.isPremium && this.premiumExpiresAt && new Date() > new Date(this.premiumExpiresAt)) {
    this.isPremium = false;
    console.log(`⏰ Abonnement expiré pour ${this.email}`);
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('User', userSchema);