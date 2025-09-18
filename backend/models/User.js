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
    default: 0
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

module.exports = mongoose.model('User', userSchema);