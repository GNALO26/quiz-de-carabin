const Paydunya = require('paydunya');

// ✅ CORRECTION: Syntaxe URL corrigée
const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY?.trim(),
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY?.trim(),
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY?.trim(),
  token: process.env.PAYDUNYA_TOKEN?.trim(),
  mode: (process.env.PAYDUNYA_MODE || 'live').trim() // Commencer en mode test
});

const store = new Paydunya.Store({
  name: 'Quiz de Carabin',
  tagline: 'Abonnement aux quiz médicaux',
  postalAddress: 'Cotonou, Bénin',
  phoneNumber: '+2290156035888',
  websiteURL: process.env.FRONTEND_URL,
  // ✅ CORRECTION CRITIQUE: Syntaxe URL corrigée
  logoURL: `${process.env.FRONTEND_URL}/assets/images/logo.png`,
});

// ✅ AJOUT: Vérification de la configuration
console.log('🔍 Configuration PayDunya:', {
  mode: setup.mode,
  masterKey: setup.masterKey ? '✓ Définie' : '✗ Manquante',
  privateKey: setup.privateKey ? '✓ Définie' : '✗ Manquante',
  publicKey: setup.publicKey ? '✓ Définie' : '✗ Manquante',
  token: setup.token ? '✓ Défini' : '✗ Manquant'
});

module.exports = { setup, store };