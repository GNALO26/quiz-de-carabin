const User = require('../models/User');

const checkPremiumStatus = async (req, res, next) => {
  try {
    // Si pas d'utilisateur authentifié, passer au suivant
    if (!req.user) return next();
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await User.findById(req.user._id);
    
    // Si l'utilisateur n'existe pas, passer au suivant
    if (!user) return next();
    
    // Vérifier et mettre à jour le statut premium si expiré
    if (user.isPremium && user.premiumExpiresAt && 
        new Date() > new Date(user.premiumExpiresAt)) {
      
      console.log(`⏰ [MIDDLEWARE] Abonnement expiré automatiquement pour ${user.email}`);
      
      // Désactiver le premium
      user.isPremium = false;
      await user.save();
    }
    
    // Mettre à jour req.user avec les données fraîches
    req.user = user;
    next();
    
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Erreur checkPremiumStatus:', error.message);
    // En cas d'erreur, continuer quand même pour ne pas bloquer l'application
    next();
  }
};

module.exports = checkPremiumStatus;