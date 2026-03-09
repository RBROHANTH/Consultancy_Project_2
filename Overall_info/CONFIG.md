# ============================================================
# Backend — package.json (Node.js + Apollo + PostgreSQL)
# ============================================================
# {
#   "name": "hyperlocal-backend",
#   "version": "1.0.0",
#   "scripts": {
#     "dev": "ts-node-dev --respawn src/index.ts",
#     "build": "tsc",
#     "migrate": "psql $DATABASE_URL -f migrations/migrations.sql"
#   },
#   "dependencies": {
#     "@apollo/server": "^4.10.0",
#     "graphql": "^16.8.0",
#     "pg": "^8.11.0",
#     "bcrypt": "^5.1.1",
#     "jsonwebtoken": "^9.0.2",
#     "uuid": "^9.0.0",
#     "express": "^4.18.2",
#     "graphql-subscriptions": "^2.0.0",
#     "graphql-ws": "^5.14.0"
#   },
#   "devDependencies": {
#     "typescript": "^5.4.0",
#     "ts-node-dev": "^2.0.0",
#     "@types/pg": "^8.11.0",
#     "@types/bcrypt": "^5.0.2",
#     "@types/jsonwebtoken": "^9.0.5",
#     "@types/uuid": "^9.0.7"
#   }
# }

# ============================================================
# Frontend — package.json (React + Vite + Apollo + MapLibre)
# ============================================================
# {
#   "name": "hyperlocal-frontend",
#   "version": "1.0.0",
#   "scripts": {
#     "dev": "vite",
#     "build": "vite build"
#   },
#   "dependencies": {
#     "react": "^18.2.0",
#     "react-dom": "^18.2.0",
#     "@apollo/client": "^3.9.0",
#     "graphql": "^16.8.0",
#     "maplibre-gl": "^4.1.0",
#     "@turf/turf": "^6.5.0",
#     "react-router-dom": "^6.22.0"
#   },
#   "devDependencies": {
#     "@vitejs/plugin-react": "^4.2.0",
#     "typescript": "^5.4.0",
#     "vite": "^5.2.0"
#   }
# }


# ============================================================
# .env.example  (backend)
# ============================================================

DB_HOST=localhost
DB_PORT=5432
DB_NAME=hyperlocal
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your-super-secret-jwt-key

PORT=4000

# Optional: OpenAI for chatbot
OPENAI_API_KEY=sk-...


# ============================================================
# .env.example  (frontend)
# ============================================================

VITE_API_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/graphql


# ============================================================
# docker-compose.yml  (local dev)
# ============================================================

# version: '3.9'
# services:
#   db:
#     image: postgis/postgis:16-3.4
#     environment:
#       POSTGRES_DB: hyperlocal
#       POSTGRES_USER: postgres
#       POSTGRES_PASSWORD: postgres
#     ports:
#       - "5432:5432"
#     volumes:
#       - pgdata:/var/lib/postgresql/data
#       - ./migrations/migrations.sql:/docker-entrypoint-initdb.d/init.sql
#
# volumes:
#   pgdata:
