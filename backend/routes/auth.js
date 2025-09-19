const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Modification ici
const auth = require('../middleware/auth');

// Route d'inscription
router.post('/register', authController.register);

// Route de connexion
router.post('/login', authController.login);

// Route de déconnexion
router.post('/logout', auth, authController.logout);

// Route pour forcer la déconnexion de toutes les sessions
router.post('/force-logout', auth, authController.forceLogout);

// Route pour demander une réinitialisation de mot de passe
router.post('/forgot-password', authController.requestPasswordReset);

// Route pour vérifier un code de réinitialisation
router.post('/verify-reset-code', authController.verifyResetCode);

// Route pour réinitialiser le mot de passe
router.post('/reset-password', authController.resetPassword);

// Route pour réinitialiser un compte (admin)
router.post('/admin-reset', authController.adminResetAccount);

// Route pour réparer un compte
router.post('/repair-account', authController.repairAccount);

// NOUVELLE ROUTE: Vérification de l'état de la session
router.get('/check-session', auth, authController.checkSession);

module.exports = router;