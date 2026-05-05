const API_BASE = '/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  // ── File Operations ──
  async getFileTree(workspaceId = 'local') {
    return this.request(`/workspaces/${workspaceId}/files`);
  }

  async readFile(workspaceId = 'local', filePath) {
    return this.request(`/workspaces/${workspaceId}/file/${filePath}`);
  }

  async createFile(workspaceId = 'local', filePath, content = '', isDirectory = false) {
    return this.request(`/workspaces/${workspaceId}/file/${filePath}`, {
      method: 'POST',
      body: JSON.stringify({ content, isDirectory }),
    });
  }

  async updateFile(workspaceId = 'local', filePath, content) {
    return this.request(`/workspaces/${workspaceId}/file/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteFile(workspaceId = 'local', filePath) {
    return this.request(`/workspaces/${workspaceId}/file/${filePath}`, {
      method: 'DELETE',
    });
  }

  async renameFile(workspaceId = 'local', filePath, newPath) {
    return this.request(`/workspaces/${workspaceId}/file/${filePath}`, {
      method: 'PATCH',
      body: JSON.stringify({ newPath }),
    });
  }

  // ── Workspace Operations ──
  async listWorkspaces() {
    return this.request('/workspaces');
  }

  async createWorkspace(name, image = 'orion-base') {
    return this.request('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, image }),
    });
  }

  async getWorkspace(workspaceId) {
    return this.request(`/workspaces/${workspaceId}`);
  }

  // ── Health ──
  async healthCheck() {
    return this.request('/health');
  }

  // ── Collaboration Operations ──
  async createShareSession(workspaceId, options = {}) {
    return this.request('/collab/share', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        permission: options.permission || 'editor',
        visibility: options.visibility || 'private',
        expiresIn: options.expiresIn || null,
        maxUsers: options.maxUsers || 10,
      }),
    });
  }

  async getSessionByToken(token) {
    return this.request(`/collab/session/${token}`);
  }

  async getWorkspaceSessions(workspaceId) {
    return this.request(`/collab/sessions/workspace/${workspaceId}`);
  }

  async getMySessions() {
    return this.request('/collab/sessions/my');
  }

  async revokeSession(sessionId) {
    return this.request(`/collab/session/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async getSessionParticipants(sessionId) {
    return this.request(`/collab/session/${sessionId}/participants`);
  }

  async getSessionActivity(sessionId, limit = 100) {
    return this.request(`/collab/session/${sessionId}/activity?limit=${limit}`);
  }
}

const api = new ApiService();
export default api;
