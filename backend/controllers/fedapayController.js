const Transaction = require('../models/Transaction');
const User = require('../models/User');
const fedapayService = require('../services/fedapayService');
const emailService = require('../services/emailService');

/**
 * Créer une transaction de paiement
 */
exports.createPayment = async (req, res) => {
    try {
        const { plan, customerInfo } = req.body;
        const userId = req.user._id;

        // Plans disponibles
        const plans = {
            '1month': { amount: 5000, duration: 30, name: '1 mois' },
            '3months': { amount: 12000, duration: 90, name: '3 mois' },
            '10months': { amount: 25000, duration: 300, name: '10 mois' }
        };

        const selectedPlan = plans[plan];
        if (!selectedPlan) {
            return res.status(400).json({
                success: false,
                message: 'Plan invalide'
            });
        }

        // Créer transaction dans notre DB
        const transaction = new Transaction({
            userId: userId,
            amount: selectedPlan.amount,
            currency: 'XOF',
            status: 'pending',
            plan: plan,
            planDuration: selectedPlan.duration,
            paymentMethod: 'fedapay'
        });

        await transaction.save();

        // Créer transaction FedaPay
        const fedapayResult = await fedapayService.createTransaction({
            amount: selectedPlan.amount,
            description: `Abonnement Premium ${selectedPlan.name} - Quiz de Carabin`,
            customer: {
                firstname: customerInfo.firstname || req.user.name.split(' ')[0],
                lastname: customerInfo.lastname || req.user.name.split(' ')[1] || '',
                email: req.user.email,
                phone: customerInfo.phone
            },
            callbackUrl: `${process.env.FRONTEND_URL}/payment-success.html?transaction_id=${transaction._id}`
        });

        if (!fedapayResult.success) {
            transaction.status = 'failed';
            await transaction.save();

            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la création du paiement',
                error: fedapayResult.error
            });
        }

        // Sauvegarder l'ID FedaPay
        transaction.transactionId = fedapayResult.transactionId;
        await transaction.save();

        res.json({
            success: true,
            paymentUrl: fedapayResult.paymentUrl,
            transactionId: transaction._id
        });

    } catch (error) {
        console.error('❌ Erreur createPayment:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

/**
 * Webhook FedaPay
 */
exports.handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-fedapay-signature'];
        const payload = req.body;

        // Valider la signature
        if (!fedapayService.validateWebhook(signature, payload)) {
            console.error('❌ Signature webhook invalide');
            return res.status(401).json({ success: false, message: 'Signature invalide' });
        }

        const { entity, event } = payload;

        if (event === 'transaction.approved') {
            const fedapayTransactionId = entity.id;

            // Trouver notre transaction
            const transaction = await Transaction.findOne({ 
                transactionId: fedapayTransactionId 
            }).populate('userId');

            if (!transaction) {
                console.error('❌ Transaction non trouvée:', fedapayTransactionId);
                return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
            }

            // Vérifier si déjà traitée
            if (transaction.status === 'completed') {
                return res.json({ success: true, message: 'Transaction déjà traitée' });
            }

            // Générer code activation
            const activationCode = transaction.generateActivationCode();
            transaction.status = 'completed';
            transaction.completedAt = new Date();
            await transaction.save();

            // Envoyer email avec code
            if (transaction.userId) {
                await emailService.sendPremiumActivationCodeEmail(
                    transaction.userId,
                    transaction
                );
            }

            console.log('✅ Transaction approuvée:', fedapayTransactionId);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Erreur webhook FedaPay:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur traitement webhook',
            error: error.message
        });
    }
};

/**
 * Vérifier statut paiement
 */
exports.checkPaymentStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findById(transactionId);
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction non trouvée'
            });
        }

        res.json({
            success: true,
            status: transaction.status,
            amount: transaction.amount,
            plan: transaction.plan,
            codeExpiry: transaction.codeExpiry
        });

    } catch (error) {
        console.error('❌ Erreur checkPaymentStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

module.exports = exports;