const { cleanPaydunyaKey } = require('../utils/cleanKeys');
const Paydunya = require('paydunya');

exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT LIVE ===');

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

    console.log('Clés utilisées:');
    console.log('Master Key:', masterKey.substring(0, 15) + '...');
    console.log('Private Key:', privateKey.substring(0, 15) + '...');
    console.log('Public Key:', publicKey.substring(0, 15) + '...');
    console.log('Token:', token.substring(0, 5) + '...');

    // Vérification que toutes les clés sont présentes
    if (!masterKey || !privateKey || !publicKey || !token) {
      console.error('Clés PayDunya manquantes');
      return res.status(500).json({
        success: false,
        message: "Configuration de paiement incomplète"
      });
    }

    // Configuration de Paydunya avec les clés corrigées
    const setup = new Paydunya.Setup({
      masterKey: masterKey,
      privateKey: privateKey,
      publicKey: publicKey,
      token: token,
      mode: 'live'
    });

    const store = new Paydunya.Store({
      name: "Quiz de Carabin",
      tagline: "Formation médicale par quiz",
      postalAddress: "Cotonou, Bénin",
      phoneNumber: process.env.STORE_PHONE || "+2290156035888",
      websiteURL: process.env.FRONTEND_URL || "https://quiz-de-carabin.netlify.app",
      logoURL: process.env.STORE_LOGO_URL
    });

    const { callback_url } = req.body;
    const user = req.user;

    console.log('Initiating payment for user:', user._id);

    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (user.isPremium) {
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
      "Accès illimité à tous les quiz premium"
    );

    invoice.totalAmount = 5000.00;
    invoice.description = "Abonnement Premium - Quiz de Carabin";
    invoice.callbackURL = callback_url || `${process.env.FRONTEND_URL}/payment-callback.html`;
    invoice.cancelURL = `${process.env.FRONTEND_URL}/payment-error.html`;
    invoice.returnURL = `${process.env.FRONTEND_URL}/payment-callback.html`;

    // Ajouter des données personnalisées
    invoice.addCustomData('user_id', user._id.toString());
    invoice.addCustomData('user_email', user.email);
    invoice.addCustomData('service', 'premium_subscription');

    // Créer la facture
    console.log('Création de la facture PayDunya...');
    const created = await invoice.create();
    
    if (created) {
      console.log('Payment invoice created successfully');
      console.log('Invoice URL:', invoice.getInvoiceURL());
      console.log('Token:', invoice.token);

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: invoice.getInvoiceURL(),
        token: invoice.token
      });
    } else {
      console.error('Échec de la création de la facture:', invoice.responseText);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création de la facture de paiement",
        error: invoice.responseText
      });
    }
  } catch (error) {
    console.error('Erreur dans initiatePayment:', error);
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
    // Pour l'instant, retournons une réponse factice
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