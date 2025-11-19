const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

console.log('✅ Payment routes loaded');

// ✅ ROUTES DE PAIEMENT PRINCIPALES
router.post('/initiate', auth, paymentController.initiatePayment);
router.post('/process-return', auth, paymentController.processPaymentReturn);
router.get('/status/:transactionId', auth, paymentController.checkTransactionStatus);
router.get('/latest-access-code', auth, paymentController.getLatestAccessCode);
router.post('/resend-code', auth, paymentController.resendAccessCode);

// ✅ ROUTE DE SECOURS MANUELLE
router.post('/initiate-manual', auth, paymentController.initiateManualPayment);

// ✅ ROUTE DE TEST
router.get('/test', auth, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Route payment fonctionne!',
    user: req.user.email,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;