const User = require('../models/User');

// Middleware pour vérifier et mettre à jour le statut premium
const checkPremiumStatus = async (req, res, next) => {
  try {
    if (req.user && req.user.isPremium) {
      const user = await User.findById(req.user._id);
      
      // Vérifier si l'abonnement a expiré
      if (user.premiumExpiresAt && new Date() > new Date(user.premiumExpiresAt)) {
        user.isPremium = false;
        await user.save();
        
        // Mettre à jour l'utilisateur dans la requête
        req.user.isPremium = false;
        req.user.premiumExpiresAt = null;
        
        console.log(`⏰ Abonnement expiré pour ${user.email}`);
      }
    }
    next();
  } catch (error) {
    console.error('Erreur vérification statut premium:', error);
    next();
  }
};

module.exports = checkPremiumStatus;