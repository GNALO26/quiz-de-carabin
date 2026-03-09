const fedapayModule = require('fedapay');

// Diagnostic complet du module
console.log('🔍 FedaPay module keys:', Object.keys(fedapayModule));
console.log('🔍 FedaPay module type:', typeof fedapayModule);

// Chercher Transaction dans toutes les possibilités
let FedaPay;
let Transaction;

if (fedapayModule.FedaPay) {
    FedaPay = fedapayModule.FedaPay;
    Transaction = fedapayModule.FedaPay.Transaction || fedapayModule.Transaction;
    console.log('📦 Export: fedapayModule.FedaPay');
} else if (fedapayModule.default) {
    FedaPay = fedapayModule.default;
    Transaction = fedapayModule.default.Transaction || fedapayModule.Transaction;
    console.log('📦 Export: fedapayModule.default');
} else {
    FedaPay = fedapayModule;
    Transaction = fedapayModule.Transaction;
    console.log('📦 Export: fedapayModule direct');
}

console.log('🔍 Transaction disponible:', typeof Transaction);
console.log('🔍 FedaPay keys:', FedaPay ? Object.keys(FedaPay).slice(0, 10) : 'null');

const environment = process.env.FEDAPAY_ENVIRONMENT || 'live';
const secretKey   = process.env.FEDAPAY_SECRET_KEY;

console.log(`🔧 FedaPay Mode: ${environment}`);
console.log(`🔑 Clé: ${secretKey ? secretKey.substring(0, 12) + '...' : '❌ MANQUANTE'}`);

if (typeof FedaPay.setApiKey === 'function') {
    FedaPay.setApiKey(secretKey);
    FedaPay.setEnvironment(environment);
    console.log('✅ FedaPay configuré');
} else {
    console.error('❌ setApiKey non trouvé sur FedaPay');
}

class FedaPayService {

    async createTransaction(data) {
        try {
            const { amount, description, customer, callbackUrl } = data;

            // Résoudre Transaction au moment de l'appel (pas au chargement)
            const T = Transaction || FedaPay.Transaction;
            
            if (!T) {
                throw new Error(`FedaPay.Transaction non disponible. FedaPay keys: ${Object.keys(FedaPay || {}).join(', ')}`);
            }

            console.log('📤 Appel FedaPay.Transaction.create...');

            const customerObj = {
                firstname: customer.firstname || 'Client',
                lastname:  customer.lastname  || 'Quiz',
                email:     customer.email,
                phone_number: {
                    number:  customer.phone || '22900000000',
                    country: 'BJ'
                }
            };

            const transaction = await T.create({
                description:  description,
                amount:       amount,
                currency:     { iso: 'XOF' },
                callback_url: callbackUrl,
                customer:     customerObj
            });

            console.log('✅ Transaction FedaPay créée, ID:', transaction.id);

            const token = await transaction.generateToken();
            console.log('✅ Token généré, URL:', token.url);

            return {
                success:       true,
                transactionId: transaction.id,
                token:         token.token,
                paymentUrl:    token.url
            };

        } catch (error) {
            console.error('❌ Erreur FedaPay createTransaction:');
            console.error('   Message:', error.message);
            if (error.status)   console.error('   Status:', error.status);
            if (error.errors)   console.error('   Errors:', JSON.stringify(error.errors));
            return { success: false, error: error.message };
        }
    }

    async getTransactionStatus(transactionId) {
        try {
            const T = Transaction || FedaPay.Transaction;
            const transaction = await T.retrieve(transactionId);
            return {
                success:     true,
                status:      transaction.status,
                amount:      transaction.amount,
                currency:    transaction.currency?.iso,
                approved_at: transaction.approved_at
            };
        } catch (error) {
            console.error('❌ Erreur getTransactionStatus:', error.message);
            return { success: false, error: error.message };
        }
    }

    validateWebhook(signature, payload) {
        try {
            const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET;
            if (!webhookSecret) return true;
            const crypto = require('crypto');
            const computed = crypto
                .createHmac('sha256', webhookSecret)
                .update(JSON.stringify(payload))
                .digest('hex');
            return signature === computed;
        } catch (error) {
            console.error('❌ Erreur validateWebhook:', error.message);
            return false;
        }
    }
}

module.exports = new FedaPayService();