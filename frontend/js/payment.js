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
        console.log('🎯 SetupEventListeners: Initialisation des écouteurs PRODUCTION');
        
        document.querySelectorAll('.subscribe-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const planId = e.currentTarget.getAttribute('data-plan-id');
                const amount = e.currentTarget.getAttribute('data-plan-price');
                console.log(`🖱 Clic sur bouton PRODUCTION: ${planId} - ${amount} FCFA`);
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
            console.log('🔄 Détection retour paiement PRODUCTION. Vérification statut...');
            this.showAlert('Paiement en cours de confirmation. Veuillez patienter...', 'info');
        }
    }

    async initiatePayment(planId, amount) {
        try {
            console.log(`💰 Initialisation paiement PRODUCTION: ${planId} - ${amount} FCFA`);
            
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
            subscribeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Préparation...';
            subscribeBtn.disabled = true;

            console.log('📤 Envoi requête paiement PRODUCTION...');
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

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Route non trouvée (404). Vérifiez l'URL: ${API_BASE_URL}/api/payment/initiate`);
                }
                throw new Error(`Erreur HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('📨 Réponse serveur PRODUCTION:', data);

            if (data.success && data.transactionId) {
                console.log('✅ Transaction créée, ouverture widget KkiaPay...');
                
                // Stocker l'ID de transaction pour le callback
                localStorage.setItem('pendingTransaction', data.transactionId);
                
                // Ouvrir le widget KkiaPay
                await this.openKkiaPayWidget(parseInt(amount), user, data.transactionId);
            } else {
                throw new Error(data.message || 'Erreur lors de la création de la transaction');
            }
        } catch (error) {
            console.error('💥 Erreur initiatePayment PRODUCTION:', error);
            this.showAlert(error.message || 'Erreur de connexion. Vérifiez votre internet.', 'danger');
        } finally {
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"]`);
            if (subscribeBtn) {
                subscribeBtn.innerHTML = 'S\'abonner';
                subscribeBtn.disabled = false;
            }
        }
    }

    // Charger le script KkiaPay
    loadKkiaPayScript() {
        return new Promise((resolve, reject) => {
            if (window.Kkiapay) {
                console.log('✅ Script KkiaPay déjà chargé');
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.kkiapay.me/k.js';
            script.onload = () => {
                console.log('✅ Script KkiaPay chargé avec succès - MODE PRODUCTION');
                resolve();
            };
            script.onerror = (error) => {
                console.error('❌ Erreur chargement script KkiaPay:', error);
                reject(new Error('Impossible de charger le service de paiement'));
            };
            document.head.appendChild(script);
        });
    }

    // Ouvrir le widget KkiaPay - MODE PRODUCTION
    async openKkiaPayWidget(amount, user, transactionId) {
        try {
            console.log('🎯 Ouverture widget KkiaPay MODE PRODUCTION...');
            
            // Charger le script
            await this.loadKkiaPayScript();
            
            // Configuration PRODUCTION
            const kkiapay = window.Kkiapay && window.Kkiapay.init('2c79c85d47f4603c5c9acc9f9ca7b8e32d65c751', {
                amount: amount,
                name: "Quiz de Carabin",
                email: user.email,
                phone: user.phone || '+2290156035888',
                data: JSON.stringify({
                    transaction_id: transactionId,
                    user_id: user._id,
                    user_email: user.email
                }),
                callback: `${window.location.origin}/payment-callback.html?transactionId=${transactionId}`,
                theme: "#13a718",
                position: "center",
                sandbox: false // ⚠ CRITIQUE: false pour PRODUCTION
            });

            if (!kkiapay) {
                throw new Error('Widget KkiaPay non initialisé');
            }

            console.log('✅ Widget KkiaPay initialisé MODE PRODUCTION, ouverture...');
            kkiapay.open();

            // Écouter les événements du widget
            window.addEventListener('message', (event) => {
                if (event.data.from === 'kkiapay_widget') {
                    console.log('📨 Message du widget PRODUCTION:', event.data);
                    
                    switch (event.data.message) {
                        case 'payment_initiated':
                            this.showAlert('Paiement initié avec succès', 'info');
                            break;
                        case 'payment_success':
                            console.log('✅ Paiement réussi via widget PRODUCTION');
                            this.showAlert('Paiement réussi ! Redirection...', 'success');
                            break;
                        case 'payment_failed':
                            this.showAlert('Paiement échoué', 'danger');
                            break;
                    }
                }
            });

        } catch (error) {
            console.error('❌ Erreur ouverture widget PRODUCTION:', error);
            this.showAlert('Erreur lors de l\'ouverture du paiement: ' + error.message, 'danger');
        }
    }

    async processPaymentReturn() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const transactionId = urlParams.get('transactionId') || localStorage.getItem('pendingTransaction');
            
            if (!transactionId) {
                throw new Error('Aucun ID de transaction trouvé');
            }

            console.log('🔄 Traitement du retour de paiement PRODUCTION pour la transaction:', transactionId);

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
            console.log('📨 Réponse process-return PRODUCTION:', data);

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
            console.error('Erreur lors du traitement du retour de paiement PRODUCTION:', error);
            this.showPaymentError(error.message);
        }
    }

    showPaymentSuccess(accessCode, user) {
        const statusElement = document.getElementById('payment-status');
        if (statusElement) {
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
        }

        // Mettre à jour l'utilisateur dans le localStorage
        if (user) {
            localStorage.setItem('quizUser', JSON.stringify(user));
            this.auth.user = user;
            this.auth.updateUI();
        }
    }

    showPaymentPending() {
        const statusElement = document.getElementById('payment-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="alert alert-warning">
                    <h4>⏳ Paiement en Cours de Validation</h4>
                    <p>Votre paiement est en cours de traitement. Cela peut prendre quelques minutes.</p>
                    <p>Vous recevrez un email de confirmation une fois le paiement validé.</p>
                    <button onclick="window.location.href = '/'" class="btn btn-primary">Retour à l'accueil</button>
                </div>
            `;
        }
    }

    showPaymentError(message) {
        const statusElement = document.getElementById('payment-status');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="alert alert-danger">
                    <h4>❌ Erreur de Paiement</h4>
                    <p>${message}</p>
                    <button onclick="window.location.href = '/quiz.html'" class="btn btn-primary">Réessayer</button>
                </div>
            `;
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

// Initialisation PRODUCTION
document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Initialisation du module Payment PRODUCTION...');
    try {
        window.payment = new Payment();
        console.log('✅ Module Payment initialisé avec succès - MODE PRODUCTION');
    } catch (error) {
        console.error('❌ Erreur initialisation Payment PRODUCTION:', error);
    }
});