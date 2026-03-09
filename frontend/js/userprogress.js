/**
 * ================================================================
 * USER PROGRESS MODEL - QUIZ DE CARABIN
 * ================================================================
 * Suivi détaillé de la progression par matière
 * ================================================================
 */

const mongoose = require('mongoose');

const UserProgressSchema = new mongoose.Schema({
  // Utilisateur
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Matière (Subject)
  subject: {
    type: String,
    required: true,
    index: true
  },

  // Catégorie dans la matière
  category: {
    type: String,
    default: 'Général'
  },

  // ===========================
  // STATISTIQUES GLOBALES
  // ===========================
  
  totalQuizzes: {
    type: Number,
    default: 0
  },

  totalQuestions: {
    type: Number,
    default: 0
  },

  correctAnswers: {
    type: Number,
    default: 0
  },

  incorrectAnswers: {
    type: Number,
    default: 0
  },

  // Score moyen (%)
  averageScore: {
    type: Number,
    default: 0
  },

  // Meilleur score (%)
  bestScore: {
    type: Number,
    default: 0
  },

  // Score le plus récent (%)
  lastScore: {
    type: Number,
    default: 0
  },

  // ===========================
  // TEMPS
  // ===========================
  
  // Temps total passé (secondes)
  totalTimeSpent: {
    type: Number,
    default: 0
  },

  // Temps moyen par quiz (secondes)
  averageTimePerQuiz: {
    type: Number,
    default: 0
  },

  // ===========================
  // PROGRESSION
  // ===========================
  
  // Niveau dans cette matière (1-10)
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },

  // XP dans cette matière
  xp: {
    type: Number,
    default: 0
  },

  // Rang/Niveau textuel
  rank: {
    type: String,
    enum: ['Débutant', 'Novice', 'Intermédiaire', 'Avancé', 'Expert', 'Maître'],
    default: 'Débutant'
  },

  // ===========================
  // HISTORIQUE (30 derniers quiz)
  // ===========================
  
  recentScores: [{
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    },
    score: Number,        // Score en %
    date: Date,
    timeSpent: Number     // Temps en secondes
  }],

  // ===========================
  // POINTS FAIBLES / FORTS
  // ===========================
  
  // Catégories où l'utilisateur est fort
  strongCategories: [{
    category: String,
    score: Number
  }],

  // Catégories où l'utilisateur est faible
  weakCategories: [{
    category: String,
    score: Number
  }],

  // ===========================
  // ACTIVITÉ
  // ===========================
  
  lastActivityDate: {
    type: Date,
    default: Date.now
  },

  firstActivityDate: {
    type: Date,
    default: Date.now
  },

  // Jours actifs dans cette matière
  activeDays: {
    type: Number,
    default: 1
  },

  // Dates
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// ===========================
// MIDDLEWARE PRE-SAVE
// ===========================

UserProgressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  // Recalculer score moyen
  if (this.totalQuestions > 0) {
    this.averageScore = Math.round(
      (this.correctAnswers / this.totalQuestions) * 100
    );
  }

  // Calculer temps moyen par quiz
  if (this.totalQuizzes > 0) {
    this.averageTimePerQuiz = Math.round(
      this.totalTimeSpent / this.totalQuizzes
    );
  }

  // Déterminer le rang selon le score moyen
  if (this.averageScore >= 90) {
    this.rank = 'Maître';
    this.level = 10;
  } else if (this.averageScore >= 80) {
    this.rank = 'Expert';
    this.level = 8;
  } else if (this.averageScore >= 70) {
    this.rank = 'Avancé';
    this.level = 6;
  } else if (this.averageScore >= 60) {
    this.rank = 'Intermédiaire';
    this.level = 4;
  } else if (this.averageScore >= 50) {
    this.rank = 'Novice';
    this.level = 2;
  } else {
    this.rank = 'Débutant';
    this.level = 1;
  }

  next();
});

// ===========================
// MÉTHODES D'INSTANCE
// ===========================

/**
 * Enregistrer un nouveau quiz
 */
UserProgressSchema.methods.recordQuiz = function(quizResult) {
  // Incrémenter compteurs
  this.totalQuizzes += 1;
  this.totalQuestions += quizResult.totalQuestions;
  this.correctAnswers += quizResult.correctAnswers;
  this.incorrectAnswers += quizResult.incorrectAnswers || 0;

  // Score du quiz
  const score = Math.round(
    (quizResult.correctAnswers / quizResult.totalQuestions) * 100
  );

  // Mettre à jour meilleur score
  if (score > this.bestScore) {
    this.bestScore = score;
  }

  // Dernier score
  this.lastScore = score;

  // Temps
  if (quizResult.timeSpent) {
    this.totalTimeSpent += quizResult.timeSpent;
  }

  // Ajouter à l'historique récent (max 30)
  this.recentScores.push({
    quizId: quizResult.quizId,
    score: score,
    date: new Date(),
    timeSpent: quizResult.timeSpent || 0
  });

  // Garder seulement les 30 derniers
  if (this.recentScores.length > 30) {
    this.recentScores = this.recentScores.slice(-30);
  }

  // Mettre à jour dernière activité
  this.lastActivityDate = new Date();

  return this.save();
};

/**
 * Obtenir la tendance (progression)
 */
UserProgressSchema.methods.getTrend = function() {
  if (this.recentScores.length < 2) {
    return 'stable';
  }

  // Comparer les 5 derniers avec les 5 d'avant
  const recent = this.recentScores.slice(-5);
  const previous = this.recentScores.slice(-10, -5);

  if (previous.length === 0) return 'stable';

  const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
  const previousAvg = previous.reduce((sum, s) => sum + s.score, 0) / previous.length;

  const diff = recentAvg - previousAvg;

  if (diff > 5) return 'progression';
  if (diff < -5) return 'régression';
  return 'stable';
};

/**
 * Obtenir les données pour graphique
 */
UserProgressSchema.methods.getChartData = function() {
  return {
    labels: this.recentScores.map(s => s.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })),
    scores: this.recentScores.map(s => s.score),
    times: this.recentScores.map(s => Math.round(s.timeSpent / 60)) // en minutes
  };
};

// ===========================
// MÉTHODES STATIQUES
// ===========================

/**
 * Obtenir ou créer progress pour un user/subject
 */
UserProgressSchema.statics.getOrCreate = async function(userId, subject, category = 'Général') {
  let progress = await this.findOne({ userId, subject });

  if (!progress) {
    progress = new this({
      userId: userId,
      subject: subject,
      category: category
    });
    await progress.save();
  }

  return progress;
};

/**
 * Obtenir le classement d'un utilisateur
 */
UserProgressSchema.statics.getUserRanking = async function(userId, subject) {
  // Tous les users dans cette matière
  const allProgress = await this.find({ subject })
    .sort({ averageScore: -1 });

  const userRank = allProgress.findIndex(p => p.userId.toString() === userId.toString()) + 1;

  return {
    rank: userRank,
    total: allProgress.length,
    percentile: Math.round(((allProgress.length - userRank) / allProgress.length) * 100)
  };
};

// ===========================
// INDEX
// ===========================

UserProgressSchema.index({ userId: 1, subject: 1 }, { unique: true });
UserProgressSchema.index({ subject: 1, averageScore: -1 });
UserProgressSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('UserProgress', UserProgressSchema);