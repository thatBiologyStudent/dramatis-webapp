import {
  CharacterDraft,
  CreatorPreset,
  OutputFormat,
  PresetField,
  StandardCardOverrideKey,
} from '../types';
import { resolveFieldTemplate, STANDARD_EXTRA_FIELDS } from '../data/presets';

/**
 * Fast, realistic token approximation (~3.8 chars per token for English RP prose + formatting).
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 3.8));
}

/**
 * Returns the standardized fields that the given creator preset does NOT already cover.
 */
export function getMissingStandardFields(preset: CreatorPreset): PresetField[] {
  const coveredSlots = new Set(preset.fields.map((f) => f.cardMapping));
  return STANDARD_EXTRA_FIELDS.filter((extra) => !coveredSlots.has(extra.cardMapping));
}

/**
 * Returns the active sequence of steps for the Studio: the creator preset's fields,
 * optionally followed by any missing standardized Character JSON fields when toggled on.
 */
export function getEffectivePresetFields(
  preset: CreatorPreset,
  includeExtraStandard: boolean
): PresetField[] {
  if (!includeExtraStandard) {
    return preset.fields;
  }
  return [...preset.fields, ...getMissingStandardFields(preset)];
}

/**
 * Checks whether a field value is empty or still identical to its untouched blank starter template.
 */
export function isFieldUntouchedTemplate(
  value: string | undefined,
  field: PresetField,
  charName?: string
): boolean {
  const clean = (value || '').trim();
  if (!clean) return true;
  if (!field.initialTemplate) return false;
  const rawTemplate = field.initialTemplate.trim();
  const namedTemplate = resolveFieldTemplate(field, charName).trim();
  return clean === rawTemplate || clean === namedTemplate;
}

export function getCharacterTotalTokens(character: CharacterDraft, preset: CreatorPreset): number {
  const allFields = getEffectivePresetFields(preset, Boolean(character.includeExtraStandardFields));
  const fieldTokens = allFields.reduce((sum, field) => {
    const val = character.values[field.id];
    if (field.fillInTheBlanks) {
      const effective =
        val !== undefined ? val : resolveFieldTemplate(field, character.name);
      return sum + estimateTokens(effective || '');
    }
    if (isFieldUntouchedTemplate(val, field, character.name)) return sum;
    return sum + estimateTokens(val || '');
  }, 0);
  const overrideTokens = character.standardOverrides
    ? Object.values(character.standardOverrides).reduce((sum, v) => sum + estimateTokens(v || ''), 0)
    : 0;
  return fieldTokens + overrideTokens;
}

export function interpolateMacros(text: string, charName: string, userName = 'User'): string {
  const safeName = charName.trim() || 'Character';
  return text.replaceAll('{{char}}', safeName).replaceAll('{{user}}', userName);
}

function formatFieldSection(field: PresetField, value: string, format: OutputFormat, charName: string): string {
  const clean = value.trim();
  if (!clean) return '';

  if (field.rawBlock) {
    return clean;
  }

  switch (format) {
    case 'bracketed': {
      // Avoid double-wrapping if user already supplied [Label: ...]
      if (clean.startsWith('[') && clean.endsWith(']')) {
        return clean;
      }
      if (field.bracketInline) {
        const inline = clean.replace(/\n+/g, ', ').replace(/,\s*,+/g, ',');
        return `[${field.label}: ${inline}]`;
      }
      return `[${field.label}:\n${clean}]`;
    }
    case 'plist': {
      const normalized = clean.replace(/\n+/g, ', ').replace(/,\s*,+/g, ',');
      return `[${charName || '{{char}}'}'s ${field.label}: ${normalized}]`;
    }
    case 'wpp': {
      const items = clean
        .split(/[,\n]+/)
        .map((item) => item.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean)
        .map((item) => `"${item.replaceAll('"', "'")}"`)
        .join(' + ');
      return `  ${field.label}(${items})`;
    }
    case 'plain':
      return `${field.label}:\n${clean}`;
    case 'markdown':
    default:
      return `### ${field.label}\n${clean}`;
  }
}

