const mongoose = require('mongoose');
require('dotenv').config();

async function dailyMaintenance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('../models/User');
    const PasswordReset = require('../models/PasswordReset');
    
    // Nettoyer les codes de réinitialisation expirés
    await PasswordReset.deleteMany({ 
      expiresAt: { $lt: new Date() } 
    });
    
    console.log('Maintenance quotidienne terminée');
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Erreur maintenance:', error);
  }
}

dailyMaintenance();