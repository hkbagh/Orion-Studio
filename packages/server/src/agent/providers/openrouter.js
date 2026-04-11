import BaseProvider from './base.js';

/**
 * OpenRouter Provider — unified gateway to 200+ models
 * API-compatible with OpenAI chat completions format.
 */
export default class OpenRouterProvider extends BaseProvider {
  constructor(apiKey, options = {}) {
    super(apiKey, options);
    this.baseUrl = 'https://openrouter.ai/api/v1';
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
      throw new Error(`OpenRouter Error: ${err.error?.message || response.statusText}`);
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
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter Error: ${err.error?.message || response.statusText}`);
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
          // Emit any pending tool calls
          for (const tc of Object.values(currentToolCalls)) {
            try {
              tc.function.arguments = JSON.parse(tc.function.arguments || '{}');
            } catch {
              tc.function.arguments = {};
            }
            yield { type: 'tool_call', toolCall: tc };
          }
          yield { type: 'done' };
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            yield { type: 'text_delta', content: delta.content };
          }

          // Tool calls (streamed incrementally)
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!currentToolCalls[idx]) {
                currentToolCalls[idx] = {
                  id: tc.id || `call_${idx}`,
                  type: 'function',
                  function: { name: '', arguments: '' },
                };
              }
              if (tc.function?.name) {
                currentToolCalls[idx].function.name = tc.function.name;
              }
              if (tc.function?.arguments) {
                currentToolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          }

          // Finish reason
          if (parsed.choices?.[0]?.finish_reason === 'tool_calls') {
            for (const tc of Object.values(currentToolCalls)) {
              try {
                tc.function.arguments = JSON.parse(tc.function.arguments || '{}');
              } catch {
                tc.function.arguments = {};
              }
              yield { type: 'tool_call', toolCall: tc };
            }
            currentToolCalls = {};
          }
        } catch {
          // Skip unparseable lines
        }
      }
    }
  }

  async listModels() {
    const allowedModels = [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "qwen/qwen3.6-plus",
      "google/gemma-4-31b-it:free",
      "liquid/lfm-2.5-1.2b-instruct:free",
      "nvidia/nemotron-3-nano-30b-a3b:free",
      "openai/gpt-oss-120b:free"
    ];

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this._headers(),
      });

      if (!response.ok) throw new Error('Failed to fetch models');
      const data = await response.json();
      const modelsMap = (data.data || []).reduce((acc, m) => {
        acc[m.id] = m;
        return acc;
      }, {});

      return allowedModels.map(id => {
        const m = modelsMap[id];
        if (m) {
          return {
            id: m.id,
            name: m.name || m.id,
            provider: 'openrouter',
            contextLength: m.context_length,
            pricing: m.pricing,
            supportsTools: m.supported_parameters?.includes('tools') ?? true,
          };
        }
        // Fallback if not found in list but directly accessible
        return {
          id,
          name: id.split('/').pop(),
          provider: 'openrouter',
          supportsTools: true,
        };
      });
    } catch {
      // Offline fallback
      return allowedModels.map(id => ({
        id,
        name: id.split('/').pop(),
        provider: 'openrouter',
        supportsTools: true,
      }));
    }
  }

  _headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://orion-studio.local',
      'X-Title': 'Orion Studio',
    };
  }

  _buildRequestBody(messages, tools, options) {
    const body = {
      model: options.model || 'anthropic/claude-sonnet-4',
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
