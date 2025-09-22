// backend/routes/accessCode.js
const express = require('express');
const router = express.Router();
const accessCodeController = require('../controllers/accessCodeController');
const auth = require('../middleware/auth');

// ✅ Correction: Utilisation des noms de fonctions corrects
// Route pour valider un code d'accès
router.post('/validate', auth, accessCodeController.validateAccessCode);

// Route pour renvoyer un code d'accès
router.post('/resend', auth, accessCodeController.resendAccessCode);

module.exports = router;