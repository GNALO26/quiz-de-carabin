const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const verifyWebhook = require('../middleware/verifyWebhook');

// Routes protégées
router.post('/create', auth, paymentController.createPayment);
router.post('/check-status', auth, paymentController.checkPaymentStatus);
router.post('/resend-code', auth, paymentController.resendAccessCode);
router.get('/subscription-info', auth, paymentController.getSubscriptionInfo);

// Webhook KkiaPay (public)
router.post('/webhook/kkiapay', verifyWebhook, paymentController.handleKkiapayWebhook);

module.exports = router;