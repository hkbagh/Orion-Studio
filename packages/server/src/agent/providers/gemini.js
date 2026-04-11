import BaseProvider from './base.js';

/**
 * Gemini Provider — direct access to Google's Gemini models.
 * Uses the OpenAI-compatible API endpoint for simplicity.
 */
export default class GeminiProvider extends BaseProvider {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
  }

  async chat(messages, tools = [], options = {}) {
    const body = this._buildRequestBody(messages, tools, options);
    body.stream = false;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini Error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      toolCalls: choice?.message?.tool_calls || [],
      usage: data.usage,
      model: data.model,
    };
  }

  async *streamChat(messages, tools = [], options = {}) {
    const body = this._buildRequestBody(messages, tools, options);
    body.stream = true;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini Error: ${err.error?.message || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolCalls = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          for (const tc of Object.values(currentToolCalls)) {
            try { tc.function.arguments = JSON.parse(tc.function.arguments || '{}'); } catch { tc.function.arguments = {}; }
            yield { type: 'tool_call', toolCall: tc };
          }
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            yield { type: 'text_delta', content: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!currentToolCalls[idx]) {
                currentToolCalls[idx] = { id: tc.id || `call_${idx}`, type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.function?.name) currentToolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments) currentToolCalls[idx].function.arguments += tc.function.arguments;
            }
          }

          if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
            for (const tc of Object.values(currentToolCalls)) {
              try { tc.function.arguments = JSON.parse(tc.function.arguments || '{}'); } catch { tc.function.arguments = {}; }
              yield { type: 'tool_call', toolCall: tc };
            }
            currentToolCalls = {};
          }
        } catch {}
      }
    }
  }

  async listModels() {
    // Gemini models via the OpenAI-compatible endpoint
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: this._headers(),
    });

    if (!response.ok) {
      // Fallback to hardcoded list if API doesn't support listing
      return [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', contextLength: 1048576, supportsTools: true },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', contextLength: 1048576, supportsTools: true },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', contextLength: 1048576, supportsTools: true },
      ];
    }

    const data = await response.json();
    return (data.data || []).map(m => ({
      id: m.id,
      name: m.id,
      provider: 'gemini',
      contextLength: m.context_length || 1048576,
      supportsTools: true,
    }));
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  _buildRequestBody(messages, tools, options) {
    const body = {
      model: options.model || 'gemini-2.5-flash',
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens || 8192,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    return body;
  }
}
