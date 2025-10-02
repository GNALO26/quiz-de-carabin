const Paydunya = require('paydunya');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const transporter = require('../config/email');

// Configuration PayDunya
const { setup, store } = require('../config/paydunya');

// ✅ AJOUT: Vérification au démarrage
console.log('🔍 Payment Controller - PayDunya Status:', {
  mode: setup.mode,
  hasMasterKey: !!setup.masterKey,
  hasPrivateKey: !!setup.privateKey
});

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
    console.log(`[EMAIL] 🔄 Envoi de code d'accès à: ${email}`);
    
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
    console.error(`[EMAIL] ❌ ERREUR envoi code à ${email}:`, error);
    return false;
  }
};

// Exporter la fonction
exports.sendAccessCodeEmail = sendAccessCodeEmail;

// Initier un paiement (VERSION AMÉLIORÉE)
exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT ===');
    
    const { planId } = req.body;
    const plan = pricing[planId];
    
    if (!plan) {
      console.error('❌ Plan d\'abonnement invalide:', planId);
      return res.status(400).json({ 
        success: false, 
        message: 'Plan d\'abonnement invalide.' 
      });
    }

    // ✅ VÉRIFICATION: Configuration PayDunya
    if (!setup.masterKey || !setup.privateKey) {
      console.error('❌ Configuration PayDunya incomplète');
      return res.status(500).json({
        success: false,
        message: 'Configuration de paiement incomplète. Contactez le support.'
      });
    }

    const user = req.user;
    const transactionID = generateUniqueTransactionID();

    const transaction = new Transaction({
      userId: user._id,
      transactionId: transactionID,
      amount: plan.amount,
      durationInMonths: plan.duration,
      status: 'pending'
    });

    await transaction.save();

    const invoice = new Paydunya.CheckoutInvoice(setup, store);
    invoice.addItem(
      plan.description,
      1,
      plan.amount,
      plan.amount,
      plan.description
    );

    invoice.totalAmount = plan.amount;
    invoice.description = plan.description;

    const baseUrl = process.env.API_BASE_URL;
    const frontendUrl = process.env.FRONTEND_URL;
    
    // ✅ CORRECTION: URLs de callback
    invoice.callbackURL = `${baseUrl}/api/payment/callback`;
    invoice.returnURL = `${frontendUrl}/payment-callback.html?transactionId=${transactionID}`;
    invoice.cancelURL = `${frontendUrl}/payment-error.html`;

    // Données personnalisées
    invoice.addCustomData('user_id', user._id.toString());
    invoice.addCustomData('user_email', user.email);
    invoice.addCustomData('transaction_id', transactionID);
    invoice.addCustomData('plan_id', planId);

    console.log('Création de la facture PayDunya...');
    
    const created = await invoice.create();
    
    if (created && invoice.token) {
      transaction.paydunyaInvoiceToken = invoice.token;
      transaction.paydunyaInvoiceURL = invoice.url;
      await transaction.save();

      console.log('✅ Payment invoice created successfully:', invoice.url);

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: invoice.url,
        token: invoice.token
      });
    } else {
      transaction.status = 'failed';
      await transaction.save();

      console.error('❌ Échec création facture:', invoice.responseText);
      
      res.status(400).json({
        success: false,
        message: "Erreur lors de la création du paiement: " + (invoice.responseText || 'Erreur inconnue')
      });
    }
  } catch (error) {
    console.error('❌ Erreur initiatePayment:', error);
    
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'initiation du paiement",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Fonction de gestion du webhook PayDunya
exports.handleCallback = async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] [WEBHOOK] === Début du traitement du webhook ===`);
    console.log(`[${new Date().toISOString()}] [WEBHOOK] Données reçues: ${JSON.stringify(req.body, null, 2)}`);

    let data = req.body.data || req.body;
    const token = data.invoice?.token || data.custom_data?.invoice_token || data.token;

    if (!token) {
      console.error(`[${new Date().toISOString()}] [ERREUR] Webhook: Token manquant. Données: ${JSON.stringify(data)}`);
      return res.status(400).send('Token manquant');
    }

    console.log(`[${new Date().toISOString()}] [WEBHOOK] Recherche de la transaction avec le token: ${token}`);
    const transaction = await Transaction.findOne({ paydunyaInvoiceToken: token });

    if (!transaction) {
      console.error(`[${new Date().toISOString()}] [ERREUR] Webhook: Transaction non trouvée pour le token: ${token}`);
      return res.status(404).send('Transaction non trouvée');
    }

    if (transaction.status === 'completed') {
      console.warn(`[${new Date().toISOString()}] [AVERTISSEMENT] Webhook: Paiement déjà traité pour la transaction ${transaction.transactionId}.`);
      return res.status(200).send('Paiement déjà traité');
    }

    console.log(`[${new Date().toISOString()}] [WEBHOOK] Statut PayDunya: ${data.status}`);

    if (data.status === 'completed') {
      console.log(`[${new Date().toISOString()}] [INFO] Webhook: Paiement confirmé. Provisionnement de l'abonnement...`);
      
      transaction.status = 'completed';
      const accessCode = generateCode();
      transaction.accessCode = accessCode;
      
      const user = await User.findById(transaction.userId);
      
      if (user) {
        // 🛑 CRITIQUE 1: Créer le code d'accès dans la collection AccessCode
        const newAccessCode = new AccessCode({
            code: accessCode,
            email: user.email,
            userId: user._id,
            // Utilise la durée de la transaction pour l'expiration du code
            expiresAt: addMonths(Date.now(), transaction.durationInMonths) 
        });
        await newAccessCode.save();

        // 🛑 CRITIQUE 2: Mettre à jour le statut Premium de l'utilisateur
        let expiresAt = user.premiumExpiresAt && user.premiumExpiresAt > new Date()
            ? user.premiumExpiresAt // Prolonge l'abonnement existant
            : new Date(); // Commence aujourd'hui si expiré ou inexistant
            
        user.isPremium = true;
        user.premiumExpiresAt = addMonths(expiresAt, transaction.durationInMonths);
        await user.save();
        
        console.log(`[${new Date().toISOString()}] [INFO] Webhook: Utilisateur Premium mis à jour. Expiration: ${user.premiumExpiresAt}`);

        console.log(`[${new Date().toISOString()}] [INFO] Webhook: Utilisateur trouvé. Envoi de l'email...`);
        // Envoi de l'email avec le code généré
        const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name);
        console.log(`[${new Date().toISOString()}] [INFO] Webhook: Email envoyé avec succès: ${emailSent}`);
      }
      
      await transaction.save(); // Sauvegarde de la transaction mise à jour
      
      console.log(`[${new Date().toISOString()}] [INFO] Webhook: Fin du traitement du webhook pour la transaction ${transaction.transactionId}.`);
    } else {
      console.log(`[${new Date().toISOString()}] [INFO] Webhook: Statut de paiement non géré: ${data.status}`);
    }
    
    res.status(200).send('Webhook traité avec succès');
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [ERREUR] Webhook: Erreur dans le gestionnaire de webhook: ${error.message}`);
    res.status(500).send('Erreur de traitement du webhook');
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
            
            // 🛑 Amélioration: Retourner les données utilisateur mises à jour
            const user = await User.findById(transaction.userId);
            return res.status(200).json({
                success: true,
                status: 'completed',
                accessCode: transaction.accessCode,
                user: user, // Retourner l'utilisateur mis à jour
                message: "Paiement déjà traité et code disponible"
            });
        }
        
        // Si le webhook a échoué, on confirme manuellement le paiement
        console.log(`[${new Date().toISOString()}] [RETOUR] Confirmation manuelle du paiement...`);
        const invoice = new Paydunya.CheckoutInvoice(setup, store);
        const success = await invoice.confirm(transaction.paydunyaInvoiceToken);
        
        if (success && invoice.status === 'completed') {
            console.log(`[${new Date().toISOString()}] [INFO] Retour: Paiement confirmé manuellement. Provisionnement de l'abonnement...`);
            
            transaction.status = 'completed';
            const accessCode = generateCode();
            transaction.accessCode = accessCode;
            
            const user = await User.findById(transaction.userId);
            
            if (user) {
                // 🛑 CRITIQUE 3: Créer le code d'accès dans la collection AccessCode
                const newAccessCode = new AccessCode({
                    code: accessCode,
                    email: user.email,
                    userId: user._id,
                    expiresAt: addMonths(Date.now(), transaction.durationInMonths)
                });
                await newAccessCode.save();

                // 🛑 CRITIQUE 4: Mettre à jour le statut Premium de l'utilisateur
                let expiresAt = user.premiumExpiresAt && user.premiumExpiresAt > new Date()
                    ? user.premiumExpiresAt
                    : new Date();
                    
                user.isPremium = true;
                user.premiumExpiresAt = addMonths(expiresAt, transaction.durationInMonths);
                await user.save();
                
                await sendAccessCodeEmail(user.email, accessCode, user.name);
            }
            
            await transaction.save();

            return res.status(200).json({
                success: true,
                status: 'completed',
                accessCode: accessCode,
                user: user, // Retourner l'utilisateur mis à jour
                message: "Paiement confirmé et code d'accès généré"
            });
        } else {
            console.log(`[${new Date().toISOString()}] [INFO] Retour: Paiement toujours en attente.`);
            return res.status(200).json({
                success: false,
                status: 'pending',
                message: "Paiement en attente de confirmation"
            });
        }
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
        
        // Vérifier si la transaction est déjà terminée et si un code a été généré
        if (transaction.status === 'completed' && transaction.accessCode) {
            const user = await User.findById(transaction.userId);
            return res.status(200).json({
                success: true,
                transactionStatus: 'completed',
                accessCode: transaction.accessCode,
                user: user, // Retourner l'utilisateur mis à jour
                message: 'Paiement confirmé.'
            });
        }
        
        // Sinon, vérifier le statut directement auprès de PayDunya
        const invoice = new Paydunya.CheckoutInvoice(setup, store);
        const confirmed = await invoice.confirm(transaction.paydunyaInvoiceToken);
        
        if (confirmed && invoice.status === 'completed') {
            
            transaction.status = 'completed';
            const accessCode = generateCode();
            transaction.accessCode = accessCode;
            
            const user = await User.findById(transaction.userId);
            
            if (user) {
                // Création du code d'accès dans la collection AccessCode
                const newAccessCode = new AccessCode({
                    code: accessCode,
                    email: user.email,
                    userId: user._id,
                    expiresAt: addMonths(Date.now(), transaction.durationInMonths)
                });
                await newAccessCode.save();

                // Mettre à jour le statut Premium de l'utilisateur
                let expiresAt = user.premiumExpiresAt && user.premiumExpiresAt > new Date()
                    ? user.premiumExpiresAt
                    : new Date();
                    
                user.isPremium = true;
                user.premiumExpiresAt = addMonths(expiresAt, transaction.durationInMonths);
                await user.save();
                
                await sendAccessCodeEmail(user.email, accessCode, user.name);
            }
            
            await transaction.save();

            return res.status(200).json({
                success: true,
                transactionStatus: 'completed',
                accessCode: accessCode,
                user: user, // Retourner l'utilisateur mis à jour
                message: 'Paiement confirmé et code d\'accès généré.'
            });
        }
        
        // Si la transaction n'est ni terminée, ni confirmée par PayDunya
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