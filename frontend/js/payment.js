import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Payment {
    constructor() {
        this.auth = new Auth();
        this.setupEventListeners();
        this.checkPaymentReturn();
    }

    // ✅ FONCTION AJOUTÉE: getActiveAPIUrl manquante
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

    setupEventListeners() {
        document.querySelectorAll('.subscribe-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const planId = e.currentTarget.getAttribute('data-plan-id');
                const amount = e.currentTarget.getAttribute('data-plan-price');
                this.initiatePayment(planId, amount);
            });
        });
        
        document.getElementById('validate-code')?.addEventListener('click', () => {
            this.validateAccessCode();
        });
        
        document.getElementById('resend-code')?.addEventListener('click', () => {
            this.resendAccessCode();
        });
    }

    async initiatePayment(planId, amount) {
        try {
            console.log(`💰 Initialisation paiement: ${planId} - ${amount} FCFA`);
            
            if (!this.auth.isAuthenticated()) {
                this.auth.showLoginModal();
                this.showAlert('Veuillez vous connecter pour vous abonner', 'warning');
                return;
            }

            const user = this.auth.getUser();
            const token = this.auth.getToken();
            
            console.log('👤 Utilisateur:', user.email);
            
            const API_BASE_URL = await this.getActiveAPIUrl();
            console.log('🌐 API utilisée:', API_BASE_URL);
            
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"]`);
            const originalText = subscribeBtn.innerHTML;
            subscribeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Traitement...';
            subscribeBtn.disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    planId, 
                    amount: parseInt(amount)
                })
            });

            const data = await response.json();
            console.log('📨 Réponse serveur:', data);

            subscribeBtn.innerHTML = originalText;
            subscribeBtn.disabled = false;

            if (data.success && data.paymentUrl) {
                console.log('✅ Redirection vers KkiaPay:', data.paymentUrl);
                window.location.href = data.paymentUrl;
            } else {
                console.error('❌ Erreur serveur:', data);
                this.showAlert(data.message || 'Erreur lors du paiement', 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur initiatePayment:', error);
            
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"]`);
            if (subscribeBtn) {
                subscribeBtn.innerHTML = 'S\'abonner';
                subscribeBtn.disabled = false;
            }
            
            this.showAlert('Erreur de connexion. Vérifiez votre internet.', 'danger');
        }
    }

    async checkPaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const transactionId = urlParams.get('transactionId');
        const userId = urlParams.get('userId');
        
        if (transactionId && userId) {
            console.log('🔄 Détection retour paiement. Vérification statut...');
            this.showAlert('Paiement en cours de confirmation. Veuillez patienter...', 'info');
            this.checkStatusAndRedirect(transactionId, userId, 0);
        }
    }
    
    async checkStatusAndRedirect(transactionId, userId, attempt) {
        const MAX_ATTEMPTS = 5;
        const DELAY = 3000;

        try {
            console.log(`🔍 Vérification statut transaction... (Tentative ${attempt + 1}/${MAX_ATTEMPTS})`);
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'danger');
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/payment/check/${transactionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log('📨 Réponse check-status:', data);

            if (data.success && data.transactionStatus === 'completed') {
                console.log('✅ Paiement confirmé, code d\'accès reçu.');
                this.showAlert('Votre paiement a été confirmé! Un code d\'accès vous a été envoyé par email.', 'success');
                const accessCodeModal = new bootstrap.Modal(document.getElementById('codeModal'));
                accessCodeModal.show();
                
                if (data.accessCode) {
                    document.getElementById('accessCode').value = data.accessCode;
                }
                return;
            } else if (data.transactionStatus === 'pending' && attempt < MAX_ATTEMPTS) {
                console.log('⏳ Paiement en attente, nouvelle tentative...');
                setTimeout(() => this.checkStatusAndRedirect(transactionId, userId, attempt + 1), DELAY);
            } else {
                console.error('❌ Échec confirmation paiement après plusieurs tentatives.');
                this.showAlert('Le paiement n\'a pas pu être confirmé. Vérifiez votre email ou contactez le support.', 'warning');
            }
        } catch (error) {
            console.error('💥 Erreur vérification paiement:', error);
            if (attempt < MAX_ATTEMPTS) {
                setTimeout(() => this.checkStatusAndRedirect(transactionId, userId, attempt + 1), DELAY);
            } else {
                this.showAlert('Erreur de connexion. Veuillez réessayer plus tard.', 'danger');
            }
        }
    }

    async validateAccessCode() {
        try {
            const codeInput = document.getElementById('accessCode');
            const code = codeInput.value.trim();
            
            if (!code || code.length < 5) {
                this.showAlert('Veuillez entrer un code valide', 'warning');
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }
            
            const validateButton = document.getElementById('validate-code');
            const originalText = validateButton.innerHTML;
            validateButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Validation...';
            validateButton.disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/access-code/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            validateButton.innerHTML = originalText;
            validateButton.disabled = false;

            if (response.status === 401) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert(data.message, 'success');
                
                if (data.user) {
                    localStorage.setItem('quizUser', JSON.stringify(data.user));
                    this.auth.user = data.user;
                    this.auth.updateUI();
                }
                
                setTimeout(() => {
                    const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                    if (codeModal) {
                        codeModal.hide();
                    }
                    if (window.location.pathname.includes('index.html')) {
                        window.location.reload();
                    }
                }, 2000);
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur validation code:', error);
            this.showAlert('Erreur lors de la validation du code: ' + error.message, 'danger');
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
            resendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Envoi...';
            resendBtn.disabled = true;

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/access-code/resend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

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
                this.showAlert('Un nouveau code a été renvoyé à votre adresse email.', 'success');
            } else {
                this.showAlert(data.message || 'Erreur lors de l\'envoi du code', 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur renvoi code:', error);
            this.showAlert('Erreur lors de l\'envoi du code. Veuillez réessayer.', 'danger');
        }
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

document.addEventListener('DOMContentLoaded', function() {
    window.payment = new Payment();
    
    const pendingCode = localStorage.getItem('pendingAccessCode');
    if (pendingCode && document.getElementById('accessCode')) {
        document.getElementById('accessCode').value = pendingCode;
        localStorage.removeItem('pendingAccessCode');
    }
});