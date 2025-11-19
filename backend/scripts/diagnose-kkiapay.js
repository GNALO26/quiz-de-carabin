require('dotenv').config();

console.log('🔍 DIAGNOSTIC COMPLET KKiaPay');
console.log('================================');

// Vérification des variables d'environnement
console.log('\n1. ✅ Variables d\'environnement:');
console.log('   - KKIAPAY_PUBLIC_KEY:', process.env.KKIAPAY_PUBLIC_KEY ? '✓ Présente' : '✗ MANQUANTE');
console.log('   - KKIAPAY_SECRET_KEY:', process.env.KKIAPAY_SECRET_KEY ? '✓ Présente' : '✗ MANQUANTE');
console.log('   - KKIAPAY_PRIVATE_KEY:', process.env.KKIAPAY_PRIVATE_KEY ? '✓ Présente' : '✗ MANQUANTE');
console.log('   - KKIAPAY_MODE:', process.env.KKIAPAY_MODE || 'live');
console.log('   - NODE_ENV:', process.env.NODE_ENV);

// Vérification du format des clés
console.log('\n2. 🔑 Format des clés:');
if (process.env.KKIAPAY_PUBLIC_KEY) {
    console.log('   - Public Key length:', process.env.KKIAPAY_PUBLIC_KEY.length);
    console.log('   - Public Key starts with:', process.env.KKIAPAY_PUBLIC_KEY.substring(0, 10) + '...');
}

if (process.env.KKIAPAY_SECRET_KEY) {
    console.log('   - Secret Key starts with:', process.env.KKIAPAY_SECRET_KEY.substring(0, 10) + '...');
}

// Vérification des URLs
console.log('\n3. 🌐 URLs de configuration:');
console.log('   - FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('   - BACKEND_URL:', process.env.BACKEND_URL);

console.log('\n4. 📋 Recommandations:');
if (!process.env.KKIAPAY_PUBLIC_KEY) {
    console.log('   ❌ KKIAPAY_PUBLIC_KEY est manquante!');
}
if (!process.env.KKIAPAY_SECRET_KEY) {
    console.log('   ❌ KKIAPAY_SECRET_KEY est manquante!');
}

console.log('\n🔍 Diagnostic terminé.');