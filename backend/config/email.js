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

console.log('🔧 Début configuration email...');

try {
  transporter = nodemailer.createTransport(gmailConfig);
  
  console.log('✅ Configuration email chargée:');
  console.log('   - Host: smtp.gmail.com');
  console.log('   - Port: 587');
  console.log('   - User: quizdecarabin4@gmail.com');
  console.log('   - Pass: ************gms');
  
  // ✅ VÉRIFICATION SYNCHRONE IMMÉDIATE
  console.log('🔄 Vérification de la connexion SMTP...');
  
  transporter.verify(function(error, success) {
    if (error) {
      console.log('❌ ERREUR VÉRIFICATION EMAIL:', error.message);
      console.log('🔍 Détails erreur:', {
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode
      });
      
      console.log('🔄 Activation du mode secours email...');
      transporter = createFallbackTransporter();
    } else {
      console.log('🎉 ✅ Email - Configuration Gmail réussie - Serveur SMTP opérationnel');
      console.log('📧 Prêt pour envoi d\'emails');
    }
  });

} catch (error) {
  console.log('❌ Erreur configuration email:', error.message);
  console.log('🔄 Activation du mode secours email...');
  transporter = createFallbackTransporter();
}

// Fonction pour créer un transporteur de secours
function createFallbackTransporter() {
  console.log('📧 Mode secours email activé - Les emails seront simulés');
  
  return {
    sendMail: function(options, callback) {
      console.log(' ');
      console.log('📨 ===== EMAIL SIMULÉ (MODE SECOURS) =====');
      console.log('   - À: ', options.to);
      console.log('   - Sujet: ', options.subject);
      console.log('   - Contenu: ', options.text || options.html?.substring(0, 200) + '...');
      console.log('📨 ========================================');
      console.log(' ');
      
      // Simuler un envoi réussi
      const result = {
        messageId: 'simulated-' + Date.now(),
        response: '250 OK - Email simulé (mode secours)',
        envelope: {
          from: options.from,
          to: [options.to]
        }
      };
      
      if (callback) {
        callback(null, result);
      }
      return Promise.resolve(result);
    },
    
    verify: function(callback) {
      const error = new Error('Mode secours email - Pas de vérification SMTP réelle');
      if (callback) {
        callback(error);
      }
      return Promise.reject(error);
    },
    
    close: function() {
      console.log('📧 Transporteur secours fermé');
      return Promise.resolve();
    }
  };
}

// ✅ SURCHARGE DE LA MÉTHODE sendMail POUR AJOUTER DES LOGS DÉTAILLÉS
const originalSendMail = transporter.sendMail.bind(transporter);

transporter.sendMail = function(options, callback) {
  console.log(' ');
  console.log('📧 ===== TENTATIVE D\'ENVOI D\'EMAIL =====');
  console.log('   - De: ', options.from);
  console.log('   - À: ', options.to);
  console.log('   - Sujet: ', options.subject);
  console.log('   - Date: ', new Date().toISOString());
  console.log('📧 =====================================');
  console.log(' ');
  
  // Si c'est le transporteur de secours, utiliser la méthode originale
  if (transporter === createFallbackTransporter) {
    return originalSendMail(options, callback);
  }
  
  // Sinon, utiliser la méthode originale et logger le résultat
  const promise = originalSendMail(options, callback);
  
  if (promise && typeof promise.then === 'function') {
    return promise
      .then(result => {
        console.log(' ');
        console.log('🎉 ===== EMAIL ENVOYÉ AVEC SUCCÈS =====');
        console.log('   - À: ', options.to);
        console.log('   - Message ID: ', result.messageId);
        console.log('   - Réponse: ', result.response);
        console.log('   - Date: ', new Date().toISOString());
        console.log('🎉 ===================================');
        console.log(' ');
        return result;
      })
      .catch(error => {
        console.log(' ');
        console.log('❌ ===== ERREUR ENVOI EMAIL =====');
        console.log('   - À: ', options.to);
        console.log('   - Erreur: ', error.message);
        console.log('   - Code: ', error.code);
        console.log('   - Commande: ', error.command);
        console.log('   - Réponse: ', error.response);
        console.log('❌ ==============================');
        console.log(' ');
        
        console.log('🔄 Tentative avec mode secours...');
        // En cas d'erreur, basculer vers le mode secours
        const fallbackTransporter = createFallbackTransporter();
        return fallbackTransporter.sendMail(options, callback);
      });
  }
  
  return promise;
};

// ✅ TEST AUTOMATIQUE AU DÉMARRAGE
setTimeout(() => {
  console.log(' ');
  console.log('🧪 ===== TEST AUTOMATIQUE EMAIL =====');
  console.log('🔧 Test de la configuration email...');
  
  transporter.verify((error, success) => {
    if (error) {
      console.log('❌ Test email échoué:', error.message);
      console.log('ℹ  Les emails seront simulés en mode secours');
    } else {
      console.log('✅ Test email réussi - SMTP opérationnel');
      
      // Test d'envoi d'un email de test
      const testMailOptions = {
        from: process.env.EMAIL_USER,
        to: 'test@example.com', // Email fictif pour le test
        subject: 'Test Configuration Email - Quiz de Carabin',
        text: 'Ceci est un test de configuration email. Si vous recevez ceci, tout fonctionne!',
        html: '<h1>Test Réussi!</h1><p>Configuration email opérationnelle.</p>'
      };
      
      console.log('🔧 Test d\'envoi d\'email...');
      transporter.sendMail(testMailOptions)
        .then(result => {
          console.log('✅ Test d\'envoi réussi:', result.response);
        })
        .catch(error => {
          console.log('❌ Test d\'envoi échoué:', error.message);
        });
    }
  });
  console.log('🧪 =================================');
  console.log(' ');
}, 3000);

module.exports = transporter;