const nodemailer = require('nodemailer');

// Configuration plus robuste avec gestion d'erreurs
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT == 465, // true pour 465, false pour les autres
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000, // 10 secondes
    greetingTimeout: 5000,    // 5 secondes
    socketTimeout: 15000,     // 15 secondes
    pool: true,               // Utiliser le pooling pour de meilleures performances
    maxConnections: 5,
    maxMessages: 100
  });
};

const transporter = createTransporter();

// Test de connexion au démarrage
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Erreur configuration email:', error);
    
    // Tentative de reconnexion après 30 secondes en cas d'échec
    setTimeout(() => {
      console.log('🔄 Tentative de reconnexion au serveur email...');
      transporter.verify();
    }, 30000);
  } else {
    console.log('✅ Serveur email est prêt à envoyer des messages');
  }
});

// Gestionnaire d'erreurs pour les événements de transport
transporter.on('error', (error) => {
  console.error('❌ Erreur de transport email:', error);
  if (error.code === 'ECONNECTION') {
    console.log('🔄 Tentative de reconnexion...');
  }
});

module.exports = transporter;