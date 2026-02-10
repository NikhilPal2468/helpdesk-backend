# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Cloud Run expects PORT; default 8080
EXPOSE 8080

# Start server quickly so Cloud Run passes the health check. Run migrations first; if they fail (e.g. no DATABASE_URL), log and start anyway so you can see errors in logs.
CMD ["sh", "-c", "npx prisma migrate deploy || (echo 'Prisma migrate failed - check DATABASE_URL and Cloud SQL connection' && true); exec node dist/server.js"]
