const jwt = require('jsonwebtoken');
const User = require('../models/User');

const deviceDetection = async (req, res, next) => {
  try {
    // Cette logique s'applique seulement aux routes d'authentification
    if (!req.path.includes('/auth/')) {
      return next();
    }
    
    // Récupérer l'adresse IP du client
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    // Ajouter l'IP à la requête pour une utilisation ultérieure
    req.clientIp = ipAddress;
    
    // Si c'est une tentative de connexion, vérifier l'appareil
    if (req.path.includes('/login') && req.method === 'POST') {
      const { deviceId, deviceInfo } = req.body;
      
      if (deviceId) {
        req.deviceId = deviceId;
        req.deviceInfo = deviceInfo;
        
        // Vérifier si c'est un nouvel appareil
        const user = await User.findOne({ email: req.body.email });
        if (user) {
          const knownDevice = user.knownDevices.find(d => d.deviceId === deviceId);
          req.isNewDevice = !knownDevice;
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Erreur dans le middleware deviceDetection:', error);
    next();
  }
};

module.exports = deviceDetection;