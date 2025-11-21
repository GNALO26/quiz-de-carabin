const crypto = require('crypto');

// Configuration des plans d'abonnement
const SUBSCRIPTION_PLANS = {
  '5k': {
    amount: 5000,
    duration: 1,
    description: 'Abonnement Premium 1 mois'
  },
  '12k': {
    amount: 12000, 
    duration: 3,
    description: 'Abonnement Premium 3 mois'
  },
  '25k': {
    amount: 25000,
    duration: 10,
    description: 'Abonnement Premium 10 mois'
  }
};

// Liens directs KkiaPay
const DIRECT_PAYMENT_LINKS = {
  '5k': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-5k)-h6j7-M-TL',
  '12k': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-12k)-Ov3-yKeZc',
  '25k': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-25k)-R6CAqLjlf'
};

// Générer un ID de transaction unique
const generateUniqueTransactionID = () => {
  return 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
};

// Calculer la date d'expiration
const calculateExpiryDate = (durationMonths, fromDate = null) => {
  const startDate = fromDate ? new Date(fromDate) : new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
  return expiryDate;
};

// Vérifier si une date d'expiration est valide
const isSubscriptionActive = (expiryDate) => {
  if (!expiryDate) return false;
  return new Date() < new Date(expiryDate);
};

module.exports = {
  SUBSCRIPTION_PLANS,
  DIRECT_PAYMENT_LINKS,
  generateUniqueTransactionID,
  calculateExpiryDate,
  isSubscriptionActive
};