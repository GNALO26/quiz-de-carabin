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

// Fonction pour envoyer des emails avec gestion d'erreur améliorée
const sendAccessCodeEmail = async (email, accessCode, transactionId) => {
  try {
    console.log(`Tentative d'envoi d'email à: ${email}`);
    
    const mailOptions = {
      from: {
        name: 'Quiz de Carabin',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Votre code d\'accès Premium - Quiz de Carabin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Félicitations !</h2>
          <p>Votre abonnement premium a été activé avec succès.</p>
          <p>Voici votre code d'accès unique :</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #4CAF50; background: #f8f9fa; padding: 10px 20px; border-radius: 5px; display: inline-block;">
              ${accessCode}
            </span>
          </div>
          <p><strong>Ce code expire dans 30 minutes.</strong> Utilisez-le sur la page de validation pour activer votre compte premium.</p>
          <p>Référence de transaction: <strong>${transactionId}</strong></p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              Si vous n'avez pas effectué cet achat, veuillez contacter immédiatement notre support à
              <a href="mailto:support@quizdecarabin.bj" style="color: #4CAF50;">support@quizdecarabin.bj</a>
            </p>
          </div>
          <br>
          <p style="color: #6c757d; font-size: 14px; text-align: center;">
            L'équipe Quiz de Carabin<br>
            <a href="https://quizdecarabin.bj" style="color: #4CAF50;">https://quizdecarabin.bj</a>
          </p>
        </div>
      `,
      text: `
        Félicitations !
        
        Votre abonnement premium a été activé avec succès.
        
        Voici votre code d'accès unique: ${accessCode}
        
        Ce code expire dans 30 minutes. Utilisez-le sur la page de validation pour activer votre compte premium.
        
        Référence de transaction: ${transactionId}
        
        Si vous n'avez pas effectué cet achat, veuillez contacter immédiatement notre support à support@quizdecarabin.bj
        
        L'équipe Quiz de Carabin
        https://quizdecarabin.bj
      `
    };
    
    // Ajouter un timeout pour éviter que l'email bloque le processus
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout sending email')), 30000);
    });

    const info = await Promise.race([emailPromise, timeoutPromise]);
    
    console.log('✅ Email envoyé avec succès à:', email);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Erreur détaillée envoi email:');
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('Réponse SMTP:', error.response);
    }
    
    if (error.code) {
      console.error('Code d\'erreur:', error.code);
    }
    
    return false;
  }
};

// Gestionnaire de webhook amélioré
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
      console.error('❌ Token manquant dans le webhook');
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
      
      const user = await User.findById(transaction.userId);
      if (user) {
        const accessCode = generateCode();
        
        const newAccessCode = new AccessCode({
          code: accessCode,
          email: user.email,
          userId: user._id,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000)
        });
        
        await newAccessCode.save();
        
        console.log('✅ Code d\'accès généré:', accessCode);
        
        // Envoyer l'email avec le code d'accès
        const customerEmail = data.customer?.email || user.email;
        const emailSent = await sendAccessCodeEmail(customerEmail, accessCode, transaction.transactionId);
        
        // Stocker le code dans la transaction dans tous les cas
        transaction.accessCode = accessCode;
        
        if (!emailSent) {
          console.error(`❌ Échec de l'envoi de l'email à ${customerEmail}`);
        } else {
          console.log(`✅ Email envoyé avec succès à ${customerEmail}`);
        }
      }
      
      await transaction.save();
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

// Ajoutez cette fonction pour permettre la récupération du code
exports.getAccessCode = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const transaction = await Transaction.findOne({
      transactionId: transactionId,
      userId: req.user._id
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction non trouvée"
      });
    }
    
    if (!transaction.accessCode) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès trouvé pour cette transaction"
      });
    }
    
    res.status(200).json({
      success: true,
      accessCode: transaction.accessCode
    });
  } catch (error) {
    console.error('Erreur récupération code accès:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};