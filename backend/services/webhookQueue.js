const Transaction = require('../models/Transaction');
const { activatePremiumSubscription } = require('../controllers/paymentController');

class WebhookQueue {
    constructor() {
        this.queue = new Map();
        this.processing = false;
        this.init();
    }

    init() {
        console.log('🔄 Initialisation file d\'attente webhooks...');
        
        // Traiter la file toutes les 10 secondes
        setInterval(() => this.processQueue(), 10000);
        
        // Nettoyer les anciennes entrées toutes les heures
        setInterval(() => this.cleanup(), 3600000);
    }

    async addToQueue(transactionId, webhookData) {
        console.log(`📨 Ajout à la file: ${transactionId}`);
        
        this.queue.set(transactionId, {
            data: webhookData,
            addedAt: new Date(),
            attempts: 0,
            lastAttempt: null
        });

        // Traiter immédiatement
        await this.processQueue();
    }

    async processQueue() {
        if (this.processing || this.queue.size === 0) return;
        
        this.processing = true;
        console.log(`🔄 Traitement file d'attente: ${this.queue.size} webhooks en attente`);
        
        for (const [transactionId, item] of this.queue.entries()) {
            try {
                console.log(`🔍 Traitement webhook: ${transactionId} (tentative ${item.attempts + 1})`);
                
                // Rechercher la transaction
                let transaction = await Transaction.findOne({
                    $or: [
                        { transactionId: transactionId },
                        { kkiapayTransactionId: transactionId }
                    ]
                });

                if (transaction) {
                    console.log(`✅ Transaction trouvée: ${transaction.transactionId}`);
                    
                    if (transaction.status !== 'completed') {
                        // Activer l'abonnement
                        transaction.kkiapayTransactionId = transactionId;
                        await transaction.save();
                        
                        const success = await activatePremiumSubscription(transaction);
                        
                        if (success) {
                            console.log(`🎉 Webhook traité avec succès: ${transactionId}`);
                            this.queue.delete(transactionId);
                        } else {
                            console.error(`❌ Échec activation pour: ${transactionId}`);
                            this.incrementAttempts(transactionId);
                        }
                    } else {
                        console.log(`ℹ Transaction déjà complétée: ${transactionId}`);
                        this.queue.delete(transactionId);
                    }
                } else {
                    console.log(`⏳ Transaction non trouvée, réessai plus tard: ${transactionId}`);
                    this.incrementAttempts(transactionId);
                }
            } catch (error) {
                console.error(`💥 Erreur traitement webhook ${transactionId}:`, error);
                this.incrementAttempts(transactionId);
            }
        }
        
        this.processing = false;
    }

    incrementAttempts(transactionId) {
        const item = this.queue.get(transactionId);
        if (item) {
            item.attempts++;
            item.lastAttempt = new Date();
            
            // Supprimer après 10 tentatives ou 1 heure
            if (item.attempts >= 10 || (Date.now() - item.addedAt) > 3600000) {
                console.log(`🗑 Suppression webhook après ${item.attempts} tentatives: ${transactionId}`);
                this.queue.delete(transactionId);
            }
        }
    }

    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [transactionId, item] of this.queue.entries()) {
            if ((now - item.addedAt) > 3600000) { // 1 heure
                this.queue.delete(transactionId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Nettoyage file: ${cleaned} webhooks expirés supprimés`);
        }
    }

    getQueueSize() {
        return this.queue.size;
    }
}

module.exports = new WebhookQueue();