/**
 * Base AI Provider — abstract interface for LLM providers.
 * OpenRouter and Gemini providers extend this.
 */
export default class BaseProvider {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.options = options;
  }

  /**
   * Send a chat completion (non-streaming)
   * @param {Array} messages - Chat messages
   * @param {Array} tools - Tool definitions
   * @param {Object} options - { model, temperature, maxTokens }
   * @returns {Object} { content, toolCalls, usage }
   */
  async chat(messages, tools = [], options = {}) {
    throw new Error('chat() not implemented');
  }

  /**
   * Stream a chat completion
   * @param {Array} messages
   * @param {Array} tools
   * @param {Object} options
   * @yields {Object} { type: 'text_delta'|'tool_call'|'done', ... }
   */
  async *streamChat(messages, tools = [], options = {}) {
    throw new Error('streamChat() not implemented');
  }

  /**
   * List available models
   * @returns {Array} [{ id, name, provider, contextLength, pricing }]
   */
  async listModels() {
    throw new Error('listModels() not implemented');
  }

  /**
   * Validate that the API key works
   */
  async validate() {
    try {
      await this.listModels();
      return true;
    } catch {
      return false;
    }
  }
}
