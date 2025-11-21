const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function checkExpiredSubscriptions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔍 Vérification des abonnements expirés...');
    
    const now = new Date();
    const expiredUsers = await User.find({
      isPremium: true,
      premiumExpiresAt: { $lt: now }
    });
    
    console.log(`📊 ${expiredUsers.length} abonnements expirés trouvés`);
    
    for (const user of expiredUsers) {
      user.isPremium = false;
      await user.save();
      console.log(`⏰ Abonnement désactivé pour: ${user.email}`);
    }
    
    console.log('✅ Vérification terminée');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkExpiredSubscriptions();