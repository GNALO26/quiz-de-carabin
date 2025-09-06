function cleanPaydunyaKey(key) {
  if (!key) return null;
  
  // Nettoyage agressif mais préservant les tirets
  return key
    .toString()
    .replace(/[\x00-\x1F\x7F]/g, '')  // Supprime les caractères de contrôle
    .replace(/\s/g, '')               // Supprime tous les espaces
    .replace(/['"`]/g, '')            // Supprime les guillemets
    .trim();
}

module.exports = { cleanPaydunyaKey };