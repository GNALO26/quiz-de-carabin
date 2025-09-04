const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Un utilisateur avec cet email existe déjà.' });
    }
    
    // Create user
    const user = new User({ name, email, password });
    await user.save();
    
    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès.',
      token,
      user: { id: user._id, name: user.name, email: user.email, isPremium: user.isPremium }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }
    
    // Check password
    const isMatch = await user.correctPassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }
    
    // Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      message: 'Connexion réussie.',
      token,
      user: { id: user._id, name: user.name, email: user.email, isPremium: user.isPremium }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({
    success: true,
    user: { 
      id: req.user._id, 
      name: req.user.name, 
      email: req.user.email, 
      isPremium: req.user.isPremium 
    }
  });
});

module.exports = router;