const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndexesSafe() {
  try {
    console.log('Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('../models/User');
    
    console.log('Vérification des index...');
    
    // Méthode safe pour vérifier les index
    try {
      // Compter les documents avec le même email
      const duplicateEmails = await User.aggregate([
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
      
      console.log(`Doublons d'email trouvés: ${duplicateEmails.length}`);
      
      // Supprimer les doublons (garder le plus récent)
      for (const duplicate of duplicateEmails) {
        const users = await User.find({ email: duplicate._id }).sort({ createdAt: -1 });
        
        // Garder le premier (le plus récent) et supprimer les autres
        for (let i = 1; i < users.length; i++) {
          await User.findByIdAndDelete(users[i]._id);
          console.log(`Supprimé doublon: ${users[i].email}`);
        }
      }
    } catch (error) {
      console.log('Erreur lors du nettoyage des doublons:', error.message);
    }
    
    // Essayer de créer l'index unique
    try {
      await User.collection.createIndex({ email: 1 }, { unique: true });
      console.log('✅ Index unique sur email créé avec succès');
    } catch (error) {
      console.log('ℹ Index existe peut-être déjà:', error.message);
    }
    
    await mongoose.connection.close();
    console.log('✅ Opération terminée');
    
  } catch (error) {
    console.error('Erreur:', error.message);
    process.exit(1);
  }
}

fixIndexesSafe();