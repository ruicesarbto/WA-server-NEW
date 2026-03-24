#!/usr/bin/env node

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || process.env.DBHOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || process.env.DBPORT || 3306),
  user: process.env.MYSQL_USER || process.env.DBUSER,
  password: process.env.MYSQL_PASSWORD || process.env.DBPASS,
  database: process.env.MYSQL_DATABASE || process.env.DBNAME,
  connectionLimit: Number(process.env.MYSQL_POOL_SIZE || process.env.DB_POOL_INITIAL || 10),
  charset: 'utf8mb4_general_ci'
};

function ensureConfig() {
  const missing = Object.entries({
    MYSQL_HOST: MYSQL_CONFIG.host,
    MYSQL_PORT: MYSQL_CONFIG.port,
    MYSQL_USER: MYSQL_CONFIG.user,
    MYSQL_PASSWORD: MYSQL_CONFIG.password,
    MYSQL_DATABASE: MYSQL_CONFIG.database
  })
    .filter(([, value]) => value === undefined || value === null || value === '')
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Configuração MySQL incompleta para MCP. Variáveis ausentes: ${missing.join(
        ', '
      )}. Ajuste no ambiente ou em .cursor/mcp.json.`
    );
  }
}

ensureConfig();

const pool = mysql.createPool({
  ...MYSQL_CONFIG,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const server = new McpServer({
  name: 'mysql-homemark1',
  version: '1.0.0'
});

const sqlInputSchema = z.object({
  sql: z
    .string()
    .min(1, 'Forneça um comando SQL.')
    .describe('Comando SQL para executar. Ex.: SELECT * FROM instance LIMIT 5'),
  params: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe('Parâmetros para prepared statements (opcional).'),
  rowLimit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .default(200)
    .describe('Limite máximo de linhas retornadas (default: 200, máximo: 1000).'),
  includeMetadata: z
    .boolean()
    .default(true)
    .describe('Se verdadeiro, inclui metadados (campos, tempo de execução).')
});

server.registerTool(
  'mysql-query',
  {
    title: 'Executar consulta SQL',
    description:
      'Executa uma consulta SQL no banco homemark1. Útil para SELECTs de diagnóstico. Utilize rowLimit para limitar o retorno.',
    inputSchema: sqlInputSchema
  },
  async ({ sql, params, rowLimit = 200, includeMetadata = true }) => {
    const limitedSql = `${sql.trim()}${/limit\s+\d+/i.test(sql) ? '' : ` LIMIT ${rowLimit}`}`;
    const startedAt = Date.now();

    try {
      const [rows, fields] = await pool.query(limitedSql, params ?? []);
      const durationMs = Date.now() - startedAt;

      const payload = {
        rowCount: Array.isArray(rows) ? rows.length : 0,
        rows: rows ?? [],
        durationMs,
        fields: includeMetadata
          ? fields?.map((field) => ({
              name: field.name,
              table: field.table,
              type: field.type
            }))
          : undefined
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2)
          }
        ],
        structuredContent: payload
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao executar consulta: ${
              error instanceof Error ? error.message : String(error)
            }`
          }
        ]
      };
    }
  }
);

server.registerTool(
  'mysql-list-tables',
  {
    title: 'Listar tabelas',
    description: 'Lista tabelas disponíveis no banco homemark1.',
    inputSchema: z
      .object({
        like: z
          .string()
          .optional()
          .describe('Filtro opcional para o nome da tabela (usa LIKE).')
      })
      .optional()
  },
  async (input) => {
    const { like } = input ?? {};
    const startedAt = Date.now();

    try {
      const clause = like ? 'AND table_name LIKE ?' : '';
      const params = like ? [like] : [];
      const [rows] = await pool.query(
        `SELECT table_name AS tableName, table_rows AS estimatedRows
         FROM information_schema.tables
         WHERE table_schema = ?
         ${clause}
         ORDER BY table_name ASC`,
        [MYSQL_CONFIG.database, ...params]
      );
      const durationMs = Date.now() - startedAt;

      const payload = {
        tableCount: Array.isArray(rows) ? rows.length : 0,
        tables: rows ?? [],
        durationMs
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2)
          }
        ],
        structuredContent: payload
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao listar tabelas: ${
              error instanceof Error ? error.message : String(error)
            }`
          }
        ]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP MySQL] Servidor iniciado via STDIO.');
}

main().catch((error) => {
  console.error('[MCP MySQL] Erro fatal:', error);
  process.exit(1);
});

const cleanup = async () => {
  try {
    await pool.end();
  } catch (error) {
    console.error('[MCP MySQL] Erro ao encerrar pool:', error);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
#!/usr/bin/env node

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || process.env.DBHOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || process.env.DBPORT || 3306),
  user: process.env.MYSQL_USER || process.env.DBUSER,
  password: process.env.MYSQL_PASSWORD || process.env.DBPASS,
  database: process.env.MYSQL_DATABASE || process.env.DBNAME,
  connectionLimit: Number(process.env.MYSQL_POOL_SIZE || process.env.DB_POOL_INITIAL || 10),
  charset: 'utf8mb4_general_ci'
};

function ensureConfig() {
  const missing = Object.entries({
    MYSQL_HOST: MYSQL_CONFIG.host,
    MYSQL_PORT: MYSQL_CONFIG.port,
    MYSQL_USER: MYSQL_CONFIG.user,
    MYSQL_PASSWORD: MYSQL_CONFIG.password,
    MYSQL_DATABASE: MYSQL_CONFIG.database
  })
    .filter(([, value]) => value === undefined || value === null || value === '')
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Configuração MySQL incompleta para MCP. Variáveis ausentes: ${missing.join(
        ', '
      )}. Ajuste no ambiente ou em .cursor/mcp.json.`
    );
  }
}

