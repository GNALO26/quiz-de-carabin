// Configuration de l'application - VERSION CORRIGÉE
export const CONFIG = {
    // URLs de l'API
    API_BASE_URL: 'https://quiz-de-carabin-backend.onrender.com',
    API_BACKUP_URL: 'https://quiz-de-carabin-backend.onrender.com',
    
    // URLs des pages
    PAGES: {
        INDEX: 'index.html',
        QUIZ: 'quiz.html',
        ABOUT: 'about.html',
        FORGOT_PASSWORD: 'forgot-password.html',
        RESET_PASSWORD: 'reset-password.html',
        ACCESS_CODE: 'access-code.html',
        PAYMENT_CALLBACK: 'payment-callback.html',
        PAYMENT_ERROR: 'payment-error.html'
    },
    
    // Messages d'erreur
    ERROR_MESSAGES: {
        NETWORK_ERROR: 'Erreur de connexion. Vérifiez votre connexion internet.',
        SERVER_ERROR: 'Erreur du serveur. Veuillez réessayer plus tard.',
        SESSION_EXPIRED: 'Session expirée. Veuillez vous reconnecter.',
        INVALID_TOKEN: 'Token invalide. Veuillez vous reconnecter.',
        ACCESS_DENIED: 'Accès refusé. Abonnement premium requis.'
    },
    
    // Paramètres des quiz
    QUIZ_SETTINGS: {
        MAX_TIME_MINUTES: 30,
        SHOW_EXPLANATIONS: true,
        ALLOW_SKIP: false
    },

    // ✅ AJOUT: Méthode utilitaire pour obtenir l'URL API active
    getActiveAPIUrl: async function() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return this.API_BASE_URL;
            }
        } catch (error) {
            console.warn('URL principale inaccessible:', error.message);
        }
        
        return this.API_BACKUP_URL;
    }
};