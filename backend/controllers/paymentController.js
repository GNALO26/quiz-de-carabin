const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const transporter = require('../config/email');
const kkiapay = require('../config/kkiapay');

// Configuration des plans d'abonnement
const SUBSCRIPTION_PLANS = {
  '1-month': { amount: 100, description: "Abonnement Premium 1 mois", duration: 1 }, 
  '3-months': { amount: 12000, description: "Abonnement Premium 3 mois", duration: 3 },
  '10-months': { amount: 25000, description: "Abonnement Premium 10 mois", duration: 10 }
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
    console.log(`\n📧 [EMAIL] ========================================`);
    console.log(`📧 [EMAIL] Tentative envoi à: ${email}`);
    console.log(`📧 [EMAIL] Code: ${accessCode}`);
    console.log(`📧 [EMAIL] Durée: ${durationMonths} mois`);
    
    const expiryDate = addMonths(new Date(), durationMonths);
    const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const mailOptions = {
      from: {
        name: 'Quiz de Carabin',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: `✅ Votre code d'accès Premium - Quiz de Carabin`,
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
            </div>
          </div>
        </div>
      `
    };
    
    console.log(`📧 [EMAIL] Envoi en cours...`);
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ [EMAIL] Email envoyé avec succès !`);
    console.log(`✅ [EMAIL] Message ID: ${info.messageId}`);
    console.log(`✅ [EMAIL] ========================================\n`);
    
    return true;
  } catch (error) {
    console.error(`\n❌ [EMAIL] ========================================`);
    console.error(`❌ [EMAIL] ERREUR: ${error.message}`);
    console.error(`❌ [EMAIL] ========================================\n`);
    return false;
  }
};

exports.sendAccessCodeEmail = sendAccessCodeEmail;

// ✅ ACTIVATION ABONNEMENT PREMIUM
exports.activatePremiumSubscription = async (transaction) => {
  try {
    console.log(`\n🎯 [ACTIVATION] ========================================`);
    console.log(`🎯 [ACTIVATION] Transaction: ${transaction.transactionId}`);
    
    const accessCode = await generateCode();
    console.log(`🔑 [ACTIVATION] Code généré: ${accessCode}`);
    
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

    const newAccessCode = new AccessCode({
      code: accessCode,
      email: user.email,
      userId: user._id,
      expiresAt: addMonths(new Date(), transaction.durationInMonths)
    });
    await newAccessCode.save();
    console.log(`💾 [ACTIVATION] Code sauvegardé`);

    let newExpiryDate;
    if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()) {
      newExpiryDate = addMonths(new Date(user.premiumExpiresAt), transaction.durationInMonths);
      console.log(`📅 [ACTIVATION] Extension d'abonnement`);
    } else {
      newExpiryDate = addMonths(new Date(), transaction.durationInMonths);
      console.log(`🆕 [ACTIVATION] Nouvel abonnement`);
    }
    
    user.isPremium = true;
    user.premiumExpiresAt = newExpiryDate;
    await user.save();
    console.log(`✅ [ACTIVATION] Utilisateur mis à jour`);
    
    console.log(`📧 [ACTIVATION] Envoi email...`);
    const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name, transaction.durationInMonths);
    
    if (!emailSent) {
      console.warn(`⚠ [ACTIVATION] Email non envoyé mais abonnement activé`);
    }
    
    await transaction.save();
    console.log(`💾 [ACTIVATION] Transaction sauvegardée`);
    console.log(`🎉 [ACTIVATION] SUCCÈS`);
    console.log(`🎉 [ACTIVATION] ========================================\n`);
    
    return true;
  } catch (error) {
    console.error(`\n❌ [ACTIVATION] ERREUR:`, error.message);
    return false;
  }
};

