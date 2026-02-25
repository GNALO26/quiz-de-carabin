/**
 * ================================================================
 * MODÈLE USER PROGRESS - QUIZ DE CARABIN
 * ================================================================
 * Gère le suivi de progression des utilisateurs et le système de révision
 * À placer dans: backend/models/UserProgress.js
 * ================================================================
 */

const mongoose = require('mongoose');

const UserProgressSchema = new mongoose.Schema({
  // Références
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true
  },
  
  // Historique des tentatives
  attempts: [{
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    answers: {
      type: [[Number]], // Tableau de tableaux pour réponses multiples
      required: true
    },
    correctCount: {
      type: Number,
      required: true
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    timeSpent: {
      type: Number, // en secondes
      default: 0
    }
  }],
  
  // Statistiques calculées
  bestScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  averageScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  
  // Système de révision intelligent
  lastAttemptDate: {
    type: Date,
    default: null
  },
  nextReviewDate: {
    type: Date,
    default: null
  },
  needsReview: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Niveau de maîtrise (0-100%)
  mastery: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Métadonnées pour requêtes rapides (dénormalisé)
  subject: {
    type: String,
    index: true
  },
  category: {
    type: String,
    index: true
  },
  
  // Badges et réussites
  achievements: {
    firstCompletion: { type: Date, default: null },
    perfectScore: { type: Date, default: null },
    masteryAchieved: { type: Date, default: null }
  }
  
}, {
  timestamps: true // Ajoute createdAt et updatedAt automatiquement
});

// ================================================================
// INDEX COMPOSÉS POUR PERFORMANCES
// ================================================================

// Index unique: un seul document par utilisateur/quiz
UserProgressSchema.index({ userId: 1, quizId: 1 }, { unique: true });

// Index pour requêtes fréquentes
UserProgressSchema.index({ userId: 1, needsReview: 1 });
UserProgressSchema.index({ userId: 1, subject: 1 });
UserProgressSchema.index({ userId: 1, nextReviewDate: 1 });
UserProgressSchema.index({ userId: 1, mastery: -1 }); // Trier par maîtrise décroissante

// ================================================================
// MÉTHODES D'INSTANCE
// ================================================================

/**
 * Calculer la date de prochaine révision selon le niveau de maîtrise
 * Algorithme de Spaced Repetition simplifié
 */
UserProgressSchema.methods.calculateNextReview = function() {
  const intervals = {
    veryLow: 0.5,  // mastery < 30% → réviser dans 12h
    low: 1,        // mastery 30-50% → réviser dans 1 jour
    medium: 3,     // mastery 50-75% → réviser dans 3 jours
    high: 7,       // mastery 75-90% → réviser dans 7 jours
    veryHigh: 14   // mastery > 90% → réviser dans 14 jours
  };
  
  let level = 'veryLow';
  if (this.mastery >= 90) level = 'veryHigh';
  else if (this.mastery >= 75) level = 'high';
  else if (this.mastery >= 50) level = 'medium';
  else if (this.mastery >= 30) level = 'low';
  
  const days = intervals[level];
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  
  this.nextReviewDate = nextDate;
  this.needsReview = false; // Reset le flag
  
  return nextDate;
};

/**
 * Enregistrer une nouvelle tentative et mettre à jour les stats
 */
UserProgressSchema.methods.recordAttempt = function(score, answers, correctCount, totalQuestions, timeSpent = 0) {
  // Ajouter la tentative
  this.attempts.push({
    score: Math.round(score),
    answers,
    correctCount,
    totalQuestions,
    completedAt: new Date(),
    timeSpent
  });
  
  // Mettre à jour les statistiques
  this.totalAttempts = this.attempts.length;
  this.lastAttemptDate = new Date();
  
  // Meilleur score
  this.bestScore = Math.max(this.bestScore, score);
  
  // Score moyen
  const sum = this.attempts.reduce((acc, att) => acc + att.score, 0);
  this.averageScore = Math.round(sum / this.totalAttempts);
  
  // Calculer la maîtrise (formule pondérée)
  // 60% basé sur le meilleur score
  // 40% basé sur la moyenne
  this.mastery = Math.round(this.bestScore * 0.6 + this.averageScore * 0.4);
  
  // Calculer la prochaine date de révision
  this.calculateNextReview();
  
  // Vérifier les achievements
  this.checkAchievements(score);
  
  return this;
};

