// backend/scripts/diagnosePayDunya.js
require('dotenv').config();

console.log('=== DIAGNOSTIC PAYDUNYA ===');
console.log('Mode:', process.env.PAYDUNYA_MODE);
console.log('Master Key:', process.env.PAYDUNYA_MASTER_KEY ? '✓ Défini' : '✗ Non défini');
console.log('Private Key:', process.env.PAYDUNYA_PRIVATE_KEY ? '✓ Défini' : '✗ Non défini');
console.log('Public Key:', process.env.PAYDUNYA_PUBLIC_KEY ? '✓ Défini' : '✗ Non défini');
console.log('Token:', process.env.PAYDUNYA_TOKEN ? '✓ Défini' : '✗ Non défini');
console.log('Store Phone:', process.env.STORE_PHONE || 'Non défini');
console.log('Store Logo URL:', process.env.STORE_LOGO_URL || 'Non défini');

// Vérification de la longueur des clés
if (process.env.PAYDUNYA_MASTER_KEY) {
  console.log('Master Key length:', process.env.PAYDUNYA_MASTER_KEY.length);
}
if (process.env.PAYDUNYA_PRIVATE_KEY) {
  console.log('Private Key length:', process.env.PAYDUNYA_PRIVATE_KEY.length);
}
if (process.env.PAYDUNYA_PUBLIC_KEY) {
  console.log('Public Key length:', process.env.PAYDUNYA_PUBLIC_KEY.length);
}
if (process.env.PAYDUNYA_TOKEN) {
  console.log('Token length:', process.env.PAYDUNYA_TOKEN.length);
}

// Test de connexion basique
const Paydunya = require('paydunya');

const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY || 'test',
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY || 'test',
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY || 'test',
  token: process.env.PAYDUNYA_TOKEN || 'test',
  mode: process.env.PAYDUNYA_MODE || 'test'
});

const store = new Paydunya.Store({
  name: "Quiz de Carabin",
  tagline: "Test de connexion",
  postalAddress: "Cotonou, Bénin",
  phoneNumber: process.env.STORE_PHONE || "+22900000000",
  websiteURL: process.env.FRONTEND_URL || "https://quiz-de-carabin.netlify.app",
  logoURL: process.env.STORE_LOGO_URL || "https://quiz-de-carabin.netlify.app/assets/images/logo.png"
});

console.log('\n=== TEST DE CONNEXION ===');
const invoice = new Paydunya.CheckoutInvoice(setup, store);
invoice.addItem("Test Item", 1, 100, 100, "Test Description");
invoice.totalAmount = 100;
invoice.description = "Test Invoice";

invoice.create()
  .then(success => {
    if (success) {
      console.log('✓ Test réussi - Facture créée');
      console.log('URL:', invoice.url);
    } else {
      console.log('✗ Échec du test');
      console.log('Réponse:', invoice.responseText);
      console.log('Statut:', invoice.status);
    }
  })
  .catch(error => {
    console.log('✗ Erreur lors du test:', error.message);
  });