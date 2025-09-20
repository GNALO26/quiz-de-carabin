import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Payment {
    constructor() {
        this.auth = new Auth();
        this.setupEventListeners();
        this.checkPendingPayment();
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
        
        // Vérification automatique du code après paiement
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            setTimeout(() => this.checkForAccessCode(), 3000);
        }
    }

    // Vérifier s'il y a un paiement en attente au chargement de la page
    async checkPendingPayment() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('status');
        const transactionId = urlParams.get('transactionId');
        
        if (paymentStatus === 'success' && transactionId) {
            this.showAlert('Paiement confirmé! Vérification du code d\'accès...', 'info');
            
            // Attendre un peu pour laisser le webhook traiter le paiement
            setTimeout(async () => {
                const accessCode = await this.checkAccessCode();
                if (accessCode) {
                    this.showAlert('Votre code d\'accès a été généré avec succès!', 'success');
                    // Stocker le code pour pré-remplir le formulaire
                    localStorage.setItem('pendingAccessCode', accessCode);
                    
                    // Rediriger vers la page de validation du code
                    setTimeout(() => {
                        window.location.href = 'access-code.html';
                    }, 2000);
                } else {
                    this.showAlert('Paiement confirmé! Vérifiez votre email pour le code d\'accès.', 'info');
                }
            }, 5000);
        }
    }

    // Vérifier périodiquement si un code d'accès est disponible
    async checkForAccessCode() {
        console.log('Vérification du code d\'accès...');
        const accessCode = await this.checkAccessCode();
        if (accessCode) {
            this.showAlert('Code d\'accès disponible! Redirection...', 'success');
            localStorage.setItem('pendingAccessCode', accessCode);
            window.location.href = 'access-code.html';
        } else {
            // Réessayer après 5 secondes
            setTimeout(() => this.checkForAccessCode(), 5000);
        }
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
            
            // Afficher l'indicateur de chargement
            const subscribeBtn = document.getElementById('subscribe-btn');
            const originalText = subscribeBtn.innerHTML;
            subscribeBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Traitement...';
            subscribeBtn.disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            // Réinitialiser le bouton
            subscribeBtn.innerHTML = originalText;
            subscribeBtn.disabled = false;

            const data = await response.json();
            console.log('Réponse complète du serveur:', data);

            if (data.success && data.invoiceURL) {
                console.log('Redirection vers:', data.invoiceURL);
                window.location.href = data.invoiceURL;
            } else if (data.transactionId) {
                // Une transaction est déjà en cours, proposer des options
                this.showAlert(
                    `Une transaction est déjà en cours. <a href="${data.invoiceURL}" class="alert-link">Cliquez ici pour continuer</a> ou attendez qu'elle expire.`,
                    'warning',
                    10000
                );
            } else {
                console.error('Erreur du serveur:', data);
                this.showAlert('Erreur lors de l\'initiation du paiement: ' + (data.message || 'Erreur inconnue'), 'danger');
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            this.showAlert('Erreur lors de l\'initiation du paiement: ' + error.message, 'danger');
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
                    
                    // Rediriger vers la page quiz si on est sur la page de validation
                    if (window.location.pathname.includes('access-code.html')) {
                        window.location.href = 'quiz.html';
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

    // Nouvelle méthode pour vérifier le code d'accès
    async checkAccessCode() {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            if (!token) {
                console.error('No authentication token found');
                return null;
            }
            
            const response = await fetch(`${API_BASE_URL}/api/payment/access-code`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    return data.accessCode;
                }
            }
            return null;
        } catch (error) {
            console.error('Error checking access code:', error);
            return null;
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

    showAlert(message, type, duration = 5000) {
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
        }, duration);
    }
}

// Initialisation automatique quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    window.payment = new Payment();
    
    // Pré-remplir le champ de code s'il y a un code en attente
    const pendingCode = localStorage.getItem('pendingAccessCode');
    if (pendingCode && document.getElementById('accessCode')) {
        document.getElementById('accessCode').value = pendingCode;
        localStorage.removeItem('pendingAccessCode');
        
        // Valider automatiquement si on est sur la page de validation
        if (window.location.pathname.includes('access-code.html')) {
            setTimeout(() => {
                document.getElementById('validate-code').click();
            }, 1000);
        }
    }
});