const mongoose = require('mongoose');

// Schéma pour les options de réponse (a, b, c, d, e)
const OptionSchema = new mongoose.Schema({
    // Le texte de l'option (e.g., "Diaphragme")
    text: { 
        type: String, 
        required: true // Reste requis
    }
});

// Schéma pour une question unique
const QuestionSchema = new mongoose.Schema({
    // Le corps de la question
    text: {
        type: String, 
        required: true 
    },
    // Le tableau des options de réponse
    options: [OptionSchema], 
    // Les indices des réponses correctes [0, 1, 2, ...]
    correctAnswers: { 
        type: [Number],
        required: true 
    },
    // L'explication détaillée de la réponse (Justification)
    justification: {
        type: String,
        default: ''
    }
});


// Schéma pour l'ensemble du Quiz (l'objet qui sera stocké)
const QuizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true
  },
  subject: { 
    type: String,
    required: true 
  },
  free: {
    type: Boolean,
    default: true
  },
  questions: [QuestionSchema],
  duration: {
    type: Number, // en minutes
    default: 20
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Quiz', QuizSchema);