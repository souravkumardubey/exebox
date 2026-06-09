# exebox

**AI Code Sandbox** — A secure, Docker-backed code execution API for AI agents. Run untrusted code in isolated sandboxes via REST + WebSocket.

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐
│  AI Agent   │────▶│  API     │────▶│  BullMQ  │────▶│ Worker  │
│  (Client)   │     │  Server  │     │  (Redis) │     │         │
└─────────────┘     └──────────┘     └──────────┘     └──┬──────┘
       ▲                                                  │
       │              ┌──────────┐                        │
       └──────────────│  WS      │◀───── Redis PubSub ────┘
                      │  Gateway │
                      └──────────┘
```

### Services

| Service | Port | Health | Description |
|---------|------|--------|-------------|
| **API Server** | `4000` | `/health` | REST API for code execution, sessions, and API key auth |
| **Worker** | `4003` | `/health` | Processes execution jobs via BullMQ, runs code in Docker sandboxes |
| **WS Gateway** | `4001` | `/health` | WebSocket server (Socket.IO) for streaming execution output |
| **PostgreSQL** | `5432` | — | Persistent storage for executions, sessions, API keys |
| **Redis** | `6379` | — | Job queue (BullMQ) + rate limiter + PubSub for real-time events |

### Supported Languages

| Language | Image | Timeout | Memory |
|----------|-------|---------|--------|
| Python 3.12 | `exebox-python` | 10s | 256MB |
| JavaScript (Node 20) | `exebox-node` | 10s | 256MB |
| TypeScript 5.4 | `exebox-node` | 15s | 256MB |
| Go 1.22 | `exebox-go` | 15s | 256MB |
| Java 21 | `exebox-java` | 20s | 512MB |
| C++17 | `exebox-cpp` | 15s | 256MB |
| Rust 1.77 | `exebox-rust` | 20s | 512MB |

## Getting Started

### Prerequisites

- Node.js >= 20
- Docker (with Orbstack, Docker Desktop, or equivalent)
- PostgreSQL 16
- Redis 7

### Full Startup Sequence

#### 1. Clone & Install

```bash
git clone https://github.com/souravkumardubey/exebox.git
cd exebox
npm install
```

#### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env if your PostgreSQL/Redis use non-default credentials
```

#### 3. Build Sandbox Runner Images

```bash
# Build all 6 sandbox images (python, node, go, java, cpp, rust)
docker/docker/build.sh

# Or build a single image
docker/docker/build.sh python
```

These images are the isolated environments where untrusted code executes.

#### 4. Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates tables and enums)
npx prisma migrate dev --name init

# Alternative (development, no migration history):
# npx prisma db push
```

#### 5. Seed Initial Data

```bash
npm run db:seed
```

This creates admin and development API keys and syncs them to Redis for WS authentication. **Save the printed keys.**

#### 6. Start Services

```bash
# Option A: All services via Docker Compose
docker compose -f docker/docker-compose.yml up --build

# Option B: Manually (3 terminals)
npm run dev                              # API server (port 4000)
npm run dev --filter=@exebox/worker      # Worker (health on 4003)
npm run dev --filter=@exebox/ws-server   # WS gateway (port 4001, health on 4004)

# Dependencies (PostgreSQL + Redis) must be running separately in either case:
docker run -d --name exebox-pg -e POSTGRES_PASSWORD=exebox_dev \
  -e POSTGRES_USER=exebox -e POSTGRES_DB=exebox -p 5432:5432 postgres:16-alpine
docker run -d --name exebox-redis -p 6379:6379 redis:7-alpine
```

### Creating Additional API Keys

```bash
# Via CLI
npm run create-key -- MyKeyName

# Via API (requires existing admin key)
curl -X POST http://localhost:4000/v1/api-keys \
  -H "Authorization: Bearer exe_sk_<admin_key>" \
  -H "Content-Type: application/json" \
  -d '{"name": "MyKeyName"}'
```

## API Reference

Base URL: `http://localhost:4000/v1`

