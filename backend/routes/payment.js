const express = require('express');
const { initiatePayment, handlePaymentCallback, validateAccessCode } = require('../controllers/paymentController');
const { protect } = require('../controllers/authController');

const router = express.Router();

router.post('/initiate', protect, initiatePayment);
router.get('/callback', handlePaymentCallback);
router.post('/validate-code', validateAccessCode);

module.exports = router;