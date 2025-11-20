const crypto = require('crypto');

function generateCode(length = 6) {
  // Utiliser des caractères facilement distinguables
  const chars = '12346790';
  let code = '';
  
  // Utiliser crypto pour une meilleure randomisation
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % chars.length;
    code += chars.charAt(randomIndex);
  }
  
  console.log(`🔑 Code généré: ${code}`);
  return code;
}

module.exports = generateCode;