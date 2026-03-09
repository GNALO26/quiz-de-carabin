const express = require('express');
const router = express.Router();
const fedapayController = require('../controllers/fedapayController');
const auth = require('../middleware/auth');

// Route protégée : Créer paiement
router.post('/create', auth, fedapayController.createPayment);

// Route publique : Webhook FedaPay
router.post('/webhooks/fedapay', fedapayController.handleWebhook);

// Route protégée : Vérifier statut
router.get('/status/:transactionId', auth, fedapayController.checkPaymentStatus);

module.exports = router;