require('dotenv').config();

console.log('🔐 VÉRIFICATION DES CLÉS KKiaPay\n');

const keys = {
  KKIAPAY_PUBLIC_KEY: process.env.KKIAPAY_PUBLIC_KEY,
  KKIAPAY_SECRET_KEY: process.env.KKIAPAY_SECRET_KEY,
  KKIAPAY_PRIVATE_KEY: process.env.KKIAPAY_PRIVATE_KEY
};

Object.entries(keys).forEach(([key, value]) => {
  const status = value ? '✅ PRÉSENTE' : '❌ MANQUANTE';
  const preview = value ? `${value.substring(0, 15)}...` : 'N/A';
  console.log(`${key}: ${status}`);
  console.log(`   Valeur: ${preview}`);
});

console.log('\n📋 INSTRUCTIONS:');
console.log('1. Allez sur https://admin.kkiapay.me/');
console.log('2. Connectez-vous à votre compte');
console.log('3. Allez dans Paramètres → API Keys');
console.log('4. Copiez les clés dans votre fichier .env');
console.log('5. Redémarrez votre application');

console.log('\n🔗 Documentation: https://docs.kkiapay.me/');