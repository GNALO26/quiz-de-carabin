const Transaction = require('../models/Transaction');

const cleanupOldTransactions = async () => {
  try {
    const result = await Transaction.deleteMany({
      createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 heures
    });
    
    console.log(`Nettoyage des transactions: ${result.deletedCount} transactions supprimées`);
  } catch (error) {
    console.error('Erreur lors du nettoyage des transactions:', error);
  }
};

// Exécuter le nettoyage toutes les heures
setInterval(cleanupOldTransactions, 60 * 60 * 1000);

// Exécuter immédiatement au démarrage
cleanupOldTransactions();

module.exports = cleanupOldTransactions;