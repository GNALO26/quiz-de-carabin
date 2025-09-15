const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const geoip = require('geoip-lite');
const transporter = require('../config/email');
const generateCode = require('../utils/generateCode');

// Fonction pour générer un token JWT
const generateToken = (user, deviceId = null) => {
  const payload = {
    id: user._id,
    version: user.tokenVersion || 0
  };
  
  if (deviceId) {
    payload.deviceId = deviceId;
  }
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

// Fonction de connexion - CORRIGÉE
exports.login = async (req, res) => {
  try {
    const { email, password, deviceId, deviceInfo } = req.body;

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Email ou mot de passe incorrect"
      });
    }

    // Vérifier le mot de passe - CORRECTION CRITIQUE
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Email ou mot de passe incorrect"
      });
    }

    // Générer le token JWT
    const token = generateToken(user, deviceId);

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

// Réinitialisation du mot de passe - CORRIGÉE
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, code et nouveau mot de passe requis"
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Hachage du nouveau mot de passe - CORRECTION
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Incrémentation du tokenVersion pour invalider les anciens tokens
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    
    await user.save();

    passwordReset.used = true;
    await passwordReset.save();

    res.status(200).json({
      success: true,
      message: "Mot de passe réinitialisé avec succès"
    });
  } catch (error) {
    console.error('Erreur dans resetPassword:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur"
    });
  }
};