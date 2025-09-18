const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const auth = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Enlève 'Bearer ' pour obtenir le token
    } else if (req.query.token) {
      token = req.query.token;
    } else if (req.cookies && req.cookies.quizToken) {
      token = req.cookies.quizToken;
    }
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Aucun token valide fourni.',
        code: 'NO_TOKEN'
      });
    }

    // Décoder le token sans vérification pour obtenir l'ID utilisateur
    const decodedWithoutVerify = jwt.decode(token);
    if (!decodedWithoutVerify || !decodedWithoutVerify.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide.',
        code: 'INVALID_TOKEN'
      });
    }

    const User = mongoose.model('User');
    const user = await User.findById(decodedWithoutVerify.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide. Utilisateur non trouvé.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Maintenant, vérifier le token avec le secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Vérifier la version du token
    if (decoded.version !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Session expirée. Veuillez vous reconnecter.',
        code: 'TOKEN_VERSION_MISMATCH'
      });
    }

    // Vérifier la session active
    if (decoded.sessionId !== user.activeSessionId) {
      return res.status(401).json({
        success: false,
        message: 'Une autre session est active. Veuillez vous reconnecter.',
        code: 'SESSION_MISMATCH'
      });
    }

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