export function compileCharacterSheet(
  character: CharacterDraft,
  preset: CreatorPreset,
  formatOverride?: OutputFormat,
  resolveMacros = false
): string {
  const format = formatOverride ?? preset.formatStyle;
  const charName = character.name.trim() || 'Unnamed Character';
  const activeFields = getEffectivePresetFields(preset, Boolean(character.includeExtraStandardFields));

  const sections = activeFields
    .map((field) => {
      const raw =
        character.values[field.id] !== undefined
          ? character.values[field.id]
          : field.fillInTheBlanks
          ? resolveFieldTemplate(field, character.name)
          : '';
      if (!field.fillInTheBlanks && isFieldUntouchedTemplate(raw, field, character.name)) return '';
      if (!raw.trim()) return '';
      return formatFieldSection(field, raw, format, charName);
    })
    .filter(Boolean);

  let output = '';
  if (format === 'wpp') {
    output = `[character("${charName}")\n{\n${sections.join('\n')}\n}]`;
  } else if (format === 'markdown') {
    const header = `# ${charName}${character.tagline ? `\n*${character.tagline}*` : ''}`;
    output = [header, ...sections].join('\n\n');
  } else {
    output = sections.join('\n\n');
  }

  return resolveMacros ? interpolateMacros(output, charName) : output;
}

export interface StandardizedCardFields {
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  character_note: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
}

