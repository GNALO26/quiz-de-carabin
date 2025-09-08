import { CONFIG } from './config.js';

// Gestionnaire de routes simple pour la navigation SPA
export class Router {
    constructor() {
        this.routes = {};
        this.currentPath = window.location.pathname;
        this.init();
    }

    init() {
        // Définir les routes
        this.routes = {
            [CONFIG.PAGES.INDEX]: () => this.handleIndexPage(),
            [CONFIG.PAGES.QUIZ]: () => this.handleQuizPage(),
            [CONFIG.PAGES.ABOUT]: () => this.handleAboutPage(),
            [CONFIG.PAGES.FORGOT_PASSWORD]: () => this.handleForgotPasswordPage(),
            [CONFIG.PAGES.RESET_PASSWORD]: () => this.handleResetPasswordPage(),
            [CONFIG.PAGES.ACCESS_CODE]: () => this.handleAccessCodePage(),
            [CONFIG.PAGES.PAYMENT_CALLBACK]: () => this.handlePaymentCallbackPage(),
            [CONFIG.PAGES.PAYMENT_ERROR]: () => this.handlePaymentErrorPage()
        };

        // Écouter les changements d'URL
        window.addEventListener('popstate', () => {
            this.currentPath = window.location.pathname;
            this.navigate(this.currentPath);
        });

        // Navigation initiale
        this.navigate(this.currentPath);
    }

    navigate(path) {
        // Trouver la fonction de gestionnaire pour ce chemin
        const handler = this.routes[path] || this.routes[CONFIG.PAGES.INDEX];
        
        if (handler) {
            handler();
        } else {
            console.error('Aucun gestionnaire trouvé pour le chemin:', path);
            this.navigate(CONFIG.PAGES.INDEX);
        }
    }

    handleIndexPage() {
        console.log('Chargement de la page d\'accueil');
        // Initialiser les composants spécifiques à la page d'accueil
    }

    handleQuizPage() {
        console.log('Chargement de la page de quiz');
        // Initialiser les composants spécifiques à la page de quiz
        if (window.quiz) {
            window.quiz.loadQuizzes();
        }
    }

    handleAboutPage() {
        console.log('Chargement de la page À propos');
        // Initialiser les composants spécifiques à la page À propos
    }

    handleForgotPasswordPage() {
        console.log('Chargement de la page de mot de passe oublié');
        // Initialiser les composants spécifiques à la page de mot de passe oublié
    }

    handleResetPasswordPage() {
        console.log('Chargement de la page de réinitialisation de mot de passe');
        // Initialiser les composants spécifiques à la page de réinitialisation
    }

    handleAccessCodePage() {
        console.log('Chargement de la page de code d\'accès');
        // Initialiser les composants spécifiques à la page de code d'accès
    }

    handlePaymentCallbackPage() {
        console.log('Chargement de la page de callback de paiement');
        // Traiter le callback de paiement
        this.processPaymentCallback();
    }

    handlePaymentErrorPage() {
        console.log('Chargement de la page d\'erreur de paiement');
        // Afficher les informations d'erreur
        this.showPaymentError();
    }

    processPaymentCallback() {
        // Récupérer les paramètres de l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('status');
        const transactionId = urlParams.get('transactionId');
        const userId = urlParams.get('userId');

        if (status === 'success' && transactionId && userId) {
            // Afficher un message de succès
            document.getElementById('payment-status').innerHTML = `
                <div class="alert alert-success">
                    <h4>Paiement réussi!</h4>
                    <p>Votre paiement a été traité avec succès. Un code d'accès a été envoyé à votre adresse email.</p>
                    <p>Référence de transaction: ${transactionId}</p>
                </div>
                <div class="text-center mt-4">
                    <a href="${CONFIG.PAGES.ACCESS_CODE}" class="btn btn-primary me-2">Valider mon code d'accès</a>
                    <a href="${CONFIG.PAGES.INDEX}" class="btn btn-outline-secondary">Retour à l'accueil</a>
                </div>
            `;
        } else {
            // Rediriger vers la page d'erreur
            window.location.href = CONFIG.PAGES.PAYMENT_ERROR;
        }
    }

    showPaymentError() {
        // Récupérer les paramètres de l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error') || 'Une erreur inconnue s\'est produite';

        // Afficher le message d'erreur
        document.getElementById('payment-error').innerHTML = `
            <div class="alert alert-danger">
                <h4>Erreur de paiement</h4>
                <p>${error}</p>
            </div>
            <div class="text-center mt-4">
                <a href="${CONFIG.PAGES.INDEX}" class="btn btn-primary me-2">Retour à l'accueil</a>
                <button onclick="window.history.back()" class="btn btn-outline-secondary">Réessayer</button>
            </div>
        `;
    }

    // Méthode pour naviguer vers une nouvelle page
    goTo(path) {
        window.history.pushState({}, '', path);
        this.currentPath = path;
        this.navigate(path);
    }
}

// Initialiser le routeur
document.addEventListener('DOMContentLoaded', function() {
    window.router = new Router();
});