import { CONFIG } from './config.js';

export class Auth {
    constructor() {
        this.token = localStorage.getItem('quizToken');
        this.user = JSON.parse(localStorage.getItem('quizUser') || 'null');
        this.init();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login
        document.getElementById('login-btn')?.addEventListener('click', () => this.login());
        
        // Register
        document.getElementById('register-btn')?.addEventListener('click', () => this.register());
        
        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        
        // Gestion simplifiée du dropdown utilisateur
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            userDropdown.addEventListener('click', (e) => {
                e.preventDefault();
                const dropdownMenu = userDropdown.nextElementSibling;
                dropdownMenu.classList.toggle('show');
            });
        }
        
        // Fermer le dropdown en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
    }

// Méthode pour nettoyer les tokens invalides
cleanInvalidToken() {
  localStorage.removeItem('quizToken');
  localStorage.removeItem('quizUser');
  this.token = null;
  this.user = null;
  this.updateUI();
}

// Modifiez la méthode getToken
getToken() {
  let token = localStorage.getItem('quizToken');
  if (!token) {
    return null;
  }
  
  token = token.replace(/^"(.*)"$/, '$1').trim();
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('Token JWT invalide: structure incorrecte');
      this.cleanInvalidToken();
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < currentTime) {
      console.warn('Token expiré');
      this.cleanInvalidToken();
      return null;
    }
    return token;
  } catch (error) {
    console.error('Token validation error:', error);
    this.cleanInvalidToken();
    return null;
  }
}

// Ajoutez cette méthode à la classe
cleanCorruptedTokens() {
  const token = localStorage.getItem('quizToken');
  if (token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        localStorage.removeItem('quizToken');
        localStorage.removeItem('quizUser');
        console.log('Token corrompu nettoyé');
      }
    } catch (error) {
      localStorage.removeItem('quizToken');
      localStorage.removeItem('quizUser');
      console.log('Token corrompu nettoyé');
    }
  }
}
    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            this.showAlert('Veuillez remplir tous les champs', 'danger');
            return;
        }

        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('quizToken', data.token);
                localStorage.setItem('quizUser', JSON.stringify(data.user));
                
                this.updateUI();
                this.hideModals();
                this.showAlert('Connexion réussie!', 'success');
                
                // Recharger les quiz si on est sur la page quiz.html
                if (window.location.pathname.includes('quiz.html') && window.quiz && typeof window.quiz.loadQuizzes === 'function') {
                    window.quiz.loadQuizzes();
                }
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('Erreur de connexion. Veuillez réessayer.', 'danger');
        }
    }

    async register() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (!name || !email || !password || !confirmPassword) {
            this.showAlert('Veuillez remplir tous les champs', 'danger');
            return;
        }

        if (password !== confirmPassword) {
            this.showAlert('Les mots de passe ne correspondent pas', 'danger');
            return;
        }

        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (data.success) {
                // Connexion automatique après inscription
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('quizToken', data.token);
                localStorage.setItem('quizUser', JSON.stringify(data.user));
                
                this.updateUI();
                this.hideModals();
                this.showAlert('Compte créé avec succès! Vous êtes maintenant connecté.', 'success');
                
                // Recharger les quiz si on est sur la page quiz.html
                if (window.location.pathname.includes('quiz.html') && window.quiz && typeof window.quiz.loadQuizzes === 'function') {
                    window.quiz.loadQuizzes();
                }
            } else {
                this.showAlert(data.message || 'Erreur lors de la création du compte', 'danger');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showAlert('Erreur lors de la création du compte. Veuillez réessayer.', 'danger');
        }
    }

    // Mot de passe oublié
    async forgotPassword(email) {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erreur demande de réinitialisation:', error);
            return {
                success: false,
                message: 'Erreur de connexion. Veuillez réessayer.',
            };
        }
    }

    // Vérification du code de réinitialisation
    async verifyResetCode(email, code) {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/auth/verify-reset-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, code }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erreur vérification du code:', error);
            return {
                success: false,
                message: 'Erreur de connexion. Veuillez réessayer.',
            };
        }
    }

    // Réinitialisation du mot de passe
    async resetPassword(email, code, newPassword) {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, code, newPassword }),
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Erreur réinitialisation mot de passe:', error);
            return {
                success: false,
                message: 'Erreur de connexion. Veuillez réessayer.',
            };
        }
    }

    async getActiveAPIUrl() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                return CONFIG.API_BASE_URL;
            }
        } catch (error) {
            console.warn('URL principale inaccessible, tentative avec URL de secours:', error);
        }
        
        return CONFIG.API_BACKUP_URL;
    }

    logout() {
        try {
            localStorage.removeItem('quizToken');
            localStorage.removeItem('quizUser');
            localStorage.removeItem('userIsPremium');
            localStorage.removeItem('premiumExpiresAt');
            
            this.token = null;
            this.user = null;
            
            this.updateUI();
            this.showAlert('Déconnexion réussie', 'success');
            
            // Recharger les quiz si on est sur la page quiz.html
            if (window.location.pathname.includes('quiz.html') && window.quiz && typeof window.quiz.loadQuizzes === 'function') {
                window.quiz.loadQuizzes();
            }
            
            // Redirection vers l'accueil après déconnexion
            setTimeout(() => {
                window.location.href = CONFIG.PAGES.INDEX;
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showAlert('Erreur lors de la déconnexion', 'danger');
        }
    }

    updateUI() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const userName = document.getElementById('user-name');
        const premiumBadge = document.getElementById('premium-badge');

        if (!authButtons || !userMenu) {
            console.warn('Éléments UI non trouvés');
            return;
        }

        const token = this.getToken();
        const user = this.user;

        if (token && user) {
            authButtons.style.display = 'none';
            userMenu.style.display = 'block';
            if (userName) userName.textContent = user.name;
            
            if (premiumBadge) {
                if (user.isPremium) {
                    premiumBadge.style.display = 'inline';
                    premiumBadge.textContent = 'Premium';
                } else {
                    premiumBadge.style.display = 'none';
                }
            }
            
            localStorage.setItem('userIsPremium', user.isPremium ? 'true' : 'false');
        } else {
            authButtons.style.display = 'flex';
            userMenu.style.display = 'none';
            
            if (premiumBadge) {
                premiumBadge.style.display = 'none';
            }
        }
    }

    hideModals() {
        // Cacher les modals Bootstrap
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) loginModal.hide();
        
        const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
        if (registerModal) registerModal.hide();
    }

    showAlert(message, type) {
        // Supprimer les alertes existantes
        document.querySelectorAll('.global-alert').forEach(alert => alert.remove());
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show global-alert`;
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.right = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.minWidth = '300px';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Supprimer automatiquement après 5 secondes
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }

    isAuthenticated() {
        return this.getToken() !== null;
    }

    isPremium() {
        return (this.user && this.user.isPremium) || localStorage.getItem('userIsPremium') === 'true';
    }

    getUser() {
        return this.user;
    }
    
    showLoginModal() {
        const loginModalElement = document.getElementById('loginModal');
        if (loginModalElement) {
            const loginModal = new bootstrap.Modal(loginModalElement);
            loginModal.show();
        }
    }
}

// Exposer la classe Auth globalement
window.Auth = Auth;

// Initialisation automatique si on est sur une page qui nécessite l'authentification
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('auth-buttons') || document.getElementById('user-menu')) {
        window.auth = new Auth();
    }
});