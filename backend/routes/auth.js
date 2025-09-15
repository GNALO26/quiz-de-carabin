const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Vérification que les fonctions du contrôleur existent
console.log('Register function:', typeof authController.register);
console.log('Login function:', typeof authController.login);
console.log('Logout function:', typeof authController.logout);
console.log('RequestPasswordReset function:', typeof authController.requestPasswordReset);
console.log('VerifyResetCode function:', typeof authController.verifyResetCode);
console.log('ResetPassword function:', typeof authController.resetPassword);

// Routes d'authentification de base
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Routes pour la réinitialisation de mot de passe
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);

// Route protégée (nécessite un token)
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        isPremium: req.user.isPremium
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur.'
    });
  }
});

module.exports = router;