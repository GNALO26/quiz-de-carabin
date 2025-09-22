// backend/routes/webhook.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Route pour les webhooks PayDunya
// ✅ Middleware temporaire pour le débogage. À remplacer par la suite.
router.post('/callback', 
  express.json(), 
  (req, res, next) => {
    console.log(`[${new Date().toISOString()}] [WEBHOOK] Données reçues: ${JSON.stringify(req.body, null, 2)}`);
    console.log(`[${new Date().toISOString()}] [WEBHOOK] Headers reçus: ${JSON.stringify(req.headers, null, 2)}`);
    next();
  },
  paymentController.handleCallback
);

module.exports = router;