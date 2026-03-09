class AuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
  }
}

class AuthorizationError extends Error {
  constructor(requiredRole) {
    super(`Requires ${requiredRole} role.`);
  }
}

class DuplicateEmailError extends Error {
  constructor() {
    super('Email already in use.');
  }
}

class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
  }
}

module.exports = {
  AuthenticationError,
  AuthorizationError,
  DuplicateEmailError,
  InvalidCredentialsError,
};
