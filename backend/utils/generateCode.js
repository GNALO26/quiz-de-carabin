const AccessCode = require('../models/AccessCode');

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateUniqueCode = async () => {
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = generateCode();
    const existing = await AccessCode.findOne({ code });
    if (!existing) isUnique = true;
  }
  
  return code;
};

module.exports = generateUniqueCode;