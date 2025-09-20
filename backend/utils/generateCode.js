const crypto = require('crypto');

// Génère un code numérique de 6 chiffres sécurisé
const generateCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Vérifie si un code est valide (6 chiffres, non expiré)
const validateCodeFormat = (code) => {
  return /^\d{6}$/.test(code);
};

module.exports = {
  generateCode,
  validateCodeFormat
};