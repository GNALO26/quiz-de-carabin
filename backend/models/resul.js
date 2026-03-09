const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    totalQuestions: {
        type: Number,
        required: true
    },
    correctAnswers: {
        type: Number,
        required: true
    },
    answers: [{
        questionIndex: Number,
        selectedAnswers: [Number],
        correct: Boolean
    }],
    timeSpent: {
        type: Number, // en secondes
        default: 0
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index pour performance
resultSchema.index({ userId: 1, completedAt: -1 });
resultSchema.index({ quizId: 1 });

module.exports = mongoose.model('Result', resultSchema);