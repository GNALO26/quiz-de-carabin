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
        
        // Vérifier l'état d'authentification
        this.checkAuthenticationStatus();
        
        // Initialiser les modules en fonction de la page
        if (window.location.pathname.includes('quiz.html') || 
            window.location.pathname.includes('index.html')) {
            this.payment = new Payment();
        }
        
        if (window.location.pathname.includes('quiz.html')) {
            this.quiz = new Quiz();
        }
    }

    checkAuthenticationStatus() {
        // Mettre à jour l'UI en fonction de l'état d'authentification
        if (this.auth.isAuthenticated()) {
            console.log('Utilisateur authentifié');
            this.auth.updateUI();
        } else {
            console.log('Utilisateur non authentifié');
            this.auth.updateUI();
        }
    }
}

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    window.app = new App();
    console.log("Application initialisée");
});