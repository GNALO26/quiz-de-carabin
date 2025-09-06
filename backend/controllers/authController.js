const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation des champs requis
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un nom, un email et un mot de passe.',
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà.',
      });
    }

    // Créer un nouvel utilisateur
    const newUser = await User.create({
      name,
      email,
      password,
    });

    // Générer le token JWT
    const token = signToken(newUser._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        isPremium: newUser.isPremium,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    
    // Gestion des erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la création du compte.',
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier si l'email et le mot de passe sont fournis
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un email et un mot de passe.',
      });
    }

    // Vérifier si l'utilisateur existe
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
      });
    }

    // Vérifier le mot de passe avec bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect.',
      });
    }

    // Mettre à jour la date de dernière connexion
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Générer le token JWT
    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion.',
    });
  }
};