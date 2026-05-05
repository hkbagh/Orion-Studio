import { useState } from 'react';
import { X, Copy, Check, Users } from 'lucide-react';
import api from '../../services/api';
import useWorkspaceStore from '../../store/workspaceStore';
import useCollaborationStore from '../../store/collaborationStore';
import './ShareDialog.css';

export default function ShareDialog() {
  const showShareDialog = useCollaborationStore(s => s.showShareDialog);
  const toggleShareDialog = useCollaborationStore(s => s.toggleShareDialog);
  const workspaceId = useWorkspaceStore(s => s.workspaceId) || 'local';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [permission, setPermission] = useState('editor');
  
  if (!showShareDialog) return null;

  const handleShare = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.createShareSession(workspaceId, {
        permission,
        visibility: 'private'
      });
      
      setShareUrl(response.session.shareUrl);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="share-dialog-overlay" onClick={toggleShareDialog}>
      <div className="share-dialog" onClick={e => e.stopPropagation()}>
        <div className="share-dialog-header">
          <div className="share-dialog-title">
            <Users size={20} />
            <span>Share Workspace</span>
          </div>
          <button className="share-dialog-close" onClick={toggleShareDialog}>
            <X size={20} />
          </button>
        </div>
        
        <div className="share-dialog-body">
          {!shareUrl ? (
            <>
              <p>Generate a secure link to invite others to collaborate in this workspace.</p>
              
              <div className="share-options">
                <label>Permission Level:</label>
                <select value={permission} onChange={e => setPermission(e.target.value)}>
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="editor">Editor (Can make changes)</option>
                </select>
              </div>

              {error && <div className="share-error">{error}</div>}

              <button 
                className="share-generate-btn" 
                onClick={handleShare}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Share Link'}
              </button>
            </>
          ) : (
            <>
              <p>Your share link is ready. Anyone with this link can join as an <b>{permission}</b>.</p>
              
              <div className="share-link-container">
                <input type="text" readOnly value={shareUrl} />
                <button onClick={handleCopy} className={copied ? 'copied' : ''}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>

              <div className="share-link-hint">
                Link expires in 24 hours. You can revoke it anytime from settings.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
