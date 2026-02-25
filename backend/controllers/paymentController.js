/**
 * ================================================================
 * PAYMENT CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 * Gère les paiements Premium avec KKiaPay
 * À placer dans: backend/controllers/paymentController.js
 * ================================================================
 */

const Payment = require('../models/Payment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const axios = require('axios');

// Clé privée KKiaPay (à mettre dans .env)
const KKIAPAY_PRIVATE_KEY = process.env.KKIAPAY_PRIVATE_KEY;
const KKIAPAY_PUBLIC_KEY = process.env.KKIAPAY_PUBLIC_KEY;
const KKIAPAY_SECRET = process.env.KKIAPAY_SECRET;

/**
 * ================================================================
 * POST /api/payment/create-subscription
 * Créer une transaction de souscription Premium
 * ================================================================
 */
exports.createSubscription = async (req, res) => {
  try {
    const { plan, amount } = req.body;
    const userId = req.user._id;

    // Validation
    if (!plan || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Plan et montant requis'
      });
    }

    // Vérifier que le plan est valide
    const validPlans = ['monthly', 'annual'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Plan invalide'
      });
    }

    // Vérifier que l'utilisateur n'est pas déjà premium
    const user = await User.findById(userId);
    if (user.isPremium && user.subscriptionEnd > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Vous êtes déjà membre Premium'
      });
    }

    // Créer la transaction
    const transaction = new Transaction({
      userId,
      type: 'subscription',
      plan,
      amount,
      currency: 'XOF',
      status: 'pending',
      paymentMethod: 'kkiapay',
      metadata: {
        userEmail: user.email,
        userName: user.name
      }
    });

    await transaction.save();

    res.json({
      success: true,
      transaction: {
        _id: transaction._id,
        plan: transaction.plan,
        amount: transaction.amount,
        currency: transaction.currency
      }
    });

  } catch (error) {
    console.error('❌ Erreur createSubscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la transaction'
    });
  }
};

/**
 * ================================================================
 * POST /api/payment/verify
 * Vérifier un paiement après succès KKiaPay
 * ================================================================
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { transactionId, kkiapayTransactionId } = req.body;
    const userId = req.user._id;

    // Récupérer la transaction
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée'
      });
    }

    // Vérifier que la transaction appartient à l'utilisateur
    if (transaction.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Transaction non autorisée'
      });
    }

    // Vérifier le paiement auprès de KKiaPay
    const isVerified = await verifyKKiaPayTransaction(kkiapayTransactionId);

    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Paiement non vérifié auprès de KKiaPay'
      });
    }

    // Mettre à jour la transaction
    transaction.status = 'completed';
    transaction.kkiapayTransactionId = kkiapayTransactionId;
    transaction.completedAt = new Date();
    await transaction.save();

    // Calculer la date de fin d'abonnement
    const subscriptionEnd = new Date();
    if (transaction.plan === 'annual') {
      subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
    } else {
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
    }

    // Mettre à jour l'utilisateur
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isPremium: true,
        subscriptionPlan: transaction.plan,
        subscriptionStart: new Date(),
        subscriptionEnd: subscriptionEnd
      },
      { new: true }
    );

    // Créer un enregistrement Payment
    await Payment.create({
      userId,
      transactionId: transaction._id,
      amount: transaction.amount,
      currency: transaction.currency,
      plan: transaction.plan,
      paymentMethod: 'kkiapay',
      kkiapayTransactionId,
      status: 'completed'
    });

    // Envoyer l'email de confirmation (optionnel)
    // await sendSubscriptionEmail(user.email, transaction.plan);

    res.json({
      success: true,
      message: 'Abonnement Premium activé avec succès',
      subscriptionEnd: subscriptionEnd,
      user: {
        isPremium: user.isPremium,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionEnd: user.subscriptionEnd
      }
    });

  } catch (error) {
    console.error('❌ Erreur verifyPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du paiement'
    });
  }
};

/**
 * ================================================================
 * POST /api/payment/fail
 * Marquer une transaction comme échouée
 * ================================================================
 */
