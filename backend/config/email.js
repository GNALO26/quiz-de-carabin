require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Configuration email chargée...');

// Configuration avec plusieurs options pour Gmail
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Options supplémentaires pour améliorer la fiabilité
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// Vérification de la connexion
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Erreur configuration email:', error);
  } else {
    console.log('✅ Serveur SMTP configuré correctement');
    console.log('Hôte:', transporter.options.host);
    console.log('Utilisateur:', transporter.options.auth.user);
  }
});

// Logger pour le débogage
transporter.on('log', data => {
  if (data.type === 'SRV') console.log('SERVER:', data.message);
  if (data.type === 'RAW') console.log('RAW:', data.message);
});

module.exports = transporter;