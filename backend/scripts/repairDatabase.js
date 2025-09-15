// scripts/repairDatabase.js
const mongoose = require('mongoose');
require('dotenv').config();

async function repairDatabase() {
  try {
    console.log('Connexion à la base de données...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('../models/User');
    
    // 1. Vérifier les index existants
    console.log('Vérification des index...');
    const indexes = await User.collection.getIndexes();
    console.log('Index existants:', Object.keys(indexes));
    
    // 2. Supprimer l'index email s'il existe
    if (indexes.email_1) {
      console.log('Suppression de l\'index email_1...');
      await User.collection.dropIndex('email_1');
      console.log('Index email_1 supprimé');
    }
    
    // 3. Vérifier les doublons
    console.log('Recherche de doublons...');
    const duplicates = await User.aggregate([
      {
        $group: {
          _id: "$email",
          count: { $sum: 1 },
          ids: { $push: "$_id" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`${duplicates.length} doublons trouvés`);
    
    // 4. Supprimer les doublons (garder le premier)
    for (const duplicate of duplicates) {
      const [keepId, ...removeIds] = duplicate.ids;
      console.log(`Garder: ${keepId}, Supprimer: ${removeIds.length} doublons pour ${duplicate._id}`);
      
      await User.deleteMany({ 
        _id: { $in: removeIds },
        email: duplicate._id
      });
    }
    
    // 5. Recréer l'index unique sur email
    console.log('Création du nouvel index unique sur email...');
    await User.collection.createIndex({ email: 1 }, { 
      unique: true,
      name: 'email_unique'
    });
    
    console.log('Index email_unique créé avec succès');
    
    // 6. Vérifier que l'index a été créé
    const newIndexes = await User.collection.getIndexes();
    console.log('Nouveaux index:', Object.keys(newIndexes));
    
    await mongoose.connection.close();
    console.log('Réparation de la base de données terminée avec succès!');
    
  } catch (error) {
    console.error('Erreur lors de la réparation de la base de données:', error);
    process.exit(1);
  }
}

repairDatabase();