exports.failPayment = async (req, res) => {
  try {
    const { transactionId, error } = req.body;
    const userId = req.user._id;

    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée'
      });
    }

    if (transaction.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    transaction.status = 'failed';
    transaction.errorMessage = error || 'Paiement échoué';
    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction marquée comme échouée'
    });

  } catch (error) {
    console.error('❌ Erreur failPayment:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur'
    });
  }
};

/**
 * ================================================================
 * POST /api/payment/webhook
 * Webhook KKiaPay pour notifications automatiques
 * ================================================================
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-kkiapay-signature'];
    
    // Vérifier la signature
    if (!verifyWebhookSignature(req.body, signature)) {
      return res.status(403).json({
        success: false,
        message: 'Signature invalide'
      });
    }

    const { transactionId, status } = req.body;

    // Traiter selon le statut
    if (status === 'SUCCESS') {
      // Marquer comme completé (backup du verify)
      const transaction = await Transaction.findOne({
        kkiapayTransactionId: transactionId
      });

      if (transaction && transaction.status === 'pending') {
        transaction.status = 'completed';
        transaction.completedAt = new Date();
        await transaction.save();

        // Activer Premium si pas déjà fait
        const user = await User.findById(transaction.userId);
        if (!user.isPremium) {
          const subscriptionEnd = new Date();
          if (transaction.plan === 'annual') {
            subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
          } else {
            subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
          }

          user.isPremium = true;
          user.subscriptionPlan = transaction.plan;
          user.subscriptionStart = new Date();
          user.subscriptionEnd = subscriptionEnd;
          await user.save();
        }
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    res.status(500).json({ success: false });
  }
};

/**
 * ================================================================
 * GET /api/payment/history
 * Historique des paiements de l'utilisateur
 * ================================================================
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      payments: payments.map(p => ({
        id: p._id,
        amount: p.amount,
        currency: p.currency,
        plan: p.plan,
        status: p.status,
        date: p.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Erreur getPaymentHistory:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur récupération historique'
    });
  }
};

/**
 * ================================================================
 * POST /api/payment/cancel-subscription
 * Annuler l'abonnement Premium
 * ================================================================
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isPremium: false,
        subscriptionPlan: null,
        subscriptionEnd: new Date() // Expire immédiatement
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Abonnement annulé avec succès',
      user: {
        isPremium: user.isPremium,
        subscriptionEnd: user.subscriptionEnd
      }
    });

  } catch (error) {
    console.error('❌ Erreur cancelSubscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation'
    });
  }
};

/**
 * ================================================================
 * FONCTIONS UTILITAIRES
 * ================================================================
 */

/**
 * Vérifier une transaction KKiaPay
 */
async function verifyKKiaPayTransaction(transactionId) {
  try {
    const response = await axios.get(
      `https://api.kkiapay.me/api/v1/transactions/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${KKIAPAY_PRIVATE_KEY}`,
          'x-api-key': KKIAPAY_PUBLIC_KEY
        }
      }
    );

    return response.data.status === 'SUCCESS';

  } catch (error) {
    console.error('Erreur vérification KKiaPay:', error);
    return false;
  }
}

/**
 * Vérifier la signature du webhook
 */
function verifyWebhookSignature(payload, signature) {
  const crypto = require('crypto');
  
  const hash = crypto
    .createHmac('sha256', KKIAPAY_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return hash === signature;
}

/**
 * ================================================================
 * CRON JOB : Vérifier les abonnements expirés
 * ================================================================
 * À exécuter quotidiennement
 */
exports.checkExpiredSubscriptions = async () => {
  try {
    const now = new Date();

    const expiredUsers = await User.find({
      isPremium: true,
      subscriptionEnd: { $lt: now }
    });

    for (const user of expiredUsers) {
      user.isPremium = false;
      user.subscriptionPlan = null;
      await user.save();

      console.log(`✅ Abonnement expiré pour user ${user._id}`);
      
      // Optionnel : envoyer email de renouvellement
      // await sendRenewalEmail(user.email);
    }

    console.log(`✅ ${expiredUsers.length} abonnements expirés traités`);

  } catch (error) {
    console.error('❌ Erreur checkExpiredSubscriptions:', error);
  }
};

module.exports = exports;