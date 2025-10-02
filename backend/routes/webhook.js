const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyPaydunyaSignature = require('../middleware/verifyWebhook'); // ✅ AJOUT
const webhookLogger = require('../middleware/webhookLogger'); // ✅ AJOUT

// ✅ CORRECTION: Webhook sécurisé avec vérification de signature
router.post('/callback', 
  express.raw({ type: 'application/json' }), // ⚠ IMPORTANT: Body brut pour les webhooks
  webhookLogger,
  verifyPaydunyaSignature, // ✅ Middleware de sécurité
  paymentController.handleCallback
);

module.exports = router;