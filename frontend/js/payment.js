import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Payment {
    constructor() {
        this.auth = new Auth();
        this.kkiapayLoaded = false;
        this.loadKkiapayScript();
        this.setupEventListeners();
        this.checkPaymentReturn();
        this.displaySubscriptionInfo();
    }

    // ✅ NOUVELLE FONCTION: Charger le script KkiaPay dynamiquement
    loadKkiapayScript() {
        return new Promise((resolve, reject) => {
            // Vérifier si déjà chargé
            if (typeof openKkiapayWidget !== 'undefined') {
                console.log('✅ KkiaPay déjà chargé');
                this.kkiapayLoaded = true;
                resolve();
                return;
            }

            // Charger le script
            console.log('📥 Chargement du script KkiaPay...');
            const script = document.createElement('script');
            script.src = 'https://cdn.kkiapay.me/k.js';
            script.async = true;
            
            script.onload = () => {
                console.log('✅ Script KkiaPay chargé avec succès');
                this.kkiapayLoaded = true;
                resolve();
            };
            
            script.onerror = () => {
                console.error('❌ Erreur chargement script KkiaPay');
                this.kkiapayLoaded = false;
                reject(new Error('Impossible de charger KkiaPay'));
            };
            
            document.head.appendChild(script);
        });
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
        console.log('🎯 Initialisation des écouteurs de paiement');
        
        document.querySelectorAll('.subscribe-btn, .subscribe-btn-direct').forEach(button => {
            button.addEventListener('click', (e) => {
                const planId = e.currentTarget.getAttribute('data-plan-id') || 
                             e.currentTarget.getAttribute('data-plan-key');
                const amount = e.currentTarget.getAttribute('data-plan-price');
                
                console.log(`🖱 Clic paiement: ${planId} - ${amount} FCFA`);
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
        const transactionId = urlParams.get('transaction_id') || urlParams.get('transactionId');
        
        if (transactionId && window.location.pathname.includes('payment-callback.html')) {
            console.log('🔄 Détection retour paiement. Transaction:', transactionId);
        }
    }

    // ✅ PAIEMENT AVEC WIDGET KKIAPAY - VERSION AMÉLIORÉE
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
            
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"], [data-plan-key="${planId}"]`);
            if (subscribeBtn) {
                subscribeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Préparation...';
                subscribeBtn.disabled = true;
            }

            // ✅ ATTENDRE LE CHARGEMENT DE KKIAPAY
            if (!this.kkiapayLoaded) {
                console.log('⏳ Attente chargement KkiaPay...');
                try {
                    await this.loadKkiapayScript();
                } catch (error) {
                    throw new Error('Impossible de charger le système de paiement. Veuillez rafraîchir la page.');
                }
            }

            // ✅ VÉRIFICATION FINALE
            if (typeof openKkiapayWidget === 'undefined') {
                throw new Error('Le système de paiement n\'est pas disponible. Veuillez rafraîchir la page et réessayer.');
            }

            console.log('📤 Création transaction...');
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
                throw new Error(`Erreur HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('📨 Réponse serveur:', data);

            if (data.success && data.transactionId) {
                localStorage.setItem('pendingTransaction', data.transactionId);
                
                console.log('🎯 Ouverture widget KkiaPay...');
                
                // ✅ OUVRIR LE WIDGET
                openKkiapayWidget({
                    amount: data.amount,
                    api_key: data.publicKey,
                    sandbox: false,
                    phone: data.phone || '',
                    email: data.email,
                    data: JSON.stringify(data.metadata),
                    theme: "#13a718",
                    name: "Quiz de Carabin",
                    callback: data.callback,
                    
                    // Callback succès
                    successCallback: (response) => {
                        console.log('✅ Paiement réussi:', response);
                        // Rediriger avec le transactionId retourné par KkiaPay
                        window.location.href = `${data.callback}?transactionId=${response.transactionId}`;
                    },
                    
                    // Callback échec
                    failCallback: (error) => {
                        console.error('❌ Paiement échoué:', error);
                        this.showAlert('Le paiement a échoué. Veuillez réessayer.', 'danger');
                        if (subscribeBtn) {
                            subscribeBtn.innerHTML = 'S\'abonner';
                            subscribeBtn.disabled = false;
                        }
                    }
                });
            } else {
                throw new Error(data.message || 'Erreur création transaction');
            }
            
        } catch (error) {
            console.error('💥 Erreur paiement:', error);
            this.showAlert(error.message || 'Erreur de connexion', 'danger');
            
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"], [data-plan-key="${planId}"]`);
            if (subscribeBtn) {
                subscribeBtn.innerHTML = 'S\'abonner';
                subscribeBtn.disabled = false;
            }
        }
    }

    // ✅ VALIDATION CODE D'ACCÈS
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
                    this.displaySubscriptionInfo();
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

    // ✅ RENVOYER LE CODE D'ACCÈS
    async resendAccessCode() {
        try {
            console.log('🔄 Renvoi du code d\'accès...');
            
            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }
            
            const resendButton = document.getElementById('resend-code');
            const originalText = resendButton.innerHTML;
            resendButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Envoi...';
            resendButton.disabled = true;

            const response = await fetch(`${API_BASE_URL}/api/payment/resend-code`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            resendButton.innerHTML = originalText;
            resendButton.disabled = false;

            if (response.status === 401) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert(data.message || 'Code renvoyé par email', 'success');
            } else {
                this.showAlert(data.message || 'Erreur lors du renvoi du code', 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur renvoi code:', error);
            this.showAlert('Erreur lors du renvoi du code', 'danger');
        }
    }

    // ✅ AFFICHER LES INFORMATIONS D'ABONNEMENT
    async displaySubscriptionInfo() {
        try {
            if (!this.auth.isAuthenticated()) return;
            
            const subscription = await this.checkUserSubscription();
            const premiumBadge = document.getElementById('premium-badge');
            const subscriptionInfo = document.getElementById('subscription-info');
            
            if (subscription && subscription.hasActiveSubscription) {
                if (premiumBadge) {
                    premiumBadge.style.display = 'inline-block';
                    premiumBadge.textContent = '👑 Premium';
                    premiumBadge.classList.add('badge', 'bg-warning', 'text-dark');
                    
                    if (subscription.premiumExpiresAt) {
                        const expiryDate = new Date(subscription.premiumExpiresAt).toLocaleDateString('fr-FR');
                        premiumBadge.title = `Expire le ${expiryDate}`;
                    }
                }
                
                document.querySelectorAll('.subscribe-btn-direct, .subscribe-btn').forEach(btn => {
                    const card = btn.closest('.card');
                    if (card) {
                        btn.style.display = 'none';
                        
                        let activeBadge = card.querySelector('.active-subscription-badge');
                        if (!activeBadge) {
                            activeBadge = document.createElement('div');
                            activeBadge.className = 'active-subscription-badge alert alert-success mt-2';
                            activeBadge.innerHTML = '<i class="fas fa-check-circle me-2"></i>Abonnement actif';
                            btn.parentNode.appendChild(activeBadge);
                        }
                    }
                });
                
                if (subscriptionInfo) {
                    const expiryDate = subscription.premiumExpiresAt ? 
                        new Date(subscription.premiumExpiresAt).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : 'date inconnue';
                    
                    const daysLeft = subscription.daysLeft || 0;
                    
                    subscriptionInfo.innerHTML = `
                        <div class="alert alert-success">
                            <h5><i class="fas fa-crown me-2"></i>Abonnement Premium Actif</h5>
                            <p class="mb-1">Expire le <strong>${expiryDate}</strong></p>
                            <p class="mb-0 text-muted small">
                                <i class="fas fa-clock me-1"></i>${daysLeft} jour(s) restant(s)
                            </p>
                        </div>
                    `;
                    subscriptionInfo.style.display = 'block';
                }
            } else {
                if (premiumBadge) {
                    premiumBadge.style.display = 'none';
                }
                
                document.querySelectorAll('.subscribe-btn-direct, .subscribe-btn').forEach(btn => {
                    btn.style.display = 'inline-block';
                    
                    const card = btn.closest('.card');
                    if (card) {
                        const activeBadge = card.querySelector('.active-subscription-badge');
                        if (activeBadge) {
                            activeBadge.remove();
                        }
                    }
                });
                
                if (subscriptionInfo) {
                    subscriptionInfo.innerHTML = `
                        <div class="alert alert-info">
                            <h5><i class="fas fa-graduation-cap me-2"></i>Accédez à tous les quiz Premium</h5>
                            <p class="mb-0">Choisissez une formule d'abonnement pour débloquer l'accès complet</p>
                        </div>
                    `;
                    subscriptionInfo.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Erreur affichage info abonnement:', error);
        }
    }
    
    // ✅ VÉRIFIER L'ABONNEMENT UTILISATEUR
    async checkUserSubscription() {
        try {
            if (!this.auth.isAuthenticated()) return null;
            
            const token = this.auth.getToken();
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/payment/subscription/info`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.success ? data.subscription : null;
            }
            return null;
        } catch (error) {
            console.error('Erreur vérification abonnement:', error);
            return null;
        }
    }
    
    // ✅ AFFICHER UNE ALERTE
    showAlert(message, type) {
        document.querySelectorAll('.global-alert').forEach(alert => alert.remove());
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show global-alert`;
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        let icon = '';
        switch(type) {
            case 'success': icon = '<i class="fas fa-check-circle me-2"></i>'; break;
            case 'danger': icon = '<i class="fas fa-times-circle me-2"></i>'; break;
            case 'warning': icon = '<i class="fas fa-exclamation-triangle me-2"></i>'; break;
            case 'info': icon = '<i class="fas fa-info-circle me-2"></i>'; break;
        }
        
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">
                    ${icon}${message}
                </div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.classList.remove('show');
                    setTimeout(() => alertDiv.remove(), 150);
                }
            }, 5000);
        }
    }
}

// ✅ INITIALISATION AUTOMATIQUE
document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Initialisation du module Payment');
    try {
        window.payment = new Payment();
        console.log('✅ Module Payment initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur initialisation Payment:', error);
    }
});