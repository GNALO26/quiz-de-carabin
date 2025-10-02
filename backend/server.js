const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import des middlewares
const deviceDetection = require('./middleware/deviceDetection');
const auth = require('./middleware/auth');
const sessionCheck = require('./middleware/sessionCheck');
const handleDatabaseError = require('./middleware/handleDatabaseError');
const productionMonitor = require('./middleware/productionMonitor'); // ✅ NOUVEAU

// Configuration optimisée POUR LA PRODUCTION
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // ✅ Augmenté pour la production
  serverSelectionTimeoutMS: 30000, // ✅ Augmenté
  socketTimeoutMS: 45000,
  bufferCommands: false,
  bufferMaxEntries: 0 // ✅ Désactivé pour la production
};

console.log('🚀 DÉMARRAGE EN MODE PRODUCTION LIVE');
console.log('=====================================\n');

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('✅ MongoDB LIVE connecté');
  
  // Diagnostic complet
  console.log('\n🔍 DIAGNOSTIC LIVE:');
  
  // Vérification PayDunya LIVE
  try {
    const { setup } = require('./config/paydunya');
    console.log('📦 PayDunya:');
    console.log('   - Mode:', setup.mode.toUpperCase());
    console.log('   - Clés:', setup.masterKey && setup.privateKey ? '✓ LIVE' : '✗ CONFIGURATION');
  } catch (error) {
    console.error('❌ PayDunya:', error.message);
  }
  
  // Vérification Email
  setTimeout(() => {
    const transporter = require('./config/email');
    transporter.verify(function(error, success) {
      if (error) {
        console.log('❌ Email:', error.message);
      } else {
        console.log('✅ Email: Prêt pour les envois LIVE');
      }
    });
  }, 2000);

  // Charger les modèles
  require('./models/User');
  require('./models/Quiz');
  require('./models/PasswordReset');
  require('./models/Session');
  require('./models/Transaction');
  require('./models/AccessCode');
  
  // Import des routes
  const authRoutes = require('./routes/auth');
  const quizRoutes = require('./routes/quiz');
  const paymentRoutes = require('./routes/payment');
  const userRoutes = require('./routes/user');
  const accessCodeRoutes = require('./routes/accessCode');
  const tokenRoutes = require('./routes/token');
  const webhookRoutes = require('./routes/webhook');

  const app = express();

  // ✅ MIDDLEWARE DE SURVEILLANCE PRODUCTION
  app.use(productionMonitor);

  // Middleware CORS pour production
  app.use(cors({
    origin: [
      'https://quiz-de-carabin.netlify.app',
      'https://quiz-de-carabin-backend.onrender.com'
    ],
    credentials: true
  }));

  // Middleware pour parser le JSON
  app.use(express.json({ 
    limit: '10mb', // ✅ Augmenté pour la production
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Détection d'appareil
  app.use(deviceDetection);

  // Route santé améliorée pour la production
  app.get('/api/health', (req, res) => {
    const health = {
      success: true,
      message: '🚀 SERVEUR LIVE - Quiz de Carabin',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      paydunya: 'live',
      version: '1.0.0'
    };
    
    res.status(200).json(health);
  });

  // ✅ WEBHOOKS (Routes publiques)
  app.use('/api/payment', webhookRoutes);

  // Routes d'authentification
  app.use('/api/auth', authRoutes);

  // Middleware d'authentification
  app.use(auth);
  app.use(sessionCheck);

  // Routes protégées
  app.use('/api/quiz', quizRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/access-code', accessCodeRoutes);
  app.use('/api/auth', tokenRoutes);

  // Gestion des erreurs
  app.use(handleDatabaseError);

  // Route 404
  app.use('*', (req, res) => {
    res.status(404).json({ 
      success: false, 
      message: 'Route not found' 
    });
  });

  // Gestionnaire d'erreurs global
  app.use((err, req, res, next) => {
    console.error('💥 ERREUR LIVE:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error'
    });
  });

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`\n🎉 SERVEUR LIVE DÉMARRÉ`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
    console.log(`💳 PayDunya: ${process.env.PAYDUNYA_MODE}`);
    console.log(`🚀 Prêt à recevoir des paiements LIVE!`);
  });

  // Gestion propre de la fermeture
  process.on('SIGINT', () => {
    console.log('\n🔄 Arrêt gracieux du serveur...');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('✅ Serveur arrêté proprement');
        process.exit(0);
      });
    });
  });
  
})
.catch(err => {
  console.error('❌ ERREUR CRITIQUE - Impossible de démarrer:', err);
  process.exit(1);
});