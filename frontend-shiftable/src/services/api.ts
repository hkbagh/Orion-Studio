const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8100';

export async function uploadProjectZip(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Upload failed');
  }

  return response.json();
}

export async function getLanguages(): Promise<Record<string, string[]>> {
  const res = await fetch(`${API_URL}/api/languages`);
  return res.json();
}

export async function downloadConvertedProject(sessionId: string) {
  const link = document.createElement('a');
  link.href = `${API_URL}/api/download-output/${sessionId}`;
  link.download = `converted_project_${sessionId}.zip`;
  link.click();
}

export async function getWorkspaceTree(sessionId: string) {
  const res = await fetch(`${API_URL}/api/workspace/${sessionId}/tree`);
  return res.json();
}

export async function getWorkspaceFile(sessionId: string, path: string) {
  const res = await fetch(`${API_URL}/api/workspace/${sessionId}/file?path=${encodeURIComponent(path)}`);
  return res.json();
}

export async function saveWorkspaceFile(sessionId: string, path: string, content: string) {
  const res = await fetch(`${API_URL}/api/workspace/${sessionId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  return res.json();
}

export async function deleteWorkspacePath(sessionId: string, path: string, recursive = true) {
  const res = await fetch(`${API_URL}/api/workspace/${sessionId}/path`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive }),
  });
  return res.json();
}

export async function copilotAssist(data: {
  file_path: string;
  active_file_content: string;
  terminal_output: string;
  user_query: string;
}) {
  const res = await fetch(`${API_URL}/api/copilot/assist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
