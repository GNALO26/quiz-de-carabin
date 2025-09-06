const Paydunya = require('paydunya');
const User = require('../models/User');
const { cleanPaydunyaKey } = require('../utils/cleanKeys');

// Configuration de PayDunya
const setupPaydunya = () => {
  // Nettoyer les clés PayDunya
  let masterKey = cleanPaydunyaKey(process.env.PAYDUNYA_MASTER_KEY);
  const privateKey = cleanPaydunyaKey(process.env.PAYDUNYA_PRIVATE_KEY);
  const publicKey = cleanPaydunyaKey(process.env.PAYDUNYA_PUBLIC_KEY);
  const token = cleanPaydunyaKey(process.env.PAYDUNYA_TOKEN);

  // Correction du format de la clé master si nécessaire
  if (masterKey && !masterKey.startsWith('master_live_') && !masterKey.startsWith('masterKey_')) {
    console.log('⚠  Correction du format de la clé master');
    masterKey = 'master_live_' + masterKey;
  }

  console.log('Configuration PayDunya:');
  console.log('Mode:', process.env.PAYDUNYA_MODE || 'live');
  console.log('Master Key:', masterKey ? masterKey.substring(0, 15) + '...' : 'Non définie');
  console.log('Private Key:', privateKey ? privateKey.substring(0, 15) + '...' : 'Non définie');

  return new Paydunya.Setup({
    masterKey: masterKey,
    privateKey: privateKey,
    publicKey: publicKey,
    token: token,
    mode: process.env.PAYDUNYA_MODE || 'live'
  });
};

const store = new Paydunya.Store({
  name: "Quiz de Carabin",
  tagline: "Formation médicale par quiz",
  postalAddress: "Cotonou, Bénin",
  phoneNumber: process.env.STORE_PHONE || "+2290156035888",
  websiteURL: process.env.FRONTEND_URL || "https://quiz-de-carabin.netlify.app",
  logoURL: process.env.STORE_LOGO_URL || "https://quiz-de-carabin.netlify.app/assets/images/logo.png"
});

exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT ===');
    console.log('User ID:', req.user._id);

    const setup = setupPaydunya();
    const { callback_url } = req.body;
    const user = req.user;

    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (user.isPremium && user.premiumExpiresAt > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un abonnement premium actif'
      });
    }

    // Créer une facture
    const invoice = new Paydunya.CheckoutInvoice(setup, store);

    // Ajouter des articles à la facture
    invoice.addItem(
      "Abonnement Premium Quiz de Carabin",
      1,
      5000.00,
      5000.00,
      "Accès illimité à tous les quiz premium pendant 30 jours"
    );

    invoice.totalAmount = 5000.00;
    invoice.description = "Abonnement Premium - Quiz de Carabin";
    invoice.callbackURL = process.env.API_BASE_URL + "/api/payment/webhook";
    invoice.returnURL = callback_url || `${process.env.FRONTEND_URL}/payment-callback.html`;
    invoice.cancelURL = `${process.env.FRONTEND_URL}/payment-error.html`;

    // Ajouter des données personnalisées
    invoice.addCustomData('user_id', user._id.toString());
    invoice.addCustomData('user_email', user.email);
    invoice.addCustomData('service', 'premium_subscription');

    // Créer la facture
    console.log('Création de la facture PayDunya...');
    const created = await invoice.create();
    
    if (created) {
      console.log('✅ Payment invoice created successfully');
      console.log('Invoice URL:', invoice.getInvoiceURL());

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: invoice.getInvoiceURL(),
        token: invoice.token
      });
    } else {
      console.error('❌ Échec de la création de la facture:', invoice.responseText);
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
      error: error.message
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