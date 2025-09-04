class Payment {
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
        if (!auth.isAuthenticated()) {
            alert('Veuillez vous connecter pour souscrire à un abonnement.');
            return;
        }

        try {
            const token = auth.getToken();
            const response = await fetch(`${API_BASE_URL}/api/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    callback_url: `${window.location.origin}/payment-callback.html`
                })
            });

            const data = await response.json();

            if (data.success) {
                // Redirect to Paydunya payment page
                window.location.href = data.invoiceURL;
            } else {
                alert('Erreur lors de l\'initialisation du paiement');
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
        }
    }

    async validateAccessCode() {
        const code = document.getElementById('accessCode').value;
        const user = auth.getUser();

        if (!code || code.length !== 6) {
            alert('Veuillez entrer un code valide à 6 chiffres.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/payment/validate-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code,
                    email: user.email
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Félicitations! Votre abonnement premium est maintenant activé.');
                // Refresh user data
                auth.user.isPremium = true;
                localStorage.setItem('quizUser', JSON.stringify(auth.user));
                // Close modal
                const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                codeModal.hide();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Error validating access code:', error);
        }
    }
}

const payment = new Payment();