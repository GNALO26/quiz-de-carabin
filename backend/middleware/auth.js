const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const auth = async (req, res, next) => {
  console.log('Auth middleware called for:', req.method, req.originalUrl);
  
  try {
    // Autoriser l'accès public à certaines routes
    const publicRoutes = [
      '/api/quiz',
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/verify-reset-code',
      '/api/auth/reset-password'
    ];
    
    if (publicRoutes.includes(req.originalUrl.split('?')[0])) {
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { 
      ignoreExpiration: false,
      clockTolerance: 30 // 30 secondes de tolérance pour les décalages d'horloge
    });
    
    const User = mongoose.model('User');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide. Utilisateur non trouvé.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Vérifier que la version du token correspond
    if (decoded.version !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Session expirée. Veuillez vous reconnecter.',
        code: 'TOKEN_VERSION_MISMATCH'
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