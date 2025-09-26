const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // Doit rester 'false' pour le port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Vérification de la configuration email au démarrage
transporter.verify(function(error, success) {
  if (error) {
    // 🛑 Log le plus important pour le diagnostic SMTP
    console.error('❌ FATAL SMTP ERROR: Erreur de configuration/connexion email:', error.message);
    console.error(error); 
  } else {
    console.log('✅ SMTP READY: Serveur email prêt à envoyer des messages.');
  }
});

module.exports = transporter;