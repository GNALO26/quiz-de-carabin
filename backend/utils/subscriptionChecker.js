const User = require('../models/User');
const cron = require('node-cron');
const transporter = require('../config/email');

// ✅ FONCTION POUR VÉRIFIER ET DÉSACTIVER LES ABONNEMENTS EXPIRÉS
const checkExpiredSubscriptions = async () => {
  try {
    console.log('🔍 [CRON] Vérification des abonnements expirés...');
    
    const now = new Date();
    
    // Trouver tous les utilisateurs avec un abonnement expiré mais toujours marqué premium
    const expiredUsers = await User.find({
      isPremium: true,
      premiumExpiresAt: { $lt: now }
    });
    
    console.log(`📊 [CRON] ${expiredUsers.length} abonnement(s) expiré(s) trouvé(s)`);
    
    for (const user of expiredUsers) {
      console.log(`⏰ [CRON] Désactivation abonnement: ${user.email}`);
      
      // Désactiver le premium
      user.isPremium = false;
      await user.save();
      
      // Envoyer un email de notification (optionnel)
      await sendExpiryNotification(user);
    }
    
    console.log('✅ [CRON] Vérification terminée');
    
  } catch (error) {
    console.error('❌ [CRON] Erreur:', error.message);
  }
};

// ✅ FONCTION POUR PRÉVENIR LES UTILISATEURS 3 JOURS AVANT EXPIRATION
const warnExpiringSubscriptions = async () => {
  try {
    console.log('📢 [CRON] Vérification des abonnements proches de l\'expiration...');
    
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const now = new Date();
    
    // Trouver les utilisateurs dont l'abonnement expire dans 3 jours
    const expiringUsers = await User.find({
      isPremium: true,
      premiumExpiresAt: {
        $gte: now,
        $lte: threeDaysFromNow
      },
      lastExpiryWarning: { $exists: false } // Ne pas envoyer 2 fois
    });
    
    console.log(`📊 [CRON] ${expiringUsers.length} abonnement(s) expirant bientôt`);
    
    for (const user of expiringUsers) {
      await sendExpiryWarning(user);
      user.lastExpiryWarning = new Date();
      await user.save();
    }
    
    console.log('✅ [CRON] Notifications envoyées');
    
  } catch (error) {
    console.error('❌ [CRON] Erreur:', error.message);
  }
};

// ✅ EMAIL D'EXPIRATION
const sendExpiryNotification = async (user) => {
  try {
    const mailOptions = {
      from: `"Quiz de Carabin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '⏰ Votre abonnement Premium a expiré',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">Votre abonnement Premium a expiré</h2>
          <p>Bonjour ${user.name},</p>
          <p>Votre abonnement premium à Quiz de Carabin est arrivé à expiration.</p>
          <p>Pour continuer à profiter de tous nos quiz premium, renouvelez dès maintenant votre abonnement !</p>
          <a href="${process.env.FRONTEND_URL}/index.html#pricing" 
             style="display: inline-block; background: #13a718; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Renouveler mon abonnement
          </a>
          <p style="color: #666; font-size: 14px;">
            L'équipe Quiz de Carabin<br>
            📧 support@quizdecarabin.bj
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL] Notification expiration envoyée à ${user.email}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Erreur envoi à ${user.email}:`, error.message);
  }
};

// ✅ EMAIL D'AVERTISSEMENT (3 jours avant)
const sendExpiryWarning = async (user) => {
  try {
    const expiryDate = new Date(user.premiumExpiresAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const mailOptions = {
      from: `"Quiz de Carabin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '⚠️ Votre abonnement Premium expire bientôt',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ffc107;">⚠️ Attention : Expiration proche</h2>
          <p>Bonjour ${user.name},</p>
          <p>Votre abonnement premium expire le <strong>${expiryDate}</strong>.</p>
          <p>N'attendez pas le dernier moment ! Renouvelez maintenant pour ne pas perdre l'accès à vos quiz premium.</p>
          <a href="${process.env.FRONTEND_URL}/index.html#pricing" 
             style="display: inline-block; background: #13a718; color: white; padding: 15px 30px; 
                    text-decoration: none; border-radius: 5px; margin: 20px 0;">
            Renouveler maintenant
          </a>
          <p style="color: #666; font-size: 14px;">
            L'équipe Quiz de Carabin<br>
            📧 support@quizdecarabin.bj
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL] Avertissement expiration envoyé à ${user.email}`);
  } catch (error) {
    console.error(`❌ [EMAIL] Erreur envoi à ${user.email}:`, error.message);
  }
};

// ✅ CONFIGURER LES TÂCHES CRON
const setupSubscriptionCrons = () => {
  console.log('⏰ [CRON] Configuration des tâches planifiées...');
  
  // Vérifier les abonnements expirés toutes les heures
  cron.schedule('0 * * * *', () => {
    console.log('🔄 [CRON] Exécution: vérification des abonnements expirés');
    checkExpiredSubscriptions();
  });
  
  console.log('✅ [CRON] Tâche de vérification des abonnements expirés configurée (toutes les heures)');
  
  // Prévenir les utilisateurs chaque jour à 9h
  cron.schedule('0 9 * * *', () => {
    console.log('🔄 [CRON] Exécution: avertissement des expirations proches');
    warnExpiringSubscriptions();
  });
  
  console.log('✅ [CRON] Tâche d\'avertissement configurée (tous les jours à 9h)');
  
  // Exécution immédiate au démarrage pour nettoyage initial
  console.log('🔄 [CRON] Exécution initiale de la vérification...');
  checkExpiredSubscriptions();
};

module.exports = {
  checkExpiredSubscriptions,
  warnExpiringSubscriptions,
  setupSubscriptionCrons
};