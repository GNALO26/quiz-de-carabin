const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const transporter = require('../config/email');
const kkiapay = require('../config/kkiapay');

// Configuration des plans d'abonnement
const SUBSCRIPTION_PLANS = {
  '1-month': { amount: 5000, description: "Abonnement Premium 1 mois", duration: 1 }, 
  '3-months': { amount: 12000, description: "Abonnement Premium 3 mois", duration: 3 },
  '10-months': { amount: 25000, description: "Abonnement Premium 10 mois", duration: 10 }
};

// Configuration pour les liens directs KkiaPay
const DIRECT_PAYMENT_LINKS = {
  '1-month': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-test)-Nspyd2qLE',
  '3-months': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-12k)-glrVnSRX7',
  '10-months': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-25k)-g1Zc3Pma-'
};

// ✅ FONCTION UTILITAIRE POUR AJOUTER DES MOIS
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// ✅ GÉNÉRATION D'ID DE TRANSACTION UNIQUE
const generateUniqueTransactionID = () => {
  return 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
};

// ✅ ENVOI D'EMAIL AVEC CODE D'ACCÈS
const sendAccessCodeEmail = async (email, accessCode, userName = 'Utilisateur', durationMonths = 1) => {
  try {
    console.log(`[EMAIL] 📧 Envoi code d'accès ${accessCode} à ${email}`);
    
    const expiryDate = addMonths(new Date(), durationMonths);
    const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const mailOptions = {
      from: `"Quiz de Carabin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Votre code d'accès Premium - Quiz de Carabin`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
          <div style="background: #13a718; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">🩺 Quiz de Carabin</h1>
            <p style="margin: 10px 0 0; font-size: 16px;">Plateforme de révision médicale</p>
          </div>
          
          <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #13a718; margin-top: 0;">Félicitations ${userName}! 🎉</h2>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Votre abonnement <strong>Premium ${durationMonths} mois</strong> a été activé avec succès.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 30px 0; border-left: 4px solid #13a718;">
              <p style="margin: 0 0 10px; color: #666; font-size: 14px;">Votre code d'accès unique :</p>
              <div style="text-align: center; margin: 20px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #13a718; background: white; padding: 15px 30px; border-radius: 8px; display: inline-block; border: 2px dashed #13a718;">
                  ${accessCode}
                </span>
              </div>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px; text-align: center;">
                <strong>Date d'expiration : ${formattedDate}</strong>
              </p>
            </div>
            
            <div style="background: #e7f5ff; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0; color: #0066cc; font-size: 14px;">
                ℹ <strong>Votre compte est déjà activé !</strong> Ce code peut être utilisé sur la page de validation si nécessaire.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/quiz.html" style="display: inline-block; background: #13a718; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Commencer les quiz →
              </a>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              <p style="margin: 10px 0;">Merci pour votre confiance ! 🙏</p>
              <p style="margin: 10px 0;"><strong>L'équipe Quiz de Carabin</strong></p>
              <p style="margin: 10px 0; font-size: 12px; color: #999;">
                Si vous n'avez pas effectué cette demande, veuillez ignorer cet email ou nous contacter.
              </p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Email envoyé avec succès. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] ❌ Erreur envoi email à ${email}:`, error.message);
    return false;
  }
};

exports.sendAccessCodeEmail = sendAccessCodeEmail;

// ✅ ACTIVATION ABONNEMENT PREMIUM
exports.activatePremiumSubscription = async (transaction) => {
  try {
    console.log(`🎯 [ACTIVATION] Début pour transaction: ${transaction.transactionId}`);
    
    // Générer le code d'accès
    const accessCode = generateCode();
    console.log(`🔑 [ACTIVATION] Code généré: ${accessCode}`);
    
    // Mettre à jour la transaction
    transaction.status = 'completed';
    transaction.accessCode = accessCode;
    transaction.subscriptionStart = new Date();
    transaction.subscriptionEnd = addMonths(new Date(), transaction.durationInMonths);
    
    const user = await User.findById(transaction.userId);
    
    if (!user) {
      console.error('❌ [ACTIVATION] Utilisateur non trouvé');
      return false;
    }

    console.log(`👤 [ACTIVATION] Utilisateur: ${user.email}`);

    // Créer le code d'accès dans la collection AccessCode
    const newAccessCode = new AccessCode({
      code: accessCode,
      email: user.email,
      userId: user._id,
      expiresAt: addMonths(new Date(), transaction.durationInMonths)
    });
    await newAccessCode.save();
    console.log(`💾 [ACTIVATION] Code sauvegardé dans AccessCode`);

    // ✅ GESTION INTELLIGENTE : Étendre ou créer l'abonnement
    let newExpiryDate;
    
    if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()) {
      // Abonnement actif : on étend
      newExpiryDate = addMonths(new Date(user.premiumExpiresAt), transaction.durationInMonths);
      console.log(`📅 [ACTIVATION] Extension d'abonnement existant`);
    } else {
      // Nouvel abonnement
      newExpiryDate = addMonths(new Date(), transaction.durationInMonths);
      console.log(`🆕 [ACTIVATION] Nouvel abonnement`);
    }
    
    // Mettre à jour l'utilisateur
    user.isPremium = true;
    user.premiumExpiresAt = newExpiryDate;
    await user.save();
    console.log(`✅ [ACTIVATION] Utilisateur mis à jour - Premium jusqu'au ${newExpiryDate}`);
    
    // Envoyer l'email
    const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name, transaction.durationInMonths);
    
    if (!emailSent) {
      console.warn(`⚠ [ACTIVATION] Email non envoyé mais abonnement activé`);
    }
    
    // Sauvegarder la transaction
    await transaction.save();
    console.log(`💾 [ACTIVATION] Transaction sauvegardée`);
    
    console.log(`🎉 [ACTIVATION] SUCCÈS pour ${user.email}`);
    return true;
    
  } catch (error) {
    console.error('❌ [ACTIVATION] Erreur:', error.message);
    return false;
  }
};

