const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const transporter = require('../config/email');
const kkiapay = require('../config/kkiapay');

// Configuration des plans d'abonnement RÉELS
const SUBSCRIPTION_PLANS = {
  '1-month': { 
    amount: 5000, 
    description: "Abonnement Premium 1 mois", 
    duration: 1 
  }, 
  '3-months': { 
    amount: 12000, 
    description: "Abonnement Premium 3 mois", 
    duration: 3 
  },
  '10-months': { 
    amount: 25000, 
    description: "Abonnement Premium 10 mois", 
    duration: 10 
  }
};

// Fonction utilitaire pour ajouter des mois à une date
const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

// Générer un ID de transaction unique
const generateUniqueTransactionID = () => {
  return 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
};

// ✅ FONCTION AMÉLIORÉE POUR ENVOYER DES EMAILS
const sendAccessCodeEmail = async (email, accessCode, userName = 'Utilisateur', durationMonths = 1) => {
  try {
    console.log(`📧 [EMAIL] Envoi code d'accès ${accessCode} à: ${email}`);
    
    const expiryDate = addMonths(new Date(), durationMonths);
    const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const mailOptions = {
      from: `"Quiz de Carabin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🎓 Votre code d'accès Premium - Quiz de Carabin`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
          <div style="background: #13a718; color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0;">🩺 Quiz de Carabin</h1>
            <p style="margin: 10px 0 0; font-size: 16px;">Plateforme de révision médicale</p>
          </div>
          
          <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #13a718; margin-top: 0;">Félicitations ${userName} ! 🎉</h2>
            
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
    console.log(`✅ [EMAIL] Email envoyé avec succès. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ [EMAIL] Erreur envoi email à ${email}:`, error.message);
    return false;
  }
};

exports.sendAccessCodeEmail = sendAccessCodeEmail;

// ✅ FONCTION CRITIQUE POUR ACTIVER L'ABONNEMENT
exports.activatePremiumSubscription = async (transaction) => {
    try {
        console.log(`🎯 [ACTIVATION] Début activation pour transaction: ${transaction.transactionId}`);
        
        // Mettre à jour le statut de la transaction
        transaction.status = 'completed';
        
        // Générer le code d'accès
        const accessCode = generateCode();
        transaction.accessCode = accessCode;
        
        // Définir les dates d'abonnement
        transaction.subscriptionStart = new Date();
        transaction.subscriptionEnd = addMonths(new Date(), transaction.durationInMonths);
        
        const user = await User.findById(transaction.userId);
        
        if (!user) {
            console.error('❌ [ACTIVATION] Utilisateur non trouvé');
            return false;
        }

        console.log(`👤 [ACTIVATION] Utilisateur: ${user.email}`);

        // Créer le code d'accès avec la durée réelle
        const newAccessCode = new AccessCode({
            code: accessCode,
            email: user.email,
            userId: user._id,
            expiresAt: addMonths(new Date(), transaction.durationInMonths)
        });
        await newAccessCode.save();
        console.log(`💾 [ACTIVATION] Code sauvegardé: ${accessCode}`);

        // ✅ GESTION INTELLIGENTE DE L'ABONNEMENT
        let newExpiryDate;
        
        if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()) {
            // L'utilisateur a déjà un abonnement actif, on étend la date
            const currentExpiry = new Date(user.premiumExpiresAt);
            newExpiryDate = new Date(currentExpiry);
            newExpiryDate.setMonth(newExpiryDate.getMonth() + transaction.durationInMonths);
            console.log(`📅 [ACTIVATION] Extension d'abonnement existant pour ${user.email}`);
        } else {
            // Nouvel abonnement ou abonnement expiré
            newExpiryDate = addMonths(new Date(), transaction.durationInMonths);
            console.log(`🆕 [ACTIVATION] Nouvel abonnement pour ${user.email}`);
        }
        
        // Mettre à jour l'utilisateur
        user.isPremium = true;
        user.premiumExpiresAt = newExpiryDate;
        await user.save();
        console.log(`✅ [ACTIVATION] Utilisateur mis à jour - Premium: ${user.isPremium}`);
        
        // Envoyer l'email avec le code d'accès
        console.log(`📧 [ACTIVATION] Envoi email à ${user.email}...`);
        const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name, transaction.durationInMonths);
        
        if (emailSent) {
            console.log(`✅ [ACTIVATION] Email envoyé avec succès`);
        } else {
            console.error(`❌ [ACTIVATION] Échec envoi email`);
        }
        
        // Sauvegarder la transaction
        await transaction.save();
        console.log(`💾 [ACTIVATION] Transaction sauvegardée: ${transaction.transactionId}`);
        
        console.log(`🎉 [ACTIVATION] ABONNEMENT ACTIVÉ AVEC SUCCÈS pour ${user.email}`);
        console.log(`   - Code: ${accessCode}`);
        console.log(`   - Durée: ${transaction.durationInMonths} mois`);
        console.log(`   - Expire le: ${newExpiryDate}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ [ACTIVATION] Erreur activation abonnement:', error);
        return false;
    }
};

// ✅ INITIER UN PAIEMENT DIRECT
exports.initiateDirectPayment = async (req, res) => {
  try {
    console.log('=== 💳 PAIEMENT DIRECT ===');
    
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
        message: `Plan d'abonnement invalide` 
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
      description: plan.description
    });

    await transaction.save();
    console.log('✅ Transaction créée:', transactionID);

    // Construire l'URL de paiement KkiaPay
    const callbackUrl = `${process.env.FRONTEND_URL}/payment-callback.html?transactionId=${transactionID}`;
    
    const paymentParams = new URLSearchParams({
      amount: plan.amount,
      apikey: process.env.KKIAPAY_PUBLIC_KEY,
      phone: user.phone || '+2290156035888',
      email: user.email,
      callback: callbackUrl,
      data: JSON.stringify({
        transaction_id: transactionID,
        user_id: user._id,
        user_email: user.email,
        plan: planKey
      }),
      theme: '#13a718',
      name: 'Quiz de Carabin',
      sandbox: 'false'
    });

    const paymentUrl = `https://kkiapay.me/pay?${paymentParams.toString()}`;

    return res.status(200).json({
      success: true,
      message: "Lien de paiement généré",
      paymentUrl: paymentUrl,
      transactionId: transactionID,
      amount: plan.amount,
      duration: plan.duration,
      description: plan.description
    });

  } catch (error) {
    console.error('❌ Erreur initiateDirectPayment:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la génération du lien de paiement'
    });
  }
};

