const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const auth = require('../middleware/auth');

// Vérifier et renouveler si nécessaire le token
router.get('/verify-token', auth, async (req, res) => {
  try {
    // Le middleware auth a déjà vérifié le token
    // Si nous arrivons ici, le token est valide
    
    // Vérifier si le token est sur le point d'expirer
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.decode(token);
    
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = decoded.exp - now;
    
    if (expiresIn < 300) { // 5 minutes avant expiration
      // Générer un nouveau token
      const newToken = jwt.sign(
        { id: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Renvoyer le nouveau token dans l'en-tête
      res.set('X-Renewed-Token', newToken);
    }
    
    res.status(200).json({
      success: true,
      message: 'Token valide',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        isPremium: req.user.isPremium
      }
    });
    
  } catch (error) {
    console.error('Erreur vérification token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du token'
    });
  }
});

module.exports = router;