// ✅ WEBHOOK KKIAPAY - VERSION CORRIGÉE
exports.handleKkiapayWebhook = async (req, res) => {
  try {
    console.log('\n=== 🔔 WEBHOOK KKIAPAY REÇU ===');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    console.log('🔐 Signature:', req.headers['x-kkiapay-signature']);
    
    const { transactionId, status, metadata } = req.body;
    
    if (!transactionId) {
      console.error('❌ [WEBHOOK] transactionId manquant');
      return res.status(400).json({ error: 'transactionId manquant' });
    }

    console.log(`🔍 [WEBHOOK] Transaction: ${transactionId}, Statut: ${status}`);

    // ✅ RECHERCHE MULTI-STRATÉGIE
    let transaction = null;
    
    // Stratégie 1: Par kkiapayTransactionId
    transaction = await Transaction.findOne({ kkiapayTransactionId: transactionId });
    if (transaction) console.log('✅ [WEBHOOK] Trouvé par kkiapayTransactionId');
    
    // Stratégie 2: Par metadata.transaction_id
    if (!transaction && metadata?.transaction_id) {
      transaction = await Transaction.findOne({ transactionId: metadata.transaction_id });
      if (transaction) console.log('✅ [WEBHOOK] Trouvé par metadata.transaction_id');
    }
    
    // Stratégie 3: Par transactionId direct
    if (!transaction) {
      transaction = await Transaction.findOne({ transactionId: transactionId });
      if (transaction) console.log('✅ [WEBHOOK] Trouvé par transactionId direct');
    }

    if (!transaction) {
      console.error(`❌ [WEBHOOK] Transaction non trouvée: ${transactionId}`);
      
      // Logs de diagnostic
      const recentTransactions = await Transaction.find({})
        .select('transactionId kkiapayTransactionId status createdAt')
        .sort({ createdAt: -1 })
        .limit(5);
      console.log('📋 [WEBHOOK] Dernières transactions:', recentTransactions);
      
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }

    console.log(`📦 [WEBHOOK] Transaction trouvée: ${transaction.transactionId}`);
    console.log(`📊 [WEBHOOK] Statut actuel: ${transaction.status}`);

    // Traiter uniquement si SUCCESS et pas déjà completed
    if (status === 'SUCCESS' && transaction.status !== 'completed') {
      console.log('🎉 [WEBHOOK] Paiement réussi, activation...');
      
      // Mettre à jour l'ID KkiaPay
      transaction.kkiapayTransactionId = transactionId;
      await transaction.save();
      
      // Activer l'abonnement
      const activationSuccess = await exports.activatePremiumSubscription(transaction);
      
      if (activationSuccess) {
        console.log(`✅ [WEBHOOK] Abonnement activé avec succès`);
        return res.status(200).json({ 
          success: true, 
          message: 'Webhook traité - Abonnement activé' 
        });
      } else {
        console.error(`❌ [WEBHOOK] Échec activation`);
        return res.status(500).json({ 
          error: 'Erreur activation abonnement' 
        });
      }
      
    } else if (status === 'FAILED') {
      transaction.status = 'failed';
      await transaction.save();
      console.log(`❌ [WEBHOOK] Paiement échoué`);
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook traité - Paiement échoué' 
      });
      
    } else {
      console.log(`ℹ [WEBHOOK] Statut ${status} ignoré (déjà ${transaction.status})`);
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook traité - Statut ignoré' 
      });
    }

  } catch (error) {
    console.error('❌ [WEBHOOK] ERREUR:', error.message);
    // Toujours répondre 200 pour éviter les retries
    res.status(200).json({ 
      success: false, 
      error: 'Erreur traitement webhook' 
    });
  }
};