ensureConfig();

const pool = mysql.createPool({
  ...MYSQL_CONFIG,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const server = new McpServer({
  name: 'mysql-homemark1',
  version: '1.0.0'
});

const sqlInputSchema = z.object({
  sql: z
    .string()
    .min(1, 'Forneça um comando SQL.')
    .describe('Comando SQL para executar. Ex.: SELECT * FROM instance LIMIT 5'),
  params: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe('Parâmetros para prepared statements (opcional).'),
  rowLimit: z
    .number()
    .int()
    .positive()
    .max(1000)
    .default(200)
    .describe('Limite máximo de linhas retornadas (default: 200, máximo: 1000).'),
  includeMetadata: z
    .boolean()
    .default(true)
    .describe('Se verdadeiro, inclui metadados (campos, tempo de execução).')
});

server.registerTool(
  'mysql-query',
  {
    title: 'Executar consulta SQL',
    description:
      'Executa uma consulta SQL no banco homemark1. Útil para SELECTs de diagnóstico. Utilize rowLimit para limitar o retorno.',
    inputSchema: sqlInputSchema
  },
  async ({ sql, params, rowLimit = 200, includeMetadata = true }) => {
    const limitedSql = `${sql.trim()}${/limit\s+\d+/i.test(sql) ? '' : ` LIMIT ${rowLimit}`}`;
    const startedAt = Date.now();

    try {
      const [rows, fields] = await pool.query(limitedSql, params ?? []);
      const durationMs = Date.now() - startedAt;

      const payload = {
        rowCount: Array.isArray(rows) ? rows.length : 0,
        rows: rows ?? [],
        durationMs,
        fields: includeMetadata
          ? fields?.map((field) => ({
              name: field.name,
              table: field.table,
              type: field.type
            }))
          : undefined
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2)
          }
        ],
        structuredContent: payload
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao executar consulta: ${
              error instanceof Error ? error.message : String(error)
            }`
          }
        ]
      };
    }
  }
);

server.registerTool(
  'mysql-list-tables',
  {
    title: 'Listar tabelas',
    description: 'Lista tabelas disponíveis no banco homemark1.',
    inputSchema: z
      .object({
        like: z
          .string()
          .optional()
          .describe('Filtro opcional para o nome da tabela (usa LIKE).')
      })
      .optional()
  },
  async (input) => {
    const { like } = input ?? {};
    const startedAt = Date.now();

    try {
      const clause = like ? 'WHERE table_name LIKE ?' : '';
      const params = like ? [like] : [];
      const [rows] = await pool.query(
        `SELECT table_name AS tableName, table_rows AS estimatedRows
         FROM information_schema.tables
         WHERE table_schema = ?
         ${clause}
         ORDER BY table_name ASC`,
        [MYSQL_CONFIG.database, ...params]
      );
      const durationMs = Date.now() - startedAt;

      const payload = {
        tableCount: Array.isArray(rows) ? rows.length : 0,
        tables: rows ?? [],
        durationMs
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2)
          }
        ],
        structuredContent: payload
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Erro ao listar tabelas: ${
              error instanceof Error ? error.message : String(error)
            }`
          }
        ]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP MySQL] Servidor iniciado via STDIO.');
}

main().catch((error) => {
  console.error('[MCP MySQL] Erro fatal:', error);
  process.exit(1);
});

const cleanup = async () => {
  try {
    await pool.end();
  } catch (error) {
    console.error('[MCP MySQL] Erro ao encerrar pool:', error);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

