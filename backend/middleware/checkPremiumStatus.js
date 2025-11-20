const User = require('../models/User');

const checkPremiumStatus = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      const user = await User.findById(req.user._id);
      
      if (user) {
        // Vérifier si l'abonnement a expiré
        if (user.isPremium && user.premiumExpiresAt && user.premiumExpiresAt < new Date()) {
          console.log(`🔄 Abonnement expiré pour ${user.email}`);
          user.isPremium = false;
          await user.save();
        }
        
        // Mettre à jour req.user avec les dernières infos
        const updatedUser = await User.findById(req.user._id);
        req.user.isPremium = updatedUser.isPremium;
        req.user.premiumExpiresAt = updatedUser.premiumExpiresAt;
        req.user.isPremiumActive = updatedUser.isPremiumActive();
        req.user.daysRemaining = updatedUser.getDaysRemaining();
        
        console.log(`👤 Statut premium ${user.email}:`, {
          isPremium: req.user.isPremium,
          isPremiumActive: req.user.isPremiumActive,
          daysRemaining: req.user.daysRemaining,
          expiresAt: req.user.premiumExpiresAt
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Erreur vérification statut premium:', error);
    next();
  }
};

module.exports = checkPremiumStatus;