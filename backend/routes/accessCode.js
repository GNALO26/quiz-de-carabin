const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { validateAccessCode, resendAccessCode } = require('../controllers/accessCodeController');

// Valider un code d'accès
router.post('/validate', auth, validateAccessCode);

// Renvoyer un code d'accès
router.post('/resend', auth, resendAccessCode);

module.exports = router;