const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// Route pour initier un paiement
router.post('/initiate', auth, paymentController.initiatePayment);

// Route pour valider un code d'accès
router.post('/validate-access-code', auth, paymentController.validateAccessCode);

// Route pour vérifier le statut d'un paiement
router.get('/status/:paymentId', auth, paymentController.checkPaymentStatus);

// Route pour les webhooks PayDunya
router.post('/callback', paymentController.handleCallback);

// Route pour récupérer le code d'accès d'une transaction
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



module.exports = router;