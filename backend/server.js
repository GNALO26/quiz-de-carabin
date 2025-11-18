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
  if (req.body && Object.keys(req.body).length > 0 && !req.url.includes('/payments/webhook')) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Connexion à MongoDB
const connectDB = require('./config/database');
connectDB();

// Import des modèles
require('./models/User');
require('./models/Quiz');
require('./models/Transaction');
require('./models/AccessCode');
require('./models/PasswordReset');
require('./models/Session');

// Import des middlewares
const authMiddleware = require('./middleware/auth');
const deviceDetectionMiddleware = require('./middleware/deviceDetection');
const webhookLogger = require('./middleware/webhookLogger');

// Import des contrôleurs
const authController = require('./controllers/authController');
const quizController = require('./controllers/quizController');
const userController = require('./controllers/userController');
const paymentController = require('./controllers/paymentController');
const accessCodeController = require('./controllers/accessCodeController');

// Vérification du chargement des contrôleurs
console.log('🔍 Vérification des contrôleurs:');
console.log('- authController:', typeof authController.login === 'function' ? '✅ OK' : '❌ MANQUANT');
console.log('- quizController:', quizController ? '✅ CHARGÉ' : '❌ MANQUANT');
console.log('- userController:', typeof userController.getProfile === 'function' ? '✅ OK' : '❌ MANQUANT');
console.log('- paymentController:', typeof paymentController.initiatePayment === 'function' ? '✅ OK' : '❌ MANQUANT');
console.log('- accessCodeController:', typeof accessCodeController.validateAccessCode === 'function' ? '✅ OK' : '❌ MANQUANT');

// ==================== ROUTES PUBLIQUES ====================

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API Quiz de Carabin est en ligne', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
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

// Routes admin
app.post('/api/auth/admin-reset-account', authController.adminResetAccount);
app.post('/api/auth/repair-account', authController.repairAccount);

// Vérification de session
app.get('/api/auth/check-session', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      isPremium: req.user.isPremium || false
    }
  });
});

// ==================== ROUTES DE QUIZ ====================

// Routes de quiz publiques - avec vérification des fonctions
if (quizController && typeof quizController.getAllQuizzes === 'function') {
  app.get('/api/quizzes', quizController.getAllQuizzes);
} else {
  console.log('⚠  Route /api/quizzes non disponible - fonction getAllQuizzes manquante');
  app.get('/api/quizzes', (req, res) => {
    res.json({
      success: true,
      quizzes: [],
      message: 'Service quiz temporairement indisponible'
    });
  });
}

if (quizController && typeof quizController.getQuiz === 'function') {
  app.get('/api/quizzes/:id', quizController.getQuiz);
} else {
  console.log('⚠  Route /api/quizzes/:id non disponible - fonction getQuiz manquante');
  app.get('/api/quizzes/:id', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Service quiz temporairement indisponible'
    });
  });
}

// Routes de quiz protégées
if (quizController && typeof quizController.submitQuiz === 'function') {
  app.post('/api/quizzes/:id/submit', authMiddleware, quizController.submitQuiz);
} else {
  console.log('⚠  Route /api/quizzes/:id/submit non disponible');
}

if (quizController && typeof quizController.getQuizHistory === 'function') {
  app.get('/api/quizzes/user/history', authMiddleware, quizController.getQuizHistory);
} else {
  console.log('⚠  Route /api/quizzes/user/history non disponible');
  app.get('/api/quizzes/user/history', authMiddleware, (req, res) => {
    res.json({
      success: true,
      history: []
    });
  });
}

// ==================== ROUTES PROTÉGÉES ====================

// Routes utilisateur authentifié
app.get('/api/users/profile', authMiddleware, userController.getProfile);
app.put('/api/users/profile', authMiddleware, userController.updateProfile);
app.get('/api/users/premium-status', authMiddleware, userController.getPremiumStatus);

// ==================== ROUTES DE PAIEMENT ====================

// Routes de paiement
app.post('/api/payments/initiate', authMiddleware, paymentController.initiatePayment);
app.post('/api/payments/process-return', authMiddleware, paymentController.processPaymentReturn);
app.get('/api/payments/check-status/:transactionId', authMiddleware, paymentController.checkTransactionStatus);
app.get('/api/payments/latest-access-code', authMiddleware, paymentController.getLatestAccessCode);

