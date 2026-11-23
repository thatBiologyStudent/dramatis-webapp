export type FieldType = 'short_text' | 'long_text' | 'traits' | 'dialogue' | 'list';

export type CardSlot =
  | 'name'
  | 'description'
  | 'personality'
  | 'scenario'
  | 'first_mes'
  | 'mes_example'
  | 'character_note'
  | 'creator_notes'
  | 'system_prompt'
  | 'post_history_instructions'
  | 'alternate_greetings'
  | 'tags'
  | 'custom';

export type OutputFormat = 'bracketed' | 'markdown' | 'plist' | 'wpp' | 'plain';

export interface PresetField {
  id: string;
  key: string;
  label: string;
  stage: string;
  fieldType: FieldType;
  cardMapping: CardSlot;
  promptHint: string;
  aiSystemDirective: string;
  placeholder: string;
  /** Pre-filled editable starter structure inserted into the field so creators don't have to retype labels */
  initialTemplate?: string;
  tokenTarget: number;
  required?: boolean;
  /** When formatStyle is 'bracketed', puts value on same line as [Label: value] instead of [Label:\nvalue] */
  bracketInline?: boolean;
  /** When true, emits the user's text directly without adding an outer [Label: ...] wrapper */
  rawBlock?: boolean;
  /** Marks dynamically added standard fields when user enables missing standard structures */
  isStandardExtra?: boolean;
  /** When true, the initialTemplate is a ready-to-run fill-in-the-blanks prompt always included in export */
  fillInTheBlanks?: boolean;
}

export type CommunityStatus = 'pending' | 'approved' | 'rejected';

export interface DiscordUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isAdmin: boolean;
  isVerifiedCreator: boolean;
}

export interface ServerCommunityStatus {
  discordAuthConfigured: boolean;
  webhookConfigured: boolean;
  databaseMode: 'postgres' | 'local';
}

export interface CreatorPreset {
  id: string;
  name: string;
  author: string;
  authorAvatar?: string;
  authorUrl?: string;
  authorPlatform?: string;
  theme: string;
  description: string;
  formatStyle: OutputFormat;
  isBuiltIn?: boolean;
  isCommunity?: boolean;
  communityStatus?: CommunityStatus;
  ownerDiscordId?: string;
  ownerUsername?: string;
  verificationCode?: string;
  reviewNote?: string;
  updatedAt: string;
  fields: PresetField[];
}

export type StandardCardOverrideKey =
  | 'description'
  | 'personality'
  | 'scenario'
  | 'first_mes'
  | 'mes_example'
  | 'character_note'
  | 'creator_notes'
  | 'system_prompt'
  | 'post_history_instructions'
  | 'tags';

export interface CharacterDraft {
  id: string;
  name: string;
  tagline: string;
  presetId: string;
  avatarUrl: string;
  values: Record<string, string>;
  standardOverrides?: Partial<Record<StandardCardOverrideKey, string>>;
  /** When true, appends bit-by-bit steps for standard Character JSON fields omitted by the active preset */
  includeExtraStandardFields?: boolean;
  /** Injection depth for extensions.depth_prompt (Character Note), defaults to 4 */
  depthPromptDepth?: number;
  completedFieldIds: string[];
  activeStepIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  rememberKey: boolean;
  selectedModel: string;
  availableModels: string[];
  temperature: number;
  maxTokens: number;
  globalStylePrompt: string;
}

export type WorkspaceMode = 'manual' | 'ai';

export type AppView = 'studio' | 'presets' | 'characters' | 'api';

export type AiAssistAction = 'draft' | 'refine' | 'brainstorm' | 'compress';
