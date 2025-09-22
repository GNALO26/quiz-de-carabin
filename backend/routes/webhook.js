// backend/routes/webhook.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Route pour les webhooks PayDunya
// Temporairement, nous allons enlever les middlewares de vérification pour déboguer
router.post('/callback', 
  express.json(), // Use express.json for simplicity
  (req, res, next) => { // A custom logger middleware to see everything
    console.log(`[${new Date().toISOString()}] [WEBHOOK] Données reçues: ${JSON.stringify(req.body, null, 2)}`);
    console.log(`[${new Date().toISOString()}] [WEBHOOK] Headers reçus: ${JSON.stringify(req.headers, null, 2)}`);
    next();
  },
  paymentController.handleCallback
);

module.exports = router;