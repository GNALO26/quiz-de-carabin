const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

console.log('📋 Chargement des routes de paiement...');

// ✅ Vérification que toutes les fonctions existent
console.log('🔍 Vérification des fonctions du paymentController:');
console.log('   - initiatePayment:', typeof paymentController.initiatePayment);
console.log('   - processPaymentReturn:', typeof paymentController.processPaymentReturn);
console.log('   - getUserSubscriptionInfo:', typeof paymentController.getUserSubscriptionInfo);
console.log('   - resendAccessCode:', typeof paymentController.resendAccessCode);

// ✅ PAIEMENT WIDGET KKIAPAY (MÉTHODE PRINCIPALE)
router.post('/initiate', (req, res, next) => {
    if (typeof paymentController.initiatePayment !== 'function') {
        console.error('❌ initiatePayment non trouvée');
        return res.status(500).json({ 
            success: false, 
            message: 'Fonction non disponible' 
        });
    }
    paymentController.initiatePayment(req, res, next);
});

// ✅ TRAITEMENT RETOUR DE PAIEMENT
router.post('/process-return', (req, res, next) => {
    if (typeof paymentController.processPaymentReturn !== 'function') {
        console.error('❌ processPaymentReturn non trouvée');
        return res.status(500).json({ 
            success: false, 
            message: 'Fonction non disponible' 
        });
    }
    paymentController.processPaymentReturn(req, res, next);
});

// ✅ INFORMATIONS D'ABONNEMENT
router.get('/subscription/info', (req, res, next) => {
    if (typeof paymentController.getUserSubscriptionInfo !== 'function') {
        console.error('❌ getUserSubscriptionInfo non trouvée');
        return res.status(500).json({ 
            success: false, 
            message: 'Fonction non disponible' 
        });
    }
    paymentController.getUserSubscriptionInfo(req, res, next);
});

// ✅ RENVOYER LE CODE D'ACCÈS
router.post('/resend-code', (req, res, next) => {
    if (typeof paymentController.resendAccessCode !== 'function') {
        console.error('❌ resendAccessCode non trouvée');
        return res.status(500).json({ 
            success: false, 
            message: 'Fonction non disponible' 
        });
    }
    paymentController.resendAccessCode(req, res, next);
});

// ✅ VÉRIFIER STATUT TRANSACTION (optionnel)
router.get('/transaction/:transactionId/status', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const Transaction = require('../models/Transaction');
        
        const transaction = await Transaction.findOne({
            $or: [
                { transactionId: transactionId },
                { kkiapayTransactionId: transactionId }
            ],
            userId: req.user._id
        });
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction non trouvée'
            });
        }
        
        res.json({
            success: true,
            transaction: {
                transactionId: transaction.transactionId,
                status: transaction.status,
                amount: transaction.amount,
                planId: transaction.planId,
                accessCode: transaction.status === 'completed' ? transaction.accessCode : null,
                createdAt: transaction.createdAt
            }
        });
    } catch (error) {
        console.error('❌ Erreur vérification statut:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

console.log('✅ Routes de paiement chargées avec succès');

module.exports = router;