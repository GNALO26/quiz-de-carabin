const mongoose = require('mongoose');
require('dotenv').config();

async function resetDatabase() {
  try {
    console.log('Connexion à la base de données...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('../models/User');
    const PasswordReset = require('../models/PasswordReset');
    
    console.log('Suppression de tous les index...');
    
    // Obtenir tous les index
    const indexes = await User.collection.getIndexes();
    console.log('Index actuels:', Object.keys(indexes));
    
    // Supprimer tous les index sauf id
    for (const indexName of Object.keys(indexes)) {
      if (indexName !== 'id') {
        console.log(`Suppression de l'index: ${indexName}`);
        try {
          await User.collection.dropIndex(indexName);
        } catch (error) {
          console.log(`Impossible de supprimer l'index ${indexName}:`, error.message);
        }
      }
    }
    
    // Vider complètement les collections (ATTENTION: cette opération supprime toutes les données)
    console.log('Vidage des collections...');
    await User.deleteMany({});
    await PasswordReset.deleteMany({});
    
    console.log('Création des nouveaux index...');
    
    // Recréer l'index unique sur email
    await User.collection.createIndex({ email: 1 }, { 
      unique: true,
      name: 'email_unique',
      background: true
    });
    
    console.log('Index email_unique créé avec succès');
    
    // Créer d'autres index si nécessaire
    await User.collection.createIndex({ tokenVersion: 1 }, {
      name: 'tokenVersion_index',
      background: true
    });
    
    console.log('Base de données réinitialisée avec succès!');
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Erreur lors de la réinitialisation de la base de données:', error);
    process.exit(1);
  }
}

// Demander confirmation avant de procéder
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

readline.question('⚠  ATTENTION: Cette opération va supprimer TOUTES les données utilisateur. Continuer? (o/N) ', async (answer) => {
  if (answer.toLowerCase() === 'o' || answer.toLowerCase() === 'oui') {
    await resetDatabase();
    console.log('Réinitialisation terminée. Les utilisateurs devront recréer leurs comptes.');
  } else {
    console.log('Opération annulée.');
  }
  readline.close();
});