import { CONFIG } from './config.js';

export class Payment {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Subscribe button
        document.getElementById('subscribe-btn').addEventListener('click', () => this.initiatePayment());
        
        // Validate code button
        document.getElementById('validate-code').addEventListener('click', () => this.validateAccessCode());
    }

    async initiatePayment() {
        if (!window.auth.isAuthenticated()) {
            alert('Veuillez vous connecter pour souscrire à un abonnement.');
            return;
        }

        try {
            const token = window.auth.getToken();
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

    async validateAccessCode() {
        const code = document.getElementById('accessCode').value;
        const email = window.auth.getUser().email;

        if (!code || code.length !== 6) {
            alert('Veuillez entrer un code valide à 6 chiffres.');
            return;
        }

        try {
            const token = window.auth.getToken();
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/payment/validate-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code, email })
            });

            const data = await response.json();

            if (data.success) {
                alert('Félicitations! Votre abonnement est maintenant activé.');
                // Close modal and refresh user data
                const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                codeModal.hide();
                window.location.reload();
            } else {
                alert('Code invalide: ' + data.message);
            }
        } catch (error) {
            console.error('Error validating code:', error);
            alert('Erreur lors de la validation du code');
        }
    }
}