// ✅ TRAITEMENT DU RETOUR DE PAIEMENT - VERSION AMÉLIORÉE
exports.processPaymentReturn = async (req, res) => {
    try {
        const { transactionId } = req.body;
        
        console.log(`🔄 [RETOUR] Traitement retour paiement: ${transactionId}`);
        
        // ✅ CORRECTION: Recherche plus robuste
        let transaction = await Transaction.findOne({ transactionId });
        
        if (!transaction) {
            console.log(`[INFO] Transaction non trouvée par transactionId, recherche par kkiapayTransactionId...`);
            transaction = await Transaction.findOne({ kkiapayTransactionId: transactionId });
        }

        if (!transaction) {
            console.error(`❌ [RETOUR] Transaction non trouvée: ${transactionId}`);
            return res.status(404).json({ 
                success: false, 
                message: 'Transaction non trouvée',
                details: `ID recherché: ${transactionId}`
            });
        }
        
        console.log(`📦 [RETOUR] Transaction trouvée:`, {
            id: transaction._id,
            transactionId: transaction.transactionId,
            kkiapayId: transaction.kkiapayTransactionId,
            status: transaction.status
        });

        if (transaction.status === 'completed') {
            console.log(`✅ [RETOUR] Transaction déjà confirmée`);
            
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
        
        // Si le webhook a échoué, on vérifie manuellement avec KkiaPay
        console.log(`🔍 [RETOUR] Vérification manuelle du paiement chez KkiaPay...`);
        
        try {
            // Vérifier directement avec l'API KkiaPay
            const kkiapayStatus = await kkiapay.verifyTransaction(transaction.kkiapayTransactionId || transactionId);
            console.log(`📨 [RETOUR] Statut KkiaPay:`, kkiapayStatus);
            
            if (kkiapayStatus.status === 'SUCCESS') {
                console.log(`🎉 [RETOUR] Paiement confirmé par KkiaPay, activation manuelle...`);
                
                // Sauvegarder l'ID de transaction KkiaPay
                transaction.kkiapayTransactionId = transactionId;
                await transaction.save();
                
                // Activer manuellement l'abonnement
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
        
        // Si on arrive ici, le paiement est toujours en attente
        console.log(`⏳ [RETOUR] Paiement en attente de confirmation`);
        
        return res.status(200).json({
            success: true,
            status: 'pending',
            message: "Paiement en attente de confirmation. Vous recevrez un email dès que c'est confirmé."
        });
        
    } catch (error) {
        console.error(`❌ [RETOUR] Erreur lors du traitement du retour de paiement: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors du traitement du retour de paiement",
            error: error.message
        });
    }
};

// ✅ WEBHOOK KKIAPAY - VERSION CORRIGÉE
exports.handleKkiapayWebhook = async (req, res) => {
    try {
        console.log('=== 🔔 WEBHOOK KKIAPAY ===');
        console.log('📦 Body:', JSON.stringify(req.body, null, 2));
        
        const { transactionId, status, metadata } = req.body;
        
        if (!transactionId) {
            console.error('❌ [WEBHOOK] transactionId manquant');
            return res.status(400).send('transactionId manquant');
        }

        console.log(`🔍 [WEBHOOK] Transaction: ${transactionId}, Statut: ${status}`);

        // ✅ CORRECTION: Recherche multi-stratégie
        let transaction = await Transaction.findOne({ 
            kkiapayTransactionId: transactionId 
        });

        // Si pas trouvé, chercher par metadata
        if (!transaction && metadata) {
            console.log('🔍 [WEBHOOK] Recherche par metadata...');
            if (metadata.transaction_id) {
                transaction = await Transaction.findOne({ 
                    transactionId: metadata.transaction_id 
                });
            }
        }

        // Si toujours pas trouvé, chercher par transactionId direct
        if (!transaction) {
            console.log('🔍 [WEBHOOK] Recherche par transactionId direct...');
            transaction = await Transaction.findOne({ 
                transactionId: transactionId 
            });
        }

        if (!transaction) {
            console.error(`❌ [WEBHOOK] Transaction non trouvée: ${transactionId}`);
            return res.status(404).send('Transaction non trouvée');
        }

        console.log(`📦 [WEBHOOK] Transaction trouvée - ${transaction.transactionId}, Statut actuel: ${transaction.status}`);

        if (status === 'SUCCESS' && transaction.status !== 'completed') {
            console.log('🎉 [WEBHOOK] Paiement réussi, activation de l\'abonnement...');
            
            // Sauvegarder l'ID de transaction KkiaPay
            transaction.kkiapayTransactionId = transactionId;
            await transaction.save();
            
            // Activer l'abonnement premium
            const activationSuccess = await exports.activatePremiumSubscription(transaction);
            
            if (activationSuccess) {
                console.log(`✅ [WEBHOOK] Abonnement activé pour ${transaction.userId}`);
                return res.status(200).send('Webhook traité avec succès - Abonnement activé');
            } else {
                console.error(`❌ [WEBHOOK] Échec activation abonnement pour ${transaction.userId}`);
                return res.status(500).send('Erreur activation abonnement');
            }
            
        } else if (status === 'FAILED') {
            transaction.status = 'failed';
            await transaction.save();
            console.log(`❌ [WEBHOOK] Paiement échoué pour ${transaction.transactionId}`);
            return res.status(200).send('Webhook traité - paiement échoué');
        } else {
            console.log(`ℹ [WEBHOOK] Statut ${status} ignoré pour ${transaction.transactionId} (déjà: ${transaction.status})`);
            return res.status(200).send('Webhook traité - statut ignoré');
        }

    } catch (error) {
        console.error('❌ [WEBHOOK] ERREUR:', error);
        // ✅ CORRECTION: Toujours répondre 200 pour que KkiaPay ne renvoie pas le webhook
        res.status(200).send('Webhook reçu - traitement en cours');
    }
};

// ✅ INITIER UN PAIEMENT WIDGET KKIAPAY
exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== 💳 PAIEMENT WIDGET ===');
    
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
    console.log('✅ Transaction widget créée:', transactionID);

    return res.status(200).json({
      success: true,
      message: "Transaction créée. Ouvrez le widget de paiement.",transactionId: transactionID,
      widgetConfig: {
        amount: plan.amount,
        key: process.env.KKIAPAY_PUBLIC_KEY,
        callback: `${process.env.FRONTEND_URL}/payment-callback.html?transactionId=${transactionID}`,
        sandbox: false
      }
    });

  } catch (error) {
    console.error('❌ Erreur paiement widget:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la préparation du paiement'
    });
  }
};

// ✅ VÉRIFIER LE STATUT D'UNE TRANSACTION
exports.checkTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    console.log(`🔍 Vérification statut transaction: ${transactionId}`);
    
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

    // Si la transaction est complétée
    if (transaction.status === 'completed' && transaction.accessCode) {
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
        subscriptionEnd: user.premiumExpiresAt
      });
    }

    res.status(200).json({
      success: true,
      status: transaction.status,
      message: `Statut: ${transaction.status}`
    });
    
  } catch (error) {
    console.error('❌ Erreur checkTransactionStatus:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
};

// ✅ RENVOYER LE CODE D'ACCÈS - FONCTION MANQUANTE
exports.resendAccessCode = async (req, res) => {
  try {
    console.log('🔄 [RENVOI] Tentative de renvoi de code d\'accès...');
    
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Trouver la dernière transaction complétée
    const transaction = await Transaction.findOne({
      userId: userId,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    if (transaction && transaction.accessCode) {
      console.log(`📧 [RENVOI] Renvoi du code ${transaction.accessCode} à ${user.email}`);

      const emailSent = await sendAccessCodeEmail(
        user.email, 
        transaction.accessCode, 
        user.name, 
        transaction.durationInMonths
      );
      
      if (emailSent) {
        return res.status(200).json({
          success: true,
          message: "Code d'accès renvoyé avec succès à votre email"
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Erreur lors de l'envoi de l'email"
        });
      }
    }

    return res.status(404).json({
      success: false,
      message: "Aucun code d'accès trouvé"
    });

  } catch (error) {
    console.error('❌ [RENVOI] Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du renvoi du code"
    });
  }
};

// ✅ INFORMATIONS D'ABONNEMENT UTILISATEUR
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
    const daysLeft = hasActiveSubscription 
      ? Math.ceil((new Date(user.premiumExpiresAt) - new Date()) / (1000 * 60 * 60 * 24))
      : 0;

    res.status(200).json({
      success: true,
      subscription: {
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt,
        hasActiveSubscription: hasActiveSubscription,
        daysLeft: daysLeft
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur getUserSubscriptionInfo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};