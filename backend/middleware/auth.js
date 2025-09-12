const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const auth = async (req, res, next) => {
  console.log('Auth middleware called for:', req.method, req.originalUrl);
  
  try {
    let token;
    const authHeader = req.header('Authorization');
    
    // Vérifier plusieurs méthodes d'authentification avec nettoyage du token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').replace(/['"]/g, '').trim();
    } else if (req.query.token) {
      token = req.query.token.replace(/['"]/g, '').trim();
    } else if (req.cookies && req.cookies.quizToken) {
      token = req.cookies.quizToken.replace(/['"]/g, '').trim();
    }
    
    // Vérification plus stricte de l'absence de token
    if (!token || token === 'null' || token === 'undefined' || token === 'Bearer null') {
      console.log('No valid token provided for:', req.originalUrl);
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Aucun token valide fourni.',
        code: 'NO_TOKEN'
      });
    }

    // Vérification de la structure du token JWT
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.log('JWT format invalid for:', req.originalUrl);
      return res.status(401).json({
        success: false,
        message: 'Token mal formé.',
        code: 'MALFORMED_TOKEN'
      });
    }

    // Vérification plus tolérante du token
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: false });
    
    // Utilisation de mongoose.model pour éviter les dépendances circulaires
    const User = mongoose.model('User');
    
    // Vérifier si l'utilisateur existe toujours
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide. Utilisateur non trouvé.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Vérifier la version du token (si implémentée)
    if (decoded.version !== undefined && user.tokenVersion !== decoded.version) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide. Veuillez vous reconnecter.',
        code: 'TOKEN_VERSION_MISMATCH'
      });
    }

    // Vérifier si le token est sur le point d'expirer (dans les 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.exp - now;
    
    if (expiresIn < 300) { // 5 minutes
      // Générer un nouveau token
      const newToken = jwt.sign(
        { 
          id: user._id,
          version: user.tokenVersion || 0
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '24h' }
      );
      
      // Ajouter le nouveau token à la réponse
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