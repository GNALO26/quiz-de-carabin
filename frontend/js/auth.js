import { CONFIG } from './config.js';

export class Auth {
    constructor() {
        this.token = localStorage.getItem('quizToken');
        this.user = JSON.parse(localStorage.getItem('quizUser') || 'null');
        this.init();
    }

    // AJOUTEZ CETTE MÉTHODE POUR VALIDER LE TOKEN
    validateToken(token) {
        try {
            if (!token || typeof token !== 'string') {
                return false;
            }
            
            // Vérifier la structure JWT (3 parties séparées par des points)
            const parts = token.split('.');
            if (parts.length !== 3) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    // MODIFIEZ getToken POUR INCLURE LA VALIDATION
    getToken() {
        const token = localStorage.getItem('quizToken');
        if (!this.validateToken(token)) {
            console.warn('Token invalide, déconnexion...');
            this.logout();
            return null;
        }
        return token;
    }

    // RENFORCEZ LA MÉTHODE logout
    logout() {
        try {
            // Supprimez tous les éléments de stockage
            localStorage.removeItem('quizToken');
            localStorage.removeItem('quizUser');
            localStorage.removeItem('userIsPremium');
            localStorage.removeItem('premiumExpiresAt');
            
            // Réinitialisez les variables
            this.token = null;
            this.user = null;
            
            // Mettez à jour l'interface
            this.updateUI();
            
            // Affichez un message
            this.showAlert('Déconnexion réussie', 'success');
            
            // Rechargez la page après 1 seconde
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showAlert('Erreur lors de la déconnexion', 'danger');
        }
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
    
    // Logout - UTILISEZ 'click' AU LIEU DE 'click'
    document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
    
    // Ajoutez aussi un écouteur pour le bouton de déconnexion dans le dropdown
    document.querySelectorAll('#logout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    });
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
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
                }
                
                throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                
                localStorage.setItem('quizToken', this.token);
                localStorage.setItem('quizUser', JSON.stringify(this.user));
                
                this.updateUI();
                this.hideModals();
                this.showAlert('Connexion réussie!', 'success');
                
                if (window.quiz && typeof window.quiz.loadQuizzes === 'function') {
                    window.quiz.loadQuizzes();
                }
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('Login error:', error);
            
            if (error.name === 'AbortError') {
                this.showAlert('Le serveur ne répond pas. Veuillez réessayer plus tard.', 'danger');
            } else if (error.message.includes('Failed to fetch')) {
                this.showAlert('Impossible de se connecter au serveur. Vérifiez votre connexion internet.', 'danger');
            } else {
                this.showAlert('Erreur de connexion: ' + error.message, 'danger');
            }
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
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
                }
                
                throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert('Compte créé avec succès! Vous pouvez maintenant vous connecter.', 'success');
                const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
                if (registerModal) registerModal.hide();
                
                const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
                loginModal.show();
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('Register error:', error);
            
            if (error.name === 'AbortError') {
                this.showAlert('Le serveur ne répond pas. Veuillez réessayer plus tard.', 'danger');
            } else if (error.message.includes('Failed to fetch')) {
                this.showAlert('Impossible de se connecter au serveur. Vérifiez votre connexion internet.', 'danger');
            } else {
                this.showAlert('Erreur lors de la création du compte: ' + error.message, 'danger');
            }
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
        this.token = null;
        this.user = null;
        localStorage.removeItem('quizToken');
        localStorage.removeItem('quizUser');
        localStorage.removeItem('userIsPremium');
        localStorage.removeItem('premiumExpiresAt');
        this.updateUI();
        this.showAlert('Déconnexion réussie', 'success');
        
        if (window.quiz && typeof window.quiz.loadQuizzes === 'function') {
            window.quiz.loadQuizzes();
        }
    }

    updateUI() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const userName = document.getElementById('user-name');
        const premiumBadge = document.getElementById('premium-badge');

        if (this.user && authButtons && userMenu && userName) {
            authButtons.style.display = 'none';
            userMenu.style.display = 'block';
            userName.textContent = this.user.name;
            
            // Afficher le badge premium si l'utilisateur est premium
            if (premiumBadge) {
                if (this.isPremium() || localStorage.getItem('userIsPremium') === 'true') {
                    premiumBadge.style.display = 'inline';
                } else {
                    premiumBadge.style.display = 'none';
                }
            }
        } else if (authButtons && userMenu) {
            authButtons.style.display = 'flex';
            userMenu.style.display = 'none';
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
        return this.token !== null;
    }

    isPremium() {
        return (this.user && this.user.isPremium) || localStorage.getItem('userIsPremium') === 'true';
    }

    getToken() {
        return this.token;
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

// Fonction pour vérifier le statut premium
async function checkPremiumStatus() {
    try {
        const auth = new Auth();
        const token = auth.getToken();
        if (!token) return false;
        
        const API_BASE_URL = await auth.getActiveAPIUrl();
        
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.isPremium) {
                localStorage.setItem('userIsPremium', 'true');
                localStorage.setItem('premiumExpiresAt', new Date(data.data.premiumExpiresAt).toISOString());
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking premium status:', error);
        return false;
    }
}

// Ajouter à l'objet global window
window.checkPremiumStatus = checkPremiumStatus;