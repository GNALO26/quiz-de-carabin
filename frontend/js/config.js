import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Payment } from './payment.js';
import { Quiz } from './quiz.js';

// Initialiser l'application
class App {
    constructor() {
        this.auth = new Auth();
        this.payment = null;
        this.quiz = null;
        
        this.init();
    }

    init() {
        console.log("Initialisation de l'application");
        
        // Initialiser les modules en fonction de la page
        if (window.location.pathname.includes('quiz.html') || 
            window.location.pathname.includes('index.html')) {
            this.payment = new Payment();
        }
        
        if (window.location.pathname.includes('quiz.html')) {
            this.quiz = new Quiz();
        }
        
        this.checkAuthenticationStatus();
    }

    checkAuthenticationStatus() {
        // Vérifier l'état d'authentification au chargement
        if (this.auth.isAuthenticated()) {
            console.log('Utilisateur authentifié:', this.auth.getUser()?.email);
        } else {
            console.log('Utilisateur non authentifié');
        }
    }
}

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    window.app = new App();
    console.log("Application initialisée");
});

// Fonction globale pour fermer le modal de connexion
window.closeLoginModal = function() {
    const loginModalElement = document.getElementById('loginModal');
    if (loginModalElement) {
        const loginModal = bootstrap.Modal.getInstance(loginModalElement);
        if (loginModal) {
            loginModal.hide();
        } else {
            // Créer une instance si elle n'existe pas encore
            new bootstrap.Modal(loginModalElement).hide();
        }
    }
};