const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

// Route pour initier un paiement
router.post('/initiate', auth, paymentController.initiatePayment);

// Route pour valider un code d'accès
router.post('/validate-code', paymentController.validateAccessCode);

// Route pour vérifier le statut d'un paiement
router.get('/status/:paymentId', auth, paymentController.checkPaymentStatus);

// Route pour les webhooks PayDunya
router.post('/webhook', paymentController.handleWebhook);

// routes/payment.js - Ajoutez cette route
router.get('/debug-keys', (req, res) => {
  const { cleanPaydunyaKey } = require('../utils/cleanKeys');
  
  const rawKeys = {
    masterKey: process.env.PAYDUNYA_MASTER_KEY,
    privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
    publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
    token: process.env.PAYDUNYA_TOKEN
  };
  
  const cleanedKeys = {
    masterKey: cleanPaydunyaKey(process.env.PAYDUNYA_MASTER_KEY),
    privateKey: cleanPaydunyaKey(process.env.PAYDUNYA_PRIVATE_KEY),
    publicKey: cleanPaydunyaKey(process.env.PAYDUNYA_PUBLIC_KEY),
    token: cleanPaydunyaKey(process.env.PAYDUNYA_TOKEN)
  };
  
  // Vérifier la présence de caractères problématiques
  const problematicChars = {};
  Object.keys(rawKeys).forEach(key => {
    if (rawKeys[key]) {
      problematicChars[key] = {
        hasSpaces: /\s/.test(rawKeys[key]),
        hasQuotes: /["']/.test(rawKeys[key]),
        hasNonAscii: /[^\x20-\x7E]/.test(rawKeys[key]),
        length: rawKeys[key].length
      };
    }
  });
  
  res.status(200).json({
    success: true,
    rawKeys: {
      masterKey: rawKeys.masterKey ? rawKeys.masterKey.substring(0, 10) + '...' : 'Non définie',
      privateKey: rawKeys.privateKey ? rawKeys.privateKey.substring(0, 10) + '...' : 'Non définie',
      publicKey: rawKeys.publicKey ? rawKeys.publicKey.substring(0, 10) + '...' : 'Non définie',
      token: rawKeys.token ? rawKeys.token.substring(0, 10) + '...' : 'Non défini'
    },
    cleanedKeys: {
      masterKey: cleanedKeys.masterKey ? cleanedKeys.masterKey.substring(0, 10) + '...' : 'Non définie',
      privateKey: cleanedKeys.privateKey ? cleanedKeys.privateKey.substring(0, 10) + '...' : 'Non définie',
      publicKey: cleanedKeys.publicKey ? cleanedKeys.publicKey.substring(0, 10) + '...' : 'Non définie',
      token: cleanedKeys.token ? cleanedKeys.token.substring(0, 10) + '...' : 'Non défini'
    },
    problematicChars,
    recommendations: problematicChars.masterKey && problematicChars.masterKey.hasNonAscii ? 
      "Vos clés contiennent des caractères non-ASCII. Veuillez les regénérer dans le tableau de bord PayDunya." : 
      "Les clés semblent correctes."
  });
});

module.exports = router;