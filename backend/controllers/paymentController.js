const Paydunya = require('paydunya');
const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const Transaction = require('../models/Transaction');
const { generateCode, validateCodeFormat } = require('../utils/generateCode');
const transporter = require('../config/email');
const crypto = require('crypto');

// Configuration PayDunya
const setup = new Paydunya.Setup({
  masterKey: process.env.PAYDUNYA_MASTER_KEY,
  privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
  publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
  token: process.env.PAYDUNYA_TOKEN,
  mode: process.env.PAYDUNYA_MODE || 'test'
});

const store = new Paydunya.Store({
  name: "Quiz de Carabin",
  tagline: "Plateforme de quiz médicaux",
  postalAddress: "Cotonou, Bénin",
  phoneNumber: process.env.STORE_PHONE,
  websiteURL: process.env.FRONTEND_URL,
  logoURL: process.env.STORE_LOGO_URL
});

// Fonction pour envoyer des emails avec code d'accès
const sendAccessCodeEmail = async (email, accessCode, userName = '') => {
  try {
    const mailOptions = {
      from: `"Quiz de Carabin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Votre code d\'accès Premium - 🩺 Quiz de Carabin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #13a718;">Félicitations ${userName}!</h2>
          </div>
          <p>Votre abonnement premium a été activé avec succès.</p>
          <p>Voici votre code d'accès unique:</p>
          <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1e53a2; padding: 10px 20px; background-color: #e9ecef; border-radius: 6px;">${accessCode}</span>
          </div>
          <p><strong>Ce code expire dans 30 minutes.</strong></p>
          <p>Utilisez-le sur la page de validation pour activer votre compte premium.</p>
          <p>Si vous n'avez pas initié cette demande, veuillez ignorer cet email.</p>
          <br>
          <p>Cordialement,</p>
          <p>L'équipe 🩺 <strong>Quiz de Carabin</strong> 🩺</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 12px; color: #6c757d;">Cet email a été envoyé automatiquement, veuillez ne pas y répondre.</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé avec succès:', info.messageId);
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
    
    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (user.isPremium && new Date(user.premiumExpiresAt) > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà un abonnement premium actif'
      });
    }

    // Vérifier s'il existe déjà une transaction en cours pour cet utilisateur
    const existingTransaction = await Transaction.findOne({
      userId: user._id,
      status: 'pending',
      createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) } // dans les 30 dernières minutes
    });

    if (existingTransaction) {
      return res.status(400).json({
        success: false,
        message: 'Une transaction est déjà en cours. Veuillez patienter ou annuler la transaction précédente.',
        transactionId: existingTransaction.transactionId,
        invoiceURL: existingTransaction.paydunyaInvoiceURL
      });
    }

    const transactionId = 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    const transaction = new Transaction({
      userId: user._id,
      transactionId: transactionId,
      amount: 200, // 5000 FCFA
      status: 'pending'
    });

    await transaction.save();

    const invoice = new Paydunya.CheckoutInvoice(setup, store);
    invoice.addItem('Abonnement Premium Quiz de Carabin', 1, 5000, 5000, 'Accès à tous les quiz premium pendant 1 an');
    invoice.totalAmount = 200;
    invoice.description = 'Abonnement Premium Quiz de Carabin';

    invoice.callbackURL = `${process.env.API_BASE_URL}/api/payment/callback`;
    invoice.returnURL = `${process.env.FRONTEND_URL}/payment-callback.html?transactionId=${transactionId}&userId=${user._id}`;
    invoice.cancelURL = `${process.env.FRONTEND_URL}/payment-error.html`;

    invoice.addCustomData('user_id', user._id.toString());
    invoice.addCustomData('user_email', user.email);
    invoice.addCustomData('transaction_id', transactionId);

    const created = await invoice.create();
    
    if (created) {
      transaction.paydunyaInvoiceToken = invoice.token;
      transaction.paydunyaInvoiceURL = invoice.url;
      await transaction.save();

      console.log('✅ Facture PayDunya créée avec succès');

      res.status(200).json({
        success: true,
        message: "Paiement initié avec succès",
        invoiceURL: invoice.url,
        transactionId: transactionId
      });
    } else {
      transaction.status = 'failed';
      await transaction.save();

      console.error('❌ Échec création facture PayDunya:', invoice.responseText);
      
      res.status(400).json({
        success: false,
        message: "Erreur lors de la création du paiement: " + (invoice.responseText || 'Erreur inconnue')
      });
    }
  } catch (error) {
    console.error('❌ Erreur dans initiatePayment:', error);
    
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'initiation du paiement"
    });
  }
};

// Gestionnaire de webhook
exports.handleCallback = async (req, res) => {
  try {
    console.log('📨 Webhook reçu de PayDunya:', JSON.stringify(req.body, null, 2));
    
    const data = req.body;
    const token = data.invoice?.token || data.custom_data?.invoice_token;
    
    if (!token) {
      console.error('❌ Token manquant dans le webhook');
      return res.status(400).send('Token manquant');
    }
    
    const transaction = await Transaction.findOne({ paydunyaInvoiceToken: token });
    
    if (!transaction) {
      console.error('❌ Transaction non trouvée pour le token:', token);
      return res.status(404).send('Transaction non trouvée');
    }
    
    console.log('📊 Statut reçu du webhook:', data.status);
    
    if (data.status === 'completed') {
      // Vérifier si le paiement n'a pas déjà été traité
      if (transaction.status === 'completed') {
        console.log('⚠ Paiement déjà traité');
        return res.status(200).send('Paiement déjà traité');
      }
      
      transaction.status = 'completed';
      
      // Générer et sauvegarder le code d'accès
      const accessCode = generateCode();
      transaction.accessCode = accessCode;
      await transaction.save();
      
      console.log('✅ Code d\'accès généré et sauvegardé:', accessCode);
      
      // Créer également un document AccessCode pour compatibilité
      try {
        const user = await User.findById(transaction.userId);
        if (user) {
          const accessCodeDoc = new AccessCode({
            code: accessCode,
            email: user.email,
            userId: user._id,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
          });
          await accessCodeDoc.save();
          console.log('✅ Code d\'accès sauvegardé dans la collection AccessCode');
          
          // Envoyer l'email avec le code d'accès
          const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name);
          
          if (emailSent) {
            console.log('✅ Email envoyé avec succès à:', user.email);
          } else {
            console.log('⚠ Échec de l\'envoi de l\'email à:', user.email);
            // On ne renvoie pas d'erreur car le code est sauvegardé et peut être renvoyé plus tard
          }
          
          // Mettre à jour le statut premium de l'utilisateur
          user.isPremium = true;
          user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an
          await user.save();
          
          console.log('✅ Statut premium mis à jour pour l\'utilisateur:', user.email);
        }
      } catch (accessCodeError) {
        console.error('❌ Erreur sauvegarde AccessCode:', accessCodeError);
        // Continuer quand même car le code est dans la transaction
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

// Vérifier et traiter un paiement après redirection
exports.processPaymentReturn = async (req, res) => {
  try {
    const { transactionId, userId } = req.body;
    
    console.log('Processing payment return for transaction:', transactionId);
    
    // Trouver la transaction
    const transaction = await Transaction.findOne({
      transactionId: transactionId,
      userId: userId
    });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction non trouvée"
      });
    }
    
    // Si la transaction est déjà complétée, renvoyer le code d'accès
    if (transaction.status === 'completed') {
      if (transaction.accessCode) {
        return res.status(200).json({
          success: true,
          status: 'completed',
          accessCode: transaction.accessCode,
          message: "Paiement déjà traité"
        });
      } else {
        // Générer un code d'accès si pour une raison quelconque il n'existe pas
        const accessCode = generateCode();
        transaction.accessCode = accessCode;
        await transaction.save();
        
        // Envoyer l'email
        const user = await User.findById(userId);
        if (user) {
          await sendAccessCodeEmail(user.email, accessCode, user.name);
        }
        
        return res.status(200).json({
          success: true,
          status: 'completed',
          accessCode: accessCode,
          message: "Code d'accès généré et envoyé"
        });
      }
    }
    
    // Si le paiement est en attente, vérifier avec PayDunya
    if (transaction.paydunyaInvoiceToken) {
      const invoice = new Paydunya.CheckoutInvoice(setup, store);
      const success = await invoice.confirm(transaction.paydunyaInvoiceToken);
      
      if (success && invoice.status === 'completed') {
        // Paiement confirmé, traiter comme dans handleCallback
        transaction.status = 'completed';
        
        // Générer et sauvegarder le code d'accès
        const accessCode = generateCode();
        transaction.accessCode = accessCode;
        await transaction.save();
        
        console.log('✅ Code d\'accès généré et sauvegardé:', accessCode);
        
        // Créer également un document AccessCode pour compatibilité
        try {
          const user = await User.findById(userId);
          if (user) {
            const accessCodeDoc = new AccessCode({
              code: accessCode,
              email: user.email,
              userId: user._id,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
            });
            await accessCodeDoc.save();
            console.log('✅ Code d\'accès sauvegardé dans la collection AccessCode');
            
            // Envoyer l'email avec le code d'accès
            const emailSent = await sendAccessCodeEmail(user.email, accessCode, user.name);
            
            if (emailSent) {
              console.log('✅ Email envoyé avec succès à:', user.email);
            } else {
              console.log('⚠ Échec de l\'envoi de l\'email à:', user.email);
            }
            
            // Mettre à jour le statut premium de l'utilisateur
            user.isPremium = true;
            user.premiumExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an
            await user.save();
            
            console.log('✅ Statut premium mis à jour pour l\'utilisateur:', user.email);
          }
        } catch (accessCodeError) {
          console.error('❌ Erreur sauvegarde AccessCode:', accessCodeError);
        }
        
        return res.status(200).json({
          success: true,
          status: 'completed',
          accessCode: accessCode,
          message: "Paiement confirmé avec succès"
        });
      } else {
        // Paiement pas encore confirmé
        return res.status(200).json({
          success: false,
          status: invoice.status || 'pending',
          message: "Paiement en attente de confirmation"
        });
      }
    }
    
    return res.status(400).json({
      success: false,
      message: "Impossible de vérifier le paiement"
    });
  } catch (error) {
    console.error('❌ Erreur dans processPaymentReturn:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du traitement du retour de paiement"
    });
  }
};

// Validation du code d'accès
exports.validateAccessCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code || !validateCodeFormat(code)) {
      return res.status(400).json({
        success: false,
        message: "Le code d'accès doit être composé de 6 chiffres"
      });
    }

    // Vérifier d'abord dans la transaction
    const transaction = await Transaction.findOne({
      userId: userId,
      status: 'completed',
      accessCode: code,
      accessCodeUsed: false
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

// Fonction pour renvoyer le code d'accès
exports.resendAccessCode = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier d'abord dans les transactions
    const transaction = await Transaction.findOne({
      userId: userId,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    if (transaction && transaction.accessCode) {
      // Réutiliser le code de la transaction
      const emailSent = await sendAccessCodeEmail(user.email, transaction.accessCode, user.name);
      
      if (emailSent) {
        return res.status(200).json({
          success: true,
          message: "Code d'accès renvoyé avec succès"
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Erreur lors de l'envoi de l'email"
        });
      }
    }

    // Si pas trouvé dans les transactions, chercher dans AccessCode
    const accessCode = await AccessCode.findOne({
      userId: userId,
      used: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!accessCode) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès actif trouvé"
      });
    }

    const emailSent = await sendAccessCodeEmail(user.email, accessCode.code, user.name);
    
    if (emailSent) {
      res.status(200).json({
        success: true,
        message: "Code d'accès renvoyé avec succès"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'envoi de l'email"
      });
    }
  } catch (error) {
    console.error('Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};