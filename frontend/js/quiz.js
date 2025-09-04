class Quiz {
    constructor() {
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timerInterval = null;
        this.timeLeft = 0;
    }

    async loadQuizzes() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/quiz`);
            const data = await response.json();

            if (data.success) {
                this.quizzes = data.data;
                this.renderQuizzes();
            } else {
                console.error('Failed to load quizzes');
            }
        } catch (error) {
            console.error('Error loading quizzes:', error);
        }
    }

    renderQuizzes() {
        const quizList = document.getElementById('quiz-list');
        quizList.innerHTML = '';

        this.quizzes.forEach(quiz => {
            const isFree = quiz.free;
            const quizCard = document.createElement('div');
            quizCard.className = 'col-md-6 mb-4';
            quizCard.innerHTML = `
                <div class="card quiz-card h-100">
                    <div class="card-body">
                        <span class="badge ${isFree ? 'badge-free' : 'bg-warning text-dark'} mb-2">${isFree ? 'GRATUIT' : 'PREMIUM'}</span>
                        <h4 class="card-title">${quiz.title}</h4>
                        <p class="card-text">${quiz.description}</p>
                        <div class="d-flex justify-content-between align-items-center">
                            <small><i class="fas fa-question-circle me-1"></i> ${quiz.questions.length} questions</small>
                            <small><i class="fas fa-clock me-1"></i> ${quiz.duration} minutes</small>
                        </div>
                    </div>
                    <div class="card-footer bg-white">
                        <button class="btn ${isFree ? 'btn-outline-primary' : 'btn-primary'} w-100 start-quiz" data-quiz-id="${quiz._id}">
                            ${isFree ? 'Commencer le quiz' : 'Accéder (5.000 XOF)'}
                        </button>
                    </div>
                </div>
            `;
            quizList.appendChild(quizCard);
        });

        // Add event listeners to quiz buttons
        document.querySelectorAll('.start-quiz').forEach(button => {
            button.addEventListener('click', (e) => {
                const quizId = e.target.getAttribute('data-quiz-id');
                this.startQuiz(quizId);
            });
        });
    }

    async startQuiz(quizId) {
        try {
            const token = auth.getToken();
            const response = await fetch(`${API_BASE_URL}/api/quiz/${quizId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (data.success) {
                this.currentQuiz = data.data;
                this.userAnswers = new Array(this.currentQuiz.questions.length).fill([]);
                this.currentQuestionIndex = 0;

                // Hide main content and show quiz interface
                document.getElementById('quiz-section').style.display = 'none';
                document.getElementById('quiz-interface').style.display = 'block';

                // Initialize quiz
                document.getElementById('quiz-title').textContent = this.currentQuiz.title;
                this.showQuestion(0);
                this.startTimer(this.currentQuiz.duration * 60);
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Error starting quiz:', error);
        }
    }

    showQuestion(index) {
        const question = this.currentQuiz.questions[index];
        const questionContainer = document.getElementById('question-container');

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
            <div class="options">
                ${optionsHTML}
            </div>
        `;

        // Update navigation buttons
        document.getElementById('prev-btn').disabled = index === 0;
        document.getElementById('next-btn').style.display = index < this.currentQuiz.questions.length - 1 ? 'block' : 'none';
        document.getElementById('submit-quiz').style.display = index === this.currentQuiz.questions.length - 1 ? 'block' : 'none';

        // Add event listeners to options
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', (e) => {
                const optionIndex = parseInt(option.getAttribute('data-option'));
                const checkbox = option.querySelector('input[type="checkbox"]');

                // Toggle selection
                checkbox.checked = !checkbox.checked;

                if (checkbox.checked) {
                    option.classList.add('selected');
                    // Add to selected answers
                    if (!this.userAnswers[index].includes(optionIndex)) {
                        this.userAnswers[index] = [...this.userAnswers[index], optionIndex];
                    }
                } else {
                    option.classList.remove('selected');
                    // Remove from selected answers
                    this.userAnswers[index] = this.userAnswers[index].filter(i => i !== optionIndex);
                }
            });
        });

        // Add event listeners to navigation buttons
        document.getElementById('prev-btn').onclick = () => this.showQuestion(index - 1);
        document.getElementById('next-btn').onclick = () => this.showQuestion(index + 1);
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
        document.getElementById('quiz-timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async submitQuiz() {
        clearInterval(this.timerInterval);

        try {
            const token = auth.getToken();
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
                this.showResults(data.data);
            } else {
                alert('Erreur lors de la soumission du quiz');
            }
        } catch (error) {
            console.error('Error submitting quiz:', error);
        }
    }

    showResults(results) {
        const resultsContent = document.getElementById('results-content');
        resultsContent.innerHTML = `
            <div class="text-center mb-4">
                <h4>Votre score: ${results.score}/${results.totalQuestions}</h4>
                <div class="progress mb-3" style="height: 30px;">
                    <div class="progress-bar" role="progressbar" style="width: ${(results.score/results.totalQuestions)*100}%;" 
                        aria-valuenow="${(results.score/results.totalQuestions)*100}" aria-valuemin="0" aria-valuemax="100">
                        ${Math.round((results.score/results.totalQuestions)*100)}%
                    </div>
                </div>
            </div>
        `;

        // Add detailed results for each question
        this.currentQuiz.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const correctAnswers = question.correctAnswers;
            const isCorrect = userAnswer.length === correctAnswers.length && 
                             userAnswer.every(val => correctAnswers.includes(val));

            let userAnswerText = userAnswer.map(a => question.options[a]).join(', ') || 'Aucune réponse';
            let correctAnswerText = correctAnswers.map(a => question.options[a]).join(', ');

            resultsContent.innerHTML += `
                <div class="mb-4 p-3 ${isCorrect ? 'border-success' : 'border-danger'} border rounded">
                    <h5>Question ${index + 1}: ${question.text}</h5>
                    <p class="${isCorrect ? 'correct' : 'incorrect'}">
                        <strong>Votre réponse:</strong> ${userAnswerText}
                        ${isCorrect ? '<i class="fas fa-check ms-2"></i>' : '<i class="fas fa-times ms-2"></i>'}
                    </p>
                    ${!isCorrect ? <p class="correct"><strong>Réponse correcte:</strong> ${correctAnswerText}</p> : ''}
                    <div class="justification">
                        <strong>Explication:</strong> ${question.justification}
                    </div>
                </div>
            `;
        });

        // Hide question container and show results
        document.getElementById('question-container').style.display = 'none';
        document.getElementById('results-container').style.display = 'block';
    }
}

const quiz = new Quiz();