/**
 * Vérifier et débloquer les achievements
 */
UserProgressSchema.methods.checkAchievements = function(latestScore) {
  const now = new Date();
  
  // Premier quiz complété
  if (!this.achievements.firstCompletion && this.totalAttempts === 1) {
    this.achievements.firstCompletion = now;
  }
  
  // Score parfait (100%)
  if (!this.achievements.perfectScore && latestScore === 100) {
    this.achievements.perfectScore = now;
  }
  
  // Maîtrise atteinte (90%+)
  if (!this.achievements.masteryAchieved && this.mastery >= 90) {
    this.achievements.masteryAchieved = now;
  }
};

/**
 * Obtenir le niveau de maîtrise en texte
 */
UserProgressSchema.methods.getMasteryLevel = function() {
  if (this.mastery >= 90) return 'Expert';
  if (this.mastery >= 75) return 'Avancé';
  if (this.mastery >= 50) return 'Intermédiaire';
  if (this.mastery >= 30) return 'Débutant';
  return 'Novice';
};

/**
 * Vérifier si le quiz doit être révisé
 */
UserProgressSchema.methods.shouldReview = function() {
  if (!this.nextReviewDate) return true;
  return new Date() >= this.nextReviewDate;
};

// ================================================================
// MÉTHODES STATIQUES (pour requêtes au niveau collection)
// ================================================================

/**
 * Obtenir les stats globales d'un utilisateur
 */
UserProgressSchema.statics.getUserGlobalStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalQuizzes: { $sum: 1 },
        totalAttempts: { $sum: '$totalAttempts' },
        averageMastery: { $avg: '$mastery' },
        masteredQuizzes: {
          $sum: { $cond: [{ $gte: ['$mastery', 75] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalQuizzes: 0,
    totalAttempts: 0,
    averageMastery: 0,
    masteredQuizzes: 0
  };
};

/**
 * Obtenir les stats par matière pour un utilisateur
 */
UserProgressSchema.statics.getStatsBySubject = async function(userId) {
  return await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$subject',
        totalQuizzes: { $sum: 1 },
        averageMastery: { $avg: '$mastery' },
        totalAttempts: { $sum: '$totalAttempts' },
        masteredQuizzes: {
          $sum: { $cond: [{ $gte: ['$mastery', 75] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        subject: '$_id',
        totalQuizzes: 1,
        averageMastery: { $round: ['$averageMastery', 1] },
        totalAttempts: 1,
        masteredQuizzes: 1,
        progressPercentage: {
          $round: [
            { $multiply: [{ $divide: ['$masteredQuizzes', '$totalQuizzes'] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { averageMastery: -1 } }
  ]);
};

/**
 * Obtenir les quiz à réviser pour un utilisateur
 */
UserProgressSchema.statics.getQuizzesToReview = async function(userId, limit = 10) {
  const now = new Date();
  
  return await this.find({
    userId,
    $or: [
      { needsReview: true },
      { nextReviewDate: { $lte: now } }
    ]
  })
  .populate('quizId', 'title subject category')
  .sort({ nextReviewDate: 1 })
  .limit(limit);
};

/**
 * Marquer les quiz qui ont besoin de révision (CRON job)
 */
UserProgressSchema.statics.markQuizzesNeedingReview = async function() {
  const now = new Date();
  
  const result = await this.updateMany(
    {
      nextReviewDate: { $lte: now },
      needsReview: false
    },
    {
      $set: { needsReview: true }
    }
  );
  
  return result.modifiedCount;
};

// ================================================================
// MIDDLEWARE PRE-SAVE
// ================================================================

UserProgressSchema.pre('save', function(next) {
  // S'assurer que les valeurs sont dans les limites
  if (this.mastery > 100) this.mastery = 100;
  if (this.mastery < 0) this.mastery = 0;
  if (this.bestScore > 100) this.bestScore = 100;
  if (this.averageScore > 100) this.averageScore = 100;
  
  next();
});

// ================================================================
// EXPORT DU MODÈLE
// ================================================================

module.exports = mongoose.model('UserProgress', UserProgressSchema);