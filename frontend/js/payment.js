import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Payment {
    constructor() {
        this.auth = new Auth();
        this.setupEventListeners();
        this.checkPaymentReturn();
        this.displaySubscriptionInfo();
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
        
        // Écouteurs pour paiements directs (nouveaux boutons)
        document.querySelectorAll('.subscribe-btn-direct').forEach(button => {
            button.addEventListener('click', (e) => {
                const planKey = e.currentTarget.getAttribute('data-plan-key');
                console.log(`🖱 Clic sur bouton DIRECT: ${planKey}`);
                this.initiateDirectPayment(planKey);
            });
        });
        
        // Écouteurs pour paiements widget (boutons existants)
        document.querySelectorAll('.subscribe-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const planId = e.currentTarget.getAttribute('data-plan-id');
                const amount = e.currentTarget.getAttribute('data-plan-price');
                console.log(`🖱 Clic sur bouton WIDGET: ${planId} - ${amount} FCFA`);
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
            this.processPaymentReturn();
        }
    }

    // ✅ NOUVELLE MÉTHODE POUR PAIEMENTS DIRECTS
    async initiateDirectPayment(planKey) {
        try {
            console.log(`💰 Initialisation paiement DIRECT: ${planKey}`);
            
            if (!this.auth.isAuthenticated()) {
                this.auth.showLoginModal();
                this.showAlert('Veuillez vous connecter pour vous abonner', 'warning');
                return;
            }

            const token = this.auth.getToken();
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            console.log('📤 Envoi requête vers:', `${API_BASE_URL}/api/payment/direct/initiate`);
            console.log('🔑 Token présent:', !!token);
            console.log('📦 Données envoyées:', { planKey });

            // Afficher le loading
            this.showAlert('Préparation du paiement...', 'info');
            
            const response = await fetch(`${API_BASE_URL}/api/payment/direct/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ planKey })
            });

            console.log('📨 Statut réponse:', response.status);
            
            if (!response.ok) {
                // Obtenir le détail de l'erreur
                const errorText = await response.text();
                console.error('❌ Détail erreur:', errorText);
                
                let errorMessage = `Erreur HTTP ${response.status}`;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('✅ Réponse paiement direct:', data);

            if (data.success && data.paymentUrl) {
                // Stocker l'ID de transaction pour vérification ultérieure
                localStorage.setItem('pendingTransaction', data.transactionId);
                
                // Redirection vers le lien direct KkiaPay
                this.showAlert('Redirection vers la page de paiement sécurisée...', 'success');
                setTimeout(() => {
                    window.location.href = data.paymentUrl;
                }, 2000);
            } else {
                throw new Error(data.message || 'Erreur lors de la génération du lien de paiement');
            }

        } catch (error) {
            console.error('💥 Erreur paiement direct:', error);
            this.showAlert(`Erreur: ${error.message}`, 'danger');
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
                console.log('✅ Transaction créée, redirection vers KkiaPay...');
                
                // Stocker l'ID de transaction pour le callback
                localStorage.setItem('pendingTransaction', data.transactionId);
                
                // ✅ CORRECTION: Redirection directe vers KkiaPay
                await this.redirectToKkiaPay(parseInt(amount), user, data.transactionId);
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

    // ✅ CORRECTION: Redirection améliorée vers KkiaPay
async redirectToKkiaPay(amount, user, transactionId) {
    try {
        console.log('🎯 Redirection vers KkiaPay...');
        
        // Construction de l'URL de paiement KkiaPay
        const baseUrl = 'https://kkiapay.me';
        
        // ✅ CORRECTION IMPORTANTE: URL de callback qui redirige vers NOTRE site
        const callbackUrl = `${window.location.origin}/payment-callback.html?transactionId=${transactionId}&success=true`;
        
        const paymentParams = new URLSearchParams({
            amount: amount,
            apikey: '2c79c85d47f4603c5c9acc9f9ca7b8e32d65c751',
            phone: user.phone || '+2290156035888',
            email: user.email,
            callback: callbackUrl, // ✅ URL de retour APRÈS paiement
            data: JSON.stringify({
                transaction_id: transactionId,
                user_id: user._id,
                user_email: user.email,
                plan: 'quiz-premium'
            }),
            theme: '#13a718',
            name: 'Quiz de Carabin',
            sandbox: 'false'
        });

        const paymentUrl = `${baseUrl}/pay?${paymentParams.toString()}`;
        
        console.log('🔗 URL de paiement générée:', paymentUrl);
        console.log('🔄 URL de callback:', callbackUrl);
        
        this.showAlert('Redirection vers la page de paiement sécurisée KkiaPay...', 'success');
        
        // Redirection IMMÉDIATE
        console.log('🚀 Redirection vers KkiaPay...');
        window.location.href = paymentUrl;
        
    } catch (error) {
        console.error('❌ Erreur redirection KkiaPay:', error);
        
        // ✅ SECOURS : URL de secours
        this.showAlert('Redirection vers le paiement...', 'info');
        const fallbackUrl = `https://kkiapay.me/pay?amount=${amount}&apikey=2c79c85d47f4603c5c9acc9f9ca7b8e32d65c751&callback=${encodeURIComponent(window.location.origin + '/payment-callback.html?transactionId=' + transactionId)}`;
        window.location.href = fallbackUrl;
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

            if (!response.ok) {
                throw new Error(`Erreur serveur (${response.status})`);
            }

            const data = await response.json();
            console.log('📨 Réponse process-return PRODUCTION:', data);

            if (data.success) {
                if (data.status === 'completed') {
                    this.showPaymentSuccess(data.accessCode, data.user, data.subscriptionEnd);
                    localStorage.removeItem('pendingTransaction');
                    
                    // Mettre à jour l'interface utilisateur
                    if (data.user) {
                        localStorage.setItem('quizUser', JSON.stringify(data.user));
                        this.auth.user = data.user;
                        this.auth.updateUI();
                        this.displaySubscriptionInfo();
                    }
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

    showPaymentSuccess(accessCode, user, subscriptionEnd) {
        const statusElement = document.getElementById('payment-status');
        if (statusElement) {
            const expiryDate = subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString('fr-FR') : 'date inconnue';
            
            statusElement.innerHTML = `
                <div class="alert alert-success">
                    <h4>✅ Paiement Réussi!</h4>
                    <p>Votre abonnement premium a été activé avec succès.</p>
                    <p><strong>Date d'expiration : ${expiryDate}</strong></p>
                    <div class="access-code my-3">
                        <strong>Votre code d'accès:</strong>
                        <div class="h4 text-primary">${accessCode}</div>
                    </div>
                    <p>Un email de confirmation vous a été envoyé.</p>
                    <div class="mt-3">
                        <button onclick="window.location.href = '/quiz.html'" class="btn btn-success me-2">
                            <i class="fas fa-play me-1"></i>Commencer les quiz
                        </button>
                        <button onclick="window.location.href = '/index.html'" class="btn btn-outline-secondary">
                            <i class="fas fa-home me-1"></i>Retour à l'accueil
                        </button>
                    </div>
                </div>
            `;
        }

        // Mettre à jour l'utilisateur dans le localStorage
        if (user) {
            localStorage.setItem('quizUser', JSON.stringify(user));
            this.auth.user = user;
            this.auth.updateUI();
            this.displaySubscriptionInfo();
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
                    <div class="mt-3">
                        <button onclick="window.location.href = '/index.html'" class="btn btn-primary me-2">
                            <i class="fas fa-home me-1"></i>Retour à l'accueil
                        </button>
                        <button onclick="location.reload()" class="btn btn-outline-secondary">
                            <i class="fas fa-sync me-1"></i>Actualiser
                        </button>
                    </div>
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
                    <div class="mt-3">
                        <button onclick="window.location.href = '/quiz.html'" class="btn btn-primary me-2">
                            <i class="fas fa-credit-card me-1"></i>Réessayer le paiement
                        </button>
                        <button onclick="window.location.href = '/index.html'" class="btn btn-outline-secondary">
                            <i class="fas fa-home me-1"></i>Retour à l'accueil
                        </button>
                    </div>
                    <div class="mt-3">
                        <p class="text-muted small">
                            Si le problème persiste, contactez le support: 
                            <br>📧 support@quizdecarabin.bj
                            <br>📱 +229 53 91 46 48
                        </p>
                    </div>
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
    // ✅ NOUVELLE MÉTHODE POUR AFFICHER LES INFORMATIONS D'ABONNEMENT
    async displaySubscriptionInfo() {
        try {
            if (!this.auth.isAuthenticated()) return;
            
            const subscription = await this.checkUserSubscription();
            const premiumBadge = document.getElementById('premium-badge');
            const subscriptionInfo = document.getElementById('subscription-info');
            
            if (subscription && subscription.hasActiveSubscription) {
                // Utilisateur a un abonnement actif
                if (premiumBadge) {
                    premiumBadge.style.display = 'inline';
                    premiumBadge.textContent = 'Premium Actif';
                    
                    // Ajouter la date d'expiration si disponible
                    if (subscription.premiumExpiresAt) {
                        const expiryDate = new Date(subscription.premiumExpiresAt).toLocaleDateString('fr-FR');
                        premiumBadge.title = `Expire le ${expiryDate}`;
                    }
                }
                
                // Masquer les boutons d'abonnement ou afficher un message
                document.querySelectorAll('.subscribe-btn-direct, .subscribe-btn').forEach(btn => {
                    btn.style.display = 'none';
                });
                
                // Afficher un message d'abonnement actif
                if (subscriptionInfo) {
                    const expiryDate = subscription.premiumExpiresAt ? 
                        new Date(subscription.premiumExpiresAt).toLocaleDateString('fr-FR') : 'date inconnue';
                    
                    subscriptionInfo.innerHTML = `
                        <div class="alert alert-success">
                            <i class="fas fa-crown me-2"></i>
                            <strong>Abonnement Premium Actif</strong>
                            <br>Votre abonnement est valide jusqu'au ${expiryDate}
                        </div>
                    `;
                    subscriptionInfo.style.display = 'block';
                }
            } else {
                // Utilisateur n'a pas d'abonnement actif
                if (premiumBadge) {
                    premiumBadge.style.display = 'none';
                }
                
                // Afficher les boutons d'abonnement
                document.querySelectorAll('.subscribe-btn-direct, .subscribe-btn').forEach(btn => {
                    btn.style.display = 'inline-block';
                });
                
                if (subscriptionInfo) {
                    subscriptionInfo.innerHTML = `
                        <div class="alert alert-info">
                            <i class="fas fa-graduation-cap me-2"></i>
                            <strong>Accédez à tous les quiz Premium</strong>
                            <br>Choisissez une formule d'abonnement pour débloquer l'accès complet
                        </div>
                    `;
                    subscriptionInfo.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Erreur affichage info abonnement:', error);
        }
    }
    
    // ✅ NOUVELLE MÉTHODE POUR VÉRIFIER L'ABONNEMENT UTILISATEUR
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
    
    showAlert(message, type) {
        document.querySelectorAll('.global-alert').forEach(alert => alert.remove());
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show global-alert`;
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.right = '20px';
        alertDiv.style.zIndex = '9999';
        alertDiv.style.minWidth = '300px';
        alertDiv.style.maxWidth = '500px';
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">
                    ${message}
                </div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-suppression après 5 secondes pour les alertes de succès/info
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 5000);
        }
    }
}

// Initialisation PRODUCTION
document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Initialisation du module Payment PRODUCTION...');
    try {
        window.payment = new Payment();
        console.log('✅ Module Payment initialisé avec succès - MODE PRODUCTION');
        
        // Vérifier si on est sur la page de callback
        if (window.location.pathname.includes('payment-callback.html')) {
            console.log('🔍 Page de callback détectée, traitement automatique...');
        }
    } catch (error) {
        console.error('❌ Erreur initialisation Payment PRODUCTION:', error);
    }
});