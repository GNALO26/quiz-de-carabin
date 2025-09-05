import { CONFIG } from './config.js';
import { Auth } from './auth.js';
import { Quiz } from './quiz.js';
import { Payment } from './payment.js';

// Initialisation après le chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    // Initialisation des modules
    window.auth = new Auth();
    window.quiz = new Quiz();
    window.payment = new Payment();
    
    // Chargement initial des quiz
    window.quiz.loadQuizzes();
    
    // Configuration des écouteurs d'événements globaux
    setupEventListeners();
});

function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            showSection(targetId);
        });
    });
    
    // Retour à l'accueil
    const backButton = document.getElementById('back-to-quizzes');
    if (backButton) {
        backButton.addEventListener('click', function() {
            showSection('quiz-section');
        });
    }

    // Bouton d'abonnement
    const subscribeBtn = document.getElementById('subscribe-btn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', function() {
            window.payment.initiatePayment();
        });
    }

    // Validation du code d'accès
    const validateCodeBtn = document.getElementById('validate-code');
    if (validateCodeBtn) {
        validateCodeBtn.addEventListener('click', function() {
            const code = document.getElementById('accessCode').value;
            const user = window.auth.getUser();
            if (!user) {
                alert('Vous devez être connecté pour valider un code.');
                return;
            }
            
            window.payment.validateAccessCode(code, user.email).then(result => {
                if (result.success) {
                    alert(result.message);
                    // Fermer le modal et recharger les quiz pour voir les quiz premium
                    const codeModal = bootstrap.Modal.getInstance(document.getElementById('codeModal'));
                    if (codeModal) codeModal.hide();
                    window.quiz.loadQuizzes();
                } else {
                    alert(result.message);
                }
            });
        });
    }
}

function showSection(sectionId) {
    // Masquer toutes les sections
    document.querySelectorAll('main section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Afficher la section demandée
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
}