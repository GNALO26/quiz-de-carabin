const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

console.log('✅ Payment routes loaded');

// ✅ ROUTE INITIATE - DOIT ÊTRE PRÉSENTE
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

    const transaction = await Transaction.findOne({
      userId: req.user._id,
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (transaction && transaction.accessCode) {
      const emailSent = await sendAccessCodeEmail(req.user.email, transaction.accessCode, req.user.name);
      
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

    const emailSent = await sendAccessCodeEmail(req.user.email, accessCode.code, req.user.name);
    
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
    console.error('Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
});

// ✅ ROUTE DE TEST POUR VÉRIFIER QUE LE ROUTEUR FONCTIONNE
router.get('/test', auth, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Route payment fonctionne!',
    user: req.user.email,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;