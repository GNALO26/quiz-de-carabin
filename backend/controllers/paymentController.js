// backend/controllers/paymentController.js
const Paydunya = require('paydunya');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const transporter = require('../config/email');

// Configuration PayDunya
const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY ? process.env.PAYDUNYA_MASTER_KEY.trim() : '',
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY ? process.env.PAYDUNYA_PRIVATE_KEY.trim() : '',
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY ? process.env.PAYDUNYA_PUBLIC_KEY.trim() : '',
  token: process.env.PAYDUNYA_TOKEN ? process.env.PAYDUNYA_TOKEN.trim() : '',
  mode: (process.env.PAYDUNYA_MODE || 'live').trim()
});

const store = new Paydunya.Store({
  name: "Quiz de Carabin",
  tagline: "Plateforme de quiz médicaux",
  postalAddress: "Cotonou, Bénin",
  phoneNumber: process.env.STORE_PHONE || "+2290156035888",
  websiteURL: process.env.FRONTEND_URL || "https://quiz-de-carabin.netlify.app",
  logoURL: process.env.STORE_LOGO_URL || "https://quiz-de-carabin.netlify.app/assets/images/logo.png"
});

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
    console.log('🔄 Tentative d\'envoi d\'email à:', email);
    
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
            
            <p><strong>Ce code expire dans 30 minutes.</strong></p>
            <p>Utilisez-le sur la page de validation pour activer votre compte premium.</p>
            
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
    console.log('✅ Email envoyé avec succès. Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Erreur détaillée envoi email:', error);
    return false;
  }
};

// Exporter la fonction
exports.sendAccessCodeEmail = sendAccessCodeEmail;

// Fonction de validation d'email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Initier un paiement
exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT ===');
    
    const user = req.user;
    const uniqueReference = generateUniqueReference();

    if (user.isPremium && user.premiumExpiresAt > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un abonnement premium actif'
      });
    }

    const transactionID = generateUniqueTransactionID();
    const transaction = new Transaction({
      userId: req.user._id,
      transactionId: transactionID,
      amount: 5000,
      status: 'pending'
    });

    await transaction.save();

    const invoice = new Paydunya.CheckoutInvoice(setup, store);
    invoice.addItem(
      `Abonnement Premium - ${uniqueReference}`,
      1,
      200.00,
      200.00,
      `Accès illimité à tous les quiz premium - Référence: ${uniqueReference}`
    );

    invoice.totalAmount = 200.00;
    invoice.description = `Abonnement Premium Quiz de Carabin - ${uniqueReference}`;

    const baseUrl = process.env.API_BASE_URL;
    const frontendUrl = process.env.FRONTEND_URL;
    
    invoice.callbackURL = `${baseUrl}/api/payment/callback`;
    invoice.returnURL = `${frontendUrl}/payment-callback.html?userId=${user._id}&transactionId=${transactionID}`;
    invoice.cancelURL = `${frontendUrl}/payment-error.html`;

    invoice.addCustomData('user_id', req.user._id.toString());
    invoice.addCustomData('user_email', req.user.email);
    invoice.addCustomData('service', 'premium_subscription');
    invoice.addCustomData('transaction_id', transactionID);
    invoice.addCustomData('unique_reference', uniqueReference);
    invoice.addCustomData('timestamp', Date.now().toString());

    console.log('Création de la facture PayDunya...');
    
    const created = await invoice.create();
    
    if (created || invoice.token) {
      transaction.paydunyaInvoiceToken = invoice.token;
      transaction.paydunyaInvoiceURL = invoice.url;
      await transaction.save();

      console.log('✅ Payment invoice created successfully');

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: invoice.url,
        token: invoice.token
      });
    } else {
      transaction.status = 'failed';
      await transaction.save();

      console.error('❌ Échec de la création de la facture:', invoice.responseText);
      
      res.status(400).json({
        success: false,
        message: "Erreur lors de la création du paiement: " + (invoice.responseText || 'Erreur inconnue')
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

// Gestionnaire de webhook - VERSION CORRIGÉE
// backend/controllers/paymentController.js

// ... (le reste du code est inchangé)

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
      console.log(`[${new Date().toISOString()}] [INFO] Webhook: Paiement confirmé. Génération du code d'accès...`);
      transaction.status = 'completed';
      const accessCode = generateCode();
      transaction.accessCode = accessCode;
      await transaction.save();

      console.log(`[${new Date().toISOString()}] [INFO] Webhook: Code d'accès généré et sauvegardé dans la transaction: ${accessCode}`);

      const user = await User.findById(transaction.userId);
      if (user) {
        console.log(`[${new Date().toISOString()}] [INFO] Webhook: Utilisateur trouvé. Envoi de l'email...`);
        const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name);
        console.log(`[${new Date().toISOString()}] [INFO] Webhook: Email envoyé avec succès: ${emailSent}`);
      }
      
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
      
      if (transaction.accessCode) {
        return res.status(200).json({
          success: true,
          status: 'completed',
          accessCode: transaction.accessCode,
          message: "Paiement déjà traité et code disponible"
        });
      }
    }
    
    // Si le webhook a échoué, on confirme manuellement le paiement
    console.log(`[${new Date().toISOString()}] [RETOUR] Confirmation manuelle du paiement...`);
    const invoice = new Paydunya.CheckoutInvoice(setup, store);
    const success = await invoice.confirm(transaction.paydunyaInvoiceToken);
    
    if (success && invoice.status === 'completed') {
      console.log(`[${new Date().toISOString()}] [INFO] Retour: Paiement confirmé manuellement. Génération du code d'accès...`);
      transaction.status = 'completed';
      const accessCode = generateCode();
      transaction.accessCode = accessCode;
      await transaction.save();
      
      const user = await User.findById(transaction.userId);
      if (user) {
        console.log(`[${new Date().toISOString()}] [INFO] Retour: Envoi de l'email avec le code généré...`);
        await sendAccessCodeEmail(user.email, accessCode, user.name);
        console.log(`[${new Date().toISOString()}] [INFO] Retour: Email de confirmation de paiement envoyé.`);
      }
      
      return res.status(200).json({
        success: true,
        status: 'completed',
        accessCode: accessCode,
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
    
    const transaction = await Transaction.findOne({ transactionId });
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction non trouvée' });
    }
    
    if (transaction.status === 'completed' && transaction.accessCode) {
      const user = await User.findById(transaction.userId);
      if (user) {
        const emailSent = await sendAccessCodeEmail(user.email, transaction.accessCode, user.name);
        
        return res.json({
          success: true,
          transactionStatus: transaction.status,
          accessCode: transaction.accessCode,
          emailSent: emailSent,
          message: emailSent ? 'Email envoyé' : 'Erreur d\'envoi d\'email'
        });
      }
    }
    
    res.json({
      success: true,
      transactionStatus: transaction.status,
      accessCode: transaction.accessCode,
      message: `Statut: ${transaction.status}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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