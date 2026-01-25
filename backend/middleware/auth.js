const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Session = require('../models/Session');

// Routes qui ne nécessitent pas d'authentification
const publicRoutes = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/verify-reset-code',
  '/api/auth/reset-password'
];

const auth = async (req, res, next) => {
  try {
    // Vérifier si la route est publique
    if (publicRoutes.includes(req.path)) {
      return next();
    }

    let token;
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').replace(/['"]/g, '').trim();
    } else if (req.query.token) {
      token = req.query.token.replace(/['"]/g, '').trim();
    } else if (req.cookies && req.cookies.quizToken) {
      token = req.cookies.quizToken.replace(/['"]/g, '').trim();
    }
    
    if (!token || token === 'null' || token === 'undefined' || token === 'Bearer null') {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Aucun token valide fourni.',
        code: 'NO_TOKEN'
      });
    }

    // Décoder le token pour obtenir les informations sans vérification
    const decodedWithoutVerify = jwt.decode(token);
    if (!decodedWithoutVerify || !decodedWithoutVerify.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide.',
        code: 'INVALID_TOKEN'
      });
    }

    // Recherche de l'utilisateur
    const User = mongoose.model('User');
    let user;
    try {
      user = await User.findById(decodedWithoutVerify.id).select('-password');
    } catch (dbError) {
      console.error('Erreur DB dans middleware auth:', dbError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur de base de données' 
      });
    }
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide. Utilisateur non trouvé.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Maintenant, vérifier le token avec le secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // VÉRIFICATION CRITIQUE: Vérifier que la version du token correspond
    if (decoded.version !== (user.tokenVersion || 0)) {
      return res.status(401).json({
        success: false,
        message: 'Session expirée. Veuillez vous reconnecter.',
        code: 'TOKEN_VERSION_MISMATCH'
      });
    }

    // VÉRIFICATION DE LA SESSION: Vérifier que le token correspond à la session active
    if (decoded.sessionId !== user.activeSessionId) {
      return res.status(401).json({
        success: false,
        message: 'Une autre session est active. Veuillez vous reconnecter.',
        code: 'SESSION_MISMATCH'
      });
    }

    // ✅ CORRECTION: Vérifier si la session existe et est active dans la base de données
    const activeSession = await Session.findOne({
      userId: user._id,
      sessionId: decoded.sessionId,
      isActive: true
    });

    if (!activeSession) {
      return res.status(401).json({
        success: false,
        message: 'Session invalide. Connexion depuis un autre appareil détectée.',
        code: 'SESSION_INVALIDATED'
      });
    }

    // Mettre à jour la date de dernière activité de la session
    activeSession.lastActive = new Date();
    await activeSession.save();

    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Session expirée. Veuillez vous reconnecter.',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide.', 
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

module.exports = auth;