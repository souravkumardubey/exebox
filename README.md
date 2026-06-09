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

| Service | Port | Description |
|---------|------|-------------|
| **API Server** | `4000` | REST API for code execution, sessions, and API key auth |
| **Worker** | — | Processes execution jobs via BullMQ, runs code in Docker sandboxes |
| **WS Gateway** | `4001` | WebSocket server (Socket.IO) for streaming execution output |
| **PostgreSQL** | `5432` | Persistent storage for executions, sessions, API keys |
| **Redis** | `6379` | Job queue (BullMQ) + PubSub for real-time events |

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

## Quick Start

### Prerequisites

- Node.js >= 20
- Docker
- PostgreSQL 16
- Redis 7

### 1. Clone & Install

```bash
git clone https://github.com/souravkumardubey/exebox.git
cd exebox
npm install
```

### 2. Build Sandbox Images

```bash
docker/docker/build.sh
```

### 3. Setup Database

```bash
cp .env.example .env
npx prisma generate
npx prisma db push
```

### 4. Start Services

```bash
# Option A: All via Docker
docker compose -f docker/docker-compose.yml up

# Option B: Manual (terminals)
npm run dev            # API server (port 4000)
npm run dev --filter=@exebox/worker    # Worker
npm run dev --filter=@exebox/ws-server # WS gateway (port 4001)
```

## API Reference

Base URL: `http://localhost:4000/v1`

All requests (except `/languages`) require an API key via `Authorization: Bearer exe_sk_...`.

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

## Security

- **No network** in sandbox containers (`NetworkMode: none`)
- **Read-only root filesystem** (`ReadonlyRootfs: true`)
- **No Linux capabilities** (`CapDrop: ALL`, `no-new-privileges`)
- **Memory & CPU limits** enforced via Docker cgroups
- **PID limit** (500) prevents fork bombs
- **Temp filesystem** with `noexec` for `/tmp`
- **File descriptor limits** (1024 soft, 2048 hard)
- **API key auth** with SHA-256 hashed keys

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
│   └── queue/          # BullMQ queue
├── docker/
│   ├── *.Dockerfile    # Sandbox runner images
│   ├── docker-compose.yml
│   └── build.sh
├── prisma/
│   └── schema.prisma
└── package.json
```

## License

MIT
