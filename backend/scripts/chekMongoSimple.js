const mongoose = require('mongoose');
require('dotenv').config();

async function checkMongoSimple() {
  try {
    console.log('Connexion à MongoDB...');
    
    // Masquer le mot de passe dans les logs
    const maskedUri = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':@');
    console.log('URI MongoDB:', maskedUri);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connecté à MongoDB avec succès');
    
    // Vérification basique sans commandes admin
    const db = mongoose.connection.db;
    
    // Lister les collections (méthode simple)
    try {
      const collections = await db.listCollections().toArray();
      console.log('✅ Collections existantes:');
      collections.forEach(collection => {
        console.log(`   - ${collection.name}`);
      });
    } catch (error) {
      console.log('ℹ Impossible de lister les collections:', error.message);
    }
    
    // Vérifier la collection users
    try {
      const User = mongoose.model('User');
      const userCount = await User.countDocuments();
      console.log(`✅ Nombre d'utilisateurs: ${userCount}`);
    } catch (error) {
      console.log('ℹ Impossible de compter les utilisateurs:', error.message);
    }
    
    await mongoose.connection.close();
    console.log('✅ Vérification terminée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    process.exit(1);
  }
}

checkMongoSimple();