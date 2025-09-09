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
        this.setupGlobalEventListeners();
    }

    setupGlobalEventListeners() {
        // Gestionnaire pour les liens de navigation
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && link.href.includes('#')) {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
        
        // Gestionnaire pour le bouton d'historique
        document.getElementById('history-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showHistory();
        });
    }

    checkAuthenticationStatus() {
        // Vérifier l'état d'authentification au chargement
        if (this.auth.isAuthenticated()) {
            console.log('Utilisateur authentifié:', this.auth.getUser().email);
        } else {
            console.log('Utilisateur non authentifié');
        }
    }

    showHistory() {
        if (this.auth.isAuthenticated()) {
            window.location.href = 'history.html';
        } else {
            this.auth.showLoginModal();
        }
    }
}

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    window.app = new App();
});

// Fonction globale pour fermer le modal de connexion
window.closeLoginModal = function() {
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (loginModal) {
        loginModal.hide();
    }
};