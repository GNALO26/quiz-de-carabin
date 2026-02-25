/**
 * ================================================================
 * REGISTER PAGE JAVASCRIPT - QUIZ DE CARABIN
 * ================================================================
 * Gestion de l'inscription utilisateur avec système multi-étapes
 * À placer dans: frontend/js/auth-register.js
 * ================================================================
 */

// ===========================
// VARIABLES GLOBALES
// ===========================
const registerForm = document.getElementById('registerForm');
let currentStep = 1;
const totalSteps = 3;

// Inputs
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('registerEmail');
const passwordInput = document.getElementById('registerPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const universitySelect = document.getElementById('university');
const academicYearSelect = document.getElementById('academicYear');
const emailNotificationsCheckbox = document.getElementById('emailNotifications');
const acceptTermsCheckbox = document.getElementById('acceptTerms');

// Boutons
const togglePasswordBtns = document.querySelectorAll('.toggle-password');
const submitBtn = document.getElementById('submitBtn');

// Données du formulaire
const formData = {
  name: '',
  email: '',
  password: '',
  university: '',
  academicYear: '',
  emailNotifications: true,
  acceptTerms: false
};

// ===========================
// INITIALISATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  // Créer les particules
  createParticles();
  
  // Event listeners
  setupEventListeners();
  
  // Initialiser la première étape
  showStep(1);
});

// ===========================
// EVENT LISTENERS
// ===========================
function setupEventListeners() {
  // Submit du formulaire
  registerForm.addEventListener('submit', handleRegister);
  
  // Toggle password visibility
  togglePasswordBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const input = this.previousElementSibling;
      const type = input.type === 'password' ? 'text' : 'password';
      input.type = type;
      this.querySelector('i').className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    });
  });
  
  // Password strength
  passwordInput.addEventListener('input', checkPasswordStrength);
  
  // Validation en temps réel
  nameInput.addEventListener('blur', () => validateName());
  emailInput.addEventListener('blur', () => validateEmail());
  passwordInput.addEventListener('blur', () => validatePassword());
  confirmPasswordInput.addEventListener('blur', () => validatePasswordMatch());
  
  // Social buttons (demo)
  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const provider = btn.classList.contains('google-btn') ? 'Google' : 'Facebook';
      Toast.info(`Inscription via ${provider} bientôt disponible`);
    });
  });
}

// ===========================
// NAVIGATION ENTRE ÉTAPES
// ===========================
function nextStep(step) {
  // Valider l'étape actuelle
  if (!validateCurrentStep()) {
    return;
  }
  
  // Sauvegarder les données
  saveStepData();
  
  // Passer à l'étape suivante
  showStep(step);
}

function prevStep(step) {
  showStep(step);
}

function showStep(step) {
  currentStep = step;
  
  // Masquer toutes les étapes
  document.querySelectorAll('.form-step').forEach(stepEl => {
    stepEl.classList.remove('active');
  });
  
  // Afficher l'étape courante
  const currentStepEl = document.querySelector(`.form-step[data-step="${step}"]`);
  if (currentStepEl) {
    currentStepEl.classList.add('active');
  }
  
  // Mettre à jour le progress
  updateProgress(step);
  
  // Si étape 3, afficher le résumé
  if (step === 3) {
    displaySummary();
  }
}

function updateProgress(step) {
  document.querySelectorAll('.step').forEach((stepEl, index) => {
    stepEl.classList.remove('active', 'completed');
    
    if (index + 1 < step) {
      stepEl.classList.add('completed');
    } else if (index + 1 === step) {
      stepEl.classList.add('active');
    }
  });
}

// ===========================
// VALIDATION PAR ÉTAPE
// ===========================
function validateCurrentStep() {
  switch (currentStep) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    default:
      return true;
  }
}

function validateStep1() {
  let isValid = true;
  
  if (!validateName()) isValid = false;
  if (!validateEmail()) isValid = false;
  if (!validatePassword()) isValid = false;
  if (!validatePasswordMatch()) isValid = false;
  
  return isValid;
}

function validateStep2() {
  if (!universitySelect.value) {
    showError('university', 'Veuillez sélectionner votre université');
    return false;
  }
  clearError('university');
  return true;
}

function validateStep3() {
  if (!acceptTermsCheckbox.checked) {
    showError('terms', 'Vous devez accepter les conditions d\'utilisation');
    return false;
  }
  clearError('terms');
  return true;
}

// ===========================
// VALIDATIONS INDIVIDUELLES
// ===========================
function validateName() {
  const name = nameInput.value.trim();
  
  if (!name) {
    showError('name', 'Le nom est requis');
    return false;
  }
  
  if (name.length < 3) {
    showError('name', 'Le nom doit contenir au moins 3 caractères');
    return false;
  }
  
  if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(name)) {
    showError('name', 'Le nom contient des caractères invalides');
    return false;
  }
  
  clearError('name');
  return true;
}

function validateEmail() {
  const email = emailInput.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    showError('registerEmail', 'L\'email est requis');
    return false;
  }
  
  if (!emailRegex.test(email)) {
    showError('registerEmail', 'Format d\'email invalide');
    return false;
  }
  
  clearError('registerEmail');
  return true;
}

