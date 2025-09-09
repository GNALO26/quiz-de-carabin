import { CONFIG } from './config.js';

export class Quiz {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timerInterval = null;
        this.timeLeft = 0;
        this.quizzes = [];
        
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
        try {
            console.log("Début du chargement des quizs");
            
            // Vérifier si l'auth est chargé
            if (!window.auth) {
                console.error("Module d'authentification non chargé");
                this.showError("Erreur d'authentification. Veuillez actualiser la page.");
                return;
            }
            
            const token = window.auth.getToken();
            
            if (!token) {
                console.log("Utilisateur non authentifié, affichage de l'invite de connexion");
                this.showLoginPrompt();
                return;
            }

            console.log("Token JWT trouvé, tentative de chargement des quizs");
            
            const API_BASE_URL = await this.getActiveAPIUrl();
            console.log("URL de l'API:", API_BASE_URL);
            
            const response = await fetch(`${API_BASE_URL}/api/quiz`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("Réponse du serveur:", response.status, response.statusText);
            
            // Gestion spécifique des erreurs 401
            if (response.status === 401) {
                console.warn('Token expiré ou invalide, déconnexion...');
                if (window.auth && typeof window.auth.logout === 'function') {
                    window.auth.logout();
                }
                this.showLoginPrompt();
                return;
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erreur serveur:', response.status, errorText);
                throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log("Données reçues:", data);

            if (data.success) {
                console.log("Quizs chargés avec succès:", data.quizzes.length, "quizs trouvés");
                this.quizzes = data.quizzes;
                this.renderQuizzes();
            } else {
                console.error('Erreur dans la réponse:', data.message);
                this.showError('Erreur lors du chargement des quizzes: ' + data.message);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des quizs:', error);
            this.showError('Erreur de connexion au serveur. Veuillez réessayer.');
        }
    }

    renderQuizzes() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) {
            console.error("Element #quiz-list non trouvé dans le DOM");
            return;
        }
        
        console.log("Rendu des quizs dans l'interface");
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
            const isFree = quiz.free;
            const hasAccess = isFree || (window.auth && window.auth.isPremium());
            
            const quizCard = document.createElement('div');
            quizCard.className = 'col-md-6 mb-4';
            quizCard.innerHTML = `
                <div class="card quiz-card h-100">
                    <div class="card-body">
                        <span class="badge ${isFree ? 'badge-free' : 'bg-warning text-dark'} mb-2">
                            ${isFree ? 'GRATUIT' : 'PREMIUM'}
                        </span>
                        <h4 class="card-title">${quiz.title}</h4>
                        <p class="card-text">${quiz.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small><i class="fas fa-question-circle me-1"></i> ${quiz.questions.length} questions</small>
                            <small><i class="fas fa-clock me-1"></i> ${quiz.duration} minutes</small>
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
                
                if (!quiz.free && window.auth && !window.auth.isPremium()) {
                    // Rediriger vers l'abonnement
                    if (window.payment && typeof window.payment.initiatePayment === 'function') {
                        window.payment.initiatePayment();
                    }
                } else {
                    this.startQuiz(quizId);
                }
            });
        });
    }

    async startQuiz(quizId) {
        try {
            const token = window.auth.getToken();
            
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
                this.currentQuiz = data.quiz;
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill([]);
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
            const isSelected = this.userAnswers[index].includes(i);
            optionsHTML += `
                <div class="option ${isSelected ? 'selected' : ''}" data-option="${i}">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" ${isSelected ? 'checked' : ''}>
                        <label class="form-check-label">${option}</label>
                    </div>
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

        // Ajout des écouteurs d'événements pour les options
        this.addOptionEventListeners(index);
        
        // Configuration des boutons de navigation
        this.setupNavigationButtons(index);
    }

    addOptionEventListeners(questionIndex) {
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', (e) => {
                const optionIndex = parseInt(option.getAttribute('data-option'));
                const checkbox = option.querySelector('input[type="checkbox"]');
                
                // Basculer la sélection
                checkbox.checked = !checkbox.checked;
                
                if (checkbox.checked) {
                    option.classList.add('selected');
                    if (!this.userAnswers[questionIndex].includes(optionIndex)) {
                        this.userAnswers[questionIndex] = [...this.userAnswers[questionIndex], optionIndex];
                    }
                } else {
                    option.classList.remove('selected');
                    this.userAnswers[questionIndex] = this.userAnswers[questionIndex].filter(i => i !== optionIndex);
                }
            });
        });
    }

    setupNavigationButtons(index) {
        document.getElementById('prev-btn').onclick = () => {
            if (index > 0) this.showQuestion(index - 1);
        };
        
        document.getElementById('next-btn').onclick = () => {
            if (index < this.currentQuiz.questions.length - 1) this.showQuestion(index + 1);
        };
        
        document.getElementById('submit-quiz').onclick = () => this.submitQuiz();
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
            const token = window.auth.getToken();
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
        const results = data;
        
        // Construction du HTML des résultats
        let resultsHTML = `
            <div class="text-center mb-4">
                <h4>Votre score: ${results.score}/${results.totalQuestions}</h4>
                <div class="progress mb-3" style="height: 30px;">
                    <div class="progress-bar" role="progressbar" 
                         style="width: ${(results.score/results.totalQuestions)*100}%;" 
                         aria-valuenow="${(results.score/results.totalQuestions)*100}" 
                         aria-valuemin="0" aria-valuemax="100">
                        ${Math.round((results.score/results.totalQuestions)*100)}%
                    </div>
                </div>
            </div>
        `;

        // Détails des résultats pour chaque question
        this.currentQuiz.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const correctAnswers = question.correctAnswers;
            const isCorrect = userAnswer.length === correctAnswers.length && 
                             userAnswer.every(val => correctAnswers.includes(val));

            let userAnswerText = userAnswer.map(a => question.options[a]).join(', ') || 'Aucune réponse';
            let correctAnswerText = correctAnswers.map(a => question.options[a]).join(', ');

            resultsHTML += `
                <div class="mb-4 p-3 ${isCorrect ? 'border-success' : 'border-danger'} border rounded">
                    <h5>Question ${index + 1}: ${question.text}</h5>
                    <p class="${isCorrect ? 'correct' : 'incorrect'}">
                        <strong>Votre réponse:</strong> ${userAnswerText}
                        ${isCorrect ? '<i class="fas fa-check ms-2"></i>' : '<i class="fas fa-times ms-2"></i>'}
                    </p>
            `;

            if (!isCorrect) {
                resultsHTML += <p class="correct"><strong>Réponse correcte:</strong> ${correctAnswerText}</p>;
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

    showLoginPrompt() {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        quizList.innerHTML = `
            <div class="col-12 text-center">
                <p>Veuillez vous connecter pour accéder aux quizzes.</p>
                <button class="btn btn-primary" id="quiz-login-button">Se connecter</button>
            </div>
        `;
        
        document.getElementById('quiz-login-button').addEventListener('click', () => {
            // Ouvrir la modale de connexion
            if (window.auth && typeof window.auth.showLoginModal === 'function') {
                window.auth.showLoginModal();
            }
        });
    }

    showError(message) {
        const quizList = document.getElementById('quiz-list');
        if (!quizList) return;
        
        quizList.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    ${message}
                    <br>
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
}

// Initialisation automatique quand le DOM est chargé
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM chargé, initialisation du module Quiz");
    window.quiz = new Quiz();
});