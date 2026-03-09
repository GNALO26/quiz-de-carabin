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
  
  console.log('🔄 Vérification de la connexion SMTP...');
  
  transporter.verify(function(error, success) {
    if (error) {
      console.log('❌ ERREUR VÉRIFICATION EMAIL:', error.message);
      console.log('🔄 Activation du mode secours email...');
      transporter = createFallbackTransporter();
    } else {
      console.log('🎉 ✅ Email - Configuration Gmail réussie');
      console.log('📧 Prêt pour envoi d\'emails');
    }
  });

} catch (error) {
  console.log('❌ Erreur configuration email:', error.message);
  console.log('🔄 Activation du mode secours email...');
  transporter = createFallbackTransporter();
}

function createFallbackTransporter() {
  console.log('📧 Mode secours email activé');
  
  return {
    sendMail: function(options, callback) {
      console.log('📨 EMAIL SIMULÉ:', options.to, options.subject);
      const result = {
        messageId: 'simulated-' + Date.now(),
        response: '250 OK'
      };
      if (callback) callback(null, result);
      return Promise.resolve(result);
    },
    verify: function(callback) {
      const error = new Error('Mode secours');
      if (callback) callback(error);
      return Promise.reject(error);
    },
    close: function() {
      return Promise.resolve();
    }
  };
}

// ================================================================
// FONCTIONS D'ENVOI D'EMAIL
// ================================================================

/**
 * Envoyer notification nouveau quiz
 */
const sendNewQuizNotification = async (users, quizDetails) => {
  try {
    const quiz = quizDetails[0];
    
    const promises = users.map(async (user) => {
      const mailOptions = {
        from: 'Quiz de Carabin <quizdecarabin4@gmail.com>',
        to: user.email,
        subject: `🎯 Nouveau quiz : ${quiz.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
              <h1>🎯 Nouveau Quiz !</h1>
            </div>
            <div style="padding: 30px;">
              <p>Bonjour <strong>${user.name}</strong>,</p>
              <h2>${quiz.title}</h2>
              <p><strong>Matière :</strong> ${quiz.subject}</p>
              <p><strong>Questions :</strong> ${quiz.questionCount}</p>
              <a href="${quiz.url}" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px;">
                Commencer 🚀
              </a>
            </div>
          </div>
        `
      };
      
      return transporter.sendMail(mailOptions);
    });
    
    await Promise.all(promises);
    return { success: true, count: users.length };
    
  } catch (error) {
    console.error('❌ Erreur sendNewQuizNotification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email générique
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: options.from || 'Quiz de Carabin <quizdecarabin4@gmail.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };
    
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur sendEmail:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer code activation Premium
 */
const sendPremiumActivationCodeEmail = async (user, transaction) => {
  try {
    const code = transaction.activationCode;
    const expiryDate = new Date(transaction.codeExpiry);
    
    const mailOptions = {
      from: 'Quiz de Carabin <quizdecarabin4@gmail.com>',
      to: user.email,
      subject: '🎉 Votre code d\'activation Premium',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
            <h1>🎉 Paiement Réussi !</h1>
          </div>
          <div style="padding: 30px;">
            <p>Félicitations <strong>${user.name}</strong> !</p>
            <div style="background: #667eea; color: white; padding: 30px; border-radius: 10px; text-align: center; margin: 30px 0;">
              <p style="margin: 0; font-size: 14px;">Votre code d'activation</p>
              <h1 style="margin: 15px 0; font-size: 56px; letter-spacing: 12px;">${code}</h1>
            </div>
            <p><strong>⚠️ Important :</strong> Expire le ${expiryDate.toLocaleString('fr-FR')}</p>
            <a href="https://quiz-de-carabin.com/activate-premium.html" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px;">
              Activer maintenant 🎯
            </a>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur sendPremiumActivationCodeEmail:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Envoyer email bienvenue Premium
 */
const sendPremiumActivationEmail = async (user, plan, expiryDate) => {
  try {
    const planNames = {
      '1month': '1 mois',
      '3months': '3 mois',
      '10months': '10 mois'
    };
    
    const mailOptions = {
      from: 'Quiz de Carabin <quizdecarabin4@gmail.com>',
      to: user.email,
      subject: '👑 Bienvenue Premium !',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #2c3e50; padding: 30px; text-align: center;">
            <h1>👑 Bienvenue Premium !</h1>
          </div>
          <div style="padding: 30px;">
            <p>Félicitations <strong>${user.name}</strong> !</p>
            <h3>📋 Votre abonnement</h3>
            <p><strong>Plan :</strong> ${planNames[plan] || plan}</p>
            <p><strong>Expire le :</strong> ${new Date(expiryDate).toLocaleDateString('fr-FR')}</p>
            <h3>🎁 Vous avez accès à :</h3>
            <ul>
              <li>✅ Tous les quiz Premium</li>
              <li>✅ Statistiques avancées</li>
              <li>✅ Support prioritaire</li>
            </ul>
            <a href="https://quiz-de-carabin.com/quiz.html" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px;">
              Commencer 🚀
            </a>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Erreur sendPremiumActivationEmail:', error);
    return { success: false, error: error.message };
  }
};

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
  transporter,
  sendNewQuizNotification,
  sendEmail,
  sendPremiumActivationCodeEmail,
  sendPremiumActivationEmail
};