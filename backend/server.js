const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import des middlewares
const deviceDetection = require('./middleware/deviceDetection');
const auth = require('./middleware/auth');
const sessionCheck = require('./middleware/sessionCheck');
const handleDatabaseError = require('./middleware/handleDatabaseError');
const productionMonitor = require('./middleware/productionMonitor');
const checkPremiumStatus = require('./middleware/checkPremiumStatus');

// ✅ CORRECTION: Configuration MongoDB simplifiée et corrigée
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('✅ Connected to MongoDB - PRODUCTION MODE');
  console.log('📊 Database:', mongoose.connection.name);

  // Après la connexion MongoDB
const webhookQueue = require('./services/webhookQueue');
const paymentMonitor = require('./services/paymentMonitor');

console.log('🔄 Services background initialisés');
  
  // Import des routes
  const authRoutes = require('./routes/auth');
  const quizRoutes = require('./routes/quiz');
  const paymentRoutes = require('./routes/payment');
  const userRoutes = require('./routes/user');
  const accessCodeRoutes = require('./routes/accessCode');
  const tokenRoutes = require('./routes/token');
  const webhookRoutes = require('./routes/webhook');

  const app = express();

  // ✅ MIDDLEWARE DE MONITORING PRODUCTION
  app.use(productionMonitor);

  // Middleware CORS pour la production
  app.use(cors({
    origin: [
      'https://quiz-de-carabin.netlify.app',
      'https://quiz-de-carabin-backend.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-API-KEY',
      'X-Kkiapay-Signature'
    ],
    exposedHeaders: [
      'Content-Range',
      'X-Content-Range'
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400 // 24 heures
  }));

  // Gestion préflight CORS étendue
  app.options('*', cors());

  // Middleware pour parser le JSON
  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 1000
  }));

  // Détection d'appareil
  app.use(deviceDetection);

  // ✅ ROUTES DE SANTÉ ET DEBUG - AVANT AUTH
  app.get('/api/health', (req, res) => {
    res.status(200).json({ 
      success: true, 
      message: 'Server is running correctly - PRODUCTION MODE',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV,
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      kkiapayMode: process.env.KKIAPAY_MODE
    });
  });

  // Route de diagnostic système
  app.get('/api/diagnostics', (req, res) => {
    const diagnostics = {
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        readyState: mongoose.connection.readyState
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        KKIAPAY_MODE: process.env.KKIAPAY_MODE
      },
      services: {
        email: process.env.EMAIL_USER ? 'configured' : 'not configured',
        kkiapay: process.env.KKIAPAY_PUBLIC_KEY ? 'configured' : 'not configured'
      }
    };
    
    res.status(200).json({
      success: true,
      diagnostics,
      timestamp: new Date().toISOString()
    });
  });

  // Routes de debug payment (publiques pour tests)
  app.get('/api/debug/payment-test', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Route debug payment accessible sans auth - PRODUCTION',
      timestamp: new Date().toISOString(),
      kkiapayMode: process.env.KKIAPAY_MODE,
      publicKey: process.env.KKIAPAY_PUBLIC_KEY ? 'configured' : 'not configured'
    });
  });

  app.get('/api/debug/payment-test-protected', auth, (req, res) => {
    res.json({ 
      success: true, 
      message: 'Route debug payment accessible avec auth - PRODUCTION',
      user: req.user ? req.user.email : 'no user',
      timestamp: new Date().toISOString()
    });
  });

  // ✅ ROUTES PUBLIQUES
  app.use('/api/auth', authRoutes);
  
  // ✅ WEBHOOKS (DOIVENT ÊTRE PUBLICS - SANS AUTH)
  app.use('/api/webhook', webhookRoutes);

  // ✅ MIDDLEWARE D'AUTHENTIFICATION GLOBAL pour routes protégées
  app.use(auth);
  
  // ✅ MIDDLEWARE DE VÉRIFICATION ABONNEMENT (AJOUT IMPORTANT)
  app.use(checkPremiumStatus);
  
  app.use(sessionCheck);

  // Routes d'administration (APRÈS l'authentification)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

  // ✅ ROUTES PROTÉGÉES - PRODUCTION
  app.use('/api/payment', paymentRoutes);
  app.use('/api/quiz', quizRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/access-code', accessCodeRoutes);
  app.use('/api/auth', tokenRoutes);

  // ✅ SERVIR LES FICHIERS STATIQUES POUR LES UPLOADS
  app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

  // Middleware de gestion des erreurs de base de données
  app.use(handleDatabaseError);

  // ✅ GESTION DES ROUTES NON TROUVÉES
  app.use('*', (req, res) => {
    console.log(`❌ Route non trouvée - PRODUCTION: ${req.method} ${req.originalUrl}`);
    
    res.status(404).json({ 
      success: false, 
      message: 'Route not found',
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  });

  // ✅ GESTIONNAIRE D'ERREURS GLOBAL - PRODUCTION
  app.use((err, req, res, next) => {
    console.error('❌ ERROR - PRODUCTION:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    // En production, ne pas envoyer les détails de l'erreur au client
    const errorResponse = {
      success: false, 
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      errorId: `ERR_${Date.now()}`
    };
    
    // En développement, on peut envoyer plus de détails
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = err.message;
      errorResponse.stack = err.stack;
    }
    
    res.status(500).json(errorResponse);
  });

  const PORT = process.env.PORT || 5000;
  
  // Démarrer le serveur
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} - PRODUCTION MODE`);
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('📡 URL:', `https://quiz-de-carabin-backend.onrender.com`);
    console.log('🔧 Configuration chargée:');
    console.log('   - MongoDB:', mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected');
    console.log('   - KkiaPay Mode:', process.env.KKIAPAY_MODE);
    console.log('   - Email:', process.env.EMAIL_USER ? '✅ Configured' : '❌ Not configured');
    console.log('📋 Routes montées:');
    console.log('   - GET  /api/health');
    console.log('   - GET  /api/diagnostics');
    console.log('   - GET  /api/debug/payment-test');
    console.log('   - GET  /api/debug/payment-test-protected (protected)');
    console.log('   - POST /api/payment/initiate (protected)');
    console.log('   - POST /api/payment/direct/initiate (protected)');
    console.log('   - POST /api/payment/process-return (protected)');
    console.log('   - POST /api/webhook/kkiapay (public)');
    console.log('   - ALL  /api/auth');
    console.log('   - GET  /api/uploads/* (public)');
    console.log('🔒 Middlewares actifs:');
    console.log('   - CORS');
    console.log('   - Authentication');
    console.log('   - Premium Status Check');
    console.log('   - Session Check');
    console.log('   - Device Detection');
    console.log('   - Production Monitor');
    console.log('================================');
  });

  // ✅ GESTION GRACIEUSE DE L'ARRÊT
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT. Shutting down gracefully...');
    server.close(() => {
      console.log('✅ HTTP server closed.');
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed.');
        process.exit(0);
      });
    });
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM. Shutting down gracefully...');
    server.close(() => {
      console.log('✅ HTTP server closed.');
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed.');
        process.exit(0);
      });
    });
  });

  // ✅ GESTION DES ERREURS NON CAPTURÉES
  process.on('uncaughtException', (error) => {
    console.error('💥 UNCAUGHT EXCEPTION - PRODUCTION:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION - PRODUCTION:', reason);
    console.error('At promise:', promise);
    process.exit(1);
  });

  // ✅ VÉRIFICATION DE LA CONFIGURATION AU DÉMARRAGE
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'KKIAPAY_PUBLIC_KEY',
    'KKIAPAY_SECRET_KEY',
    'EMAIL_USER',
    'EMAIL_PASS'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ VARIABLES D\'ENVIRONNEMENT MANQUANTES:', missingVars);
    console.error('⚠  Le serveur peut ne pas fonctionner correctement');
  } else {
    console.log('✅ Toutes les variables d\'environnement requises sont configurées');
  }

  // ✅ VÉRIFICATION DE LA CONNEXION KKiaPay
  if (process.env.KKIAPAY_PUBLIC_KEY && process.env.KKIAPAY_MODE === 'live') {
    console.log('✅ KkiaPay configuré en mode PRODUCTION');
  } else if (process.env.KKIAPAY_PUBLIC_KEY) {
    console.warn('⚠  KkiaPay configuré mais pas en mode LIVE');
  } else {
    console.error('❌ KkiaPay non configuré');
  }

})
.catch(err => {
  console.error('❌ Could not connect to MongoDB - PRODUCTION', err);
  console.error('💥 Application will exit');
  process.exit(1);
});

module.exports = mongoose;