const express = require('express');
const router = express.Router();
const fedapayController = require('../controllers/fedapayController');

// Route protégée : Créer paiement (auth géré par le middleware global dans server.js)
router.post('/create', fedapayController.createPayment);

// Route protégée : Vérifier statut (auth géré par le middleware global)
router.get('/status/:transactionId', fedapayController.checkPaymentStatus);

// NOTE: Le webhook /webhooks/fedapay est monté directement dans server.js
// AVANT le middleware auth global, donc il est public. Ne pas le remettre ici.

module.exports = router;