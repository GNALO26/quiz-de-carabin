const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

console.log('✅ Payment routes loaded');

// Route pour initier un paiement
router.post('/initiate', auth, paymentController.initiatePayment);

// Route pour traiter le retour de paiement
router.post('/process-return', auth, paymentController.processPaymentReturn);

// Route pour vérifier manuellement une transaction
router.get('/check-status/:transactionId', auth, paymentController.checkTransactionStatus);

// Route pour obtenir le code d'accès de la dernière transaction
router.get('/latest-access-code', auth, paymentController.getLatestAccessCode);

// Route pour renvoyer le code d'accès
router.post('/resend-code', auth, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const AccessCode = require('../models/AccessCode');
    const { sendAccessCodeEmail } = require('../controllers/paymentController');

    console.log('🔄 Tentative de renvoi de code pour:', req.user.email);

    // Chercher d'abord dans les transactions
    const transaction = await Transaction.findOne({
      userId: req.user._id,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    if (transaction && transaction.accessCode) {
      console.log('📦 Code trouvé dans transaction:', transaction.accessCode);
      const emailSent = await sendAccessCodeEmail(req.user.email, transaction.accessCode, req.user.name, transaction.planId);
      
      if (emailSent) {
        return res.status(200).json({
          success: true,
          message: "Code d'accès renvoyé avec succès"
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Erreur lors de l'envoi de l'email"
        });
      }
    }

    // Sinon chercher dans les codes d'accès
    const accessCode = await AccessCode.findOne({
      userId: req.user._id,
      used: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!accessCode) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès actif trouvé"
      });
    }

    console.log('📦 Code trouvé dans AccessCode:', accessCode.code);
    const emailSent = await sendAccessCodeEmail(req.user.email, accessCode.code, req.user.name, accessCode.planId);
    
    if (emailSent) {
      res.status(200).json({
        success: true,
        message: "Code d'accès renvoyé avec succès"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'envoi de l'email"
      });
    }
  } catch (error) {
    console.error('❌ Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du renvoi du code"
    });
  }
});

// Route pour obtenir l'historique des transactions
router.get('/history', auth, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    
    const transactions = await Transaction.find({
      userId: req.user._id
    }).sort({ createdAt: -1 }).select('-metadata -kkiapayTransactionId');

    res.status(200).json({
      success: true,
      transactions: transactions
    });
  } catch (error) {
    console.error('❌ Erreur récupération historique:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
});

// Route de test pour vérifier que le routeur fonctionne
router.get('/test', auth, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Route payment fonctionne!',
    user: req.user.email,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;