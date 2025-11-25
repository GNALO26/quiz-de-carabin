const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// ✅ Paiement direct
router.post('/direct/initiate', paymentController.initiateDirectPayment);

// ✅ Paiement widget
router.post('/initiate', paymentController.initiatePayment);

// ✅ Traitement retour
router.post('/process-return', paymentController.processPaymentReturn);

// ✅ Info abonnement
router.get('/subscription/info', paymentController.getUserSubscriptionInfo);

// ✅ Renvoyer code
router.post('/resend-code', paymentController.resendAccessCode);

module.exports = router;