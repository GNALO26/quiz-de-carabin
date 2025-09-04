const Paydunya = require('paydunya');

const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
  mode: process.env.PAYDUNYA_MODE,
});

const store = new Paydunya.Store({
  name: 'Quiz de Carabin',
  tagline: 'Abonnement aux quiz médicaux',
  postalAddress: 'Cotonou, Bénin',
  phoneNumber: '+229XXXXXXXX',
  websiteURL: process.env.FRONTEND_URL,
  logoURL: `${process.env.FRONTEND_URL}`/assets/images/logo.png,
});

module.exports = { setup, store };