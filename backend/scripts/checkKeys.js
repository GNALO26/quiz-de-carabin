// scripts/checkKeys.js
require('dotenv').config();
const { cleanPaydunyaKey } = require('../utils/cleanKeys');

console.log('=== VÉRIFICATION DES CLÉS PAYDUNYA ===');

const keys = {
  'PAYDUNYA_MASTER_KEY': process.env.PAYDUNYA_MASTER_KEY,
  'PAYDUNYA_PRIVATE_KEY': process.env.PAYDUNYA_PRIVATE_KEY,
  'PAYDUNYA_PUBLIC_KEY': process.env.PAYDUNYA_PUBLIC_KEY,
  'PAYDUNYA_TOKEN': process.env.PAYDUNYA_TOKEN
};

Object.entries(keys).forEach(([keyName, keyValue]) => {
  console.log(`\n${keyName}:`);
  console.log(`  Valeur: ${keyValue ? keyValue.substring(0, 15) + '...' : 'NON DÉFINIE'}`);
  console.log(`  Longueur: ${keyValue ? keyValue.length : 0}`);
  
  if (keyValue) {
    console.log(`  Contient des espaces: ${/\s/.test(keyValue)}`);
    console.log(`  Contient des guillemets: ${/["']/.test(keyValue)}`);
    console.log(`  Contient des caractères non-ASCII: ${/[^\x20-\x7E]/.test(keyValue)}`);
    
    // Afficher les codes des caractères pour identification
    const charCodes = [];
    for (let i = 0; i < Math.min(keyValue.length, 20); i++) {
      charCodes.push(keyValue.charCodeAt(i));
    }
    console.log(`  Codes des premiers caractères: [${charCodes.join(', ')}]`);
  }
});

console.log('\n=== CLÉS NETTOYÉES ===');
Object.entries(keys).forEach(([keyName, keyValue]) => {
  if (keyValue) {
    const cleaned = cleanPaydunyaKey(keyValue);
    console.log(`${keyName}: ${cleaned.substring(0, 15)}... (longueur: ${cleaned.length})`);
  }
});