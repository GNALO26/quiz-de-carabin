const fedapayModule = require('fedapay');

let FedaPay;
if (fedapayModule.FedaPay && typeof fedapayModule.FedaPay.setApiKey === 'function') {
    FedaPay = fedapayModule.FedaPay;
} else if (fedapayModule.default && typeof fedapayModule.default.setApiKey === 'function') {
    FedaPay = fedapayModule.default;
} else if (typeof fedapayModule.setApiKey === 'function') {
    FedaPay = fedapayModule;
} else {
    console.error('❌ Format FedaPay non reconnu. Clés disponibles:', Object.keys(fedapayModule));
    throw new Error('Module FedaPay non chargeable');
}

const environment = process.env.FEDAPAY_ENVIRONMENT || 'live';
const secretKey   = process.env.FEDAPAY_SECRET_KEY;

console.log(`🔧 Configuration FedaPay chargée - Mode: ${environment}`);
console.log(`🔑 Clé secrète: ${secretKey ? '✓ Configurée (' + secretKey.substring(0, 8) + '...)' : '❌ MANQUANTE'}`);

FedaPay.setApiKey(secretKey);
FedaPay.setEnvironment(environment);

class FedaPayService {

    async createTransaction(data) {
        try {
            const { amount, description, customer, callbackUrl } = data;

            console.log('📤 Création transaction FedaPay:', {
                amount, description, email: customer.email, callbackUrl
            });

            const customerObj = {
                firstname: customer.firstname || 'Client',
                lastname:  customer.lastname  || 'Quiz',
                email:     customer.email,
                phone_number: {
                    number:  customer.phone || '22900000000',
                    country: 'BJ'
                }
            };

            console.log('👤 Customer:', JSON.stringify(customerObj));

            const transaction = await FedaPay.Transaction.create({
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
            console.error('❌ Erreur création transaction FedaPay:');
            console.error('   Message:', error.message);
            console.error('   Type:', error.constructor.name);
            if (error.status)   console.error('   Status HTTP:', error.status);
            if (error.errors)   console.error('   Errors:', JSON.stringify(error.errors));
            if (error.response) console.error('   Response:', JSON.stringify(error.response?.data || {}));
            console.error('   Stack:', error.stack?.split('\n')[1]);
            return { success: false, error: error.message };
        }
    }

    async getTransactionStatus(transactionId) {
        try {
            const transaction = await FedaPay.Transaction.retrieve(transactionId);
            return {
                success:     true,
                status:      transaction.status,
                amount:      transaction.amount,
                currency:    transaction.currency?.iso,
                approved_at: transaction.approved_at
            };
        } catch (error) {
            console.error('❌ Erreur récupération transaction FedaPay:', error.message);
            return { success: false, error: error.message };
        }
    }

    validateWebhook(signature, payload) {
        try {
            const webhookSecret = process.env.FEDAPAY_WEBHOOK_SECRET;
            if (!webhookSecret) {
                console.warn('⚠️  FEDAPAY_WEBHOOK_SECRET non défini, validation ignorée');
                return true;
            }
            const crypto = require('crypto');
            const computedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(JSON.stringify(payload))
                .digest('hex');
            return signature === computedSignature;
        } catch (error) {
            console.error('❌ Erreur validation webhook:', error.message);
            return false;
        }
    }
}

module.exports = new FedaPayService();