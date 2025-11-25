const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { activatePremiumSubscription } = require('../controllers/paymentController');

// ✅ MIDDLEWARE DE VÉRIFICATION ADMIN (à sécuriser avec un mot de passe)
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'];
    
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({
            success: false,
            message: 'Accès refusé'
        });
    }
    
    next();
};

// ✅ ACTIVER MANUELLEMENT UN PAIEMENT KKIAPAY
router.post('/activate-payment', adminAuth, async (req, res) => {
    try {
        const { kkiapayTransactionId, userEmail, amount } = req.body;
        
        console.log('\n=== 🔧 ACTIVATION MANUELLE PAIEMENT ===');
        console.log('KkiaPay Transaction ID:', kkiapayTransactionId);
        console.log('User Email:', userEmail);
        console.log('Amount:', amount);
        
        // Trouver l'utilisateur
        const user = await User.findOne({ email: userEmail });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `Utilisateur non trouvé: ${userEmail}`
            });
        }
        
        console.log(`✅ Utilisateur trouvé: ${user.email}`);
        
        // Déterminer le plan
        let planId = '1-month';
        let durationInMonths = 1;
        
        if (amount >= 25000) {
            planId = '10-months';
            durationInMonths = 10;
        } else if (amount >= 12000) {
            planId = '3-months';
            durationInMonths = 3;
        } else if (amount >= 5000) {
            planId = '1-month';
            durationInMonths = 1;
        }
        
        console.log(`📊 Plan détecté: ${planId} (${durationInMonths} mois)`);
        
        // Créer la transaction
        const transaction = new Transaction({
            userId: user._id,
            transactionId: `TXN_MANUAL_${Date.now()}`,
            kkiapayTransactionId: kkiapayTransactionId,
            amount: amount,
            durationInMonths: durationInMonths,
            planId: planId,
            status: 'pending',
            paymentGateway: 'kkiapay_manual',
            description: `Activation manuelle - ${planId}`
        });
        
        await transaction.save();
        console.log(`✅ Transaction créée: ${transaction.transactionId}`);
        
        // Activer l'abonnement
        const activationSuccess = await activatePremiumSubscription(transaction);
        
        if (activationSuccess) {
            console.log('🎉 Abonnement activé avec succès!');
            
            return res.status(200).json({
                success: true,
                message: 'Paiement activé avec succès',
                transaction: {
                    transactionId: transaction.transactionId,
                    accessCode: transaction.accessCode,
                    status: transaction.status
                },
                user: {
                    email: user.email,
                    isPremium: user.isPremium,
                    premiumExpiresAt: user.premiumExpiresAt
                }
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Erreur lors de l\'activation de l\'abonnement'
            });
        }
        
    } catch (error) {
        console.error('❌ Erreur activation manuelle:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur',
            error: error.message
        });
    }
});

// ✅ LISTER LES PAIEMENTS EN ATTENTE
router.get('/pending-payments', adminAuth, async (req, res) => {
    try {
        const pendingTransactions = await Transaction.find({ 
            status: 'pending' 
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(50);
        
        res.json({
            success: true,
            count: pendingTransactions.length,
            transactions: pendingTransactions
        });
    } catch (error) {
        console.error('❌ Erreur listing paiements:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

// ✅ LISTER TOUS LES UTILISATEURS PREMIUM
router.get('/premium-users', adminAuth, async (req, res) => {
    try {
        const premiumUsers = await User.find({ 
            isPremium: true 
        })
        .select('name email isPremium premiumExpiresAt createdAt')
        .sort({ premiumExpiresAt: -1 });
        
        res.json({
            success: true,
            count: premiumUsers.length,
            users: premiumUsers
        });
    } catch (error) {
        console.error('❌ Erreur listing premium:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur'
        });
    }
});

module.exports = router;