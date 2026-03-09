const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

function signJwt(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

function verifyJwt(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signJwt, verifyJwt };
