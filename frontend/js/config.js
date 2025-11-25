// ✅ CONFIGURATION DE L'APPLICATION
export const CONFIG = {
    // URLs de l'API
    API_BASE_URL: 'https://quiz-de-carabin-backend.onrender.com',
    API_BACKUP_URL: 'https://quiz-de-carabin-backend.onrender.com',
    
    // Pages de l'application
    PAGES: {
        INDEX: '/index.html',
        QUIZ: '/quiz.html',
        ABOUT: '/about.html',
        FORGOT_PASSWORD: '/forgot-password.html',
        RESET_PASSWORD: '/reset-password.html',
        ACCESS_CODE: '/access-code.html',
        PAYMENT_CALLBACK: '/payment-callback.html',
        PAYMENT_ERROR: '/payment-error.html'
    },
    
    // Configuration KkiaPay
    KKIAPAY: {
        PUBLIC_KEY: '2c79c85d47f4603c5c9acc9f9ca7b8e32d65c751',
        SANDBOX: false,
        THEME: '#13a718'
    },
    
    // Plans d'abonnement
    SUBSCRIPTION_PLANS: {
        '1-month': {
            name: 'Abonnement 1 mois',
            amount: 5000,
            duration: 1,
            description: 'Accès premium pour 1 mois'
        },
        '3-months': {
            name: 'Abonnement 3 mois',
            amount: 12000,
            duration: 3,
            description: 'Accès premium pour 3 mois',
            popular: true
        },
        '10-months': {
            name: 'Abonnement 10 mois',
            amount: 25000,
            duration: 10,
            description: 'Accès premium pour 10 mois',
            bestValue: true
        }
    },
    
    // Timeouts et délais
    TIMEOUTS: {
        API_CALL: 30000, // 30 secondes
        PAYMENT_VERIFICATION: 120000, // 2 minutes
        SESSION_CHECK: 60000 // 1 minute
    },
    
    // Messages
    MESSAGES: {
        CONNECTION_ERROR: 'Erreur de connexion. Vérifiez votre connexion internet.',
        SESSION_EXPIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
        PAYMENT_SUCCESS: 'Paiement réussi! Votre abonnement a été activé.',
        PAYMENT_PENDING: 'Paiement en cours de traitement. Vous recevrez un email de confirmation.',
        PAYMENT_FAILED: 'Le paiement a échoué. Veuillez réessayer.',
        CODE_VALIDATED: 'Code validé! Vous avez maintenant accès aux quiz premium.',
        CODE_INVALID: 'Code invalide ou expiré.',
        LOGIN_REQUIRED: 'Veuillez vous connecter pour accéder à cette fonctionnalité.'
    },
    
    // Version de l'application
    VERSION: '1.0.0',
    
    // Mode debug
    DEBUG: false
};