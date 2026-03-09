/**
 * ================================================================
 * PREMIUM ACTIVATION ROUTES - QUIZ DE CARABIN
 * ================================================================
 * Routes pour l'activation du compte Premium via code
 * ================================================================
 */

const express = require('express');
const router = express.Router();
const premiumActivationController = require('../controllers/premiumActivationController');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/premium/validate-code
 * @desc    Valider un code d'activation Premium
 * @access  Private (authentification requise)
 */
router.post('/validate-code', auth, premiumActivationController.validateActivationCode);

/**
 * @route   POST /api/premium/resend-code
 * @desc    Renvoyer le code d'activation par email
 * @access  Private
 */
router.post('/resend-code', auth, premiumActivationController.resendActivationCode);

/**
 * @route   GET /api/premium/check-code/:code
 * @desc    Vérifier un code sans l'activer (preview)
 * @access  Private
 */
router.get('/check-code/:code', auth, premiumActivationController.checkCode);

/**
 * @route   GET /api/premium/pending-activations
 * @desc    Liste des transactions en attente d'activation
 * @access  Private
 */
router.get('/pending-activations', auth, premiumActivationController.getPendingActivations);

module.exports = router;