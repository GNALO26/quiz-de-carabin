const kkiapay = require('../config/kkiapay');

async function testKkiaPay() {
  try {
    console.log('🧪 Test de l\'intégration KkiaPay...');
    
    // Test de création de paiement
    const paymentData = {
      amount: 100,
      phone: '+22900000000',
      metadata: { test: true }
    };
    
    const payment = await kkiapay.createPayment(paymentData);
    console.log('✅ Création de paiement:', payment);
    
    // Test de vérification
    if (payment.transactionId) {
      const status = await kkiapay.verifyTransaction(payment.transactionId);
      console.log('✅ Vérification de transaction:', status);
    }
    
  } catch (error) {
    console.error('❌ Erreur test KkiaPay:', error);
  }
}

testKkiaPay();