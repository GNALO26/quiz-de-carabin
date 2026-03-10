/**
 * ================================================================
 * PREMIUM ACTIVATION CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 * Gestion de l'activation Premium via code
 * ================================================================
 */

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const emailService = require('../services/emailService');

/**
 * ================================================================
 * POST /api/premium/validate-code
 * Valider un code d'activation Premium
 * ================================================================
 */
exports.validateActivationCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    // Validation du code
    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Code invalide. Le code doit contenir 6 chiffres.'
      });
    }

    // Chercher la transaction avec ce code
    const transaction = await Transaction.findOne({
      activationCode: code,
      userId: userId,
      status: 'completed'
    }).populate('userId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Code introuvable ou déjà utilisé par un autre compte.'
      });
    }

    // Vérifier la validité du code
    const validation = transaction.isCodeValid(code);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason
      });
    }

    // Récupérer l'utilisateur
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Marquer le code comme utilisé
    await transaction.markCodeAsUsed();

    // Activer Premium dans la transaction
    await transaction.activatePremium();

    // Activer Premium dans le profil utilisateur
    user.isPremium = true;
    user.premiumPlan = transaction.plan;
    user.premiumUntil = transaction.premiumExpiresAt;
    user.premiumActivatedAt = new Date();
    await user.save();

    // Envoyer email de bienvenue Premium
    await emailService.sendPremiumActivationEmail(
      user,
      transaction.plan,
      transaction.premiumExpiresAt
    );

    // Marquer email comme envoyé
    transaction.welcomeEmailSent = true;
    await transaction.save();

    console.log('✅ Premium activé pour:', user.email);

    // Retourner la réponse
    res.json({
      success: true,
      message: 'Compte Premium activé avec succès !',
      data: {
        isPremium: true,
        plan: transaction.plan,
        expiresAt: transaction.premiumExpiresAt,
        activatedAt: transaction.premiumActivatedAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur validateActivationCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la validation du code'
    });
  }
};

/**
 * ================================================================
 * POST /api/premium/resend-code
 * Renvoyer le code d'activation
 * ================================================================
 */
exports.resendActivationCode = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const userId = req.user._id;

    // Trouver la transaction
    const transaction = await Transaction.findOne({
      transactionId: transactionId,
      userId: userId,
      status: 'completed',
      codeUsed: false
    }).populate('userId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée ou code déjà utilisé'
      });
    }

    // Vérifier si code expiré
    if (new Date() > transaction.codeExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Le code a expiré. Veuillez contacter le support.'
      });
    }

    // Renvoyer l'email
    await emailService.sendPremiumActivationCodeEmail(
      transaction.userId,
      transaction
    );

    res.json({
      success: true,
      message: 'Code renvoyé par email avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur resendActivationCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du renvoi du code'
    });
  }
};

/**
 * ================================================================
 * GET /api/premium/check-code/:code
 * Vérifier un code sans l'activer (preview)
 * ================================================================
 */
exports.checkCode = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findOne({
      activationCode: code,
      userId: userId,
      status: 'approved'
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Code introuvable'
      });
    }

    const validation = transaction.isCodeValid(code);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason
      });
    }

    // Code valide - retourner les infos
    res.json({
      success: true,
      data: {
        valid: true,
        plan: transaction.plan,
        amount: transaction.amount,
        durationInMonths: transaction.durationInMonths,
        expiresAt: transaction.codeExpiresAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur checkCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du code'
    });
  }
};

/**
 * ================================================================
 * GET /api/premium/pending-activations
 * Liste des transactions en attente d'activation
 * ================================================================
 */
exports.getPendingActivations = async (req, res) => {
  try {
    const userId = req.user._id;

    const pendingTransactions = await Transaction.find({
      userId: userId,
      status: 'completed',
      codeUsed: false,
      codeExpiresAt: { $gt: new Date() } // Code non expiré
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingTransactions.length,
      data: pendingTransactions.map(t => ({
        transactionId: t.transactionId,
        plan: t.plan,
        amount: t.amount,
        codeExpiresAt: t.codeExpiresAt,
        createdAt: t.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Erreur getPendingActivations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des activations en attente'
    });
  }
};

module.exports = {
  validateActivationCode,
  resendActivationCode,
  checkCode,
  getPendingActivations
};