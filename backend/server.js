const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Configuration optimisée pour serveurs gratuits (options corrigées)
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 5, // Option corrigée - taille maximale du pool de connexions
  serverSelectionTimeoutMS: 5000, // Timeout après 5 secondes
  socketTimeoutMS: 45000, // Fermer les sockets inactifs
  bufferCommands: false, // Désactiver le buffering
  // bufferMaxEntries a été retiré car il est déprécié
};

// Connexion à MongoDB avec gestion d'erreurs améliorée
mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('Connected to MongoDB');
  
  // Charger les modèles après la connexion réussie
  require('./models/User');
  require('./models/Quiz');
  require('./models/PasswordReset');
  
  // Import des routes (APRÈS la connexion à la base de données)
  const authRoutes = require('./routes/auth');
  const quizRoutes = require('./routes/quiz');
  const paymentRoutes = require('./routes/payment');
  const userRoutes = require('./routes/user');
  const accessCodeRoutes = require('./routes/accessCode');
  const tokenRoutes = require('./routes/token');
  const deviceDetection = require('./middleware/deviceDetection');

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
    limit: '1mb', // Réduire la limite pour les serveurs gratuits
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));
  
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Détection d'appareil
  app.use(deviceDetection);

  // Routes API
  app.use('/api/auth', authRoutes);
  app.use('/api/quiz', quizRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/access-code', accessCodeRoutes);
  app.use('/api/auth', tokenRoutes);

  // Route de santé
  app.get('/api/health', (req, res) => {
    res.status(200).json({ 
      success: true, 
      message: 'Server is running correctly',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
  });

  // Middleware de gestion des erreurs de base de données
  app.use((err, req, res, next) => {
    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
      console.error('Database error:', err);
      return res.status(503).json({
        success: false,
        message: 'Service temporairement indisponible',
        code: 'DATABASE_ERROR'
      });
    }
    next(err);
  });

  // Gestion des routes non trouvées
  app.use('*', (req, res) => {
    res.status(404).json({ 
      success: false, 
      message: 'Route not found' 
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