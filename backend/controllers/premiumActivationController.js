/**
 * ================================================================
 * PREMIUM ACTIVATION CONTROLLER - QUIZ DE CARABIN
 * ================================================================
 */

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const emailService = require('../services/emailService');

/**
 * POST /api/premium/validate-code
 * Valider un code d'activation Premium
 */
const validateActivationCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    console.log(`🔑 Validation code: ${code} pour user: ${userId}`);

    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Code invalide. Le code doit contenir 6 chiffres.'
      });
    }

    // Chercher avec status completed OU approved
    const transaction = await Transaction.findOne({
      activationCode: code,
      userId: userId,
      status: { $in: ['completed', 'approved'] }
    }).populate('userId');

    if (!transaction) {
      console.log('❌ Transaction non trouvée');
      return res.status(404).json({
        success: false,
        message: 'Code introuvable ou déjà utilisé.'
      });
    }

    console.log(`✅ Transaction trouvée: ${transaction._id}`);

    // Vérifier validité
    const validation = transaction.isCodeValid(code);
    
    if (!validation.valid) {
      console.log(`❌ Code invalide: ${validation.reason}`);
      return res.status(400).json({
        success: false,
        message: validation.reason
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Marquer code utilisé
    await transaction.markCodeAsUsed();
    console.log('✅ Code marqué utilisé');

    // Activer Premium transaction
    await transaction.activatePremium();
    console.log('✅ Premium activé transaction');

    // Activer Premium user
    user.isPremium = true;
    user.premiumPlan = transaction.plan;
    user.premiumUntil = transaction.premiumExpiresAt;
    user.premiumActivatedAt = new Date();
    await user.save();
    console.log('✅ Premium activé user');

    // Email bienvenue
    try {
      await emailService.sendPremiumActivationEmail(
        user,
        transaction.plan,
        transaction.premiumExpiresAt
      );
      
      transaction.welcomeEmailSent = true;
      await transaction.save();
      console.log('✅ Email bienvenue envoyé');
    } catch (emailError) {
      console.error('⚠️ Erreur email:', emailError.message);
    }

    console.log('🎉 Premium activé:', user.email);

    res.json({
      success: true,
      message: 'Compte Premium activé avec succès !',
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        isPremium: true,
        premiumPlan: user.premiumPlan,
        premiumUntil: user.premiumUntil
      }
    });

  } catch (error) {
    console.error('❌ Erreur validateActivationCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur validation code',
      error: error.message
    });
  }
};

/**
 * POST /api/premium/resend-code
 */
const resendActivationCode = async (req, res) => {
  try {
    const { transactionId } = req.body;
    const userId = req.user._id;

    const transaction = await Transaction.findOne({
      transactionId: transactionId,
      userId: userId,
      status: { $in: ['completed', 'approved'] },
      codeUsed: false
    }).populate('userId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée'
      });
    }

    if (new Date() > transaction.codeExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Code expiré'
      });
    }

    await emailService.sendPremiumActivationCodeEmail(
      transaction.userId,
      transaction
    );

    res.json({
      success: true,
      message: 'Code renvoyé par email'
    });

  } catch (error) {
    console.error('❌ Erreur resendActivationCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur renvoi code'
    });
  }
};

/**
 * GET /api/premium/check-code/:code
 */
const checkCode = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findOne({
      activationCode: code,
      userId: userId,
      status: { $in: ['completed', 'approved'] }
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

    res.json({
      success: true,
      data: {
        valid: true,
        plan: transaction.plan,
        amount: transaction.amount,
        expiresAt: transaction.codeExpiresAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur checkCode:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur vérification'
    });
  }
};

/**
 * GET /api/premium/pending-activations
 */
const getPendingActivations = async (req, res) => {
  try {
    const userId = req.user._id;

    const pending = await Transaction.find({
      userId: userId,
      status: { $in: ['completed', 'approved'] },
      codeUsed: false,
      codeExpiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pending.length,
      data: pending.map(t => ({
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
      message: 'Erreur récupération'
    });
  }
};

// ✅ EXPORTS
module.exports = {
  validateActivationCode,
  resendActivationCode,
  checkCode,
  getPendingActivations
};