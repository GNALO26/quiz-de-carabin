import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Quiz } from './quiz.js';
import { Payment } from './payment.js';

console.log('App.js chargé - Début de l\'initialisation');

// Initialisation après le chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM complètement chargé');
    
    try {
        // Initialisation des modules
        window.auth = new Auth();
        window.quiz = new Quiz();
        window.payment = new Payment();
        
        console.log('Modules initialisés avec succès');
        
        // Chargement initial des quiz
        window.quiz.loadQuizzes().then(() => {
            console.log('Quiz chargés avec succès');
        }).catch(error => {
            console.error('Erreur lors du chargement des quiz:', error);
        });
        
        // Configuration des écouteurs d'événements globaux
        setupEventListeners();
        console.log('Écouteurs d\'événements configurés');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de l\'application:', error);
    }
});

function setupEventListeners() {
    console.log('Configuration des écouteurs d\'événements');
    
    // Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    console.log(`${navLinks.length} liens de navigation trouvés`);
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            console.log(`Navigation vers: ${targetId}`);
            showSection(targetId);
        });
    });
    
    // Retour à l'accueil
    const backButton = document.getElementById('back-to-quizzes');
    if (backButton) {
        backButton.addEventListener('click', function() {
            console.log('Retour aux quiz');
            showSection('quiz-section');
        });
    }

    // Bouton d'abonnement
    const subscribeBtn = document.getElementById('subscribe-btn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', function() {
            console.log('Initiation du paiement');
            if (window.payment && window.payment.initiatePayment) {
                window.payment.initiatePayment();
            } else {
                console.error('Module de paiement non disponible');
            }
        });
    }

    // Validation du code d'accès
    const validateCodeBtn = document.getElementById('validate-code');
    if (validateCodeBtn) {
        validateCodeBtn.addEventListener('click', function() {
            const code = document.getElementById('accessCode').value;
            console.log(`Validation du code: ${code}`);
            
            if (!window.auth) {
                alert('Système d\'authentification non disponible');
                return;
            }
            
            const user = window.auth.getUser();
            if (!user) {
                alert('Vous devez être connecté pour valider un code.');
                return;
            }
            
            if (window.payment && window.payment.validateAccessCode) {
                window.payment.validateAccessCode(code, user.email).then(result => {
                    if (result.success) {
                        alert(result.message);
                        // Fermer le modal
                        const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                        if (codeModal) codeModal.hide();
                        // Recharger les quiz
                        if (window.quiz && window.quiz.loadQuizzes) {
                            window.quiz.loadQuizzes();
                        }
                    } else {
                        alert(result.message);
                    }
                });
            } else {
                console.error('Module de paiement non disponible pour la validation de code');
            }
        });
    }

    // Boutons de connexion et inscription
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            console.log('Tentative de connexion');
            if (window.auth && window.auth.login) {
                window.auth.login();
            } else {
                console.error('Module d\'authentification non disponible');
            }
        });
    }

    const registerBtn = document.getElementById('register-btn');
    if (registerBtn) {
        registerBtn.addEventListener('click', function() {
            console.log('Tentative d\'inscription');
            if (window.auth && window.auth.register) {
                window.auth.register();
            } else {
                console.error('Module d\'authentification non disponible');
            }
        });
    }

    // Bouton de déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            console.log('Tentative de déconnexion');
            if (window.auth && window.auth.logout) {
                window.auth.logout();
            } else {
                console.error('Module d\'authentification non disponible');
            }
        });
    }
}

function showSection(sectionId) {
    console.log(`Affichage de la section: ${sectionId}`);
    
    // Masquer toutes les sections
    document.querySelectorAll('main section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Afficher la section demandée
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        console.log(`Section ${sectionId} affichée`);
    } else {
        console.error(`Section ${sectionId} non trouvée`);
    }
}

// Gestion des erreurs globales
window.addEventListener('error', function(e) {
    console.error('Erreur globale:', e.error);
});

console.log('App.js complètement chargé');