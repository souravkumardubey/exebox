FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY apps/worker/ ./apps/worker/
COPY libs/shared/ ./libs/shared/
COPY libs/logger/ ./libs/logger/
COPY libs/database/ ./libs/database/
COPY libs/queue/ ./libs/queue/
COPY libs/sandbox/ ./libs/sandbox/

RUN corepack enable && npm install
RUN npx turbo build --filter=@exebox/worker

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app .
CMD ["node", "apps/worker/dist/index.js"]
