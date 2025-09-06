// backend/scripts/checkEnv.js
require('dotenv').config();

console.log('Vérification des variables d\'environnement:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✓ Défini' : '✗ Non défini');
console.log('PAYDUNYA_MASTER_KEY:', process.env.PAYDUNYA_MASTER_KEY ? '✓ Défini' : '✗ Non défini');
console.log('PAYDUNYA_PRIVATE_KEY:', process.env.PAYDUNYA_PRIVATE_KEY ? '✓ Défini' : '✗ Non défini');
console.log('PAYDUNYA_PUBLIC_KEY:', process.env.PAYDUNYA_PUBLIC_KEY ? '✓ Défini' : '✗ Non défini');
console.log('PAYDUNYA_TOKEN:', process.env.PAYDUNYA_TOKEN ? '✓ Défini' : '✗ Non défini');