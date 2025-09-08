const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const transporter = require('../config/email');
const generateCode = require('../utils/generateCode');

// Fonction d'enregistrement
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Un utilisateur avec cet email existe déjà"
      });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Créer l'utilisateur
    const user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // Générer le token JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: "Compte créé avec succès",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium
      }
    });
  } catch (error) {
    console.error('Erreur register:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la création du compte"
    });
  }
};

// Fonction de connexion
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Email ou mot de passe incorrect"
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Email ou mot de passe incorrect"
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: "Connexion réussie",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium
      }
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la connexion"
    });
  }
};

// Fonction de déconnexion
exports.logout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Déconnexion réussie"
    });
  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la déconnexion"
    });
  }
};

// Demande de réinitialisation de mot de passe
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "L'email est requis"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Aucun utilisateur trouvé avec cet email"
      });
    }

    // Générer un code à 6 chiffres
    const code = generateCode();

    // Sauvegarder la demande de réinitialisation
    const passwordReset = new PasswordReset({
      email,
      code,
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 heure
    });

    await passwordReset.save();

    // Envoyer l'email de réinitialisation
    const emailSent = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Code de réinitialisation - Quiz de Carabin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">Réinitialisation de mot de passe</h2>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Votre code de réinitialisation est :</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 3px; color: #4CAF50;">${code}</span>
          </div>
          <p>Ce code expirera dans 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email.</p>
          <br>
          <p>L'équipe Quiz de Carabin</p>
        </div>
      `
    });

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: "Code de réinitialisation envoyé par email"
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'envoi de l'email"
      });
    }
  } catch (error) {
    console.error('❌ Erreur dans requestPasswordReset:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// Vérification du code de réinitialisation
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email et code requis"
      });
    }

    const passwordReset = await PasswordReset.findOne({
      email,
      code,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        message: "Code invalide ou expiré"
      });
    }

    res.status(200).json({
      success: true,
      message: "Code valide"
    });
  } catch (error) {
    console.error('❌ Erreur dans verifyResetCode:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};

// Réinitialisation du mot de passe
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code et nouveau mot de passe requis"
      });
    }

    // Vérifier le code
    const passwordReset = await PasswordReset.findOne({
      email,
      code,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        message: "Code invalide ou expiré"
      });
    }

    // Trouver l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Marquer le code comme utilisé
    passwordReset.used = true;
    await passwordReset.save();

    res.status(200).json({
      success: true,
      message: "Mot de passe réinitialisé avec succès"
    });
  } catch (error) {
    console.error('❌ Erreur dans resetPassword:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};