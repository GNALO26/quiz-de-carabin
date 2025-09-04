const Paydunya = require('paydunya');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const { sendEmail } = require('../utils/emailService');
const generateCode = require('../utils/generateCode');

// Configuration de Paydunya
const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
  mode: process.env.PAYDUNYA_MODE,
});

const store = new Paydunya.Store({
  name: 'Quiz de Carabin',
  tagline: 'Abonnement aux quiz médicaux',
  postalAddress: 'Cotonou, Bénin',
  phoneNumber: '+229XXXXXXXX',
  websiteURL: process.env.FRONTEND_URL,
  logoURL: `${process.env.FRONTEND_URL}/logo.png`,
});

exports.initiatePayment = async (req, res) => {
  try {
    const { callback_url } = req.body;
    const user = await User.findById(req.user.id);

    const invoice = new Paydunya.CheckoutInvoice(setup, store);

    invoice.addItem('Abonnement Premium 30 jours', 1, 5000, 5000);
    invoice.totalAmount = 5000;

    invoice.description = 'Accès à tous les quiz pendant 30 jours';
    invoice.addCustomData('user_id', user._id.toString());
    invoice.addCustomData('email', user.email);

    // URL de retour après paiement
    invoice.callbackURL = callback_url || `${process.env.FRONTEND_URL}/payment-callback`;

    invoice.create()
      .then(() => {
        res.json({ 
          success: true, 
          invoiceURL: invoice.invoiceURL,
          token: invoice.token
        });
      })
      .catch(error => {
        console.error('Paydunya error:', error);
        res.status(500).json({ 
          success: false, 
          message: 'Erreur lors de la création de la facture' 
        });
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
};

exports.handlePaymentCallback = async (req, res) => {
  try {
    const { token } = req.query;
    
    const invoice = new Paydunya.CheckoutInvoice(setup, store);
    invoice.confirm(token);

    if (invoice.status === 'completed') {
      const userEmail = invoice.custom_data.email;
      const user = await User.findOne({ email: userEmail });
      
      if (user) {
        // Générer un code d'accès
        const accessCode = generateCode();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        
        // Sauvegarder le code
        await AccessCode.create({
          code: accessCode,
          email: userEmail,
          expiresAt,
          used: false
        });
        
        // Envoyer le code par email
        await sendEmail({
          to: userEmail,
          subject: 'Votre code d\'accès Quiz de Carabin',
          text: `Votre code d'accès est : ${accessCode}. Il est valable 30 minutes.`,
          html: `<p>Votre code d'accès est : <strong>${accessCode}</strong>. Il est valable 30 minutes.</p>`
        });
        
        // Rediriger vers la page de saisie de code
        res.redirect(`${process.env.FRONTEND_URL}/enter-code?email=${encodeURIComponent(userEmail)}`);
      } else {
        res.redirect(`${process.env.FRONTEND_URL}/payment-error?message=Utilisateur non trouvé`);
      }
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/payment-error?message=Paiement échoué`);
    }
  } catch (error) {
    console.error(error);
    res.redirect(`${process.env.FRONTEND_URL}/payment-error?message=Erreur serveur`);
  }
};

exports.validateAccessCode = async (req, res) => {
  try {
    const { code, email } = req.body;
    
    const accessCode = await AccessCode.findOne({ 
      code, 
      email,
      used: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (!accessCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Code invalide ou expiré' 
      });
    }
    
    // Marquer le code comme utilisé
    accessCode.used = true;
    await accessCode.save();
    
    // Activer l'abonnement premium
    const user = await User.findOne({ email });
    user.isPremium = true;
    user.premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Abonnement activé avec succès' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
};