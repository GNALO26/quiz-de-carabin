import { CONFIG } from './config.js';

export class Quiz {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = []; // Ce sera un tableau de tableaux (une entrée par question, chaque entrée est un tableau d'indices de réponses choisies)
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
        // Bouton de retour aux quiz
        document.getElementById('back-to-quizzes')?.addEventListener('click', () => {
            this.showQuizList();
        });
        
        // Bouton de révision
        document.getElementById('review-btn')?.addEventListener('click', () => {
            this.showQuestion(0);
        });

        // Bouton précédent
        document.getElementById('prev-btn')?.addEventListener('click', () => {
            this.prevQuestion();
        });

        // Bouton suivant
        document.getElementById('next-btn')?.addEventListener('click', () => {
            this.nextQuestion();
        });

        // Bouton soumettre
        document.getElementById('submit-quiz')?.addEventListener('click', () => {
            this.submitQuiz();
        });
    }

    // js/quiz.js
async loadQuizzes() {
    console.log('Début du chargement des quizs');
    
    // Afficher le loader
    this.showLoader();
    
    try {
        const API_BASE_URL = await this.getActiveAPIUrl();
        
        // Préparer les headers
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Ajouter le token seulement s'il est disponible et valide
        const token = localStorage.getItem('quizToken');
        if (token && token !== 'null' && token !== 'undefined') {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/api/quiz`, {
            headers: headers
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

    //  (Méthode displayQuizzes)
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
            // ... (Message d'aucun quiz inchangé)
            quizList.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        Aucun quiz disponible pour le moment.
                        (Veuillez actualiser la page)
                    </div>
                </div>
            `;
            return;
        }

        // 1. REGROUPEMENT PAR MATIÈRE (SUBJECT)
        const quizzesBySubject = this.quizzes.reduce((acc, quiz) => {
            const subject = quiz.subject || 'Autres'; // Utiliser 'Autres' si le champ est manquant
            if (!acc[subject]) {
                acc[subject] = [];
            }
            acc[subject].push(quiz);
            return acc;
        }, {});
        
        // Trier les matières (optionnel)
        const sortedSubjects = Object.keys(quizzesBySubject).sort();

        // 2. RENDU DYNAMIQUE PAR MATIÈRE
        // Vérifie si nous sommes sur la page d'accueil (index.html)
        const isHomePage = window.location.pathname.endsWith('/') || 
                           window.location.pathname.endsWith('index.html');
        // Limite d'affichage pour la page d'accueil
        const MAX_QUIZZES_DISPLAY_HOME = 3; 

        sortedSubjects.forEach(subject => {
            let quizzes = quizzesBySubject[subject];
            
            // Applique la limite si on est sur la page d'accueil
            if (isHomePage) {
                // On garde une référence à tous les quiz pour le "voir plus tard"
                const totalQuizzes = quizzes.length; 
                quizzes = quizzes.slice(0, MAX_QUIZZES_DISPLAY_HOME);
                if (quizzes.length === 0) return; // Ne pas afficher la section si vide
            }
            
            // Créer le conteneur principal de la MATIÈRE
            const subjectSection = document.createElement('div');
            subjectSection.className = 'col-12 mb-5 animate-fadeInUp';
            
            // Structure de la matière (Titre de la matière + Séparateur)
            subjectSection.innerHTML = `
                <div class="subject-header mb-4 mt-4">
                    <h3 class="fw-bold text-primary">${subject}</h3>
                    <hr class="mt-2 mb-4" style="border-top: 3px solid var(--secondary); opacity: 1;">
                </div>
                <div class="row" id="subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}">
                    </div>
            `;
            
            quizList.appendChild(subjectSection);
            const subjectRow = subjectSection.querySelector('.row');

            // Rendre les cartes de quiz pour cette matière
            quizzes.forEach(quiz => {
                // ... (Le code de création de la carte quiz va ici) ...
                const quizCard = document.createElement('div');
                quizCard.className = 'col-md-4 mb-4';
                // ... (Remplissez InnerHTML de la carte ici) ...
                subjectRow.appendChild(quizCard);
            });
            
            // 💡 Ajout du bouton "Voir plus" pour la page d'accueil
            if (isHomePage && totalQuizzes > MAX_QUIZZES_DISPLAY_HOME) {
                 const seeMoreContainer = document.createElement('div');
                 seeMoreContainer.className = 'col-12 text-center mt-3';
                 seeMoreContainer.innerHTML = `
                    <a href="quiz.html" class="btn btn-outline-primary">
                        Voir les ${totalQuizzes} quiz de ${subject} <i class="fas fa-arrow-right ms-2"></i>
                    </a>
                 `;
                 subjectRow.appendChild(seeMoreContainer);
            }
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
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.currentQuiz = data.quiz || data.data;
                // Initialiser userAnswers comme un tableau de tableaux vides
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill().map(() => []);
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
                throw new Error(data.message || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Error starting quiz:', error);
            alert('Erreur lors du chargement du quiz: ' + error.message);
            this.showQuizList();
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
                <div class="option">
                    <input type="checkbox" id="option-${i}" data-index="${i}" ${isSelected ? 'checked' : ''}>
                    <label for="option-${i}">${option}</label>
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
        document.querySelectorAll('.option input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const optionIndex = parseInt(e.target.getAttribute('data-index'));
                
                if (e.target.checked) {
                    // Ajouter l'index de l'option si coché
                    if (!this.userAnswers[questionIndex].includes(optionIndex)) {
                        this.userAnswers[questionIndex].push(optionIndex);
                    }
                } else {
                    // Retirer l'index de l'option si décoché
                    this.userAnswers[questionIndex] = this.userAnswers[questionIndex].filter(idx => idx !== optionIndex);
                }
            });
        });
    }

    nextQuestion() {
        this.saveCurrentAnswers();
        if (this.currentQuestionIndex < this.currentQuiz.questions.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        }
    }

    prevQuestion() {
        this.saveCurrentAnswers();
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    saveCurrentAnswers() {
        // Cette fonction est appelée lors du changement de question pour s'assurer que les réponses sont bien enregistrées
        // Mais avec les checkboxes, nous enregistrons en temps réel, donc cette fonction peut être vide
        // Ou on peut l'utiliser pour forcer la sauvegarde si nécessaire
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
                body: JSON.stringify({ 
                    answers: this.userAnswers,
                    timeSpent: (this.currentQuiz.duration * 60) - this.timeLeft
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.showResults(data);
            } else {
                alert('Erreur lors de la soumission du quiz: ' + data.message);
            }
        } catch (error) {
            console.error('Error submitting quiz:', error);
            alert('Erreur lors de la soumission du quiz: ' + error.message);
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
            const userAnswer = this.userAnswers[index] || [];
            const correctAnswers = question.correctAnswers;
            const isCorrect = userAnswer.length === correctAnswers.length && 
                              userAnswer.every(val => correctAnswers.includes(val));
            
            resultsHTML += `
                <div class="mb-4 p-3 ${isCorrect ? 'border-success' : 'border-danger'} border rounded">
                    <h5>Question ${index + 1}: ${question.text}</h5>
                    <p class="${isCorrect ? 'correct' : 'incorrect'}">
                        <strong>Vos réponses:</strong> 
                        ${userAnswer.length > 0 ? userAnswer.map(idx => question.options[idx]).join(', ') : 'Aucune réponse'}
                        ${isCorrect ? '<i class="fas fa-check ms-2"></i>' : '<i class="fas fa-times ms-2"></i>'}
                    </p>
            `;

            if (!isCorrect) {
                resultsHTML += `<p class="correct"><strong>Réponses correctes:</strong> ${correctAnswers.map(idx => question.options[idx]).join(', ')}</p>`;
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