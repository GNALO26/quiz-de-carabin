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

// Vérification de la configuration email au démarrage (avec logs clairs)
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ FATAL SMTP ERROR: Erreur de configuration/connexion email:', error.message);
    // Afficher l'objet d'erreur complet pour le diagnostic
    console.error(error); 
  } else {
    console.log('✅ SMTP READY: Serveur email prêt à envoyer des messages.');
    
    // Tentative d'envoi de test pour être sûr que l'authentification passe
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'SMTP Test - Quiz de Carabin',
      text: 'Ceci est un email de test pour confirmer le passage de l\'authentification.'
    }, (err, info) => {
      if (err) {
        // Cette erreur est la même que celle qui empêche le code d'accès de partir
        console.error('❌ SMTP SEND FAILED: Échec de l\'envoi de l\'email de test (probablement l\'authentification):', err.message);
      } else {
        console.log('✅ SMTP TEST SUCCESS: Email test envoyé. Réponse:', info.response);
      }
    });
  }
});

module.exports = transporter;