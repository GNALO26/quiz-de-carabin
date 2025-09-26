// const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
// ... (QuestionSchema inchangé)
});

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
  // NOUVEAU CHAMP : Pour la matière générale (Anatomie, Physiologie, Histologie...)
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