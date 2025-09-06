const Paydunya = require('paydunya');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');

const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
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
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT ===');
    
    const user = req.user;
    const transactionId = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();

    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (user.isPremium && user.premiumExpiresAt > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un abonnement premium actif'
      });
    }

    // Enregistrer la transaction en base de données
    const transaction = new Transaction({
      userId: user._id,
      transactionId: transactionId,
      amount: 5000,
      status: 'pending'
    });

    await transaction.save();

    // Créer la facture PayDunya
    const invoice = new Paydunya.CheckoutInvoice(setup, store);

    // Ajouter des articles à la facture avec un libellé unique
    invoice.addItem(
      `Abonnement Premium Quiz de Carabin - ${timestamp}`,
      1,
      5000.00,
      5000.00,
      "Accès illimité à tous les quiz premium pendant 30 jours"
    );

    invoice.totalAmount = 5000.00;
    invoice.description = `Abonnement Premium - Quiz de Carabin - ${timestamp}`;
    
    // Utiliser les URLs de callback
    const baseUrl = process.env.API_BASE_URL || "https://quiz-de-carabin-backend.onrender.com";
    const frontendUrl = process.env.FRONTEND_URL || "https://quiz-de-carabin.netlify.app";
    
    invoice.callbackURL = `${baseUrl}/api/payment/webhook`;
    invoice.returnURL = `${frontendUrl}/payment-callback.html`;
    invoice.cancelURL = `${frontendUrl}/payment-error.html`;

    // Ajouter des données personnalisées avec un ID unique
    invoice.addCustomData('user_id', user._id.toString());
    invoice.addCustomData('user_email', user.email);
    invoice.addCustomData('service', 'premium_subscription');
    invoice.addCustomData('transaction_id', transactionId);
    invoice.addCustomData('timestamp', timestamp.toString());

    // Créer la facture
    console.log('Création de la facture PayDunya...');
    console.log('Transaction ID:', transactionId);
    console.log('Timestamp:', timestamp);
    
    const created = await invoice.create();
    
    if (created) {
      // Mettre à jour la transaction avec le token PayDunya
      transaction.paydunyaInvoiceToken = invoice.token;
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
      
      // Vérifier si c'est une erreur de transaction existante
      if (invoice.responseText.includes('Transaction Found') || invoice.responseText.includes('Duplicate')) {
        // Recommencer avec un nouvel ID unique
        console.log('🔄 Tentative avec un nouvel identifiant de transaction...');
        return this.initiatePayment(req, res); // Réessayer
      }
      
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création de la facture de paiement",
        error: invoice.responseText
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

exports.validateAccessCode = async (req, res) => {
  try {
    const { code, email } = req.body;

    if (!code || !email) {
      return res.status(400).json({
        success: false,
        message: "Code et email requis"
      });
    }

    // Rechercher l'utilisateur
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Vérifier si le code correspond
    if (user.accessCode !== code) {
      return res.status(400).json({
        success: false,
        message: "Code d'accès invalide"
      });
    }

    // Vérifier si le code n'a pas expiré (30 minutes)
    const now = new Date();
    if (now - user.accessCodeCreatedAt > 30 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: "Code expiré"
      });
    }

    // Activer l'abonnement premium
    user.isPremium = true;
    user.premiumExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
    user.accessCode = null;
    user.accessCodeCreatedAt = null;
    
    await user.save();

    res.status(200).json({
      success: true,
      message: "Abonnement activé avec succès! Vous avez maintenant accès à tous les quiz premium."
    });
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
    console.log('Webhook reçu:', req.body);
    
    const setup = setupPaydunya();
    const invoice = new Paydunya.CheckoutInvoice(setup, store);
    
    // Vérifier le statut de la facture
    invoice.confirm(req.body);
    
    console.log('Statut de la facture:', invoice.status);
    console.log('Données personnalisées:', invoice.custom_data);
    
    if (invoice.status === 'completed') {
      // Récupérer les données utilisateur
      const userId = invoice.custom_data.user_id;
      const userEmail = invoice.custom_data.user_email;
      
      console.log('Paiement réussi pour:', userEmail);
      
      // Trouver l'utilisateur
      const user = await User.findById(userId);
      
      if (user) {
        // Générer un code d'accès
        const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.accessCode = accessCode;
        user.accessCodeCreatedAt = new Date();
        
        await user.save();

        console.log(`Code d'accès généré pour ${user.email}: ${accessCode}`);
        
        // TODO: Envoyer un email avec le code d'accès
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in handleWebhook:', error);
    res.status(500).send('Webhook processing error');
  }
};