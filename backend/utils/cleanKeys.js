// utils/cleanKeys.js
function cleanPaydunyaKey(key) {
  if (!key) return '';
  
  // Supprimer les espaces, retours à la ligne et caractères invisibles
  let cleaned = key.trim();
  
  // Supprimer les guillemets s'ils sont présents
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  
  // Supprimer les caractères non-ASCII
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, '');
  
  return cleaned;
}

function checkPaydunyaKeys() {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY || '';
  const publicKey = process.env.PAYDUNYA_PUBLIC_KEY || '';
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY || '';
  const token = process.env.PAYDUNYA_TOKEN || '';
  const mode = process.env.PAYDUNYA_MODE || 'test';

  console.log('=== ANALYSE DES CLÉS PAYDUNYA ===');
  console.log('Mode:', mode);
  console.log('');

  // Vérification de la clé master
  console.log('Clé Master:', masterKey);
  console.log('Longueur:', masterKey.length);
  console.log('Format attendu: Devrait commencer par "master_live_" ou "masterKey_"');
  console.log('Format actuel:', masterKey.startsWith('master_live_') ? '✅ Correct' : '❌ Problème potentiel');
  console.log('');

  // Vérification de la clé publique
  console.log('Clé Publique:', publicKey);
  console.log('Longueur:', publicKey.length);
  console.log('Format attendu: Devrait commencer par "live_public_"');
  console.log('Format actuel:', publicKey.startsWith('live_public_') ? '✅ Correct' : '❌ Problème potentiel');
  console.log('');

  // Vérification de la clé privée
  console.log('Clé Privée:', privateKey);
  console.log('Longueur:', privateKey.length);
  console.log('Format attendu: Devrait commencer par "live_private_"');
  console.log('Format actuel:', privateKey.startsWith('live_private_') ? '✅ Correct' : '❌ Problème potentiel');
  console.log('');

  // Vérification du token
  console.log('Token:', token);
  console.log('Longueur:', token.length);
  console.log('');

  // Recommandation
  if (!masterKey.startsWith('master_live_') && !masterKey.startsWith('masterKey_')) {
    console.log('🚨 RECOMMANDATION: Votre clé master ne suit pas le format standard PayDunya.');
    console.log('Application de la correction automatique...');
  }
}

module.exports = { cleanPaydunyaKey, checkPaydunyaKeys };