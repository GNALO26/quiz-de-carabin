function cleanPaydunyaKey(key) {
  if (!key) return null;
  
  // Supprimer tous les caractères non-ASCII et espaces
  return key
    .toString()
    .replace(/[^\x20-\x7E]/g, '')  // Supprimer les caractères non-ASCII
    .replace(/\s/g, '')             // Supprimer les espaces
    .replace(/['"]/g, '')           // Supprimer les guillemets
    .trim();
}

module.exports = { cleanPaydunyaKey };