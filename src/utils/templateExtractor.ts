import { ApiConfig, CreatorPreset } from '../types';
import { normalizeBaseUrl } from './openaiClient';
import { validateAndParsePresetJson } from './tokens';

export interface ParsedCharacterSource {
  fileName: string;
  sourceType: 'card_json' | 'card_png' | 'raw_text';
  characterName: string;
  creatorName: string;
  tags: string[];
  hasSystemPrompt: boolean;
  hasPostHistory: boolean;
  hasCharacterNote: boolean;
  hasAlternateGreetings: boolean;
  hasScenario: boolean;
  hasMesExample: boolean;
  hasFirstMes: boolean;
  fields: {
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    character_note: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
  };
}

export interface TemplateExtractionOptions {
  instructions: string;
  keepSystemPromptsFillInBlanks: boolean;
  excludeCreatorNotes: boolean;
  creatorNameOverride?: string;
  themeOverride?: string;
  authorPlatform?: string;
  authorUrl?: string;
  authorAvatar?: string;
}

function decodeBase64Utf8(base64: string): string {
  const cleaned = base64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Extracts embedded Character Card V2/V3 JSON ("ccv3" or "chara") from a PNG's tEXt chunks.
 */
export function extractCharaJsonFromPng(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer);
  const pngSig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24) return null;
  for (let i = 0; i < pngSig.length; i++) {
    if (bytes[i] !== pngSig[i]) return null;
  }

  const view = new DataView(buffer);
  let offset = 8;
  let charaPayload: string | null = null;
  let ccv3Payload: string | null = null;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) break;

    if (type === 'tEXt') {
      let sepIndex = -1;
      for (let i = dataStart; i < dataEnd; i++) {
        if (bytes[i] === 0) {
          sepIndex = i;
          break;
        }
      }
      if (sepIndex > dataStart) {
        const keyword = new TextDecoder('latin1').decode(bytes.subarray(dataStart, sepIndex)).toLowerCase();
        if (keyword === 'ccv3' || keyword === 'chara') {
          const textValue = new TextDecoder('latin1').decode(bytes.subarray(sepIndex + 1, dataEnd));
          try {
            const decoded = decodeBase64Utf8(textValue);
            if (keyword === 'ccv3') {
              ccv3Payload = decoded;
            } else {
              charaPayload = decoded;
            }
          } catch {
            // Try plain text if not base64
            if (textValue.trim().startsWith('{')) {
              if (keyword === 'ccv3') ccv3Payload = textValue;
              else charaPayload = textValue;
            }
          }
        }
      }
    }

    offset = dataEnd + 4; // skip 4-byte CRC
    if (type === 'IEND') break;
  }

  return ccv3Payload || charaPayload;
}

function parseCardObject(
  parsed: Record<string, unknown>,
  fileName: string,
  sourceType: 'card_json' | 'card_png'
): ParsedCharacterSource {
  const dataObj =
    parsed?.data && typeof parsed.data === 'object'
      ? (parsed.data as Record<string, unknown>)
      : parsed;

  const str = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
  const extensions =
    (dataObj?.extensions as Record<string, unknown> | undefined) ||
    (parsed?.extensions as Record<string, unknown> | undefined);
  const depthPromptObj = extensions?.depth_prompt as Record<string, unknown> | undefined;

  const description = str(dataObj?.description);
  const personality = str(dataObj?.personality);
  const scenario = str(dataObj?.scenario);
  const first_mes = str(dataObj?.first_mes);
  const mes_example = str(dataObj?.mes_example);
  const character_note = str(depthPromptObj?.prompt);
  const system_prompt = str(dataObj?.system_prompt);
  const post_history_instructions = str(dataObj?.post_history_instructions);

  const rawAlt = Array.isArray(dataObj?.alternate_greetings) ? dataObj.alternate_greetings : [];
  const alternate_greetings = rawAlt
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  const rawTags = Array.isArray(dataObj?.tags) ? dataObj.tags : [];
  const tags = rawTags
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());

  return {
    fileName,
    sourceType,
    characterName: str(dataObj?.name) || str(parsed?.name) || 'Uploaded Character',
    creatorName: str(dataObj?.creator) || str(parsed?.creator) || '',
    tags,
    hasSystemPrompt: system_prompt.length > 0,
    hasPostHistory: post_history_instructions.length > 0,
    hasCharacterNote: character_note.length > 0,
    hasAlternateGreetings: alternate_greetings.length > 0,
    hasScenario: scenario.length > 0,
    hasMesExample: mes_example.length > 0,
    hasFirstMes: first_mes.length > 0,
    fields: {
      description,
      personality,
      scenario,
      first_mes,
      mes_example,
      character_note,
      system_prompt,
      post_history_instructions,
      alternate_greetings,
    },
  };
}

export async function parseUploadedCharacterFile(file: File): Promise<ParsedCharacterSource> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.png') || file.type === 'image/png') {
    const buffer = await file.arrayBuffer();
    const rawJson = extractCharaJsonFromPng(buffer);
    if (!rawJson) {
      throw new Error(
        'No embedded Character Card metadata ("chara" or "ccv3") was found in this PNG. Try uploading the character\'s .json card file instead.'
      );
    }
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    return parseCardObject(parsed, file.name, 'card_png');
  }

  const text = await file.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('The uploaded file is empty.');
  }

  if (lower.endsWith('.json') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return parseCardObject(parsed, file.name, 'card_json');
    } catch {
      if (lower.endsWith('.json')) {
        throw new Error('Could not parse this JSON file. Make sure it is a valid Character Card JSON.');
      }
    }
  }

  return parseRawCharacterText(trimmed, file.name);
}

export function parseRawCharacterText(rawText: string, fileName = 'Pasted Character Sheet'): ParsedCharacterSource {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Paste a character card JSON or raw character sheet first.');
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return parseCardObject(parsed, fileName, 'card_json');
    } catch {
      // Treat as raw character text
    }
  }

  return {
    fileName,
    sourceType: 'raw_text',
    characterName: 'Raw Character Sheet',
    creatorName: '',
    tags: [],
    hasSystemPrompt: false,
    hasPostHistory: false,
    hasCharacterNote: false,
    hasAlternateGreetings: false,
    hasScenario: false,
    hasMesExample: false,
    hasFirstMes: false,
    fields: {
      description: trimmed,
      personality: '',
      scenario: '',
      first_mes: '',
      mes_example: '',
      character_note: '',
      system_prompt: '',
      post_history_instructions: '',
      alternate_greetings: [],
    },
  };
}

