require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('=== TEST CONFIGURATION EMAIL ===');

// Vérification des variables d'environnement
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'Non défini');

// Test de connexion SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify(function(error, success) {
  if (error) {
    console.log('❌ Erreur de configuration email:', error);
  } else {
    console.log('✅ Serveur SMTP configuré correctement');
    
    // Test d'envoi d'email
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'alfredsossa17@gmail.com',
      subject: 'Test de configuration - Quiz de Carabin',
      text: 'Ceci est un test de configuration email.',
      html: '<p>Ceci est un test de configuration email.</p>'
    }, (err, info) => {
      if (err) {
        console.log('❌ Erreur d\'envoi:', err);
      } else {
        console.log('✅ Email de test envoyé avec succès');
        console.log('Message ID:', info.messageId);
      }
    });
  }
});