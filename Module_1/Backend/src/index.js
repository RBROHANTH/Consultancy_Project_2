const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const express = require('express');
const cors = require('cors');
const { typeDefs } = require('./infrastructure/graphql/typeDefs');
const { authResolvers } = require('./infrastructure/graphql/resolvers/authResolvers');
const { buildContext } = require('./infrastructure/graphql/context');
const { pool } = require('./infrastructure/db/pool');

async function main() {
  const app = express();
  const PORT = parseInt(process.env.PORT ?? '4000');

  const server = new ApolloServer({
    typeDefs,
    resolvers: authResolvers,
  });

  await server.start();

  app.use(
    '/graphql',
    cors(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => buildContext({ req }),
    })
  );

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}/graphql`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await server.stop();
    await pool.end();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
