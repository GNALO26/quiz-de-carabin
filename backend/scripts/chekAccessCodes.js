// backend/scripts/checkAccessCodes.js
require('dotenv').config();
const mongoose = require('mongoose');
const AccessCode = require('../models/AccessCode');

async function checkAccessCodes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB');
    
    // Récupérer les 10 derniers codes d'accès
    const accessCodes = await AccessCode.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'email name');
    
    console.log('📋 Derniers codes d\'accès:');
    accessCodes.forEach((code, index) => {
      console.log(`
      ${index + 1}. Code: ${code.code}
         Email: ${code.email}
         Utilisateur: ${code.userId ? code.userId.email : 'N/A'}
         Expire: ${code.expiresAt}
         Utilisé: ${code.used ? 'Oui' : 'Non'}
         Créé: ${code.createdAt}
      `);
    });
    
    // Statistiques
    const totalCodes = await AccessCode.countDocuments();
    const usedCodes = await AccessCode.countDocuments({ used: true });
    const expiredCodes = await AccessCode.countDocuments({ expiresAt: { $lt: new Date() } });
    
    console.log(`
    📊 Statistiques:
    - Total codes: ${totalCodes}
    - Codes utilisés: ${usedCodes}
    - Codes expirés: ${expiredCodes}
    `);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkAccessCodes();