const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const geoip = require('geoip-lite');
const Session = require('../models/Session');
const transporter = require('../config/email');
const generateCode = require('../utils/generateCode');
const crypto = require('crypto');

// Fonction pour générer un ID de session unique
const generateSessionId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Fonction pour générer un token JWT
const generateToken = (user, sessionId) => {
  const payload = {
    id: user._id,
    version: user.tokenVersion,
    sessionId: sessionId
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

// Fonction register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation des données
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Tous les champs sont obligatoires"
      });
    }
    
    // Normaliser l'email (minuscules et trim)
    const normalizedEmail = email.toLowerCase().trim();
    
    // Vérification format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Format d'email invalide"
      });
    }

    // Vérifier si l'utilisateur existe déjà avec l'email normalisé
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Un utilisateur avec cet email existe déjà"
      });
    }

    // Créer l'utilisateur avec l'email normalisé
    const user = new User({
      name,
      email: normalizedEmail,
      password,
      tokenVersion: 0
    });

    await user.save();

    // Générer un ID de session et un token
    const sessionId = generateSessionId();
    user.activeSessionId = sessionId;
    user.tokenVersion = 0;
    await user.save();

    const token = generateToken(user, sessionId);

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
    
    // Gestion spécifique des erreurs de duplication
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        // message: "Un utilisateur avec cet email existe déjà"
      });
    }
    
    res.status(500).json({
      success: false,
      //message: "Erreur serveur lors de la création du compte"
    });
  }
};

// Fonction de connexion
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();

    // Vérifier si l'utilisateur existe avec l'email normalisé
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      await addLoginHistory(req, normalizedEmail, false, 'Utilisateur non trouvé');
      return res.status(400).json({
        success: false,
        message: "Email ou mot de passe incorrect"
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await addLoginHistory(req, normalizedEmail, false, 'Mot de passe incorrect');
      return res.status(400).json({
        success: false,
        message: "Email ou mot de passe incorrect"
      });
    }

    // Désactiver toutes les sessions existantes pour cet utilisateur
    await Session.deactivateAllUserSessions(user._id);

    // Générer un nouvel ID de session et incrémenter tokenVersion
    const sessionId = generateSessionId();
    user.activeSessionId = sessionId;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.lastLogin = new Date();
    await user.save();

    // Créer une nouvelle session
    const geo = geoip.lookup(req.clientIp);
    const newSession = new Session({
      userId: user._id,
      sessionId: sessionId,
      deviceInfo: req.deviceInfo,
      ipAddress: req.clientIp,
      location: geo ? `${geo.city}, ${geo.country}` : 'Inconnu'
    });

    await newSession.save();

    // Enregistrer la connexion réussie
    await addLoginHistory(req, normalizedEmail, true, 'Connexion réussie');

    // Générer le token JWT avec l'ID de session
    const token = generateToken(user, sessionId);

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
    await addLoginHistory(req, req.body.email, false, 'Erreur serveur');
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la connexion"
    });
  }
};

// Fonction utilitaire pour ajouter une entrée à l'historique de connexion
async function addLoginHistory(req, email, success, reason) {
  try {
    const user = await User.findOne({ email });
    if (!user) return;
    
    const geo = geoip.lookup(req.clientIp);
    const loginEntry = {
      timestamp: new Date(),
      deviceId: req.deviceId,
      deviceInfo: req.deviceInfo,
      ipAddress: req.clientIp,
      location: geo ?`${geo.city}, ${geo.country}` : 'Inconnu',
      success,
      reason
    };
    
    await User.updateOne(
      { email },
      {
        $push: {
          loginHistory: {
            $each: [loginEntry],
            $slice: -100
          }
        }
      }
    );
  } catch (error) {
    console.error('Erreur lors de l\'ajout à l\'historique de connexion:', error);
  }
}

// Fonction de déconnexion
// Fonction de déconnexion
exports.logout = async (req, res) => {
  try {
    // Désactiver la session active
    if (req.user && req.user._id && req.user.activeSessionId) {
      await Session.updateOne(
        { userId: req.user._id, sessionId: req.user.activeSessionId },
        { isActive: false }
      );
      
      // Réinitialiser l'ID de session actif et incrémenter tokenVersion
      const user = await User.findById(req.user._id);
      if (user) {
        user.activeSessionId = null;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();
      }
    }
    
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

// Fonction pour forcer la déconnexion de toutes les sessions
exports.forceLogout = async (req, res) => {
  try {
    // Incrémenter le tokenVersion pour invalider tous les tokens
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    req.user.activeSessionId = null;
    await req.user.save();
    
    res.status(200).json({
      success: true,
      message: "Toutes les sessions ont été déconnectées"
    });
  } catch (error) {
    console.error('Erreur force-logout:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la déconnexion de toutes les sessions"
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

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: normalizedEmail });
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
      email: normalizedEmail,
      code,
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000)
    });

    await passwordReset.save();

    // Envoyer l'email de réinitialisation
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: normalizedEmail,
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

      res.status(200).json({
        success: true,
        message: "Code de réinitialisation envoyé par email"
      });
    } catch (emailError) {
      console.error('Erreur envoi email:', emailError);
      res.status(500).json({
        success: false,
        message: "Erreur lors de l'envoi de l'email"
      });
    }
  } catch (error) {
    console.error('Erreur dans requestPasswordReset:', error);
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

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    const passwordReset = await PasswordReset.findOne({
      email: normalizedEmail,
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
    console.error('Erreur dans verifyResetCode:', error);
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

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    const passwordReset = await PasswordReset.findOne({
      email: normalizedEmail,
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

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Hachage du nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Incrémentation du tokenVersion pour invalider les anciens tokens et réinitialiser la session
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.activeSessionId = null;
    
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

// Fonction pour réinitialiser manuellement un compte utilisateur
exports.adminResetAccount = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Vérifier les privilèges d'admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Accès refusé. Privilèges administrateur requis."
      });
    }

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Réinitialiser le tokenVersion et la session
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.activeSessionId = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Compte ${email} réinitialisé avec succès. TokenVersion: ${user.tokenVersion}`
    });

  } catch (error) {
    console.error('Erreur adminResetAccount:', error);
    res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la réinitialisation du compte"
    });
  }
};

// Fonction pour réparer un compte utilisateur
exports.repairAccount = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Normaliser l'email
    const normalizedEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur non trouvé"
      });
    }

    // Réinitialiser le mot de passe
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Réinitialiser le tokenVersion et la session
    user.tokenVersion = 0;
    user.activeSessionId = null;
    
    await user.save();

    res.status(200).json({
      success: true,
      message: `Compte ${email} réparé avec succès`
    });

  } catch (error) {
    console.error('Erreur repairAccount:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la réparation du compte"
    });
  }
};

// Vérification de l'état de la session
exports.checkSession = async (req, res) => {
  try {
    // La vérification est faite par le middleware sessionCheck
    res.status(200).json({
      success: true,
      message: 'Session valide'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur de vérification de session'
    });
  }
};

// Debug: Vérifier que toutes les fonctions sont bien exportées
console.log('Exportations du authController:');
console.log('- register:', typeof exports.register);
console.log('- login:', typeof exports.login);
console.log('- logout:', typeof exports.logout);
console.log('- forceLogout:', typeof exports.forceLogout);
console.log('- requestPasswordReset:', typeof exports.requestPasswordReset);
console.log('- verifyResetCode:', typeof exports.verifyResetCode);
console.log('- resetPassword:', typeof exports.resetPassword);
console.log('- adminResetAccount:', typeof exports.adminResetAccount);
console.log('- repairAccount:', typeof exports.repairAccount);