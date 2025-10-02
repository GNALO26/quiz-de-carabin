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
        console.log("🚀 Initialisation de l'application Quiz de Carabin");
        
        // Initialiser les modules en fonction de la page
        if (window.location.pathname.includes('quiz.html') || 
            window.location.pathname.includes('index.html')) {
            this.payment = new Payment();
        }
        
        if (window.location.pathname.includes('quiz.html')) {
            this.quiz = new Quiz();
        }
        
        this.checkAuthenticationStatus();
        
        // ✅ AJOUT: Log de diagnostic
        this.logDiagnostic();
    }

    checkAuthenticationStatus() {
        if (this.auth.isAuthenticated()) {
            console.log('✅ Utilisateur authentifié:', this.auth.getUser()?.email);
            console.log('📊 Statut Premium:', this.auth.isPremium() ? 'OUI' : 'NON');
        } else {
            console.log('🔐 Utilisateur non authentifié');
        }
    }

    // ✅ AJOUT: Diagnostic de l'application
    logDiagnostic() {
        console.log('🔍 DIAGNOSTIC APPLICATION:');
        console.log('   - URL:', window.location.href);
        console.log('   - API Base:', CONFIG.API_BASE_URL);
        console.log('   - Token présent:', this.auth.getToken() ? 'OUI' : 'NON');
        console.log('   - User présent:', this.auth.getUser() ? 'OUI' : 'NON');
        console.log('   - Payment initialisé:', this.payment ? 'OUI' : 'NON');
        console.log('   - Quiz initialisé:', this.quiz ? 'OUI' : 'NON');
    }
}

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    window.app = new App();
    console.log("🎯 Application Quiz de Carabin initialisée");
});

// Fonction globale pour fermer le modal de connexion
window.closeLoginModal = function() {
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (loginModal) {
        loginModal.hide();
    }
};