const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Routes d'authentification de base
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Routes pour la réinitialisation de mot de passe
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);

module.exports = router;