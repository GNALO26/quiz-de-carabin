const User = require('../models/User');

// ✅ Middleware pour vérifier et mettre à jour automatiquement le statut premium
const checkPremiumStatus = async (req, res, next) => {
  try {
    if (req.user && req.user._id) {
      const user = await User.findById(req.user._id);
      
      if (user && user.isPremium && user.premiumExpiresAt) {
        const now = new Date();
        const expiryDate = new Date(user.premiumExpiresAt);
        
        // Vérifier si l'abonnement a expiré
        if (now > expiryDate) {
          console.log(`⏰ [PREMIUM] Abonnement expiré pour ${user.email}`);
          console.log(`   - Date d'expiration: ${expiryDate.toLocaleString('fr-FR')}`);
          console.log(`   - Date actuelle: ${now.toLocaleString('fr-FR')}`);
          
          // Désactiver le premium
          user.isPremium = false;
          await user.save();
          
          // Mettre à jour l'utilisateur dans la requête
          req.user.isPremium = false;
          req.user.premiumExpiresAt = null;
          
          console.log(`✅ [PREMIUM] Statut mis à jour: Premium désactivé`);
        } else {
          // Calculer les jours restants
          const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
          console.log(`✅ [PREMIUM] Abonnement actif pour ${user.email} - ${daysLeft} jours restants`);
        }
      }
    }
    next();
  } catch (error) {
    console.error('❌ [PREMIUM] Erreur vérification statut:', error.message);
    // Ne pas bloquer la requête en cas d'erreur
    next();
  }
};

module.exports = checkPremiumStatus;