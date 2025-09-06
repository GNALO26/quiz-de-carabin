const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// Route pour initier un paiement
router.post('/initiate', auth, paymentController.initiatePayment);

// Route pour valider un code d'accès
router.post('/validate-code', paymentController.validateAccessCode);

// Route pour vérifier le statut d'un paiement
router.get('/status/:paymentId', auth, paymentController.checkPaymentStatus);

// Route pour les webhooks PayDunya
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;