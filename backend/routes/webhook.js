// backend/routes/webhook.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const verifyPaydunyaSignature = require('../middleware/verifyWebhook'); 
const webhookLogger = require('../middleware/webhookLogger');

// Route pour les webhooks PayDunya
router.post('/callback', 
  express.raw({ type: '/' }), 
  webhookLogger,
  verifyPaydunyaSignature, 
  paymentController.handleCallback
);

module.exports = router;