const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const auth = async (req, res, next) => {
  try {
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: false });
    const User = mongoose.model('User');
    
    // Recherche de l'utilisateur avec gestion d'erreur améliorée
    let user;
    try {
      user = await User.findById(decoded.id).select('-password');
    } catch (dbError) {
      console.error('Erreur DB dans middleware auth:', dbError);
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur de base de données' 
      });
    }
    
    if (!user) {
      // Tentative de récupération par email si disponible dans le token
      if (decoded.email) {
        try {
          user = await User.findOne({ email: decoded.email.toLowerCase().trim() }).select('-password');
        } catch (fallbackError) {
          console.error('Erreur fallback dans middleware auth:', fallbackError);
        }
      }
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token invalide. Utilisateur non trouvé.',
          code: 'USER_NOT_FOUND'
        });
      }
    }

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