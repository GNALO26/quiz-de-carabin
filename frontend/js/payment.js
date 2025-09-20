import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Payment {
    constructor() {
        this.auth = new Auth();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Bouton d'abonnement
        document.getElementById('subscribe-btn')?.addEventListener('click', () => {
            this.initiatePayment();
        });
        
        // Validation du code d'accès
        document.getElementById('validate-code')?.addEventListener('click', () => {
            this.validateAccessCode();
        });
        
        // Renvoi du code
        document.getElementById('resend-code')?.addEventListener('click', () => {
            this.resendAccessCode();
        });
    }

    async initiatePayment() {
        try {
            console.log('Initialisation du paiement...');
            
            if (!this.auth.isAuthenticated()) {
                this.auth.showLoginModal();
                this.showAlert('Veuillez vous connecter pour vous abonner', 'warning');
                return;
            }

            const user = this.auth.getUser();
            const token = this.auth.getToken();
            
            console.log('Utilisateur:', user.email);
            
            const API_BASE_URL = await this.getActiveAPIUrl();
            console.log('API URL:', API_BASE_URL);
            
            const response = await fetch(`${API_BASE_URL}/api/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log('Réponse complète du serveur:', data);

            if (data.success && data.invoiceURL) {
                console.log('Redirection vers:', data.invoiceURL);
                window.location.href = data.invoiceURL;
            } else {
                console.error('Erreur du serveur:', data);
                
                if (data.error && data.error.includes('Transaction Found')) {
                    this.showAlert('Une transaction est déjà en cours. Veuillez réessayer dans quelques instants.', 'warning');
                } else {
                    this.showAlert('Erreur lors de l\'initiation du paiement: ' + (data.message || 'Erreur inconnue'), 'danger');
                }
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            
            if (error.message.includes('Transaction Found')) {
                this.showAlert('Une transaction est déjà en cours. Veuillez réessayer dans quelques instants.', 'warning');
            } else {
                this.showAlert('Erreur lors de l\'initiation du paiement: ' + error.message, 'danger');
            }
        }
    }

    async validateAccessCode() {
        try {
            const codeInput = document.getElementById('accessCode');
            const code = codeInput.value.trim();
            
            if (!code || code.length !== 6) {
                this.showAlert('Veuillez entrer un code à 6 chiffres valide', 'warning');
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }
            
            // Afficher l'indicateur de chargement
            const validateButton = document.getElementById('validate-code');
            const originalText = validateButton.innerHTML;
            validateButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validation...';
            validateButton.disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/access-code/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            // Réinitialiser le bouton
            validateButton.innerHTML = originalText;
            validateButton.disabled = false;

            if (response.status === 401) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert(data.message, 'success');
                
                // Mettre à jour les informations utilisateur
                if (data.user) {
                    localStorage.setItem('quizUser', JSON.stringify(data.user));
                    this.auth.user = data.user;
                    this.auth.updateUI();
                }
                
                // Fermer le modal après 2 secondes
                setTimeout(() => {
                    const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                    if (codeModal) {
                        codeModal.hide();
                    }
                    
                    // Recharger les quiz pour afficher les quiz premium
                    if (window.quiz && typeof window.quiz.loadQuizzes === 'function') {
                        window.quiz.loadQuizzes();
                    }
                }, 2000);
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('Error validating access code:', error);
            this.showAlert('Erreur lors de la validation du code. Veuillez réessayer.', 'danger');
        }
    }

    async resendAccessCode() {
        try {
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }
            
            const resendBtn = document.getElementById('resend-code');
            const originalText = resendBtn.innerHTML;
            resendBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Envoi...';
            resendBtn.disabled = true;

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/access-code/resend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            // Réinitialiser le bouton
            resendBtn.innerHTML = originalText;
            resendBtn.disabled = false;

            if (response.status === 401) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert('Un nouveau code a été envoyé à votre adresse email.', 'success');
            } else {
                this.showAlert(data.message || 'Erreur lors de l\'envoi du code', 'danger');
            }
        } catch (error) {
            console.error('Error resending access code:', error);
            this.showAlert('Erreur lors de l\'envoi du code. Veuillez réessayer.', 'danger');
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
}

// Initialisation automatique quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    window.payment = new Payment();
});