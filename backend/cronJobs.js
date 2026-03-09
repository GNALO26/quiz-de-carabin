/**
 * ================================================================
 * CRON JOBS - QUIZ DE CARABIN
 * ================================================================
 * Tâches automatiques planifiées
 * ================================================================
 */

const cron = require('node-cron');
const notificationService = require('../services/notificationService');
const User = require('../models/User');

/**
 * ================================================================
 * TÂCHE 1 : DIGEST HEBDOMADAIRE
 * Tous les dimanches à 18h00
 * ================================================================
 */
const weeklyDigestJob = cron.schedule('0 18 * * 0', async () => {
  console.log('🕐 Exécution: Digest hebdomadaire...');
  
  try {
    const result = await notificationService.sendWeeklyDigest();
    console.log(`✅ Digest envoyé: ${result.sent} emails`);
  } catch (error) {
    console.error('❌ Erreur digest hebdomadaire:', error);
  }
}, {
  scheduled: false,
  timezone: "Africa/Porto-Novo" // Timezone du Bénin
});

/**
 * ================================================================
 * TÂCHE 2 : RAPPEL EXPIRATION PREMIUM
 * Tous les jours à 10h00
 * ================================================================
 */
const premiumExpiringJob = cron.schedule('0 10 * * *', async () => {
  console.log('🕐 Exécution: Rappel expiration Premium...');
  
  try {
    const result = await notificationService.notifyPremiumExpiring();
    console.log(`✅ Rappels envoyés: ${result.sent} emails`);
  } catch (error) {
    console.error('❌ Erreur rappel expiration:', error);
  }
}, {
  scheduled: false,
  timezone: "Africa/Porto-Novo"
});

/**
 * ================================================================
 * TÂCHE 3 : DÉSACTIVER PREMIUM EXPIRÉS
 * Tous les jours à 00h00
 * ================================================================
 */
const deactivateExpiredPremiumJob = cron.schedule('0 0 * * *', async () => {
  console.log('🕐 Exécution: Désactivation Premium expirés...');
  
  try {
    const count = await User.deactivateExpiredPremium();
    console.log(`✅ ${count} compte(s) Premium désactivé(s)`);
  } catch (error) {
    console.error('❌ Erreur désactivation Premium:', error);
  }
}, {
  scheduled: false,
  timezone: "Africa/Porto-Novo"
});

/**
 * ================================================================
 * TÂCHE 4 : NETTOYAGE CODES RESET EXPIRÉS
 * Tous les jours à 02h00
 * ================================================================
 */
const cleanExpiredResetCodesJob = cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Exécution: Nettoyage codes reset expirés...');
  
  try {
    const PasswordReset = require('../models/PasswordReset');
    await PasswordReset.cleanExpired();
    console.log('✅ Codes expirés nettoyés');
  } catch (error) {
    console.error('❌ Erreur nettoyage codes:', error);
  }
}, {
  scheduled: false,
  timezone: "Africa/Porto-Novo"
});

/**
 * ================================================================
 * TÂCHE 5 : CALCUL STATISTIQUES GLOBALES
 * Tous les jours à 03h00
 * ================================================================
 */
const calculateGlobalStatsJob = cron.schedule('0 3 * * *', async () => {
  console.log('🕐 Exécution: Calcul stats globales...');
  
  try {
    // Calculer stats globales (à personnaliser)
    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ isPremium: true });
    
    console.log(`📊 Stats: ${totalUsers} users, ${premiumUsers} Premium`);
  } catch (error) {
    console.error('❌ Erreur calcul stats:', error);
  }
}, {
  scheduled: false,
  timezone: "Africa/Porto-Novo"
});

/**
 * ================================================================
 * DÉMARRER TOUTES LES TÂCHES
 * ================================================================
 */
const startAllJobs = () => {
  console.log('🚀 Démarrage des tâches automatiques...\n');
  
  weeklyDigestJob.start();
  console.log('✅ Digest hebdomadaire: Dimanches à 18h00');
  
  premiumExpiringJob.start();
  console.log('✅ Rappel Premium: Tous les jours à 10h00');
  
  deactivateExpiredPremiumJob.start();
  console.log('✅ Désactivation Premium: Tous les jours à 00h00');
  
  cleanExpiredResetCodesJob.start();
  console.log('✅ Nettoyage codes: Tous les jours à 02h00');
  
  calculateGlobalStatsJob.start();
  console.log('✅ Calcul stats: Tous les jours à 03h00');
  
  console.log('\n✅ Toutes les tâches automatiques sont actives\n');
};

/**
 * ================================================================
 * ARRÊTER TOUTES LES TÂCHES
 * ================================================================
 */
const stopAllJobs = () => {
  weeklyDigestJob.stop();
  premiumExpiringJob.stop();
  deactivateExpiredPremiumJob.stop();
  cleanExpiredResetCodesJob.stop();
  calculateGlobalStatsJob.stop();
  
  console.log('⏹️  Toutes les tâches automatiques arrêtées');
};

/**
 * ================================================================
 * EXÉCUTION MANUELLE (pour tests)
 * ================================================================
 */
const runManually = {
  weeklyDigest: async () => {
    console.log('🧪 Test: Digest hebdomadaire...');
    return await notificationService.sendWeeklyDigest();
  },
  
  premiumExpiring: async () => {
    console.log('🧪 Test: Rappel expiration Premium...');
    return await notificationService.notifyPremiumExpiring();
  },
  
  deactivateExpired: async () => {
    console.log('🧪 Test: Désactivation Premium expirés...');
    return await User.deactivateExpiredPremium();
  }
};

module.exports = {
  startAllJobs,
  stopAllJobs,
  runManually
};