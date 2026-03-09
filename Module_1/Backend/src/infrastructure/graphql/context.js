const { verifyJwt } = require('../../shared/auth/jwt');
const { pool } = require('../db/pool');
const { PgUserRepository } = require('../db/repositories/PgUserRepository');

async function buildContext({ req }) {
  const authHeader = req.headers.authorization ?? '';
  let currentUser = null;

  if (authHeader.startsWith('Bearer ')) {
    try {
      currentUser = verifyJwt(authHeader.slice(7));
    } catch {
      // invalid token — treat as unauthenticated
    }
  }

  return {
    currentUser,
    repos: {
      users: new PgUserRepository(pool),
    },
  };
}

module.exports = { buildContext };