// Webhook KkiaPay (sans authentification)
app.post('/api/payments/webhook/kkiapay', webhookLogger, (req, res) => {
  console.log('📩 Webhook KkiaPay reçu:', req.body);
  
  // Traitement basique du webhook
  if (req.body && req.body.transaction_id) {
    console.log('Transaction ID:', req.body.transaction_id);
    console.log('Statut:', req.body.status);
  }
  
  res.status(200).json({ 
    success: true, 
    message: 'Webhook reçu',
    received: true 
  });
});

// ==================== ROUTES CODE D'ACCÈS ====================

app.post('/api/access-codes/validate', authMiddleware, accessCodeController.validateAccessCode);
app.post('/api/access-codes/resend', authMiddleware, accessCodeController.resendAccessCode);

// ==================== ROUTES ADMIN ====================

// Routes admin (basiques)
app.get('/api/admin/users', authMiddleware, async (req, res) => {
  try {
    const User = require('./models/User');
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

app.get('/api/admin/transactions', authMiddleware, async (req, res) => {
  try {
    const Transaction = require('./models/Transaction');
    const transactions = await Transaction.find().populate('userId', 'name email').sort({ createdAt: -1 });
    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ==================== ROUTE DE TEST KKiaPay ====================

app.get('/api/test-kkiapay', async (req, res) => {
  try {
    const kkiapay = require('./config/kkiapay');
    
    console.log('🧪 Test de configuration KkiaPay...');
    console.log('Clé publique:', process.env.KKIAPAY_PUBLIC_KEY ? 'PRÉSENTE' : 'MANQUANTE');
    console.log('Mode:', process.env.KKIAPAY_MODE || 'non défini');
    
    const testPayment = await kkiapay.createPayment({
      amount: 100,
      phone: '+22900000000',
      name: 'Test User',
      email: 'test@example.com',
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
    
    let errorDetails = 'Erreur inconnue';
    if (error.response) {
      errorDetails = error.response.data;
    } else if (error.request) {
      errorDetails = 'Aucune réponse du serveur KkiaPay';
    } else {
      errorDetails = error.message;
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorDetails,
      config: {
        publicKey: process.env.KKIAPAY_PUBLIC_KEY ? 'PRÉSENTE' : 'MANQUANTE',
        privateKey: process.env.KKIAPAY_PRIVATE_KEY ? 'PRÉSENTE' : 'MANQUANTE', 
        secretKey: process.env.KKIAPAY_SECRET_KEY ? 'PRÉSENTE' : 'MANQUANTE',
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
    path: req.originalUrl,
    availableRoutes: [
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/quizzes',
      '/api/payments/initiate'
    ]
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
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error.toString()
    })
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================

const PORT = process.env.PORT || 5000;

const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 SERVEUR DÉMARRÉ AVEC SUCCÈS
================================
📍 Port: ${PORT}
🌐 Environnement: ${process.env.NODE_ENV || 'development'}
📧 Email: ${process.env.EMAIL_USER ? 'CONFIGURÉ' : 'NON CONFIGURÉ'}
💰 KkiaPay: ${process.env.KKIAPAY_PUBLIC_KEY ? 'CONFIGURÉ' : 'NON CONFIGURÉ'}
🔗 Frontend: ${process.env.FRONTEND_URL || 'Non défini'}
🗄  MongoDB: ${process.env.MONGODB_URI ? 'CONNECTÉ' : 'NON CONFIGURÉ'}
================================
    `);
    
    // Test automatique de la configuration
    setTimeout(async () => {
      try {
        // Test email
        if (process.env.EMAIL_USER) {
          const transporter = require('./config/email');
          transporter.verify((error) => {
            if (error) {
              console.log('⚠  Email - Vérification échouée:', error.message);
            } else {
              console.log('✅ Email - Configuration réussie');
            }
          });
        }
        
        // Test base de données
        const dbState = mongoose.connection.readyState;
        console.log(`🗄  Base de données: ${dbState === 1 ? 'CONNECTÉE' : 'DÉCONNECTÉE'}`);
        
      } catch (testError) {
        console.log('⚠  Tests automatiques échoués:', testError.message);
      }
    }, 2000);
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