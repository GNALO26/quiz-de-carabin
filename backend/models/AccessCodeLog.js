const mongoose = require('mongoose');

const accessCodeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  sent: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: null
  }
});

module.exports = mongoose.model('AccessCodeLog', accessCodeLogSchema);