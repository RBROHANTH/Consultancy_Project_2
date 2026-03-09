const { User } = require('../../../domain/entities/User');
const { GeoPoint } = require('../../../domain/value-objects/GeoPoint');
const { DuplicateEmailError, InvalidCredentialsError } = require('../../../domain/errors/DomainErrors');
const { signJwt } = require('../../../shared/auth/jwt');
const { requireAuth } = require('../../../shared/auth/guards');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    location: user.location
      ? { lat: user.location.lat, lng: user.location.lng }
      : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

const authResolvers = {
  Query: {
    me: async (_parent, _args, ctx) => {
      if (!ctx.currentUser) return null;
      const user = await ctx.repos.users.findById(ctx.currentUser.userId);
      if (!user) return null;
      return formatUser(user);
    },
  },

  Mutation: {
    register: async (_parent, { input }, ctx) => {
      const existing = await ctx.repos.users.findByEmail(input.email);
      if (existing) throw new DuplicateEmailError();

      const passwordHash = await bcrypt.hash(input.password, 12);
      const location = input.location ? GeoPoint.from(input.location) : undefined;

      const user = new User({
        id: uuidv4(),
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role ?? 'USER',
        location,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const saved = await ctx.repos.users.save(user);
      const token = signJwt({ userId: saved.id, role: saved.role });
      return { token, user: formatUser(saved) };
    },

    login: async (_parent, { input }, ctx) => {
      const user = await ctx.repos.users.findByEmail(input.email);
      if (!user) throw new InvalidCredentialsError();

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new InvalidCredentialsError();

      const token = signJwt({ userId: user.id, role: user.role });
      return { token, user: formatUser(user) };
    },

    updateMyLocation: async (_parent, { location }, ctx) => {
      requireAuth(ctx);
      const point = new GeoPoint(location.lat, location.lng);
      await ctx.repos.users.updateLocation(ctx.currentUser.userId, point);

      const user = await ctx.repos.users.findById(ctx.currentUser.userId);
      if (!user) throw new Error('User not found.');
      return formatUser(user);
    },
  },
};

module.exports = { authResolvers };
