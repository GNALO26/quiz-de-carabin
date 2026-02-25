/**
 * ================================================================
 * ROUTES STATISTIQUES - QUIZ DE CARABIN
 * ================================================================
 * Routes pour toutes les statistiques utilisateur
 * À placer dans: backend/routes/stats.js
 * ================================================================
 */

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const auth = require('../middleware/auth'); // Middleware d'authentification

/**
 * Toutes ces routes nécessitent une authentification
 */

/**
 * @route   GET /api/stats/dashboard
 * @desc    Obtenir le dashboard complet de l'utilisateur
 * @access  Private
 */
router.get('/dashboard', auth, statsController.getDashboard);

/**
 * @route   GET /api/stats/subject/:subject
 * @desc    Obtenir les statistiques détaillées pour une matière
 * @access  Private
 * @param   subject - Nom de la matière (Physiologie, Anatomie, etc.)
 */
router.get('/subject/:subject', auth, statsController.getSubjectStats);

/**
 * @route   GET /api/stats/quiz/:quizId
 * @desc    Obtenir l'historique détaillé d'un quiz
 * @access  Private
 * @param   quizId - ID MongoDB du quiz
 */
router.get('/quiz/:quizId', auth, statsController.getQuizHistory);

/**
 * @route   GET /api/stats/recommendations
 * @desc    Obtenir des recommandations personnalisées
 * @access  Private
 */
router.get('/recommendations', auth, statsController.getRecommendations);

/**
 * @route   GET /api/stats/performance-chart
 * @desc    Obtenir les données pour graphique de performance
 * @access  Private
 * @query   period - Période en jours (7, 30, 90)
 */
router.get('/performance-chart', auth, statsController.getPerformanceChart);

module.exports = router;