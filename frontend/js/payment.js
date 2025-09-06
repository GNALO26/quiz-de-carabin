import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Payment {
    constructor() {
        this.auth = new Auth();
    }

    async initiatePayment() {
        try {
            console.log('Initialisation du paiement...');
            
            // Vérifier si l'utilisateur est connecté
            if (!this.auth.isAuthenticated()) {
                this.auth.showLoginModal();
                this.showAlert('Veuillez vous connecter pour vous abonner', 'warning');
                return;
            }

            const user = this.auth.getUser();
            const token = this.auth.getToken();
            
            console.log('Utilisateur:', user.email);
            
            // Obtenir l'URL active de l'API
            const API_BASE_URL = await this.getActiveAPIUrl();
            console.log('API URL:', API_BASE_URL);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${API_BASE_URL}/api/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    callback_url: `${CONFIG.FRONTEND_URL}/payment-callback.html`
                }),
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
            console.log('Réponse paiement:', data);

            if (data.success && data.invoiceURL) {
                // Redirection vers PayDunya
                window.location.href = data.invoiceURL;
            } else {
                this.showAlert('Erreur lors de l\'initiation du paiement: ' + (data.message || 'Erreur inconnue'), 'danger');
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            
            if (error.name === 'AbortError') {
                this.showAlert('Le serveur ne répond pas. Veuillez réessayer plus tard.', 'danger');
            } else if (error.message.includes('Failed to fetch')) {
                this.showAlert('Impossible de se connecter au serveur. Vérifiez votre connexion internet.', 'danger');
            } else {
                this.showAlert('Erreur lors de l\'initiation du paiement: ' + error.message, 'danger');
            }
        }
    }

    async validateAccessCode(code, email) {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/payment/validate-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code, email })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error validating access code:', error);
            return { 
                success: false, 
                message: 'Erreur lors de la validation du code' 
            };
        }
    }

    async getActiveAPIUrl() {
        // Test de la connexion à l'URL principale
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
        
        // Fallback sur l'URL de secours
        return CONFIG.API_BACKUP_URL;
    }

    showAlert(message, type) {
        // Remove existing alerts
        document.querySelectorAll('.global-alert').forEach(alert => alert.remove());
        
        // Create alert element
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
        
        // Add to page
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }
}