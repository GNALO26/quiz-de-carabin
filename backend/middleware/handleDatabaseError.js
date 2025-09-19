const handleDatabaseError = (err, req, res, next) => {
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    console.error('Database error:', err);
    
    // Erreurs spécifiques
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Un document avec cette valeur existe déjà',
        code: 'DUPLICATE_KEY'
      });
    }
    
    if (err.code === 121) {
      return res.status(400).json({
        success: false,
        message: 'Document validation failed',
        code: 'VALIDATION_ERROR'
      });
    }
    
    // Erreur générale de base de données
    return res.status(503).json({
      success: false,
      message: 'Service temporairement indisponible',
      code: 'DATABASE_UNAVAILABLE'
    });
  }
  
  next(err);
};

module.exports = handleDatabaseError;