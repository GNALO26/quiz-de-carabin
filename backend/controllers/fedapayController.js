const Transaction = require('../models/Transaction');
const User = require('../models/User');
const fedapayService = require('../services/fedapayService');
const emailService = require('../services/emailService');

// Plans disponibles — source unique de vérité
const PLANS = {
    '1month':   { amount: 5000,  durationInMonths: 2,  name: '1 mois' },
    '3months':  { amount: 12000, durationInMonths: 3,  name: '3 mois' },
    '10months': { amount: 25000, durationInMonths: 10, name: '10 mois' }
};

/**
 * Créer une transaction de paiement FedaPay
 */
exports.createPayment = async (req, res) => {
    try {
        const { plan, customerInfo } = req.body;
        const userId = req.user._id;

        const selectedPlan = PLANS[plan];
        if (!selectedPlan) {
            return res.status(400).json({
                success: false,
                message: `Plan invalide: "${plan}". Plans acceptés: 1month, 3months, 10months`
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }

        // Créer la transaction
        const transaction = new Transaction({
            userId:           userId,
            amount:           selectedPlan.amount,
            currency:         'XOF',
            status:           'pending',
            plan:             plan,
            durationInMonths: selectedPlan.durationInMonths,
            paymentMethod:    'fedapay',
            provider:         'fedapay'
        });

        await transaction.save();
        console.log(`✅ Transaction créée en DB: ${transaction._id} - Plan: ${plan}`);

        const nameParts = (user.name || '').split(' ');
        const firstname = (customerInfo && customerInfo.firstname) || nameParts[0] || 'Client';
        const lastname  = (customerInfo && customerInfo.lastname)  || nameParts[1] || 'Quiz';
        const phone     = (customerInfo && customerInfo.phone)     || user.phone   || '';

        // Créer la transaction FedaPay
        const fedapayResult = await fedapayService.createTransaction({
            amount:      selectedPlan.amount,
            description: `Abonnement Premium ${selectedPlan.name} - Quiz de Carabin`,
            customer:    { firstname, lastname, email: user.email, phone },
            callbackUrl: `${process.env.FRONTEND_URL}/payment-callback.html?transaction_id=${transaction._id}`
        });

        if (!fedapayResult.success) {
            transaction.status = 'failed';
            await transaction.save();
            console.error('❌ Échec FedaPay:', fedapayResult.error);
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de la création du paiement FedaPay',
                error:   fedapayResult.error
            });
        }

        transaction.transactionId = String(fedapayResult.transactionId);
        await transaction.save();
        console.log(`✅ ID FedaPay sauvegardé: ${fedapayResult.transactionId}`);

        return res.json({
            success:       true,
            paymentUrl:    fedapayResult.paymentUrl,
            transactionId: transaction._id
        });

    } catch (error) {
        console.error('❌ Erreur createPayment:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error:   error.message
        });
    }
};

/**
 * Webhook FedaPay - SANS VÉRIFICATION SIGNATURE (pour tests)
 */
exports.handleWebhook = async (req, res) => {
    try {
        const payload = req.body;

        console.log('🔔 Webhook FedaPay reçu:', JSON.stringify(payload).substring(0, 200));

        // ⚠️ TEMPORAIRE : Pas de vérification signature pour debug
        // const signature = req.headers['x-fedapay-signature'];
        // if (signature && !fedapayService.validateWebhook(signature, payload)) {
        //     console.error('❌ Signature webhook invalide');
        //     return res.status(401).json({ success: false, message: 'Signature invalide' });
        // }

        const event  = payload.event  || payload.name;
        const entity = payload.entity || payload.data;

        console.log(`📦 Événement FedaPay: ${event}`);

        if (event === 'transaction.approved' || event === 'transaction.approved.live') {
            const fedapayTransactionId = String(entity.id);

            const transaction = await Transaction.findOne({
                transactionId: fedapayTransactionId
            }).populate('userId');

            if (!transaction) {
                console.error('❌ Transaction non trouvée:', fedapayTransactionId);
                return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
            }

            if (transaction.status === 'completed') {
                console.log('⚠️ Transaction déjà traitée');
                return res.json({ success: true, message: 'Transaction déjà traitée' });
            }

            // Générer le code d'activation
            const code = transaction.generateActivationCode();
            transaction.status = 'completed';
            transaction.completedAt = new Date();
            await transaction.save();
            
            console.log(`✅ Transaction complétée: ${transaction._id}`);
            console.log(`🔑 Code généré: ${code}`);

            // ✅ ENVOYER L'EMAIL IMMÉDIATEMENT
            if (transaction.userId) {
                try {
                    console.log(`📧 Envoi email à: ${transaction.userId.email}`);
                    
                    const emailResult = await emailService.sendPremiumActivationCodeEmail(
                        transaction.userId, 
                        transaction
                    );
                    
                    if (emailResult.success) {
                        transaction.codeEmailSent = true;
                        transaction.codeEmailSentAt = new Date();
                        await transaction.save();
                        console.log(`✅ Email envoyé avec succès`);
                    } else {
                        console.error(`❌ Erreur envoi email:`, emailResult.error);
                    }
                    
                } catch (emailError) {
                    console.error('❌ Erreur email:', emailError.message);
                }
            } else {
                console.error('❌ Pas d\'utilisateur lié à la transaction');
            }
        }

        return res.json({ success: true });

    } catch (error) {
        console.error('❌ Erreur webhook FedaPay:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur webhook', 
            error: error.message 
        });
    }
};

/**
 * Vérifier statut transaction
 */
exports.checkPaymentStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const transaction = await Transaction.findById(transactionId);

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
        }

        if (transaction.status === 'pending' && transaction.transactionId) {
            const liveStatus = await fedapayService.getTransactionStatus(transaction.transactionId);
            if (liveStatus.success && liveStatus.status === 'approved') {
                const code = transaction.generateActivationCode();
                transaction.status = 'completed';
                transaction.completedAt = new Date();
                await transaction.save();
                
                console.log(`✅ Transaction mise à jour via polling: ${transaction._id}`);
            }
        }

        return res.json({
            success:      true,
            status:       transaction.status,
            amount:       transaction.amount,
            plan:         transaction.plan,
            codeExpiry:   transaction.codeExpiresAt,
            emailSent:    transaction.codeEmailSent
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