// ✅ MIDDLEWARE DE GESTION DES ERREURS MONGODB

const handleDatabaseError = (err, req, res, next) => {
    console.error('\n❌ ===== ERREUR BASE DE DONNÉES =====');
    console.error('Date:', new Date().toISOString());
    console.error('URL:', req.originalUrl);
    console.error('Méthode:', req.method);
    console.error('Erreur:', err.message);
    console.error('=====================================\n');

    // Erreur de validation Mongoose
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: 'Erreur de validation',
            errors: errors
        });
    }

    // Erreur de duplication (clé unique)
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: `${field} existe déjà`,
            field: field
        });
    }

    // Erreur de cast (ID invalide)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'ID invalide',
            field: err.path
        });
    }

    // Erreur de connexion MongoDB
    if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
        return res.status(503).json({
            success: false,
            message: 'Erreur de connexion à la base de données. Veuillez réessayer.',
            code: 'DB_CONNECTION_ERROR'
        });
    }

    // Erreur générique
    next(err);
};

module.exports = handleDatabaseError;