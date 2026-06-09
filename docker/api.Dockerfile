FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY apps/api-server/ ./apps/api-server/
COPY libs/shared/ ./libs/shared/
COPY libs/logger/ ./libs/logger/
COPY libs/database/ ./libs/database/
COPY libs/queue/ ./libs/queue/
COPY libs/sandbox/ ./libs/sandbox/

RUN corepack enable && npm install
RUN npx turbo build --filter=@exebox/api-server

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app .
EXPOSE 4000
CMD ["node", "apps/api-server/dist/index.js"]
