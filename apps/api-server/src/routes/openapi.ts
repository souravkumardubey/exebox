import { Request, Response, Router } from 'express';

const router = Router();

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'exebox API',
    version: '0.1.0',
    description: 'AI Code Sandbox — A REST API for AI agents to securely run untrusted code in isolated Docker containers.',
  },
  servers: [{ url: 'http://localhost:4000', description: 'local' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'Bearer exe_sk_<your_key>',
      },
    },
    schemas: {
      ExecutionRequest: {
        type: 'object',
        required: ['language', 'sourceCode'],
        properties: {
          language: { type: 'string', enum: ['python', 'javascript', 'typescript', 'go', 'java', 'cpp', 'rust'] },
          sourceCode: { type: 'string', maxLength: 50000 },
          stdin: { type: 'string', default: '' },
          timeout: { type: 'integer', minimum: 1000, maximum: 60000 },
        },
      },
      BatchExecutionRequest: {
        type: 'object',
        required: ['language', 'sourceCode', 'testCases'],
        properties: {
          language: { $ref: '#/components/schemas/ExecutionRequest/properties/language' },
          sourceCode: { $ref: '#/components/schemas/ExecutionRequest/properties/sourceCode' },
          stdin: { $ref: '#/components/schemas/ExecutionRequest/properties/stdin' },
          testCases: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              required: ['expectedOutput'],
              properties: {
                input: { type: 'string' },
                expectedOutput: { type: 'string' },
                hidden: { type: 'boolean', default: false },
              },
            },
          },
        },
      },
      ExecutionResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              executionId: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
      SessionRequest: {
        type: 'object',
        required: ['language'],
        properties: {
          language: { $ref: '#/components/schemas/ExecutionRequest/properties/language' },
        },
      },
      SessionExecRequest: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', maxLength: 50000 },
          stdin: { type: 'string', default: '' },
        },
      },
    },
  },
  paths: {
    '/v1/execute': {
      post: {
        summary: 'Execute code',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionRequest' } } },
        },
        responses: {
          '201': { description: 'Execution queued', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionResponse' } } } },
          '400': { description: 'Validation error' },
          '401': { description: 'Invalid API key' },
          '429': { description: 'Rate limited' },
        },
      },
    },
    '/v1/execute/batch': {
      post: {
        summary: 'Execute code with test cases',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BatchExecutionRequest' } } },
        },
        responses: {
          '201': { description: 'Batch execution queued' },
        },
      },
    },
    '/v1/sessions': {
      post: {
        summary: 'Create a persistent session',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionRequest' } } },
        },
        responses: {
          '201': { description: 'Session created' },
        },
      },
    },
    '/v1/sessions/{id}/exec': {
      post: {
        summary: 'Execute code in a session',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionExecRequest' } } },
        },
        responses: {
          '201': { description: 'Execution queued in session' },
        },
      },
    },
    '/v1/sessions/{id}': {
      delete: {
        summary: 'Destroy a session',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Session destroyed' },
        },
      },
    },
    '/v1/executions/{id}': {
      get: {
        summary: 'Get execution result',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Execution details' },
        },
      },
    },
    '/v1/executions': {
      get: {
        summary: 'List executions',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': { description: 'Paginated list of executions' },
        },
      },
    },
    '/v1/languages': {
      get: {
        summary: 'List supported languages',
        responses: {
          '200': { description: 'Language list' },
        },
      },
    },
    '/v1/api-keys': {
      post: {
        summary: 'Create API key',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
        },
        responses: {
          '201': { description: 'API key created' },
        },
      },
      get: {
        summary: 'List API keys',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': { description: 'API key list' },
        },
      },
      delete: {
        summary: 'Revoke API key',
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'API key revoked' },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': { description: 'Service is healthy' },
        },
      },
    },
  },
};

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(spec);
});

export default router;