Full OpenAPI spec available at `GET /v1/openapi.json`.

All requests (except `/languages` and `/health`) require an API key via `Authorization: Bearer exe_sk_...`.

### Execute Code

```http
POST /v1/execute
Content-Type: application/json
Authorization: Bearer exe_sk_<your_key>

{
  "language": "python",
  "sourceCode": "print('hello world')",
  "stdin": ""
}
```

### Batch Execution (with Test Cases)

```http
POST /v1/execute/batch
Content-Type: application/json
Authorization: Bearer exe_sk_<your_key>

{
  "language": "javascript",
  "sourceCode": "const n = parseInt(args[0]); console.log(n * 2);",
  "testCases": [
    { "input": "5", "expectedOutput": "10" },
    { "input": "0", "expectedOutput": "0" },
    { "hidden": true, "input": "100", "expectedOutput": "200" }
  ]
}
```

### Sessions (Persistent Containers)

```http
POST /v1/sessions
Content-Type: application/json
Authorization: Bearer exe_sk_<your_key>

{ "language": "python" }

# Response
{ "sessionId": "abc123", "status": "active", "expiresAt": "..." }

# Execute in session
POST /v1/sessions/abc123/exec
Content-Type: application/json
Authorization: Bearer exe_sk_<your_key>

{ "code": "print('hello')" }
```

### Get Execution Result

```http
GET /v1/executions/:id
Authorization: Bearer exe_sk_<your_key>
```

### List Supported Languages

```http
GET /v1/languages
```

### WebSocket (Streaming Output)

```javascript
const socket = io('ws://localhost:4001', {
  auth: { token: 'exe_sk_<your_key>' }
});

socket.emit('subscribe:execution', '<executionId>');
socket.on('execution:log', (data) => console.log(data.stdout));
socket.on('execution:completed', (data) => console.log('Done:', data));
```

## API Key Management

```
POST   /v1/api-keys          # Create key (body: { name })
GET    /v1/api-keys          # List keys (redacted)
DELETE /v1/api-keys/:id      # Revoke key
```

Keys are formatted as `exe_sk_{prefix}_{random}` and stored as SHA-256 hashes. The plaintext key is shown once on creation — save it securely.

## Security

- **No network** in sandbox containers (`NetworkMode: none`)
- **Read-only root filesystem** (`ReadonlyRootfs: true`)
- **No Linux capabilities** (`CapDrop: ALL`, `no-new-privileges`)
- **Memory & CPU limits** enforced via Docker cgroups
- **PID limit** (500) prevents fork bombs
- **Temp filesystem** with `noexec` for `/tmp`
- **File descriptor limits** (1024 soft, 2048 hard)
- **API key auth** with SHA-256 hashed keys, never stored in plaintext
- **Rate limiting** via Redis sliding window (per-key)
- **Session reaper** auto-destroys expired containers every 5 minutes

## Project Structure

```
exebox/
├── apps/
│   ├── api-server/     # Express REST API
│   ├── worker/         # BullMQ job processor
│   └── ws-server/      # Socket.IO gateway
├── libs/
│   ├── shared/         # Types, constants, enums
│   ├── logger/         # Pino logger
│   ├── database/       # Prisma client
│   ├── sandbox/        # Dockerode engine
│   └── queue/          # BullMQ queue + worker factory
├── docker/
│   ├── *.Dockerfile    # Sandbox runner images (6 languages)
│   ├── api.Dockerfile  # API server container
│   ├── worker.Dockerfile
│   ├── ws.Dockerfile
│   ├── docker-compose.yml
│   └── build.sh
├── prisma/
│   ├── schema.prisma
│   ├── migrations/     # SQL migration files
│   └── seed.ts         # Initial API key generator
├── scripts/
│   └── create-key.ts   # CLI key generator
├── tests/              # Vitest test suite
└── .github/workflows/  # GitHub Actions CI
```

## Development

```bash
# Build all packages
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch

# Create API key (requires DB + Redis running)
npm run create-key -- MyKeyName
```

## License

MIT
