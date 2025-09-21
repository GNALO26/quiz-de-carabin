const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { sendAccessCodeEmail } = require('../controllers/paymentController');
const AccessCode = require('../models/AccessCode');

// Route pour initier un paiement
router.post('/initiate', auth, paymentController.initiatePayment);

// Route pour les webhooks PayDunya
router.post('/callback', paymentController.handleCallback);

// Route pour traiter le retour de paiement
router.post('/process-return', paymentController.processPaymentReturn);

// Route pour vérifier manuellement une transaction
router.get('/transaction/:transactionId/status', paymentController.checkTransactionStatus);

// Route pour récupérer le code d'accès d'une transaction spécifique
router.get('/transaction/:transactionId/access-code', auth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transaction = await Transaction.findOne({
      transactionId,
      userId: req.user._id
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction non trouvée"
      });
    }
    
    if (!transaction.accessCode) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès trouvé pour cette transaction"
      });
    }
    
    res.status(200).json({
      success: true,
      accessCode: transaction.accessCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
});

// Route pour renvoyer le code d'accès
router.post('/resend-code', auth, async (req, res) => {
  try {
    // Chercher d'abord dans les transactions
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

    // Si pas trouvé dans les transactions, chercher dans AccessCode
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

// Route de test pour vérifier l'envoi d'emails
router.get('/test-email', async (req, res) => {
  try {
    const result = await sendAccessCodeEmail('test@example.com', 'TEST123', 'Test User');
    
    if (result) {
      res.json({ success: true, message: 'Email de test envoyé avec succès' });
    } else {
      res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;