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
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumExpiresAt: {
    type: Date,
    default: null
  },
  accessCode: {
    type: String,
    default: null
  },
  accessCodeCreatedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
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
  knownDevices: [{
    deviceId: String,
    deviceInfo: {
      userAgent: String,
      platform: String,
      screenResolution: String,
      timezone: String,
      firstSeen: { type: Date, default: Date.now },
      lastSeen: { type: Date, default: Date.now }
    },
    isTrusted: { type: Boolean, default: false }
  }],
  
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    deviceId: String,
    deviceInfo: Object,
    ipAddress: String,
    success: Boolean,
    reason: String
  }],
  
  securitySettings: {
    require2FA: { type: Boolean, default: false },
    alertOnNewDevice: { type: Boolean, default: true },
    maxParallelSessions: { type: Number, default: 3 }
  }
});

// Middleware pour hasher le mot de passe avant sauvegarde
userSchema.pre('save', async function(next) {
  // Ne hasher que si le mot de passe a été modifié
  if (!this.isModified('password')) return next();
  
  // Hasher le mot de passe avec un coût de 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Méthode pour comparer les mots de passe
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Méthode pour vérifier si l'abonnement est encore valide
userSchema.virtual('isPremiumActive').get(function() {
  if (!this.isPremium) return false;
  if (!this.premiumExpiresAt) return true;
  return this.premiumExpiresAt > new Date();
});

// Cache les informations sensibles lors de la sérialisation
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);