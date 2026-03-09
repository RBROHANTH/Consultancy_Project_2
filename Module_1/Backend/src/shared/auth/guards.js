const { AuthenticationError, AuthorizationError } = require('../../domain/errors/DomainErrors');

function requireAuth(ctx) {
  if (!ctx.currentUser) throw new AuthenticationError();
}

function requireRole(ctx, role) {
  requireAuth(ctx);
  if (ctx.currentUser.role !== role) throw new AuthorizationError(role);
}

function requireAnyRole(ctx, roles) {
  requireAuth(ctx);
  if (!roles.includes(ctx.currentUser.role)) {
    throw new AuthorizationError(roles.join(' or '));
  }
}

module.exports = { requireAuth, requireRole, requireAnyRole };
