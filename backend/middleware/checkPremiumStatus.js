const User = require('../models/User'); // Assurez-vous d'avoir le chemin correct

// Middleware pour vérifier et mettre à jour le statut premium
module.exports = async (req, res, next) => {
    // Si l'utilisateur n'est pas authentifié, ou s'il n'a pas été chargé par le middleware 'auth'
    if (!req.user || !req.user._id) {
        return next();
    }
    
    // Si l'utilisateur est marqué comme premium (ou était premium)
    if (req.user.isPremium) {
        const now = new Date();
        const expiration = req.user.premiumExpiresAt;

        // Si la date d'expiration est dans le passé et qu'elle existe
        if (expiration && expiration <= now) {
            console.log(`[PREMIUM] Révocation: Abonnement expiré pour l'utilisateur: ${req.user.email}`);
            
            // Mettre à jour l'utilisateur dans la base de données
            // (Ne pas attendre le résultat pour ne pas bloquer la requête)
            User.findByIdAndUpdate(req.user._id, {
                isPremium: false,
                premiumExpiresAt: null
            }).exec().catch(err => {
                console.error(`Erreur BD lors de la révocation premium pour ${req.user.email}:`, err);
            });
            
            // Mettre à jour l'objet req.user pour la requête actuelle
            req.user.isPremium = false; 
            req.user.premiumExpiresAt = null;
        }
    }
    
    next();
};