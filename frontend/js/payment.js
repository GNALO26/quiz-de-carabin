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
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`);
            if (response.ok) return CONFIG.API_BASE_URL;
        } catch (error) {
            console.warn('URL principale inaccessible:', error.message);
        }
        return CONFIG.API_BACKUP_URL;
    }

    setupEventListeners() {
        console.log('🎯 Initialisation écouteurs paiement PRODUCTION');
        
        // Boutons d'abonnement
        document.querySelectorAll('.subscribe-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const planId = e.currentTarget.getAttribute('data-plan-id');
                const amount = e.currentTarget.getAttribute('data-plan-price');
                console.log(`🖱 Clic bouton: ${planId} - ${amount}F`);
                this.initiatePayment(planId, amount);
            });
        });

        // Validation code d'accès
        document.getElementById('validate-code')?.addEventListener('click', () => {
            this.validateAccessCode();
        });

        // Renvoi code d'accès
        document.getElementById('resend-code')?.addEventListener('click', () => {
            this.resendAccessCode();
        });
    }

    checkPaymentReturn() {
        const urlParams = new URLSearchParams(window.location.search);
        const transactionId = urlParams.get('transactionId');
        
        if (transactionId && window.location.pathname.includes('payment-callback.html')) {
            console.log('🔄 Détection retour paiement:', transactionId);
            this.processPaymentReturn(transactionId);
        }
    }

    // 🎯 FONCTION : INITIER UN PAIEMENT
    async initiatePayment(planId, amount) {
        try {
            console.log(`💰 Initialisation paiement: ${planId} - ${amount}F`);
            
            // Vérifier authentification
            if (!this.auth.isAuthenticated()) {
                this.auth.showLoginModal();
                this.showAlert('Veuillez vous connecter pour vous abonner', 'warning');
                return;
            }

            const user = this.auth.getUser();
            const token = this.auth.getToken();
            const API_BASE_URL = await this.getActiveAPIUrl();

            // Mettre le bouton en état de chargement
            const button = document.querySelector(`[data-plan-id="${planId}"]`);
            this.setButtonLoading(button, true);

            console.log('📤 Envoi requête création paiement...');
            const response = await fetch(`${API_BASE_URL}/api/payment/create`, {
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
                const errorText = await response.text();
                throw new Error(`Erreur ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Réponse création paiement:', data);

            if (data.success && data.paymentUrl) {
                // Sauvegarder l'ID de transaction
                localStorage.setItem('pendingTransaction', data.transactionId);
                console.log('💾 Transaction sauvegardée:', data.transactionId);
                
                // Redirection vers KkiaPay
                this.showAlert('Redirection vers la page de paiement sécurisée...', 'success');
                
                setTimeout(() => {
                    console.log('🚀 Redirection vers KkiaPay...');
                    window.location.href = data.paymentUrl;
                }, 1500);
                
            } else {
                throw new Error(data.message || 'Erreur lors de la création du paiement');
            }

        } catch (error) {
            console.error('💥 Erreur initiation paiement:', error);
            this.showAlert(`Erreur: ${error.message}`, 'danger');
            
            // Restaurer le bouton
            const button = document.querySelector(`[data-plan-id="${planId}"]`);
            this.setButtonLoading(button, false);
        }
    }

    // 🎯 FONCTION : TRAITER LE RETOUR DE PAIEMENT
    async processPaymentReturn(transactionId) {
        try {
            console.log('🔄 Traitement retour paiement:', transactionId);

            if (!this.auth.isAuthenticated()) {
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }

            const token = this.auth.getToken();
            const API_BASE_URL = await this.getActiveAPIUrl();

            const response = await fetch(`${API_BASE_URL}/api/payment/check-status`, {
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
            console.log('📨 Réponse statut:', data);

            if (data.success) {
                if (data.status === 'completed') {
                    this.showPaymentSuccess(data);
                    localStorage.removeItem('pendingTransaction');
                } else {
                    this.showPaymentPending(data.message);
                }
            } else {
                throw new Error(data.message || 'Erreur lors de la vérification');
            }

        } catch (error) {
            console.error('❌ Erreur traitement retour:', error);
            this.showPaymentError(error.message);
        }
    }

    // 🎯 FONCTION : AFFICHER SUCCÈS PAIEMENT
    showPaymentSuccess(data) {
        const statusElement = document.getElementById('payment-status');
        if (!statusElement) return;

        const expiryDate = data.subscriptionEnd ? 
            new Date(data.subscriptionEnd).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : 'date inconnue';

        statusElement.innerHTML = `
            <div class="alert alert-success border-0">
                <div class="d-flex align-items-center">
                    <i class="fas fa-check-circle fa-3x text-success me-3"></i>
                    <div>
                        <h4 class="alert-heading mb-2">✅ Paiement Réussi !</h4>
                        <p class="mb-1">Votre abonnement premium a été activé avec succès.</p>
                        <p class="mb-2"><strong>Date d'expiration : ${expiryDate}</strong></p>
                    </div>
                </div>
                
                <div class="mt-4 p-3 bg-light rounded">
                    <h5 class="text-center mb-3">🔐 Votre Code d'Accès</h5>
                    <div class="text-center">
                        <div class="display-4 fw-bold text-primary font-monospace">${data.accessCode}</div>
                        <p class="text-muted mt-2">Ce code a été envoyé à votre adresse email</p>
                    </div>
                </div>

                <div class="mt-4 text-center">
                    <button onclick="window.location.href='/quiz.html'" class="btn btn-success btn-lg me-3">
                        <i class="fas fa-play me-2"></i>Commencer les Quiz
                    </button>
                    <button onclick="window.location.href='/index.html'" class="btn btn-outline-secondary">
                        <i class="fas fa-home me-2"></i>Retour à l'Accueil
                    </button>
                </div>
            </div>
        `;

        // Mettre à jour l'interface utilisateur
        if (data.user) {
            localStorage.setItem('quizUser', JSON.stringify(data.user));
            this.auth.user = data.user;
            this.auth.updateUI();
            this.displaySubscriptionInfo();
        }
    }

    // 🎯 FONCTION : AFFICHER EN ATTENTE
    showPaymentPending(message) {
        const statusElement = document.getElementById('payment-status');
        if (!statusElement) return;

        statusElement.innerHTML = `
            <div class="alert alert-warning border-0">
                <div class="d-flex align-items-center">
                    <i class="fas fa-clock fa-3x text-warning me-3"></i>
                    <div>
                        <h4 class="alert-heading mb-2">⏳ Paiement en Cours</h4>
                        <p class="mb-0">${message}</p>
                    </div>
                </div>
                
                <div class="mt-4">
                    <div class="progress mb-3">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" style="width: 100%"></div>
                    </div>
                    <p class="text-muted text-center">Vérification automatique en cours...</p>
                </div>

                <div class="mt-3 text-center">
                    <button onclick="location.reload()" class="btn btn-primary me-2">
                        <i class="fas fa-sync me-1"></i>Actualiser
                    </button>
                    <button onclick="window.location.href='/index.html'" class="btn btn-outline-secondary">
                        <i class="fas fa-home me-1"></i>Accueil
                    </button>
                </div>
            </div>
        `;
    }

    // 🎯 FONCTION : AFFICHER ERREUR
    showPaymentError(message) {
        const statusElement = document.getElementById('payment-status');
        if (!statusElement) return;

        statusElement.innerHTML = `
            <div class="alert alert-danger border-0">
                <div class="d-flex align-items-center">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger me-3"></i>
                    <div>
                        <h4 class="alert-heading mb-2">❌ Erreur de Paiement</h4>
                        <p class="mb-0">${message}</p>
                    </div>
                </div>

                <div class="mt-4 text-center">
                    <button onclick="window.location.href='/quiz.html'" class="btn btn-primary me-2">
                        <i class="fas fa-credit-card me-1"></i>Réessayer le Paiement
                    </button>
                    <button onclick="window.location.href='/index.html'" class="btn btn-outline-secondary">
                        <i class="fas fa-home me-1"></i>Retour à l'Accueil
                    </button>
                </div>

                <div class="mt-4 p-3 bg-light rounded">
                    <h6 class="text-center mb-2">📞 Support Technique</h6>
                    <div class="text-center text-muted small">
                        <div>📧 support@quizdecarabin.bj</div>
                        <div>📱 +229 53 91 46 48</div>
                    </div>
                </div>
            </div>
        `;
    }

    // 🎯 FONCTION : VALIDER CODE D'ACCÈS
    async validateAccessCode() {
        try {
            const codeInput = document.getElementById('accessCode');
            const code = codeInput.value.trim();
            
            if (!code || code.length !== 6) {
                this.showAlert('Veuillez entrer un code valide à 6 chiffres', 'warning');
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
            this.setButtonLoading(validateButton, true);

            const response = await fetch(`${API_BASE_URL}/api/access-code/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            this.setButtonLoading(validateButton, false);

            if (response.status === 401) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                this.auth.logout();
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`errorData.message || Erreur ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert('✅ Code validé avec succès ! Accès premium activé.', 'success');
                
                if (data.user) {
                    localStorage.setItem('quizUser', JSON.stringify(data.user));
                    this.auth.user = data.user;
                    this.auth.updateUI();
                    this.displaySubscriptionInfo();
                }
                
                // Fermer le modal après succès
                setTimeout(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                    if (modal) modal.hide();
                    
                    if (window.location.pathname.includes('index.html')) {
                        window.location.reload();
                    }
                }, 2000);
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur validation code:', error);
            this.showAlert(`Erreur: ${error.message}`, 'danger');
        }
    }

    // 🎯 FONCTION : RENVOYER CODE D'ACCÈS
    async resendAccessCode() {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée. Veuillez vous reconnecter.', 'warning');
                return;
            }

            const resendButton = document.getElementById('resend-code');
            this.setButtonLoading(resendButton, true);

            const response = await fetch(`${API_BASE_URL}/api/payment/resend-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            this.setButtonLoading(resendButton, false);

            if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert('✅ Code d\'accès renvoyé avec succès à votre email', 'success');
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur renvoi code:', error);
            this.showAlert(`Erreur: ${error.message}`, 'danger');
        }
    }

    // 🎯 FONCTION : AFFICHER INFORMATIONS ABONNEMENT
    async displaySubscriptionInfo() {
        try {
            if (!this.auth.isAuthenticated()) return;
            
            const subscription = await this.getUserSubscription();
            const premiumBadge = document.getElementById('premium-badge');
            const subscriptionInfo = document.getElementById('subscription-info');
            
            if (subscription && subscription.hasActiveSubscription) {
                // Utilisateur premium
                if (premiumBadge) {
                    premiumBadge.style.display = 'inline';
                    premiumBadge.textContent = 'Premium Actif';
                    
                    if (subscription.premiumExpiresAt) {
                        const expiryDate = new Date(subscription.premiumExpiresAt).toLocaleDateString('fr-FR');
                        premiumBadge.title = `Expire le ${expiryDate}`;
                    }
                }
                
                // Masquer les boutons d'abonnement
                document.querySelectorAll('.subscribe-btn').forEach(btn => {
                    btn.style.display = 'none';
                });
                
                // Afficher les informations d'abonnement
                if (subscriptionInfo) {
                    const expiryDate = subscription.premiumExpiresAt ? 
                        new Date(subscription.premiumExpiresAt).toLocaleDateString('fr-FR') : 'date inconnue';
                    const daysLeft = subscription.daysRemaining > 0 ? subscription.daysRemaining : 0;
                    
                    subscriptionInfo.innerHTML = `
                        <div class="alert alert-success">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-crown fa-2x me-3"></i>
                                <div>
                                    <h5 class="mb-1">Abonnement Premium Actif</h5>
                                    <p class="mb-0">Valide jusqu'au <strong>${expiryDate}</strong></p>
                                    <small class="text-muted">${daysLeft} jours restants</small>
                                </div>
                            </div>
                        </div>
                    `;
                    subscriptionInfo.style.display = 'block';
                }
            } else {
                // Utilisateur non premium
                if (premiumBadge) {
                    premiumBadge.style.display = 'none';
                }
                
                // Afficher les boutons d'abonnement
                document.querySelectorAll('.subscribe-btn').forEach(btn => {
                    btn.style.display = 'inline-block';
                });
                
                if (subscriptionInfo) {
                    subscriptionInfo.innerHTML = `
                        <div class="alert alert-info">
                            <div class="d-flex align-items-center">
                                <i class="fas fa-graduation-cap fa-2x me-3"></i>
                                <div>
                                    <h5 class="mb-1">Accédez à tous les Quiz Premium</h5>
                                    <p class="mb-0">Choisissez une formule d'abonnement pour débloquer l'accès complet</p>
                                </div>
                            </div>
                        </div>
                    `;
                    subscriptionInfo.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Erreur affichage info abonnement:', error);
        }
    }
    
    // 🎯 FONCTION : OBtenir informations abonnement
    async getUserSubscription() {
        try {
            if (!this.auth.isAuthenticated()) return null;
            
            const token = this.auth.getToken();
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/payment/subscription-info`, {
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
            console.error('Erreur récupération abonnement:', error);
            return null;
        }
    }

    // 🛠 UTILITAIRES
    setButtonLoading(button, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Traitement...';
        } else {
            button.disabled = false;
            if (button.id === 'validate-code') {
                button.innerHTML = 'Valider le Code';
            } else if (button.id === 'resend-code') {
                button.innerHTML = 'Renvoyer le Code';
            } else {
                button.innerHTML = button.getAttribute('data-original-text') || 'S\'abonner';
            }
        }
    }

    showAlert(message, type) {
        // Supprimer les alertes existantes
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
        
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">${message}</div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-suppression après 5 secondes pour les succès/info
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
    console.log('💰 Initialisation module Payment PRODUCTION...');
    try {
        window.payment = new Payment();
        console.log('✅ Module Payment initialisé avec succès');
    } catch (error) {
        console.error('❌ Erreur initialisation Payment:', error);
    }
});