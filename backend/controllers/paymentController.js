const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const Transaction = require('../models/Transaction');
const generateCode = require('../utils/generateCode');
const { sendAccessCodeEmail } = require('./emailController');
const kkiapay = require('../config/kkiapay');
const crypto = require('crypto');

// Configuration des plans d'abonnement
const SUBSCRIPTION_PLANS = {
  '1-month': { 
    amount: 5000, 
    description: "Abonnement Premium 1 mois", 
    duration: 1,
    name: "1 Mois Premium"
  }, 
  '3-months': { 
    amount: 12000, 
    description: "Abonnement Premium 3 mois", 
    duration: 3,
    name: "3 Mois Premium"
  },
  '10-months': { 
    amount: 25000, 
    description: "Abonnement Premium 10 mois", 
    duration: 10,
    name: "10 Mois Premium"
  }
};

// Fonction utilitaire pour ajouter des mois
const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

// Générer un ID de transaction unique
const generateUniqueTransactionID = () => {
  return 'TXN_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex');
};

// 🎯 FONCTION PRINCIPALE : CRÉER UN PAIEMENT
exports.createPayment = async (req, res) => {
  try {
    console.log('=== 🚀 CRÉATION PAIEMENT PROFESSIONNEL ===');
    
    const { planId, amount } = req.body;
    const user = req.user;
    
    // Validation des données
    if (!planId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Données de paiement incomplètes'
      });
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan || plan.amount !== parseInt(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Plan d\'abonnement invalide'
      });
    }

    console.log(`📊 Création paiement pour ${user.email}: ${plan.name}`);

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const hasActiveSubscription = user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date();
    
    if (hasActiveSubscription) {
      console.log(`ℹ Utilisateur ${user.email} a déjà un abonnement actif`);
    }

    // ✅ CRÉATION DE LA TRANSACTION
    const transactionId = generateUniqueTransactionID();
    const transaction = new Transaction({
      userId: user._id,
      transactionId: transactionId,
      amount: plan.amount,
      durationInMonths: plan.duration,
      planId: planId,
      status: 'pending',
      paymentGateway: 'kkiapay',
      description: plan.description,
      userEmail: user.email,
      userName: user.name
    });

    await transaction.save();
    console.log(`✅ Transaction créée: ${transactionId}`);

    // ✅ CONSTRUCTION DE L'URL KKiaPay AVEC MÉTADONNÉES
    const callbackUrl = `${process.env.FRONTEND_URL}/payment-callback.html?transactionId=${transactionId}`;
    
    const metadata = {
      transaction_id: transactionId,
      user_id: user._id.toString(),
      user_email: user.email,
      plan_id: planId,
      plan_duration: plan.duration,
      amount: plan.amount
    };

    const paymentParams = new URLSearchParams({
      amount: plan.amount,
      apikey: process.env.KKIAPAY_PUBLIC_KEY,
      phone: user.phone || process.env.STORE_PHONE,
      email: user.email,
      callback: callbackUrl,
      data: JSON.stringify(metadata),
      theme: '#13a718',
      name: 'Quiz de Carabin',
      sandbox: 'false'
    });

    const paymentUrl = `https://kkiapay.me/pay?${paymentParams.toString()}`;

    console.log('🔗 URL de paiement générée avec succès');
    console.log('📞 Callback URL:', callbackUrl);
    console.log('📦 Metadata:', metadata);

    res.status(200).json({
      success: true,
      message: "Lien de paiement généré avec succès",
      paymentUrl: paymentUrl,
      transactionId: transactionId,
      amount: plan.amount,
      duration: plan.duration,
      description: plan.description,
      userHasActiveSubscription: hasActiveSubscription
    });

  } catch (error) {
    console.error('❌ Erreur création paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du paiement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🎯 FONCTION : ACTIVATION ABONNEMENT PREMIUM
exports.activatePremiumSubscription = async (transaction) => {
  try {
    console.log(`=== 🎯 ACTIVATION ABONNEMENT ===`);
    console.log(`Transaction: ${transaction.transactionId}`);
    console.log(`Utilisateur: ${transaction.userEmail}`);
    console.log(`Durée: ${transaction.durationInMonths} mois`);

    // Générer le code d'accès
    const accessCode = generateCode();
    
    // Calculer les dates d'abonnement
    const subscriptionStart = new Date();
    const subscriptionEnd = addMonths(subscriptionStart, transaction.durationInMonths);

    // Mettre à jour la transaction
    transaction.status = 'completed';
    transaction.accessCode = accessCode;
    transaction.subscriptionStart = subscriptionStart;
    transaction.subscriptionEnd = subscriptionEnd;
    transaction.processedAt = new Date();

    // Récupérer l'utilisateur
    const user = await User.findById(transaction.userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    console.log(`👤 Utilisateur trouvé: ${user.email}`);

    // ✅ GESTION INTELLIGENTE DE L'ABONNEMENT
    let newExpiryDate;
    
    if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()) {
      // Extension d'abonnement existant
      const currentExpiry = new Date(user.premiumExpiresAt);
      newExpiryDate = addMonths(currentExpiry, transaction.durationInMonths);
      console.log(`📅 Extension abonnement existant jusqu'au: ${newExpiryDate}`);
    } else {
      // Nouvel abonnement
      newExpiryDate = subscriptionEnd;
      console.log(`🆕 Nouvel abonnement jusqu'au: ${newExpiryDate}`);
    }

    // Mettre à jour l'utilisateur
    user.isPremium = true;
    user.premiumExpiresAt = newExpiryDate;
    user.lastSubscriptionUpdate = new Date();
    
    await user.save();
    console.log(`✅ Utilisateur mis à jour - Premium: ${user.isPremium}`);

    // ✅ CRÉATION DU CODE D'ACCÈS
    const accessCodeRecord = new AccessCode({
      code: accessCode,
      email: user.email,
      userId: user._id,
      transactionId: transaction.transactionId,
      expiresAt: addMonths(new Date(), transaction.durationInMonths),
      durationMonths: transaction.durationInMonths
    });

    await accessCodeRecord.save();
    console.log(`🔐 Code d'accès créé: ${accessCode}`);

    // ✅ ENVOI DE L'EMAIL DE CONFIRMATION
    console.log(`📧 Envoi email à ${user.email}...`);
    const emailSent = await sendAccessCodeEmail(
      user.email, 
      accessCode, 
      user.name, 
      transaction.durationInMonths,
      newExpiryDate
    );

    if (emailSent) {
      console.log(`✅ Email envoyé avec succès à ${user.email}`);
    } else {
      console.error(`❌ Échec envoi email à ${user.email}`);
      // Ne pas bloquer le processus pour une erreur d'email
    }

    // ✅ SAUVEGARDE FINALE DE LA TRANSACTION
    await transaction.save();
    console.log(`💾 Transaction sauvegardée: ${transaction.transactionId}`);

    console.log(`🎉 ABONNEMENT ACTIVÉ AVEC SUCCÈS !`);
    console.log(`   👤 Utilisateur: ${user.email}`);
    console.log(`   🔐 Code: ${accessCode}`);
    console.log(`   📅 Durée: ${transaction.durationInMonths} mois`);
    console.log(`   🗓  Expire le: ${newExpiryDate.toLocaleDateString('fr-FR')}`);

    return true;

  } catch (error) {
    console.error('❌ Erreur activation abonnement:', error);
    
    // Tentative de marquer la transaction comme échouée
    try {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      await transaction.save();
    } catch (saveError) {
      console.error('❌ Impossible de sauvegarder erreur transaction:', saveError);
    }
    
    return false;
  }
};

// 🎯 FONCTION : VÉRIFICATION STATUT PAIEMENT
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    console.log(`=== 🔍 VÉRIFICATION STATUT PAIEMENT ===`);
    console.log(`Transaction: ${transactionId}`);

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'ID de transaction manquant'
      });
    }

    // Rechercher la transaction
    const transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      console.log(`❌ Transaction non trouvée: ${transactionId}`);
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée dans notre système'
      });
    }

    console.log(`✅ Transaction trouvée - Statut: ${transaction.status}`);

    // Si la transaction est complétée
    if (transaction.status === 'completed') {
      const user = await User.findById(transaction.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      return res.status(200).json({
        success: true,
        status: 'completed',
        accessCode: transaction.accessCode,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isPremium: user.isPremium,
          premiumExpiresAt: user.premiumExpiresAt
        },
        subscriptionEnd: user.premiumExpiresAt,
        message: 'Paiement confirmé et abonnement activé'
      });
    }

    // Si la transaction est en attente
    if (transaction.status === 'pending') {
      return res.status(200).json({
        success: true,
        status: 'pending',
        message: 'Paiement en cours de traitement. Vous recevrez un email de confirmation sous peu.'
      });
    }

    // Si la transaction a échoué
    if (transaction.status === 'failed') {
      return res.status(200).json({
        success: false,
        status: 'failed',
        message: 'Le paiement a échoué. Veuillez réessayer.'
      });
    }

    // Statut inconnu
    return res.status(200).json({
      success: true,
      status: transaction.status,
      message: `Statut: ${transaction.status}`
    });

  } catch (error) {
    console.error('❌ Erreur vérification statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du paiement'
    });
  }
};

