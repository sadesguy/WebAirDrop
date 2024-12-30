FROM oven/bun:latest AS builder

WORKDIR /app

# Install all dependencies for build
COPY package.json bun.lockb ./
RUN bun install

# Copy source code
COPY . .

ENV NODE_ENV=production

# Build client and server
RUN bun run build

FROM oven/bun:latest

WORKDIR /app

# Copy built files with vite config
COPY --from=builder /app/dist/server ./server
COPY --from=builder /app/dist/public ./public
COPY --from=builder /app/vite.config.ts ./server/
COPY --from=builder /app/theme.json ./server/

# Install production dependencies with Vite plugins
WORKDIR /app/server
COPY --from=builder /app/dist/server/package.json ./package.json
RUN bun install

# Environment setup
ENV NODE_ENV=production

# Start server
CMD ["bun", "index.js"]