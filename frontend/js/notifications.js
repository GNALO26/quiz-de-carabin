/**
 * ================================================================
 * NOTIFICATION SYSTEM - FRONTEND
 * ================================================================
 */

const NotificationSystem = {
  apiUrl: 'https://quiz-de-carabin-backend.onrender.com/api/notifications',
  dropdownVisible: false,
  
  /**
   * Initialiser le système
   */
  init() {
    console.log('🔔 Initialisation système de notifications');
    
    this.setupEventListeners();
    this.loadUnreadCount();
    
    // Rafraîchir le compteur toutes les 30 secondes
    setInterval(() => this.loadUnreadCount(), 30000);
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const bell = document.getElementById('notificationBell');
    const markAllRead = document.getElementById('markAllRead');
    
    if (bell) {
      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }
    
    if (markAllRead) {
      markAllRead.addEventListener('click', () => this.markAllAsRead());
    }
    
    // Fermer le dropdown en cliquant ailleurs
    document.addEventListener('click', (e) => {
      const container = document.querySelector('.notification-bell-container');
      if (container && !container.contains(e.target)) {
        this.closeDropdown();
      }
    });
  },

  /**
   * Charger le nombre de notifications non lues
   */
  async loadUnreadCount() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${this.apiUrl}/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.updateBadge(data.count);
      }
    } catch (error) {
      console.error('Erreur chargement compteur:', error);
    }
  },

  /**
   * Mettre à jour le badge
   */
  updateBadge(count) {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  },

  /**
   * Toggle dropdown
   */
  async toggleDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;

    if (this.dropdownVisible) {
      this.closeDropdown();
    } else {
      this.openDropdown();
      await this.loadNotifications();
    }
  },

  /**
   * Ouvrir dropdown
   */
  openDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
      dropdown.style.display = 'block';
      this.dropdownVisible = true;
    }
  },

  /**
   * Fermer dropdown
   */
  closeDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
      this.dropdownVisible = false;
    }
  },

  /**
   * Charger les notifications
   */
  async loadNotifications() {
    const listContainer = document.getElementById('notificationList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="loading">Chargement...</div>';

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${this.apiUrl}?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Erreur chargement');

      const data = await response.json();
      
      if (data.notifications.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-notifications">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            <p>Aucune notification</p>
          </div>
        `;
        return;
      }

      this.renderNotifications(data.notifications);
      
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      listContainer.innerHTML = '<div class="loading">Erreur de chargement</div>';
    }
  },

  /**
   * Afficher les notifications
   */
  renderNotifications(notifications) {
    const listContainer = document.getElementById('notificationList');
    if (!listContainer) return;

    listContainer.innerHTML = notifications.map(notif => `
      <div class="notification-item ${notif.read ? '' : 'unread'} notification-priority-${notif.priority}" 
           data-id="${notif._id}"
           onclick="NotificationSystem.handleNotificationClick('${notif._id}', '${notif.link || ''}')">
        <div class="notification-icon">${notif.icon}</div>
        <div class="notification-content">
          <div class="notification-title">${notif.title}</div>
          <div class="notification-message">${notif.message}</div>
          <div class="notification-time">${this.formatTime(notif.createdAt)}</div>
        </div>
      </div>
    `).join('');
  },

  /**
   * Gérer le clic sur une notification
   */
  async handleNotificationClick(notifId, link) {
    try {
      const token = localStorage.getItem('token');
      
      // Marquer comme lu
      await fetch(`${this.apiUrl}/${notifId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Rafraîchir le compteur
      await this.loadUnreadCount();

      // Rediriger si lien
      if (link) {
        window.location.href = link;
      } else {
        // Juste fermer le dropdown
        this.closeDropdown();
      }
      
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  },

  /**
   * Marquer toutes comme lues
   */
  async markAllAsRead() {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${this.apiUrl}/read-all`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await this.loadNotifications();
        await this.loadUnreadCount();
      }
      
    } catch (error) {
      console.error('Erreur marquage tout lu:', error);
    }
  },

  /**
   * Formater le temps relatif
   */
  formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'À l\'instant';
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
    if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)} j`;
    
    return date.toLocaleDateString('fr-FR');
  }
};

// Auto-init si sur une page connectée
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    NotificationSystem.init();
  }
});