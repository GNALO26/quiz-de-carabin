const Transaction = require('../models/Transaction');

const cleanupOldTransactions = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await Transaction.deleteMany({
      createdAt: { $lt: twentyFourHoursAgo },
      status: { $in: ['pending', 'failed'] }
    });
    
    console.log(`Nettoyage des transactions: ${result.deletedCount} transactions expirées supprimées`);
  } catch (error) {
    console.error('Erreur lors du nettoyage des transactions:', error);
  }
};

// Exécuter le nettoyage toutes les heures
setInterval(cleanupOldTransactions, 60 * 60 * 1000);

// Exécuter immédiatement au démarrage
cleanupOldTransactions();

module.exports = cleanupOldTransactions;