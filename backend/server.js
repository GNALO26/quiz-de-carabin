const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import des middlewares
const deviceDetection = require('./middleware/deviceDetection');
const auth = require('./middleware/auth');
const sessionCheck = require('./middleware/sessionCheck');
const handleDatabaseError = require('./middleware/handleDatabaseError');

// Configuration MongoDB
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('✅ Connected to MongoDB');
  
  // Import des routes
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

  // ✅ ROUTES DE DEBUG - AVANT AUTH
  app.get('/api/debug/payment-test', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Route debug payment accessible sans auth',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/debug/payment-test-protected', auth, (req, res) => {
    res.json({ 
      success: true, 
      message: 'Route debug payment accessible avec auth',
      user: req.user ? req.user.email : 'no user',
      timestamp: new Date().toISOString()
    });
  });

  // Routes publiques
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
  
  // Webhooks (publics)
  app.use('/api/webhook', webhookRoutes);

  // ✅ MIDDLEWARE D'AUTHENTIFICATION
  app.use(auth);
  app.use(sessionCheck);

  // ✅ ROUTES PROTÉGÉES - BIEN MONTER paymentRoutes ICI
  app.use('/api/payment', paymentRoutes);
  app.use('/api/quiz', quizRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/access-code', accessCodeRoutes);
  app.use('/api/auth', tokenRoutes);

  // Middleware de gestion des erreurs
  app.use(handleDatabaseError);

  // Gestion des routes non trouvées
  app.use('*', (req, res) => {
    res.status(404).json({ 
      success: false, 
      message: 'Route not found',
      path: req.originalUrl,
      method: req.method
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
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('📋 Routes montées:');
    console.log('   - GET  /api/health');
    console.log('   - GET  /api/debug/payment-test');
    console.log('   - GET  /api/debug/payment-test-protected (protected)');
    console.log('   - POST /api/payment/initiate (protected)');
    console.log('   - ALL  /api/auth');
    console.log('   - ALL  /api/webhook');
  });

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
  console.error('❌ Could not connect to MongoDB', err);
  process.exit(1);
});