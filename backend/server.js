const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({
  origin: [
    'https://quiz-de-carabin.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging des requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Connexion à MongoDB
const connectDB = require('./config/database');
connectDB();

// Import des modèles (pour s'assurer qu'ils sont chargés)
require('./models/User');
require('./models/Quiz');
require('./models/Transaction');
require('./models/AccessCode');
require('./models/PasswordReset');
require('./models/Session');

// Import des middlewares
const authMiddleware = require('./middleware/auth');
const checkPremiumStatus = require('./middleware/checkPremiumStatus');
const sessionCheckMiddleware = require('./middleware/sessionCheck');
const deviceDetectionMiddleware = require('./middleware/deviceDetection');
const productionMonitor = require('./middleware/productionMonitor');
const handleDatabaseError = require('./middleware/handleDatabaseError');
const webhookLogger = require('./middleware/webhookLogger');

// Application des middlewares globaux
app.use(handleDatabaseError);
app.use(productionMonitor);

// Import des contrôleurs
const authController = require('./controllers/authController');
const quizController = require('./controllers/quizController');
const userController = require('./controllers/userController');
const paymentController = require('./controllers/paymentController');
const accessCodeController = require('./controllers/accessCodeController');

// ==================== ROUTES PUBLIQUES ====================

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API Quiz de Carabin est en ligne', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes d'authentification
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', deviceDetectionMiddleware, authController.login);
app.post('/api/auth/logout', authController.logout);
app.post('/api/auth/force-logout', authController.forceLogout);

// Routes mot de passe oublié
app.post('/api/auth/forgot-password', authController.requestPasswordReset);
app.post('/api/auth/verify-reset-code', authController.verifyResetCode);
app.post('/api/auth/reset-password', authController.resetPassword);

// Routes admin (protection à ajouter si nécessaire)
app.post('/api/auth/admin-reset-account', authController.adminResetAccount);
app.post('/api/auth/repair-account', authController.repairAccount);

// Routes de quiz publiques
app.get('/api/quizzes', quizController.getQuizzes);
app.get('/api/quizzes/:id', quizController.getQuizById);

// ==================== ROUTES PROTÉGÉES ====================

// Routes utilisateur authentifié
app.get('/api/users/profile', authMiddleware, userController.getProfile);
app.put('/api/users/profile', authMiddleware, userController.updateProfile);
app.get('/api/users/premium-status', authMiddleware, userController.getPremiumStatus);

// Routes de quiz protégées
app.post('/api/quizzes/:id/submit', authMiddleware, quizController.submitQuiz);
app.get('/api/quizzes/user/history', authMiddleware, quizController.getUserQuizHistory);

// ==================== ROUTES DE PAIEMENT ====================

// Routes de paiement
app.post('/api/payments/initiate', authMiddleware, paymentController.initiatePayment);
app.post('/api/payments/process-return', authMiddleware, paymentController.processPaymentReturn);
app.get('/api/payments/check-status/:transactionId', authMiddleware, paymentController.checkTransactionStatus);
app.get('/api/payments/latest-access-code', authMiddleware, paymentController.getLatestAccessCode);

// Webhook KkiaPay (sans auth pour permettre les callbacks)
app.post('/api/payments/webhook/kkiapay', webhookLogger, (req, res) => {
  // Logique webhook temporaire - à implémenter
  console.log('📩 Webhook KkiaPay reçu:', req.body);
  res.status(200).json({ received: true });
});

// ==================== ROUTES CODE D'ACCÈS ====================

app.post('/api/access-codes/validate', authMiddleware, accessCodeController.validateAccessCode);
app.get('/api/access-codes/user-codes', authMiddleware, accessCodeController.getUserAccessCodes);

// ==================== ROUTES ADMIN ====================

// Routes admin (à protéger avec un middleware admin)
app.get('/api/admin/users', authMiddleware, userController.getAllUsers);
app.get('/api/admin/transactions', authMiddleware, paymentController.getAllTransactions);
app.get('/api/admin/access-codes', authMiddleware, accessCodeController.getAllAccessCodes);

// ==================== ROUTE DE TEST KKiaPay ====================

app.get('/api/test-kkiapay', async (req, res) => {
  try {
    const kkiapay = require('./config/kkiapay');
    
    const testPayment = await kkiapay.createPayment({
      amount: 100,
      phone: '+2290156035888',
      name: 'Test User',
      email: 'olympeguidolokossou@gmail.com',
      reason: 'Test de paiement KkiaPay',
      callback: 'https://quiz-de-carabin.netlify.app/payment-callback.html',
      metadata: {
        test: true,
        timestamp: Date.now()
      }
    });
    
    console.log('✅ Test KkiaPay réussi:', testPayment);
    
    res.json({ 
      success: true, 
      message: 'Configuration KkiaPay OK',
      data: testPayment 
    });
  } catch (error) {
    console.error('❌ Test KkiaPay échoué:', error);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data,
      config: {
        publicKey: process.env.KKIAPAY_PUBLIC_KEY ? 'PRÉSENTE' : 'MANQUANT',
        privateKey: process.env.KKIAPAY_PRIVATE_KEY ? 'PRÉSENTE' : 'MANQUANT', 
        secretKey: process.env.KKIAPAY_SECRET_KEY ? 'PRÉSENTE' : 'MANQUANT',
        mode: process.env.KKIAPAY_MODE || 'non défini'
      }
    });
  }
});

// ==================== GESTION DES ERREURS ====================

// Route 404
app.use('*', (req, res) => {
  console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

// Middleware de gestion d'erreurs global
app.use((error, req, res, next) => {
  console.error('💥 ERREUR GLOBALE:', error);
  
  // Erreur de validation Mongoose
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: Object.values(error.errors).map(e => e.message)
    });
  }
  
  // Erreur de duplication MongoDB
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} existe déjà`
    });
  }
  
  // Erreur JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expiré'
    });
  }
  
  // Erreur par défaut
  res.status(error.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur interne du serveur' 
      : error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================

const PORT = process.env.PORT || 5000;

// Fonction pour démarrer le serveur
const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🌐 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📧 Email config: ${process.env.EMAIL_USER ? 'PRÉSENT' : 'MANQUANT'}`);
    console.log(`💰 KkiaPay config: ${process.env.KKIAPAY_PUBLIC_KEY ? 'PRÉSENT' : 'MANQUANT'}`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'Non défini'}`);
    console.log(`🔗 API URL: ${process.env.API_BASE_URL || 'Non défini'}`);
    console.log(`=========================================\n`);
    
    // Test automatique de la configuration email
    if (process.env.EMAIL_USER) {
      setTimeout(() => {
        const transporter = require('./config/email');
        transporter.verify((error) => {
          if (error) {
            console.log('⚠  Configuration email - Vérification échouée:', error.message);
          } else {
            console.log('✅ Configuration email - Vérification réussie');
            
            // Test d'envoi d'email (optionnel)
            if (process.env.NODE_ENV === 'development') {
              transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: 'test@example.com',
                subject: 'Test de configuration email - Quiz de Carabin',
                text: 'Ceci est un test de configuration email.'
              }, (err, info) => {
                if (err) {
                  console.log('❌ Test email échoué:', err.message);
                } else {
                  console.log('✅ Email test envoyé avec succès:', info.response);
                }
              });
            }
          }
        });
      }, 2000);
    }
  });
};

// Gestion gracieuse de l'arrêt
process.on('SIGINT', () => {
  console.log('\n👋 Arrêt gracieux du serveur...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Arrêt gracieux du serveur...');
  process.exit(0);
});

// Démarrer le serveur
startServer();

module.exports = app;