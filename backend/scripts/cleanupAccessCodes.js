// backend/scripts/cleanupAccessCodes.js
const mongoose = require('mongoose');
const AccessCode = require('../models/AccessCode');

async function cleanupExpiredAccessCodes() {
  try {
    const result = await AccessCode.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    console.log(`Nettoyage des codes d'accès: ${result.deletedCount} codes expirés supprimés`);
  } catch (error) {
    console.error('Erreur lors du nettoyage des codes d\'accès:', error);
  }
}

// Exécuter toutes les heures
setInterval(cleanupExpiredAccessCodes, 60 * 60 * 1000);

// Exécuter au démarrage
cleanupExpiredAccessCodes();

module.exports = cleanupExpiredAccessCodes;