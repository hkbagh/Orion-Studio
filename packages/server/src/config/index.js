import { resolve, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  
  // Workspace root directory — where user project files live
  workspacesDir: process.env.WORKSPACES_DIR || resolve(process.cwd(), '../../workspaces'),
  workspacesHostPath: process.env.WORKSPACES_HOST_PATH || process.env.WORKSPACES_DIR || resolve(process.cwd(), '../../workspaces'),
  
  // Database
  dbPath: process.env.DB_PATH || resolve(process.cwd(), '../../data/orion.db'),
  
  // CORS origins
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:5173', 'http://localhost:3000'],
  
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
};

// Ensure workspace and data directories exist
if (!existsSync(config.workspacesDir)) {
  mkdirSync(config.workspacesDir, { recursive: true });
}

const dataDir = resolve(config.dbPath, '..');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export default config;
