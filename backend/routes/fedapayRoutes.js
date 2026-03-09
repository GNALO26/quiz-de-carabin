const express = require('express');
const router = express.Router();
const fedapayController = require('../controllers/fedapayController');

/**
 * ================================================================
 * ROUTES FEDAPAY - QUIZ DE CARABIN
 * ================================================================
 */

/**
 * POST /api/payment/fedapay/create
 * Créer une transaction FedaPay
 * PROTÉGÉE (auth middleware)
 */
router.post('/create', fedapayController.createPayment);

/**
 * GET /api/payment/fedapay/status/:transactionId
 * Vérifier le statut d'une transaction
 * PROTÉGÉE (auth middleware)
 */
router.get('/status/:transactionId', fedapayController.checkPaymentStatus);

/**
 * ================================================================
 * WEBHOOK FEDAPAY - ROUTE PUBLIQUE (SANS AUTH)
 * ================================================================
 * FedaPay appelle cette route pour notifier les paiements
 * URL à configurer dans FedaPay dashboard :
 * https://quiz-de-carabin-backend.onrender.com/api/payment/fedapay/webhooks/fedapay
 */
router.post('/webhooks/fedapay', fedapayController.handleWebhook);

module.exports = router;