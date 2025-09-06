const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import des routes
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const paymentRoutes = require('./routes/payment');
const userRoutes = require('./routes/user');

// Import du contrôleur d'authentification
const authController = require('./controllers/authController');

const app = express();

// Middleware CORS pour production et développement
app.use(cors({
  origin: [
    'https://quiz-de-carabin.netlify.app',
    'https://quiz-de-carabin-backend.onrender.com',
    'http://localhost:3000', // pour le développement local
    'http://127.0.0.1:5500'  // pour Live Server
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connexion à MongoDB avec meilleure gestion d'erreurs
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  console.log('MongoDB Host:', mongoose.connection.host);
})
.catch(err => {
  console.error('Could not connect to MongoDB', err);
  console.error('MongoDB Connection Error Details:', err.message);
});

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/user', userRoutes);

// Route de santé améliorée
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({ 
    success: true, 
    message: 'Server is running correctly',
    timestamp: new Date().toISOString(),
    mode: process.env.NODE_ENV || 'development',
    database: dbStatus,
    nodeVersion: process.version
  });
});

// Route de test pour vérifier l'environnement
app.get('/api/debug/env', (req, res) => {
  // Ne pas renvoyer les informations sensibles en production
  const safeEnv = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not Set',
    MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not Set',
    PAYDUNYA_MODE: process.env.PAYDUNYA_MODE
  };
  
  res.status(200).json({
    success: true,
    environment: safeEnv
  });
});

// Gestion des routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Gestionnaire d'erreurs global amélioré
app.use((err, req, res, next) => {
  console.error('Error Stack:', err.stack);
  console.error('Error Details:', err);
  
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PayDunya Mode: ${process.env.PAYDUNYA_MODE || 'live'}`);
  console.log(`Health check available at: http://localhost:${PORT}/api/health`);
});