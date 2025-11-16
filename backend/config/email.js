const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'quizdecarabin4@gmail.com', // Votre email Gmail
    pass: process.env.EMAIL_PASS, // Le mot de passe d'application
  },
  // Options importantes pour Gmail
  tls: {
    rejectUnauthorized: false
  }
});

// Vérification améliorée
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ ERREUR CONFIGURATION EMAIL:', error.message);
    console.log('🔧 Détails de configuration:');
    console.log('   - Host: smtp.gmail.com');
    console.log('   - Port: 587');
    console.log('   - User: quizdecarabin4@gmail.com');
    console.log('   - Pass:', process.env.EMAIL_PASS ? '*' + process.env.EMAIL_PASS.slice(-4) : 'NON DEFINI');
  } else {
    console.log('✅ SMTP READY: Serveur Gmail prêt à envoyer des messages.');
    
    // Test d'envoi
    transporter.sendMail({
      from: 'quizdecarabin4@gmail.com',
      to: 'quizdecarabin4@gmail.com',
      subject: 'Test SMTP - Quiz de Carabin',
      text: 'Configuration SMTP réussie!'
    }, (err, info) => {
      if (err) {
        console.log('⚠  Test email échoué:', err.message);
      } else {
        console.log('✅ Email test envoyé avec succès');
      }
    });
  }
});

module.exports = transporter;