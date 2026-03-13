const Notification = require('../models/Notification');

/**
 * Service pour créer et gérer les notifications in-app
 */
class NotificationService {
  
  /**
   * Créer une nouvelle notification
   * @param {Object} params - Paramètres de la notification
   * @returns {Promise<Notification>}
   */
  static async create({ userId, type, title, message, icon, link, data, priority, expiresAt }) {
    try {
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        icon: icon || NotificationService.getDefaultIcon(type),
        link,
        data: data || {},
        priority: priority || 'normal',
        expiresAt
      });

      await notification.save();
      console.log(`📬 Notification créée pour user ${userId}: ${type}`);
      return notification;
    } catch (error) {
      console.error('❌ Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'icône par défaut selon le type
   */
  static getDefaultIcon(type) {
    const icons = {
      premium_activated: '✅',
      premium_expiring_soon: '⏰',
      premium_expired: '❌',
      payment_success: '💳',
      password_changed: '🔐',
      welcome: '👋',
      new_record: '🏆',
      new_quiz: '📚',
      weekly_summary: '📊',
      reengagement: '💪',
      system: '🔔',
      achievement: '🎯'
    };
    return icons[type] || '🔔';
  }

  /**
   * Notifications Premium
   */
  static async notifyPremiumActivated(userId, expiryDate) {
    const expiryStr = new Date(expiryDate).toLocaleDateString('fr-FR');
    return this.create({
      userId,
      type: 'premium_activated',
      title: '🎉 Premium activé !',
      message: `Votre accès Premium est maintenant actif jusqu'au ${expiryStr}`,
      link: '/stats.html',
      priority: 'high',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });
  }

  static async notifyPremiumExpiringSoon(userId, daysLeft, expiryDate) {
    const expiryStr = new Date(expiryDate).toLocaleDateString('fr-FR');
    return this.create({
      userId,
      type: 'premium_expiring_soon',
      title: `⏰ Premium expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
      message: `Votre accès Premium expire le ${expiryStr}. Renouvelez dès maintenant !`,
      link: '/premium.html',
      priority: daysLeft <= 3 ? 'urgent' : 'high',
      data: { daysLeft, expiryDate }
    });
  }

  static async notifyPremiumExpired(userId) {
    return this.create({
      userId,
      type: 'premium_expired',
      title: '❌ Premium expiré',
      message: 'Votre accès Premium a expiré. Renouvelez pour continuer à profiter de tous les quiz.',
      link: '/premium.html',
      priority: 'urgent',
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 jours
    });
  }

  static async notifyPaymentSuccess(userId, amount, activationCode) {
    return this.create({
      userId,
      type: 'payment_success',
      title: '💳 Paiement réussi',
      message: `Paiement de ${amount} FCFA confirmé. Code d'activation: ${activationCode}`,
      link: '/activate-premium.html',
      priority: 'high',
      data: { amount, activationCode },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    });
  }

  /**
   * Notifications Authentification
   */
  static async notifyPasswordChanged(userId) {
    return this.create({
      userId,
      type: 'password_changed',
      title: '🔐 Mot de passe modifié',
      message: 'Votre mot de passe a été changé avec succès.',
      priority: 'normal',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    });
  }

  static async notifyWelcome(userId, userName) {
    return this.create({
      userId,
      type: 'welcome',
      title: `👋 Bienvenue ${userName} !`,
      message: 'Prêt à tester vos connaissances ? Commencez votre premier quiz maintenant !',
      link: '/quiz-modern.html',
      priority: 'high',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });
  }

  /**
   * Notifications Quiz & Performance
   */
  static async notifyNewRecord(userId, quizTitle, score, previousBest) {
    return this.create({
      userId,
      type: 'new_record',
      title: '🏆 Nouveau record !',
      message: `Félicitations ! Vous avez obtenu ${score}% sur "${quizTitle}" (ancien record: ${previousBest}%)`,
      link: '/stats.html',
      priority: 'normal',
      data: { quizTitle, score, previousBest },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });
  }

  static async notifyNewQuiz(userId, subject, quizCount) {
    return this.create({
      userId,
      type: 'new_quiz',
      title: '📚 Nouveaux quiz disponibles',
      message: `${quizCount} nouveau${quizCount > 1 ? 'x' : ''} quiz ajouté${quizCount > 1 ? 's' : ''} en ${subject}`,
      link: '/quiz-modern.html',
      priority: 'normal',
      data: { subject, quizCount },
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 jours
    });
  }

  static async notifyWeeklySummary(userId, stats) {
    return this.create({
      userId,
      type: 'weekly_summary',
      title: '📊 Résumé de la semaine',
      message: `Cette semaine: ${stats.quizzesTaken} quiz, moyenne ${stats.averageScore}%`,
      link: '/stats.html',
      priority: 'normal',
      data: stats,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    });
  }

  /**
   * Notifications Système
   */
  static async notifySystem(userId, title, message, priority = 'normal') {
    return this.create({
      userId,
      type: 'system',
      title,
      message,
      priority,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });
  }

  /**
   * Envoyer une notification à plusieurs utilisateurs
   */
  static async sendToMultipleUsers(userIds, notificationData) {
    const promises = userIds.map(userId => 
      this.create({ userId, ...notificationData })
    );
    return Promise.all(promises);
  }

  /**
   * Nettoyer les notifications expirées
   */
  static async cleanExpiredNotifications() {
    try {
      const result = await Notification.cleanExpired();
      console.log(`🧹 ${result.deletedCount} notifications expirées supprimées`);
      return result;
    } catch (error) {
      console.error('❌ Erreur nettoyage notifications:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;