export function resolveStandardCardFields(
  character: CharacterDraft,
  preset: CreatorPreset
): StandardizedCardFields {
  const buckets: Record<StandardCardOverrideKey, string[]> = {
    description: [],
    personality: [],
    scenario: [],
    first_mes: [],
    mes_example: [],
    character_note: [],
    creator_notes: [],
    system_prompt: [],
    post_history_instructions: [],
    tags: [],
  };

  const altGreetings: string[] = [];

  // Always check both preset fields and any populated extra standard fields
  const allRelevantFields = getEffectivePresetFields(
    preset,
    Boolean(character.includeExtraStandardFields)
  );

  for (const field of allRelevantFields) {
    const raw =
      character.values[field.id] !== undefined
        ? character.values[field.id]
        : field.fillInTheBlanks
        ? resolveFieldTemplate(field, character.name)
        : '';
    if (!field.fillInTheBlanks && isFieldUntouchedTemplate(raw, field, character.name)) continue;
    const val = raw.trim();
    if (!val) continue;

    if (field.cardMapping === 'description' || field.cardMapping === 'custom') {
      buckets.description.push(formatFieldSection(field, val, preset.formatStyle, character.name));
    } else if (field.cardMapping === 'personality') {
      buckets.personality.push(val);
    } else if (field.cardMapping === 'scenario') {
      buckets.scenario.push(val);
    } else if (field.cardMapping === 'first_mes') {
      buckets.first_mes.push(val);
    } else if (field.cardMapping === 'mes_example') {
      buckets.mes_example.push(val);
    } else if (field.cardMapping === 'character_note') {
      buckets.character_note.push(val);
    } else if (field.cardMapping === 'creator_notes') {
      buckets.creator_notes.push(val);
    } else if (field.cardMapping === 'system_prompt') {
      buckets.system_prompt.push(val);
    } else if (field.cardMapping === 'post_history_instructions') {
      buckets.post_history_instructions.push(val);
    } else if (field.cardMapping === 'tags') {
      buckets.tags.push(val);
    } else if (field.cardMapping === 'alternate_greetings') {
      const split = val
        .split(/\n---\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      altGreetings.push(...split);
    }
  }

  const overrides = character.standardOverrides || {};
  const resolveSlot = (key: StandardCardOverrideKey): string => {
    const overrideVal = overrides[key];
    if (typeof overrideVal === 'string' && overrideVal.trim().length > 0) {
      return overrideVal.trim();
    }
    let joined = buckets[key].join('\n\n');
    // Ensure JED <{{char}}> tag stays balanced if the final closing step was left unfilled
    if (key === 'description' && joined.includes('<{{char}}>') && !joined.includes('</{{char}}>')) {
      joined = `${joined}\n\n</{{char}}>`;
    }
    return joined;
  };

  const rawTags = resolveSlot('tags');
  const parsedTags = rawTags
    ? rawTags
        .split(/[,\n]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return {
    description: resolveSlot('description'),
    personality: resolveSlot('personality'),
    scenario: resolveSlot('scenario'),
    first_mes: resolveSlot('first_mes'),
    mes_example: resolveSlot('mes_example'),
    character_note: resolveSlot('character_note'),
    creator_notes: resolveSlot('creator_notes'),
    system_prompt: resolveSlot('system_prompt'),
    post_history_instructions: resolveSlot('post_history_instructions'),
    alternate_greetings: altGreetings,
    tags: parsedTags,
  };
}

/**
 * Compiles to the full standardized Character Card V2 JSON format (matching SillyTavern / Wyvern / Chub
 * dual top-level + data structure) and ALWAYS includes every standard field even when left empty:
 * description, personality, scenario, first_mes, mes_example, creator_notes, system_prompt,
 * post_history_instructions, alternate_greetings, tags, extensions.depth_prompt (Character Note),
 * visual_description, and character_book.
 */
export function compileCharacterCardV2(character: CharacterDraft, preset: CreatorPreset) {
  const fields = resolveStandardCardFields(character, preset);
  const charName = character.name.trim() || 'Unnamed Character';
  const creatorName = preset.author?.trim() || 'Dramatis Creator';
  const depthValue =
    typeof character.depthPromptDepth === 'number' && character.depthPromptDepth >= 0
      ? character.depthPromptDepth
      : 4;

  const coreCardPayload = {
    name: charName,
    description: fields.description,
    personality: fields.personality,
    scenario: fields.scenario,
    first_mes: fields.first_mes,
    mes_example: fields.mes_example,
    creator_notes: fields.creator_notes,
    system_prompt: fields.system_prompt,
    post_history_instructions: fields.post_history_instructions,
    alternate_greetings: fields.alternate_greetings,
    tags: fields.tags,
    creator: creatorName,
    character_version: 'v2',
    extensions: {
      depth_prompt: {
        prompt: fields.character_note,
        depth: depthValue,
      },
      visual_description: '',
      dramatis: {
        presetId: preset.id,
        presetName: preset.name,
        presetAuthor: creatorName,
        presetTheme: preset.theme,
        tagline: character.tagline,
        includeExtraStandardFields: Boolean(character.includeExtraStandardFields),
        fieldValues: character.values,
        standardOverrides: character.standardOverrides || {},
      },
    },
    character_book: {
      name: `${charName} Lexicon`,
      description: '',
      scan_depth: 2,
      token_budget: 512,
      recursive_scanning: false,
      extensions: {},
      entries: [],
    },
  };

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    ...coreCardPayload,
    data: {
      ...coreCardPayload,
    },
  };
}

export function validateAndParsePresetJson(rawJson: string): { preset?: CreatorPreset; error?: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { error: 'JSON root must be an object representing a creator preset.' };
    }
    if (!parsed.name || typeof parsed.name !== 'string') {
      return { error: 'Preset requires a string "name" field.' };
    }
    if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
      return { error: 'Preset must contain a non-empty "fields" array.' };
    }

    const validFieldTypes = new Set(['short_text', 'long_text', 'traits', 'dialogue', 'list']);
    const validMappings = new Set([
      'name',
      'description',
      'personality',
      'scenario',
      'first_mes',
      'mes_example',
      'character_note',
      'creator_notes',
      'system_prompt',
      'post_history_instructions',
      'alternate_greetings',
      'tags',
      'custom',
    ]);
    const validFormats = new Set(['bracketed', 'markdown', 'plist', 'wpp', 'plain']);

    const sanitizedFields: PresetField[] = parsed.fields.map((f: Record<string, unknown>, idx: number) => {
      const label = typeof f.label === 'string' && f.label.trim() ? f.label.trim() : `Step ${idx + 1}`;
      const key =
        typeof f.key === 'string' && f.key.trim()
          ? f.key.trim()
          : label.toLowerCase().replace(/[^a-z0-9]+/g, '_');

      return {
        id:
          typeof f.id === 'string' && f.id.trim()
            ? f.id.trim()
            : `field-${Date.now()}-${idx}`,
        key,
        label,
        stage: typeof f.stage === 'string' && f.stage.trim() ? f.stage.trim() : 'Character',
        fieldType: validFieldTypes.has(String(f.fieldType))
          ? (String(f.fieldType) as PresetField['fieldType'])
          : 'long_text',
        cardMapping: validMappings.has(String(f.cardMapping))
          ? (String(f.cardMapping) as PresetField['cardMapping'])
          : 'description',
        promptHint:
          typeof f.promptHint === 'string'
            ? f.promptHint
            : `Fill in ${label} for {{char}}.`,
        aiSystemDirective:
          typeof f.aiSystemDirective === 'string'
            ? f.aiSystemDirective
            : `Write concise, vivid roleplay content for the "${label}" field of {{char}}.`,
        placeholder: typeof f.placeholder === 'string' ? f.placeholder : '',
        initialTemplate: typeof f.initialTemplate === 'string' ? f.initialTemplate : undefined,
        tokenTarget:
          typeof f.tokenTarget === 'number' && f.tokenTarget > 0
            ? Math.round(f.tokenTarget)
            : 150,
        required: Boolean(f.required),
        bracketInline: Boolean(f.bracketInline),
        rawBlock: Boolean(f.rawBlock),
        fillInTheBlanks: Boolean(f.fillInTheBlanks),
      };
    });

    const safeAvatar =
      typeof parsed.authorAvatar === 'string' &&
      (parsed.authorAvatar.startsWith('/') ||
        parsed.authorAvatar.startsWith('https://') ||
        parsed.authorAvatar.startsWith('http://') ||
        parsed.authorAvatar.startsWith('data:image/'))
        ? parsed.authorAvatar
        : undefined;

    let safeAuthorUrl: string | undefined;
    if (typeof parsed.authorUrl === 'string' && parsed.authorUrl.trim()) {
      try {
        const u = new URL(parsed.authorUrl.trim());
        if (u.protocol === 'https:' || u.protocol === 'http:') {
          safeAuthorUrl = u.toString();
        }
      } catch {
        // ignore invalid URL
      }
    }

    const preset: CreatorPreset = {
      id: `preset-custom-${Date.now()}`,
      name: parsed.name.trim(),
      author: typeof parsed.author === 'string' && parsed.author.trim() ? parsed.author.trim() : 'Custom Creator',
      authorAvatar: safeAvatar,
      authorUrl: safeAuthorUrl,
      authorPlatform:
        typeof parsed.authorPlatform === 'string' && parsed.authorPlatform.trim()
          ? parsed.authorPlatform.trim()
          : undefined,
      theme: typeof parsed.theme === 'string' && parsed.theme.trim() ? parsed.theme.trim() : 'General RP',
      description:
        typeof parsed.description === 'string' && parsed.description.trim()
          ? parsed.description.trim()
          : 'Imported custom creator preset layout.',
      formatStyle: validFormats.has(String(parsed.formatStyle))
        ? (String(parsed.formatStyle) as OutputFormat)
        : 'bracketed',
      isBuiltIn: false,
      updatedAt: new Date().toISOString(),
      fields: sanitizedFields,
    };

    return { preset };
  } catch (err) {
    return {
      error: err instanceof Error ? `Invalid JSON: ${err.message}` : 'Could not parse JSON.',
    };
  }
}

