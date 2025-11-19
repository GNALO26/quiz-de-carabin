export class KkiaPayWidget {
    constructor() {
        this.loadKkiaPayScript();
    }

    loadKkiaPayScript() {
        return new Promise((resolve, reject) => {
            if (window.Kkiapay) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.kkiapay.me/k.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Erreur chargement script KkiaPay'));
            document.head.appendChild(script);
        });
    }

    async initiatePayment(amount, email, phone, transactionId) {
        try {
            await this.loadKkiaPayScript();
            
            return new Promise((resolve, reject) => {
                const kkiapay = window.Kkiapay && window.Kkiapay.init(process.env.KKIAPAY_PUBLIC_KEY, {
                    amount: amount,
                    name: "Quiz de Carabin",
                    email: email,
                    phone: phone,
                    data: JSON.stringify({
                        transaction_id: transactionId,
                        user_email: email
                    }),
                    callback: `${window.location.origin}/payment-callback.html`,
                    theme: "#13a718",
                    position: "center",
                    sandbox: process.env.NODE_ENV === 'development'
                });

                if (!kkiapay) {
                    reject(new Error('KkiaPay widget non initialisé'));
                    return;
                }

                kkiapay.open();
                
                // Écouter les événements
                window.addEventListener('message', (event) => {
                    if (event.data.from === 'kkiapay_widget') {
                        switch (event.data.message) {
                            case 'payment_success':
                                resolve({
                                    success: true,
                                    transactionId: event.data.transaction_id
                                });
                                break;
                            case 'payment_failed':
                                reject(new Error('Paiement échoué'));
                                break;
                            case 'payment_canceled':
                                reject(new Error('Paiement annulé'));
                                break;
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Erreur widget KkiaPay:', error);
            throw error;
        }
    }
}