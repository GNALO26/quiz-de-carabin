const mongoose = require('mongoose');
require('dotenv').config();

const cleanDuplicateUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = mongoose.model('User');
    
    // Trouver tous les emails en double (normalisés)
    const duplicates = await User.aggregate([
      {
        $project: {
          email: { $toLower: "$email" }
        }
      },
      {
        $group: {
          _id: "$email",
          count: { $sum: 1 },
          ids: { $push: "$_id" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);
    
    console.log(`${duplicates.length} emails en double trouvés`);
    
    // Garder le premier utilisateur et supprimer les doublons
    for (const dup of duplicates) {
      const [keepId, ...deleteIds] = dup.ids;
      
      console.log(`Garder ${keepId}, supprimer ${deleteIds.join(', ')} pour l'email ${dup._id}`);
      
      await User.deleteMany({ _id: { $in: deleteIds } });
    }
    
    console.log('Nettoyage des doublons terminé');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors du nettoyage:', error);
    process.exit(1);
  }
};

cleanDuplicateUsers();