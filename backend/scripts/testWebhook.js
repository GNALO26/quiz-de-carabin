// backend/scripts/testWebhook.js
const axios = require('axios');

const testWebhook = {
  data: {
    response_code: '00',
    response_text: 'Transaction Found',
    hash: 'test-hash-123456',
    invoice: {
      token: 'TEST_TOKEN_123',
      total_amount: '5000',
      description: 'Test Invoice',
    },
    custom_data: {
      user_id: 'TEST_USER_ID',
      transaction_id: 'TEST_TXN_ID'
    },
    status: 'completed',
    customer: {
      name: 'Test Customer',
      email: 'test@example.com'
    }
  }
};

axios.post('http://localhost:5000/api/payment/callback', testWebhook)
  .then(response => {
    console.log('✅ Webhook test réussi:', response.data);
  })
  .catch(error => {
    console.error('❌ Erreur webhook test:', error.response?.data || error.message);
  });