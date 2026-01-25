import { CONFIG } from './config.js';

export class Auth {
    constructor() {
        this.cleanCorruptedTokens();
        this.token = this.getToken();
        this.user = JSON.parse(localStorage.getItem('quizUser') || 'null');
        this.sessionCheckInterval = null;
        this.sessionCheckerStarted = false;
        this.init();
        
        // ✅ CORRECTION: Démarrer le vérificateur après un délai
        setTimeout(() => {
            if (!this.sessionCheckerStarted) {
                this.startSessionChecker();
                this.sessionCheckerStarted = true;
            }
        }, 3000);
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
                // ✅ CORRECTION: Sauvegarder TOUTES les données utilisateur
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('quizToken', data.token);
                localStorage.setItem('quizUser', JSON.stringify(data.user));
                
                this.updateUI();
                this.hideModals();
                this.showAlert('Connexion réussie!', 'success');
                
                // ✅ CORRECTION: Recharger la page complètement
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
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

        if (password.length < 6) {
            this.showAlert('Le mot de passe doit contenir au moins 6 caractères', 'danger');
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
                // ✅ CORRECTION: Sauvegarder TOUTES les données utilisateur
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('quizToken', data.token);
                localStorage.setItem('quizUser', JSON.stringify(data.user));
                
                this.updateUI();
                this.hideModals();
                this.showAlert('Compte créé avec succès! Vous êtes maintenant connecté.', 'success');
                
                // ✅ CORRECTION: Recharger la page complètement
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
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
        
        return CONFIG.API_BACKUP_URL || CONFIG.API_BASE_URL;
    }

    // ✅ CORRECTION: Vérification de session plus intelligente
    startSessionChecker() {
        if (this.sessionCheckInterval) {
            clearInterval(this.sessionCheckInterval);
        }

        this.sessionCheckInterval = setInterval(async () => {
            if (!this.isAuthenticated()) {
                return; // Ne rien faire si pas authentifié
            }
            
            try {
                const response = await this.apiRequest('/api/auth/check-session');
                
                if (!response.ok) {
                    const data = await response.json();
                    
                    if (data.code === 'SESSION_EXPIRED' || 
                        data.code === 'SESSION_INVALIDATED' || 
                        data.code === 'TOKEN_VERSION_MISMATCH') {
                        
                        console.warn('⚠️ Session invalide détectée:', data.code);
                        this.cleanInvalidToken();
                        this.showAlert('Votre session a expiré. Veuillez vous reconnecter.', 'warning');
                        
                        setTimeout(() => {
                            window.location.href = CONFIG.PAGES.INDEX;
                        }, 2000);
                    }
                }
            } catch (error) {
                console.error('Erreur vérification session:', error);
                // Ne pas déconnecter automatiquement en cas d'erreur réseau
            }
        }, 60000); // Vérifier toutes les 60 secondes
    }

    logout() {
        try {
            if (this.sessionCheckInterval) {
                clearInterval(this.sessionCheckInterval);
                this.sessionCheckInterval = null;
            }

            localStorage.removeItem('quizToken');
            localStorage.removeItem('quizUser');
            localStorage.removeItem('userIsPremium');
            localStorage.removeItem('premiumExpiresAt');
            
            this.token = null;
            this.user = null;
            
            this.updateUI();
            this.showAlert('Déconnexion réussie', 'success');
            
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
        return this.getToken() !== null && this.user !== null;
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
                    localStorage.setItem('quizUser', JSON.stringify(this.user));
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
        
        if (!token) {
            throw new Error('Aucun token disponible');
        }

        const API_BASE_URL = await this.getActiveAPIUrl();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        headers['Authorization'] = `Bearer ${token}`;
        
        try {
            const response = await fetch(`${API_BASE_URL}${url}`, {
                ...options,
                headers,
                credentials: 'include'
            });
            
            // ✅ CORRECTION: Ne pas auto-déconnecter sur 401 dans apiRequest
            // Laisser startSessionChecker() gérer ça
            
            return response;
        } catch (error) {
            console.error('API Request error:', error);
            throw error;
        }
    }
}

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('auth-buttons') || document.getElementById('user-menu')) {
        window.auth = new Auth();
        console.log('✅ Auth initialisé');
    }
});