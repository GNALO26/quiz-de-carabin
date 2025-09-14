const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const auth = async (req, res, next) => {
  console.log('Auth middleware called for:', req.method, req.originalUrl);
  
  try {
    // Pour la route GET /api/quiz, on autorise l'accès sans token
    if (req.method === 'GET' && req.originalUrl === '/api/quiz') {
      console.log('Accès public autorisé à /api/quiz');
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
      console.log('No valid token provided for:', req.originalUrl);
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Aucun token valide fourni.',
        code: 'NO_TOKEN'
      });
    }

    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.log('JWT format invalid for:', req.originalUrl);
      return res.status(401).json({
        success: false,
        message: 'Token mal formé.',
        code: 'MALFORMED_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: false });
    const User = mongoose.model('User');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide. Utilisateur non trouvé.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Vérification de la version du token avec tolérance
    const tokenVersion = decoded.version || 0;
    const userTokenVersion = user.tokenVersion || 0;
    
    if (tokenVersion !== userTokenVersion) {
      // Tentative de récupération pour les petits écarts de version
      if (Math.abs(tokenVersion - userTokenVersion) <= 2) {
        // Mise à jour de la version pour synchroniser
        user.tokenVersion = tokenVersion;
        await user.save();
        console.log(`Version de token synchronisée pour ${user.email}`);
      } else {
        return res.status(401).json({
          success: false,
          message: 'Session expirée. Veuillez vous reconnecter.',
          code: 'TOKEN_VERSION_MISMATCH'
        });
      }
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