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

// Fonction utilitaire pour ajouter des mois à une date
const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

// Fonctions utilitaires
const generateUniqueTransactionID = () => {
  return 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
};

// Fonction pour envoyer des emails avec code d'accès
const sendAccessCodeEmail = async (email, accessCode, userName = 'Utilisateur', durationMonths = 1) => {
  try {
    console.log(`[EMAIL] 🔄 Tentative d'envoi de code d'accès (${accessCode}) à: ${email}`);
    
    const expiryDate = addMonths(new Date(), durationMonths);
    const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Votre code d\'accès Premium - 🩺 Quiz de Carabin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #13a718ff; color: white; padding: 20px; text-align: center;">
            <h1>Quiz de Carabin</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2 style="color: #13a718ff;">Félicitations ${userName}!</h2>
            <p>Votre abonnement premium a été activé avec succès pour <strong>${durationMonths} mois</strong>.</p>
            <p><strong>Date d'expiration : ${formattedDate}</strong></p>
            
            <p>Voici votre code d'accès unique:</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #1e53a2ff; background: #f8f9fa; padding: 15px; border-radius: 8px; display: inline-block;">
                ${accessCode}
              </span>
            </div>
            
            <p><strong>Vous pouvez utiliser ce code sur la page de validation si nécessaire. Votre compte Premium est maintenant actif.</strong></p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p>Merci pour votre confiance!</p>
              <p>L'équipe 🩺 Quiz de Carabin 🩺</p>
              <p><small>Si vous n'avez pas effectué cette demande, veuillez ignorer cet email.</small></p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Code envoyé avec succès. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] ❌ ERREUR FATALE ENVOI DE CODE D'ACCÈS à ${email}:`, error);
    return false;
  }
};

exports.sendAccessCodeEmail = sendAccessCodeEmail;

// Initier un paiement avec Widget KkiaPay
exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT (WIDGET KKiaPay) ===');
    
    const { planId, amount } = req.body;
    const plan = SUBSCRIPTION_PLANS[planId];
    
    if (!plan || plan.amount !== parseInt(amount)) {
      console.error('❌ Erreur: Plan d\'abonnement ou montant invalide:', { planId, amount });
      return res.status(400).json({ success: false, message: 'Plan d\'abonnement ou montant invalide.' });
    }

    const user = req.user;
    const transactionID = generateUniqueTransactionID();

    console.log('🎯 Préparation transaction pour widget KkiaPay:', {
      user: user.email,
      plan: planId,
      amount: plan.amount,
      duration: plan.duration,
      transactionId: transactionID
    });

    // Créer la transaction en statut pending
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

    console.log('✅ Transaction créée pour widget KkiaPay:', transactionID);

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
    console.error('❌ Erreur initiatePayment (widget KkiaPay):', error.message);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la préparation du paiement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ✅ FONCTION AMÉLIORÉE POUR ACTIVER L'ABONNEMENT
exports.activatePremiumSubscription = async (transaction) => {
    try {
        console.log(`🎯 Activation abonnement premium pour transaction: ${transaction.transactionId}`);
        
        // Mettre à jour le statut de la transaction
        transaction.status = 'completed';
        
        // Générer le code d'accès
        const accessCode = generateCode();
        transaction.accessCode = accessCode;
        
        // Définir les dates de début et fin d'abonnement
        transaction.subscriptionStart = new Date();
        transaction.subscriptionEnd = addMonths(new Date(), transaction.durationInMonths);
        
        const user = await User.findById(transaction.userId);
        
        if (!user) {
            console.error('❌ Utilisateur non trouvé pour l\'activation premium');
            return false;
        }

        console.log(`👤 Utilisateur trouvé: ${user.email}`);

        // Créer le code d'accès avec la durée réelle
        const newAccessCode = new AccessCode({
            code: accessCode,
            email: user.email,
            userId: user._id,
            expiresAt: addMonths(new Date(), transaction.durationInMonths)
        });
        await newAccessCode.save();
        console.log(`💾 Code d'accès sauvegardé: ${accessCode}`);

        // ✅ GESTION INTELLIGENTE DE L'ABONNEMENT
        let newExpiryDate;
        
        if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()) {
            // L'utilisateur a déjà un abonnement actif, on étend la date
            const currentExpiry = new Date(user.premiumExpiresAt);
            newExpiryDate = new Date(currentExpiry);
            newExpiryDate.setMonth(newExpiryDate.getMonth() + transaction.durationInMonths);
            console.log(`📅 Extension d'abonnement existant pour ${user.email}`);
        } else {
            // Nouvel abonnement ou abonnement expiré
            newExpiryDate = addMonths(new Date(), transaction.durationInMonths);
            console.log(`🆕 Nouvel abonnement pour ${user.email}`);
        }
        
        // Mettre à jour l'utilisateur
        user.isPremium = true;
        user.premiumExpiresAt = newExpiryDate;
        await user.save();
        console.log(`✅ Utilisateur mis à jour - Premium: ${user.isPremium}`);
        
        // Envoyer l'email avec le code d'accès
        console.log(`📧 Tentative d'envoi d'email à ${user.email}...`);
        const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name, transaction.durationInMonths);
        
        if (emailSent) {
            console.log(`✅ Email envoyé avec succès à ${user.email}`);
        } else {
            console.error(`❌ Échec envoi email à ${user.email}`);
        }
        
        // Sauvegarder la transaction
        await transaction.save();
        console.log(`💾 Transaction sauvegardée: ${transaction.transactionId}`);
        
        console.log(`🎉 ABONNEMENT ACTIVÉ AVEC SUCCÈS pour ${user.email}`);
        console.log(`   - Code: ${accessCode}`);
        console.log(`   - Durée: ${transaction.durationInMonths} mois`);
        console.log(`   - Expire le: ${newExpiryDate}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Erreur activation abonnement premium:', error);
        return false;
    }
};

// Fonction de traitement du retour de paiement
exports.processPaymentReturn = async (req, res) => {
    try {
        const { transactionId } = req.body;
        
        console.log(`[${new Date().toISOString()}] [RETOUR] === Début du traitement du retour de paiement ===`);
        console.log(`[${new Date().toISOString()}] [RETOUR] ID de la transaction: ${transactionId}`);
        
        const transaction = await Transaction.findOne({ transactionId });
        
        if (!transaction) {
            console.error(`[${new Date().toISOString()}] [ERREUR] Retour: Transaction non trouvée: ${transactionId}`);
            return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
        }
        
        if (transaction.status === 'completed') {
            console.log(`[${new Date().toISOString()}] [INFO] Retour: Transaction déjà confirmée par le webhook.`);
            
            const user = await User.findById(transaction.userId);
            return res.status(200).json({
                success: true,
                status: 'completed',
                accessCode: transaction.accessCode,
                user: user,
                subscriptionEnd: user.premiumExpiresAt,
                message: "Paiement déjà traité et code disponible"
            });
        }
        
        // Si le webhook a échoué, on vérifie manuellement
        console.log(`[${new Date().toISOString()}] [RETOUR] Vérification manuelle du paiement...`);
        
        // Pour KkiaPay Widget, on ne peut pas vérifier directement
        // On retourne un statut pending et on attend le webhook
        console.log(`[${new Date().toISOString()}] [INFO] Retour: Paiement toujours en attente de confirmation webhook.`);
        
        return res.status(200).json({
            success: true,
            status: 'pending',
            message: "Paiement en attente de confirmation. Vous recevrez un email dès que c'est confirmé."
        });
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [ERREUR] Retour: Erreur lors du traitement du retour de paiement: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors du traitement du retour de paiement"
        });
    }
};

// Vérifier manuellement le statut d'une transaction
exports.checkTransactionStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        const transaction = await Transaction.findOne({ transactionId, userId: req.user._id });
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
        }
        
        if (transaction.status === 'completed' && transaction.accessCode) {
            const user = await User.findById(transaction.userId);
            return res.status(200).json({
                success: true,
                transactionStatus: 'completed',
                accessCode: transaction.accessCode,
                user: user,
                subscriptionEnd: user.premiumExpiresAt,
                message: 'Paiement confirmé.'
            });
        }
        
        // Pour KkiaPay Widget, on ne peut pas vérifier directement le statut
        // On retourne le statut actuel
        res.status(200).json({
            success: true,
            transactionStatus: transaction.status,
            accessCode: null,
            message: `Statut: ${transaction.status} - En attente de confirmation`
        });
        
    } catch (error) {
        console.error('Erreur dans checkTransactionStatus:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
};

// Obtenir le code d'accès de la dernière transaction
exports.getLatestAccessCode = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      userId: req.user._id,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès trouvé"
      });
    }
    
    res.status(200).json({
      success: true,
      accessCode: transaction.accessCode
    });
  } catch (error) {
    console.error('Erreur getLatestAccessCode:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// Renvoyer le code d'accès par email
exports.resendAccessCode = async (req, res) => {
  try {
    console.log('🔄 Tentative de renvoi de code d\'accès...');
    
    const TransactionModel = require('../models/Transaction');

    // Trouver la dernière transaction complétée
    const transaction = await TransactionModel.findOne({
      userId: req.user._id,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Aucune transaction avec code d'accès trouvée"
      });
    }

    const user = await User.findById(req.user._id);
    
    console.log(`📧 Renvoi du code ${transaction.accessCode} à ${user.email}`);

    const emailSent = await sendAccessCodeEmail(user.email, transaction.accessCode, user.name, transaction.durationInMonths);
    
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
  } catch (error) {
    console.error('❌ Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors du renvoi du code"
    });
  }
};

// ✅ Handler pour les webhooks KkiaPay - VERSION CORRIGÉE
exports.handleKkiapayWebhook = async (req, res) => {
    try {
        console.log('=== DÉBUT WEBHOOK KKiaPay ===');
        console.log('📦 Body complet:', JSON.stringify(req.body, null, 2));
        
        const { transactionId, status, metadata } = req.body;
        
        if (!transactionId) {
            console.error('❌ Webhook: transactionId manquant');
            return res.status(400).send('transactionId manquant');
        }

        console.log(`🔍 Webhook reçu - Transaction: ${transactionId}, Statut: ${status}`);

        // ✅ CORRECTION: On cherche d'abord par kkiapayTransactionId
        let transaction = await Transaction.findOne({ 
            kkiapayTransactionId: transactionId 
        });

        // Si pas trouvé, chercher par metadata
        if (!transaction && metadata) {
            console.log('🔍 Recherche par metadata...');
            if (metadata.transaction_id) {
                transaction = await Transaction.findOne({ 
                    transactionId: metadata.transaction_id 
                });
            }
        }

        // Si toujours pas trouvé, chercher par transactionId direct
        if (!transaction) {
            console.log('🔍 Recherche par transactionId direct...');
            transaction = await Transaction.findOne({ 
                transactionId: transactionId 
            });
        }

        if (!transaction) {
            console.error(`❌ Webhook: Transaction non trouvée: ${transactionId}`);
            console.log('📋 Transactions disponibles:', await Transaction.find({}).select('transactionId kkiapayTransactionId status').limit(5));
            return res.status(404).send('Transaction non trouvée');
        }

        console.log(`📦 Webhook: Transaction trouvée - ${transaction.transactionId}, Statut actuel: ${transaction.status}`);

        if (status === 'SUCCESS' && transaction.status !== 'completed') {
            console.log('🎉 Webhook: Paiement réussi, activation de l\'abonnement...');
            
            // Sauvegarder l'ID de transaction KkiaPay
            transaction.kkiapayTransactionId = transactionId;
            await transaction.save();
            
            // Activer l'abonnement premium
            const activationSuccess = await exports.activatePremiumSubscription(transaction);
            
            if (activationSuccess) {
                console.log(`✅ Webhook: Abonnement activé pour ${transaction.userId}`);
                return res.status(200).send('Webhook traité avec succès - Abonnement activé');
            } else {
                console.error(`❌ Webhook: Échec activation abonnement pour ${transaction.userId}`);
                return res.status(500).send('Erreur activation abonnement');
            }
            
        } else if (status === 'FAILED') {
            transaction.status = 'failed';
            await transaction.save();
            console.log(`❌ Webhook: Paiement échoué pour ${transaction.transactionId}`);
            return res.status(200).send('Webhook traité - paiement échoué');
        } else {
            console.log(`ℹ Webhook: Statut ${status} ignoré pour ${transaction.transactionId} (déjà: ${transaction.status})`);
            return res.status(200).send('Webhook traité - statut ignoré');
        }

    } catch (error) {
        console.error('❌ ERREUR WEBHOOK:', error);
        // ✅ CORRECTION: Toujours répondre 200 pour que KkiaPay ne renvoie pas le webhook
        res.status(200).send('Webhook reçu - traitement en cours');
    }
};

// ✅ NOUVELLES FONCTIONS POUR PAIEMENTS DIRECTS

// Initier un paiement avec lien direct KkiaPay
exports.initiateDirectPayment = async (req, res) => {
  try {
    console.log('=== DÉBUT PAIEMENT DIRECT KKiaPay ===');
    console.log('📦 Body reçu:', req.body);
    console.log('👤 User:', req.user ? req.user.email : 'No user');
    
    const { planKey } = req.body;
    
    if (!planKey) {
      console.error('❌ planKey manquant dans le body');
      return res.status(400).json({ 
        success: false, 
        message: 'Plan key manquant' 
      });
    }

    const plan = SUBSCRIPTION_PLANS[planKey];
    
    if (!plan) {
      console.error('❌ Plan non trouvé:', planKey);
      console.log('📋 Plans disponibles:', Object.keys(SUBSCRIPTION_PLANS));
      return res.status(400).json({ 
        success: false, 
        message: `Plan d'abonnement invalide: ${planKey}` 
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
    const hasActivePremium = user.premiumExpiresAt && new Date() < new Date(user.premiumExpiresAt);

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
      hasActiveSubscription: user.premiumExpiresAt && new Date() < new Date(user.premiumExpiresAt),
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