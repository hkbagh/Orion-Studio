const fs = require('fs');
let doc = fs.readFileSync('DOCUMENTATION.md', 'utf8');

const collabSection = `
## 6. Real-Time Collaboration

### 6.1 Yjs and CRDTs
Orion Studio uses \`Yjs\`, a high-performance Conflict-free Replicated Data Type (CRDT) implementation, to resolve real-time collaborative edits. Instead of Operational Transformation (OT), CRDTs allow offline edits, arbitrary connection delays, and peer-to-peer sync without a central sequencer.

### 6.2 Frontend Architecture
- **\`CollaborationProvider\`**: A custom WebSocket wrapper around \`y-protocols/sync\` and \`y-protocols/awareness\`. It connects to \`/ws/collab?token=<shareToken>\`.
- **State**: The \`CollaborationProvider\` bridges the \`Y.Doc\` updates into the Monaco Editor model. It also syncs the Awareness protocol to show remote cursors and selection highlights.
- **UI**: A Share Dialog generates secure tokens granting Editor or Viewer permissions.

### 6.3 Backend Architecture
- **\`collaborationService.js\`**: Maintains a memory map of active \`Y.Doc\` instances. When a user connects, it looks up the underlying \`workspaceId\` mapped to the share token.
- **Persistence**: While edits are resolved in-memory across clients, the backend debounces writes to disk (the actual file in \`workspaces/<id>\`) to ensure the host file system stays in sync.
- **WebSocket Protocol**: Uses \`MESSAGE_SYNC\` (Yjs sync steps), \`MESSAGE_AWARENESS\` (cursors), and custom JSON control messages for user join/leave alerts and permission checking.

---

## 7. Infrastructure
`;

doc = doc.replace('## 6. Infrastructure', collabSection);

// Update TOC
const tocCollab = `6. [Real-Time Collaboration](#6-real-time-collaboration)
   - 6.1 [Yjs and CRDTs](#61-yjs-and-crdts)
   - 6.2 [Frontend Architecture](#62-frontend-architecture)
   - 6.3 [Backend Architecture](#63-backend-architecture)
7. [Infrastructure](#7-infrastructure)`;

doc = doc.replace('6. [Infrastructure](#6-infrastructure)', tocCollab);

// Shift remaining TOC numbers
doc = doc.replace('7. [Authentication](#7-authentication)', '8. [Authentication](#8-authentication)');
doc = doc.replace('8. [Data Flow Diagrams](#8-data-flow-diagrams)', '9. [Data Flow Diagrams](#9-data-flow-diagrams)');
doc = doc.replace('9. [Adding a New Feature](#9-adding-a-new-feature)', '10. [Adding a New Feature](#10-adding-a-new-feature)');
doc = doc.replace('10. [Troubleshooting](#10-troubleshooting)', '11. [Troubleshooting](#11-troubleshooting)');

// Shift headers
doc = doc.replace('## 7. Authentication', '## 8. Authentication');
doc = doc.replace('## 8. Data Flow Diagrams', '## 9. Data Flow Diagrams');
doc = doc.replace('## 9. Adding a New Feature', '## 10. Adding a New Feature');
doc = doc.replace('## 10. Troubleshooting', '## 11. Troubleshooting');

fs.writeFileSync('DOCUMENTATION.md', doc);
console.log('DOCUMENTATION.md updated.');
