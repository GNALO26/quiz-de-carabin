/**
 * ================================================================
 * DASHBOARD JAVASCRIPT - QUIZ DE CARABIN
 * ================================================================
 * Gère toute la logique du dashboard et les graphiques
 * À placer dans: frontend/js/dashboard.js
 * ================================================================
 */

// ===========================
// VARIABLES GLOBALES
// ===========================
let performanceChart = null;
let currentPeriod = 30;

// ===========================
// INITIALISATION
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
  // Vérifier l'authentification
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/index.html';
    return;
  }

  // Charger le nom de l'utilisateur
  loadUserName();

  // Charger toutes les données
  await loadDashboard();

  // Event listeners
  setupEventListeners();
});

// ===========================
// CHARGEMENT DES DONNÉES
// ===========================
async function loadDashboard() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  loadingOverlay.classList.remove('hidden');

  try {
    // Charger toutes les données en parallèle
    const [dashboardData, performanceData, recommendations] = await Promise.all([
      fetchDashboardData(),
      fetchPerformanceData(currentPeriod),
      fetchRecommendations()
    ]);

    // Afficher les données
    if (dashboardData) {
      displayGlobalStats(dashboardData.global);
      displaySubjectProgress(dashboardData.bySubject);
      displayReviewList(dashboardData.toReview);
      displayRecentActivity(dashboardData.recentActivity);
      displayWeaknesses(dashboardData.weaknesses);
    }

    // Afficher le graphique
    if (performanceData) {
      displayPerformanceChart(performanceData);
    }

    // Afficher les recommandations
    if (recommendations) {
      displayRecommendations(recommendations);
    }

    // Afficher les achievements (placeholder)
    displayAchievements();

  } catch (error) {
    console.error('Erreur chargement dashboard:', error);
    showError('Impossible de charger les données. Veuillez réessayer.');
  } finally {
    loadingOverlay.classList.add('hidden');
  }
}

// ===========================
// APPELS API
// ===========================
async function fetchDashboardData() {
  try {
    const response = await fetch(`${API_URL}/api/stats/dashboard`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur API');
    }

    return data.data;
  } catch (error) {
    console.error('Erreur fetchDashboardData:', error);
    return null;
  }
}

