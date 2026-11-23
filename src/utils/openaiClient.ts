import { AiAssistAction, ApiConfig, CharacterDraft, CreatorPreset, PresetField } from '../types';
import { resolveFieldTemplate } from '../data/presets';
import { getEffectivePresetFields, isFieldUntouchedTemplate } from './tokens';

export interface ProviderPresetOption {
  id: string;
  label: string;
  baseUrl: string;
  requiresKey: boolean;
  note: string;
}

export const PROVIDER_PRESETS: ProviderPresetOption[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true,
    note: 'Access Claude, DeepSeek, Llama, Qwen, and Mistral models via one key.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    note: 'Direct OpenAI chat completion endpoints.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresKey: true,
    note: 'Direct DeepSeek API with strong narrative prose.',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresKey: true,
    note: 'Low-latency hosted open-weight models.',
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    requiresKey: false,
    note: 'Run locally with OLLAMA_ORIGINS=* enabled for browser access.',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    requiresKey: false,
    note: 'Enable "CORS" in LM Studio Local Server settings.',
  },
];

export function normalizeBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Enter an OpenAI-compatible Base URL first.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Base URL must be a valid http:// or https:// address.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// endpoints are supported.');
  }
  return trimmed.replace(/\/+$/, '');
}

function buildHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const cleanKey = apiKey.trim();
  if (cleanKey) {
    headers['Authorization'] = `Bearer ${cleanKey}`;
  }
  if (baseUrl.includes('openrouter.ai')) {
    headers['X-Title'] = 'Dramatis RP Studio';
  }
  return headers;
}

export async function fetchCompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const cleanBase = normalizeBaseUrl(baseUrl);
  const endpoint = `${cleanBase}/models`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: buildHeaders(apiKey, cleanBase),
    });
  } catch {
    const isLocal = cleanBase.includes('localhost') || cleanBase.includes('127.0.0.1');
    throw new Error(
      isLocal
        ? 'Could not reach your local server. Make sure it is running and has CORS enabled (e.g., OLLAMA_ORIGINS=* or LM Studio CORS toggle).'
        : 'Network or CORS error reaching this endpoint. Verify the Base URL and that the provider allows browser requests.'
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || errJson?.message || '';
    } catch {
      // Ignore parse failures
    }
    throw new Error(
      `Model fetch failed (HTTP ${response.status})${detail ? `: ${detail}` : '. Check your API key and Base URL.'}`
    );
  }

  const payload = await response.json();
  let ids: string[] = [];

  if (Array.isArray(payload?.data)) {
    ids = payload.data
      .map((item: { id?: string; name?: string }) => item?.id || item?.name || '')
      .filter(Boolean);
  } else if (Array.isArray(payload?.models)) {
    ids = payload.models
      .map((item: { id?: string; name?: string }) => item?.id || item?.name || '')
      .filter(Boolean);
  } else if (Array.isArray(payload)) {
    ids = payload
      .map((item: string | { id?: string }) => (typeof item === 'string' ? item : item?.id || ''))
      .filter(Boolean);
  }

  const uniqueSorted = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
  if (uniqueSorted.length === 0) {
    throw new Error('Connected successfully, but the endpoint returned an empty model list. You can still enter a Model ID manually.');
  }
  return uniqueSorted;
}

