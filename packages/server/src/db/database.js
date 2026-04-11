import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;

export function getDatabase() {
  if (db) return db;

  db = new Database(config.dbPath, {});
  
  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  console.log(`[DB] SQLite initialized: ${config.dbPath}`);
  return db;
}

// ── Workspace Queries ──

export function createWorkspace(id, name, image, path) {
  const db = getDatabase();
  const stmt = db.prepare(
    'INSERT INTO workspaces (id, name, image, path) VALUES (?, ?, ?, ?)'
  );
  stmt.run(id, name, image, path);
  return getWorkspaceById(id);
}

export function getWorkspaceById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
}

export function listWorkspaces() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM workspaces ORDER BY last_accessed_at DESC').all();
}

export function updateWorkspaceStatus(id, status, containerId = null) {
  const db = getDatabase();
  const stmt = db.prepare(
    'UPDATE workspaces SET status = ?, container_id = ?, last_accessed_at = datetime(\'now\') WHERE id = ?'
  );
  stmt.run(status, containerId, id);
}

export function deleteWorkspace(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
}

export function touchWorkspace(id) {
  const db = getDatabase();
  db.prepare('UPDATE workspaces SET last_accessed_at = datetime(\'now\') WHERE id = ?').run(id);
}

// ── Conversation Queries ──

export function createConversation(id, workspaceId, title, model) {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO conversations (id, workspace_id, title, model) VALUES (?, ?, ?, ?)'
  ).run(id, workspaceId, title, model);
  return getConversationById(id);
}

export function getConversationById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  if (row) row.messages = JSON.parse(row.messages);
  return row;
}

export function listConversations(workspaceId) {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT id, workspace_id, title, model, created_at, updated_at FROM conversations WHERE workspace_id = ? ORDER BY updated_at DESC'
  ).all(workspaceId);
  return rows;
}

export function updateConversationMessages(id, messages) {
  const db = getDatabase();
  db.prepare(
    'UPDATE conversations SET messages = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(JSON.stringify(messages), id);
}

export function updateConversationTitle(id, title) {
  const db = getDatabase();
  db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, id);
}

export function deleteConversation(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

// ── Settings Queries ──

export function getSetting(key) {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

export function setSetting(key, value) {
  const db = getDatabase();
  db.prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  ).run(key, JSON.stringify(value));
}

// ── User Queries ──

export function createUser(id, username, email, passwordHash, role = 'user') {
  const db = getDatabase();
  db.prepare(
    'INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).run(id, username, email, passwordHash, role);
  return getUserById(id);
}

export function getUserById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function getUserByUsername(username) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function listUsers() {
  const db = getDatabase();
  return db.prepare('SELECT id, username, email, role, created_at, last_login_at FROM users').all();
}

export function updateUserLogin(id) {
  const db = getDatabase();
  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(id);
}

export function countUsers() {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
  return row.count;
}
