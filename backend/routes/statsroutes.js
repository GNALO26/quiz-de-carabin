/**
 * ================================================================
 * STATISTICS ROUTES - QUIZ DE CARABIN
 * ================================================================
 * Routes pour les statistiques et graphiques
 * ================================================================
 */

const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/stats/dashboard
 * @desc    Stats du dashboard principal
 * @access  Private
 */
router.get('/dashboard', auth, statsController.getDashboardStats);

/**
 * @route   GET /api/stats/subject/:subject
 * @desc    Stats détaillées par matière
 * @access  Private
 */
router.get('/subject/:subject', auth, statsController.getSubjectStats);

/**
 * @route   GET /api/stats/progress-chart
 * @desc    Données graphique progression (7/30/90 jours)
 * @access  Private
 */
router.get('/progress-chart', auth, statsController.getProgressChart);

/**
 * @route   GET /api/stats/time-by-subject
 * @desc    Temps passé par matière (camembert)
 * @access  Private
 */
router.get('/time-by-subject', auth, statsController.getTimeBySubject);

/**
 * @route   GET /api/stats/performance-by-subject
 * @desc    Performance par matière (barres)
 * @access  Private
 */
router.get('/performance-by-subject', auth, statsController.getPerformanceBySubject);

/**
 * @route   GET /api/stats/leaderboard/:subject
 * @desc    Classement dans une matière
 * @access  Private
 */
router.get('/leaderboard/:subject', auth, statsController.getLeaderboard);

/**
 * @route   POST /api/stats/record-quiz
 * @desc    Enregistrer résultats d'un quiz
 * @access  Private
 */
router.post('/record-quiz', auth, statsController.recordQuizResult);

module.exports = router;