// ✅ WEBHOOK KKIAPAY - GÈRE LES PAIEMENTS SANS TRANSACTION PRÉALABLE
exports.handleKkiapayWebhook = async (req, res) => {
  try {
    console.log('\n=== 🔔 WEBHOOK KKIAPAY ===');
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    
    const { transactionId, isPaymentSucces, amount } = req.body;
    
    if (!transactionId) {
      console.error('❌ [WEBHOOK] transactionId manquant');
      return res.status(200).json({ received: true });
    }

    console.log(`🔍 [WEBHOOK] KkiaPay Transaction: ${transactionId}`);
    console.log(`💰 [WEBHOOK] Montant: ${amount} FCFA`);
    console.log(`✅ [WEBHOOK] Succès: ${isPaymentSucces}`);

    // ✅ RECHERCHE TRANSACTION
    let transaction = await Transaction.findOne({ 
      kkiapayTransactionId: transactionId 
    });

    if (!transaction) {
      console.log('⚠ [WEBHOOK] Transaction non trouvée, création automatique...');
      
      // Déterminer le plan depuis le montant
      let planId = '1-month';
      let durationInMonths = 1;
      
      if (amount >= 25000) {
        planId = '10-months';
        durationInMonths = 10;
      } else if (amount >= 12000) {
        planId = '3-months';
        durationInMonths = 3;
      } else {
        planId = '1-month';
        durationInMonths = 1;
      }
      
      console.log(`📊 [WEBHOOK] Plan détecté: ${planId}`);
      
      // Trouver le dernier utilisateur créé (temporaire)
      const lastUser = await User.findOne().sort({ createdAt: -1 });
      
      if (!lastUser) {
        console.error('❌ [WEBHOOK] Aucun utilisateur trouvé');
        return res.status(200).json({ received: true });
      }
      
      console.log(`👤 [WEBHOOK] Utilisateur: ${lastUser.email}`);
      
      // Créer la transaction
      transaction = new Transaction({
        userId: lastUser._id,
        transactionId: `TXN_WEBHOOK_${Date.now()}`,
        kkiapayTransactionId: transactionId,
        amount: amount,
        durationInMonths: durationInMonths,
        planId: planId,
        status: 'pending',
        paymentGateway: 'kkiapay_webhook',
        description: `Paiement webhook - ${planId}`
      });
      
      await transaction.save();
      console.log(`✅ [WEBHOOK] Transaction créée: ${transaction.transactionId}`);
    }

    // Traiter si succès et pas déjà complété
    if (isPaymentSucces && transaction.status !== 'completed') {
      console.log('🎉 [WEBHOOK] Activation...');
      
      const activationSuccess = await exports.activatePremiumSubscription(transaction);
      
      if (activationSuccess) {
        console.log(`✅ [WEBHOOK] Abonnement activé`);
        return res.status(200).json({ 
          success: true, 
          message: 'Abonnement activé' 
        });
      }
    }
    
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ [WEBHOOK] ERREUR:', error.message);
    res.status(200).json({ received: true });
  }
};

