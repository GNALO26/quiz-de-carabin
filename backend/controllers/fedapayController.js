const Transaction = require('../models/Transaction');
const User = require('../models/User');
const fedapayService = require('../services/fedapayService');
const emailService = require('../services/emailService');

/**
 * Créer une transaction de paiement FedaPay
 */
exports.createPayment = async (req, res) => {
    try {
        const { plan, customerInfo } = req.body;
        const userId = req.user._id;

        // Plans disponibles
        const plans = {
            '1month':   { amount: 5000,  duration: 30,  name: '1 mois' },
            '3months':  { amount: 12000, duration: 90,  name: '3 mois' },
            '10months': { amount: 25000, duration: 300, name: '10 mois' }
        };

        const selectedPlan = plans[plan];
        if (!selectedPlan) {
            return res.status(400).json({
                success: false,
                message: `Plan invalide: "${plan}". Plans acceptés: 1month, 3months, 10months`
            });
        }

        // Récupérer les infos utilisateur complètes
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }

        // Créer la transaction dans notre DB
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
        console.log(`✅ Transaction créée en DB: ${transaction._id} - Plan: ${plan}`);

        // Préparer les infos client
        const nameParts = (user.name || '').split(' ');
        const firstname = (customerInfo && customerInfo.firstname) || nameParts[0] || 'Client';
        const lastname  = (customerInfo && customerInfo.lastname)  || nameParts[1] || '';
        const phone     = (customerInfo && customerInfo.phone)     || user.phone   || '';

        // Créer la transaction FedaPay
        const fedapayResult = await fedapayService.createTransaction({
            amount: selectedPlan.amount,
            description: `Abonnement Premium ${selectedPlan.name} - Quiz de Carabin`,
            customer: {
                firstname,
                lastname,
                email: user.email,
                phone
            },
            callbackUrl: `${process.env.FRONTEND_URL}/payment-callback.html?transaction_id=${transaction._id}`
        });

        if (!fedapayResult.success) {
            transaction.status = 'failed';
            await transaction.save();
            console.error('❌ Échec création transaction FedaPay:', fedapayResult.error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la création du paiement FedaPay',
                error: fedapayResult.error
            });
        }

        // Sauvegarder l'ID FedaPay dans notre transaction
        transaction.transactionId = String(fedapayResult.transactionId);
        await transaction.save();
        console.log(`✅ ID FedaPay sauvegardé: ${fedapayResult.transactionId}`);

        return res.json({
            success: true,
            paymentUrl: fedapayResult.paymentUrl,
            transactionId: transaction._id
        });

    } catch (error) {
        console.error('❌ Erreur createPayment:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

/**
 * Webhook FedaPay — appelé automatiquement par FedaPay après paiement
 */
exports.handleWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-fedapay-signature'];
        const payload = req.body;

        console.log('🔔 Webhook FedaPay reçu:', JSON.stringify(payload).substring(0, 200));

        // Valider la signature si présente
        if (signature && !fedapayService.validateWebhook(signature, payload)) {
            console.error('❌ Signature webhook FedaPay invalide');
            return res.status(401).json({ success: false, message: 'Signature invalide' });
        }

        const event  = payload.event  || payload.name;
        const entity = payload.entity || payload.data;

        console.log(`📦 Événement FedaPay: ${event}`);

        if (event === 'transaction.approved' || event === 'transaction.approved.live') {
            const fedapayTransactionId = String(entity.id);
            console.log(`💳 Transaction approuvée: ${fedapayTransactionId}`);

            const transaction = await Transaction.findOne({
                transactionId: fedapayTransactionId
            }).populate('userId');

            if (!transaction) {
                console.error('❌ Transaction non trouvée pour ID FedaPay:', fedapayTransactionId);
                return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
            }

            // Idempotence
            if (transaction.status === 'completed') {
                console.log('ℹ️ Transaction déjà traitée:', fedapayTransactionId);
                return res.json({ success: true, message: 'Transaction déjà traitée' });
            }

            // Générer le code d'activation si la méthode existe
            if (typeof transaction.generateActivationCode === 'function') {
                transaction.generateActivationCode();
            }

            transaction.status = 'completed';
            transaction.completedAt = new Date();
            await transaction.save();
            console.log(`✅ Transaction complétée en DB: ${transaction._id}`);

            // Envoyer l'email avec le code d'activation
            if (transaction.userId) {
                try {
                    await emailService.sendPremiumActivationCodeEmail(
                        transaction.userId,
                        transaction
                    );
                    console.log(`📧 Email envoyé à: ${transaction.userId.email}`);
                } catch (emailError) {
                    console.error('❌ Erreur envoi email (non bloquant):', emailError.message);
                }
            }
        }

        return res.json({ success: true });

    } catch (error) {
        console.error('❌ Erreur webhook FedaPay:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur traitement webhook',
            error: error.message
        });
    }
};

/**
 * Vérifier le statut d'une transaction
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

        // Vérifier en temps réel chez FedaPay si en attente
        if (transaction.status === 'pending' && transaction.transactionId) {
            const liveStatus = await fedapayService.getTransactionStatus(transaction.transactionId);
            if (liveStatus.success && liveStatus.status === 'approved') {
                transaction.status = 'completed';
                transaction.completedAt = new Date();
                await transaction.save();
            }
        }

        return res.json({
            success: true,
            status: transaction.status,
            amount: transaction.amount,
            plan: transaction.plan,
            codeExpiry: transaction.codeExpiry
        });

    } catch (error) {
        console.error('❌ Erreur checkPaymentStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
};

module.exports = exports;