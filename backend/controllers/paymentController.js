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
const sendAccessCodeEmail = async (email, accessCode) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Votre code d\'accès Premium - 🩺 Quiz de Carabin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #13a718ff;">Félicitations!</h2>
          <p>Votre abonnement premium a été activé avec succès.</p>
          <p>Voici votre code d'accès unique:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #1e53a2ff;">${accessCode}</span>
          </div>
          <p>Ce code expire dans <strong>30 minutes</strong>.</p>
          <p>Utilisez-le sur la page de validation pour activer votre compte premium.</p>
          <br>
          <p>Merci pour votre confiance!</p>
          <p>L'équipe 🩺 Quiz de Carabin 🩺</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log('✅ Email avec code d\'accès envoyé à:', email);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    return false;
  }
};

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
exports.handleCallback = async (req, res) => {
  try {
    console.log('📨 Webhook reçu de PayDunya:', JSON.stringify(req.body, null, 2));
    
    // PayDunya envoie les données différemment selon le mode
    let data = req.body;
    
    // Vérification pour le mode test/live
    if (req.body.data) {
      data = req.body.data;
    }
    
    const token = data.invoice?.token || data.custom_data?.invoice_token;
    
    if (!token) {
      console.error('❌ Token manquant dans le webhook:', data);
      return res.status(400).send('Token manquant');
    }
    
    const transaction = await Transaction.findOne({ paydunyaInvoiceToken: token });
    
    if (!transaction) {
      console.error('Transaction non trouvée pour le token:', token);
      return res.status(404).send('Transaction non trouvée');
    }
    
    console.log('📊 Statut reçu du webhook:', data.status);
    
    if (data.status === 'completed') {
      transaction.status = 'completed';
      
      // Générer et sauvegarder le code d'accès
      const accessCode = generateCode();
      transaction.accessCode = accessCode;
      await transaction.save();
      
      console.log('✅ Code d\'accès généré et sauvegardé:', accessCode);
      
      // Récupérer l'utilisateur
      const user = await User.findById(transaction.userId);
      if (user) {
        // Envoyer l'email avec le code d'accès
        const customerEmail = data.customer?.email || user.email;
        const emailSent = await sendAccessCodeEmail(customerEmail, accessCode);
        
        if (!emailSent) {
          console.log('⚠ Email non envoyé, mais code sauvegardé dans la transaction');
        }
        
        // Mettre à jour le statut premium de l'utilisateur
        user.isPremium = true;
        user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an
        await user.save();
        
        console.log('✅ Statut premium mis à jour pour l\'utilisateur:', user.email);
      }
      
      console.log('✅ Paiement confirmé pour la transaction:', transaction.transactionId);
    } else if (data.status === 'failed') {
      transaction.status = 'failed';
      await transaction.save();
      console.log('❌ Paiement échoué pour la transaction:', transaction.transactionId);
    }
    
    res.status(200).send('Webhook traité avec succès');
  } catch (error) {
    console.error('❌ Erreur dans handleCallback:', error);
    res.status(500).send('Erreur de traitement du webhook');
  }
};

// Validation du code d'accès
exports.validateAccessCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Le code d'accès est requis"
      });
    }

    // Vérifier d'abord dans la transaction
    const transaction = await Transaction.findOne({
      userId: userId,
      status: 'completed',
      accessCode: code
    });

    if (transaction) {
      // Marquer le code comme utilisé
      transaction.accessCodeUsed = true;
      await transaction.save();

      // Mettre à jour l'utilisateur
      const user = await User.findById(userId);
      user.isPremium = true;
      user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      await user.save();

      console.log('✅ Code d\'accès validé pour l\'utilisateur:', user.email);

      return res.status(200).json({
        success: true,
        message: "Code validé avec succès. Votre compte est maintenant premium!",
        premium: true,
        premiumExpiresAt: user.premiumExpiresAt,
        user: user
      });
    }

    // Vérifier dans la table des codes d'accès (ancienne méthode)
    const accessCode = await AccessCode.findOne({
      code: code,
      userId: userId,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!accessCode) {
      return res.status(400).json({
        success: false,
        message: "Code d'accès invalide, expiré ou déjà utilisé"
      });
    }

    accessCode.used = true;
    await accessCode.save();

    const user = await User.findById(userId);
    user.isPremium = true;
    user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await user.save();

    console.log('✅ Code d\'accès validé pour l\'utilisateur:', user.email);

    res.status(200).json({
      success: true,
      message: "Code validé avec succès. Votre compte est maintenant premium!",
      premium: true,
      premiumExpiresAt: user.premiumExpiresAt,
      user: user
    });

  } catch (error) {
    console.error('❌ Erreur dans validateAccessCode:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la validation du code"
    });
  }
};

// Vérifier le statut d'un paiement
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const transaction = await Transaction.findOne({ 
      transactionId: paymentId,
      userId: req.user._id 
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction non trouvée"
      });
    }

    res.status(200).json({
      success: true,
      status: transaction.status,
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      createdAt: transaction.createdAt,
      accessCode: transaction.accessCode
    });
  } catch (error) {
    console.error('❌ Erreur dans checkPaymentStatus:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la vérification du statut"
    });
  }
};

// Récupérer le code d'accès d'une transaction
exports.getAccessCode = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      userId: req.user._id,
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Aucune transaction trouvée"
      });
    }

    if (!transaction.accessCode) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès généré pour cette transaction"
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