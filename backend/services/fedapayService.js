const FedaPay = require('fedapay');

// Configuration FedaPay
FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY);
FedaPay.setEnvironment(process.env.FEDAPAY_ENVIRONMENT || 'live');

class FedaPayService {
    /**
     * Créer une transaction FedaPay
     */
    async createTransaction(data) {
        try {
            const { amount, description, customer, callbackUrl } = data;

            const transaction = await FedaPay.Transaction.create({
                description: description,
                amount: amount,
                currency: {
                    iso: 'XOF'
                },
                callback_url: callbackUrl,
                customer: {
                    firstname: customer.firstname,
                    lastname: customer.lastname,
                    email: customer.email,
                    phone_number: {
                        number: customer.phone,
                        country: 'BJ'
                    }
                }
            });

            // Générer le token de paiement
            const token = await transaction.generateToken();

            return {
                success: true,
                transactionId: transaction.id,
                token: token.token,
                paymentUrl: token.url
            };

        } catch (error) {
            console.error('❌ Erreur création transaction FedaPay:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Vérifier le statut d'une transaction
     */
    async getTransactionStatus(transactionId) {
        try {
            const transaction = await FedaPay.Transaction.retrieve(transactionId);
            
            return {
                success: true,
                status: transaction.status,
                amount: transaction.amount,
                currency: transaction.currency.iso,
                customer: transaction.customer,
                approved_at: transaction.approved_at
            };

        } catch (error) {
            console.error('❌ Erreur récupération transaction:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Valider le webhook FedaPay
     */
    validateWebhook(signature, payload) {
        try {
            const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET;
            const crypto = require('crypto');
            
            const computedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(JSON.stringify(payload))
                .digest('hex');

            return signature === computedSignature;
        } catch (error) {
            console.error('❌ Erreur validation webhook:', error);
            return false;
        }
    }
}

module.exports = new FedaPayService();