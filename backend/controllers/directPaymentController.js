const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const { sendAccessCodeEmail } = require('./paymentController');
const { 
  SUBSCRIPTION_PLANS, 
  DIRECT_PAYMENT_LINKS, 
  generateUniqueTransactionID,
  calculateExpiryDate 
} = require('../utils/paymentUtils');

// Initier un paiement avec lien direct KkiaPay
exports.initiateDirectPayment = async (req, res) => {
  try {
    console.log('=== DÉBUT PAIEMENT DIRECT KKiaPay ===');
    
    const { planKey } = req.body;
    const plan = SUBSCRIPTION_PLANS[planKey];
    
    if (!plan) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan d\'abonnement invalide' 
      });
    }

    const user = req.user;
    const transactionID = generateUniqueTransactionID();

    console.log('🎯 Création transaction paiement direct:', {
      user: user.email,
      plan: planKey,
      amount: plan.amount,
      duration: plan.duration,
      transactionId: transactionID
    });

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const hasActivePremium = user.hasActivePremium ? user.hasActivePremium() : 
                            (user.isPremium && user.premiumExpiresAt && new Date() < new Date(user.premiumExpiresAt));

    // Créer la transaction
    const transaction = new Transaction({
      userId: user._id,
      transactionId: transactionID,
      amount: plan.amount,
      durationInMonths: plan.duration,
      planId: planKey,
      status: 'pending',
      paymentGateway: 'kkiapay_direct',
      description: plan.description,
      kkiapayPaymentUrl: DIRECT_PAYMENT_LINKS[planKey]
    });

    await transaction.save();
    console.log('✅ Transaction directe créée:', transactionID);

    return res.status(200).json({
      success: true,
      message: "Lien de paiement direct généré",
      paymentUrl: DIRECT_PAYMENT_LINKS[planKey],
      transactionId: transactionID,
      amount: plan.amount,
      duration: plan.duration,
      description: plan.description,
      userHasActivePremium: hasActivePremium
    });

  } catch (error) {
    console.error('❌ Erreur initiateDirectPayment:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la génération du lien de paiement'
    });
  }
};

// Vérifier le statut d'une transaction directe
exports.checkDirectPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transaction = await Transaction.findOne({ 
      transactionId, 
      userId: req.user._id 
    });
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction non trouvée' 
      });
    }

    // Si la transaction est déjà complétée, retourner le code d'accès
    if (transaction.status === 'completed' && transaction.accessCode) {
      const user = await User.findById(transaction.userId);
      return res.status(200).json({
        success: true,
        status: 'completed',
        accessCode: transaction.accessCode,
        user: user,
        subscriptionEnd: user.premiumExpiresAt
      });
    }

    res.status(200).json({
      success: true,
      status: transaction.status,
      message: `Statut: ${transaction.status} - En attente de confirmation`
    });
    
  } catch (error) {
    console.error('Erreur checkDirectPaymentStatus:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
};

// Obtenir les informations d'abonnement de l'utilisateur
exports.getUserSubscriptionInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const subscriptionInfo = {
      isPremium: user.isPremium,
      premiumExpiresAt: user.premiumExpiresAt,
      hasActiveSubscription: user.hasActivePremium ? user.hasActivePremium() : 
                            (user.isPremium && user.premiumExpiresAt && new Date() < new Date(user.premiumExpiresAt)),
      timeLeft: user.premiumExpiresAt ? Math.max(0, new Date(user.premiumExpiresAt) - new Date()) : 0
    };

    res.status(200).json({
      success: true,
      subscription: subscriptionInfo
    });
    
  } catch (error) {
    console.error('Erreur getUserSubscriptionInfo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};