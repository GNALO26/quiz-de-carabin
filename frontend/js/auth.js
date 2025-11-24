import { CONFIG } from './config.js';

export class Auth {
    constructor() {
        this.cleanCorruptedTokens();
        this.token = this.getToken();
        this.user = JSON.parse(localStorage.getItem('quizUser') || 'null');
        this.sessionCheckInterval = null;
        this.init();
        this.startSessionChecker();
    }

    init() {
        this.updateUI();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('login-btn')?.addEventListener('click', () => this.login());
        document.getElementById('register-btn')?.addEventListener('click', () => this.register());
        
        document.getElementById('logout-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
        
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            userDropdown.addEventListener('click', (e) => {
                e.preventDefault();
                const dropdownMenu = userDropdown.nextElementSibling;
                dropdownMenu.classList.toggle('show');
            });
        }
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
    }

    cleanInvalidToken() {
        localStorage.removeItem('quizToken');
        localStorage.removeItem('quizUser');
        localStorage.removeItem('userIsPremium');
        localStorage.removeItem('premiumExpiresAt');
        this.token = null;
        this.user = null;
        this.updateUI();
    }

    cleanCorruptedTokens() {
        const token = localStorage.getItem('quizToken');
        if (token) {
            try {
                if (typeof token !== 'string' || token === 'null' || token === 'undefined') {
                    localStorage.removeItem('quizToken');
                    localStorage.removeItem('quizUser');
                    return;
                }
                
                const parts = token.split('.');
                if (parts.length !== 3) {
                    localStorage.removeItem('quizToken');
                    localStorage.removeItem('quizUser');
                }
            } catch (error) {
                localStorage.removeItem('quizToken');
                localStorage.removeItem('quizUser');
            }
        }
    }

    getToken() {
        let token = localStorage.getItem('quizToken');
        if (!token || token === 'null' || token === 'undefined' || token === 'Bearer null') {
            return null;
        }
        
        token = token.replace(/^"(.*)"$/, '$1')
                    .replace(/^'(.*)'$/, '$1')
                    .replace(/^Bearer /, '')
                    .trim();
        
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
                body: JSON.stringify({ 
                    email, 
                    password,
                    deviceInfo: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        screenResolution: `${screen.width}x${screen.height}`,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                })
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
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('quizToken', data.token);
                localStorage.setItem('quizUser', JSON.stringify(data.user));
                
                this.updateUI();
                this.hideModals();
                this.showAlert('Compte créé avec succès! Vous êtes maintenant connecté.', 'success');
                
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

    async getActiveAPIUrl() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return CONFIG.API_BASE_URL;
            }
        } catch (error) {
            console.warn('URL principale inaccessible:', error.message);
        }
        
        return CONFIG.API_BACKUP_URL;
    }

    startSessionChecker() {
        this.sessionCheckInterval = setInterval(async () => {
            if (this.isAuthenticated()) {
                try {
                    const response = await this.apiRequest('/api/auth/check-session');
                    if (!response.ok) {
                        const data = await response.json();
                        if (data.code === 'SESSION_EXPIRED' || data.code === 'SESSION_INVALIDATED') {
                            this.logout();
                            this.showAlert('Votre session a expiré ou a été utilisée sur un autre appareil. Veuillez vous reconnecter.', 'warning');
                        }
                    }
                } catch (error) {
                    console.error('Erreur vérification session:', error);
                }
            }
        }, 60000);
    }

    logout() {
        try {
            if (this.sessionCheckInterval) {
                clearInterval(this.sessionCheckInterval);
            }

            localStorage.removeItem('quizToken');
            localStorage.removeItem('quizUser');
            localStorage.removeItem('userIsPremium');
            localStorage.removeItem('premiumExpiresAt');
            
            this.token = null;
            this.user = null;
            
            this.updateUI();
            this.showAlert('Déconnexion réussie', 'success');
            
            if (window.location.pathname.includes('quiz.html') && window.quiz && typeof window.quiz.loadQuizzes === 'function') {
                window.quiz.loadQuizzes();
            }
            
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
                if (this.isPremium()) {
                    premiumBadge.style.display = 'inline';
                    premiumBadge.textContent = 'Premium';
                } else {
                    premiumBadge.style.display = 'none';
                }
            }
        } else {
            authButtons.style.display = 'flex';
            userMenu.style.display = 'none';
            
            if (premiumBadge) {
                premiumBadge.style.display = 'none';
            }
        }
    }

    hideModals() {
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        if (loginModal) loginModal.hide();
        
        const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
        if (registerModal) registerModal.hide();
    }

    showAlert(message, type) {
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
        const user = this.getUser();
        
        if (!user || !user.isPremium) {
            return false;
        }
        
        if (user.premiumExpiresAt) {
            try {
                const expirationDate = new Date(user.premiumExpiresAt);
                const now = new Date();
                
                if (expirationDate > now) {
                    return true;
                } else {
                    console.log(`Abonnement expiré pour ${user.email}`);
                    this.user.isPremium = false;
                    this.updateUI();
                    return false;
                }
            } catch (e) {
                console.error("Erreur date expiration:", e);
                return false;
            }
        }
        
        return user.isPremium === true;
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
    
    async apiRequest(url, options = {}) {
        const token = this.getToken();
        const API_BASE_URL = await this.getActiveAPIUrl();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}${url}`, {
                ...options,
                headers,
                credentials: 'include'
            });
            
            if (response.status === 401) {
                this.cleanInvalidToken();
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                window.location.reload();
                throw new Error('Session expirée');
            }
            
            return response;
        } catch (error) {
            console.error('API Request error:', error);
            throw error;
        }
    }
}

// Exposer la classe Auth globalement
window.Auth = Auth;

// Initialisation automatique
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('auth-buttons') || document.getElementById('user-menu')) {
        window.auth = new Auth();
    }
});