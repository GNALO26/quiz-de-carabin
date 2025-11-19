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
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache',
                timeout: 5000
            });
            
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
        
        // Boutons d'abonnement
        document.querySelectorAll('.subscribe-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const planId = e.currentTarget.getAttribute('data-plan-id');
                const amount = e.currentTarget.getAttribute('data-plan-price');
                console.log(`🖱 Clic sur abonnement: ${planId} - ${amount} FCFA`);
                this.initiatePayment(planId, amount);
            });
        });
        
        // Validation de code d'accès
        document.getElementById('validate-code')?.addEventListener('click', () => {
            this.validateAccessCode();
        });
        
        // Renvoi de code
        document.getElementById('resend-code')?.addEventListener('click', () => {
            this.resendAccessCode();
        });

        // Entrée dans le champ code
        document.getElementById('accessCode')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.validateAccessCode();
            }
        });
    }

    checkPaymentReturn() {
        // Vérifier si on est sur la page de callback
        if (window.location.pathname.includes('payment-callback.html')) {
            console.log('🔄 Page de callback détectée, traitement automatique...');
            this.processPaymentReturn();
        }
    }

    async initiatePayment(planId, amount) {
        try {
            console.log(`💰 Début processus paiement: ${planId} - ${amount} FCFA`);
            
            // Vérifier l'authentification
            if (!this.auth.isAuthenticated()) {
                this.auth.showLoginModal();
                this.showAlert('Veuillez vous connecter pour vous abonner', 'warning');
                return;
            }

            const user = this.auth.getUser();
            const token = this.auth.getToken();
            
            console.log('👤 Utilisateur:', user.email);
            
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            // Désactiver le bouton pendant le traitement
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"]`);
            const originalText = subscribeBtn.innerHTML;
            subscribeBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Traitement...';
            subscribeBtn.disabled = true;

            console.log('📤 Création de transaction...');
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
                const errorText = await response.text();
                throw new Error(`Erreur serveur (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            console.log('✅ Réponse transaction:', data);

            if (data.success && data.transactionId) {
                console.log('🎯 Redirection vers KkiaPay...');
                
                // Stocker la transaction en cours
                localStorage.setItem('pendingTransaction', data.transactionId);
                
                // Redirection vers KkiaPay
                this.redirectToKkiaPay(parseInt(amount), user, data.transactionId);
                
            } else {
                throw new Error(data.message || 'Erreur lors de la création du paiement');
            }
        } catch (error) {
            console.error('💥 Erreur initiatePayment:', error);
            this.showAlert('Erreur: ' + error.message, 'danger');
        } finally {
            // Réactiver le bouton
            const subscribeBtn = document.querySelector(`[data-plan-id="${planId}"]`);
            if (subscribeBtn) {
                subscribeBtn.innerHTML = 'S\'abonner';
                subscribeBtn.disabled = false;
            }
        }
    }

    // ✅ REDIRECTION VERS KKiaPay - APPROCHE AMÉLIORÉE
    redirectToKkiaPay(amount, user, transactionId) {
        try {
            console.log('🔗 Construction URL KkiaPay...');
            
            // URL de callback
            const callbackUrl = `${window.location.origin}/payment-callback.html?transactionId=${transactionId}`;
            
            // Paramètres de base
            const baseParams = {
                amount: amount,
                apikey: '2c79c85d47f4603c5c9acc9f9ca7b8e32d65c751',
                callback: callbackUrl,
                phone: user.phone || '+2290156035888',
                email: user.email,
                name: 'Quiz de Carabin',
                theme: '#13a718'
            };

            // Données supplémentaires
            const metadata = {
                transaction_id: transactionId,
                user_id: user._id,
                user_email: user.email,
                plan: 'premium'
            };

            // Construction de l'URL
            const params = new URLSearchParams();
            Object.keys(baseParams).forEach(key => {
                if (baseParams[key]) {
                    params.append(key, baseParams[key]);
                }
            });
            params.append('data', JSON.stringify(metadata));

            const paymentUrl = `https://kkiapay.me/pay?${params.toString()}`;
            
            console.log('🌐 URL de paiement:', paymentUrl);
            
            // Afficher un message de confirmation
            this.showAlert(`
                <div class="text-center">
                    <h5>🎯 Redirection vers KkiaPay</h5>
                    <p>Vous serez redirigé vers la page de paiement sécurisée...</p>
                    <p><strong>Montant:</strong> ${amount} FCFA</p>
                    <div class="spinner-border text-primary mt-2"></div>
                </div>
            `, 'info');

            // Redirection après 2 secondes
            setTimeout(() => {
                console.log('🚀 Redirection vers KkiaPay...');
                window.location.href = paymentUrl;
            }, 2000);

        } catch (error) {
            console.error('❌ Erreur redirection:', error);
            
            // ✅ SECOURS : Formulaire de paiement alternatif
            this.showKkiaPayFallback(amount, user, transactionId);
        }
    }

    // ✅ SECOURS : Formulaire alternatif
    showKkiaPayFallback(amount, user, transactionId) {
        console.log('🔄 Lancement secours formulaire...');
        
        const callbackUrl = `${window.location.origin}/payment-callback.html?transactionId=${transactionId}`;
        
        const fallbackHTML = `
            <div class="modal fade" id="kkiapayFallbackModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Paiement KkiaPay</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body text-center">
                            <p>🔄 Redirection échouée. Veuillez cliquer sur le bouton ci-dessous :</p>
                            <a href="https://kkiapay.me/pay?amount=${amount}&apikey=2c79c85d47f4603c5c9acc9f9ca7b8e32d65c751&callback=${encodeURIComponent(callbackUrl)}" 
                               class="btn btn-success btn-lg" target="_blank">
                                🎯 Payer avec KkiaPay
                            </a>
                            <p class="mt-3 text-muted small">
                                Une nouvelle fenêtre s'ouvrira pour le paiement.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Ajouter le modal au DOM
        document.body.insertAdjacentHTML('beforeend', fallbackHTML);
        
        // Afficher le modal
        const modal = new bootstrap.Modal(document.getElementById('kkiapayFallbackModal'));
        modal.show();
        
        // Nettoyer après fermeture
        document.getElementById('kkiapayFallbackModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async processPaymentReturn() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const transactionId = urlParams.get('transactionId') || localStorage.getItem('pendingTransaction');
            
            if (!transactionId) {
                throw new Error('Aucun ID de transaction trouvé');
            }

            console.log('🔄 Vérification statut paiement:', transactionId);

            const token = this.auth.getToken();
            if (!token) {
                // Rediriger vers la connexion
                window.location.href = 'index.html?message=Veuillez vous reconnecter pour vérifier votre paiement';
                return;
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
            console.log('📊 Statut paiement:', data);

            if (data.success) {
                if (data.status === 'completed') {
                    this.showPaymentSuccess(data.accessCode, data.user);
                    localStorage.removeItem('pendingTransaction');
                } else {
                    this.showPaymentPending();
                }
            } else {
                throw new Error(data.message || 'Erreur lors de la vérification');
            }
        } catch (error) {
            console.error('❌ Erreur vérification paiement:', error);
            this.showPaymentError(error.message);
        }
    }

    showPaymentSuccess(accessCode, user) {
        const statusElement = document.getElementById('payment-status');
        if (!statusElement) return;

        statusElement.innerHTML = `
            <div class="alert alert-success">
                <div class="text-center">
                    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <h3>Paiement Réussi !</h3>
                    <p class="lead">Votre abonnement premium est maintenant actif.</p>
                    
                    <div class="card mt-4">
                        <div class="card-body">
                            <h5 class="card-title">Votre code d'accès</h5>
                            <div class="display-4 text-primary font-weight-bold my-3">${accessCode}</div>
                            <p class="text-muted">Ce code a été envoyé à votre email</p>
                        </div>
                    </div>
                    
                    <div class="mt-4">
                        <a href="quiz.html" class="btn btn-success btn-lg me-3">
                            <i class="fas fa-play me-2"></i>Commencer les quiz
                        </a>
                        <a href="index.html" class="btn btn-outline-secondary">
                            <i class="fas fa-home me-2"></i>Retour à l'accueil
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Mettre à jour l'utilisateur
        if (user) {
            localStorage.setItem('quizUser', JSON.stringify(user));
            this.auth.user = user;
            this.auth.updateUI();
        }
    }

    showPaymentPending() {
        const statusElement = document.getElementById('payment-status');
        if (!statusElement) return;

        statusElement.innerHTML = `
            <div class="alert alert-warning">
                <div class="text-center">
                    <i class="fas fa-clock fa-3x text-warning mb-3"></i>
                    <h3>Paiement en Cours</h3>
                    <p>Votre paiement est en cours de traitement.</p>
                    <p class="text-muted">Vous recevrez un email de confirmation sous peu.</p>
                    
                    <div class="mt-4">
                        <button onclick="location.reload()" class="btn btn-primary me-2">
                            <i class="fas fa-sync me-2"></i>Actualiser
                        </button>
                        <a href="index.html" class="btn btn-outline-secondary">
                            <i class="fas fa-home me-2"></i>Accueil
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    showPaymentError(message) {
        const statusElement = document.getElementById('payment-status');
        if (!statusElement) return;

        statusElement.innerHTML = `
            <div class="alert alert-danger">
                <div class="text-center">
                    <i class="fas fa-times-circle fa-3x text-danger mb-3"></i>
                    <h3>Erreur de Paiement</h3>
                    <p>${message}</p>
                    
                    <div class="mt-4">
                        <a href="quiz.html" class="btn btn-primary me-2">
                            <i class="fas fa-credit-card me-2"></i>Réessayer
                        </a>
                        <a href="index.html" class="btn btn-outline-secondary">
                            <i class="fas fa-home me-2"></i>Accueil
                        </a>
                    </div>
                    
                    <div class="mt-4 p-3 bg-light rounded">
                        <p class="small text-muted mb-1">Besoin d'aide ? Contactez-nous :</p>
                        <p class="mb-1">
                            <i class="fas fa-envelope me-2"></i>support@quizdecarabin.bj
                        </p>
                        <p class="mb-0">
                            <i class="fab fa-whatsapp me-2"></i>+229 53 91 46 48
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    async validateAccessCode() {
        try {
            const codeInput = document.getElementById('accessCode');
            const code = codeInput?.value.trim();
            
            if (!code || code.length < 5) {
                this.showAlert('Veuillez entrer un code valide', 'warning');
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée', 'warning');
                this.auth.logout();
                return;
            }
            
            const validateButton = document.getElementById('validate-code');
            if (validateButton) {
                const originalText = validateButton.innerHTML;
                validateButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Validation...';
                validateButton.disabled = true;
            }

            const response = await fetch(`${API_BASE_URL}/api/access-code/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            if (validateButton) {
                validateButton.innerHTML = 'Valider';
                validateButton.disabled = false;
            }

            if (response.status === 401) {
                this.showAlert('Session expirée', 'warning');
                this.auth.logout();
                return;
            }

            if (!response.ok) {
                throw new Error(`Erreur serveur (${response.status})`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert('✅ Code validé avec succès !', 'success');
                
                if (data.user) {
                    localStorage.setItem('quizUser', JSON.stringify(data.user));
                    this.auth.user = data.user;
                    this.auth.updateUI();
                }
                
                // Fermer le modal après succès
                setTimeout(() => {
                    const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                    if (codeModal) {
                        codeModal.hide();
                    }
                    // Recharger si sur la page d'accueil
                    if (window.location.pathname.includes('index.html')) {
                        window.location.reload();
                    }
                }, 2000);
            } else {
                this.showAlert(data.message, 'danger');
            }
        } catch (error) {
            console.error('💥 Erreur validation:', error);
            this.showAlert('Erreur: ' + error.message, 'danger');
        }
    }

    async resendAccessCode() {
        try {
            const token = this.auth.getToken();
            
            if (!token) {
                this.showAlert('Session expirée', 'warning');
                return;
            }
            
            const resendBtn = document.getElementById('resend-code');
            if (resendBtn) {
                const originalText = resendBtn.innerHTML;
                resendBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Envoi...';
                resendBtn.disabled = true;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/payment/resend-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (resendBtn) {
                resendBtn.innerHTML = 'Renvoyer le code';
                resendBtn.disabled = false;
            }

            if (!response.ok) {
                throw new Error(`Erreur serveur (${response.status})`);
            }

            const data = await response.json();

            if (data.success) {
                this.showAlert('📧 Code renvoyé avec succès !', 'success');
            } else {
                this.showAlert(data.message || 'Erreur lors de l\'envoi', 'danger');}
        } catch (error) {
            console.error('💥 Erreur renvoi:', error);
            this.showAlert('Erreur: ' + error.message, 'danger');
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
        `;
        
        alertDiv.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-grow-1">${message}</div>
                <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto-suppression après 5 secondes
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 5000);
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Initialisation module Payment...');
    try {
        window.payment = new Payment();
        console.log('✅ Module Payment initialisé');
    } catch (error) {
        console.error('❌ Erreur initialisation Payment:', error);
    }
});