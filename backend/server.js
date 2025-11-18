const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import des middlewares
const deviceDetection = require('./middleware/deviceDetection');
const auth = require('./middleware/auth');
const sessionCheck = require('./middleware/sessionCheck');
const handleDatabaseError = require('./middleware/handleDatabaseError');

// Configuration optimisée pour serveurs gratuits
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
};

// Connexion à MongoDB avec gestion d'erreurs améliorée
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('Connected to MongoDB');
  
  // Test de la configuration email au démarrage
  setTimeout(() => {
    const transporter = require('./config/email');
    transporter.verify(function(error, success) {
      if (error) {
        console.log('❌ Erreur configuration email:', error);
      } else {
        console.log('✅ Serveur email est prêt à envoyer des messages');
      }
    });
  }, 3000);
  
  // Charger les modèles après la connexion réussie
  require('./models/User');
  require('./models/Quiz');
  require('./models/PasswordReset');
  require('./models/Session');
  require('./models/Transaction');
  require('./models/AccessCode');
  
  // Import des routes (APRÈS la connexion à la base de données)
  const authRoutes = require('./routes/auth');
  const quizRoutes = require('./routes/quiz');
  const paymentRoutes = require('./routes/payment');
  const userRoutes = require('./routes/user');
  const accessCodeRoutes = require('./routes/accessCode');
  const tokenRoutes = require('./routes/token');
  const webhookRoutes = require('./routes/webhook');

  const app = express();

  // Middleware CORS
  app.use(cors({
    origin: [
      'https://quiz-de-carabin.netlify.app',
      'https://quiz-de-carabin-backend.onrender.com',
      'http://localhost:3000',
      'http://localhost:3001'
    ],
    credentials: true
  }));

  // Middleware pour parser le JSON
  app.use(express.json({ 
    limit: '1mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Détection d'appareil
  app.use(deviceDetection);

  // ✅ CORRECTION: Routes de debug pour tester l'accès
  app.get('/api/payment/debug-test', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Route payment accessible sans auth',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/payment/debug-test-protected', auth, (req, res) => {
    res.json({ 
      success: true, 
      message: 'Route payment accessible avec auth',
      user: req.user ? req.user.email : 'no user',
      timestamp: new Date().toISOString()
    });
  });

  // Routes publiques (sans authentification)
  app.get('/api/health', (req, res) => {
    res.status(200).json({ 
      success: true, 
      message: 'Server is running correctly',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
  });

  // Routes d'authentification (publiques)
  app.use('/api/auth', authRoutes);
  
  // ✅ CORRECTION: Webhooks doivent être AVANT l'authentification
  app.use('/api/webhook', webhookRoutes);

  // Middleware d'authentification (pour les routes suivantes)
  app.use(auth);
  app.use(sessionCheck);

  // ✅ CORRECTION: Routes protégées - BIEN MONTER paymentRoutes ICI
  app.use('/api/payment', paymentRoutes);
  app.use('/api/quiz', quizRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/access-code', accessCodeRoutes);
  app.use('/api/auth', tokenRoutes);

  // Middleware de gestion des erreurs de base de données
  app.use(handleDatabaseError);

  // Gestion des routes non trouvées
  app.use('*', (req, res) => {
    res.status(404).json({ 
      success: false, 
      message: 'Route not found',
      path: req.originalUrl
    });
  });

  // Gestionnaire d'erreurs global
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('🔄 Routes montées:');
    console.log('   - /api/health (public)');
    console.log('   - /api/auth (public)');
    console.log('   - /api/webhook (public)');
    console.log('   - /api/payment (protégé)');
    console.log('   - /api/quiz (protégé)');
    console.log('   - /api/user (protégé)');
  });

  // Gestion propre de la fermeture
  process.on('SIGINT', () => {
    console.log('Shutting down gracefully');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
})
.catch(err => {
  console.error('Could not connect to MongoDB', err);
  process.exit(1);
});

// Gestion des erreurs de connexion après initialisation
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});