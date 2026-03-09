const typeDefs = `#graphql
  scalar DateTime

  enum Role {
    USER
    ARTISAN
    ADMIN
  }

  type GeoPoint {
    lat: Float!
    lng: Float!
  }

  input GeoPointInput {
    lat: Float!
    lng: Float!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: Role!
    location: GeoPoint
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    role: Role = USER
    location: GeoPointInput
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type Query {
    me: User
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    updateMyLocation(location: GeoPointInput!): User!
  }
`;

module.exports = { typeDefs };
