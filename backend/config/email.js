const nodemailer = require('nodemailer');

// Configuration Gmail avec mot de passe d'application
const gmailConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'quizdecarabin4@gmail.com',
    pass: 'ikusslgqydqiygms' // Mot de passe d'application direct
  },
  tls: {
    rejectUnauthorized: false
  }
};

let transporter;

try {
  transporter = nodemailer.createTransport(gmailConfig);
  
  console.log('🔧 Configuration email chargée:');
  console.log('   - Host: smtp.gmail.com');
  console.log('   - Port: 587');
  console.log('   - User: quizdecarabin4@gmail.com');
  console.log('   - Pass: ************gms');
  
  // ✅ CORRECTION: Vérification synchrone pour confirmer que ça fonctionne
  transporter.verify(function(error, success) {
    if (error) {
      console.log('⚠  Email - Vérification échouée:', error.message);
      console.log('🔧 Détails configuration:', {
        host: gmailConfig.host,
        port: gmailConfig.port,
        user: gmailConfig.auth.user
      });
    } else {
      console.log('✅ Email - Configuration Gmail réussie - Prêt pour envoi');
    }
  });

} catch (error) {
  console.log('❌ Erreur configuration email, mode secours activé');
  transporter = createFallbackTransporter();
}

// Fonction pour créer un transporteur de secours
function createFallbackTransporter() {
  console.log('📧 Mode secours email activé - Les emails seront simulés');
  
  return {
    sendMail: function(options, callback) {
      console.log('📨 Email simulé:');
      console.log('   - À: ', options.to);
      console.log('   - Sujet: ', options.subject);
      console.log('   - Contenu: ', options.text || options.html?.substring(0, 100) + '...');
      
      // Simuler un envoi réussi
      const result = {
        messageId: 'simulated-' + Date.now(),
        response: '250 OK - Email simulé'
      };
      
      if (callback) {
        callback(null, result);
      }
      return Promise.resolve(result);
    },
    
    verify: function(callback) {
      if (callback) {
        callback(new Error('Mode secours email'));
      }
      return Promise.reject(new Error('Mode secours email'));
    }
  };
}

module.exports = transporter;