require('dotenv').config();
const axios = require('axios');

async function testKkiaPayDirect() {
    try {
        console.log('🧪 Test DIRECT de KkiaPay avec différentes approches...\n');
        
        const publicKey = process.env.KKIAPAY_PUBLIC_KEY;
        
        console.log('1. 🔑 Test avec clé API:', publicKey?.substring(0, 10) + '...');
        
        // Test 1: Endpoint principal
        console.log('\n2. 🌐 Test endpoint principal...');
        const endpoints = [
            'https://api.kkiapay.me/api/v1/transactions',
            'https://api.kkiapay.me/v1/transactions', 
            'https://api.kkiapay.me/transactions',
            'https://api.kkiapay.me/api/transactions'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`\n   🔄 Test: ${endpoint}`);
                const response = await axios({
                    method: 'POST',
                    url: endpoint,
                    data: {
                        amount: 100,
                        api_key: publicKey,
                        phone: '+2290156035888',
                        email: 'olympeguidolokossou@gmail.com',
                        callback: 'https://quiz-de-carabin.netlify.app/payment-callback.html',
                        data: JSON.stringify({ test: true }),
                        name: "Quiz Test"
                    },
                    timeout: 10000
                });
                console.log('   ✅ SUCCÈS - Status:', response.status);
                console.log('   📦 Data:', response.data);
                break;
            } catch (error) {
                console.log('   ❌ ÉCHEC - Status:', error.response?.status, 'Message:', error.response?.data || error.message);
            }
        }

        // Test 2: Vérification de la santé de l'API
        console.log('\n3. 🏥 Test santé API...');
        try {
            const healthResponse = await axios.get('https://api.kkiapay.me/health', { timeout: 5000 });
            console.log('   ✅ API santé:', healthResponse.status, healthResponse.data);
        } catch (error) {
            console.log('   ❌ API santé inaccessible');
        }

    } catch (error) {
        console.error('💥 Erreur générale:', error.message);
    }
}

testKkiaPayDirect();