function validatePassword() {
  const password = passwordInput.value;
  
  if (!password) {
    showError('registerPassword', 'Le mot de passe est requis');
    return false;
  }
  
  if (password.length < 8) {
    showError('registerPassword', 'Le mot de passe doit contenir au moins 8 caractères');
    return false;
  }
  
  if (!/[A-Z]/.test(password)) {
    showError('registerPassword', 'Le mot de passe doit contenir au moins une majuscule');
    return false;
  }
  
  if (!/[a-z]/.test(password)) {
    showError('registerPassword', 'Le mot de passe doit contenir au moins une minuscule');
    return false;
  }
  
  if (!/[0-9]/.test(password)) {
    showError('registerPassword', 'Le mot de passe doit contenir au moins un chiffre');
    return false;
  }
  
  clearError('registerPassword');
  return true;
}

function validatePasswordMatch() {
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  if (!confirmPassword) {
    showError('confirmPassword', 'Veuillez confirmer votre mot de passe');
    return false;
  }
  
  if (password !== confirmPassword) {
    showError('confirmPassword', 'Les mots de passe ne correspondent pas');
    return false;
  }
  
  clearError('confirmPassword');
  return true;
}

// ===========================
// PASSWORD STRENGTH
// ===========================
function checkPasswordStrength() {
  const password = passwordInput.value;
  const strengthFill = document.getElementById('strengthFill');
  const strengthText = document.getElementById('strengthText');
  
  if (!strengthFill || !strengthText) return;
  
  let strength = 0;
  
  // Critères de force
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  
  // Reset classes
  strengthFill.className = 'strength-fill';
  strengthText.className = 'strength-text';
  
  // Appliquer le niveau
  if (strength <= 2) {
    strengthFill.classList.add('weak');
    strengthText.classList.add('weak');
    strengthText.textContent = 'Faible';
  } else if (strength <= 4) {
    strengthFill.classList.add('medium');
    strengthText.classList.add('medium');
    strengthText.textContent = 'Moyen';
  } else {
    strengthFill.classList.add('strong');
    strengthText.classList.add('strong');
    strengthText.textContent = 'Fort';
  }
}

// ===========================
// SAUVEGARDER LES DONNÉES
// ===========================
function saveStepData() {
  formData.name = nameInput.value.trim();
  formData.email = emailInput.value.trim();
  formData.password = passwordInput.value;
  formData.university = universitySelect.value;
  formData.academicYear = academicYearSelect.value;
  formData.emailNotifications = emailNotificationsCheckbox.checked;
  formData.acceptTerms = acceptTermsCheckbox.checked;
}

// ===========================
// AFFICHER LE RÉSUMÉ
// ===========================
function displaySummary() {
  const summaryName = document.getElementById('summaryName');
  const summaryEmail = document.getElementById('summaryEmail');
  const summaryUniversity = document.getElementById('summaryUniversity');
  
  if (summaryName) summaryName.textContent = formData.name;
  if (summaryEmail) summaryEmail.textContent = formData.email;
  
  if (summaryUniversity) {
    const universityOption = universitySelect.options[universitySelect.selectedIndex];
    summaryUniversity.textContent = universityOption ? universityOption.text : formData.university;
  }
}

// ===========================
// SOUMISSION DU FORMULAIRE
// ===========================
async function handleRegister(e) {
  e.preventDefault();
  
  // Valider l'étape 3
  if (!validateStep3()) {
    return;
  }
  
  // Sauvegarder les dernières données
  saveStepData();
  
  // Désactiver le bouton
  setLoading(true);
  hideGlobalError();
  
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        preferredUniversity: formData.university,
        academicYear: formData.academicYear,
        emailNotifications: formData.emailNotifications
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Sauvegarder le token et l'utilisateur
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Toast de succès
      Toast.success('Compte créé avec succès ! Bienvenue 🎉');
      
      // Animation de succès
      submitBtn.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Compte créé !</span>
      `;
      submitBtn.style.background = 'linear-gradient(135deg, #43e97b, #38f9d7)';
      
      // Confetti
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      
      // Redirection après 1.5 secondes
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1500);
      
    } else {
      // Erreur serveur
      showGlobalError(data.message || 'Erreur lors de l\'inscription');
      setLoading(false);
    }
    
  } catch (error) {
    console.error('Erreur register:', error);
    showGlobalError('Erreur de connexion. Vérifiez votre connexion internet.');
    setLoading(false);
  }
}

// ===========================
// GESTION DES ERREURS
// ===========================
function showError(field, message) {
  const errorElement = document.getElementById(`${field}Error`);
  let inputElement = document.getElementById(field);
  
  // Cas spécial pour registerEmail
  if (field === 'registerEmail') {
    inputElement = emailInput;
  }
  
  if (errorElement && inputElement) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
    inputElement.closest('.form-group').classList.add('error');
  }
}

function clearError(field) {
  const errorElement = document.getElementById(`${field}Error`);
  let inputElement = document.getElementById(field);
  
  // Cas spécial pour registerEmail
  if (field === 'registerEmail') {
    inputElement = emailInput;
  }
  
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
    
    // Scroll vers l'erreur
    globalError.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    particle.style.background = `rgba(${Math.random() > 0.5 ? '0, 212, 255' : '102, 126, 234'}, 0.5)`;
    particle.style.borderRadius = '50%';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.animation = `particleFloat ${Math.random() * 10 + 10}s linear infinite`;
    particle.style.animationDelay = Math.random() * 5 + 's';
    
    particlesContainer.appendChild(particle);
  }
}

// Animation CSS pour les particules
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
`;
document.head.appendChild(style);

// ===========================
// FONCTIONS EXPOSÉES GLOBALEMENT
// ===========================
window.nextStep = nextStep;
window.prevStep = prevStep;