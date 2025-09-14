const mongoose = require('mongoose');
require('dotenv').config();

async function fixExistingUsers() {
  try {
    console.log('Connexion à la base de données...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Charger le modèle User correctement
    const User = require('../models/User');
    
    const users = await User.find({});
    
    console.log(`Analyse de ${users.length} utilisateurs...`);
    
    let fixedCount = 0;
    
    for (const user of users) {
      let updated = false;
      
      if (updated) {
        await user.save();
        fixedCount++;
      }
    }
    
    console.log(`\nRésumé : ${fixedCount} utilisateurs corrigés sur ${users.length}`);
    
    // Vérification des index existants
    console.log('Vérification des index...');
    try {
      const indexes = await User.collection.indexes();
      console.log('Index existants:', indexes.map(idx => idx.name));
    } catch (e) {
      console.log('Erreur lors de la vérification des index:', e.message);
    }
    
    await mongoose.connection.close();
    console.log('\nOpération terminée avec succès!');
    
  } catch (error) {
    console.error('Erreur lors de la correction des utilisateurs:', error);
    process.exit(1);
  }
}

fixExistingUsers();