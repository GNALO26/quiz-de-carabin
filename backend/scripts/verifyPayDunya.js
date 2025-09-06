// backend/scripts/verifyPayDunya.js
require('dotenv').config();
const Paydunya = require('paydunya');

const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
  mode: process.env.PAYDUNYA_MODE
});

const store = new Paydunya.Store({
  name: "Test Store",
  tagline: "Test Tagline",
  postalAddress: "Test Address",
  phoneNumber: process.env.STORE_PHONE,
  websiteURL: process.env.FRONTEND_URL,
  logoURL: process.env.STORE_LOGO_URL
});

// Test de connexion à PayDunya
const invoice = new Paydunya.CheckoutInvoice(setup, store);
invoice.addItem("Test Item", 1, 100, 100, "Test Description");
invoice.totalAmount = 100;
invoice.description = "Test Invoice";

invoice.create()
  .then(success => {
    if (success) {
      console.log('✅ Connexion PayDunya réussie');
      console.log('Invoice URL:', invoice.url);
    } else {
      console.log('❌ Erreur PayDunya:', invoice.responseText);
    }
  })
  .catch(error => {
    console.log('❌ Exception PayDunya:', error.message);
  });