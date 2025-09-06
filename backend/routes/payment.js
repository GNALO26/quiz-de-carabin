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

// Route de diagnostic complet des clés
router.get('/debug/keys-detailed', (req, res) => {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY || '';
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY || '';
  const publicKey = process.env.PAYDUNYA_PUBLIC_KEY || '';
  const token = process.env.PAYDUNYA_TOKEN || '';
  
  const cleanedMasterKey = cleanPaydunyaKey(masterKey);
  const cleanedPrivateKey = cleanPaydunyaKey(privateKey);
  const cleanedPublicKey = cleanPaydunyaKey(publicKey);
  const cleanedToken = cleanPaydunyaKey(token);
  
  // Analyse des caractères
  const analyzeKey = (key, name) => {
    const hasSpaces = /\s/.test(key);
    const hasQuotes = /['"`]/.test(key);
    const hasNonAscii = /[^\x20-\x7E]/.test(key);
    const isValid = /^[a-zA-Z0-9_\-]+$/.test(key);
    
    return {
      name,
      originalLength: key.length,
      cleanedLength: cleanedKey.length,
      hasSpaces,
      hasQuotes,
      hasNonAscii,
      isValid,
      cleanedPreview: cleanedKey.substring(0, 15) + '...'
    };
  };
  
  const analysis = [
    analyzeKey(masterKey, 'Master Key'),
    analyzeKey(privateKey, 'Private Key'),
    analyzeKey(publicKey, 'Public Key'),
    analyzeKey(token, 'Token')
  ];
  
  res.status(200).json({
    success: true,
    analysis,
    recommendations: analysis.filter(a => !a.isValid).map(a => 
      `${a.name} contient des caractères invalides`
    )
  });
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

module.exports = router;