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

// ✅ AJOUT: Import des middlewares webhook
const verifyWebhook = require('./middleware/verifyWebhook');
const webhookLogger = require('./middleware/webhookLogger');

// Configuration MongoDB
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
  
  // Import des routes
  const authRoutes = require('./routes/auth');
  const quizRoutes = require('./routes/quiz');
  const paymentRoutes = require('./routes/payment');
  const userRoutes = require('./routes/user');
  const accessCodeRoutes = require('./routes/accessCode');
  const tokenRoutes = require('./routes/token');
  
  // ✅ AJOUT: Import des routes webhook
  const webhookRoutes = require('./routes/webhook');

  const app = express();

  // Middleware de monitoring production
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
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400
  }));

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

  // Routes de santé et debug
  app.get('/api/health', (req, res) => {
    res.status(200).json({ 
      success: true, 
      message: 'Server is running correctly - PRODUCTION MODE',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
  });

  // ✅ WEBHOOKS (DOIVENT ÊTRE PUBLICS - SANS AUTH)
  app.use('/api/webhook', webhookLogger, webhookRoutes);

  // Routes publiques
  app.use('/api/auth', authRoutes);
  
  // Middleware d'authentification global pour routes protégées
  app.use(auth);
  app.use(checkPremiumStatus);
  app.use(sessionCheck);

  // Routes protégées
  app.use('/api/payment', paymentRoutes);
  app.use('/api/quiz', quizRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/access-code', accessCodeRoutes);
  app.use('/api/auth', tokenRoutes);

  // Servir les fichiers statiques
  app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

  // Middleware de gestion des erreurs
  app.use(handleDatabaseError);

  // Gestion des routes non trouvées
  app.use('*', (req, res) => {
    console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
      success: false, 
      message: 'Route not found'
    });
  });

  // Gestionnaire d'erreurs global
  app.use((err, req, res, next) => {
    console.error('❌ ERROR:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error'
    });
  });

  const PORT = process.env.PORT || 5000;
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} - PRODUCTION MODE`);
    console.log('✅ Toutes les routes sont montées');
  });

  // Gestion graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    server.close(() => {
      mongoose.connection.close();
      process.exit(0);
    });
  });

})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});