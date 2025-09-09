import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Quiz {
    constructor() {
        // CORRECTION: Utiliser new Auth() au lieu de new AuthenticatorAssertionResponse()
        this.auth = window.app ? window.app.auth : new Auth();
        this.quizzes = [];
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timerInterval = null;
        this.timeLeft = 0;
        
        // Initialisation différée pour s'assurer que l'authentification est chargée
        setTimeout(() => this.init(), 100);
    }

    init() {
        console.log("Initialisation du module Quiz");
        this.setupEventListeners();
        
        // Charger les quiz si on est sur la page quiz
        if (window.location.pathname.includes('quiz.html')) {
            console.log("Page quiz détectée, chargement des quizs");
            this.loadQuizzes();
        }
    }

    setupEventListeners() {
        // Bouton de retour aux quiz
        document.getElementById('back-to-quizzes')?.addEventListener('click', () => {
            this.showQuizList();
        });
        
        // Bouton de révision
        document.getElementById('review-btn')?.addEventListener('click', () => {
            this.showQuestion(0);
        });
    }

    async loadQuizzes() {
        console.log('Début du chargement des quizs');
        
        // Vérifier si l'authentification est disponible
        if (!this.auth || typeof this.auth.isAuthenticated !== 'function') {
            console.log('Module d\'authentification non disponible');
            return;
        }
        
        // Vérifier si l'utilisateur est authentifié
        if (!this.auth.isAuthenticated()) {
            console.log('Utilisateur non authentifié, affichage du modal de connexion');
            this.auth.showLoginModal();
            return;
        }

        try {
            const token = this.auth.getToken();
            if (!token) {
                console.log('Token non disponible');
                return;
            }

            const API_BASE_URL = await this.auth.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/quiz`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.quizzes = data.quizzes || [];
                this.displayQuizzes();
            } else if (response.status === 401) {
                console.log('Token invalide ou expiré');
            } else {
                console.error('Erreur lors du chargement des quizs:', response.status);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des quizs:', error);
        }
    }

    displayQuizzes() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        // Cacher le loader
        const loader = quizList.querySelector('.quiz-loader');
        if (loader) loader.style.display = 'none';
        
        quizList.innerHTML = '';
        
        if (this.quizzes.length === 0) {
            quizList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        Aucun quiz disponible pour le moment.
                    </div>
                </div>
            `;
            return;
        }
        
        this.quizzes.forEach(quiz => {
            const quizElement = document.createElement('div');
            quizElement.className = 'col-md-4 mb-4';
            quizElement.innerHTML = `
                <div class="card quiz-card">
                    <div class="card-body">
                        <h5 class="card-title">${quiz.title}</h5>
                        <p class="card-text">${quiz.description}</p>
                        <p class="card-text"><small>${quiz.questions.length} questions</small></p>
                        <button class="btn btn-primary start-quiz" data-quiz-id="${quiz._id}">
                            Commencer le quiz
                        </button>
                    </div>
                </div>
            `;
            quizList.appendChild(quizElement);
        });
        
        // Ajouter les écouteurs d'événements
        document.querySelectorAll('.start-quiz').forEach(button => {
            button.addEventListener('click', (e) => {
                const quizId = e.target.dataset.quizId;
                this.startQuiz(quizId);
            });
        });
    }

    async startQuiz(quizId) {
        try {
            const token = this.auth.getToken();
            if (!token) {
                this.auth.showLoginModal();
                return;
            }
            
            const API_BASE_URL = await this.auth.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentQuiz = data.quiz;
                this.showQuizInterface();
            } else {
                console.error('Erreur lors du chargement du quiz');
            }
        } catch (error) {
            console.error('Erreur lors du démarrage du quiz:', error);
        }
    }

    showQuizInterface() {
        // Cacher la liste des quizs
        document.getElementById('quiz-section').style.display = 'none';
        
        // Afficher l'interface du quiz
        document.getElementById('quiz-interface').style.display = 'block';
        
        // Afficher la première question
        this.showQuestion(0);
    }

    showQuestion(index) {
        if (!this.currentQuiz || index < 0 || index >= this.currentQuiz.questions.length) return;
        
        this.currentQuestionIndex = index;
        const question = this.currentQuiz.questions[index];
        
        const questionContainer = document.getElementById('question-container');
        questionContainer.innerHTML = `
            <h4>Question ${index + 1}/${this.currentQuiz.questions.length}</h4>
            <p>${question.text}</p>
            <div class="options">
                ${question.options.map((option, i) => `
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="option-${i}" name="option" value="${i}">
                        <label class="form-check-label" for="option-${i}">${option}</label>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Mettre à jour les boutons de navigation
        document.getElementById('prev-btn').disabled = index === 0;
        document.getElementById('next-btn').style.display = index < this.currentQuiz.questions.length - 1 ? 'block' : 'none';
        document.getElementById('submit-quiz').style.display = index === this.currentQuiz.questions.length - 1 ? 'block' : 'none';
        
        // Mettre à jour la barre de progression
        const progress = ((index + 1) / this.currentQuiz.questions.length) * 100;
        document.getElementById('quiz-progress').style.width = `${progress}%`;
    }

    // Méthode pour soumettre le quiz
    async submitQuiz() {
        try {
            const token = this.auth.getToken();
            if (!token) {
                console.log('Token non disponible');
                return;
            }
            
            const API_BASE_URL = await this.auth.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/quiz/${this.currentQuiz._id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    answers: this.userAnswers
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.showResults(data);
            } else {
                console.error('Erreur lors de la soumission du quiz');
            }
        } catch (error) {
            console.error('Erreur lors de la soumission du quiz:', error);
        }
    }

    showResults(data) {
        // Cacher l'interface du quiz
        document.getElementById('question-container').style.display = 'none';
        
        // Afficher les résultats
        document.getElementById('results-container').style.display = 'block';
        
        // Mettre à jour le score
        const score = (data.score / data.totalQuestions) * 100;
        document.getElementById('score-value').textContent = Math.round(score);
        
        // Mettre à jour le texte du score
        let scoreText = '';
        let scoreDescription = '';
        
        if (score >= 80) {
            scoreText = 'Excellent!';
            scoreDescription = 'Vous maîtrisez parfaitement ce sujet!';
        } else if (score >= 60) {
            scoreText = 'Bon travail!';
            scoreDescription = 'Vous avez une bonne compréhension de ce sujet.';
        } else if (score >= 40) {
            scoreText = 'Pas mal!';
            scoreDescription = 'Quelques révisions vous aideront à améliorer votre score.';
        } else {
            scoreText = 'À améliorer';
            scoreDescription = 'Continuez à étudier, vous vous améliorerez!';
        }
        
        document.getElementById('score-text').textContent = scoreText;
        document.getElementById('score-description').textContent = scoreDescription;
        
        // Afficher les détails des résultats
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = '';
        
        this.currentQuiz.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const isCorrect = JSON.stringify(userAnswer) === JSON.stringify(question.correctAnswers);
            
            const questionElement = document.createElement('div');
            questionElement.className = `mb-3 p-3 border rounded ${isCorrect ? 'border-success' : 'border-danger'}`;
            questionElement.innerHTML = `
                <h5>Question ${index + 1}: ${question.text}</h5>
                <p><strong>Votre réponse:</strong> ${userAnswer.map(a => question.options[a]).join(', ') || 'Aucune réponse'}</p>
                <p><strong>Réponse correcte:</strong> ${question.correctAnswers.map(a => question.options[a]).join(', ')}</p>
                ${question.justification ? <p><strong>Explication:</strong> ${question.justification}</p> : ''}
            `;
            
            resultsContent.appendChild(questionElement);
        });
    }

    showQuizList() {
        // Cacher l'interface du quiz et les résultats
        document.getElementById('quiz-interface').style.display = 'none';
        document.getElementById('results-container').style.display = 'none';
        
        // Afficher la liste des quizs
        document.getElementById('quiz-section').style.display = 'block';
        
        // Recharger les quizs
        this.loadQuizzes();
    }

    async getActiveAPIUrl() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                return CONFIG.API_BASE_URL;
            }
        } catch (error) {
            console.warn('URL principale inaccessible, tentative avec URL de secours:', error);
        }
        
        return CONFIG.API_BACKUP_URL;
    }
}

// Initialisation automatique quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM chargé, initialisation du module Quiz");
    window.quiz = new Quiz();
});