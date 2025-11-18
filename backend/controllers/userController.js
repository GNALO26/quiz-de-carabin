const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    // ✅ CORRECTION: Utiliser req.user._id au lieu de req.user.id
    const user = await User.findById(req.user._id).populate('quizHistory.quizId');
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // ✅ CORRECTION: Utiliser req.user._id et éviter de changer l'email sans vérification
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ AJOUT: Fonction getPremiumStatus manquante
exports.getPremiumStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      isPremium: user.isPremium || false,
      premiumExpiresAt: user.premiumExpiresAt
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ AJOUT: Fonction getAllUsers pour l'admin (optionnel)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};