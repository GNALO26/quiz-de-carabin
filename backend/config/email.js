const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Vérification de la configuration email au démarrage
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Erreur configuration email:', error);
  } else {
    console.log('✅ Serveur email prêt à envoyer des messages');
  }
});

module.exports = transporter;