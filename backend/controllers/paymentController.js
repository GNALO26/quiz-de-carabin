const User = require('../models/User');
const AccessCode = require('../models/AccessCode');
const generateCode = require('../utils/generateCode');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const transporter = require('../config/email');
const kkiapay = require('../config/kkiapay');

// Définition des options d'abonnement
const pricing = {
  '1-month': { amount: 5000, description: "Abonnement Premium 1 mois", duration: 1 }, 
  '3-months': { amount: 12000, description: "Abonnement Premium 3 mois", duration: 3 },
  '10-months': { amount: 25000, description: "Abonnement Premium 10 mois", duration: 10 }
};

// Fonction utilitaire pour ajouter des mois à une date
const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
};

// Fonctions utilitaires
const generateUniqueTransactionID = () => {
  return 'TXN_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
};

const generateUniqueReference = () => {
  return 'REF_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Fonction pour envoyer des emails avec code d'accès
const sendAccessCodeEmail = async (email, accessCode, userName = 'Utilisateur', duration = '1 mois') => {
  try {
    console.log(`[EMAIL] 🔄 Tentative d'envoi de code d'accès (${accessCode}) à: ${email}`);
    
    const durationText = {
      '1-month': '1 mois',
      '3-months': '3 mois', 
      '10-months': '10 mois'
    }[duration] || duration;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Votre code d'accès Premium ${durationText} - 🩺 Quiz de Carabin`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #13a718ff; color: white; padding: 20px; text-align: center;">
            <h1>Quiz de Carabin</h1>
          </div>
          
          <div style="padding: 20px;">
            <h2 style="color: #13a718ff;">Félicitations ${userName}!</h2>
            <p>Votre abonnement premium <strong>${durationText}</strong> a été activé avec succès.</p>
            
            <p>Voici votre code d'accès unique:</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #1e53a2ff; background: #f8f9fa; padding: 15px; border-radius: 8px; display: inline-block;">
                ${accessCode}
              </span>
            </div>
            
            <p><strong>Durée de l'abonnement:</strong> ${durationText}</p>
            <p><strong>Vous pouvez utiliser ce code sur la page de validation si nécessaire. Votre compte Premium est maintenant actif.</strong></p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #13a718ff; margin-top: 0;">🎯 Avantages Premium :</h4>
              <ul style="margin-bottom: 0;">
                <li>Accès à tous les quiz médicaux</li>
                <li>Questions exclusives</li>
                <li>Statistiques détaillées</li>
                <li>Support prioritaire</li>
              </ul>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p>Merci pour votre confiance!</p>
              <p>L'équipe 🩺 Quiz de Carabin 🩺</p>
              <p><small>Si vous n'avez pas effectué cette demande, veuillez ignorer cet email.</small></p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Code envoyé avec succès. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] ❌ ERREUR FATALE ENVOI DE CODE D'ACCÈS à ${email}:`, error);
    return false;
  }
};

// Exporter la fonction
exports.sendAccessCodeEmail = sendAccessCodeEmail;

// Initier un paiement avec KkiaPay
exports.initiatePayment = async (req, res) => {
  try {
    console.log('=== DÉBUT INITIATION PAIEMENT KKiaPay ===');
    
    const { planId, amount } = req.body;
    const plan = pricing[planId];
    
    if (!plan || plan.amount !== parseInt(amount)) {
      console.error('❌ Erreur: Plan d\'abonnement ou montant invalide:', { planId, amount });
      return res.status(400).json({ success: false, message: 'Plan d\'abonnement ou montant invalide.' });
    }

    const user = req.user;
    const uniqueReference = generateUniqueReference();
    const transactionID = generateUniqueTransactionID();

    const transaction = new Transaction({
      userId: req.user._id,
      transactionId: transactionID,
      amount: plan.amount,
      durationInMonths: plan.duration,
      planId: planId,
      userEmail: req.user.email,
      status: 'pending',
      metadata: {
        plan_name: plan.description,
        user_name: user.name
      }
    });

    await transaction.save();

    // Configuration KkiaPay
    const frontendUrl = process.env.FRONTEND_URL || 'https://quiz-de-carabin.netlify.app';
    
    const paymentData = {
      amount: plan.amount,
      phone: user.phone || '+22900000000',
      email: user.email,
      callback: `${frontendUrl}/payment-callback.html?transactionId=${transactionID}`,
      metadata: {
        user_id: req.user._id.toString(),
        user_email: req.user.email,
        user_name: user.name,
        transaction_id: transactionID,
        plan_id: planId,
        plan_duration: plan.duration,
        plan_name: plan.description
      }
    };

    console.log('📤 Création paiement KkiaPay avec données:', paymentData);
    
    const paymentResponse = await kkiapay.createPayment(paymentData);
    
    if (paymentResponse && paymentResponse.success && paymentResponse.paymentUrl) {
      transaction.kkiapayTransactionId = paymentResponse.transactionId;
      transaction.kkiapayPaymentUrl = paymentResponse.paymentUrl;
      await transaction.save();

      console.log('✅ Lien de paiement direct créé avec succès:', paymentResponse.paymentUrl);

      res.status(200).json({
        success: true,
        message: "Lien de paiement généré avec succès",
        paymentUrl: paymentResponse.paymentUrl,
        transactionId: transactionID,
        plan: {
          id: planId,
          duration: plan.duration,
          description: plan.description
        }
      });
    } else {
      transaction.status = 'failed';
      await transaction.save();

      console.error('❌ Échec création lien direct:', paymentResponse);
      
      res.status(400).json({
        success: false,
        message: "Erreur lors de la création du lien de paiement: " + (paymentResponse?.message || 'Erreur inconnue')
      });
    }
  } catch (error) {
    console.error('❌ Erreur dans initiatePayment:', error.message);
    
    if (error.response) {
      console.error('Détail erreur API Kkiapay:', error.response.data);
      return res.status(error.response.status || 500).json({ 
        success: false, 
        message: error.response.data.message || 'Erreur API KkiaPay'
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Fonction utilitaire pour activer l'abonnement premium
exports.activatePremiumSubscription = async (transaction) => {
    try {
        console.log(`🎯 Activation abonnement pour transaction: ${transaction.transactionId}`);
        console.log(`⏰ Durée: ${transaction.durationInMonths} mois`);
        
        transaction.status = 'completed';
        const accessCode = generateCode();
        transaction.accessCode = accessCode;
        
        const user = await User.findById(transaction.userId);
        
        if (!user) {
            console.error('❌ Utilisateur non trouvé pour activation');
            return;
        }

        // Calculer les dates de début et fin
        const now = new Date();
        let startDate = now;
        
        // Si l'utilisateur a déjà un abonnement actif, continuer depuis la fin
        if (user.isPremium && user.premiumExpiresAt && user.premiumExpiresAt > now) {
            startDate = user.premiumExpiresAt;
            console.log(`📅 Prorogation: continuation depuis ${startDate}`);
        } else {
            console.log(`📅 Nouvel abonnement: début depuis ${startDate}`);
        }
        
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + transaction.durationInMonths);

        // Mettre à jour l'utilisateur
        user.isPremium = true;
        user.premiumExpiresAt = endDate;
        if (!user.premiumStartedAt) {
            user.premiumStartedAt = startDate;
        }
        
        // Ajouter à l'historique
        user.subscriptionHistory.push({
            planId: transaction.planId,
            amount: transaction.amount,
            startedAt: startDate,
            expiresAt: endDate,
            transactionId: transaction.transactionId,
            durationInMonths: transaction.durationInMonths
        });

        await user.save();

        // Créer le code d'accès
        const newAccessCode = new AccessCode({
            code: accessCode,
            email: user.email,
            userId: user._id,
            expiresAt: endDate,
            transactionId: transaction.transactionId,
            planId: transaction.planId
        });
        await newAccessCode.save();

        // Envoyer l'email avec la durée spécifique
        await sendAccessCodeEmail(user.email, accessCode, user.name, transaction.planId);
        
        console.log(`✅ Abonnement activé pour ${user.email}`);
        console.log(`📅 Début: ${startDate.toISOString()}`);
        console.log(`📅 Fin: ${endDate.toISOString()}`);
        console.log(`⏰ Durée totale: ${transaction.durationInMonths} mois`);
        console.log(`🔑 Code d'accès: ${accessCode}`);
        
        await transaction.save();
        
        return {
            success: true,
            user: user,
            accessCode: accessCode,
            startDate: startDate,
            endDate: endDate
        };
        
    } catch (error) {
        console.error('❌ Erreur activation abonnement:', error);
        throw error;
    }
};

// Fonction de traitement du retour de paiement
exports.processPaymentReturn = async (req, res) => {
    try {
        const { transactionId } = req.body;
        
        console.log(`[${new Date().toISOString()}] [RETOUR] === Début du traitement du retour de paiement ===`);
        console.log(`[${new Date().toISOString()}] [RETOUR] ID de la transaction: ${transactionId}`);
        
        const transaction = await Transaction.findOne({ transactionId });
        
        if (!transaction) {
            console.error(`[${new Date().toISOString()}] [ERREUR] Retour: Transaction non trouvée: ${transactionId}`);
            return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
        }
        
        if (transaction.status === 'completed') {
            console.log(`[${new Date().toISOString()}] [INFO] Retour: Transaction déjà confirmée par le webhook.`);
            
            const user = await User.findById(transaction.userId);
            return res.status(200).json({
                success: true,
                status: 'completed',
                accessCode: transaction.accessCode,
                user: user,
                message: "Paiement déjà traité et code disponible"
            });
        }
        
        // Si le webhook a échoué, on confirme manuellement le paiement
        console.log(`[${new Date().toISOString()}] [RETOUR] Confirmation manuelle du paiement...`);
        
        if (transaction.kkiapayTransactionId) {
            const paymentStatus = await kkiapay.verifyTransaction(transaction.kkiapayTransactionId);
            
            if (paymentStatus && paymentStatus.status === 'SUCCESS') {
                const result = await exports.activatePremiumSubscription(transaction); 
                
                const user = await User.findById(transaction.userId);
                
                return res.status(200).json({
                    success: true,
                    status: 'completed',
                    accessCode: transaction.accessCode,
                    user: user,
                    startDate: result.startDate,
                    endDate: result.endDate,
                    duration: transaction.durationInMonths,
                    message: `Paiement confirmé et abonnement de ${transaction.durationInMonths} mois activé`
                });
            }
        }
        
        console.log(`[${new Date().toISOString()}] [INFO] Retour: Paiement toujours en attente.`);
        return res.status(200).json({
            success: false,
            status: 'pending',
            message: "Paiement en attente de confirmation"
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [ERREUR] Retour: Erreur lors du traitement du retour de paiement: ${error.message}`);
        res.status(500).json({
            success: false,
            message: "Erreur serveur lors du traitement du retour de paiement"
        });
    }
};

// Vérifier manuellement le statut d'une transaction
exports.checkTransactionStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        const transaction = await Transaction.findOne({ transactionId, userId: req.user._id });
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
        }
        
        if (transaction.status === 'completed' && transaction.accessCode) {
            const user = await User.findById(transaction.userId);
            return res.status(200).json({
                success: true,
                transactionStatus: 'completed',
                accessCode: transaction.accessCode,
                user: user,
                message: 'Paiement confirmé.'
            });
        }
        
        // Vérifier le statut auprès de KkiaPay
        if (transaction.kkiapayTransactionId) {
            const paymentStatus = await kkiapay.verifyTransaction(transaction.kkiapayTransactionId);
            
            if (paymentStatus && paymentStatus.status === 'SUCCESS') {
                const result = await exports.activatePremiumSubscription(transaction);
                
                const user = await User.findById(transaction.userId);
                
                return res.status(200).json({
                    success: true,
                    transactionStatus: 'completed',
                    accessCode: transaction.accessCode,
                    user: user,
                    startDate: result.startDate,
                    endDate: result.endDate,
                    message: 'Paiement confirmé et code d\'accès généré.'
                });
            }
        }
        
        res.status(200).json({
            success: true,
            transactionStatus: transaction.status,
            accessCode: null,
            message: `Statut: ${transaction.status}`
        });
    } catch (error) {
        console.error('Erreur dans checkTransactionStatus:', error);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
};

// Obtenir le code d'accès de la dernière transaction
exports.getLatestAccessCode = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      userId: req.user._id,
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Aucun code d'accès trouvé"
      });
    }
    
    res.status(200).json({
      success: true,
      accessCode: transaction.accessCode,
      transaction: {
        planId: transaction.planId,
        duration: transaction.durationInMonths,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// Handler pour les webhooks KkiaPay
exports.handleKkiapayWebhook = async (req, res) => {
    try {
        console.log('=== DÉBUT WEBHOOK KKiaPay ===');
        console.log('Body reçu:', JSON.stringify(req.body, null, 2));
        
        const { transactionId, status, metadata } = req.body;
        
        if (!transactionId) {
            console.error('❌ Webhook: transactionId manquant');
            return res.status(400).send('transactionId manquant');
        }

        // Trouver la transaction par l'ID KkiaPay ou par l'ID de transaction personnalisé
        let transaction = await Transaction.findOne({ 
            kkiapayTransactionId: transactionId 
        });

        // Si non trouvé, chercher par transactionId dans les métadonnées
        if (!transaction && metadata && metadata.transaction_id) {
            transaction = await Transaction.findOne({ 
                transactionId: metadata.transaction_id 
            });
        }

        if (!transaction) {
            console.error(`❌ Webhook: Transaction non trouvée: ${transactionId}`);
            return res.status(404).send('Transaction non trouvée');
        }

        console.log(`📦 Webhook: Transaction trouvée - ${transaction.transactionId}, Statut: ${status}`);

        if (status === 'SUCCESS' && transaction.status !== 'completed') {
            console.log('🎉 Webhook: Paiement réussi, activation de l\'abonnement...');
            
            // Activer l'abonnement premium
            const result = await exports.activatePremiumSubscription(transaction);
            
            console.log(`✅ Webhook: Abonnement activé pour ${transaction.userId}`);
            console.log(`📅 Période: ${result.startDate} to ${result.endDate}`);
            
            return res.status(200).send('Webhook traité avec succès');
        } else if (status === 'FAILED') {
            transaction.status = 'failed';
            await transaction.save();
            console.log(`❌ Webhook: Paiement échoué pour ${transaction.transactionId}`);
            return res.status(200).send('Webhook traité - paiement échoué');
        } else {
            console.log(`ℹ Webhook: Statut ${status} ignoré pour ${transaction.transactionId}`);
            return res.status(200).send('Webhook traité - statut ignoré');
        }

    } catch (error) {
        console.error('❌ ERREUR WEBHOOK:', error);
        res.status(500).send('Erreur interne du serveur');
    }
};