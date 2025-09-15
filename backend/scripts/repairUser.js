const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function repairUser(email, newPassword) {
  try {
    console.log('Connexion à la base de données...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Charger le modèle User
    const User = require('../models/User');
    
    // Trouver l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      console.log('Utilisateur non trouvé');
      return;
    }
    
    console.log(`Réparation du compte: ${user.email}`);
    
    // Réinitialiser le mot de passe
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Réinitialiser le tokenVersion
    user.tokenVersion = 0;
    
    await user.save();
    
    console.log('Compte réparé avec succès!');
    console.log('Nouveau mot de passe:', newPassword);
    
    await mongoose.connection.close();
    
  } catch (error) {
    console.error('Erreur lors de la réparation:', error);
  }
}

// Utilisation: node scripts/repairUser.js email@exemple.com nouveauMotDePasse
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node repairUser.js <email> <nouveauMotDePasse>');
  process.exit(1);
}

repairUser(args[0], args[1]);