const axios = require('axios');
const crypto = require('crypto');

class KkiaPay {
  constructor() {
    this.publicKey = process.env.KKIAPAY_PUBLIC_KEY?.trim();
    this.privateKey = process.env.KKIAPAY_PRIVATE_KEY?.trim();
    this.secretKey = process.env.KKIAPAY_SECRET_KEY?.trim();
    this.mode = process.env.KKIAPAY_MODE || 'live';
    
    this.baseURL = 'https://api.kkiapay.me';
    
    console.log('🔧 Configuration KkiaPay chargée - Mode:', this.mode);
    console.log('🔑 Clé publique:', this.publicKey ? '✓ Configurée' : '✗ Manquante');
    console.log('🌐 Base URL:', this.baseURL);
  }

  async createPayment(paymentData) {
    try {
      console.log('💰 Tentative de création de paiement KkiaPay...');
      
      const payload = {
        amount: Math.round(paymentData.amount),
        api_key: this.publicKey,
        phone: paymentData.phone || '+2290156035888',
        email: paymentData.email,
        callback: paymentData.callback,
        data: JSON.stringify(paymentData.metadata || {}),
        theme: "#13a718",
        name: "Quiz de Carabin",
        sandbox: false
      };

      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
          delete payload[key];
        }
      });

      console.log('📤 Payload envoyé à KkiaPay:', JSON.stringify(payload, null, 2));

      const response = await axios({
        method: 'POST',
        url: `${this.baseURL}/api/v1/transactions`,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ Réponse KkiaPay reçue:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.url) {
        return {
          success: true,
          payment_link: response.data.url,
          transactionId: response.data.transactionId || `KKP_${Date.now()}`
        };
      } else {
        throw new Error('URL de paiement non reçue dans la réponse');
      }

    } catch (error) {
      console.error('❌ Erreur KkiaPay createPayment:');
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        console.error('URL:', error.response.config?.url);
      } else if (error.request) {
        console.error('Aucune réponse reçue - Timeout ou problème réseau');
      } else {
        console.error('Erreur configuration:', error.message);
      }
      
      let errorMessage = 'Erreur lors de la création du paiement';
      if (error.response?.status === 404) {
        errorMessage = 'Endpoint KkiaPay non trouvé. Vérifiez votre configuration.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Clé API KkiaPay invalide ou expirée.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Timeout de connexion à KkiaPay.';
      }
      
      throw new Error(errorMessage);
    }
  }

  async verifyTransaction(transactionId) {
    try {
      console.log(`🔍 Vérification transaction KkiaPay: ${transactionId}`);
      
      const response = await axios({
        method: 'GET',
        url: `${this.baseURL}/api/v1/transactions/${transactionId}`,
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': this.publicKey
        },
        timeout: 10000
      });
      
      console.log('✅ Statut transaction:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur vérification transaction:', error.response?.data || error.message);
      throw error;
    }
  }

  verifyWebhookSignature(payload, signature) {
    try {
      if (!signature) {
        console.warn('⚠ Pas de signature fournie dans le webhook');
        return false;
      }

      if (!this.secretKey) {
        console.error('❌ Secret key manquante pour vérifier la signature');
        return false;
      }

      const computedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      const isValid = computedSignature === signature;
      console.log(`🔐 Vérification signature: ${isValid ? 'VALIDE ✅' : 'INVALIDE ❌'}`);
      
      return isValid;
    } catch (error) {
      console.error("❌ Erreur vérification signature:", error);
      return false;
    }
  }
}

module.exports = new KkiaPay();