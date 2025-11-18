const axios = require('axios');
const crypto = require('crypto');

class KkiaPay {
  constructor() {
    this.publicKey = process.env.KKIAPAY_PUBLIC_KEY?.trim();
    this.privateKey = process.env.KKIAPAY_PRIVATE_KEY?.trim();
    this.secretKey = process.env.KKIAPAY_SECRET_KEY?.trim();
    this.mode = process.env.KKIAPAY_MODE || 'live';
    this.baseURL = this.mode === 'test' 
      ? 'https://api-sandbox.kkiapay.me' 
      : 'https://api.kkiapay.me';
    
    console.log('🔧 Configuration KkiaPay chargée - Mode:', this.mode);
  }

  async createPayment(paymentData) {
    try {
      console.log('💰 Tentative de création de paiement KkiaPay...');
      
      // ✅ CORRECTION: Utiliser le bon endpoint et format
      const payload = {
        amount: Math.round(paymentData.amount),
        apikey: this.publicKey,
        phone: paymentData.phone,
        email: paymentData.email,
        callback: paymentData.callback,
        data: paymentData.metadata,
        theme: "#13a718ff",
        name: "Quiz de Carabin"
      };

      // Nettoyer les champs vides
      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === null || payload[key] === undefined) {
          delete payload[key];
        }
      });

      console.log('📤 Payload envoyé à KkiaPay:', JSON.stringify(payload, null, 2));

      const response = await axios.post(`${this.baseURL}/api/v1/url, payload`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 15000
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
      } else if (error.request) {
        console.error('Aucune réponse reçue');
      } else {
        console.error('Erreur configuration:', error.message);
      }
      throw error;
    }
  }

  async verifyTransaction(transactionId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v1/transactions/${transactionId}/status`,
        {
          headers: {
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Erreur vérification transaction:', error.response?.data || error.message);
      throw error;
    }
  }

  verifyWebhookSignature(payload, signature) {
    try {
      const computedSignature = crypto
        .createHmac('sha256', this.secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');
      
      return computedSignature === signature;
    } catch (error) {
      console.error("Erreur vérification signature:", error);
      return false;
    }
  }
}

module.exports = new KkiaPay();