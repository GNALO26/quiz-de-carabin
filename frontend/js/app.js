import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Payment } from './payment.js';
import { Quiz } from './quiz.js';

class App {
    constructor() {
        this.auth = null;
        this.payment = null;
        this.quiz = null;
        this.isQuizPage = window.location.pathname.includes('quiz.html');
        
        this.init();
    }

    async init() {
        console.log("🚀 Initialisation Quiz de Carabin");
        
        try {
            // Étape 1 : Initialiser Auth EN PREMIER
            this.auth = new Auth();
            console.log("✅ Auth initialisé");
            
            // Étape 2 : Attendre qu'Auth soit complètement prêt
            await this.waitForAuth();
            console.log("✅ Auth prêt");
            
            // Étape 3 : Initialiser Payment si nécessaire
            if (this.isQuizPage || window.location.pathname.includes('index.html')) {
                this.payment = new Payment();
                console.log("✅ Payment initialisé");
            }
            
            // Étape 4 : Initialiser Quiz SEULEMENT sur quiz.html
            if (this.isQuizPage) {
                console.log("📝 Initialisation Quiz sur quiz.html");
                this.quiz = new Quiz();
                console.log("✅ Quiz initialisé");
            }
            
            this.checkAuthenticationStatus();
            this.logDiagnostic();
            
        } catch (error) {
            console.error("❌ Erreur initialisation:", error);
        }
    }

    async waitForAuth() {
        return new Promise((resolve) => {
            const maxAttempts = 50; // 5 secondes max
            let attempts = 0;
            
            const checkAuth = () => {
                attempts++;
                
                if (this.auth && typeof this.auth.getToken === 'function') {
                    console.log(`✅ Auth prêt après ${attempts} tentatives`);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('⚠️ Timeout Auth, on continue quand même');
                    resolve();
                } else {
                    setTimeout(checkAuth, 100);
                }
            };
            
            checkAuth();
        });
    }

    checkAuthenticationStatus() {
        if (this.auth && this.auth.isAuthenticated()) {
            const user = this.auth.getUser();
            console.log('✅ Utilisateur:', user?.email);
            console.log('📊 Premium:', this.auth.isPremium() ? 'OUI' : 'NON');
        } else {
            console.log('🔐 Non authentifié');
        }
    }

    logDiagnostic() {
        console.log('🔍 === DIAGNOSTIC ===');
        console.log('URL:', window.location.pathname);
        console.log('Token:', this.auth?.getToken() ? 'OUI' : 'NON');
        console.log('User:', this.auth?.getUser() ? 'OUI' : 'NON');
        console.log('Quiz:', this.quiz ? 'INITIALISÉ' : 'NON INITIALISÉ');
        console.log('==================');
    }
}

// ✅ Démarrage IMMÉDIAT
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    console.log("🎯 App démarrée");
});

window.closeLoginModal = function() {
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (loginModal) loginModal.hide();
};