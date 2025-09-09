import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Payment } from './payment.js';
import { Quiz } from './quiz.js';

// Initialiser l'application
class App {
    constructor() {
        this.auth = new Auth();
        
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
        if (this.auth.isAuthenticated()) {
            console.log('Utilisateur authentifié');
        } else {
            console.log('Utilisateur non authentifié');
        }
    }
}

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    window.app = new App();
});