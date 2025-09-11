const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const auth = async (req, res, next) => {
  console.log('Auth middleware called for:', req.method, req.originalUrl);
  
  try {
    let token;
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.query.token) {
      token = req.query.token;
    } else if (req.cookies && req.cookies.quizToken) {
      token = req.cookies.quizToken;
    }
    
    if (!token) {
      console.log('No token provided for:', req.originalUrl);
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Aucun token fourni.' 
      });
    }

    token = token.replace(/^"(.*)"$/, '$1').trim();
    
    if (!token.match(/^[A-Za-z0-9-]+\.[A-Za-z0-9-]+\.[A-Za-z0-9-_.+/=]*$/)) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token JWT malformé.', 
        code: 'MALFORMED_TOKEN'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: false });
    const User = mongoose.model('User');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide. Utilisateur non trouvé.' 
      });
    }

    if (decoded.version !== (user.tokenVersion || 0)) {
      return res.status(401).json({ 
        success: false, 
        message: 'Session invalide. Veuillez vous reconnecter.',
        code: 'TOKEN_INVALIDATED'
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.exp - now;
    
    if (expiresIn < 300) {
      const newToken = jwt.sign(
        { 
          id: user._id,
          version: user.tokenVersion || 0
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.set('X-Renewed-Token', newToken);
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