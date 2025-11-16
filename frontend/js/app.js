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
        
        // Déterminer la page actuelle
        const currentPath = window.location.pathname.toLowerCase();
        const currentUrl = window.location.href.toLowerCase();
        
        console.log('📍 Page détectée:', {
            path: currentPath,
            url: currentUrl,
            hostname: window.location.hostname
        });
        
        // Pages où Payment NE DOIT PAS être initialisé
        const paymentExcludedPages = [
            'payment-callback',
            'payment-error', 
            'forgot-password',
            'reset-password',
            'access-code'
        ];
        
        // Pages où Quiz DOIT être initialisé
        const quizPages = [
            'quiz.html',
            'quiz'
        ];
        
        // Pages où Payment DOIT être initialisé (toutes sauf excluded)
        const shouldInitPayment = !paymentExcludedPages.some(page => 
            currentPath.includes(page) || currentUrl.includes(page)
        );
        
        // Initialiser Payment (sauf sur les pages exclues)
        if (shouldInitPayment) {
            try {
                this.payment = new Payment();
                console.log('✅ Module Payment initialisé avec succès');
            } catch (error) {
                console.error('❌ Erreur initialisation Payment:', error);
            }
        } else {
            console.log('⏭  Payment non initialisé (page exclue)');
        }
        
        // Initialiser Quiz (uniquement sur les pages de quiz)
        const shouldInitQuiz = quizPages.some(page => 
            currentPath.includes(page) || currentUrl.includes(page)
        );
        
        if (shouldInitQuiz) {
            try {
                this.quiz = new Quiz();
                console.log('✅ Module Quiz initialisé avec succès');
            } catch (error) {
                console.error('❌ Erreur initialisation Quiz:', error);
            }
        } else {
            console.log('⏭  Quiz non initialisé (page non quiz)');
        }
        
        this.checkAuthenticationStatus();
        this.logDiagnostic();
        
        // Vérification supplémentaire des boutons après chargement complet
        this.checkUIElements();
    }

    checkAuthenticationStatus() {
        if (this.auth.isAuthenticated()) {
            const user = this.auth.getUser();
            console.log('✅ Utilisateur authentifié:', user?.email);
            console.log('📊 Statut Premium:', this.auth.isPremium() ? 'OUI' : 'NON');
            
            // Vérifier si l'abonnement a expiré
            if (user?.premiumExpiresAt) {
                const expiresAt = new Date(user.premiumExpiresAt);
                const now = new Date();
                const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                console.log(`📅 Premium expire dans: ${daysLeft} jours`);
            }
        } else {
            console.log('🔐 Utilisateur non authentifié');
        }
    }

    // Diagnostic complet de l'application
    logDiagnostic() {
        console.log('🔍 DIAGNOSTIC APPLICATION:');
        console.log('   - URL:', window.location.href);
        console.log('   - Path:', window.location.pathname);
        console.log('   - Host:', window.location.hostname);
        console.log('   - API Base:', CONFIG.API_BASE_URL);
        console.log('   - Token présent:', this.auth.getToken() ? 'OUI' : 'NON');
        console.log('   - User présent:', this.auth.getUser() ? 'OUI' : 'NON');
        console.log('   - Payment initialisé:', this.payment ? 'OUI' : 'NON');
        console.log('   - Quiz initialisé:', this.quiz ? 'OUI' : 'NON');
        console.log('   - Auth initialisé:', this.auth ? 'OUI' : 'NON');
    }

    // Vérifier que les éléments UI sont correctement chargés
    checkUIElements() {
        setTimeout(() => {
            console.log('🎯 VÉRIFICATION ÉLÉMENTS UI:');
            
            // Boutons d'abonnement
            const subscribeButtons = document.querySelectorAll('.subscribe-btn');
            console.log(`   - Boutons d'abonnement: ${subscribeButtons.length}`);
            subscribeButtons.forEach((btn, index) => {
                const planId = btn.getAttribute('data-plan-id');
                const amount = btn.getAttribute('data-plan-price');
                console.log(`     ${index + 1}. ${planId} - ${amount} FCFA`);
            });
            
            // Boutons de quiz
            const quizButtons = document.querySelectorAll('.start-quiz, .quiz-card button');
            console.log(`   - Boutons de quiz: ${quizButtons.length}`);
            
            // Modals
            const modals = {
                'loginModal': document.getElementById('loginModal'),
                'registerModal': document.getElementById('registerModal'),
                'codeModal': document.getElementById('codeModal')
            };
            
            Object.entries(modals).forEach(([name, element]) => {
                console.log(`   - Modal ${name}:`, element ? 'PRÉSENT' : 'ABSENT');
            });
            
            // Sections principales
            const sections = {
                'quiz-list-section': document.getElementById('quiz-list-section'),
                'quiz-interface': document.getElementById('quiz-interface'),
                'results-container': document.getElementById('results-container')
            };
            
            Object.entries(sections).forEach(([name, element]) => {
                console.log(`   - Section ${name}:`, element ? 'PRÉSENT' : 'ABSENT');
            });
            
        }, 1000);
    }

    // Méthode utilitaire pour accéder aux modules depuis la console
    getModules() {
        return {
            auth: this.auth,
            payment: this.payment,
            quiz: this.quiz,
            config: CONFIG
        };
    }
}

// Démarrer l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM chargé - Démarrage de l\'application...');
    
    // Vérifier que Bootstrap est chargé
    if (typeof bootstrap === 'undefined') {
        console.error('❌ Bootstrap non chargé!');
        return;
    }
    
    window.app = new App();
    console.log("🎯 Application Quiz de Carabin initialisée avec succès");
    
    // Exposer l'application globalement pour le debug
    window.getApp = () => window.app;
});

// Fonction globale pour fermer le modal de connexion
window.closeLoginModal = function() {
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (loginModal) {
        loginModal.hide();
    }
};

// Fonction globale pour afficher le modal de connexion
window.showLoginModal = function() {
    if (window.app && window.app.auth) {
        window.app.auth.showLoginModal();
    } else {
        console.error('Auth non initialisé');
    }
};

// Gestion des erreurs globales
window.addEventListener('error', function(e) {
    console.error('💥 ERREUR GLOBALE:', e.error);
});

// Gestion des promesses rejetées non catchées
window.addEventListener('unhandledrejection', function(e) {
    console.error('💥 PROMESSE REJETÉE:', e.reason);
});

// Vérification de la compatibilité
console.log('🛠  Environnement:', {
    userAgent: navigator.userAgent,
    language: navigator.language,
    cookies: navigator.cookieEnabled,
    online: navigator.onLine
});