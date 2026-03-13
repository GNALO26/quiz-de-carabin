const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const deviceDetection = require('./middleware/deviceDetection');
const auth = require('./middleware/auth');
const sessionCheck = require('./middleware/sessionCheck');
const handleDatabaseError = require('./middleware/handleDatabaseError');
const productionMonitor = require('./middleware/productionMonitor');
const checkPremiumStatus = require('./middleware/checkPremiumStatus');

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};

mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
.then(() => {
  console.log('✅ Connected to MongoDB - PRODUCTION MODE');
  console.log('📊 Database:', mongoose.connection.name);

  // FIX: Supprimer l'ancien index unique non-sparse sur transactionId
  mongoose.connection.db.collection('transactions').indexExists('transactionId_1')
    .then(exists => {
      if (exists) {
        return mongoose.connection.db.collection('transactions').dropIndex('transactionId_1')
          .then(() => console.log('✅ Index transactionId_1 supprimé'))
          .catch(err => console.warn('Drop index err:', err.message));
      }
    }).catch(() => {});

  const webhookQueue = require('./services/webhookQueue');
  const paymentMonitor = require('./services/paymentMonitor');
  console.log('🔄 Services background initialisés');

  const { setupSubscriptionCrons } = require('./utils/subscriptionChecker');
  setupSubscriptionCrons();

  const cronJobs = require('./cronJobs');
  cronJobs.startAllJobs();
  console.log('⏰ Tâches automatiques (cron jobs) démarrées');

  const authRoutes = require('./routes/auth');
  const quizRoutes = require('./routes/quiz');
  const paymentRoutes = require('./routes/payment');
  const userRoutes = require('./routes/user');
  const accessCodeRoutes = require('./routes/accessCode');
  const tokenRoutes = require('./routes/token');
  const webhookRoutes = require('./routes/webhook');
  const statsRoutes = require('./routes/stats');
  const notificationRoutes = require('./routes/notifications');

  const app = express();

  app.use(productionMonitor);

  app.use(cors({
    origin: [
      'https://quiz-de-carabin.com',
      'https://www.quiz-de-carabin.com',
      'https://quiz-de-carabin.netlify.app',
      'http://localhost:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-API-KEY', 'X-Kkiapay-Signature', 'X-FedaPay-Signature'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400
  }));

  app.options('*', cors());

  app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => { req.rawBody = buf; }
  }));

  app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 1000 }));

  app.use(deviceDetection);

  // ===== ROUTES PUBLIQUES (AVANT AUTH) =====

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is running correctly - PRODUCTION MODE',
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV,
      version: '2.1.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      fedapayMode: process.env.FEDAPAY_ENVIRONMENT
    });
  });

  app.get('/api/diagnostics', (req, res) => {
    res.status(200).json({
      success: true,
      diagnostics: {
        system: { nodeVersion: process.version, uptime: process.uptime(), memory: process.memoryUsage() },
        database: { status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', name: mongoose.connection.name },
        environment: { NODE_ENV: process.env.NODE_ENV, FEDAPAY_ENVIRONMENT: process.env.FEDAPAY_ENVIRONMENT },
        services: {
          email: process.env.EMAIL_USER ? 'configured' : 'not configured',
          fedapay: process.env.FEDAPAY_SECRET_KEY ? 'configured' : 'not configured'
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/debug/payment-test', (req, res) => {
    res.json({ success: true, message: 'Route debug accessible', timestamp: new Date().toISOString() });
  });

  app.get('/api/debug/payment-test-protected', auth, (req, res) => {
    res.json({ success: true, user: req.user ? req.user.email : 'no user', timestamp: new Date().toISOString() });
  });

  // Auth publique
  app.use('/api/auth', authRoutes);

  // ⚠️ ROUTE TEMPORAIRE ADMIN - À SUPPRIMER APRÈS USAGE
  app.post('/api/make-me-admin', async (req, res) => {
    try {
      const { email, secretKey } = req.body;
      
      if (secretKey !== '#@@#CarlazarabrokrishouedarOlympe2025') {
        return res.status(403).json({ success: false, message: 'Clé secrète invalide' });
      }
      
      const User = require('./models/User');
      const user = await User.findOne({ email: email.toLowerCase().trim() });
      
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }
      
      user.isAdmin = true;
      await user.save();
      
      console.log(`✅ ${email} est maintenant administrateur`);
      
      res.status(200).json({
        success: true,
        message: `${email} est maintenant administrateur. DÉCONNECTEZ-VOUS et RECONNECTEZ-VOUS pour que les changements prennent effet.`,
        user: { email: user.email, name: user.name, isAdmin: user.isAdmin }
      });
      
    } catch (error) {
      console.error('Erreur make-me-admin:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  });

  // Webhooks KkiaPay public
  app.use('/api/webhook', webhookRoutes);

  // ✅ WEBHOOK FEDAPAY PUBLIC — DOIT ÊTRE AVANT app.use(auth)
  app.post('/api/payment/fedapay/webhooks/fedapay', async (req, res) => {
    try {
      const fedapayCtrl = require('./controllers/fedapayController');
      await fedapayCtrl.handleWebhook(req, res);
    } catch (err) {
      console.error('❌ Webhook FedaPay erreur:', err.message);
      res.status(500).json({ success: false, message: 'Erreur webhook' });
    }
  });

  // ===== MIDDLEWARE AUTH GLOBAL =====
  app.use(auth);
  app.use(checkPremiumStatus);
  app.use(sessionCheck);

  // 🔍 ROUTE DEBUG - À SUPPRIMER APRÈS RÉSOLUTION
  app.get('/api/debug/check-my-admin', (req, res) => {
    try {
      const userObj = req.user ? req.user.toObject() : null;
      res.json({
        authenticated: !!req.user,
        userId: req.user?._id,
        email: req.user?.email,
        isAdmin: req.user?.isAdmin,
        isPremium: req.user?.isPremium,
        hasIsAdminField: userObj ? 'isAdmin' in userObj : false,
        userKeys: userObj ? Object.keys(userObj) : [],
        rawIsAdmin: req.user ? req.user.isAdmin : undefined,
        isAdminType: req.user ? typeof req.user.isAdmin : 'undefined'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== ROUTES PROTÉGÉES =====
  const adminRoutes = require('./routes/admin');
  app.use('/api/admin', adminRoutes);

  // ⚠️ fedapay AVANT /api/payment (route plus spécifique d'abord)
  app.use('/api/payment/fedapay', require('./routes/fedapayRoutes'));
  app.use('/api/payment', paymentRoutes);

  app.use('/api/quiz', quizRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/access-code', accessCodeRoutes);
  app.use('/api/auth', tokenRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/premium', require('./routes/premiumActivationRoutes'));
  app.use('/api/email-notifications', require('./routes/emailNotificationRoutes'));
app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use(handleDatabaseError);

  app.use('*', (req, res) => {
    console.log(`❌ Route non trouvée: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ success: false, message: 'Route not found', path: req.originalUrl, method: req.method });
  });

  app.use((err, req, res, next) => {
    console.error('❌ ERROR:', { message: err.message, url: req.originalUrl, method: req.method });
    res.status(500).json({ success: false, message: 'Internal server error', errorId: `ERR_${Date.now()}` });
  });

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT} - PRODUCTION MODE`);
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('📡 URL: https://quiz-de-carabin-backend.onrender.com');
    console.log('   - FedaPay Mode:', process.env.FEDAPAY_ENVIRONMENT);
    console.log('   - Email:', process.env.EMAIL_USER ? '✅' : '❌');
    console.log('   - Cron Jobs: ✅ Active');
    console.log('📋 Routes clés:');
    console.log('   - POST /api/payment/fedapay/create (protégée)');
    console.log('   - POST /api/payment/fedapay/webhooks/fedapay (PUBLIQUE)');
    console.log('   - GET /api/debug/check-my-admin (DEBUG - À SUPPRIMER)');
    console.log('================================');
  });

  process.on('SIGINT', () => {
    server.close(() => {
      mongoose.connection.close(false, () => process.exit(0));
    });
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      mongoose.connection.close(false, () => process.exit(0));
    });
  });

  process.on('uncaughtException', (error) => {
    console.error('💥 UNCAUGHT EXCEPTION:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
    process.exit(1);
  });

  // Vérification config
  const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'EMAIL_USER', 'EMAIL_PASS', 'FEDAPAY_SECRET_KEY', 'FEDAPAY_PUBLIC_KEY', 'ENCRYPTION_KEY'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error('❌ VARIABLES MANQUANTES:', missingVars);
  } else {
    console.log('✅ Toutes les variables d\'environnement requises sont configurées');
  }

  if (process.env.FEDAPAY_SECRET_KEY && process.env.FEDAPAY_ENVIRONMENT === 'live') {
    console.log('✅ FedaPay configuré en mode PRODUCTION');
  }

})
.catch(err => {
  console.error('❌ Could not connect to MongoDB - PRODUCTION', err);
  process.exit(1);
});

module.exports = mongoose;