// ✅ TRAITEMENT RETOUR - GÈRE L'ID KKIAPAY
// ✅ TRAITEMENT RETOUR - VERSION AMÉLIORÉE
exports.processPaymentReturn = async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    console.log(`\n=== 🔄 RETOUR PAIEMENT ===`);
    console.log(`🔍 ID reçu: ${transactionId}`);
    console.log(`👤 Utilisateur: ${req.user?.email || 'non connecté'}`);
    
    // ✅ STRATÉGIE 1: Chercher par ID KkiaPay
    let transaction = await Transaction.findOne({ 
      kkiapayTransactionId: transactionId 
    });
    
    if (transaction) {
      console.log(`✅ [RETOUR] Transaction trouvée par kkiapayTransactionId`);
    }
    
    // ✅ STRATÉGIE 2: Chercher par ID interne
    if (!transaction) {
      transaction = await Transaction.findOne({ 
        transactionId: transactionId 
      });
      
      if (transaction) {
        console.log(`✅ [RETOUR] Transaction trouvée par transactionId`);
      }
    }
    
    // ✅ STRATÉGIE 3: Chercher par utilisateur + pending récent (dernière tentative)
    if (!transaction && req.user) {
      transaction = await Transaction.findOne({
        userId: req.user._id,
        status: 'pending'
      }).sort({ createdAt: -1 });
      
      if (transaction) {
        console.log(`✅ [RETOUR] Transaction pending trouvée pour l'utilisateur`);
        // Lier l'ID KkiaPay
        transaction.kkiapayTransactionId = transactionId;
        await transaction.save();
      }
    }

    // ✅ SI TOUJOURS PAS TROUVÉ : VÉRIFIER CHEZ KKIAPAY ET CRÉER
    if (!transaction) {
      console.log(`⚠ [RETOUR] Transaction non trouvée, vérification KkiaPay...`);
      
      try {
        const kkiapayStatus = await kkiapay.verifyTransaction(transactionId);
        console.log(`📨 [RETOUR] KkiaPay:`, kkiapayStatus);
        
        if (kkiapayStatus.status === 'SUCCESS') {
          console.log(`✅ [RETOUR] Paiement confirmé par KkiaPay, création transaction...`);
          
          // Déterminer le plan depuis le montant
          const amount = kkiapayStatus.amount || 200;
          let planId = '1-month';
          let durationInMonths = 1;
          
          if (amount >= 25000) {
            planId = '10-months';
            durationInMonths = 10;
          } else if (amount >= 12000) {
            planId = '3-months';
            durationInMonths = 3;
          } else if (amount >= 200) {
            planId = '1-month';
            durationInMonths = 1;
          }
          
          console.log(`📊 [RETOUR] Plan: ${planId} (${amount} FCFA)`);
          
          // Utiliser l'utilisateur connecté OU le dernier créé
          let userId = req.user?._id;
          let userEmail = req.user?.email;
          
          if (!userId) {
            console.log(`⚠ [RETOUR] Pas d'utilisateur connecté, recherche du dernier...`);
            const lastUser = await User.findOne().sort({ createdAt: -1 });
            if (lastUser) {
              userId = lastUser._id;
              userEmail = lastUser.email;
              console.log(`✅ [RETOUR] Utilisateur trouvé: ${userEmail}`);
            }
          }
          
          if (!userId) {
            console.error(`❌ [RETOUR] Aucun utilisateur trouvé`);
            return res.status(404).json({ 
              success: false, 
              message: 'Utilisateur non trouvé pour ce paiement' 
            });
          }
          
          // Créer la transaction
          transaction = new Transaction({
            userId: userId,
            transactionId: `TXN_RETURN_${Date.now()}`,
            kkiapayTransactionId: transactionId,
            amount: amount,
            durationInMonths: durationInMonths,
            planId: planId,
            status: 'pending',
            paymentGateway: 'kkiapay_return',
            description: `Paiement retour - ${planId}`
          });
          
          await transaction.save();
          console.log(`✅ [RETOUR] Transaction créée: ${transaction.transactionId}`);
          
        } else {
          console.log(`❌ [RETOUR] Paiement non réussi chez KkiaPay: ${kkiapayStatus.status}`);
          return res.status(404).json({ 
            success: false, 
            message: 'Paiement non confirmé par KkiaPay' 
          });
        }
        
      } catch (kkiapayError) {
        console.error(`❌ [RETOUR] Erreur KkiaPay:`, kkiapayError.message);
        return res.status(404).json({ 
          success: false, 
          message: 'Transaction non trouvée et impossible de vérifier avec KkiaPay' 
        });
      }
    }
    
    console.log(`📦 [RETOUR] Transaction: ${transaction.transactionId} - Statut: ${transaction.status}`);

    // ✅ SI DÉJÀ COMPLÉTÉE, RETOURNER LES INFOS
    if (transaction.status === 'completed') {
      console.log(`✅ [RETOUR] Transaction déjà complétée`);
      
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
        message: "Paiement déjà traité"
      });
    }
    
    // ✅ SI PENDING, ACTIVER MAINTENANT
    if (transaction.status === 'pending') {
      console.log(`🎯 [RETOUR] Activation de l'abonnement...`);
      
      const activationSuccess = await exports.activatePremiumSubscription(transaction);
      
      if (activationSuccess) {
        const user = await User.findById(transaction.userId);
        
        console.log(`✅ [RETOUR] Abonnement activé avec succès`);
        
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
          message: "Paiement confirmé et abonnement activé"
        });
      } else {
        console.error(`❌ [RETOUR] Échec activation`);
        return res.status(500).json({
          success: false,
          message: "Erreur lors de l'activation de l'abonnement"
        });
      }
    }
    
    // ✅ AUTRES STATUTS
    return res.status(200).json({
      success: true,
      status: transaction.status,
      message: `Transaction ${transaction.status}`
    });
    
  } catch (error) {
    console.error(`❌ [RETOUR] Erreur:`, error.message);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: error.message
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
        message: 'Plan invalide' 
      });
    }
    
    const user = req.user;
    const transactionID = generateUniqueTransactionID();

    console.log('🎯 Transaction:', {
      user: user.email,
      plan: planId,
      transactionId: transactionID
    });

    const transaction = new Transaction({
      userId: user._id,
      transactionId: transactionID,
      amount: plan.amount,
      durationInMonths: plan.duration,
      planId: planId,
      status: 'pending',
      paymentGateway: 'kkiapay_widget',
      description: plan.description
    });

    await transaction.save();
    console.log('✅ Transaction créée');

    return res.status(200).json({
      success: true,
      transactionId: transactionID,
      amount: plan.amount,
      publicKey: process.env.KKIAPAY_PUBLIC_KEY,
      phone: user.phone || '',
      email: user.email,
      callback: `${process.env.FRONTEND_URL}/payment-callback.html`,
      metadata: {
        transaction_id: transactionID,
        user_id: user._id.toString(),
        user_email: user.email,
        plan: planId
      }
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
};

// ✅ RENVOYER CODE
exports.resendAccessCode = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const transaction = await Transaction.findOne({
      userId: user._id,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Aucun code trouvé'
      });
    }

    const emailSent = await sendAccessCodeEmail(
      user.email,
      transaction.accessCode,
      user.name,
      transaction.durationInMonths
    );

    return res.status(200).json({
      success: emailSent,
      message: emailSent ? 'Code renvoyé' : 'Erreur envoi'
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// ✅ INFO ABONNEMENT
exports.getUserSubscriptionInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const hasActive = user.premiumExpiresAt && new Date() < new Date(user.premiumExpiresAt);

    res.status(200).json({
      success: true,
      subscription: {
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt,
        hasActiveSubscription: hasActive,
        daysLeft: hasActive 
          ? Math.ceil((new Date(user.premiumExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};