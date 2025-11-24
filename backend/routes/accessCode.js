const express = require('express');
const router = express.Router();
const accessCodeController = require('../controllers/accessCodeController');
const auth = require('../middleware/auth');

// Routes pour la gestion des codes d'accès
router.post('/validate', auth, accessCodeController.validateAccessCode);
router.post('/resend', auth, accessCodeController.resendAccessCode);

module.exports = router;