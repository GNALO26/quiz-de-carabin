const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');

// Middleware pour vérifier les droits admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Droits administrateur requis.'
    });
  }
  next();
};

// Appliquer auth à toutes les routes
router.use(auth);
router.use(isAdmin);

// ===== STATISTIQUES =====
router.get('/stats', adminController.getStats);

// ===== UTILISATEURS =====
router.get('/users', adminController.getUsers);
router.get('/user/:id', adminController.getUserDetails);
router.put('/user/:id/premium', adminController.togglePremium);

// ===== TRANSACTIONS =====
router.get('/transactions', adminController.getTransactions);

// ===== QUIZ =====
router.get('/quizzes', adminController.getQuizzes);

console.log('✅ Routes admin chargées');

module.exports = router;