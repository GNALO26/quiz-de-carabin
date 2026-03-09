const express = require('express');
const router = express.Router();
const fedapayController = require('../controllers/fedapayController');

// POST /api/payment/fedapay/create — créer une transaction
router.post('/create', fedapayController.createPayment);

// GET /api/payment/fedapay/status/:transactionId — vérifier le statut (appelé par payment-callback.html)
router.get('/status/:transactionId', fedapayController.checkPaymentStatus);

module.exports = router;