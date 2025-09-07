const Paydunya = require('paydunya');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const { sendEmail } = require('../utils/email');

// Configuration de PayDunya
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

// Fonction pour générer un ID de transaction unique
const generateUniqueTransactionID = () => {
  return 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
};

// Fonction pour générer une référence unique
const generateUniqueReference = () => {
  return 'REF_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT ===');
    
    const user = req.user;
    const uniqueReference = generateUniqueReference();

    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (user.isPremium && user.premiumExpiresAt > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un abonnement premium actif'
      });
    }

    // Générer un ID de transaction unique
    const transactionID = generateUniqueTransactionID();
    
    // Enregistrer la transaction en base de données
    const transaction = new Transaction({
      userId: req.user._id,
      transactionId: transactionID,
      amount: 5000,
      status: 'pending'
    });

    await transaction.save();

    // Créer une facture PayDunya
    const invoice = new Paydunya.CheckoutInvoice(setup, store);

    // Ajouter des articles à la facture avec une référence unique
    invoice.addItem(
      `Abonnement Premium - ${uniqueReference}`,
      1,
      200.00,
      200.00,
      `Accès illimité à tous les quiz premium - Référence: ${uniqueReference}`
    );

    invoice.totalAmount = 200.00;
    invoice.description = `Abonnement Premium Quiz de Carabin - ${uniqueReference}`;

    // Utiliser les URLs de callback
    const baseUrl = process.env.API_BASE_URL;
    const frontendUrl = process.env.FRONTEND_URL;
    
    invoice.callbackURL = `${baseUrl}/api/payment/callback`;
    invoice.returnURL = `${frontendUrl}/payment-callback.html?token=${encodeURIComponent(req.user.token)}&user=${encodeURIComponent(JSON.stringify(req.user))}`;
    invoice.cancelURL = `${frontendUrl}/payment-error.html`;

    // Ajouter des données personnalisées avec référence unique
    invoice.addCustomData('user_id', req.user._id.toString());
    invoice.addCustomData('user_email', req.user.email);
    invoice.addCustomData('service', 'premium_subscription');
    invoice.addCustomData('transaction_id', transactionID);
    invoice.addCustomData('unique_reference', uniqueReference);
    invoice.addCustomData('timestamp', Date.now().toString());

    // Créer la facture
    console.log('Création de la facture PayDunya...');
    console.log('Transaction ID:', transactionID);
    console.log('Unique Reference:', uniqueReference);
    
    const created = await invoice.create();
    
    // Logs de réponse de PayDunya
    console.log('PayDunya Invoice Response:', invoice.responseText);
    console.log('PayDunya Invoice Status:', invoice.status);
    console.log('PayDunya Invoice Token:', invoice.token);
    console.log('PayDunya Invoice URL:', invoice.url);
    
    // CORRECTION: "Transaction Found" n'est pas une erreur!
    if (created || invoice.token) {
      // Mettre à jour la transaction avec le token PayDunya
      transaction.paydunyaInvoiceToken = invoice.token;
      transaction.paydunyaInvoiceURL = invoice.url;
      transaction.status = 'pending'; // Rester en attente jusqu'au webhook
      await transaction.save();

      console.log('✅ Payment invoice created successfully');
      console.log('Invoice URL:', invoice.url);

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: invoice.url,
        token: invoice.token
      });
    } else {
      // Marquer la transaction comme échouée
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

// Gestionnaire de webhook pour PayDunya
exports.handleCallback = async (req, res) => {
  try {
    console.log('📨 Webhook reçu de PayDunya:', JSON.stringify(req.body, null, 2));
    
    const data = req.body.data;
    
    if (!data) {
      console.error('❌ Données manquantes dans le webhook');
      return res.status(400).send('Données manquantes');
    }
    
    const token = data.invoice?.token;
    
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
      await transaction.save();
      
      const user = await User.findById(transaction.userId);
      if (user) {
        // Générer un code d'accès unique
        const accessCode = generateCode();
        
        // Enregistrer le code d'accès
        const newAccessCode = new AccessCode({
          code: accessCode,
          email: user.email,
          userId: user._id,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
        });
        
        await newAccessCode.save();
        
        console.log('✅ Code d\'accès généré:', accessCode);
        
        // Envoyer l'email avec le code d'accès
        const customerEmail = data.customer?.email || user.email;
        const emailSent = await sendEmail({
          to: customerEmail,
          subject: 'Votre Code d\'Accès Premium - Quiz de Carabin',
          text: `Votre code d'accès premium est: ${accessCode}. Ce code expire dans 30 minutes.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4CAF50;">Félicitations!</h2>
              <p>Votre abonnement premium a été activé avec succès.</p>
              <p>Voici votre code d'accès unique:</p>
              <div style="text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #4CAF50;">${accessCode}</span>
              </div>
              <p>Ce code expire dans <strong>30 minutes</strong>.</p>
              <p>Utilisez-le pour accéder à tous les quizzes premium.</p>
              <br>
              <p>Merci pour votre confiance!</p>
              <p>L'équipe Quiz de Carabin</p>
            </div>
          `
        });
        
        if (emailSent) {
          console.log('✅ Email avec code d\'accès envoyé à:', customerEmail);
        } else {
          console.error('❌ Échec de l\'envoi de l\'email à:', customerEmail);
        }
      }
      
      console.log('✅ Paiement confirmé pour la transaction:', transaction.transactionId);
    } else if (data.status === 'failed') {
      transaction.status = 'failed';
      await transaction.save();
      console.log('❌ Paiement échoué pour la transaction:', transaction.transactionId);
    } else {
      console.log('📊 Statut non traité:', data.status);
    }
    
    res.status(200).send('Webhook traité avec succès');
  } catch (error) {
    console.error('❌ Erreur dans handleCallback:', error);
    res.status(500).send('Erreur de traitement du webhook');
  }
  // Après avoir généré le code d'accès, ajoutez:
console.log('=== CODE D\'ACCÈS POUR DÉBOGAGE ===');
console.log('Code:', accessCode);
console.log('Email:', customerEmail);
console.log('Expiration:', newAccessCode.expiresAt);
console.log('=== FIN CODE D\'ACCÈS ===');

// Et stockez aussi le code dans la transaction pour référence
transaction.accessCode = accessCode;
await transaction.save();
};

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

    // Rechercher le code d'accès
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

    // Marquer le code comme utilisé
    accessCode.used = true;
    await accessCode.save();

    // Activer le statut premium de l'utilisateur
    const user = await User.findById(userId);
    user.isPremium = true;
    user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an
    await user.save();

    console.log('✅ Code d\'accès validé pour l\'utilisateur:', user.email);

    res.status(200).json({
      success: true,
      message: "Code validé avec succès. Votre compte est maintenant premium!",
      premium: true,
      premiumExpiresAt: user.premiumExpiresAt
    });

  } catch (error) {
    console.error('❌ Erreur dans validateAccessCode:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la validation du code"
    });
  }
};

// Fonctions supplémentaires (keep them at the end)
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Implémentez la logique de vérification du statut de paiement
    res.status(200).json({
      success: true,
      status: 'completed',
      message: 'Statut de paiement vérifié'
    });
  } catch (error) {
    console.error('Error in checkPaymentStatus:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la vérification du statut",
      error: error.message
    });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    // Implémentez la logique de traitement des webhooks PayDunya
    console.log('Webhook reçu:', req.body);
    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error in handleWebhook:', error);
    res.status(500).send('Webhook processing error');
  }
};