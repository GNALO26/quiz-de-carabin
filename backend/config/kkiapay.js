const axios = require('axios');
const crypto = require('crypto');

class KkiaPay {
  constructor() {
    this.publicKey = process.env.KKIAPAY_PUBLIC_KEY?.trim();
    this.privateKey = process.env.KKIAPAY_PRIVATE_KEY?.trim();
    this.secretKey = process.env.KKIAPAY_SECRET_KEY?.trim();
    this.mode = process.env.KKIAPAY_MODE || 'live';
    
    console.log('🔧 Configuration KkiaPay Liens Directs - Mode:', this.mode);
    console.log('🔧 Clé publique:', this.publicKey ? '✓ Définie' : '✗ Manquante');
  }

  async createPayment(paymentData) {
    try {
      console.log('💰 Utilisation des liens directs KkiaPay...');
      
      // ✅ MAPPING DES LIENS DIRECTS PAR PLAN
      const directLinks = {
        '1-month': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-5k)-h6j7-M-TL',
        '3-months': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-12k)-Ov3-yKeZc',
        '10-months': 'https://direct.kkiapay.me/37641/quiz-de-carabin-(premium-25k)-R6CAqLjlf'
      };

      const paymentUrl = directLinks[paymentData.metadata?.plan_id];
      
      if (!paymentUrl) {
        throw new Error('Lien direct non trouvé pour le plan: ' + paymentData.metadata?.plan_id);
      }

      console.log('✅ Lien direct sélectionné:', paymentUrl);
      console.log('📋 Plan:', paymentData.metadata?.plan_id);
      console.log('💳 Montant:', paymentData.amount);

      return {
        success: true,
        paymentUrl: paymentUrl,
        transactionId: paymentData.metadata.transaction_id
      };

    } catch (error) {
      console.error('❌ Erreur sélection lien direct:', error);
      throw error;
    }
  }

  async verifyTransaction(transactionId) {
    try {
      const baseURL = this.mode === 'test' 
        ? 'https://api-sandbox.kkiapay.me' 
        : 'https://api.kkiapay.me';
      
      const url = `${baseURL}/api/v1/transactions/${transactionId}/status`;
      console.log('🔍 Vérification transaction:', transactionId);

      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-KEY': this.publicKey,
          'X-PRIVATE-KEY': this.privateKey,
          'X-SECRET-KEY': this.secretKey
        },
        timeout: 10000
      });

      console.log('✅ Statut transaction:', response.data);
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
      
      console.log('🔐 Signature vérifiée:', computedSignature === signature);
      return computedSignature === signature;
    } catch (error) {
      console.error("Erreur vérification signature:", error);
      return false;
    }
  }
}

module.exports = new KkiaPay();