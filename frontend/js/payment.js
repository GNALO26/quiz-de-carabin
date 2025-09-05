import { CONFIG } from './config.js';

export class Payment {
    constructor() {
        // Initialisation
    }

    async initiatePayment() {
        try {
            const token = window.auth.getToken();
            if (!token) {
                alert('Vous devez vous connecter pour souscrire à un abonnement.');
                return;
            }

            const response = await fetch(`${CONFIG.API_BASE_URL}/api/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    callback_url: `${CONFIG.FRONTEND_URL}/payment-callback.html`
                })
            });

            const data = await response.json();

            if (data.success) {
                // Redirection vers PayDunya
                window.location.href = data.invoiceURL;
            } else {
                alert('Erreur lors de l\'initiation du paiement: ' + data.message);
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            alert('Erreur lors de l\'initiation du paiement');
        }
    }

    async validateAccessCode(code, email) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/payment/validate-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code, email }),
            });

            const data = await response.json();

            if (data.success) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Error validating access code:', error);
            return { success: false, message: 'Erreur de validation du code' };
        }
    }
}