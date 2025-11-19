require('dotenv').config();
const axios = require('axios');

async function testKkiaPayLive() {
    try {
        console.log('🧪 Test de connexion directe à KkiaPay...');
        
        const publicKey = process.env.KKIAPAY_PUBLIC_KEY;
        const baseURL = 'https://api.kkiapay.me';
        
        console.log('🔑 Clé publique:', publicKey);
        console.log('🌐 URL de test:', `${baseURL}/api/v1/transactions`);
        
        const testPayload = {
            amount: 100,
            apikey: publicKey,
            phone: '+2290156035888',
            email: 'olympeguidolokossoux@gmail.com',
            callback: 'https://quiz-de-carabin.netlify.app/payment-callback.html',
            data: JSON.stringify({ test: true }),
            theme: "#13a718",
            name: "Quiz de Carabin"
        };

        console.log('📤 Payload de test:', JSON.stringify(testPayload, null, 2));

        const response = await axios({
            method: 'POST',
            url: `${baseURL}/api/v1/transactions`,
            data: testPayload,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        console.log('✅ SUCCÈS - Réponse KkiaPay:');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
        
    } catch (error) {
        console.error('❌ ERREUR - Détails complets:');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', error.response.data);
            console.error('URL:', error.response.config?.url);
        } else if (error.request) {
            console.error('Aucune réponse reçue');
            console.error('Request:', error.request);
        } else {
            console.error('Erreur:', error.message);
        }
        
        console.error('Stack:', error.stack);
    }
}

testKkiaPayLive();