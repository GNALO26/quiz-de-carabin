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

// Route pour les webhooks PayDunya - CORRIGÉE pour correspondre à votre IPN
router.post('/callback', paymentController.handleCallback);

// Route de diagnostic des transactions
router.get('/debug/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'email name');
    
    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions: transactions.map(t => ({
        id: t._id,
        transactionId: t.transactionId,
        status: t.status,
        amount: t.amount,
        createdAt: t.createdAt,
        user: t.userId ? t.userId.email : 'N/A'
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Dans routes/payment.js, ajoutez ce middleware
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

module.exports = router;