const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  options: [{
    type: String,
    required: false
  }],
  correctAnswers: [{
    type: Number,
    required: true
  }],
  justification: {
    type: String,
    default: ''
  }
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
  free: {
    type: Boolean,
    default: true
  },
  questions: [QuestionSchema],
  duration: {
    type: Number, // en minutes
    default: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Quiz', QuizSchema);