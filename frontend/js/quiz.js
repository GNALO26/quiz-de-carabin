import { CONFIG } from './config.js';

export class Quiz {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timerInterval = null;
        this.timeLeft = 0;
        
        this.init();
    }

    init() {
        console.log("Initialisation du module Quiz");
        this.setupEventListeners();
        
        // Attendre que l'authentification soit initialisée
        if (window.app && window.app.auth) {
            this.loadQuizzes();
        } else {
            // Si l'app n'est pas encore initialisée, attendre un peu
            setTimeout(() => this.loadQuizzes(), 1000);
        }
    }

    setupEventListeners() {
        // Bouton précédent
        document.getElementById('prev-btn')?.addEventListener('click', () => {
            this.showQuestion(this.currentQuestionIndex - 1);
        });
        
        // Bouton suivant
        document.getElementById('next-btn')?.addEventListener('click', () => {
            this.showQuestion(this.currentQuestionIndex + 1);
        });
        
        // Bouton soumettre
        document.getElementById('submit-quiz')?.addEventListener('click', () => {
            this.submitQuiz();
        });
        
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
        
        // Afficher le loader
        this.showLoader();
        
        // Récupérer le token directement du localStorage
        const token = localStorage.getItem('quizToken');
        if (!token) {
            console.log('Token non disponible');
            this.showLoginPrompt();
            return;
        }

        try {
            const API_BASE_URL = await this.getActiveAPIUrl();
            const response = await fetch(`${API_BASE_URL}/api/quiz`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                console.log('Token expiré ou invalide');
                localStorage.removeItem('quizToken');
                localStorage.removeItem('quizUser');
                this.showLoginPrompt();
                return;
            }

            if (response.ok) {
                const data = await response.json();
                this.quizzes = data.quizzes || data.data || [];
                this.displayQuizzes();
            } else {
                console.error('Erreur lors du chargement des quizs:', response.status);
                this.showError('Erreur serveur. Veuillez réessayer plus tard.');
            }
        } catch (error) {
            console.error('Erreur lors du chargement des quizs:', error);
            this.showError('Erreur de connexion. Vérifiez votre connexion internet.');
        }
    }

    displayQuizzes() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) {
            console.error("Element #quiz-list non trouvé dans le DOM");
            return;
        }
        
        // Cacher le loader
        this.hideLoader();
        
        console.log("Rendu des quizs dans l'interface", this.quizzes);
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
            const isFree = quiz.free || false;
            const hasAccess = isFree || (window.app && window.app.auth && window.app.auth.isPremium());
            
            const quizCard = document.createElement('div');
            quizCard.className = 'col-md-4 mb-4';
            quizCard.innerHTML = `
                <div class="card quiz-card h-100">
                    <div class="card-body">
                        <span class="badge ${isFree ? 'badge-free' : 'bg-warning text-dark'} mb-2">
                            ${isFree ? 'GRATUIT' : 'PREMIUM'}
                        </span>
                        <h5 class="card-title">${quiz.title}</h5>
                        <p class="card-text">${quiz.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small><i class="fas fa-question-circle me-1"></i> ${quiz.questions?.length || 0} questions</small>
                            <small><i class="fas fa-clock me-1"></i> ${quiz.duration || 10} minutes</small>
                        </div>
                    </div>
                    <div class="card-footer bg-white">
                        <button class="btn ${isFree ? 'btn-outline-primary' : 'btn-primary'} w-100 start-quiz" 
                                data-quiz-id="${quiz._id}" ${!hasAccess && !isFree ? 'disabled' : ''}>
                            ${isFree ? 'Commencer le quiz' : (hasAccess ? 'Commencer le quiz' : 'Accéder (5.000 XOF)')}
                        </button>
                        ${!hasAccess && !isFree ? `
                            <small class="text-muted d-block mt-2">Abonnement premium requis</small>
                        ` : ''}
                    </div>
                </div>
            `;
            quizList.appendChild(quizCard);
        });

        this.addQuizEventListeners();
    }

    addQuizEventListeners() {
        document.querySelectorAll('.start-quiz').forEach(button => {
            button.addEventListener('click', (e) => {
                const quizId = e.target.getAttribute('data-quiz-id');
                const quiz = this.quizzes.find(q => q._id === quizId);
                
                if (!quiz) return;
                
                if (!quiz.free && window.app.auth && !window.app.auth.isPremium()) {
                    // Rediriger vers l'abonnement
                    if (window.app.payment && typeof window.app.payment.initiatePayment === 'function') {
                        window.app.payment.initiatePayment();
                    }
                } else {
                    this.startQuiz(quizId);
                }
            });
        });
    }

    showLoader() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        quizList.innerHTML = `
            <div class="col-12">
                <div class="quiz-loader text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <p class="mt-3">Chargement des quiz...</p>
                </div>
            </div>
        `;
    }

    hideLoader() {
        const loader = document.querySelector('.quiz-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }

    showLoginPrompt() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        this.hideLoader();
        
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
            if (window.app.auth && typeof window.app.auth.showLoginModal === 'function') {
                window.app.auth.showLoginModal();
            }
        });
    }

    showError(message) {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        this.hideLoader();
        
        quizList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <h4>Erreur</h4>
                    <p>${message}</p>
                    <button class="btn btn-primary mt-2" onclick="window.location.reload()">
                        Actualiser la page
                    </button>
                </div>
            </div>
        `;
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

    async startQuiz(quizId) {
        try {
            const token = localStorage.getItem('quizToken');
            
            if (!token) {
                alert('Vous devez vous connecter pour accéder à ce quiz.');
                return;
            }

            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();

            if (data.success) {
                this.currentQuiz = data.quiz || data.data;
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill(null);
                this.currentQuestionIndex = 0;

                // Afficher l'interface du quiz
                const quizSection = document.getElementById('quiz-section');
                const quizInterface = document.getElementById('quiz-interface');
                
                if (quizSection) quizSection.style.display = 'none';
                if (quizInterface) quizInterface.style.display = 'block';

                // Initialiser le quiz
                document.getElementById('quiz-title').textContent = this.currentQuiz.title;
                this.showQuestion(0);
                this.startTimer(this.currentQuiz.duration * 60);
            } else {
                alert('Erreur: ' + data.message);
            }
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert('Erreur lors du chargement du quiz');
        }
    }

    showQuestion(index) {
        if (!this.currentQuiz || index < 0 || index >= this.currentQuiz.questions.length) return;

        const question = this.currentQuiz.questions[index];
        const questionContainer = document.getElementById('question-container');
        this.currentQuestionIndex = index;

        let optionsHTML = '';
        question.options.forEach((option, i) => {
            const isSelected = this.userAnswers[index] === i;
            optionsHTML += `
                <div class="option ${isSelected ? 'selected' : ''}" data-option="${i}">
                    ${option}
                </div>
            `;
        });

        questionContainer.innerHTML = `
            <div class="question">Question ${index + 1}/${this.currentQuiz.questions.length}: ${question.text}</div>
            <div class="options">${optionsHTML}</div>
        `;

        // Mise à jour de la navigation
        document.getElementById('prev-btn').disabled = index === 0;
        document.getElementById('next-btn').style.display = index < this.currentQuiz.questions.length - 1 ? 'block' : 'none';
        document.getElementById('submit-quiz').style.display = index === this.currentQuiz.questions.length - 1 ? 'block' : 'none';

        // Mise à jour de la barre de progression
        const progressPercent = ((index + 1) / this.currentQuiz.questions.length) * 100;
        document.getElementById('quiz-progress').style.width = `${progressPercent}%`;

        // Ajout des écouteurs d'événements pour les options
        this.addOptionEventListeners(index);
    }

    addOptionEventListeners(questionIndex) {
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', (e) => {
                const optionIndex = parseInt(option.getAttribute('data-option'));
                
                // Désélectionner toutes les options
                document.querySelectorAll('.option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                
                // Sélectionner l'option cliquée
                option.classList.add('selected');
                
                // Enregistrer la réponse
                this.userAnswers[questionIndex] = optionIndex;
            });
        });
    }

    startTimer(seconds) {
        this.timeLeft = seconds;
        clearInterval(this.timerInterval);
        
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                alert('Temps écoulé! Le quiz sera soumis automatiquement.');
                this.submitQuiz();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('quiz-timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async submitQuiz() {
        clearInterval(this.timerInterval);
        
        try {
            const token = localStorage.getItem('quizToken');
            const API_BASE_URL = await this.getActiveAPIUrl();
            
            const response = await fetch(`${API_BASE_URL}/api/quiz/${this.currentQuiz._id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ answers: this.userAnswers })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showResults(data);
            } else {
                alert('Erreur lors de la soumission du quiz: ' + data.message);
            }
        } catch (error) {
            console.error('Error submitting quiz:', error);
            alert('Erreur lors de la soumission du quiz');
        }
    }

    showResults(data) {
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
            const userAnswer = this.userAnswers[index];
            const correctAnswer = question.correctAnswers[0]; // Suppose une seule réponse correcte
            const isCorrect = userAnswer === correctAnswer;
            
            resultsHTML += `
                <div class="mb-4 p-3 ${isCorrect ? 'border-success' : 'border-danger'} border rounded">
                    <h5>Question ${index + 1}: ${question.text}</h5>
                    <p class="${isCorrect ? 'correct' : 'incorrect'}">
                        <strong>Votre réponse:</strong> ${userAnswer !== null ? question.options[userAnswer] : 'Aucune réponse'}
                        ${isCorrect ? '<i class="fas fa-check ms-2"></i>' : '<i class="fas fa-times ms-2"></i>'}
                    </p>
            `;

            if (!isCorrect) {
                resultsHTML += <p class="correct"><strong>Réponse correcte:</strong> ${question.options[correctAnswer]}</p>;
            }

            resultsHTML += `
                    <div class="justification">
                        <strong>Explication:</strong> ${question.justification}
                    </div>
                </div>
            `;
        });

        resultsContent.innerHTML = resultsHTML;

        // Afficher les résultats
        document.getElementById('question-container').style.display = 'none';
        document.getElementById('results-container').style.display = 'block';
    }

    showQuizList() {
        document.getElementById('quiz-interface').style.display = 'none';
        document.getElementById('quiz-section').style.display = 'block';
        document.getElementById('results-container').style.display = 'none';
        
        // Recharger les quiz pour mettre à jour les statuts
        this.loadQuizzes();
    }
}

// Initialisation différée pour s'assurer que l'application est chargée
setTimeout(() => {
    if (window.location.pathname.includes('quiz.html') || 
        window.location.pathname.includes('index.html') || 
        window.location.pathname === '/' || 
        window.location.pathname.endsWith('.html') === false) {
        console.log("Initialisation du module Quiz");
        window.quiz = new Quiz();
    }
}, 500);