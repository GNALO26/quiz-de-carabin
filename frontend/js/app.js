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
        // Initialiser les modules en fonction de la page
        if (window.location.pathname.includes('quiz.html') || 
            window.location.pathname.includes('index.html')) {
            this.payment = new Payment();
        }
        
        if (window.location.pathname.includes('quiz.html')) {
            this.quiz = new Quiz();
        }
        
        this.checkAuthenticationStatus();
        
        // CORRECTION: Exposer l'application globalement
        window.app = this;
        console.log('Application initialisée avec succès');
    }

    checkAuthenticationStatus() {
        if (this.auth.isAuthenticated()) {
            console.log('Utilisateur authentifié:', this.auth.getUser()?.email);
        } else {
            console.log('Utilisateur non authentifié');
        }
    }
}

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    new App();
});