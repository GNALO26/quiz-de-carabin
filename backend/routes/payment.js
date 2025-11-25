const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// ✅ Paiement direct KkiaPay
router.post('/direct/initiate', paymentController.initiateDirectPayment);

// ✅ Paiement widget KkiaPay  
router.post('/initiate', paymentController.initiatePayment);

// ✅ Traitement retour de paiement
router.post('/process-return', paymentController.processPaymentReturn);

// ✅ Vérification statut transaction
router.get('/check-status/:transactionId', paymentController.checkTransactionStatus);

// ✅ Informations abonnement utilisateur
router.get('/subscription/info', paymentController.getUserSubscriptionInfo);

// ✅ Renvoyer le code d'accès
router.post('/resend-code', paymentController.resendAccessCode);

module.exports = router;