// 🎯 FONCTION : WEBHOOK KKiaPay
exports.handleKkiapayWebhook = async (req, res) => {
  try {
    console.log('=== 📨 WEBHOOK KKiaPay REÇU ===');
    
    const { transactionId, status, data } = req.body;
    
    console.log('📞 ID KkiaPay:', transactionId);
    console.log('📊 Statut:', status);
    console.log('📦 Données:', data);

    // Répondre immédiatement à KkiaPay
    res.status(200).send('Webhook reçu');

    // Traitement asynchrone
    if (status === 'SUCCESS') {
      try {
        // Parser les metadata
        let metadata = {};
        try {
          metadata = typeof data === 'string' ? JSON.parse(data) : data;
        } catch (parseError) {
          console.error('❌ Erreur parsing metadata:', parseError);
          return;
        }

        const ourTransactionId = metadata.transaction_id;
        
        if (!ourTransactionId) {
          console.error('❌ Transaction ID manquant dans les metadata');
          return;
        }

        console.log(`🔍 Recherche transaction: ${ourTransactionId}`);

        // Rechercher la transaction
        const transaction = await Transaction.findOne({ 
          transactionId: ourTransactionId 
        });

        if (!transaction) {
          console.error(`❌ Transaction non trouvée: ${ourTransactionId}`);
          return;
        }

        // Vérifier si déjà traitée
        if (transaction.status === 'completed') {
          console.log(`ℹ Transaction déjà traitée: ${ourTransactionId}`);
          return;
        }

        // Mettre à jour avec l'ID KkiaPay
        transaction.kkiapayTransactionId = transactionId;
        transaction.webhookReceivedAt = new Date();

        // Activer l'abonnement
        const activationSuccess = await exports.activatePremiumSubscription(transaction);
        
        if (activationSuccess) {
          console.log(`✅ Webhook traité avec succès: ${ourTransactionId}`);
        } else {
          console.error(`❌ Échec activation: ${ourTransactionId}`);
        }

      } catch (processingError) {
        console.error('❌ Erreur traitement webhook:', processingError);
      }
    } else {
      console.log(`ℹ Webhook ignoré - Statut: ${status}`);
    }

  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    // Toujours répondre 200 pour éviter les retries
    res.status(200).send('Webhook reçu');
  }
};

