FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json turbo.json tsconfig.base.json ./
COPY apps/ws-server/ ./apps/ws-server/
COPY libs/shared/ ./libs/shared/
COPY libs/logger/ ./libs/logger/

RUN corepack enable && npm install
RUN npx turbo build --filter=@exebox/ws-server

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app .
EXPOSE 4001
CMD ["node", "apps/ws-server/dist/index.js"]
