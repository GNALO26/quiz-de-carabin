import { CONFIG } from './config.js';
import { Auth } from './auth.js';

export class Quiz {
    constructor() {
        this.auth = new Auth();
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timer = null;
        this.timeLeft = 0;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadQuizzes();
    }

    // ✅ AJOUT: Fonction getActiveAPIUrl
    async getActiveAPIUrl() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return CONFIG.API_BASE_URL;
            }
        } catch (error) {
            console.warn('URL principale inaccessible:', error.message);
        }
        
        return CONFIG.API_BACKUP_URL;
    }

    async loadQuizzes() {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                this.showLoginPrompt();
                return;
            }

            if (!response.ok) {
                throw new Error('Erreur de chargement des quizs');
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.displayQuizzes(data.quizzes);
            } else {
                throw new Error(data.message || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur lors du chargement des quizs:', error);
            this.showError('Erreur de chargement des quizs');
        }
    }

    displayQuizzes(quizzes) {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;

        const loadingSpinner = document.getElementById('loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }

        if (!quizzes || quizzes.length === 0) {
            quizList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Aucun quiz disponible pour le moment.
                    </div>
                </div>
            `;
            return;
        }

        quizList.innerHTML = quizzes.map(quiz => {
            const isFree = quiz.free || false;
            const user = this.auth.getUser();
            const hasAccess = isFree || (user && user.isPremium);
            
            return `
                <div class="col-md-4 mb-4">
                    <div class="card quiz-card h-100">
                        <div class="card-body">
                            <span class="badge ${isFree ? 'bg-success' : 'bg-warning'} mb-2">
                                ${isFree ? 'GRATUIT' : 'PREMIUM'}
                            </span>
                            <h5 class="card-title">${quiz.title}</h5>
                            <p class="card-text">${quiz.description || 'Aucune description'}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small><i class="fas fa-question-circle me-1"></i> ${quiz.questions?.length || 0} questions</small>
                                <small><i class="fas fa-clock me-1"></i> ${quiz.duration || 10} min</small>
                            </div>
                        </div>
                        <div class="card-footer bg-transparent">
                            ${hasAccess ? 
                                <a href="quiz.html?id=${quiz._id}" class="btn btn-primary w-100">Commencer</a> : 
                                `<button class="btn btn-outline-primary w-100 premium-quiz" data-quiz-id="${quiz._id}">
                                    ${isFree ? 'Commencer' : 'Accéder (Premium)'}
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.setupQuizEventListeners();
    }

    setupQuizEventListeners() {
        // Quiz premium
        document.querySelectorAll('.premium-quiz').forEach(button => {
            button.addEventListener('click', (e) => {
                const quizId = e.target.getAttribute('data-quiz-id');
                this.handlePremiumQuiz(quizId);
            });
        });
    }

    handlePremiumQuiz(quizId) {
        if (!this.auth.isAuthenticated()) {
            this.auth.showLoginModal();
            return;
        }
        
        const codeModal = new bootstrap.Modal(document.getElementById('codeModal'));
        codeModal.show();
        
        document.getElementById('validate-code').setAttribute('data-quiz-id', quizId);
    }

    async startQuiz(quizId) {
        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 403) {
                this.showError('Accès réservé aux abonnés premium');
                return;
            }

            if (!response.ok) {
                throw new Error('Erreur de chargement du quiz');
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.currentQuiz = data.quiz;
                this.currentQuestionIndex = 0;
                this.userAnswers = [];
                this.showQuizInterface();
            } else {
                throw new Error(data.message || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur démarrage quiz:', error);
            this.showError('Erreur lors du démarrage du quiz');
        }
    }

    showQuizInterface() {
        document.getElementById('quiz-list-section').style.display = 'none';
        
        const quizInterface = document.getElementById('quiz-interface');
        quizInterface.style.display = 'block';
        
        this.displayCurrentQuestion();
        this.startTimer();
    }

    displayCurrentQuestion() {
        if (!this.currentQuiz || !this.currentQuiz.questions) return;

        const question = this.currentQuiz.questions[this.currentQuestionIndex];
        const questionContainer = document.getElementById('question-container');
        
        questionContainer.innerHTML = `
            <div class="question-card">
                <h5>Question ${this.currentQuestionIndex + 1}/${this.currentQuiz.questions.length}</h5>
                <p class="question">${question.text}</p>
                <div class="options">
                    ${question.options.map((option, index) => `
                        <div class="option-item" data-index="${index}">
                            <input type="checkbox" id="option-${index}" ${this.userAnswers[this.currentQuestionIndex]?.includes(index) ? 'checked' : ''}>
                            <label for="option-${index}">${option.text}</label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const progress = ((this.currentQuestionIndex + 1) / this.currentQuiz.questions.length) * 100;
        document.getElementById('quiz-progress').style.width = `${progress}%`;

        document.getElementById('prev-btn').disabled = this.currentQuestionIndex === 0;
        document.getElementById('next-btn').style.display = this.currentQuestionIndex < this.currentQuiz.questions.length - 1 ? 'block' : 'none';
        document.getElementById('submit-quiz').style.display = this.currentQuestionIndex === this.currentQuiz.questions.length - 1 ? 'block' : 'none';

        this.setupQuestionEventListeners();
    }

    setupQuestionEventListeners() {
        document.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(item.getAttribute('data-index'));
                const checkbox = item.querySelector('input[type="checkbox"]');
                
                checkbox.checked = !checkbox.checked;
                
                if (!this.userAnswers[this.currentQuestionIndex]) {
                    this.userAnswers[this.currentQuestionIndex] = [];
                }
                
                if (checkbox.checked) {
                    this.userAnswers[this.currentQuestionIndex].push(index);
                } else {
                    this.userAnswers[this.currentQuestionIndex] = this.userAnswers[this.currentQuestionIndex].filter(i => i !== index);
                }
                
                item.classList.toggle('selected', checkbox.checked);
            });
        });

        document.getElementById('prev-btn').addEventListener('click', () => {
            if (this.currentQuestionIndex > 0) {
                this.currentQuestionIndex--;
                this.displayCurrentQuestion();
            }
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
                this.currentQuestionIndex++;
                this.displayCurrentQuestion();
            }
        });

        document.getElementById('submit-quiz').addEventListener('click', () => {
            this.submitQuiz();
        });
    }

    startTimer() {
        this.timeLeft = (this.currentQuiz.duration || 20) * 60;
        this.updateTimerDisplay();
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                this.submitQuiz();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('quiz-timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    async submitQuiz() {
        if (this.timer) {
            clearInterval(this.timer);
        }

        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const token = this.auth.getToken();
            
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

            const data = await response.json();
            
            if (data.success) {
                this.showResults(data);
            } else {
                throw new Error(data.message || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur soumission quiz:', error);
            this.showError('Erreur lors de la soumission du quiz');
        }
    }

    showResults(data) {
        const resultsContainer = document.getElementById('results-container');
        const resultsContent = document.getElementById('results-content');
        const scorePercent = Math.round((data.score / data.totalQuestions) * 100);
        
        // Mettre à jour le score
        document.getElementById('score-value').textContent = scorePercent;
        
        // Déterminer le message en fonction du score
        let scoreText = '';
        let scoreDescription = '';
        
        if (scorePercent >= 80) {
            scoreText = 'Excellent!';
            scoreDescription = 'Vous maîtrisez parfaitement ce sujet!';
        } else if (scorePercent >= 60) {
            scoreText = 'Bon travail!';
            scoreDescription = 'Vous avez une bonne compréhension de ce sujet.';
        } else if (scorePercent >= 40) {
            scoreText = 'Pas mal!';
            scoreDescription = 'Quelques révisions vous aideront à améliorer votre score.';
        } else {
            scoreText = 'À améliorer';
            scoreDescription = 'Continuez à étudier, vous vous améliorerez!';
        }
        
        document.getElementById('score-text').textContent = scoreText;
        document.getElementById('score-description').textContent = scoreDescription;
        
        // Construction du HTML des résultats
        let resultsHTML = '';
        
        this.currentQuiz.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index] || [];
            // Les réponses correctes ne sont pas renvoyées par le submitQuiz, elles sont dans le modèle Quiz complet
            // Pour l'affichage des résultats, on doit supposer que les réponses correctes sont disponibles dans this.currentQuiz (elles le sont)
            const correctAnswers = question.correctAnswers; 
            const isCorrect = userAnswer.length === correctAnswers.length && 
                              userAnswer.every(val => correctAnswers.includes(val));
            
            resultsHTML += `
                <div class="mb-4 p-3 ${isCorrect ? 'border-success' : 'border-danger'} border rounded">
                    <h5>Question ${index + 1}: ${question.text}</h5>
                    <p class="${isCorrect ? 'text-success' : 'text-danger'}">
                        <strong>Vos réponses:</strong> 
                        ${userAnswer.length > 0 ? userAnswer.map(idx => question.options[idx]).join(', ') : 'Aucune réponse'}
                        ${isCorrect ? '<i class="fas fa-check ms-2"></i>' : '<i class="fas fa-times ms-2"></i>'}
                    </p>
            `;

            if (!isCorrect) {
                resultsHTML += `<p class="text-success"><strong>Réponses correctes:</strong> ${correctAnswers.map(idx => question.options[idx]).join(', ')}</p>`;
            }

            resultsHTML += `
                    <div class="justification mt-2 border-top pt-2">
                        <strong>Explication:</strong> ${question.justification}
                    </div>
                </div>
            `;
        });

        resultsContent.innerHTML = resultsHTML;

        // Afficher les résultats
        document.getElementById('question-container').style.display = 'none';
        resultsContainer.style.display = 'block';
    }

    getScoreMessage(percentage) {
        if (percentage >= 80) return 'Excellent!';
        if (percentage >= 60) return 'Très bien!';
        if (percentage >= 50) return 'Passable';
        return 'À revoir';
    }

    showLoginPrompt() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;

        quizList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-warning">
                    <h4>Connexion requise</h4>
                    <p>Vous devez vous connecter pour accéder aux quiz.</p>
                    <button class="btn btn-primary mt-2" id="quiz-login-button">
                        Se connecter
                    </button>
                </div>
            </div>
        `;

        document.getElementById('quiz-login-button').addEventListener('click', () => {
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        });
    }

    showError(message) {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;

        quizList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${message}
                </div>
                <button class="btn btn-primary mt-2" id="retry-loading">Réessayer</button>
            </div>
        `;

        document.getElementById('retry-loading').addEventListener('click', () => {
            this.loadQuizzes();
        });
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            this.loadQuizzes();
        });
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('quiz-list')) {
        window.quiz = new Quiz();
    }
});