function truncateForExtraction(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated for length]`;
}

function extractBalancedJsonObject(raw: string): string {
  // Strip optional markdown code fences first
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : raw.trim();

  const firstBrace = candidate.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('AI response did not contain a JSON object.');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = firstBrace; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return candidate.slice(firstBrace, i + 1);
        }
      }
    }
  }

  throw new Error(
    'The AI stopped before finishing the template (its answer was cut off). Try again, or pick a model with a larger output limit in API Setup.'
  );
}

/**
 * Fixes the most common ways models break JSON: raw line breaks/tabs inside strings
 * and trailing commas before } or ]. Only used when strict parsing fails.
 */
function repairModelJson(json: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
      } else if (ch === '\\') {
        escaped = true;
        out += ch;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') inString = true;
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
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

export async function extractPresetFromCharacter(params: {
  config: ApiConfig;
  source: ParsedCharacterSource;
  options: TemplateExtractionOptions;
  signal?: AbortSignal;
}): Promise<CreatorPreset> {
  const { config, source, options, signal } = params;
  const cleanBase = normalizeBaseUrl(config.baseUrl);
  if (!config.selectedModel.trim()) {
    throw new Error('No AI model selected. Open API Setup to connect your endpoint and pick a model.');
  }

  const systemPrompt = [
    'You are an expert RP bot template architect for Dramatis.',
    'Your job is to inspect an uploaded RP character card and reverse-engineer a clean, reusable, step-by-step CreatorPreset JSON template from its structural layout.',
    '',
    'CRITICAL EXTRACTION RULES:',
    '1. STRIP ALL CHARACTER-IDENTIFYING CONTENT: Never keep the original character\'s name, age, species, gender, hometown, venue, plot premise, backstory beats, NPC names, kinks, or specific gimmick. Replace character-specific references with {{char}} and {{user}}.',
    '2. SPLIT INTO STEP-BY-STEP FIELDS: Analyze how the character\'s `description` is structured (e.g., `[Section: ...]`, `# Markdown Heading`, `<{{char}}>`, PList blocks, etc.) and create clean, sequential fields so a future creator fills out one focused section at a time.',
    '3. STARTER TEMPLATES (`initialTemplate`):',
    '   - For structured blocks (key-value profiles, bullet lists, bracketed/Markdown sub-headings, speech state lists, sample dialogue tags like `<Thoughts:>`), put ONLY the bare reusable skeleton in `initialTemplate` (e.g. "Name: {{char}}\\nAge: \\nHeight: " or "- Normally: \\n- When upset: ") with ZERO copied character prose.',
    '   - NEVER copy the original character\'s `scenario`, `first_mes`, `alternate_greetings`, or narrative backstory paragraphs into `initialTemplate` or `placeholder`. For `scenario`, `first_mes`, and `alternate_greetings`, leave `initialTemplate` empty (unless the scenario uses strictly empty structural brackets like `[Setting: ]\\n\\n[Scene: ]`) and give clear, general writing tips in `promptHint`.',
    '4. GENERAL WRITING TIPS (`promptHint` & `aiSystemDirective`): Write practical, reusable guidance for ANY character built with this template—never lock the guidance to just the one uploaded character\'s story or trope.',
    options.excludeCreatorNotes
      ? '5. EXCLUDE CREATOR NOTES: Do NOT include a `creator_notes` step in the preset.'
      : '5. CREATOR NOTES: Only include a `creator_notes` step if clearly helpful, stripped of original character details.',
    options.keepSystemPromptsFillInBlanks
      ? '6. FILL-IN-THE-BLANKS SYSTEM PROMPTS: If the source card contains `system_prompt`, `post_history_instructions`, or strict formatting-engine rules in `mes_example` / `character_note`, preserve the core mechanics and formatting rules verbatim in `initialTemplate`, replace ONLY character/setting specifics (names, pronouns, locations, NPC names, event names) with clear bracketed blanks like `[pronouns]` or `[setting]`, and set `"fillInTheBlanks": true` and `"rawBlock": true` on those fields.'
      : '6. SYSTEM PROMPTS & NOTES: Only include `system_prompt`, `post_history_instructions`, or `character_note` steps if present in the source card, generalized cleanly without original character specifics.',
    '7. OUTPUT FORMAT FLAGS:',
    '   - Set `formatStyle` to `"bracketed"`, `"markdown"`, `"plist"`, `"wpp"`, or `"plain"` to match the card\'s syntax.',
    '   - For `bracketed` presets: set `"bracketInline": true` on short comma-separated single-line bracket blocks like `[Traits: ...]` or `[Likes: ...]`. Set `"rawBlock": true` on fields whose content already carries its own brackets/headings or maps to `scenario`, `first_mes`, `mes_example`, `system_prompt`, `post_history_instructions`, `character_note`, or `alternate_greetings`.',
    '   - For `markdown` presets that use custom `# Heading` / `## Subheading` / `<{{char}}>` tags inside `initialTemplate`, set `"rawBlock": true` so Dramatis doesn\'t double-wrap them with extra headings.',
    '',
    'RETURN STRICT JSON ONLY (no prose outside the JSON object) matching this exact schema:',
    '{',
    '  "name": "Short descriptive preset layout name (NOT the character\'s name)",',
    '  "author": "Creator handle",',
    '  "theme": "Concise genre/style theme (e.g. Slice of Life, Dark Fantasy, Sci-Fi Survival)",',
    '  "description": "1-2 sentence summary of what this reusable template structure is built for.",',
    '  "formatStyle": "bracketed | markdown | plist | wpp | plain",',
    '  "fields": [',
    '    {',
    '      "id": "unique-kebab-id",',
    '      "key": "snake_case_key",',
    '      "label": "Step label matching section heading",',
    '      "stage": "Short stage group (e.g. Identity, Background, World, Relationships, Voice, Scenario, Launch, Engine Prompts)",',
    '      "fieldType": "short_text | long_text | traits | list | dialogue",',
    '      "cardMapping": "description | personality | scenario | first_mes | mes_example | character_note | creator_notes | system_prompt | post_history_instructions | alternate_greetings | tags | custom",',
    '      "promptHint": "General, reusable tips for writing this section for any character.",',
    '      "aiSystemDirective": "Focused single-step AI drafting instruction for this field.",',
    '      "placeholder": "Brief neutral placeholder hint (no copied character specifics).",',
    '      "initialTemplate": "Optional bare structural skeleton (or fill-in-the-blanks prompt if fillInTheBlanks is true). Omit or leave empty string for freeform prose steps like Opening Message and Scenario.",',
    '      "tokenTarget": 140,',
    '      "required": true,',
    '      "bracketInline": false,',
    '      "rawBlock": false,',
    '      "fillInTheBlanks": false',
    '    }',
    '  ]',
    '}',
  ].join('\n');

  const cardSections: string[] = [
    `Source File: ${source.fileName}`,
    `Original Character Name (STRIP THIS): ${source.characterName}`,
    source.creatorName ? `Original Card Creator: ${source.creatorName}` : '',
    source.tags.length > 0 ? `Card Tags (for theme hint only): ${source.tags.slice(0, 14).join(', ')}` : '',
    '',
    source.fields.description
      ? `=== DESCRIPTION ===\n${truncateForExtraction(source.fields.description, 10000)}`
      : '',
    source.fields.personality
      ? `=== PERSONALITY ===\n${truncateForExtraction(source.fields.personality, 2500)}`
      : '',
    source.fields.scenario
      ? `=== SCENARIO (inspect structure/style only — DO NOT COPY PROSE) ===\n${truncateForExtraction(source.fields.scenario, 2500)}`
      : '',
    source.fields.mes_example
      ? `=== EXAMPLE SCENES / DIALOGUE (mes_example) ===\n${truncateForExtraction(source.fields.mes_example, 4500)}`
      : '',
    source.fields.first_mes
      ? `=== OPENING MESSAGE (first_mes — inspect format/style only, DO NOT COPY PROSE) ===\n${truncateForExtraction(source.fields.first_mes, 2800)}`
      : '',
    source.fields.alternate_greetings.length > 0
      ? `=== ALTERNATE GREETINGS COUNT ===\n${source.fields.alternate_greetings.length} alternate greeting(s) present in source card (include an optional alternate_greetings step if appropriate; DO NOT COPY PROSE).`
      : '',
    source.fields.character_note
      ? `=== CHARACTER NOTE (extensions.depth_prompt) ===\n${truncateForExtraction(source.fields.character_note, 3500)}`
      : '',
    source.fields.system_prompt
      ? `=== SYSTEM PROMPT ===\n${truncateForExtraction(source.fields.system_prompt, 5500)}`
      : '',
    source.fields.post_history_instructions
      ? `=== FINAL INSTRUCTIONS (post_history_instructions) ===\n${truncateForExtraction(source.fields.post_history_instructions, 3000)}`
      : '',
  ].filter(Boolean);

  const userInstructionsBlock = [
    options.creatorNameOverride?.trim()
      ? `Creator Name to use: ${options.creatorNameOverride.trim()}`
      : '',
    options.themeOverride?.trim()
      ? `Desired Theme / Genre: ${options.themeOverride.trim()}`
      : '',
    options.instructions.trim()
      ? `USER EXTRACTION INSTRUCTIONS (follow closely):\n${options.instructions.trim()}`
      : 'Extract a faithful, clean, reusable step-by-step preset template from this character card.',
  ]
    .filter(Boolean)
    .join('\n\n');

  const userPrompt = `${cardSections.join('\n\n')}\n\n---\n${userInstructionsBlock}`;

  // Use generous token allowance for full multi-step preset JSON
  const extractionMaxTokens = Math.max(config.maxTokens || 0, 8000);

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // Long cards produce long presets. If the model still hits its output limit,
  // ask it to continue where it stopped and stitch the parts together.
  const MAX_CONTINUATIONS = 3;
  let rawContent = '';
  for (let attempt = 0; attempt <= MAX_CONTINUATIONS; attempt++) {
    const response = await fetch(`${cleanBase}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(config.apiKey, cleanBase),
      signal,
      body: JSON.stringify({
        model: config.selectedModel.trim(),
        messages,
        temperature: 0.25,
        max_tokens: extractionMaxTokens,
        stream: false,
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
      throw new Error(`AI extraction failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`);
    }

    const payload = await response.json();
    const choice = payload?.choices?.[0];
    const part: string = choice?.message?.content || '';
    rawContent += part;
    const cutOff = choice?.finish_reason === 'length' || choice?.finish_reason === 'max_tokens';
    if (!cutOff || !part) break;

    messages.push(
      { role: 'assistant', content: part },
      {
        role: 'user',
        content:
          'Your answer was cut off. Continue the JSON exactly where it stopped. Output only the remaining characters: no repetition, no explanation, no code fences.',
      }
    );
  }

  if (!rawContent.trim()) {
    throw new Error('The AI model returned an empty response. Try again or pick another model in API Setup.');
  }

  const jsonString = extractBalancedJsonObject(rawContent);
  let { preset, error } = validateAndParsePresetJson(jsonString);
  if (error?.startsWith('Invalid JSON')) {
    ({ preset, error } = validateAndParsePresetJson(repairModelJson(jsonString)));
  }
  if (error || !preset) {
    throw new Error(
      error?.startsWith('Invalid JSON')
        ? `The AI's template wasn't valid JSON (${error.replace('Invalid JSON: ', '')}). Try again; a different model may do better.`
        : error || 'Extracted JSON was not a valid preset schema.'
    );
  }

  // Filter out creator_notes if user explicitly excluded it
  const filteredFields = options.excludeCreatorNotes
    ? preset.fields.filter((f) => f.cardMapping !== 'creator_notes')
    : preset.fields;

  const safeFields = filteredFields.length > 0 ? filteredFields : preset.fields;

  // Validate optional authorUrl safely
  let safeUrl = preset.authorUrl;
  if (options.authorUrl?.trim()) {
    try {
      const u = new URL(options.authorUrl.trim());
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        safeUrl = u.toString();
      }
    } catch {
      // keep existing or undefined
    }
  }

  return {
    ...preset,
    id: `preset-extracted-${Date.now()}`,
    author:
      options.creatorNameOverride?.trim() ||
      source.creatorName ||
      preset.author ||
      'Custom Creator',
    theme: options.themeOverride?.trim() || preset.theme || 'General RP',
    authorPlatform: options.authorPlatform?.trim() || preset.authorPlatform,
    authorUrl: safeUrl,
    authorAvatar: options.authorAvatar || preset.authorAvatar,
    fields: safeFields,
    isBuiltIn: false,
    updatedAt: new Date().toISOString(),
  };
}