// 🎯 FONCTION : RENVOYER LE CODE D'ACCÈS
exports.resendAccessCode = async (req, res) => {
  try {
    const user = req.user;
    
    console.log(`=== 🔄 RENVOI CODE D'ACCÈS ===`);
    console.log(`Utilisateur: ${user.email}`);

    // Trouver la dernière transaction complétée
    const transaction = await Transaction.findOne({
      userId: user._id,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès trouvé"
      });
    }

    console.log(`📧 Renvoi code: ${transaction.accessCode} à ${user.email}`);

    // Envoyer l'email
    const emailSent = await sendAccessCodeEmail(
      user.email,
      transaction.accessCode,
      user.name,
      transaction.durationInMonths,
      user.premiumExpiresAt
    );

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: "Code d'accès renvoyé avec succès à votre email"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'envoi de l'email"
      });
    }

  } catch (error) {
    console.error('❌ Erreur renvoi code:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du renvoi du code"
    });
  }
};

// 🎯 FONCTION : INFORMATIONS ABONNEMENT
exports.getSubscriptionInfo = async (req, res) => {
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
      hasActiveSubscription: user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date(),
      daysRemaining: user.premiumExpiresAt ? 
        Math.ceil((new Date(user.premiumExpiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : 0
    };

    res.status(200).json({
      success: true,
      subscription: subscriptionInfo
    });

  } catch (error) {
    console.error('❌ Erreur informations abonnement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des informations'
    });
  }
};