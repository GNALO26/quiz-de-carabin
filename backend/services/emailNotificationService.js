/**
 * ================================================================
 * NOTIFICATION SERVICE - QUIZ DE CARABIN
 * ================================================================
 * Service pour gérer l'envoi de notifications email
 * ================================================================
 */

const emailService = require('./emailService');
const Notification = require('../models/EmailNotification');
const User = require('../models/User');
const Quiz = require('../models/Quiz');

/**
 * ================================================================
 * NOTIFICATION NOUVEAU QUIZ
 * ================================================================
 */
const notifyNewQuiz = async (quiz) => {
  try {
    console.log(`📧 Notification nouveau quiz: ${quiz.title}`);

    // Récupérer tous les users qui acceptent les notifications
    const users = await User.find({
      'preferences.newQuizNotifications': true,
      isActive: true
    }).select('_id name email preferences');

    if (users.length === 0) {
      console.log('⚠️ Aucun utilisateur à notifier');
      return { success: true, count: 0 };
    }

    console.log(`👥 ${users.length} utilisateur(s) à notifier`);

    // Créer la notification en DB
    const notification = await Notification.createNewQuizNotification(
      quiz,
      users.map(u => u._id)
    );

    // Préparer les détails du quiz pour l'email
    const quizDetails = {
      title: quiz.title,
      subject: quiz.subject,
      category: quiz.category || 'Général',
      difficulty: quiz.difficulty || 'Moyen',
      questionCount: quiz.questions?.length || 0,
      url: `${process.env.SITE_URL}/quiz/${quiz._id}`
    };

    // Envoyer les emails
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        const emailResult = await emailService.sendNewQuizNotification(
          [user],
          [quizDetails]
        );

        if (emailResult.success) {
          await notification.markAsSent(user._id);
          sent++;
          console.log(`✅ Email envoyé à: ${user.email}`);
        } else {
          await notification.markAsSent(user._id, emailResult.error);
          failed++;
          console.error(`❌ Erreur email pour ${user.email}:`, emailResult.error);
        }
      } catch (error) {
        await notification.markAsSent(user._id, error.message);
        failed++;
        console.error(`❌ Erreur email pour ${user.email}:`, error);
      }

      // Petit délai pour éviter le spam
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Notification terminée: ${sent} envoyés, ${failed} échoués`);

    return {
      success: true,
      notificationId: notification._id,
      sent: sent,
      failed: failed,
      total: users.length
    };

  } catch (error) {
    console.error('❌ Erreur notifyNewQuiz:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * ================================================================
 * DIGEST HEBDOMADAIRE
 * ================================================================
 */
const sendWeeklyDigest = async () => {
  try {
    console.log('📧 Envoi digest hebdomadaire...');

    // Users qui acceptent les notifications
    const users = await User.find({
      'preferences.emailNotifications': true,
      isActive: true,
      'stats.lastActivityDate': { 
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Actif dans les 30 derniers jours
      }
    });

    console.log(`👥 ${users.length} utilisateur(s) actifs`);

    // Récupérer les nouveaux quiz de la semaine
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const newQuizzes = await Quiz.find({
      createdAt: { $gte: oneWeekAgo }
    }).select('title subject category createdAt').limit(10);

    if (newQuizzes.length === 0) {
      console.log('⚠️ Aucun nouveau quiz cette semaine');
      return { success: true, count: 0 };
    }

    let sent = 0;

    for (const user of users) {
      try {
        const digestData = {
          userName: user.name,
          weeklyStats: {
            quizzes: user.stats.totalQuizzes,
            score: user.stats.averageScore,
            streak: user.stats.streak,
            level: user.level
          },
          newQuizzes: newQuizzes.map(q => ({
            title: q.title,
            subject: q.subject,
            category: q.category
          })),
          siteUrl: process.env.SITE_URL
        };

        const result = await sendWeeklyDigestEmail(user.email, digestData);

        if (result.success) {
          sent++;
          console.log(`✅ Digest envoyé à: ${user.email}`);
        }

      } catch (error) {
        console.error(`❌ Erreur digest pour ${user.email}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Digest hebdomadaire: ${sent} envoyés`);

    return { success: true, sent: sent };

  } catch (error) {
    console.error('❌ Erreur sendWeeklyDigest:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ================================================================
 * RAPPEL EXPIRATION PREMIUM
 * ================================================================
 */
const notifyPremiumExpiring = async () => {
  try {
    console.log('📧 Rappel expiration Premium...');

    // Users Premium qui expirent dans 7 jours
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    const users = await User.find({
      isPremium: true,
      premiumUntil: {
        $gte: oneDayFromNow,
        $lte: sevenDaysFromNow
      }
    });

    console.log(`👥 ${users.length} utilisateur(s) Premium expirant bientôt`);

    let sent = 0;

    for (const user of users) {
      try {
        const daysLeft = Math.ceil(
          (user.premiumUntil - new Date()) / (1000 * 60 * 60 * 24)
        );

        const result = await sendPremiumExpiringEmail(user, daysLeft);

        if (result.success) {
          sent++;
          console.log(`✅ Rappel envoyé à: ${user.email}`);
        }

      } catch (error) {
        console.error(`❌ Erreur rappel pour ${user.email}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Rappels expiration: ${sent} envoyés`);

    return { success: true, sent: sent };

  } catch (error) {
    console.error('❌ Erreur notifyPremiumExpiring:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ================================================================
 * HELPER: Email digest hebdomadaire
 * ================================================================
 */
const sendWeeklyDigestEmail = async (email, data) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 2rem; font-weight: bold; color: #667eea; }
        .quiz-list { margin: 20px 0; }
        .quiz-item { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; border-radius: 5px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Résumé de votre semaine</h1>
          <p>Bonjour ${data.userName} !</p>
        </div>
        <div class="content">
          <h2>Vos statistiques cette semaine</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${data.weeklyStats.quizzes}</div>
              <div>Quiz complétés</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.weeklyStats.score}%</div>
              <div>Score moyen</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.weeklyStats.streak}</div>
              <div>Jours de suite</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${data.weeklyStats.level}</div>
              <div>Niveau</div>
            </div>
          </div>

          <h2>🎯 Nouveaux quiz cette semaine (${data.newQuizzes.length})</h2>
          <div class="quiz-list">
            ${data.newQuizzes.map(quiz => `
              <div class="quiz-item">
                <strong>${quiz.title}</strong><br>
                <small>${quiz.subject} • ${quiz.category}</small>
              </div>
            `).join('')}
          </div>

          <p style="text-align: center;">
            <a href="${data.siteUrl}" class="button">Continuer à apprendre</a>
          </p>

          <p style="color: #999; font-size: 12px; text-align: center;">
            Vous recevez cet email car vous êtes inscrit sur Quiz de Carabin.<br>
            <a href="${data.siteUrl}/preferences">Gérer mes préférences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await emailService.sendEmail({
    to: email,
    subject: '📊 Votre résumé hebdomadaire - Quiz de Carabin',
    html: html
  });
};

/**
 * ================================================================
 * HELPER: Email expiration Premium
 * ================================================================
 */
const sendPremiumExpiringEmail = async (user, daysLeft) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ffd700, #ffed4e); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px 35px; text-decoration: none; border-radius: 25px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👑 Votre abonnement Premium</h1>
        </div>
        <div class="content">
          <p>Bonjour <strong>${user.name}</strong>,</p>
          
          <div class="warning">
            <strong>⚠️ Votre abonnement Premium expire dans ${daysLeft} jour(s)</strong><br>
            Date d'expiration : ${user.premiumUntil.toLocaleDateString('fr-FR')}
          </div>

          <p>Ne perdez pas l'accès à :</p>
          <ul>
            <li>✅ Quiz illimités</li>
            <li>✅ Statistiques avancées</li>
            <li>✅ Graphiques de progression</li>
            <li>✅ Support prioritaire</li>
          </ul>

          <p style="text-align: center;">
            <a href="${process.env.SITE_URL}/premium" class="button">
              Renouveler mon abonnement
            </a>
          </p>

          <p>Merci de votre confiance !<br>L'équipe Quiz de Carabin</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await emailService.sendEmail({
    to: user.email,
    subject: `⚠️ Votre Premium expire dans ${daysLeft} jour(s)`,
    html: html
  });
};

module.exports = {
  notifyNewQuiz,
  sendWeeklyDigest,
  notifyPremiumExpiring
};