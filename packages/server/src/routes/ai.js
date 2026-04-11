import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import AgentOrchestrator from '../agent/orchestrator.js';
import {
  createConversation,
  getConversationById,
  listConversations,
  updateConversationMessages,
  updateConversationTitle,
  deleteConversation,
  setSetting,
  getSetting,
} from '../db/database.js';

const router = Router();
const orchestrator = new AgentOrchestrator();

// ── Agent Chat (streaming SSE) ──

/**
 * POST /api/ai/chat
 * Send a message and get streaming response via SSE
 */
router.post('/ai/chat', async (req, res) => {
  const { message, conversationId, workspaceId = 'local', contextFiles = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Resolve workspace ID — 'local' maps to 'default' in the DB
  const resolvedWorkspaceId = workspaceId === 'local' ? 'default' : workspaceId;

  // Get or create conversation
  let conversation = conversationId ? getConversationById(conversationId) : null;
  if (!conversation) {
    const id = uuidv4().substring(0, 12);
    conversation = createConversation(id, resolvedWorkspaceId, message.substring(0, 50), orchestrator.activeModel);
    sendSSE(res, 'conversation', { id: conversation.id, title: conversation.title });
  }

  // Build history from conversation
  const history = conversation.messages || [];

  // No abort logic

  let fullResponse = '';

  try {
    await orchestrator.run(
      message,
      history,
      workspaceId,
      (event) => {
        switch (event.type) {
          case 'text_delta':
            fullResponse += event.content;
            sendSSE(res, 'text_delta', { content: event.content });
            break;

          case 'tool_call':
            sendSSE(res, 'tool_call', {
              tool: event.tool,
              args: event.args,
              id: event.id,
            });
            break;

          case 'tool_executing':
            sendSSE(res, 'tool_executing', {
              tool: event.tool,
              args: event.args,
              id: event.id,
            });
            break;

          case 'tool_result':
            sendSSE(res, 'tool_result', {
              tool: event.tool,
              result: event.result,
              id: event.id,
              duration_ms: event.duration_ms,
            });
            break;

          case 'status':
            sendSSE(res, 'status', { message: event.message });
            break;

          case 'error':
            sendSSE(res, 'error', { error: event.error });
            break;

          case 'done':
            // Save conversation
            const updatedMessages = [
              ...history,
              { role: 'user', content: message },
              { role: 'assistant', content: fullResponse },
            ];
            updateConversationMessages(conversation.id, updatedMessages);
            sendSSE(res, 'done', { conversationId: conversation.id });
            break;
        }
      },
      undefined
    );
  } catch (err) {
    console.error('------- AI ERROR LOG -------');
    console.error(err);
    console.error('------- END AI ERROR -------');
    sendSSE(res, 'error', { error: err.message });
  }

  res.end();
});

// ── Conversations CRUD ──

router.get('/ai/conversations', (req, res, next) => {
  try {
    const workspaceId = req.query.workspaceId || 'local';
    const resolvedId = workspaceId === 'local' ? 'default' : workspaceId;
    const conversations = listConversations(resolvedId);
    res.json(conversations);
  } catch (err) { next(err); }
});

router.get('/ai/conversations/:id', (req, res, next) => {
  try {
    const conversation = getConversationById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    res.json(conversation);
  } catch (err) { next(err); }
});

router.delete('/ai/conversations/:id', (req, res, next) => {
  try {
    deleteConversation(req.params.id);
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── Model Management ──

router.get('/ai/models', async (req, res, next) => {
  try {
    orchestrator.loadProviders();
    const models = await orchestrator.listModels();
    res.json({
      models,
      activeProvider: orchestrator.activeProvider,
      activeModel: orchestrator.activeModel,
    });
  } catch (err) { next(err); }
});

router.post('/ai/model', (req, res, next) => {
  try {
    const { provider, model } = req.body;
    orchestrator.setModel(provider, model);
    res.json({ provider, model });
  } catch (err) { next(err); }
});

router.get('/ai/config', (req, res) => {
  orchestrator.loadProviders();
  res.json(orchestrator.getConfig());
});

// ── API Key Management ──

router.post('/ai/keys', (req, res) => {
  const { provider, apiKey } = req.body;

  if (!provider || !apiKey) {
    return res.status(400).json({ error: 'provider and apiKey are required' });
  }

  if (!['openrouter', 'gemini'].includes(provider)) {
    return res.status(400).json({ error: 'provider must be "openrouter" or "gemini"' });
  }

  setSetting(`${provider}_api_key`, apiKey);
  orchestrator.loadProviders();

  res.json({
    success: true,
    provider,
    configuredProviders: Object.keys(orchestrator.providers),
  });
});

router.get('/ai/keys', (req, res) => {
  const openrouterKey = getSetting('openrouter_api_key');
  const geminiKey = getSetting('gemini_api_key');

  res.json({
    openrouter: openrouterKey ? '••••' + openrouterKey.slice(-4) : null,
    gemini: geminiKey ? '••••' + geminiKey.slice(-4) : null,
  });
});

// ── SSE Helper ──

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default router;
