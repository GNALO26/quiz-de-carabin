const mongoose = require('mongoose');
require('dotenv').config();

async function checkMongoConfig() {
  try {
    console.log('Connexion à MongoDB avec URI:', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//:@'));
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connecté à MongoDB avec succès');
    
    // Vérifier la version de MongoDB
    const adminDb = mongoose.connection.db.admin();
    const serverStatus = await adminDb.serverStatus();
    console.log('✅ Version MongoDB:', serverStatus.version);
    
    // Vérifier les collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('✅ Collections existantes:', collections.map(c => c.name));
    
    // Vérifier les index de la collection users
    const User = require('../models/User');
    const indexes = await User.collection.getIndexes();
    console.log('✅ Index de la collection users:', Object.keys(indexes));
    
    await mongoose.connection.close();
    console.log('✅ Vérification terminée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur de configuration MongoDB:', error);
    process.exit(1);
  }
}

checkMongoConfig();