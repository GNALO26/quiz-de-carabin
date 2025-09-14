const mongoose = require('mongoose');
require('dotenv').config();

async function diagnoseUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connecté à MongoDB');

    const User = require('../models/User');
    const users = await User.find({});
    
    console.log(`Nombre total d'utilisateurs: ${users.length}`);
    
    // Analyser les problèmes potentiels
    users.forEach((user, index) => {
      console.log(`\n--- Utilisateur ${index + 1} ---`);
      console.log(`Email: ${user.email}`);
      console.log(`TokenVersion: ${user.tokenVersion}`);
      console.log(`Mot de passe hashé: ${user.password ? 'Oui' : 'Non'}`);
      console.log(`Problèmes détectés: ${detectUserIssues(user)}`);
    });
    
    await mongoose.connection.close();
    console.log('\nDiagnostic terminé');
    
  } catch (error) {
    console.error('Erreur lors du diagnostic:', error);
  }
}

function detectUserIssues(user) {
  const issues = [];
  
  if (!user.password) issues.push('Pas de mot de passe');
  if (user.tokenVersion === undefined || user.tokenVersion === null) issues.push('TokenVersion manquant');
  if (user.password && user.password.length < 20) issues.push('Mot de passe potentiellement mal hashé');
  
  return issues.length > 0 ? issues.join(', ') : 'Aucun problème détecté';
}

// Exécuter le script si appelé directement
if (require.main === module) {
  diagnoseUsers();
}

module.exports = diagnoseUsers;