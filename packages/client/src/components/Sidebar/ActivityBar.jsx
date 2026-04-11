import { Files, Search, Bot, Settings } from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import './Sidebar.css';

const panels = [
  { id: 'files', icon: Files, label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
  { id: 'search', icon: Search, label: 'Search', shortcut: 'Ctrl+Shift+F' },
  { id: 'ai', icon: Bot, label: 'AI Agent', shortcut: 'Ctrl+Shift+I', isAi: true },
];

const bottomPanels = [
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function ActivityBar() {
  const activePanel = useWorkspaceStore(s => s.activeSidebarPanel);
  const setActivePanel = useWorkspaceStore(s => s.setActiveSidebarPanel);
  const sidebarVisible = useWorkspaceStore(s => s.sidebarVisible);
  const toggleSidebar = useWorkspaceStore(s => s.toggleSidebar);

  const handlePanelClick = (panelId) => {
    if (activePanel === panelId && sidebarVisible) {
      toggleSidebar();
    } else {
      setActivePanel(panelId);
    }
  };

  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        {panels.map(({ id, icon: Icon, label, shortcut, isAi }) => (
          <button
            key={id}
            className={`activity-bar-btn ${isAi ? 'ai-btn' : ''} ${activePanel === id && sidebarVisible ? 'active' : ''}`}
            onClick={() => handlePanelClick(id)}
            title={label}
          >
            <Icon className="icon" size={22} />
            <span className="activity-bar-tooltip">
              {label}{shortcut && ` (${shortcut})`}
            </span>
          </button>
        ))}
      </div>

      <div className="activity-bar-bottom">
        {bottomPanels.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`activity-bar-btn ${activePanel === id && sidebarVisible ? 'active' : ''}`}
            onClick={() => handlePanelClick(id)}
            title={label}
          >
            <Icon className="icon" size={22} />
            <span className="activity-bar-tooltip">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
