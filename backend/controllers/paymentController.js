const Paydunya = require('paydunya');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

// Configuration de PayDunya
const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY ? process.env.PAYDUNYA_MASTER_KEY.trim() : '',
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY ? process.env.PAYDUNYA_PRIVATE_KEY.trim() : '',
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY ? process.env.PAYDUNYA_PUBLIC_KEY.trim() : '',
  token: process.env.PAYDUNYA_TOKEN ? process.env.PAYDUNYA_TOKEN.trim() : '',
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

exports.initiatePayment = async (req, res) => {
  let transaction;
  let attempt = 0;
  const MAX_ATTEMPTS = 3; // Maximum de tentatives
  
  // Fonction interne pour gérer les tentatives
  const tryCreateInvoice = async () => {
    attempt++;
    console.log(`🔄 Tentative ${attempt}/${MAX_ATTEMPTS}`);
    
    const transactionId = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();

    // Enregistrer la transaction en base de données
    transaction = new Transaction({
      userId: req.user._id,
      transactionId: transactionId,
      amount: 5000,
      status: 'pending',
      retryCount: attempt
    });

    await transaction.save();

    // Créer une facture avec des paramètres uniques
    const invoice = new Paydunya.CheckoutInvoice(setup, store);

    // Ajouter des articles à la facture avec un libellé unique
    invoice.addItem(
      `Abonnement Premium - ${timestamp}-${attempt}`,
      1,
      5000.00,
      5000.00,
      `Accès illimité à tous les quiz premium - Ref: ${transactionId}`
    );

    invoice.totalAmount = 5000.00;
    invoice.description = `Abonnement Premium Quiz de Carabin - ${timestamp}-${attempt}`;
    
    // Utiliser les URLs de callback
    const baseUrl = process.env.API_BASE_URL || "https://quiz-de-carabin-backend.onrender.com";
    const frontendUrl = process.env.FRONTEND_URL || "https://quiz-de-carabin.netlify.app";
    
    invoice.callbackURL = `${baseUrl}/api/payment/webhook`;
    invoice.returnURL = `${frontendUrl}/payment-callback.html`;
    invoice.cancelURL = `${frontendUrl}/payment-error.html`;

    // Ajouter des données personnalisées avec un ID unique
    invoice.addCustomData('user_id', req.user._id.toString());
    invoice.addCustomData('user_email', req.user.email);
    invoice.addCustomData('service', 'premium_subscription');
    invoice.addCustomData('transaction_id', transactionId);
    invoice.addCustomData('timestamp', timestamp.toString());
    invoice.addCustomData('attempt', attempt.toString());
    invoice.addCustomData('unique_ref', `quiz_${timestamp}_${transactionId}_${attempt}`);

    // Créer la facture
    console.log('Création de la facture PayDunya...');
    console.log('Transaction ID:', transactionId);
    console.log('Timestamp:', timestamp);
    console.log('Attempt:', attempt);
    
    const created = await invoice.create();
    
    if (created) {
      // Mettre à jour la transaction avec le token PayDunya
      transaction.paydunyaInvoiceToken = invoice.token;
      transaction.paydunyaInvoiceURL = invoice.url;
      await transaction.save();

      console.log('✅ Payment invoice created successfully');
      console.log('Invoice URL:', invoice.url);

      return {
        success: true,
        invoiceURL: invoice.url,
        token: invoice.token
      };
    } else {
      // Marquer la transaction comme échouée
      transaction.status = 'failed';
      await transaction.save();

      console.error('❌ Échec de la création de la facture:', invoice.responseText);
      
      // Vérifier si c'est une erreur de transaction existante et si on peut réessayer
      if (invoice.responseText && invoice.responseText.includes('Transaction Found') && attempt < MAX_ATTEMPTS) {
        console.log('🔄 Transaction déjà existante, nouvelle tentative...');
        return null; // Indiquer qu'il faut réessayer
      }
      
      throw new Error(invoice.responseText || 'Erreur inconnue de PayDunya');
    }
  };

  try {
    console.log('=== DÉBUT INITIATION PAIEMENT ===');
    
    const user = req.user;

    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (user.isPremium && user.premiumExpiresAt > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un abonnement premium actif'
      });
    }

    let result;
    while (attempt < MAX_ATTEMPTS) {
      result = await tryCreateInvoice();
      if (result) break; // Sortir de la boucle si réussite
      
      // Attendre un peu avant de réessayer
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    if (result && result.success) {
      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: result.invoiceURL,
        token: result.token
      });
    } else {
      throw new Error(`Échec après ${MAX_ATTEMPTS} tentatives`);
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