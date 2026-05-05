import OpenRouterProvider from './providers/openrouter.js';
import GeminiProvider from './providers/gemini.js';
import { toolDefinitions, executeTool } from './tools/index.js';
import { buildSystemPrompt } from './context/systemPrompt.js';
import { buildWorkspaceContext } from './context/contextManager.js';
import { getSetting, setSetting } from '../db/database.js';

const MAX_TOOL_ROUNDS = 15; // Safety limit on agentic loop iterations

/**
 * Agent Orchestrator — manages the agentic coding loop.
 *
 * Flow:
 * 1. User sends a message
 * 2. Build context + system prompt
 * 3. Send to LLM with tool definitions
 * 4. If LLM calls tools → execute them → append results → goto 3
 * 5. If LLM responds with text → stream to user → done
 */
export default class AgentOrchestrator {
  constructor() {
    this.providers = {};
    this.activeProvider = null;
    this.activeModel = null;
  }

  /**
   * Initialize providers from stored API keys
   */
  loadProviders() {
    const openrouterKey = getSetting('openrouter_api_key');
    const geminiKey = getSetting('gemini_api_key');

    if (openrouterKey) {
      this.providers.openrouter = new OpenRouterProvider(openrouterKey);
    }
    if (geminiKey) {
      this.providers.gemini = new GeminiProvider(geminiKey);
    }

    // Set default active provider
    if (!this.activeProvider) {
      if (this.providers.openrouter) {
        this.activeProvider = 'openrouter';
        this.activeModel = 'google/gemini-2.5-flash';
      } else if (this.providers.gemini) {
        this.activeProvider = 'gemini';
        this.activeModel = 'gemini-2.5-flash';
      }
    }
  }

  /**
   * Set API key for a provider
   */
  setApiKey(providerName, apiKey) {
    setSetting(`${providerName}_api_key`, apiKey);

    if (providerName === 'openrouter') {
      this.providers.openrouter = new OpenRouterProvider(apiKey);
    } else if (providerName === 'gemini') {
      this.providers.gemini = new GeminiProvider(apiKey);
    }

    // Auto-activate if no provider is active
    if (!this.activeProvider) {
      this.activeProvider = providerName;
      this.activeModel = providerName === 'openrouter' ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash';
    }
  }

  /**
   * Switch active model
   */
  setModel(providerName, modelId) {
    if (!this.providers[providerName]) {
      throw new Error(`Provider ${providerName} not configured. Set API key first.`);
    }
    this.activeProvider = providerName;
    this.activeModel = modelId;
  }

  /**
   * Get the active provider instance
   */
  getProvider() {
    if (!this.activeProvider || !this.providers[this.activeProvider]) {
      throw new Error('No AI provider configured. Set API keys in settings.');
    }
    return this.providers[this.activeProvider];
  }

  /**
   * Run the agentic loop with streaming output.
   * @param {string} userMessage - User's message
   * @param {Array} history - Conversation history
   * @param {string} workspaceId - Workspace ID
   * @param {function} onEvent - Streaming event callback
   * @param {AbortSignal} signal - For cancellation
   */
  async run(userMessage, history = [], workspaceId = 'local', onEvent, signal) {
    this.loadProviders();
    const provider = this.getProvider();

    // Build context
    const workspaceContext = await buildWorkspaceContext(workspaceId);
    const systemPrompt = buildSystemPrompt(workspaceContext);

    // Build message history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    let round = 0;

    while (round < MAX_TOOL_ROUNDS) {
      round++;

      onEvent({
        type: 'status',
        message: round === 1 ? 'Thinking...' : `Tool round ${round}...`,
      });

      // Stream from LLM
      let fullContent = '';
      let toolCalls = [];

      try {
        for await (const chunk of provider.streamChat(messages, toolDefinitions, {
          model: this.activeModel,
          signal,
        })) {
          if (signal?.aborted) {
            onEvent({ type: 'error', error: 'Cancelled by user' });
            return;
          }

          switch (chunk.type) {
            case 'text_delta':
              fullContent += chunk.content;
              onEvent({ type: 'text_delta', content: chunk.content });
              break;

            case 'tool_call':
              toolCalls.push(chunk.toolCall);
              onEvent({
                type: 'tool_call',
                tool: chunk.toolCall.function.name,
                args: chunk.toolCall.function.arguments,
                id: chunk.toolCall.id,
              });
              break;

            case 'done':
              break;
          }
        }
      } catch (err) {
        onEvent({ type: 'error', error: err.message });
        return;
      }

      // If no tool calls, the agent is done
      if (toolCalls.length === 0) {
        onEvent({ type: 'done', content: fullContent });
        return;
      }

      // Execute tool calls
      messages.push({
        role: 'assistant',
        content: fullContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: JSON.stringify(tc.function.arguments),
          },
        })),
      });

      for (const toolCall of toolCalls) {
        const { name, arguments: args } = toolCall.function;

        onEvent({
          type: 'tool_executing',
          tool: name,
          args,
          id: toolCall.id,
        });

        const result = await executeTool(name, args, workspaceId);

        onEvent({
          type: 'tool_result',
          tool: name,
          result,
          id: toolCall.id,
          duration_ms: result._duration_ms,
        });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    onEvent({
      type: 'error',
      error: `Max tool rounds (${MAX_TOOL_ROUNDS}) reached. Stopping to prevent infinite loop.`,
    });
  }

  /**
   * List available models from all configured providers
   */
  async listModels() {
    this.loadProviders();
    const allModels = [];

    for (const [name, provider] of Object.entries(this.providers)) {
      try {
        const models = await provider.listModels();
        allModels.push(...models.slice(0, 50)); // Limit per provider
      } catch {
        // Skip providers that fail
      }
    }

    return allModels;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      activeProvider: this.activeProvider,
      activeModel: this.activeModel,
      configuredProviders: Object.keys(this.providers),
    };
  }
}
