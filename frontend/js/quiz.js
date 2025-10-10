import { CONFIG } from './config.js';

export class Quiz {
    constructor() {
        this.quizzes = [];
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        // Tableau de tableaux (une entrée par question, chaque entrée est un tableau d'indices de réponses choisies)
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
        // Bouton de retour aux quiz
        document.getElementById('back-to-quizzes')?.addEventListener('click', () => {
            this.showQuizList();
        });
        
        // Bouton de révision (utilisé dans la section des résultats pour revenir à la liste)
        document.getElementById('review-btn')?.addEventListener('click', () => {
            // En mode résultat, le bouton sert souvent de 'revenir à la liste'
            this.showQuizList();
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
        sortedSubjects.forEach(subject => {
            const quizzes = quizzesBySubject[subject];
            
            // Créer le conteneur de la matière
            const subjectSection = document.createElement('div');
            subjectSection.className = 'col-12 mb-5 animate-fadeInUp';
            
            // Titre de la matière
            subjectSection.innerHTML = `
                <div class="subject-header mb-4 mt-4">
                    <h3 class="fw-bold text-primary">${subject}</h3>
                    <hr class="mt-2 mb-4" style="border-top: 3px solid var(--secondary); opacity: 1;">
                </div>
                <div class="row" id="subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}">
                    </div>
            `;
            
            quizList.appendChild(subjectSection);
            
            const subjectRow = document.getElementById(`subject-row-${subject.replace(/\s+/g, '-').toLowerCase()}`);

            // Rendre les cartes de quiz pour cette matière
            quizzes.forEach(quiz => {
                const isFree = quiz.free || false;
                // Vérifier si window.app.auth est défini avant d'appeler isPremium
                const hasAccess = isFree || (window.app && window.app.auth && window.app.auth.isPremium && window.app.auth.isPremium());
                
                const quizCard = document.createElement('div');
                quizCard.className = 'col-md-4 mb-4';
                quizCard.innerHTML = `
                    <div class="card quiz-card h-100">
                        <div class="card-body">
                            <span class="badge ${isFree ? 'badge-free' : 'bg-warning text-dark'} mb-2">
                                ${isFree ? 'GRATUIT' : 'PREMIUM'}
                            </span>
                            <h5 class="card-title">${quiz.title}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">${quiz.category}</h6> 
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
                subjectRow.appendChild(quizCard);
            });
        });

        this.addQuizEventListeners();
    }
    
    addQuizEventListeners() {
        document.querySelectorAll('.start-quiz').forEach(button => {
            button.addEventListener('click', (e) => {
                const quizId = e.target.getAttribute('data-quiz-id');
                const quiz = this.quizzes.find(q => q._id === quizId);
                
                if (!quiz) return;
                
                // Si non-gratuit et pas Premium (on fait une double vérification)
                if (!quiz.free && window.app.auth && !window.app.auth.isPremium()) {
                    // Rediriger vers l'abonnement
                    if (window.app.payment && typeof window.app.payment.initiatePayment === 'function') {
                        // Ouvre la section de paiement ou modal si elle existe
                        console.log("Accès Premium requis. Tentative d'ouverture du modal de paiement.");
                        window.app.payment.showPaymentModal(); // Assurez-vous que cette fonction existe
                    } else {
                         // Afficher l'alerte si le module de paiement n'est pas prêt
                         alert("Abonnement Premium requis pour ce quiz. Veuillez vous abonner.");
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

    // 🛑 CORRECTION MAJEURE: Masquage des sections et gestion du 403
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
            
            // 🛠 Gestion explicite de l'erreur 403 (Accès Premium refusé par le backend)
            if (response.status === 403) {
                const errorData = await response.json();
                alert(errorData.message || 'Accès Premium requis pour ce quiz.');
                // Rediriger vers l'abonnement/afficher la modal de paiement si elle existe
                if (window.app.payment && typeof window.app.payment.showPaymentModal === 'function') {
                    window.app.payment.showPaymentModal();
                }
                return; // Arrêter le processus ici
            }

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.currentQuiz = data.quiz || data.data;
                // Initialiser userAnswers comme un tableau de tableaux vides
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill().map(() => []);
                this.currentQuestionIndex = 0;

                // 🛠 CORRECTION: Utiliser les ID des sections pour basculer la vue
                const quizListSection = document.getElementById('quiz-list-section'); 
                const quizInterface = document.getElementById('quiz-interface');
                const resultsContainer = document.getElementById('results-container');
                
                if (quizListSection) quizListSection.style.display = 'none';
                if (resultsContainer) resultsContainer.style.display = 'none'; // S'assurer que les résultats sont cachés
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

        // Assurez-vous que l'interface de quiz est visible et le conteneur de question affiché
        document.getElementById('question-container').style.display = 'block';
        document.getElementById('results-container').style.display = 'none';

        let optionsHTML = '';
        question.options.forEach((option, i) => {
            const isSelected = this.userAnswers[index].includes(i);
            optionsHTML += `
                <div class="option">
                    <input type="checkbox" id="option-${i}" data-index="${i}" ${isSelected ? 'checked' : ''}>
                    <label for="option-${i}">${option.text}</label>
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
                        // Trier les réponses pour un envoi cohérent au backend
                        this.userAnswers[questionIndex].sort((a, b) => a - b);
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
        // La sauvegarde est gérée en temps réel par addOptionEventListeners
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
            
            // Format structuré pour la soumission
            const submissionAnswers = this.userAnswers.map((selectedOptions, questionIndex) => ({
                questionIndex: questionIndex,
                selectedOptions: selectedOptions 
            }));

            const response = await fetch(`${API_BASE_URL}/api/quiz/${this.currentQuiz._id}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    answers: submissionAnswers, // Utilisation du format structuré
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

    /**
     * Affiche les résultats du quiz avec une correction détaillée (format révision).
     * @param {object} data Les données de résultats renvoyées par l'API (score, correction).
     */
    showResults(data) {
        const quizInterface = document.getElementById('quiz-interface');
        const resultsContainer = document.getElementById('results-container');
        const resultsContent = document.getElementById('results-content');
        
        // S'assurer que data.totalQuestions existe ou utiliser la taille du quiz
        const totalQuestions = data.totalQuestions || this.currentQuiz.questions.length;
        const scorePercent = Math.round((data.score / totalQuestions) * 100);
        
        // --- 1. MISE À JOUR DU SCORE ET DU MESSAGE GLOBAL ---
        
        // Mettre à jour le score global
        // Assurez-vous d'avoir un élément avec l'ID 'total-score' dans votre HTML
        const totalScoreElement = document.getElementById('total-score');
        if (totalScoreElement) totalScoreElement.textContent = `${data.score}/${totalQuestions}`;
        
        // Mettre à jour la valeur du cercle
        const scoreValueElement = document.getElementById('score-value');
        if (scoreValueElement) scoreValueElement.textContent = scorePercent; 

        // Déterminer le message en fonction du score
        let scoreText = '';
        let scoreDescription = '';
        let scoreColor = 'text-danger';

        if (scorePercent >= 80) {
            scoreText = 'Excellent!';
            scoreDescription = 'Vous maîtrisez parfaitement ce sujet!';
            scoreColor = 'text-success';
        } else if (scorePercent >= 60) {
            scoreText = 'Bon travail!';
            scoreDescription = 'Vous avez une bonne compréhension de ce sujet.';
            scoreColor = 'text-warning';
        } else {
            scoreText = 'À améliorer';
            scoreDescription = 'Continuez à étudier, vous vous améliorerez!';
        }
        
        const scoreTextElement = document.getElementById('score-text');
        if (scoreTextElement) {
            scoreTextElement.textContent = scoreText;
            scoreTextElement.className = fw-bold `${scoreColor}`;
        }
        
        const scoreDescElement = document.getElementById('score-description');
        if (scoreDescElement) scoreDescElement.textContent = scoreDescription;
        

        // --- 2. CONSTRUCTION DU HTML DE CORRECTION DÉTAILLÉE ---
        let resultsHTML = '';
        
        this.currentQuiz.questions.forEach((question, index) => {
            // L'API devrait idéalement renvoyer un tableau results
            // contenant l'état de correction de chaque question.
            // On utilise les données du quiz local si les données de correction ne sont pas détaillées
            const correctionData = data.results && data.results[index] ? data.results[index] : {};
            
            // Logique de correction (simplifiée si le backend ne donne que le score total)
            // On fait ici une vérification stricte basé sur les données locales du quiz et les réponses utilisateur
            const correctAnswersIndexes = question.correctAnswers || [];
            const userAnswerIndexes = this.userAnswers[index] || [];

            const isCorrect = userAnswerIndexes.length === correctAnswersIndexes.length && 
                              userAnswerIndexes.every(val => correctAnswersIndexes.includes(val));
            
            // Style basé sur le statut
            const statusClass = isCorrect ? 'border-success-subtle bg-success-subtle' : 'border-danger-subtle bg-danger-subtle';
            const statusIcon = isCorrect ? '<i class="fas fa-check-circle text-success ms-2"></i>' : '<i class="fas fa-times-circle text-danger ms-2"></i>';
            const questionLetter = (index + 1).toString().padStart(2, '0');

            resultsHTML += `
                <div class="card mb-4 shadow-sm ${statusClass}">
                    <div class="card-body">
                        <h6 class="card-title fw-bold text-dark">
                            <span class="text-primary me-2">${questionLetter}.</span> ${question.text} ${statusIcon}
                        </h6>
                        <hr>
                        
                        <div class="options-review">
            `;
            
            // Parcourir les options pour marquer la sélection de l'utilisateur et la correction
            question.options.forEach((option, oIndex) => {
                const isSelected = userAnswerIndexes.includes(oIndex);
                const isCorrectAnswer = correctAnswersIndexes.includes(oIndex);
                
                let optionClass = '';
                let optionIcon = '';
                
                if (isCorrectAnswer) {
                    // Option correcte
                    optionClass = 'text-success fw-bold';
                    optionIcon = '<i class="fas fa-check-square me-2"></i>';
                }
                
                if (isSelected && !isCorrectAnswer) {
                    // Option sélectionnée mais incorrecte
                    optionClass = 'text-danger text-decoration-line-through';
                    optionIcon = '<i class="fas fa-times-circle me-2"></i>';
                } else if (isSelected && isCorrectAnswer) {
                    // Option sélectionnée et correcte
                    optionClass = 'text-success fw-bold';
                    optionIcon = '<i class="fas fa-check-double me-2"></i>';
                } else if (isCorrectAnswer) {
                     // Option correcte non sélectionnée (pour la révision)
                    optionClass = 'text-success'; 
                    optionIcon = '<i class="fas fa-check me-2"></i>';
                } else {
                    // Option non sélectionnée et non correcte
                    optionClass = 'text-muted';
                    optionIcon = '<i class="far fa-circle me-2"></i>';
                }

                resultsHTML += `
                    <div class="option-item ${optionClass}">
                        ${optionIcon}
                        <span>${String.fromCharCode(97 + oIndex)}) ${option.text}</span>
                    </div>
                `;
            });

            resultsHTML += `
                        </div>
                        
                        <div class="justification mt-3 p-3 border-top border-info-subtle bg-info-subtle rounded">
                            <p class="mb-1 fw-bold text-info"><i class="fas fa-info-circle me-1"></i> Explication:</p>
                            <p class="mb-0">${question.justification || 'Pas de justification disponible.'}</p>
                        </div>
                    </div>
                </div>
            `;
        });

        resultsContent.innerHTML = resultsHTML;

        // Afficher la section des résultats et masquer l'interface du quiz
        if (quizInterface) quizInterface.style.display = 'none';
        if (resultsContainer) resultsContainer.style.display = 'block';

        // Le bouton de révision (review-btn) n'est plus nécessaire si cette vue est déjà la révision
        const reviewBtn = document.getElementById('review-btn');
        if (reviewBtn) reviewBtn.style.display = 'none'; 
    }

    showQuizList() {
        document.getElementById('quiz-interface').style.display = 'none';
        // 🛠 CORRECTION: Utiliser l'ID de section nouvellement ajouté
        const quizListSection = document.getElementById('quiz-list-section');
        if (quizListSection) quizListSection.style.display = 'block';
        document.getElementById('results-container').style.display = 'none';
        
        // Recharger les quiz pour mettre à jour les statuts
        this.loadQuizzes();
    }
}