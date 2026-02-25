/**
 * ================================================================
 * FORGOT PASSWORD JAVASCRIPT - QUIZ DE CARABIN
 * ================================================================
 * Gestion demande réinitialisation mot de passe
 * ================================================================
 */

const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const emailInput = document.getElementById('email');
const submitBtn = document.getElementById('submitBtn');
const requestStep = document.getElementById('requestStep');
const successStep = document.getElementById('successStep');
const resendBtn = document.getElementById('resendBtn');

let canResend = false;

document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  setupEventListeners();
});

function setupEventListeners() {
  forgotPasswordForm.addEventListener('submit', handleForgotPassword);
  emailInput.addEventListener('blur', () => validateEmail());
  if (resendBtn) resendBtn.addEventListener('click', handleResend);
}

async function handleForgotPassword(e) {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  if (!validateEmail()) return;
  
  setLoading(true);
  hideGlobalError();
  
  try {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    // Toujours afficher succès (sécurité)
    showSuccessStep(email);
    Toast.success('Email envoyé avec succès !');
    
  } catch (error) {
    console.error('Erreur:', error);
    showGlobalError('Erreur de connexion');
    setLoading(false);
  }
}

function showSuccessStep(email) {
  requestStep.style.display = 'none';
  successStep.style.display = 'block';
  
  const sentEmailSpan = document.getElementById('sentEmail');
  if (sentEmailSpan) sentEmailSpan.textContent = email;
  
  startResendCountdown();
}

function startResendCountdown() {
  canResend = false;
  let seconds = 60;
  
  const timer = document.getElementById('resendTimer');
  const countdown = document.getElementById('countdown');
  
  if (timer) timer.style.display = 'block';
  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.style.opacity = '0.5';
  }
  
  const interval = setInterval(() => {
    seconds--;
    if (countdown) countdown.textContent = seconds;
    
    if (seconds <= 0) {
      clearInterval(interval);
      canResend = true;
      if (timer) timer.style.display = 'none';
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.style.opacity = '1';
      }
    }
  }, 1000);
}

async function handleResend() {
  if (!canResend) {
    Toast.warning('Veuillez attendre');
    return;
  }
  
  const email = emailInput.value.trim();
  
  try {
    await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    Toast.success('Email renvoyé !');
    startResendCountdown();
    
  } catch (error) {
    Toast.error('Erreur de renvoi');
  }
}

function validateEmail() {
  const email = emailInput.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    showError('email', 'Email requis');
    return false;
  }
  
  if (!emailRegex.test(email)) {
    showError('email', 'Email invalide');
    return false;
  }
  
  clearError('email');
  return true;
}

function showError(field, message) {
  const errorEl = document.getElementById(`${field}Error`);
  const inputEl = document.getElementById(field);
  
  if (errorEl && inputEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
    inputEl.closest('.form-group').classList.add('error');
  }
}

function clearError(field) {
  const errorEl = document.getElementById(`${field}Error`);
  const inputEl = document.getElementById(field);
  
  if (errorEl && inputEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('show');
    inputEl.closest('.form-group').classList.remove('error');
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
  if (globalError) globalError.style.display = 'none';
}

function setLoading(loading) {
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');
  
  submitBtn.disabled = loading;
  btnText.style.display = loading ? 'none' : 'flex';
  btnLoader.style.display = loading ? 'block' : 'none';
}

function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.style.cssText = `
      position: absolute;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      background: rgba(0, 212, 255, 0.5);
      border-radius: 50%;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: particleFloat ${Math.random() * 10 + 10}s linear infinite;
      animation-delay: ${Math.random() * 5}s;
    `;
    container.appendChild(p);
  }
}