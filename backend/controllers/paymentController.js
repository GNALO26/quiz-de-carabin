const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const transporter = require('../config/email');
const kkiapay = require('../config/kkiapay');

// Définition des options d'abonnement
const pricing = {
  '1-month': { amount: 5000, description: "Abonnement Premium 1 mois", duration: 1 }, 
  '3-months': { amount: 12000, description: "Abonnement Premium 3 mois", duration: 3 },
  '10-months': { amount: 25000, description: "Abonnement Premium 10 mois", duration: 10 }
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

const generateUniqueReference = () => {
  return 'REF_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Fonction pour envoyer des emails avec code d'accès
const sendAccessCodeEmail = async (email, accessCode, userName = 'Utilisateur') => {
  try {
    console.log(`[EMAIL] 🔄 Tentative d'envoi de code d'accès (${accessCode}) à: ${email}`);
    
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
            <p>Votre abonnement premium a été activé avec succès.</p>
            
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

// Exporter la fonction
exports.sendAccessCodeEmail = sendAccessCodeEmail;

// Initier un paiement avec KkiaPay
exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT KKiaPay ===');
    
    const { planId, amount } = req.body;
    const plan = pricing[planId];
    
    if (!plan || plan.amount !== parseInt(amount)) {
      console.error('❌ Erreur: Plan d\'abonnement ou montant invalide:', { planId, amount });
      return res.status(400).json({ success: false, message: 'Plan d\'abonnement ou montant invalide.' });
    }

    const user = req.user;
    const uniqueReference = generateUniqueReference();

    const transactionID = generateUniqueTransactionID();
    const transaction = new Transaction({
      userId: req.user._id,
      transactionId: transactionID,
      amount: plan.amount,
      durationInMonths: plan.duration,
      status: 'pending'
    });

    await transaction.save();

    // Configuration KkiaPay
    const frontendUrl = process.env.FRONTEND_URL;
    
    const paymentData = {
      amount: plan.amount,
      phone: user.phone, // Optionnel - peut être null
      metadata: {
        user_id: req.user._id.toString(),
        user_email: req.user.email,
        service: 'premium_subscription',
        transaction_id: transactionID,
        unique_reference: uniqueReference,
        timestamp: Date.now().toString(),
        plan_id: planId
      },
      callback: `${frontendUrl}/payment-callback.html?transactionId=${transactionID}`,
      // KkiaPay gère automatiquement les webhooks avec les métadonnées
    };

    console.log('Création du paiement KkiaPay pour le plan', planId, '...');
    
    const paymentResponse = await kkiapay.createPayment(paymentData);
    
    if (paymentResponse && paymentResponse.transactionId) {
      transaction.kkiapayTransactionId = paymentResponse.transactionId;
      transaction.kkiapayPaymentUrl = paymentResponse.url;
      await transaction.save();

      console.log('✅ Paiement KkiaPay créé avec succès');

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        paymentUrl: paymentResponse.url,
        transactionId: transactionID
      });
    } else {
      transaction.status = 'failed';
      await transaction.save();

      console.error('❌ Échec de la création du paiement KkiaPay:', paymentResponse);
      
      res.status(400).json({
        success: false,
        message: "Erreur lors de la création du paiement: " + (paymentResponse.message || 'Erreur inconnue')
      });
    }
  } catch (error) {
    console.error('❌ Erreur dans initiatePayment:', error);
    
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'initiation du paiement",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
                message: "Paiement déjà traité et code disponible"
            });
        }
        
        // Si le webhook a échoué, on confirme manuellement le paiement
        console.log(`[${new Date().toISOString()}] [RETOUR] Confirmation manuelle du paiement...`);
        
        if (transaction.kkiapayTransactionId) {
            const paymentStatus = await kkiapay.verifyTransaction(transaction.kkiapayTransactionId);
            
            if (paymentStatus && paymentStatus.status === 'SUCCESS') {
                console.log(`[${new Date().toISOString()}] [INFO] Retour: Paiement confirmé manuellement. Provisionnement de l'abonnement...`);
                
                await this.activatePremiumSubscription(transaction);
                
                const user = await User.findById(transaction.userId);
                
                return res.status(200).json({
                    success: true,
                    status: 'completed',
                    accessCode: transaction.accessCode,
                    user: user,
                    message: "Paiement confirmé et code d'accès généré"
                });
            }
        }
        
        console.log(`[${new Date().toISOString()}] [INFO] Retour: Paiement toujours en attente.`);
        return res.status(200).json({
            success: false,
            status: 'pending',
            message: "Paiement en attente de confirmation"
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
                message: 'Paiement confirmé.'
            });
        }
        
        // Vérifier le statut auprès de KkiaPay
        if (transaction.kkiapayTransactionId) {
            const paymentStatus = await kkiapay.verifyTransaction(transaction.kkiapayTransactionId);
            
            if (paymentStatus && paymentStatus.status === 'SUCCESS') {
                await this.activatePremiumSubscription(transaction);
                
                const user = await User.findById(transaction.userId);
                
                return res.status(200).json({
                    success: true,
                    transactionStatus: 'completed',
                    accessCode: transaction.accessCode,
                    user: user,
                    message: 'Paiement confirmé et code d\'accès généré.'
                });
            }
        }
        
        res.status(200).json({
            success: true,
            transactionStatus: transaction.status,
            accessCode: null,
            message: `Statut: ${transaction.status}`
        });
    } catch (error) {
        console.error('Erreur dans checkTransactionStatus:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
};

// Fonction utilitaire pour activer l'abonnement premium
exports.activatePremiumSubscription = async (transaction) => {
    transaction.status = 'completed';
    const accessCode = generateCode();
    transaction.accessCode = accessCode;
    
    const user = await User.findById(transaction.userId);
    
    if (user) {
        const newAccessCode = new AccessCode({
            code: accessCode,
            email: user.email,
            userId: user._id,
            expiresAt: addMonths(Date.now(), transaction.durationInMonths)
        });
        await newAccessCode.save();

        let expiresAt = user.premiumExpiresAt && user.premiumExpiresAt > new Date()
            ? user.premiumExpiresAt
            : new Date();
            
        user.isPremium = true;
        user.premiumExpiresAt = addMonths(expiresAt, transaction.durationInMonths);
        await user.save();
        
        await sendAccessCodeEmail(user.email, accessCode, user.name);
    }
    
    await transaction.save();
    console.log(`✅ Abonnement activé pour l'utilisateur ${user.email}`);
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
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};