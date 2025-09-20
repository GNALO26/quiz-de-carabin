const AccessCode = require('../models/AccessCode');
const User = require('../models/User');
const Transaction = require('../models/Transaction'); // Ajoutez cette ligne

exports.validateAccessCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    console.log('Validation du code d\'accès:', { code, userId });

    // Vérifier d'abord dans les transactions
    const transaction = await Transaction.findOne({
      userId: userId,
      accessCode: code,
      accessCodeUsed: false,
      status: 'completed'
    });

    if (transaction) {
      // Marquer le code comme utilisé dans la transaction
      transaction.accessCodeUsed = true;
      await transaction.save();

      // Activer l'accès premium pour l'utilisateur
      const user = await User.findByIdAndUpdate(
        userId,
        {
          isPremium: true,
          premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 an
        },
        { new: true }
      ).select('-password');

      console.log('Accès premium activé via transaction pour l\'utilisateur:', user.email);

      return res.status(200).json({
        success: true,
        message: 'Code validé avec succès. Vous avez maintenant accès aux QCM premium.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isPremium: user.isPremium,
          premiumExpiresAt: user.premiumExpiresAt
        }
      });
    }

    // Si pas trouvé dans les transactions, vérifier dans AccessCode
    const accessCode = await AccessCode.findOne({
      code,
      userId,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!accessCode) {
      console.log('Code invalide ou expiré');
      return res.status(400).json({
        success: false,
        message: 'Code invalide ou expiré'
      });
    }

    // Marquer le code comme utilisé
    accessCode.used = true;
    await accessCode.save();

    // Activer l'accès premium pour l'utilisateur
    const user = await User.findByIdAndUpdate(
      userId,
      {
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 an
      },
      { new: true }
    ).select('-password');

    console.log('Accès premium activé via AccessCode pour l\'utilisateur:', user.email);

    res.status(200).json({
      success: true,
      message: 'Code validé avec succès. Vous avez maintenant accès aux QCM premium.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        premiumExpiresAt: user.premiumExpiresAt
      }
    });
  } catch (error) {
    console.error('Erreur lors de la validation du code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation du code'
    });
  }
};

// Fonction pour renvoyer un code d'accès
exports.resendAccessCode = async (req, res) => {
  try {
    const userId = req.user.id;
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
      status: 'completed'
    }).sort({ createdAt: -1 });

    if (transaction && transaction.accessCode) {
      // Réutiliser le code de la transaction
      const transporter = require('../config/email');
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Votre code d\'accès Quiz de Carabin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Code d'accès Quiz de Carabin</h2>
            <p>Votre code d'accès est :</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #4CAF50;">${transaction.accessCode}</span>
            </div>
            <p>Ce code expirera dans 30 minutes.</p>
            <br>
            <p>L'équipe Quiz de Carabin</p>
          </div>
        `
      });

      return res.status(200).json({
        success: true,
        message: 'Code d\'accès renvoyé par email'
      });
    }

    // Vérifier si l'utilisateur a déjà un code actif dans AccessCode
    const existingCode = await AccessCode.findOne({
      userId,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (existingCode) {
      // Réutiliser le code existant
      const transporter = require('../config/email');
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Votre code d\'accès Quiz de Carabin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Code d'accès Quiz de Carabin</h2>
            <p>Votre code d'accès est :</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #4CAF50;">${existingCode.code}</span>
            </div>
            <p>Ce code expirera dans 30 minutes.</p>
            <br>
            <p>L'équipe Quiz de Carabin</p>
          </div>
        `
      });

      return res.status(200).json({
        success: true,
        message: 'Code d\'accès renvoyé par email'
      });
    }

    // Générer un nouveau code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Créer un nouveau code d'accès
    const accessCode = new AccessCode({
      code: newCode,
      email: user.email,
      userId: user._id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    await accessCode.save();

    // Envoyer le code par email
    try {
      const transporter = require('../config/email');
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Votre code d\'accès Quiz de Carabin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">Code d'accès Quiz de Carabin</h2>
            <p>Votre code d'accès est :</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #4CAF50;">${newCode}</span>
            </div>
            <p>Ce code expirera dans 30 minutes.</p>
            <br>
            <p>L'équipe Quiz de Carabin</p>
          </div>
        `
      });

      res.status(200).json({
        success: true,
        message: 'Nouveau code envoyé par email'
      });
    } catch (emailError) {
      console.error('Erreur envoi email:', emailError);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi de l\'email'
      });
    }
  } catch (error) {
    console.error('Erreur lors du renvoi du code:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du renvoi du code'
    });
  }
};