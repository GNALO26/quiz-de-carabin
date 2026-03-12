/**
 * ================================================================
 * ADMIN DASHBOARD - JAVASCRIPT
 * ================================================================
 */

const API_URL = 'https://quiz-de-carabin-backend.onrender.com';

class AdminDashboard {
    constructor() {
        this.usersChart = null;
        this.premiumChart = null;
        this.init();
    }

    async init() {
        const token = localStorage.getItem('quizToken');
        const userStr = localStorage.getItem('quizUser');
        
        if (!token || !userStr) {
            window.location.href = '/login.html';
            return;
        }
        
        try {
            const user = JSON.parse(userStr);
            
            if (!user.isAdmin && user.role !== 'admin') {
                alert('❌ Accès refusé. Vous devez être administrateur.');
                window.location.href = '/index.html';
                return;
            }
            
            document.getElementById('adminName').textContent = user.name || 'Admin';
            
            this.setupNavigation();
            
            // Charger données
            await this.loadDashboardStats();
            await this.loadUsers();
            await this.loadQuizList();
            
            this.setupEventListeners();
            
        } catch (e) {
            console.error('Erreur init admin:', e);
            alert('Erreur d\'initialisation : ' + e.message);
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        const sections = document.querySelectorAll('.content-section');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(nav => nav.classList.remove('active'));
                sections.forEach(sec => sec.classList.remove('active'));
                item.classList.add('active');
                
                const sectionId = item.getAttribute('data-section') + '-section';
                const section = document.getElementById(sectionId);
                
                if (section) {
                    section.classList.add('active');
                    document.getElementById('pageTitle').textContent = item.querySelector('span').textContent;
                }
            });
        });
    }

    async loadDashboardStats() {
        try {
            const token = localStorage.getItem('quizToken');
            const response = await fetch(`${API_URL}/api/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}: ${data.message || 'Inconnue'}`);
            }
            
            if (data.success) {
                this.displayDashboardStats(data.stats);
            } else {
                this.displayDemoStats();
            }
            
        } catch (error) {
            console.error('Erreur loadDashboardStats:', error);
            this.displayDemoStats();
        }
    }

    displayDashboardStats(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('premiumUsers').textContent = stats.premiumUsers || 0;
        document.getElementById('totalQuizzes').textContent = stats.totalQuizzes || 0;
        document.getElementById('totalRevenue').textContent = 
            `${(stats.totalRevenue || 0).toLocaleString()} XOF`;
        
        this.createUsersChart(stats.userGrowth || []);
        this.createPremiumChart(stats.premiumUsers || 0, stats.freeUsers || 0);
    }

    displayDemoStats() {
        document.getElementById('totalUsers').textContent = '156';
        document.getElementById('premiumUsers').textContent = '42';
        document.getElementById('totalQuizzes').textContent = '87';
        document.getElementById('totalRevenue').textContent = '1,250,000 XOF';
        
        this.createUsersChart([
            { date: '2024-01', count: 20 },
            { date: '2024-02', count: 45 },
            { date: '2024-03', count: 91 }
        ]);
        
        this.createPremiumChart(42, 114);
    }

    createUsersChart(data) {
        const ctx = document.getElementById('usersChart');
        if (this.usersChart) this.usersChart.destroy();
        
        const labels = data.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        });
        
        const counts = data.map(d => d.count);
        
        this.usersChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Inscriptions',
                    data: counts,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#38bdf8',
                    pointBorderColor: 'white',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: '#0f172a' }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    createPremiumChart(premium, free) {
        const ctx = document.getElementById('premiumChart');
        if (this.premiumChart) this.premiumChart.destroy();
        
        this.premiumChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Premium', 'Gratuit'],
                datasets: [{
                    data: [premium, free],
                    backgroundColor: [
                        '#fbbf24',
                        '#e2e8f0'
                    ],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '70%',
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: { usePointStyle: true, boxWidth: 8 }
                    }
                }
            }
        });
    }

    async loadUsers() {
        try {
            const token = localStorage.getItem('quizToken');
            const response = await fetch(`${API_URL}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
            }
            
            if (data.success) {
                this.displayUsers(data.users);
            } else {
                this.displayDemoUsers();
            }
            
        } catch (error) {
            console.error('Erreur loadUsers:', error);
            this.displayDemoUsers();
        }
    }

    displayUsers(users) {
        const tbody = document.getElementById('usersTable');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Aucun utilisateur</td></tr>';
            return;
        }
        
        const html = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>
                    ${user.isPremium 
                        ? '<span class="badge bg-warning"><i class="fas fa-crown me-1"></i>Premium</span>' 
                        : '<span class="badge bg-secondary">Gratuit</span>'}
                </td>
                <td>${new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
        `).join('');
        
        tbody.innerHTML = html;
    }

    displayDemoUsers() {
        const tbody = document.getElementById('usersTable');
        tbody.innerHTML = `
            <tr>
                <td>Jean Dupont</td>
                <td>jean@example.com</td>
                <td><span class="badge bg-warning"><i class="fas fa-crown me-1"></i>Premium</span></td>
                <td>15/03/2024</td>
            </tr>
            <tr>
                <td>Marie Curie</td>
                <td>marie@example.com</td>
                <td><span class="badge bg-secondary">Gratuit</span></td>
                <td>20/03/2024</td>
            </tr>
        `;
    }

    async loadQuizList() {
        try {
            const token = localStorage.getItem('quizToken');
            const response = await fetch(`${API_URL}/api/quiz`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.success && data.quizzes) {
                this.populateQuizSelect(data.quizzes);
            }
        } catch (error) {
            console.error('Erreur loadQuizList:', error);
        }
    }

    populateQuizSelect(quizzes) {
        const select = document.getElementById('quizSelect');
        const options = quizzes.map(quiz => 
            `<option value="${quiz._id}">${quiz.title}</option>`
        ).join('');
        select.innerHTML = '<option value="">Sélectionner un quiz...</option>' + options;
    }

    setupEventListeners() {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchUsers(e.target.value));
        }
        
        const sendQuizBtn = document.getElementById('sendQuizNotif');
        if (sendQuizBtn) {
            sendQuizBtn.addEventListener('click', () => this.sendQuizNotification());
        }
        
        const sendDigestBtn = document.getElementById('sendDigest');
        if (sendDigestBtn) {
            sendDigestBtn.addEventListener('click', () => this.sendWeeklyDigest());
        }
    }

    searchUsers(query) {
        const rows = document.querySelectorAll('#usersTable tr');
        const searchLower = query.toLowerCase();
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchLower) ? '' : 'none';
        });
    }

    async sendQuizNotification() {
        const quizId = document.getElementById('quizSelect').value;
        if (!quizId) {
            alert('❌ Veuillez sélectionner un quiz');
            return;
        }
        
        try {
            const token = localStorage.getItem('quizToken');
            const response = await fetch(`${API_URL}/api/notifications/send-quiz-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ quizId })
            });
            
            const data = await response.json();
            alert(data.success ? '✅ Notification envoyée !' : '❌ Erreur : ' + data.message);
        } catch (error) {
            alert('❌ Erreur : ' + error.message);
        }
    }

    async sendWeeklyDigest() {
        if (!confirm('Envoyer le digest hebdomadaire ?')) return;
        
        try {
            const token = localStorage.getItem('quizToken');
            const response = await fetch(`${API_URL}/api/notifications/send-weekly-digest`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await response.json();
            alert(data.success ? `✅ Digest envoyé à ${data.sent || 0} utilisateurs` : '❌ Erreur : ' + data.message);
        } catch (error) {
            alert('❌ Erreur : ' + error.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});