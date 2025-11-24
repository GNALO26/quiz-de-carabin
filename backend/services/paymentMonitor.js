const Transaction = require('../models/Transaction');
const kkiapay = require('../config/kkiapay');

class PaymentMonitor {
    constructor() {
        this.interval = null;
        this.init();
    }

    init() {
        console.log('🔍 Initialisation moniteur de paiements...');
        
        // Vérifier toutes les 30 secondes
        this.interval = setInterval(() => this.checkPendingPayments(), 30000);
    }

    async checkPendingPayments() {
        try {
            console.log('🔍 Vérification des paiements en attente...');
            
            // Trouver les transactions en attente depuis plus de 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            
            const pendingTransactions = await Transaction.find({
                status: 'pending',
                createdAt: { $lt: fiveMinutesAgo }
            }).limit(10);

            console.log(`📊 ${pendingTransactions.length} transactions en attente à vérifier`);

            for (const transaction of pendingTransactions) {
                await this.verifyTransaction(transaction);
            }
        } catch (error) {
            console.error('❌ Erreur monitoring paiements:', error);
        }
    }

    async verifyTransaction(transaction) {
        try {
            console.log(`🔍 Vérification transaction: ${transaction.transactionId}`);
            
            if (transaction.kkiapayTransactionId) {
                const status = await kkiapay.verifyTransaction(transaction.kkiapayTransactionId);
                
                if (status.status === 'SUCCESS') {
                    console.log(`✅ Transaction ${transaction.transactionId} confirmée par monitoring`);
                    
                    // Importer la fonction d'activation
                    const { activatePremiumSubscription } = require('../controllers/paymentController');
                    await activatePremiumSubscription(transaction);
                }
            }
        } catch (error) {
            console.log(`⚠ Erreur vérification ${transaction.transactionId}:`, error.message);
        }
    }
}

module.exports = new PaymentMonitor();