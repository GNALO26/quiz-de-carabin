const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');

async function cleanupTransactions() {
  try {
    // Vérifier si la connexion MongoDB est active
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB connection not ready, skipping cleanup');
      return;
    }

    // Supprimer les transactions de plus de 24 heures
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await Transaction.deleteMany({
      createdAt: { $lt: cutoffDate }
    });
    
    console.log(`Nettoyage des transactions: ${result.deletedCount} transactions supprimées`);
  } catch (error) {
    console.error('Erreur lors du nettoyage des transactions:', error);
  }
}

// Si le script est exécuté directement (pas en tant que module)
if (require.main === module) {
  // Configuration pour l'exécution en standalone
  require('dotenv').config();
  
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB for cleanup');
    return cleanupTransactions();
  })
  .then(() => {
    console.log('Cleanup completed');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error during cleanup:', err);
    mongoose.connection.close();
  });
} else {
  // Export pour être utilisé dans server.js
  module.exports = cleanupTransactions;
}