export const SAMPLE_PLUGIN_PRESET_JSON = JSON.stringify(
  {
    name: 'Gothic Mystery Companion',
    author: 'Your Creator Handle',
    authorAvatar: '',
    authorPlatform: 'Wyvern',
    authorUrl: 'https://app.wyvern.chat/profiles/your-id',
    theme: 'Gothic Mystery',
    description:
      'Four-step focused layout for brooding mystery companions with pre-filled starter structures and atmospheric greetings.',
    formatStyle: 'bracketed',
    fields: [
      {
        id: 'gm-hook',
        key: 'hook',
        label: 'Character Profile',
        stage: 'Foundation',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint: 'Fill in {{char}}\'s baseline details and the uncanny rumor attached to them.',
        aiSystemDirective: 'Write a concise key-value profile for {{char}} with grounded gothic mystery atmosphere.',
        placeholder: 'Name: {{char}}\nAge: \nRole: ',
        initialTemplate: 'Name: {{char}}\nAge: \nRole: \nRumor: ',
        tokenTarget: 90,
        required: true,
      },
      {
        id: 'gm-traits',
        key: 'traits',
        label: 'Traits',
        stage: 'Psyche',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint: 'Add 5–7 vivid traits and contradictions.',
        aiSystemDirective: 'Output 6 comma-separated personality traits for {{char}} balancing warmth and secrecy.',
        placeholder: 'soft-spoken, keenly observant, superstitious, guarded about the past, fiercely protective',
        tokenTarget: 100,
        required: true,
      },
      {
        id: 'gm-voice',
        key: 'voice',
        label: 'Example Scenes',
        stage: 'Voice',
        fieldType: 'long_text',
        cardMapping: 'mes_example',
        rawBlock: true,
        promptHint: 'Write two short situational voice clips showing cadence and restraint.',
        aiSystemDirective: 'Write 2 brief situational speech samples for {{char}}.',
        placeholder: '[Speech examples:\n\n<When guarded:\n\n""\n>]',
        initialTemplate: '[Speech examples:\n\n<When guarded:\n\n""\n>\n\n<When amused:\n\n""\n>]',
        tokenTarget: 180,
      },
      {
        id: 'gm-opening',
        key: 'opening',
        label: 'Opening Message',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        rawBlock: true,
        promptHint: 'Open in-scene with tactile weather and a natural decision for {{user}}.',
        aiSystemDirective: 'Write an immersive opening RP message from {{char}} to {{user}} without controlling {{user}}.',
        placeholder: '*Fog curls beneath the iron doorway as {{char}} lifts the storm lantern...*',
        tokenTarget: 220,
        required: true,
      },
    ],
  },
  null,
  2
);
