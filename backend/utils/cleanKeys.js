// utils/cleanKeys.js
function cleanPaydunyaKey(key) {
  if (!key) return null;
  
  // Supprimer les espaces, guillemets et caractères invisibles
  return key
    .toString()
    .trim()
    .replace(/['"]/g, '') // Supprimer les guillemets
    .replace(/\s/g, '');   // Supprimer les espaces
}

module.exports = { cleanPaydunyaKey };