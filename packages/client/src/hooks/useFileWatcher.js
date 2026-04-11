import { useEffect, useRef } from 'react';

/**
 * Hook that listens for file system changes via WebSocket
 * and triggers callback when files are added/changed/deleted.
 */
export default function useFileWatcher(workspaceId = 'local', onFileChange) {
  const wsRef = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/watch?workspaceId=${workspaceId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type && data.type.startsWith('file_') || data.type.startsWith('dir_')) {
          onFileChange?.(data);
        }
      } catch {}
    };

    ws.onerror = () => {
      // Silent fail — file watcher is a nice-to-have
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [workspaceId, onFileChange]);
}
