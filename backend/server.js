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
const checkPremiumStatus = require('./middleware/checkPremiumStatus');

// Configuration MongoDB optimisée
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
  retryWrites: true
};

// Connexion à MongoDB avec gestion d'erreurs robuste
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
  console.log('📊 Database:', mongoose.connection.name);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Import des routes (APRÈS la connexion MongoDB)
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const paymentRoutes = require('./routes/payment');
const userRoutes = require('./routes/user');
const accessCodeRoutes = require('./routes/accessCode');
const tokenRoutes = require('./routes/token');
const webhookRoutes = require('./routes/webhook');

const app = express();

// ==================== MIDDLEWARES ====================

// CORS configuration étendue
app.use(cors({
  origin: [
    'https://quiz-de-carabin.netlify.app',
    'https://quiz-de-carabin-backend.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-kkiapay-signature']
}));

// Gérer les pré-vols CORS
app.options('*', cors());

// Body parser avec limites
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf; // Important pour les webhooks
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Middleware de logging des requêtes
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Détection d'appareil
app.use(deviceDetection);

// ==================== ROUTES PUBLIQUES ====================

// Route de santé
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    message: '🚀 Quiz de Carabin Backend - Operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

// Routes de debug
app.get('/api/debug/routes', (req, res) => {
  res.json({
    success: true,
    routes: {
      public: ['/api/health', '/api/debug/routes', '/api/auth/', '/api/webhook/'],
      protected: ['/api/payment/', '/api/quiz/', '/api/user/', '/api/access-code/']
    }
  });
});

// Routes d'authentification (publiques)
app.use('/api/auth', authRoutes);

// Webhooks (DOIVENT ÊTRE PUBLICS)
app.use('/api/webhook', webhookRoutes);

// ==================== MIDDLEWARE D'AUTHENTIFICATION ====================

// Protection des routes suivantes
app.use(auth);
app.use(sessionCheck);
app.use(checkPremiumStatus); // Vérifie et met à jour le statut premium automatiquement

// ==================== ROUTES PROTÉGÉES ====================

app.use('/api/payment', paymentRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/user', userRoutes);
app.use('/api/access-code', accessCodeRoutes);
app.use('/api/auth', tokenRoutes); // Routes auth protégées

// ==================== GESTION DES ERREURS ====================

// Middleware de gestion des erreurs de base de données
app.use(handleDatabaseError);

// Route 404 - Not Found
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: '🔍 Route non trouvée',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      public: ['/api/health', '/api/auth/login', '/api/auth/register'],
      protected: ['/api/payment/initiate', '/api/user/profile', '/api/quiz/*']
    }
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('💥 Global Error Handler:', err);
  
  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false, 
      message: 'Token invalide' 
    });
  }
  
  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      success: false, 
      message: 'Données invalides',
      errors: err.errors 
    });
  }
  
  // Erreur MongoDB duplicate key
  if (err.code === 11000) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cette ressource existe déjà' 
    });
  }
  
  // Erreur générique
  res.status(500).json({ 
    success: false, 
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// ==================== DÉMARRAGE DU SERVEUR ====================

const PORT = process.env.PORT || 5000;

// Attendre que MongoDB soit connecté avant de démarrer
mongoose.connection.once('open', () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 QUIZ DE CARABIN BACKEND - DÉMARRÉ AVEC SUCCÈS');
    console.log('='.repeat(60));
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄 Database: ${mongoose.connection.name} (${mongoose.connection.host})`);
    console.log('\n📋 Routes disponibles:');
    console.log('   PUBLIC:');
    console.log('   - GET  /api/health');
    console.log('   - POST /api/auth/login');
    console.log('   - POST /api/auth/register');
    console.log('   - POST /api/webhook/kkiapay');
    console.log('\n   PROTECTED:');
    console.log('   - POST /api/payment/initiate');
    console.log('   - GET  /api/user/premium-status');
    console.log('   - POST /api/quiz/submit');
    console.log('   - GET  /api/quiz/history');
    console.log('='.repeat(60) + '\n');
  });

  // Gestion propre de l'arrêt
  process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt gracieux du serveur...');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('✅ Serveur et base de données fermés');
        process.exit(0);
      });
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Réception signal SIGTERM...');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('✅ Serveur et base de données fermés');
        process.exit(0);
      });
    });
  });
});

// Gestion des erreurs de connexion MongoDB
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔁 MongoDB reconnected');
});

// Export pour les tests
module.exports = app;