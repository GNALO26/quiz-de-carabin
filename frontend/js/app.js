import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Payment } from './payment.js';

// ✅ CLASSE PRINCIPALE DE L'APPLICATION
class App {
    constructor() {
        this.auth = new Auth();
        this.payment = null;
        
        this.init();
    }

    init() {
        console.log("🚀 Initialisation de l'application Quiz de Carabin");
        console.log("📍 URL actuelle:", window.location.pathname);
        console.log("🔧 Version:", CONFIG.VERSION);
        
        // Initialiser les modules selon la page
        if (window.location.pathname.includes('quiz.html') || 
            window.location.pathname.includes('index.html') ||
            window.location.pathname === '/') {
            this.payment = new Payment();
            console.log("💰 Module Payment initialisé");
        }
        
        this.checkAuthenticationStatus();
        this.setupGlobalEventListeners();
        this.logDiagnostic();
    }

    checkAuthenticationStatus() {
        if (this.auth.isAuthenticated()) {
            const user = this.auth.getUser();
            console.log('✅ Utilisateur authentifié:', user?.email);
            console.log('📊 Statut Premium:', this.auth.isPremium() ? 'OUI' : 'NON');
            
            if (this.auth.isPremium() && user?.premiumExpiresAt) {
                const expiryDate = new Date(user.premiumExpiresAt);
                const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                console.log('⏰ Jours restants:', daysLeft);
            }
        } else {
            console.log('🔐 Utilisateur non authentifié');
        }
    }

    setupGlobalEventListeners() {
        // Bouton "J'ai déjà un code"
        const alreadyHaveCodeBtn = document.getElementById('already-have-code-btn');
        if (alreadyHaveCodeBtn) {
            alreadyHaveCodeBtn.addEventListener('click', () => {
                const codeModal = new bootstrap.Modal(document.getElementById('codeModal'));
                codeModal.show();
            });
        }

        // Gestion erreurs globales
        window.addEventListener('error', (event) => {
            console.error('❌ Erreur globale:', event.error);
            if (CONFIG.DEBUG) {
                this.showDebugInfo(event.error);
            }
        });

        // Gestion rejets de promesses non gérés
        window.addEventListener('unhandledrejection', (event) => {
            console.error('❌ Promesse rejetée non gérée:', event.reason);
            if (CONFIG.DEBUG) {
                this.showDebugInfo(event.reason);
            }
        });

        // Vérifier la connexion périodiquement
        this.startConnectivityCheck();
    }

    startConnectivityCheck() {
        setInterval(async () => {
            try {
                const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                    method: 'GET',
                    cache: 'no-cache'
                });
                
                if (!response.ok) {
                    console.warn('⚠ Serveur API non disponible');
                }
            } catch (error) {
                console.warn('⚠ Problème de connectivité:', error.message);
            }
        }, CONFIG.TIMEOUTS.SESSION_CHECK);
    }

    logDiagnostic() {
        console.log('\n🔍 ===== DIAGNOSTIC APPLICATION =====');
        console.log('   - URL:', window.location.href);
        console.log('   - API Base:', CONFIG.API_BASE_URL);
        console.log('   - Token présent:', this.auth.getToken() ? 'OUI ✅' : 'NON ❌');
        console.log('   - User présent:', this.auth.getUser() ? 'OUI ✅' : 'NON ❌');
        console.log('   - Payment initialisé:', this.payment ? 'OUI ✅' : 'NON ❌');
        console.log('   - KkiaPay chargé:', typeof openKkiapayWidget !== 'undefined' ? 'OUI ✅' : 'NON ❌');
        console.log('   - Bootstrap chargé:', typeof bootstrap !== 'undefined' ? 'OUI ✅' : 'NON ❌');
        console.log('   - User Agent:', navigator.userAgent);
        console.log('   - Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
        console.log('   - Langue:', navigator.language);
        console.log('   - Online:', navigator.onLine ? 'OUI ✅' : 'NON ❌');
        console.log('===================================\n');
    }

    showDebugInfo(error) {
        const debugDiv = document.createElement('div');
        debugDiv.className = 'alert alert-danger';
        debugDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        debugDiv.innerHTML = `
            <h6><i class="fas fa-bug me-2"></i>Debug Info</h6>
            <pre class="mb-0" style="font-size: 11px; max-height: 200px; overflow: auto;">${error.stack || error.message}</pre>
            <button class="btn btn-sm btn-outline-danger mt-2" onclick="this.parentElement.remove()">Fermer</button>
        `;
        document.body.appendChild(debugDiv);
    }
}

// ✅ FONCTION GLOBALE POUR FERMER LE MODAL DE CONNEXION
window.closeLoginModal = function() {
    const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
    if (loginModal) {
        loginModal.hide();
    }
};

// ✅ DÉMARRER L'APPLICATION
document.addEventListener('DOMContentLoaded', function() {
    console.log('\n🎯 ===== DÉMARRAGE APPLICATION =====');
    console.log('   Date:', new Date().toLocaleString('fr-FR'));
    
    window.app = new App();
    
    console.log('✅ Application Quiz de Carabin initialisée avec succès');
    console.log('====================================\n');
});

// ✅ GESTION DE LA NAVIGATION (RETOUR ARRIÈRE)
window.addEventListener('popstate', function() {
    console.log('🔄 Navigation détectée');
    if (window.app && window.app.payment) {
        window.app.payment.displaySubscriptionInfo();
    }
});

// ✅ GESTION DU RECHARGEMENT DE PAGE
window.addEventListener('beforeunload', function() {
    console.log('🔄 Rechargement de la page...');
});

// ✅ EXPORT POUR UTILISATION DANS D'AUTRES MODULES
export default App;