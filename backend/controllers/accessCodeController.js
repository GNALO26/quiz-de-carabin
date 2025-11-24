const AccessCode = require('../models/AccessCode');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

// ✅ FONCTION UTILITAIRE POUR AJOUTER DES MOIS
const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

// ✅ VALIDATION CODE D'ACCÈS
exports.validateAccessCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    console.log('\n=== 🔑 VALIDATION CODE D\'ACCÈS ===');
    console.log('Code:', code);
    console.log('User ID:', userId);

    // STRATÉGIE 1: Vérifier dans les transactions
    const transaction = await Transaction.findOne({
      userId: new mongoose.Types.ObjectId(userId), 
      accessCode: code,
      accessCodeUsed: false,
      status: 'completed'
    });

    if (transaction) {
      console.log('✅ Code trouvé dans Transaction');
      
      // Marquer comme utilisé
      transaction.accessCodeUsed = true;
      await transaction.save();

      // ✅ CALCUL CORRECT DE LA DATE D'EXPIRATION
      let expirationDate;
      
      const user = await User.findById(userId);
      
      // Si l'utilisateur a déjà un abonnement actif, on étend
      if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()) {
        expirationDate = addMonths(new Date(user.premiumExpiresAt), transaction.durationInMonths);
        console.log(`📅 Extension d'abonnement existant: +${transaction.durationInMonths} mois`);
      } else {
        // Nouvel abonnement
        expirationDate = addMonths(new Date(), transaction.durationInMonths);
        console.log(`🆕 Nouvel abonnement: ${transaction.durationInMonths} mois`);
      }

      // Mettre à jour l'utilisateur
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          isPremium: true,
          premiumExpiresAt: expirationDate
        },
        { new: true }
      ).select('-password');

      console.log('✅ Abonnement activé via Transaction');
      console.log(`📅 Expire le: ${expirationDate.toLocaleDateString('fr-FR')}`);

      return res.status(200).json({
        success: true,
        message: `Code validé! Vous avez maintenant accès aux quiz premium pour ${transaction.durationInMonths} mois.`,
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          isPremium: updatedUser.isPremium,
          premiumExpiresAt: updatedUser.premiumExpiresAt
        }
      });
    }

    // STRATÉGIE 2: Vérifier dans AccessCode
    const accessCode = await AccessCode.findOne({
      code,
      userId: new mongoose.Types.ObjectId(userId), 
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!accessCode) {
      console.log('❌ Code invalide ou expiré');
      return res.status(400).json({
        success: false,
        message: 'Code invalide, déjà utilisé ou expiré'
      });
    }

    console.log('✅ Code trouvé dans AccessCode');

    // Marquer comme utilisé
    accessCode.used = true;
    await accessCode.save();

    // ✅ EXPIRATION PAR DÉFAUT POUR ACCESSCODE: 1 mois
    const defaultDuration = 1;
    
    const user = await User.findById(userId);
    let expirationDate;
    
    // Si abonnement actif, on étend
    if (user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()) {
      expirationDate = addMonths(new Date(user.premiumExpiresAt), defaultDuration);
      console.log(`📅 Extension d'abonnement existant: +${defaultDuration} mois`);
    } else {
      expirationDate = addMonths(new Date(), defaultDuration);
      console.log(`🆕 Nouvel abonnement: ${defaultDuration} mois`);
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        isPremium: true,
        premiumExpiresAt: expirationDate
      },
      { new: true }
    ).select('-password');

    console.log('✅ Abonnement activé via AccessCode');
    console.log(`📅 Expire le: ${expirationDate.toLocaleDateString('fr-FR')}`);

    res.status(200).json({
      success: true,
      message: `Code validé! Vous avez maintenant accès aux quiz premium pour ${defaultDuration} mois.`,
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        isPremium: updatedUser.isPremium,
        premiumExpiresAt: updatedUser.premiumExpiresAt
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur validation code:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la validation du code'
    });
  }
};

// ✅ RENVOYER UN CODE D'ACCÈS
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

    console.log('\n=== 📧 RENVOI CODE D\'ACCÈS ===');
    console.log('User:', user.email);

    // STRATÉGIE 1: Chercher dans les transactions récentes
    const transaction = await Transaction.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'completed',
      accessCode: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    if (transaction && transaction.accessCode) {
      console.log('✅ Code trouvé dans Transaction');
      
      const { sendAccessCodeEmail } = require('./paymentController');
      await sendAccessCodeEmail(
        user.email, 
        transaction.accessCode, 
        user.name, 
        transaction.durationInMonths
      );

      return res.status(200).json({
        success: true,
        message: 'Code d\'accès renvoyé par email'
      });
    }

    // STRATÉGIE 2: Chercher dans AccessCode
    const existingCode = await AccessCode.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (existingCode) {
      console.log('✅ Code trouvé dans AccessCode');
      
      const transporter = require('../config/email');
      await transporter.sendMail({
        from: `"Quiz de Carabin" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Votre code d\'accès Quiz de Carabin',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #13a718;">Code d'accès Quiz de Carabin</h2>
            <p>Bonjour ${user.name},</p>
            <p>Votre code d\'accès est :</p>
            <div style="text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #13a718; background: #f8f9fa; padding: 15px 30px; border-radius: 8px; display: inline-block; border: 2px dashed #13a718;">
                ${existingCode.code}
              </span>
            </div>
            <p>Ce code expire le ${new Date(existingCode.expiresAt).toLocaleDateString('fr-FR')}.</p>
            <p>L'équipe Quiz de Carabin</p>
          </div>
        `
      });

      return res.status(200).json({
        success: true,
        message: 'Code d\'accès renvoyé par email'
      });
    }

    // STRATÉGIE 3: Créer un nouveau code (cas rare)
    console.log('ℹ Aucun code existant, création d\'un nouveau');
    
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    const accessCode = new AccessCode({
      code: newCode,
      email: user.email,
      userId: user._id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });

    await accessCode.save();

    const transporter = require('../config/email');
    await transporter.sendMail({
      from: `"Quiz de Carabin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Votre nouveau code d\'accès Quiz de Carabin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #13a718;">Code d'accès Quiz de Carabin</h2>
          <p>Bonjour ${user.name},</p>
          <p>Votre nouveau code d\'accès est :</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #13a718; background: #f8f9fa; padding: 15px 30px; border-radius: 8px; display: inline-block; border: 2px dashed #13a718;">
              ${newCode}
            </span>
          </div>
          <p>Ce code expire dans 30 jours.</p>
          <p>L'équipe Quiz de Carabin</p>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: 'Nouveau code envoyé par email'
    });
    
  } catch (error) {
    console.error('❌ Erreur renvoi code:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du renvoi du code'
    });
  }
};