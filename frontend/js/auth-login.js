/**
 * ================================================================
 * LOGIN PAGE JAVASCRIPT - QUIZ DE CARABIN
 * ================================================================
 * Gestion de la connexion utilisateur
 * À placer dans: frontend/js/auth-login.js
 * ================================================================
 */

// ===========================
// VARIABLES GLOBALES
// ===========================
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const submitBtn = document.getElementById('submitBtn');
const rememberMeCheckbox = document.getElementById('rememberMe');

// ===========================
// INITIALISATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si déjà connecté
  checkIfAlreadyLoggedIn();
  
  // Charger l'email sauvegardé si "Se souvenir" était coché
  loadRememberedEmail();
  
  // Créer les particules animées
  createParticles();
  
  // Event listeners
  setupEventListeners();
});

// ===========================
// VÉRIFICATION CONNEXION
// ===========================
function checkIfAlreadyLoggedIn() {
  const token = localStorage.getItem('token');
  if (token) {
    // Vérifier la validité du token
    fetch(`${API_URL}/api/auth/verify`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Token valide, rediriger vers dashboard
        window.location.href = '/dashboard.html';
      }
    })
    .catch(() => {
      // Token invalide, le supprimer
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
  }
}

// ===========================
// EVENT LISTENERS
// ===========================
function setupEventListeners() {
  // Submit du formulaire
  loginForm.addEventListener('submit', handleLogin);
  
  // Toggle password visibility
  togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
  
  // Validation en temps réel
  emailInput.addEventListener('blur', () => validateEmail(emailInput.value));
  passwordInput.addEventListener('input', () => clearError('password'));
  
  // Enter pour soumettre
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loginForm.dispatchEvent(new Event('submit'));
    }
  });
  
  // Social login (demo)
  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const provider = btn.classList.contains('google-btn') ? 'Google' : 'Facebook';
      Toast.info(`Connexion via ${provider} bientôt disponible`);
    });
  });
}

// ===========================
// GESTION DU LOGIN
// ===========================
async function handleLogin(e) {
  e.preventDefault();
  
  // Récupérer les valeurs
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const rememberMe = rememberMeCheckbox.checked;
  
  // Validation
  if (!validateForm(email, password)) {
    return;
  }
  
  // Désactiver le bouton
  setLoading(true);
  hideGlobalError();
  
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Sauvegarder le token et l'utilisateur
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Sauvegarder l'email si "Se souvenir"
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // Toast de succès
      Toast.success(`Bienvenue ${data.user.name} ! 🎉`);
      
      // Animation de succès
      submitBtn.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Connexion réussie !</span>
      `;
      submitBtn.style.background = 'linear-gradient(135deg, #43e97b, #38f9d7)';
      
      // Redirection après 1 seconde
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
      
    } else {
      // Erreur serveur
      showGlobalError(data.message || 'Email ou mot de passe incorrect');
      setLoading(false);
      
      // Shake animation
      loginForm.classList.add('shake');
      setTimeout(() => loginForm.classList.remove('shake'), 500);
    }
    
  } catch (error) {
    console.error('Erreur login:', error);
    showGlobalError('Erreur de connexion. Vérifiez votre connexion internet.');
    setLoading(false);
  }
}

// ===========================
// VALIDATION
// ===========================
function validateForm(email, password) {
  let isValid = true;
  
  // Valider email
  if (!validateEmail(email)) {
    isValid = false;
  }
  
  // Valider password
  if (!password || password.length < 6) {
    showError('password', 'Le mot de passe doit contenir au moins 6 caractères');
    isValid = false;
  }
  
  return isValid;
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    showError('email', 'L\'email est requis');
    return false;
  }
  
  if (!emailRegex.test(email)) {
    showError('email', 'Format d\'email invalide');
    return false;
  }
  
  clearError('email');
  return true;
}

// ===========================
// GESTION DES ERREURS
// ===========================
function showError(field, message) {
  const errorElement = document.getElementById(`${field}Error`);
  const inputElement = document.getElementById(field);
  
  if (errorElement && inputElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    inputElement.closest('.form-group').classList.add('error');
  }
}

function clearError(field) {
  const errorElement = document.getElementById(`${field}Error`);
  const inputElement = document.getElementById(field);
  
  if (errorElement && inputElement) {
    errorElement.textContent = '';
    errorElement.classList.remove('show');
    inputElement.closest('.form-group').classList.remove('error');
  }
}

function showGlobalError(message) {
  const globalError = document.getElementById('globalError');
  const globalErrorMessage = document.getElementById('globalErrorMessage');
  
  if (globalError && globalErrorMessage) {
    globalErrorMessage.textContent = message;
    globalError.style.display = 'flex';
  }
}

function hideGlobalError() {
  const globalError = document.getElementById('globalError');
  if (globalError) {
    globalError.style.display = 'none';
  }
}

// ===========================
// UI HELPERS
// ===========================
function setLoading(loading) {
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  
  submitBtn.disabled = loading;
  
  if (loading) {
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
  } else {
    btnText.style.display = 'block';
    btnLoader.style.display = 'none';
  }
}

function togglePasswordVisibility() {
  const type = passwordInput.type === 'password' ? 'text' : 'password';
  passwordInput.type = type;
  
  const icon = togglePasswordBtn.querySelector('i');
  icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

function loadRememberedEmail() {
  const rememberedEmail = localStorage.getItem('rememberedEmail');
  if (rememberedEmail) {
    emailInput.value = rememberedEmail;
    rememberMeCheckbox.checked = true;
  }
}

// ===========================
// PARTICULES ANIMÉES
// ===========================
function createParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;
  
  const particleCount = 50;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.style.position = 'absolute';
    particle.style.width = Math.random() * 3 + 1 + 'px';
    particle.style.height = particle.style.width;
    particle.style.background = 'rgba(0, 212, 255, 0.5)';
    particle.style.borderRadius = '50%';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animation = `particleFloat ${Math.random() * 10 + 10}s linear infinite`;
    particle.style.animationDelay = Math.random() * 5 + 's';
    
    particlesContainer.appendChild(particle);
  }
}

// Animation CSS pour les particules (à ajouter dans auth.css si pas déjà fait)
const style = document.createElement('style');
style.textContent = `
  @keyframes particleFloat {
    0% {
      transform: translateY(0) translateX(0);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateY(-100vh) translateX(${Math.random() * 100 - 50}px);
      opacity: 0;
    }
  }
  
  .shake {
    animation: shake 0.5s ease;
  }
`;
document.head.appendChild(style);

// ===========================
// DEMO MODE (pour tests)
// ===========================
// Décommenter pour remplir automatiquement le formulaire en dev
/*
if (window.location.hostname === 'localhost') {
  emailInput.value = 'test@example.com';
  passwordInput.value = 'password123';
}
*/