// ✅ TRAITEMENT RETOUR DE PAIEMENT
exports.processPaymentReturn = async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    console.log(`\n=== 🔄 RETOUR PAIEMENT ===`);
    console.log(`🔍 Transaction ID: ${transactionId}`);
    
    // Recherche multi-stratégie
    let transaction = await Transaction.findOne({ transactionId });
    
    if (!transaction) {
      transaction = await Transaction.findOne({ kkiapayTransactionId: transactionId });
    }

    if (!transaction) {
      console.error(`❌ [RETOUR] Transaction non trouvée: ${transactionId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Transaction non trouvée' 
      });
    }
    
    console.log(`📦 [RETOUR] Transaction trouvée - Statut: ${transaction.status}`);

    // Si déjà complétée, retourner les infos
    if (transaction.status === 'completed') {
      const user = await User.findById(transaction.userId);
      return res.status(200).json({
        success: true,
        status: 'completed',
        accessCode: transaction.accessCode,
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          isPremium: user.isPremium,
          premiumExpiresAt: user.premiumExpiresAt
        },
        subscriptionEnd: user.premiumExpiresAt,
        message: "Paiement déjà traité et code disponible"
      });
    }
    
    // Vérifier manuellement avec KkiaPay
    console.log(`🔍 [RETOUR] Vérification manuelle chez KkiaPay...`);
    
    try {
      const kkiapayStatus = await kkiapay.verifyTransaction(
        transaction.kkiapayTransactionId || transactionId
      );
      
      console.log(`📨 [RETOUR] Réponse KkiaPay:`, kkiapayStatus);
      
      if (kkiapayStatus.status === 'SUCCESS') {
        console.log(`✅ [RETOUR] Paiement confirmé, activation manuelle...`);
        
        transaction.kkiapayTransactionId = transactionId;
        await transaction.save();
        
        const activationSuccess = await exports.activatePremiumSubscription(transaction);
        
        if (activationSuccess) {
          const user = await User.findById(transaction.userId);
          return res.status(200).json({
            success: true,
            status: 'completed',
            accessCode: transaction.accessCode,
            user: {
              _id: user._id,
              email: user.email,
              name: user.name,
              isPremium: user.isPremium,
              premiumExpiresAt: user.premiumExpiresAt
            },
            subscriptionEnd: user.premiumExpiresAt,
            message: "Paiement confirmé manuellement"
          });
        }
      }
    } catch (kkiapayError) {
      console.log(`ℹ [RETOUR] Impossible de vérifier avec KkiaPay:`, kkiapayError.message);
    }
    
    // Paiement toujours en attente
    console.log(`⏳ [RETOUR] Paiement en attente de confirmation`);
    
    return res.status(200).json({
      success: true,
      status: 'pending',
      message: "Paiement en attente de confirmation. Vous recevrez un email dès validation."
    });
    
  } catch (error) {
    console.error(`❌ [RETOUR] Erreur:`, error.message);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: error.message
    });
  }
};

// ✅ INITIATION PAIEMENT DIRECT
exports.initiateDirectPayment = async (req, res) => {
  try {
    console.log('\n=== 💳 PAIEMENT DIRECT ===');
    console.log('📦 Body:', req.body);
    console.log('👤 User:', req.user?.email);
    
    const { planKey } = req.body;
    
    if (!planKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan key manquant' 
      });
    }

    const plan = SUBSCRIPTION_PLANS[planKey];
    
    if (!plan) {
      return res.status(400).json({ 
        success: false, 
        message: `Plan invalide: ${planKey}` 
      });
    }

    const user = req.user;
    const transactionID = generateUniqueTransactionID();

    console.log('🎯 Création transaction:', {
      user: user.email,
      plan: planKey,
      amount: plan.amount,
      duration: plan.duration,
      transactionId: transactionID
    });

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
    console.log('✅ Transaction créée:', transactionID);

    return res.status(200).json({
      success: true,
      message: "Lien de paiement direct généré",
      paymentUrl: DIRECT_PAYMENT_LINKS[planKey],
      transactionId: transactionID,
      amount: plan.amount,
      duration: plan.duration,
      description: plan.description
    });

  } catch (error) {
    console.error('❌ Erreur paiement direct:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur génération lien de paiement' 
    });
  }
};

// ✅ INITIATION PAIEMENT WIDGET
exports.initiatePayment = async (req, res) => {
  try {
    console.log('\n=== 💳 PAIEMENT WIDGET ===');
    
    const { planId, amount } = req.body;
    const plan = SUBSCRIPTION_PLANS[planId];
    
    if (!plan || plan.amount !== parseInt(amount)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Plan ou montant invalide' 
      });
    }

    const user = req.user;
    const transactionID = generateUniqueTransactionID();

    console.log('🎯 Préparation transaction widget:', {
      user: user.email,
      plan: planId,
      amount: plan.amount,
      transactionId: transactionID
    });

    // Créer la transaction
    const transaction = new Transaction({
      userId: req.user._id,
      transactionId: transactionID,
      amount: plan.amount,
      durationInMonths: plan.duration,
      planId: planId,
      status: 'pending',
      paymentGateway: 'kkiapay_widget',
      description: plan.description
    });

    await transaction.save();
    console.log('✅ Transaction widget créée:', transactionID);

    return res.status(200).json({
      success: true,
      message: "Transaction créée. Ouvrez le widget de paiement.",
      transactionId: transactionID,
      widgetConfig: {
        amount: plan.amount,
        key: process.env.KKIAPAY_PUBLIC_KEY,
        callback: `${process.env.FRONTEND_URL}/payment-callback.html?transactionId=${transactionID}`,
        sandbox: false
      }
    });

  } catch (error) {
    console.error('❌ Erreur paiement widget:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur préparation du paiement' 
    });
  }
};

// ✅ INFORMATIONS ABONNEMENT UTILISATEUR
exports.getUserSubscriptionInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const hasActiveSubscription = user.premiumExpiresAt && new Date() < new Date(user.premiumExpiresAt);

    res.status(200).json({
      success: true,
      subscription: {
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt,
        hasActiveSubscription: hasActiveSubscription,
        daysLeft: hasActiveSubscription 
          ? Math.ceil((new Date(user.premiumExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
          : 0
      }
    });
    
  } catch (error) {
    console.error('Erreur info abonnement:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};