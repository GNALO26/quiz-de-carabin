// Animations des compteurs
function animateCounters() {
    const counters = document.querySelectorAll('.counter');
    
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                counter.textContent = target + '+';
                clearInterval(timer);
            } else {
                counter.textContent = Math.floor(current) + '+';
            }
        }, 16);
    });
}

// Animation au scroll
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fadeInUp');
                if (entry.target.classList.contains('counter')) {
                    animateCounters();
                }
            }
        });
    }, observerOptions);

    // Observer les éléments à animer
    document.querySelectorAll('.quiz-card, .feature-card, .counter').forEach(el => {
        observer.observe(el);
    });
}

// Amélioration des tooltips
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    initScrollAnimations();
    initTooltips();
    
    // Animation pour les cartes de quiz
    const quizCards = document.querySelectorAll('.quiz-card');
    quizCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
});

// Fonction pour mettre à jour le score circle
function updateScoreCircle(scoreElement, percentage) {
    const circle = scoreElement.querySelector('.score-circle');
    circle.style.background = `conic-gradient(var(--primary-color) ${percentage}%, #e2e8f0 ${percentage}%)`;
}