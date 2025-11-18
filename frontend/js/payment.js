import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Payment {
    constructor() {
        this.auth = new Auth();
        this.setupEventListeners();
        this.checkPaymentReturn();
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

    setupEventListeners() {
        console.log('🎯 SetupEventListeners: Initialisation des écouteurs');
        
        document.querySelectorAll('.subscribe-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const planId = e.currentTarget.getAttribute('data-plan-id');
                const amount = e.currentTarget.getAttribute('data-plan-price');
                console.log(`🖱 Clic sur bouton: ${planId} - ${amount} FCFA`);
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

    checkPaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const transactionId = urlParams.get('transactionId');
        
        if (transactionId && window.location.pathname.includes('payment-callback.html')) {
            console.log('🔄 Détection retour paiement. Vérification statut...');
            this.showAlert('Paiement en cours de confirmation. Veuillez patienter...', 'info');
        }
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

            console.log('📤 Envoi requête paiement...');
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
            console.log('📨 Réponse serveur complète:', data);
            console.log('📊 Statut HTTP:', response.status);

            if (data.success && data.paymentUrl) {
                console.log('✅ Redirection vers KkiaPay:', data.paymentUrl);
                // Stocker l'ID de transaction pour le callback
                localStorage.setItem('pendingTransaction', data.transactionId);
                window.location.href = data.paymentUrl;
            } else {
                console.error('❌ Erreur serveur détaillée:', {
                    success: data.success,
                    message: data.message,
                    error: data.error,
                    status: response.status
                });
                this.showAlert(data.message || `Erreur serveur (${response.status})`, 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur initiatePayment:', error);
            this.showAlert('Erreur de connexion. Vérifiez votre internet.', 'danger');
        } finally {
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"]`);
            if (subscribeBtn) {
                subscribeBtn.innerHTML = 'S\'abonner';
                subscribeBtn.disabled = false;
            }
        }
    }

    // ✅ FONCTION MANQUANTE AJOUTÉE
    async processPaymentReturn() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const transactionId = urlParams.get('transactionId') || localStorage.getItem('pendingTransaction');
            
            if (!transactionId) {
                throw new Error('Aucun ID de transaction trouvé');
            }

            console.log('🔄 Traitement du retour de paiement pour la transaction:', transactionId);

            const token = this.auth.getToken();
            if (!token) {
                throw new Error('Utilisateur non connecté');
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/payment/process-return`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ transactionId })
            });

            const data = await response.json();
            console.log('📨 Réponse process-return:', data);

            if (data.success) {
                if (data.status === 'completed') {
                    this.showPaymentSuccess(data.accessCode, data.user);
                    localStorage.removeItem('pendingTransaction');
                } else {
                    this.showPaymentPending();
                }
            } else {
                throw new Error(data.message || 'Erreur lors du traitement du paiement');
            }
        } catch (error) {
            console.error('Erreur lors du traitement du retour de paiement:', error);
            this.showPaymentError(error.message);
        }
    }

    showPaymentSuccess(accessCode, user) {
        const statusElement = document.getElementById('payment-status');
        statusElement.innerHTML = `
            <div class="alert alert-success">
                <h4>✅ Paiement Réussi!</h4>
                <p>Votre abonnement premium a été activé avec succès.</p>
                <div class="access-code my-3">
                    <strong>Votre code d'accès:</strong>
                    <div class="h4 text-primary">${accessCode}</div>
                </div>
                <p>Un email de confirmation vous a été envoyé.</p>
                <button onclick="window.location.href = '/quiz.html'" class="btn btn-success">Commencer les quiz</button>
            </div>
        `;

        // Mettre à jour l'utilisateur dans le localStorage
        if (user) {
            localStorage.setItem('quizUser', JSON.stringify(user));
            this.auth.user = user;
        }
    }

    showPaymentPending() {
        const statusElement = document.getElementById('payment-status');
        statusElement.innerHTML = `
            <div class="alert alert-warning">
                <h4>⏳ Paiement en Cours de Validation</h4>
                <p>Votre paiement est en cours de traitement. Cela peut prendre quelques minutes.</p>
                <p>Vous recevrez un email de confirmation une fois le paiement validé.</p>
                <button onclick="window.location.href = '/'" class="btn btn-primary">Retour à l'accueil</button>
            </div>
        `;
    }

    showPaymentError(message) {
        const statusElement = document.getElementById('payment-status');
        statusElement.innerHTML = `
            <div class="alert alert-danger">
                <h4>❌ Erreur de Paiement</h4>
                <p>${message}</p>
                <button onclick="window.location.href = '/payment.html'" class="btn btn-primary">Réessayer</button>
            </div>
        `;
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
            
            const response = await fetch(`${API_BASE_URL}/api/payment/resend-code`, {
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

    async function diagnostic() {
    try {
        const token = localStorage.getItem('token');
        const API_BASE_URL = 'https://quiz-de-carabin-backend.onrender.com';
        
        console.log('🔍 DIAGNOSTIC DÉBUT');
        
        // Test 1: Route publique
        const test1 = await fetch(`${API_BASE_URL}/api/payment/debug-test`);
        console.log('Test 1 (public):', await test1.json());
        
        // Test 2: Route protégée sans token
        const test2 = await fetch(`${API_BASE_URL}/api/payment/debug-test-protected`);
        console.log('Test 2 (sans token):', test2.status);
        
        // Test 3: Route protégée avec token
        if (token) {
            const test3 = await fetch(`${API_BASE_URL}/api/payment/debug-test-protected`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('Test 3 (avec token):', await test3.json());
        }
        
        // Test 4: Route initiate
        if (token) {
            const test4 = await fetch(`${API_BASE_URL}/api/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ planId: '1-month', amount: 5000 })
            });
            console.log('Test 4 (initiate):', {
                status: test4.status,
                statusText: test4.statusText,
                response: await test4.text()
            });
        }
        
        console.log('🔍 DIAGNOSTIC FIN');
    } catch (error) {
        console.error('❌ Erreur diagnostic:', error);
    }
}


// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Initialisation du module Payment...');
    try {
        window.payment = new Payment();
        console.log('✅ Module Payment initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur initialisation Payment:', error);
    }
});