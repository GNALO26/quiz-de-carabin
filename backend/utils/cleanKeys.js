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

module.exports = { cleanPaydunyaKey };