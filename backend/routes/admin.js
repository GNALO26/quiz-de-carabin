const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Middleware pour vérifier les droits admin
const requireAdmin = (req, res, next) => {
  console.log('🔍 requireAdmin - req.user:', {
    exists: !!req.user,
    id: req.user?._id,
    email: req.user?.email,
    isAdmin: req.user?.isAdmin,
    hasIsAdminField: req.user?.hasOwnProperty('isAdmin')
  });

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Non authentifié'
    });
  }

  if (req.user.isAdmin !== true) {
    console.log('❌ Accès admin refusé - isAdmin:', req.user.isAdmin);
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Droits administrateur requis.'
    });
  }
  
  console.log('✅ Accès admin autorisé pour:', req.user.email);
  next();
};

// NE PAS réappliquer auth ici (déjà fait globalement dans server.js)
// Juste vérifier isAdmin
router.use(requireAdmin);

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

console.log('✅ Routes admin chargées avec requireAdmin');

module.exports = router;