export async function testCompatibleModel(config: ApiConfig): Promise<string> {
  const cleanBase = normalizeBaseUrl(config.baseUrl);
  if (!config.selectedModel.trim()) {
    throw new Error('Select or enter a Model ID before testing.');
  }

  const response = await fetch(`${cleanBase}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(config.apiKey, cleanBase),
    body: JSON.stringify({
      model: config.selectedModel.trim(),
      messages: [
        { role: 'system', content: 'Reply with two words: Connection ready.' },
        { role: 'user', content: 'Ping' },
      ],
      max_tokens: 24,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || errJson?.message || '';
    } catch {
      // ignore
    }
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  return reply || 'Model responded successfully.';
}

interface FieldAssistParams {
  config: ApiConfig;
  preset: CreatorPreset;
  field: PresetField;
  character: CharacterDraft;
  userDirection: string;
  actionMode: AiAssistAction;
  onChunk?: (accumulatedText: string) => void;
  signal?: AbortSignal;
}

export async function requestFieldAssistance({
  config,
  preset,
  field,
  character,
  userDirection,
  actionMode,
  onChunk,
  signal,
}: FieldAssistParams): Promise<string> {
  const cleanBase = normalizeBaseUrl(config.baseUrl);
  if (!config.selectedModel.trim()) {
    throw new Error('No model selected. Open API Setup to fetch models and pick one.');
  }

  // Gather ONLY already completed/filled fields (excluding untouched starter templates) as grounding context
  const activeFields = getEffectivePresetFields(preset, Boolean(character.includeExtraStandardFields));
  const priorContextLines = activeFields
    .filter((f) => f.id !== field.id && !isFieldUntouchedTemplate(character.values[f.id], f, character.name))
    .map((f) => `[${f.label}]\n${(character.values[f.id] || '').trim()}`);

  const rawFieldValue = (character.values[field.id] || '').trim();
  const isUntouched = isFieldUntouchedTemplate(rawFieldValue, field, character.name);
  const currentFieldValue = isUntouched ? '' : rawFieldValue;
  const resolvedTemplate = field.initialTemplate
    ? resolveFieldTemplate(field, character.name).trim()
    : '';

  const systemPrompt = [
    'You are an expert roleplay bot character co-writer helping a creator build a character one step at a time.',
    `Active Creator Preset: "${preset.name}" (Output style: ${preset.formatStyle}).`,
    `Current Step Field: "${field.label}" (Stage: ${field.stage}, Input Type: ${field.fieldType}, Target length: ~${field.tokenTarget} tokens).`,
    `Field Directive: ${field.aiSystemDirective}`,
    resolvedTemplate
      ? `Starter Block Structure (preserve these field labels/layout when filling out this step):\n${resolvedTemplate}`
      : '',
    config.globalStylePrompt.trim() ? `Creator Global Style Notes: ${config.globalStylePrompt.trim()}` : '',
    'CRITICAL RULES:',
    '1. Generate content ONLY for this single field. Never jump ahead to write other fields or dump a full character sheet.',
    '2. Output ready-to-paste field text without meta preamble (no "Here is your draft:" or markdown code fences around the entire answer).',
    '3. Preserve {{char}} and {{user}} macros where appropriate for roleplay bot cards.',
  ]
    .filter(Boolean)
    .join('\n');

  const actionInstructionMap: Record<AiAssistAction, string> = {
    draft: `Draft fresh content for the "${field.label}" step.`,
    refine: `Refine, sharpen, and deepen the existing draft for "${field.label}" while keeping the creator's core intent.`,
    brainstorm: `Offer 3 concise, distinct creative angles (numbered 1, 2, 3) for the "${field.label}" step so the creator can choose a direction.`,
    compress: `Tighten the existing draft for "${field.label}" to fit near ~${field.tokenTarget} tokens while preserving every distinct detail and voice beat.`,
  };

  const userPromptParts = [
    `Character Working Title: ${character.name || 'Unnamed Character'}`,
    character.tagline ? `Tagline: ${character.tagline}` : '',
    priorContextLines.length > 0
      ? `Established Character Context (previous steps):\n${priorContextLines.join('\n\n')}`
      : 'No prior steps filled yet—this is an early foundation step.',
    currentFieldValue
      ? `Current text in "${field.label}":\n${currentFieldValue}`
      : resolvedTemplate
      ? `Current "${field.label}" field contains only the unfilled starter structure:\n${resolvedTemplate}`
      : `Current "${field.label}" field is empty.`,
    `Task: ${actionInstructionMap[actionMode]}`,
    userDirection.trim() ? `Creator Direction: ${userDirection.trim()}` : '',
  ].filter(Boolean);

  const response = await fetch(`${cleanBase}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(config.apiKey, cleanBase),
    signal,
    body: JSON.stringify({
      model: config.selectedModel.trim(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPromptParts.join('\n\n') },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson?.error?.message || errJson?.message || '';
    } catch {
      // ignore
    }
    throw new Error(`AI request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // Handle standard JSON response if server ignored stream: true
  if (contentType.includes('application/json') || !response.body) {
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content || '';
    if (onChunk) onChunk(content);
    return content;
  }

  // Parse SSE stream cleanly
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.slice(5).trim();
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed?.choices?.[0]?.delta?.content ?? parsed?.choices?.[0]?.message?.content ?? '';
        if (delta) {
          accumulated += delta;
          if (onChunk) onChunk(accumulated);
        }
      } catch {
        // Skip partial or keepalive chunks
      }
    }
  }

  return accumulated.trim();
}
