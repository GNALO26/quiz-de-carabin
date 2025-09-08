const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  // Ajoutez ce log pour voir quelles routes déclenchent le middleware
  console.log('Auth middleware called for:', req.method, req.originalUrl);
  
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('No token provided for:', req.originalUrl);
      return res.status(401).json({ 
        success: false, 
        message: 'Accès refusé. Aucun token fourni.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide. Utilisateur non trouvé.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur middleware auth:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expiré. Veuillez vous reconnecter.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur.' 
    });
  }
};

module.exports = auth;