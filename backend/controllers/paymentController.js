const Paydunya = require('paydunya');

// Configuration de Paydunya
const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
  mode: process.env.PAYDUNYA_MODE || 'live' // 'test' ou 'live'
});

const store = new Paydunya.Store({
  name: "Quiz de Carabin",
  tagline: "Formation médicale par quiz",
  postalAddress: "Ouidah, Bénin",
  phoneNumber: process.env.STORE_PHONE || "+22956035888",
  websiteURL: process.env.FRONTEND_URL || "https://quiz-de-carabin.netlify.app",
  logoURL: process.env.STORE_LOGO_URL || "https://quiz-de-carabin.netlify.app/assets/images/logo.png"
});

exports.initiatePayment = async (req, res) => {
  try {
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
    const created = await invoice.create();
    
    if (created) {
      console.log('Payment invoice created:', invoice.token);

      // Ici, vous devriez enregistrer la transaction dans votre base de données
      // avec le statut "en attente"

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: invoice.getInvoiceURL(),
        token: invoice.token
      });
    } else {
      console.error('Failed to create invoice:', invoice.responseText);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la création de la facture de paiement",
        error: invoice.responseText
      });
    }
  } catch (error) {
    console.error('Error in initiatePayment:', error);
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

    // Ici, vous devriez vérifier le code dans votre base de données
    // Pour l'exemple, nous utilisons un code fixe
    const validCode = "CARABIN2024";
    
    if (code === validCode) {
      // Marquer l'utilisateur comme premium dans la base de données
      // Cette partie dépend de votre modèle User

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
    
    // Vérifier le statut du paiement avec l'API PayDunya
    const invoice = new Paydunya.CheckoutInvoice(setup, store);
    invoice.token = paymentId;
    
    const status = await invoice.confirm();
    
    if (status) {
      res.status(200).json({
        success: true,
        status: invoice.status,
        message: `Statut de paiement: ${invoice.status}`
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Impossible de vérifier le statut du paiement"
      });
    }
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
    const { data } = req.body;
    
    // Vérifier la signature du webhook
    if (setup.verifyWebhook(req.headers)) {
      console.log('Webhook reçu:', data);
      
      // Traiter le webhook en fonction du statut
      if (data.status === 'completed') {
        // Mettre à jour l'utilisateur comme premium dans la base de données
        const userId = data.custom_data.user_id;
        console.log('Payment completed for user:', userId);
        
        // Ici, mettez à jour votre base de données
      }
      
      res.status(200).send('Webhook processed');
    } else {
      console.error('Webhook signature verification failed');
      res.status(400).send('Invalid signature');
    }
  } catch (error) {
    console.error('Error in handleWebhook:', error);
    res.status(500).send('Webhook processing error');
  }
};