async function fetchPerformanceData(period) {
  try {
    const response = await fetch(`${API_URL}/api/stats/performance-chart?period=${period}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur API');
    }

    return data.data;
  } catch (error) {
    console.error('Erreur fetchPerformanceData:', error);
    return null;
  }
}

async function fetchRecommendations() {
  try {
    const response = await fetch(`${API_URL}/api/stats/recommendations`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur API');
    }

    return data.data;
  } catch (error) {
    console.error('Erreur fetchRecommendations:', error);
    return null;
  }
}

// ===========================
// AFFICHAGE DES STATS GLOBALES
// ===========================
function displayGlobalStats(stats) {
  document.getElementById('totalQuizzes').textContent = stats.totalQuizzes || 0;
  document.getElementById('averageMastery').textContent = Math.round(stats.averageMastery || 0) + '%';
  document.getElementById('masteredQuizzes').textContent = stats.masteredQuizzes || 0;
  document.getElementById('totalAttempts').textContent = stats.totalAttempts || 0;

  // Animation des chiffres
  animateNumbers();
}

function animateNumbers() {
  const statCards = document.querySelectorAll('.stat-card h3');
  statCards.forEach(card => {
    const finalValue = parseInt(card.textContent);
    let currentValue = 0;
    const increment = Math.ceil(finalValue / 50);
    const isPercentage = card.textContent.includes('%');

    const timer = setInterval(() => {
      currentValue += increment;
      if (currentValue >= finalValue) {
        currentValue = finalValue;
        clearInterval(timer);
      }
      card.textContent = currentValue + (isPercentage ? '%' : '');
    }, 20);
  });
}

// ===========================
// GRAPHIQUE DE PERFORMANCE
// ===========================
function displayPerformanceChart(data) {
  const ctx = document.getElementById('performanceChart');
  
  if (!ctx || !data.chartData || data.chartData.length === 0) {
    ctx.parentElement.innerHTML = '<p style="text-align: center; color: #b8b8d1; padding: 40px;">Aucune donnée de performance disponible pour cette période.</p>';
    return;
  }

  // Détruire le graphique existant
  if (performanceChart) {
    performanceChart.destroy();
  }

  // Préparer les données
  const labels = data.chartData.map(item => {
    const date = new Date(item.date);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  });

  const scores = data.chartData.map(item => item.averageScore);
  const quizCounts = data.chartData.map(item => item.quizzesCompleted);

  // Créer le graphique
  performanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Score Moyen (%)',
          data: scores,
          borderColor: 'rgb(0, 212, 255)',
          backgroundColor: 'rgba(0, 212, 255, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: 'rgb(0, 212, 255)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        },
        {
          label: 'Quiz Complétés',
          data: quizCounts,
          borderColor: 'rgb(102, 126, 234)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: 'rgb(102, 126, 234)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#b8b8d1',
            font: {
              size: 13,
              weight: '600'
            },
            padding: 20,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 46, 0.95)',
          titleColor: '#fff',
          bodyColor: '#b8b8d1',
          borderColor: 'rgba(0, 212, 255, 0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.datasetIndex === 0) {
                label += context.parsed.y + '%';
              } else {
                label += context.parsed.y + ' quiz';
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#b8b8d1',
            font: {
              size: 11
            }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#b8b8d1',
            font: {
              size: 11
            },
            callback: function(value) {
              return value + '%';
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            color: '#b8b8d1',
            font: {
              size: 11
            }
          }
        }
      }
    }
  });
}

// ===========================
// PROGRESSION PAR MATIÈRE
// ===========================
function displaySubjectProgress(subjects) {
  const container = document.getElementById('subjectProgressList');
  
  if (!subjects || subjects.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #b8b8d1;">Aucune matière commencée pour le moment.</p>';
    return;
  }

  container.innerHTML = subjects.map(subject => `
    <div class="subject-item">
      <div class="subject-header">
        <span class="subject-name">${subject.subject || 'Matière'}</span>
        <span class="mastery-badge">${Math.round(subject.averageMastery || 0)}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${subject.averageMastery || 0}%"></div>
      </div>
      <div class="subject-stats">
        <span>📚 ${subject.totalQuizzes || 0} quiz</span>
        <span>✅ ${subject.masteredQuizzes || 0} maîtrisés</span>
        <span>📊 ${subject.progressPercentage || 0}% complétés</span>
      </div>
    </div>
  `).join('');
}

// ===========================
// LISTE DES RÉVISIONS
// ===========================
function displayReviewList(reviews) {
  const container = document.getElementById('reviewList');
  const badge = document.getElementById('reviewCount');
  
  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #b8b8d1; padding: 20px;">🎉 Aucun quiz à réviser pour le moment !</p>';
    badge.textContent = '0';
    return;
  }

  badge.textContent = reviews.length;

  container.innerHTML = reviews.map(review => `
    <div class="review-item ${review.isUrgent ? 'urgent' : ''}">
      <div class="review-title">${review.title}</div>
      <div class="review-meta">
        <span>📚 ${review.subject}</span>
        <span>🎯 ${review.mastery}% - ${review.masteryLevel}</span>
        ${review.daysOverdue > 0 ? `<span style="color: var(--danger-color)">⚠️ ${review.daysOverdue}j de retard</span>` : ''}
      </div>
      <button class="review-btn" onclick="startQuiz('${review.quizId}')">
        ${review.isUrgent ? '⚡ Réviser Maintenant' : '📖 Réviser'}
      </button>
    </div>
  `).join('');
}

// ===========================
// RECOMMANDATIONS
// ===========================
function displayRecommendations(data) {
  const container = document.getElementById('recommendationsList');
  
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #b8b8d1;">Aucune recommandation pour le moment.</p>';
    return;
  }

  container.innerHTML = data.recommendations.map(rec => `
    <div class="recommendation-item">
      <span class="recommendation-priority priority-${rec.priority}">${rec.priority}</span>
      <div class="recommendation-title">${rec.title}</div>
      <div class="recommendation-desc">${rec.description}</div>
    </div>
  `).join('');
}

// ===========================
// POINTS FAIBLES
// ===========================
function displayWeaknesses(weaknesses) {
  const container = document.getElementById('weaknessesList');
  
  if (!weaknesses || weaknesses.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #b8b8d1;">Aucun point faible identifié ! 💪</p>';
    return;
  }

  container.innerHTML = weaknesses.map(quiz => `
    <div class="weakness-item">
      <div class="item-info">
        <div class="item-title">${quiz.title}</div>
        <div class="item-meta">${quiz.subject} • ${quiz.attempts} tentative(s)</div>
      </div>
      <div class="mastery-mini mastery-low">${quiz.mastery}%</div>
    </div>
  `).join('');
}

// ===========================
// ACTIVITÉ RÉCENTE
// ===========================
function displayRecentActivity(activities) {
  const container = document.getElementById('recentActivityList');
  
  if (!activities || activities.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #b8b8d1;">Aucune activité récente.</p>';
    return;
  }

  container.innerHTML = activities.map(activity => {
    const masteryClass = activity.mastery >= 75 ? 'mastery-high' : 
                        activity.mastery >= 50 ? 'mastery-medium' : 'mastery-low';
    
    const dateStr = new Date(activity.date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });

    return `
      <div class="activity-item">
        <div class="item-info">
          <div class="item-title">${activity.title}</div>
          <div class="item-meta">${activity.subject} • ${dateStr} • Score: ${activity.lastScore}%</div>
        </div>
        <div class="mastery-mini ${masteryClass}">${activity.mastery}%</div>
      </div>
    `;
  }).join('');
}

// ===========================
// ACHIEVEMENTS
// ===========================
function displayAchievements() {
  const container = document.getElementById('achievementsList');
  
  const achievements = [
    { icon: '🎯', title: 'Premier Quiz', desc: 'Complétez votre premier quiz', unlocked: true },
    { icon: '🔥', title: 'Série de 3', desc: 'Complétez 3 quiz d\'affilée', unlocked: false },
    { icon: '💯', title: 'Score Parfait', desc: 'Obtenez 100% à un quiz', unlocked: false },
    { icon: '📚', title: 'Étudiant Assidu', desc: 'Complétez 10 quiz', unlocked: false },
    { icon: '🧠', title: 'Maître', desc: 'Maîtrisez 5 quiz (90%+)', unlocked: false },
    { icon: '⚡', title: 'Rapide', desc: 'Terminez un quiz en moins de 5min', unlocked: false }
  ];

  container.innerHTML = achievements.map(achievement => `
    <div class="achievement-badge ${achievement.unlocked ? 'unlocked' : 'locked'}">
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-title">${achievement.title}</div>
      <div class="achievement-desc">${achievement.desc}</div>
    </div>
  `).join('');
}

// ===========================
// EVENT LISTENERS
// ===========================
function setupEventListeners() {
  // Navigation mobile
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });
  }

  // Déconnexion
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }

  // Period selector pour le graphique
  const periodBtns = document.querySelectorAll('.period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentPeriod = parseInt(btn.dataset.period);
      const data = await fetchPerformanceData(currentPeriod);
      if (data) {
        displayPerformanceChart(data);
      }
    });
  });
}

// ===========================
// UTILITAIRES
// ===========================
function loadUserName() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userName = document.getElementById('userName');
  if (userName && user.name) {
    userName.textContent = user.name;
  }
}

function startQuiz(quizId) {
  window.location.href = `/quiz.html?id=${quizId}`;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}

function showError(message) {
  alert(message); // Remplacer par un toast moderne si nécessaire
}