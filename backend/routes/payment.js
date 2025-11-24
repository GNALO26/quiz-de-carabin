const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const verifyWebhook = require('../middleware/verifyWebhook');

// Routes pour les paiements widget KkiaPay
router.post('/initiate', auth, paymentController.initiatePayment);
router.post('/process-return', auth, paymentController.processPaymentReturn);
router.get('/transaction/:transactionId/status', auth, paymentController.checkTransactionStatus);
router.get('/latest-access-code', auth, paymentController.getLatestAccessCode);
router.post('/resend-access-code', auth, paymentController.resendAccessCode);

// Routes pour les paiements directs KkiaPay
router.post('/direct/initiate', auth, paymentController.initiateDirectPayment);
router.get('/direct/status/:transactionId', auth, paymentController.checkDirectPaymentStatus);

// Route pour les webhooks KkiaPay (sans auth)
router.post('/webhook/kkiapay', verifyWebhook, paymentController.handleKkiapayWebhook);

// Route pour les informations d'abonnement
router.get('/subscription/info', auth, paymentController.getUserSubscriptionInfo);

module.exports = router;