const fedapayModule = require('fedapay');

console.log('🔍 FedaPay module keys:', Object.keys(fedapayModule));

let FedaPay;
let Transaction;

if (fedapayModule.FedaPay) {
    FedaPay = fedapayModule.FedaPay;
    Transaction = fedapayModule.FedaPay.Transaction || fedapayModule.Transaction;
    console.log('📦 Export via: fedapayModule.FedaPay');
} else if (fedapayModule.default) {
    FedaPay = fedapayModule.default;
    Transaction = fedapayModule.default.Transaction || fedapayModule.Transaction;
    console.log('📦 Export via: fedapayModule.default');
} else {
    FedaPay = fedapayModule;
    Transaction = fedapayModule.Transaction;
    console.log('📦 Export via: fedapayModule direct');
}

console.log('🔍 Transaction type:', typeof Transaction);

const environment = process.env.FEDAPAY_ENVIRONMENT || 'live';
const secretKey   = process.env.FEDAPAY_SECRET_KEY;

console.log(`🔧 FedaPay Mode: ${environment}`);
console.log(`🔑 Clé: ${secretKey ? secretKey.substring(0, 12) + '...' : '❌ MANQUANTE'}`);

if (typeof FedaPay.setApiKey === 'function') {
    FedaPay.setApiKey(secretKey);
    FedaPay.setEnvironment(environment);
    console.log('✅ FedaPay configuré');
} else {
    console.error('❌ setApiKey non disponible');
}

class FedaPayService {

    async createTransaction(data) {
        try {
            const { amount, description, customer, callbackUrl } = data;

            const T = Transaction || FedaPay.Transaction;
            if (!T) {
                throw new Error(`FedaPay.Transaction indisponible. Keys: ${Object.keys(FedaPay || {}).join(', ')}`);
            }

            // Construire customer — phone_number seulement si valide
            const customerObj = {
                firstname: customer.firstname || 'Client',
                lastname:  customer.lastname  || 'Quiz',
                email:     customer.email
            };

            if (customer.phone && customer.phone.trim().length >= 8) {
                customerObj.phone_number = {
                    number:  customer.phone.trim(),
                    country: 'BJ'
                };
            }

            console.log('📤 FedaPay.Transaction.create...');
            console.log('👤 Customer:', JSON.stringify(customerObj));

            const transaction = await T.create({
                description:  description,
                amount:       amount,
                currency:     { iso: 'XOF' },
                callback_url: callbackUrl,
                customer:     customerObj
            });

            console.log('✅ Transaction créée, ID:', transaction.id);

            const token = await transaction.generateToken();
            console.log('✅ URL paiement:', token.url);

            return {
                success:       true,
                transactionId: transaction.id,
                token:         token.token,
                paymentUrl:    token.url
            };

        } catch (error) {
            console.error('❌ Erreur FedaPay:', error.message);
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
            console.error('❌ getTransactionStatus:', error.message);
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
            return false;
        }
    }
}

module.exports = new FedaPayService();