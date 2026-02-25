/**
 * ================================================================
 * PREMIUM PAGE JAVASCRIPT - QUIZ DE CARABIN
 * ================================================================
 * Gère les abonnements Premium avec KKiaPay
 * À placer dans: frontend/js/premium.js
 * ================================================================
 */

// Variables globales
let currentUser = null;

// ===========================
// INITIALISATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier authentification
  const token = localStorage.getItem('token');
  if (!token) {
    Toast.warning('Vous devez être connecté pour souscrire');
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 2000);
    return;
  }

  // Charger l'utilisateur
  loadUser();

  // Charger le script KKiaPay
  loadKKiaPay();
});

// ===========================
// CHARGEMENT UTILISATEUR
// ===========================
function loadUser() {
  const userJson = localStorage.getItem('user');
  if (userJson) {
    currentUser = JSON.parse(userJson);
    
    // Si déjà premium, afficher un message
    if (currentUser.isPremium) {
      showAlreadyPremiumBanner();
    }
  }
}

function showAlreadyPremiumBanner() {
  const banner = document.createElement('div');
  banner.className = 'already-premium-banner';
  banner.innerHTML = `
    <div class="banner-content">
      <i class="fas fa-crown"></i>
      <span>Vous êtes déjà membre Premium ! Merci de votre confiance.</span>
      <a href="/history.html" class="banner-btn">Voir mon Tableau de Bord</a>
    </div>
  `;
  
  document.body.insertBefore(banner, document.querySelector('.premium-hero'));
  
  // Ajouter styles inline
  const style = document.createElement('style');
  style.textContent = `
    .already-premium-banner {
      background: linear-gradient(135deg, #ffd700, #ff9800);
      padding: 15px 20px;
      text-align: center;
      position: fixed;
      top: 70px;
      left: 0;
      right: 0;
      z-index: 999;
      animation: slideDown 0.5s ease;
    }
    
    @keyframes slideDown {
      from {
        transform: translateY(-100%);
      }
      to {
        transform: translateY(0);
      }
    }
    
    .banner-content {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
      color: #1a1a2e;
      font-weight: 600;
    }
    
    .banner-content i {
      font-size: 1.5rem;
    }
    
    .banner-btn {
      background: #1a1a2e;
      color: #ffd700;
      padding: 8px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      transition: all 0.3s ease;
    }
    
    .banner-btn:hover {
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(style);
}

// ===========================
// CHARGEMENT KKIAPAY
// ===========================
function loadKKiaPay() {
  // Charger le SDK KKiaPay
  const script = document.createElement('script');
  script.src = 'https://cdn.kkiapay.me/k.js';
  script.async = true;
  script.onload = () => {
    console.log('✅ KKiaPay SDK chargé');
  };
  script.onerror = () => {
    console.error('❌ Erreur chargement KKiaPay');
    Toast.error('Erreur de chargement du système de paiement');
  };
  document.head.appendChild(script);
}

// ===========================
// SOUSCRIPTION PREMIUM
// ===========================
async function subscribePremium(plan) {
  // Vérifier si déjà premium
  if (currentUser?.isPremium) {
    Toast.info('Vous êtes déjà membre Premium !');
    return;
  }

  // Déterminer le montant
  const amount = plan === 'annual' ? 50000 : 5000;
  const planName = plan === 'annual' ? 'Premium Annuel' : 'Premium Mensuel';

  // Créer la transaction côté serveur
  const loadingToast = Toast.loading('Préparation du paiement...');
  
  try {
    const response = await fetch(`${API_URL}/api/payment/create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        plan: plan,
        amount: amount
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Erreur création transaction');
    }

    loadingToast.remove();

    // Ouvrir KKiaPay
    openKKiaPayWidget(data.transaction);

  } catch (error) {
    console.error('Erreur subscribePremium:', error);
    loadingToast.remove();
    Toast.error('Erreur lors de la préparation du paiement');
  }
}

// ===========================
// WIDGET KKIAPAY
// ===========================
function openKKiaPayWidget(transaction) {
  // Vérifier que KKiaPay est chargé
  if (typeof openKkiapayWidget !== 'function') {
    Toast.error('Système de paiement non disponible');
    console.error('KKiaPay widget not loaded');
    return;
  }

  // Configuration KKiaPay
  openKkiapayWidget({
    amount: transaction.amount,
    position: 'center',
    callback: '', // Laisser vide, on utilise les webhooks
    data: JSON.stringify({
      transactionId: transaction._id,
      userId: currentUser._id,
      plan: transaction.plan
    }),
    theme: '#ffd700',
    key: 'VOTRE_CLE_PUBLIQUE_KKIAPAY', // À remplacer par ta vraie clé publique
    
    // Callbacks
    success: function(transactionId) {
      handlePaymentSuccess(transactionId, transaction);
    },
    
    failed: function(error) {
      handlePaymentFailed(error, transaction);
    }
  });
}

