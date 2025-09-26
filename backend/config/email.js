const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST, // Probablement smtp.gmail.com
  port: process.env.EMAIL_PORT || 465, // Utilisation du port 465 par défaut
  secure: true, // 🛑 CHANGEMENT: Utiliser TLS implicite pour le port 465
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Augmenter le timeout pour donner plus de chance à la connexion (Optionnel)
  // timeout: 30000, 
  // connectionTimeout: 30000,
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