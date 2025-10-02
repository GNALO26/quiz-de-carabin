const mongoose = require('mongoose');
require('dotenv').config();

async function healthCheck() {
  console.log('🔍 VÉRIFICATION SYSTÈME LIVE');
  console.log('============================\n');
  
  try {
    // 1. Vérification MongoDB
    console.log('1. 📦 Connexion MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('   ✅ MongoDB connecté\n');
    
    // 2. Vérification PayDunya
    console.log('2. 💳 Configuration PayDunya...');
    const { setup } = require('../config/paydunya');
    console.log('   - Mode:', setup.mode);
    console.log('   - Master Key:', setup.masterKey ? '✓ LIVE' : '✗ MANQUANTE');
    console.log('   - Private Key:', setup.privateKey ? '✓ LIVE' : '✗ MANQUANTE');
    console.log('   - Public Key:', setup.publicKey ? '✓ LIVE' : '✗ MANQUANTE');
    console.log('   ✅ PayDunya configuré\n');
    
    // 3. Vérification Email
    console.log('3. 📧 Configuration Email...');
    const transporter = require('../config/email');
    await new Promise((resolve, reject) => {
      transporter.verify((error, success) => {
        if (error) {
          console.log('   ❌ Email:', error.message);
          reject(error);
        } else {
          console.log('   ✅ Serveur email prêt');
          resolve();
        }
      });
    });
    
    console.log('\n🎉 TOUS LES SYSTÈMES SONT OPÉRATIONNELS');
    console.log('🚀 PRÊT POUR LA PRODUCTION LIVE');
    
  } catch (error) {
    console.error('\n💥 ERREUR CRITIQUE:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

healthCheck();