// ===========================
// GESTION PAIEMENT
// ===========================
async function handlePaymentSuccess(kkiapayTransactionId, transaction) {
  Toast.success('Paiement réussi ! Vérification en cours...');
  
  try {
    // Vérifier le paiement côté serveur
    const response = await fetch(`${API_URL}/api/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        transactionId: transaction._id,
        kkiapayTransactionId: kkiapayTransactionId
      })
    });

    const data = await response.json();

    if (data.success) {
      // Mettre à jour l'utilisateur local
      currentUser.isPremium = true;
      currentUser.subscriptionEnd = data.subscriptionEnd;
      localStorage.setItem('user', JSON.stringify(currentUser));

      // Afficher la confirmation
      showSuccessModal(transaction.plan);

    } else {
      throw new Error(data.message || 'Erreur vérification');
    }

  } catch (error) {
    console.error('Erreur handlePaymentSuccess:', error);
    Toast.error('Erreur lors de la vérification. Contactez le support.');
  }
}

function handlePaymentFailed(error, transaction) {
  console.error('Paiement échoué:', error);
  
  // Marquer la transaction comme échouée
  fetch(`${API_URL}/api/payment/fail`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      transactionId: transaction._id,
      error: error
    })
  }).catch(err => console.error(err));

  Toast.error('Le paiement a échoué. Veuillez réessayer.');
}

// ===========================
// MODAL SUCCÈS
// ===========================
function showSuccessModal(plan) {
  const modal = document.createElement('div');
  modal.className = 'success-modal';
  
  const planName = plan === 'annual' ? 'Premium Annuel' : 'Premium Mensuel';
  
  modal.innerHTML = `
    <div class="success-modal-overlay" onclick="closeSuccessModal()"></div>
    <div class="success-modal-content">
      <div class="success-icon">
        <i class="fas fa-crown"></i>
      </div>
      <h2>Félicitations ! 🎉</h2>
      <p>Vous êtes maintenant membre <strong>${planName}</strong> de Quiz de Carabin !</p>
      <div class="success-benefits">
        <div class="benefit">
          <i class="fas fa-check-circle"></i>
          <span>Accès illimité à tous les quiz</span>
        </div>
        <div class="benefit">
          <i class="fas fa-check-circle"></i>
          <span>Statistiques avancées activées</span>
        </div>
        <div class="benefit">
          <i class="fas fa-check-circle"></i>
          <span>Badge Premium sur votre profil</span>
        </div>
      </div>
      <div class="success-actions">
        <button class="btn-primary" onclick="goToQuizzes()">
          <i class="fas fa-book"></i> Explorer les Quiz Premium
        </button>
        <button class="btn-secondary" onclick="goToDashboard()">
          <i class="fas fa-chart-line"></i> Voir mon Tableau de Bord
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Ajouter styles inline
  addSuccessModalStyles();
  
  // Confetti !
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

function closeSuccessModal() {
  const modal = document.querySelector('.success-modal');
  if (modal) {
    modal.remove();
  }
}

function addSuccessModalStyles() {
  if (document.getElementById('success-modal-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'success-modal-styles';
  style.textContent = `
    .success-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .success-modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
    }
    
    .success-modal-content {
      position: relative;
      background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(15, 15, 30, 0.95));
      border: 2px solid var(--premium-gold);
      border-radius: 25px;
      padding: 50px 40px;
      max-width: 500px;
      text-align: center;
      animation: modalZoomIn 0.5s ease;
    }
    
    @keyframes modalZoomIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    
    .success-icon {
      font-size: 5rem;
      color: var(--premium-gold);
      margin-bottom: 20px;
      animation: iconBounce 1s ease infinite;
    }
    
    @keyframes iconBounce {
      0%, 100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-10px);
      }
    }
    
    .success-modal-content h2 {
      font-size: 2rem;
      margin: 0 0 15px 0;
    }
    
    .success-modal-content p {
      color: var(--text-secondary);
      font-size: 1.1rem;
      margin: 0 0 30px 0;
    }
    
    .success-benefits {
      background: rgba(255, 215, 0, 0.05);
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 30px;
      text-align: left;
    }
    
    .benefit {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      color: #fff;
    }
    
    .benefit i {
      color: var(--success-color);
      font-size: 1.2rem;
    }
    
    .success-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .success-actions button {
      width: 100%;
      padding: 15px;
      border: none;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s ease;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, var(--premium-gold), var(--premium-orange));
      color: var(--dark-bg);
    }
    
    .btn-primary:hover {
      transform: scale(1.05);
    }
    
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      border: 2px solid rgba(255, 255, 255, 0.2);
    }
    
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  `;
  
  document.head.appendChild(style);
}

// ===========================
// FAQ TOGGLE
// ===========================
function toggleFAQ(element) {
  const faqItem = element.parentElement;
  const isActive = faqItem.classList.contains('active');
  
  // Fermer tous les autres
  document.querySelectorAll('.faq-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Toggle le courant
  if (!isActive) {
    faqItem.classList.add('active');
  }
}

// ===========================
// NAVIGATION
// ===========================
function stayFree() {
  Toast.info('Vous pouvez toujours passer Premium plus tard !');
  setTimeout(() => {
    window.location.href = '/quiz.html';
  }, 1500);
}

function goToQuizzes() {
  closeSuccessModal();
  window.location.href = '/quiz.html';
}

function goToDashboard() {
  closeSuccessModal();
  window.location.href = '/history.html';
}

function goToPremium() {
  // Déjà sur la page premium
  window.scrollTo({ top: 0, behavior: 'smooth' });
}