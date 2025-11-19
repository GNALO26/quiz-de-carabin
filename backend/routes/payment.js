const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

console.log('✅ Payment routes loaded - MODE PRODUCTION');

// ✅ ROUTES DE PAIEMENT PRODUCTION
router.post('/initiate', auth, paymentController.initiatePayment);
router.post('/process-return', auth, paymentController.processPaymentReturn);
router.get('/status/:transactionId', auth, paymentController.checkTransactionStatus);
router.get('/latest-access-code', auth, paymentController.getLatestAccessCode);
router.post('/resend-code', auth, paymentController.resendAccessCode);

// ✅ ROUTE DE TEST PRODUCTION
router.get('/test', auth, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Route payment fonctionne en production!',
    user: req.user.email,
    mode: 'production',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;