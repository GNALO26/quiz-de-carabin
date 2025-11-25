const express = require('express');
const router = express.Router();
const accessCodeController = require('../controllers/accessCodeController');

// ✅ Valider un code
router.post('/validate', accessCodeController.validateAccessCode);

// ✅ Renvoyer un code
router.post('/resend', accessCodeController.resendAccessCode);

module.exports = router;