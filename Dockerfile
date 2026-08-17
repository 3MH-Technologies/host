# Multi-stage Dockerfile for 3MH Host on Fly.io

# Stage 1: Get Caddy binary
FROM caddy:2-alpine AS caddy-stage

# Stage 2: Builder
FROM oven/bun:1-slim AS builder
WORKDIR /app

# Copy dependency definition files
COPY package.json bun.lock tsconfig.json next.config.ts ./
COPY prisma ./prisma/

# Install root dependencies
RUN bun install

# Copy mini-services dependencies and install
COPY mini-services ./mini-services
RUN cd mini-services/process-manager && bun install
RUN cd mini-services/terminal-service && bun install

# Copy source code
COPY src ./src
COPY public ./public
COPY db ./db
COPY Caddyfile ./

# Generate Prisma Client & build Next.js standalone app
RUN bun run db:generate
RUN bun run build

# Stage 3: Production Runner
FROM oven/bun:1-slim AS runner

# Install runtime tools (Caddy, SQLite, Python, PHP, CA certificates)
COPY --from=caddy-stage /usr/bin/caddy /usr/bin/caddy

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    sqlite3 \
    python3 \
    python3-pip \
    php-cli \
    procps \
    bash \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Next.js standalone build and static files from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/db ./db
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/Caddyfile ./Caddyfile

# Copy startup script
COPY start-fly.sh ./start-fly.sh
RUN chmod +x ./start-fly.sh

# Environment setup
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/data/custom.db

EXPOSE 8080

CMD ["/app/start-fly.sh"]
