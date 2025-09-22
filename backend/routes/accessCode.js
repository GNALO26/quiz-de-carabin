// backend/routes/accessCode.js
const express = require('express');
const router = express.Router();
const accessCodeController = require('../controllers/accessCodeController');
const auth = require('../middleware/auth'); // Middleware d'authentification

// Route pour valider un code d'accès
router.post('/validate', auth, accessCodeController.validateCode);

// Route pour renvoyer un code d'accès
router.post('/resend', auth, accessCodeController.resendCode);

module.exports = router;