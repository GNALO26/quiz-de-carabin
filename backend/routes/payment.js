// backend/routes/payment.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { sendAccessCodeEmail } = require('../controllers/paymentController');
const AccessCode = require('../models/AccessCode');

// Importation des middlewares pour le webhook
// ✅ Ces imports ne sont plus nécessaires car la route est déplacée
// const verifyPaydunyaSignature = require('../middleware/verifyWebhook'); 
// const webhookLogger = require('../middleware/webhookLogger');

// Route pour initier un paiement
router.post('/initiate', auth, paymentController.initiatePayment);

// ✅ La route /callback a été déplacée dans le fichier webhook.js

// Route pour traiter le retour de paiement
router.post('/process-return', auth, paymentController.processPaymentReturn);

// Route pour vérifier manuellement une transaction
router.get('/transaction/:transactionId/status', auth, paymentController.checkTransactionStatus);

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

// Route pour obtenir le code d'accès de la dernière transaction
router.get('/latest-access-code', auth, paymentController.getLatestAccessCode);

// Route pour renvoyer le code d'accès
router.post('/resend-code', auth, async (req, res) => {
  try {
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

// Route de debug pour simuler un webhook PayDunya (à utiliser en développement seulement)
router.post('/debug-webhook', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Cette route n\'est disponible qu\'en mode développement' });
    }
    
    const { transactionId, status } = req.body;
    
    if (!transactionId || !status) {
      return res.status(400).json({ error: 'transactionId et status requis' });
    }
    
    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    
    const mockWebhook = {
      status: status,
      invoice: {
        token: transaction.paydunyaInvoiceToken,
        customer: {
          email: 'test@example.com'
        }
      },
      custom_data: {
        user_id: transaction.userId.toString(),
        transaction_id: transaction.transactionId
      }
    };
    
    req.body = mockWebhook;
    
    await paymentController.handleCallback(req, res);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;