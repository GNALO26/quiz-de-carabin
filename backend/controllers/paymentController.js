const Paydunya = require('paydunya');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

// Configuration de PayDunya
const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY.trim(),
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY.trim(),
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY.trim(),
  token: process.env.PAYDUNYA_TOKEN.trim(),
  mode: process.env.PAYDUNYA_MODE || 'live'
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
      5000.00,
      5000.00,
      `Accès illimité à tous les quiz premium - Référence: ${uniqueReference}`
    );

    invoice.totalAmount = 5000.00;
    invoice.description = `Abonnement Premium Quiz de Carabin - ${uniqueReference}`;

    // Utiliser les URLs de callback
    const baseUrl = process.env.API_BASE_URL;
    const frontendUrl = process.env.FRONTEND_URL;
    
    invoice.callbackURL = `${baseUrl}/api/payment/webhook`;
    invoice.returnURL = `${frontendUrl}/payment-callback.html`;
    invoice.cancelURL = `${frontendUrl}/payment-error.html`;

    // Ajouter des données personnalisées avec référence unique
    invoice.addCustomData('user_id', req.user._id.toString());
    invoice.addCustomData('user_email', req.user.email);
    invoice.addCustomData('service', 'premium_subscription');
    invoice.addCustomData('transaction_id', transactionID);
    invoice.addCustomData('unique_reference', uniqueReference);

    // Créer la facture
    console.log('Création de la facture PayDunya...');
    console.log('Transaction ID:', transactionID);
    console.log('Unique Reference:', uniqueReference);
    
    const created = await invoice.create();
    
    // Logs de réponse de PayDunya (placés au bon endroit)
    console.log('PayDunya Invoice Response:', invoice.responseText);
    console.log('PayDunya Invoice Status:', invoice.status);
    console.log('PayDunya Invoice Token:', invoice.token);
    console.log('PayDunya Invoice URL:', invoice.url);
    
    if (created) {
      // Mettre à jour la transaction avec le token PayDunya
      transaction.paydunyaInvoiceToken = invoice.token;
      transaction.paydunyaInvoiceURL = invoice.url;
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
    
    let errorMessage = "Erreur serveur lors de l'initiation du paiement";
    
    // Messages d'erreur spécifiques à PayDunya
    if (error.message.includes('Transaction Found')) {
      errorMessage = "Une transaction similaire existe déjà. Veuillez réessayer dans quelques instants.";
    } else if (error.message.includes('Authentication')) {
      errorMessage = "Erreur d'authentification avec le service de paiement. Veuillez contacter le support.";
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ... autres fonctions (validateAccessCode, checkPaymentStatus, handleWebhook)

exports.validateAccessCode = async (req, res) => {
  try {
    const { code, email } = req.body;

    // Code de validation (exemple)
    const validCode = "CARABIN2024";
    
    if (code === validCode) {
      res.status(200).json({
        success: true,
        message: "Code validé avec succès. Votre compte a été mis à jour vers Premium."
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Code d'accès invalide"
      });
    }
  } catch (error) {
    console.error('Error in validateAccessCode:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la validation du code",
      error: error.message
    });
  }
};

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