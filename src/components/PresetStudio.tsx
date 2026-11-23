import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileJson,
  FileText,
  Globe,
  Loader2,
  LogOut,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  ApiConfig,
  CardSlot,
  CreatorPreset,
  DiscordUser,
  FieldType,
  OutputFormat,
  PresetField,
  ServerCommunityStatus,
} from '../types';
import { SAMPLE_PLUGIN_PRESET_JSON, validateAndParsePresetJson } from '../utils/tokens';
import {
  extractPresetFromCharacter,
  ParsedCharacterSource,
  parseRawCharacterText,
  parseUploadedCharacterFile,
} from '../utils/templateExtractor';
import { AvatarFrame, CreatorAvatarPicker } from './AvatarFrame';
import { CreatorPageLink } from './CreatorPageLink';
import { DiscordMark, SubmitPublicModal } from './SubmitPublicModal';

interface PresetStudioProps {
  presets: CreatorPreset[];
  apiConfig: ApiConfig;
  discordUser: DiscordUser | null;
  authLoading: boolean;
  authError: string | null;
  serverStatus: ServerCommunityStatus | null;
  mySubmissions: CreatorPreset[];
  pendingReviews: CreatorPreset[];
  onSignInDiscord: () => void | Promise<void>;
  onSignOutDiscord: () => void | Promise<void>;
  onSubmitPublicPreset: (
    preset: CreatorPreset,
    verificationCode: string
  ) => Promise<{ preset: CreatorPreset; autoApproved: boolean; webhookNotified: boolean }>;
  onUpdateCommunityPreset: (preset: CreatorPreset) => Promise<CreatorPreset>;
  onDeleteCommunityPreset: (presetId: string) => Promise<void>;
  onReviewCommunityPreset: (
    presetId: string,
    decision: 'approved' | 'rejected',
    options: { reviewNote?: string; grantVerifiedCreator?: boolean }
  ) => Promise<void>;
  onRefreshCommunity: () => void;
  onSavePreset: (preset: CreatorPreset) => void;
  onDeletePreset: (presetId: string) => void;
  onStartCharacterWithPreset: (presetId: string) => void;
  onOpenApiSetup: () => void;
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'short_text', label: 'Short Text (2–4 lines)' },
  { value: 'long_text', label: 'Long Prose (Multi-paragraph)' },
  { value: 'traits', label: 'Trait Chips / Comma List' },
  { value: 'list', label: 'Bulleted List / Rules' },
  { value: 'dialogue', label: 'Dialogue Exchanges (<START>)' },
];

const CARD_SLOT_OPTIONS: { value: CardSlot; label: string }[] = [
  { value: 'description', label: 'AI Description' },
  { value: 'personality', label: 'Personality' },
  { value: 'scenario', label: 'Scenario' },
  { value: 'first_mes', label: 'Opening Message (first_mes)' },
  { value: 'mes_example', label: 'Example Scenes (mes_example)' },
  { value: 'character_note', label: 'Character Note (extensions.depth_prompt)' },
  { value: 'creator_notes', label: 'Creator Notes (creator_notes)' },
  { value: 'system_prompt', label: 'System Prompt' },
  { value: 'post_history_instructions', label: 'Final Instructions (post_history_instructions)' },
  { value: 'alternate_greetings', label: 'Alternate Greetings' },
  { value: 'tags', label: 'Tags' },
  { value: 'custom', label: 'Custom Section (appended to AI Description)' },
];

const OUTPUT_FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: 'bracketed', label: 'Bracketed Blocks ([Section: ...])' },
  { value: 'markdown', label: 'Markdown Dossier' },
  { value: 'plist', label: 'Compact PList' },
  { value: 'wpp', label: 'W++ Brackets' },
  { value: 'plain', label: 'Plain Labeled Blocks' },
];

function createEmptyField(index: number): PresetField {
  const id = `field-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    key: `step_${index + 1}`,
    label: `New Step ${index + 1}`,
    stage: 'Character',
    fieldType: 'long_text',
    cardMapping: 'description',
    promptHint: 'Write focused guidance telling the creator what belongs in this step.',
    aiSystemDirective: 'Draft vivid, concise RP bot content strictly for this single field using {{char}}.',
    placeholder: '',
    tokenTarget: 140,
    required: false,
  };
}

export const PresetStudio: React.FC<PresetStudioProps> = ({
  presets,
  apiConfig,
  discordUser,
  authLoading,
  authError,
  serverStatus: _serverStatus,
  mySubmissions,
  pendingReviews,
  onSignInDiscord,
  onSignOutDiscord,
  onSubmitPublicPreset,
  onUpdateCommunityPreset,
  onDeleteCommunityPreset,
  onReviewCommunityPreset,
  onRefreshCommunity,
  onSavePreset,
  onDeletePreset,
  onStartCharacterWithPreset,
  onOpenApiSetup,
}) => {
  const [editingPreset, setEditingPreset] = useState<CreatorPreset | null>(null);
  const [editingFromExtraction, setEditingFromExtraction] = useState(false);
  const [editingWantsPublicSubmit, setEditingWantsPublicSubmit] = useState(false);
  const [savingCommunity, setSavingCommunity] = useState(false);
  const [saveCommunityError, setSaveCommunityError] = useState<string | null>(null);

  const [presetTab, setPresetTab] = useState<'browse' | 'mine' | 'review'>('browse');
  const [submitModalPreset, setSubmitModalPreset] = useState<CreatorPreset | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingCommunityId, setDeletingCommunityId] = useState<string | null>(null);
  const [communityActionError, setCommunityActionError] = useState<string | null>(null);

  // Admin review state
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewVerifyCreator, setReviewVerifyCreator] = useState<Record<string, boolean>>({});
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);

  const [showPluginModal, setShowPluginModal] = useState(false);
  const [pluginJsonText, setPluginJsonText] = useState('');
  const [pluginError, setPluginError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<'all' | OutputFormat>('all');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Extract Template (AI) modal state
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractSource, setExtractSource] = useState<ParsedCharacterSource | null>(null);
  const [extractPasteMode, setExtractPasteMode] = useState(false);
  const [extractRawText, setExtractRawText] = useState('');
  const [extractInstructions, setExtractInstructions] = useState('');
  const [extractFillInBlanks, setExtractFillInBlanks] = useState(true);
  const [extractExcludeNotes, setExtractExcludeNotes] = useState(true);
  const [extractSubmitPublic, setExtractSubmitPublic] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [extractCreatorName, setExtractCreatorName] = useState('');
  const [extractTheme, setExtractTheme] = useState('');
  const [extractPlatform, setExtractPlatform] = useState('');
  const [extractAuthorUrl, setExtractAuthorUrl] = useState('');
  const [extractAuthorAvatar, setExtractAuthorAvatar] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractDragActive, setExtractDragActive] = useState(false);
  const extractFileInputRef = useRef<HTMLInputElement | null>(null);
  const extractAbortRef = useRef<AbortController | null>(null);

  const activeTab: 'browse' | 'mine' | 'review' =
    presetTab === 'review' && !discordUser?.isAdmin
      ? 'browse'
      : presetTab === 'mine' && !discordUser
      ? 'browse'
      : presetTab;

  const openExtractModal = (forPublishing = false) => {
    setExtractError(null);
    setExtractSubmitPublic(forPublishing);
    setShowExtractModal(true);
  };

  const localCustomPresets = presets.filter((p) => !p.isBuiltIn && !p.isCommunity);

  const resetExtractModal = () => {
    extractAbortRef.current?.abort();
    setExtractLoading(false);
    setExtractSource(null);
    setExtractPasteMode(false);
    setExtractRawText('');
    setExtractInstructions('');
    setExtractFillInBlanks(true);
    setExtractExcludeNotes(true);
    setExtractSubmitPublic(false);
    setExtractCreatorName('');
    setExtractTheme('');
    setExtractPlatform('');
    setExtractAuthorUrl('');
    setExtractAuthorAvatar('');
    setExtractError(null);
    setShowExtractModal(false);
  };

  const handleExtractFileSelected = async (file: File) => {
    setExtractError(null);
    try {
      const parsed = await parseUploadedCharacterFile(file);
      setExtractSource(parsed);
      setExtractPasteMode(false);
      if (parsed.creatorName && !extractCreatorName.trim()) {
        setExtractCreatorName(parsed.creatorName);
      }
      if (parsed.hasSystemPrompt || parsed.hasPostHistory) {
        setExtractFillInBlanks(true);
      }
    } catch (err) {
      setExtractSource(null);
      setExtractError(err instanceof Error ? err.message : 'Could not read this character file.');
    }
  };

  const handleRunAiExtraction = async () => {
    setExtractError(null);
    let sourceToUse = extractSource;

    if (!sourceToUse && extractRawText.trim()) {
      try {
        sourceToUse = parseRawCharacterText(extractRawText);
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Could not parse pasted text.');
        return;
      }
    }

    if (!sourceToUse) {
      setExtractError('Upload a character card (.json, .png, .txt, .md) or paste a character sheet first.');
      return;
    }

    extractAbortRef.current?.abort();
    const controller = new AbortController();
    extractAbortRef.current = controller;
    setExtractLoading(true);

    try {
      const extracted = await extractPresetFromCharacter({
        config: apiConfig,
        source: sourceToUse,
        options: {
          instructions: extractInstructions,
          keepSystemPromptsFillInBlanks: extractFillInBlanks,
          excludeCreatorNotes: extractExcludeNotes,
          creatorNameOverride: extractCreatorName,
          themeOverride: extractTheme,
          authorPlatform: extractPlatform,
          authorUrl: extractAuthorUrl,
          authorAvatar: extractAuthorAvatar,
        },
        signal: controller.signal,
      });

      const wantsPublic = extractSubmitPublic;
      setExtractLoading(false);
      setShowExtractModal(false);
      setExtractSubmitPublic(false);
      setEditingFromExtraction(true);
      setEditingWantsPublicSubmit(wantsPublic);
      setSaveCommunityError(null);
      setEditingPreset(extracted);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setExtractLoading(false);
        return;
      }
      setExtractLoading(false);
      setExtractError(
        err instanceof Error ? err.message : 'Template extraction failed. Check your AI model and try again.'
      );
    }
  };

  const filteredPresets = presets.filter((p) =>
    formatFilter === 'all' ? true : p.formatStyle === formatFilter
  );

  const startNewPreset = () => {
    setEditingPreset({
      id: `preset-custom-${Date.now()}`,
      name: 'Untitled Creator Preset',
      author: 'Custom Creator',
      authorAvatar: '',
      theme: 'Slice of Life',
      description: 'Custom step-by-step character blueprint.',
      formatStyle: 'bracketed',
      isBuiltIn: false,
      updatedAt: new Date().toISOString(),
      fields: [
        {
          id: `field-${Date.now()}-1`,
          key: 'identity',
          label: 'Identity & Hook',
          stage: 'Foundation',
          fieldType: 'short_text',
          cardMapping: 'description',
          promptHint: 'Establish {{char}}\'s core role and defining tension in 2–3 sentences.',
          aiSystemDirective: 'Write a grounded 2–3 sentence premise for {{char}}.',
          placeholder: '{{char}} is...',
          tokenTarget: 90,
          required: true,
        },
        {
          id: `field-${Date.now()}-2`,
          key: 'personality',
          label: 'Personality & Contradictions',
          stage: 'Psyche',
          fieldType: 'traits',
          cardMapping: 'personality',
          promptHint: 'Add 6–8 contrasting traits and behavioral quirks.',
          aiSystemDirective: 'Output 6–8 layered personality traits for {{char}}, comma-separated.',
          placeholder: 'calm, observant, skeptical of authority, quietly protective',
          tokenTarget: 110,
          required: true,
        },
        {
          id: `field-${Date.now()}-3`,
          key: 'first_mes',
          label: 'Opening Greeting',
          stage: 'Launch',
          fieldType: 'long_text',
          cardMapping: 'first_mes',
          promptHint: 'Open mid-scene with sensory detail and a clear hook for {{user}}.',
          aiSystemDirective: 'Write an atmospheric first message from {{char}} to {{user}} without controlling {{user}}.',
          placeholder: '*...*',
          tokenTarget: 240,
          required: true,
        },
      ],
    });
  };

  const duplicatePreset = (preset: CreatorPreset) => {
    const clone: CreatorPreset = {
      ...preset,
      id: `preset-custom-${Date.now()}`,
      name: `${preset.name} (Copy)`,
      isBuiltIn: false,
      isCommunity: false,
      communityStatus: undefined,
      ownerDiscordId: undefined,
      ownerUsername: undefined,
      verificationCode: undefined,
      reviewNote: undefined,
      updatedAt: new Date().toISOString(),
      fields: preset.fields.map((f, idx) => ({
        ...f,
        id: `${f.id}-copy-${Date.now()}-${idx}`,
      })),
    };
    setEditingFromExtraction(false);
    setEditingWantsPublicSubmit(false);
    setSaveCommunityError(null);
    setEditingPreset(clone);
  };

  const copyTextValue = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // ignore
    }
  };

  const handleConfirmDeleteCommunity = async (presetId: string) => {
    setCommunityActionError(null);
    setDeletingCommunityId(presetId);
    try {
      await onDeleteCommunityPreset(presetId);
      setConfirmDeleteId(null);
    } catch (err) {
      setCommunityActionError(
        err instanceof Error ? err.message : 'Could not delete community preset.'
      );
    } finally {
      setDeletingCommunityId(null);
    }
  };

  const handleReviewDecision = async (presetId: string, decision: 'approved' | 'rejected') => {
    setCommunityActionError(null);
    setReviewBusyId(presetId);
    try {
      await onReviewCommunityPreset(presetId, decision, {
        reviewNote: reviewNotes[presetId]?.trim() || undefined,
        grantVerifiedCreator: decision === 'approved' ? Boolean(reviewVerifyCreator[presetId]) : false,
      });
    } catch (err) {
      setCommunityActionError(
        err instanceof Error ? err.message : 'Could not update review status.'
      );
    } finally {
      setReviewBusyId(null);
    }
  };

  const handleImportJsonSubmit = () => {
    const { preset, error } = validateAndParsePresetJson(pluginJsonText);
    if (error || !preset) {
      setPluginError(error || 'Invalid preset format.');
      return;
    }
    onSavePreset(preset);
    setPluginJsonText('');
    setPluginError(null);
    setShowPluginModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setPluginJsonText(text);
      setPluginError(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyPresetJson = async (preset: CreatorPreset) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(preset, null, 2));
      setCopiedId(preset.id);
      setTimeout(() => setCopiedId((prev) => (prev === preset.id ? null : prev)), 1800);
    } catch {
      // ignore
    }
  };

  const downloadPresetJson = (preset: CreatorPreset) => {
    const slug = preset.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'creator-preset'}.dramatis-preset.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Visual Preset Editor View
  if (editingPreset) {
    const updateField = (index: number, patch: Partial<PresetField>) => {
      setEditingPreset((prev) => {
        if (!prev) return prev;
        const nextFields = prev.fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
        return { ...prev, fields: nextFields };
      });
    };

    const moveField = (index: number, delta: -1 | 1) => {
      setEditingPreset((prev) => {
        if (!prev) return prev;
        const target = index + delta;
        if (target < 0 || target >= prev.fields.length) return prev;
        const copy = [...prev.fields];
        const [item] = copy.splice(index, 1);
        copy.splice(target, 0, item);
        return { ...prev, fields: copy };
      });
    };

    const removeField = (index: number) => {
      setEditingPreset((prev) => {
        if (!prev || prev.fields.length <= 1) return prev;
        return {
          ...prev,
          fields: prev.fields.filter((_, i) => i !== index),
        };
      });
    };

    const handleSaveEdited = async () => {
      if (!editingPreset.name.trim()) return;
      const prepared: CreatorPreset = {
        ...editingPreset,
        name: editingPreset.name.trim(),
        updatedAt: new Date().toISOString(),
      };

      if (editingPreset.isCommunity) {
        setSavingCommunity(true);
        setSaveCommunityError(null);
        try {
          await onUpdateCommunityPreset(prepared);
          setEditingFromExtraction(false);
          setEditingWantsPublicSubmit(false);
          setEditingPreset(null);
        } catch (err) {
          setSaveCommunityError(
            err instanceof Error ? err.message : 'Could not save live community preset.'
          );
        } finally {
          setSavingCommunity(false);
        }
        return;
      }

      onSavePreset(prepared);
      setEditingFromExtraction(false);
      setEditingWantsPublicSubmit(false);
      setEditingPreset(null);
    };

    const handleSaveAndSubmitPublic = () => {
      if (!editingPreset.name.trim()) return;
      const prepared: CreatorPreset = {
        ...editingPreset,
        name: editingPreset.name.trim(),
        isBuiltIn: false,
        isCommunity: false,
        updatedAt: new Date().toISOString(),
      };
      onSavePreset(prepared);
      setEditingFromExtraction(false);
      setEditingWantsPublicSubmit(false);
      setEditingPreset(null);
      setSubmitModalPreset(prepared);
    };

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-14 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {editingPreset.isCommunity
                ? 'Live Community Preset Editor'
                : 'Creator Preset Layout Editor'}{' '}
              · {editingPreset.fields.length} sequential steps
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
              {editingPreset.name || 'Untitled Preset'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={savingCommunity}
              onClick={() => {
                setEditingFromExtraction(false);
                setEditingWantsPublicSubmit(false);
                setSaveCommunityError(null);
                setEditingPreset(null);
              }}
              className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#161922] disabled:opacity-40 cursor-pointer"
            >
              Cancel
            </button>
            {!editingPreset.isCommunity && (
              <button
                type="button"
                onClick={handleSaveAndSubmitPublic}
                className="inline-flex items-center gap-2 min-h-[42px] rounded-xl border border-blue-200 dark:border-blue-500/40 bg-blue-50/80 dark:bg-blue-500/15 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:border-blue-500 transition-colors cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>Save &amp; Publish</span>
              </button>
            )}
            <button
              type="button"
              disabled={savingCommunity || !editingPreset.name.trim()}
              onClick={() => void handleSaveEdited()}
              className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {savingCommunity ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                {editingPreset.isCommunity
                  ? savingCommunity
                    ? 'Saving Live…'
                    : 'Save Live Changes'
                  : 'Save Preset'}
              </span>
            </button>
          </div>
        </div>

        {saveCommunityError && (
          <div
            role="alert"
            className="rounded-xl border border-red-300/70 dark:border-red-500/30 bg-red-50/70 dark:bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300"
          >
            {saveCommunityError}
          </div>
        )}

        {(editingFromExtraction || editingWantsPublicSubmit) && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {editingFromExtraction ? 'Extracted via AI.' : 'New preset to publish.'}
                </strong>{' '}
                {!editingFromExtraction
                  ? 'Build your steps below, then click Save & Publish to share it with all users.'
                  : editingWantsPublicSubmit
                  ? 'Review the extracted steps below to verify no personal character lore leaked through, then click Save & Publish to share it with all users.'
                  : 'Review the extracted steps, starter templates, and writing tips below—adjust anything you like, then click Save Preset (or Save & Publish if this is your own template).'}
              </p>
            </div>
            {editingWantsPublicSubmit && (
              <button
                type="button"
                onClick={handleSaveAndSubmitPublic}
                className="inline-flex items-center justify-center gap-1.5 min-h-[36px] rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 shrink-0 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Save &amp; Publish</span>
              </button>
            )}
          </div>
        )}

        {/* Preset Metadata */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 space-y-5">
          <div className="pb-5 border-b border-zinc-200/70 dark:border-zinc-800/70">
            <CreatorAvatarPicker
              src={editingPreset.authorAvatar}
              name={editingPreset.author || 'Creator'}
              onChange={(dataUrl) =>
                setEditingPreset({ ...editingPreset, authorAvatar: dataUrl })
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Preset Layout Name
              </label>
              <input
                type="text"
                value={editingPreset.name}
                onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Creator / Author Name
              </label>
              <input
                type="text"
                value={editingPreset.author}
                onChange={(e) => setEditingPreset({ ...editingPreset, author: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Theme / Genre (e.g., Slice of Life, Noir Mystery)
              </label>
              <input
                type="text"
                value={editingPreset.theme}
                onChange={(e) => setEditingPreset({ ...editingPreset, theme: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Default Output Format
              </label>
              <select
                value={editingPreset.formatStyle}
                onChange={(e) =>
                  setEditingPreset({ ...editingPreset, formatStyle: e.target.value as OutputFormat })
                }
                className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              >
                {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Creator Page Platform (e.g., Wyvern, Chub, Ko-fi)
              </label>
              <input
                type="text"
                value={editingPreset.authorPlatform || ''}
                onChange={(e) => setEditingPreset({ ...editingPreset, authorPlatform: e.target.value })}
                placeholder="Wyvern"
                className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Creator Profile URL (optional)
              </label>
              <input
                type="url"
                value={editingPreset.authorUrl || ''}
                onChange={(e) => setEditingPreset({ ...editingPreset, authorUrl: e.target.value })}
                placeholder="https://app.wyvern.chat/profiles/..."
                className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                Summary Description
              </label>
              <input
                type="text"
                value={editingPreset.description}
                onChange={(e) => setEditingPreset({ ...editingPreset, description: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Ordered Step Fields */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Step-by-Step Fields
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Characters built with this preset walk through these fields one at a time in this exact order.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setEditingPreset((prev) =>
                  prev ? { ...prev, fields: [...prev.fields, createEmptyField(prev.fields.length)] } : prev
                )
              }
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-xs font-medium hover:opacity-90 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Step</span>
            </button>
          </div>

          <div className="space-y-4">
            {editingPreset.fields.map((field, idx) => (
              <div
                key={field.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-5 space-y-4"
              >
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-200/70 dark:border-zinc-800/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      Step {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                      ·
                    </span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {field.label || 'Untitled Step'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveField(idx, -1)}
                      aria-label="Move step up"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === editingPreset.fields.length - 1}
                      onClick={() => moveField(idx, 1)}
                      aria-label="Move step down"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={editingPreset.fields.length <= 1}
                      onClick={() => removeField(idx)}
                      aria-label="Delete step"
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Field Label
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Stage Group
                    </label>
                    <input
                      type="text"
                      value={field.stage}
                      onChange={(e) => updateField(idx, { stage: e.target.value })}
                      className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Input Style
                    </label>
                    <select
                      value={field.fieldType}
                      onChange={(e) => updateField(idx, { fieldType: e.target.value as FieldType })}
                      className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    >
                      {FIELD_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Card V2 Slot
                    </label>
                    <select
                      value={field.cardMapping}
                      onChange={(e) => updateField(idx, { cardMapping: e.target.value as CardSlot })}
                      className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-2.5 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    >
                      {CARD_SLOT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Creator Guidance (shown to the user on this step)
                    </label>
                    <textarea
                      rows={2}
                      value={field.promptHint}
                      onChange={(e) => updateField(idx, { promptHint: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-2 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      AI Step Directive (sent to AI Co-Writer for this field only)
                    </label>
                    <textarea
                      rows={2}
                      value={field.aiSystemDirective}
                      onChange={(e) => updateField(idx, { aiSystemDirective: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-2 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    Starter Block Template (pre-filled editable structure when starting a character)
                  </label>
                  <textarea
                    rows={3}
                    value={field.initialTemplate || ''}
                    onChange={(e) => updateField(idx, { initialTemplate: e.target.value })}
                    placeholder={'Optional pre-filled structure, e.g.:\nName: {{char}}\nAge: \nHeight: \nPersonality: '}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-2 font-mono text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3.5 items-end">
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Placeholder Example
                    </label>
                    <input
                      type="text"
                      value={field.placeholder}
                      onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                      className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      Token Target
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={1500}
                      value={field.tokenTarget}
                      onChange={(e) =>
                        updateField(idx, { tokenTarget: Math.max(20, Number(e.target.value) || 100) })
                      }
                      className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(e) => updateField(idx, { required: e.target.checked })}
                      className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                    />
                    <span>Required</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(field.rawBlock)}
                      onChange={(e) => updateField(idx, { rawBlock: e.target.checked })}
                      className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                    />
                    <span>Raw Block (no auto-wrapper)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(field.bracketInline)}
                      onChange={(e) => updateField(idx, { bracketInline: e.target.checked })}
                      className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                    />
                    <span>Inline Bracket ([Label: a, b])</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(field.fillInTheBlanks)}
                      onChange={(e) => updateField(idx, { fillInTheBlanks: e.target.checked })}
                      className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                    />
                    <span>Fill-in-the-Blanks Engine Prompt</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Preset Gallery & Plug-In Hub
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-14 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-2xl">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pluggable Character Blueprints · {presets.length} installed layouts
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1 text-balance">
            Creator Preset Layouts
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Plug in your own creator presets via JSON or build custom step-by-step blueprints. Each preset controls the exact field order, writer guidance, token targets, and per-step AI directives.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => openExtractModal(false)}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-blue-200 dark:border-blue-500/40 bg-blue-50/80 dark:bg-blue-500/15 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Extract from Character</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPluginError(null);
              setShowPluginModal(true);
            }}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171F] px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            <FileJson className="w-4 h-4" />
            <span>Plug In JSON</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingFromExtraction(false);
              startNewPreset();
            }}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Layout</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            <span>Publish a Preset</span>
          </button>
        </div>
      </div>

      {/* Discord Creator Account Bar */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-4 py-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {!discordUser ? (
            <>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  No account needed to use Dramatis
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  Discord sign-in is <strong className="font-semibold text-zinc-700 dark:text-zinc-300">only for publishing your own presets</strong> to everyone. Writing, drafts, presets and API keys stay in your browser without signing in.
                </p>
              </div>
              <button
                type="button"
                disabled={authLoading}
                onClick={() => void onSignInDiscord()}
                className="inline-flex items-center justify-center gap-2 min-h-[40px] rounded-xl bg-[#5865F2] hover:bg-[#4752C4] px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DiscordMark className="w-4 h-4" />
                )}
                <span>{authLoading ? 'Waiting for Discord…' : 'Sign in to publish'}</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={discordUser.avatarUrl}
                  alt={discordUser.displayName}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200 dark:ring-zinc-700 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {discordUser.displayName}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400 truncate">
                      @{discordUser.username}
                    </span>
                    {discordUser.isAdmin && (
                      <>
                        <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Admin
                        </span>
                      </>
                    )}
                    {!discordUser.isAdmin && discordUser.isVerifiedCreator && (
                      <>
                        <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified Creator
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Signed in with Discord only to publish and manage your public presets
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#0D0F14] border border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setPresetTab('browse')}
                    className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'browse'
                        ? 'bg-white dark:bg-[#222735] text-zinc-900 dark:text-zinc-50 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    Browse ({presets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetTab('mine')}
                    className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'mine'
                        ? 'bg-white dark:bg-[#222735] text-zinc-900 dark:text-zinc-50 shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    My Submissions ({mySubmissions.length})
                  </button>
                  {discordUser.isAdmin && (
                    <button
                      type="button"
                      onClick={() => setPresetTab('review')}
                      className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        activeTab === 'review'
                          ? 'bg-white dark:bg-[#222735] text-zinc-900 dark:text-zinc-50 shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      Review Queue ({pendingReviews.length})
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onRefreshCommunity}
                  title="Refresh community presets"
                  aria-label="Refresh community presets"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => void onSignOutDiscord()}
                  className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>

        {(authError || communityActionError) && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 pt-1">
            {authError || communityActionError}
          </p>
        )}
      </div>

      {/* VIEW 1: BROWSE PRESETS */}
      {activeTab === 'browse' && (
        <>
          {/* Format Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#14171F] border border-zinc-200 dark:border-zinc-800 w-fit">
            {(
              [
                ['all', 'All Layouts'],
                ['bracketed', 'Bracketed'],
                ['markdown', 'Markdown'],
                ['plist', 'PList'],
                ['wpp', 'W++'],
                ['plain', 'Plain'],
              ] as ['all' | OutputFormat, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormatFilter(id)}
                className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  formatFilter === id
                    ? 'bg-white dark:bg-[#222735] text-zinc-900 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Preset Cards Grid */}
          {filteredPresets.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-10 text-center">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No creator presets match this format yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredPresets.map((preset) => {
                const totalTarget = preset.fields.reduce((acc, f) => acc + f.tokenTarget, 0);
                const canEditCommunity =
                  Boolean(preset.isCommunity) &&
                  Boolean(
                    discordUser &&
                      (discordUser.isAdmin || discordUser.id === preset.ownerDiscordId)
                  );
                const canEdit = preset.isBuiltIn
                  ? false
                  : preset.isCommunity
                  ? canEditCommunity
                  : true;
                const isLocalCustom = !preset.isBuiltIn && !preset.isCommunity;

                return (
                  <article
                    key={preset.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 flex flex-col justify-between gap-6"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <AvatarFrame
                          src={preset.authorAvatar}
                          name={preset.author}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">
                              {preset.author}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              {preset.theme || 'General RP'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{preset.fields.length} steps</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">~{totalTarget}t</span>
                            <span aria-hidden="true">·</span>
                            <span>{preset.formatStyle.toUpperCase()}</span>
                            {preset.isCommunity ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  Community
                                </span>
                              </>
                            ) : !preset.isBuiltIn ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Local Custom</span>
                              </>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-start justify-between gap-2 mt-1">
                            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                              {preset.name}
                            </h2>
                            <CreatorPageLink
                              url={preset.authorUrl}
                              platform={preset.authorPlatform}
                              authorName={preset.author}
                              size="xs"
                            />
                          </div>
                          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            {preset.description}
                          </p>
                        </div>
                      </div>

                      {/* Step Sequence Preview */}
                      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70 text-xs text-zinc-700 dark:text-zinc-300">
                        {preset.fields.map((field, idx) => (
                          <li key={field.id} className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            <span className="truncate">{field.label}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-200/70 dark:border-zinc-800/70">
                      <button
                        type="button"
                        onClick={() => onStartCharacterWithPreset(preset.id)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Use Preset</span>
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {isLocalCustom && (
                          <button
                            type="button"
                            onClick={() => setSubmitModalPreset(preset)}
                            className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-blue-200 dark:border-blue-500/40 bg-blue-50/70 dark:bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:border-blue-500 cursor-pointer"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Publish</span>
                          </button>
                        )}

                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFromExtraction(false);
                              setEditingWantsPublicSubmit(false);
                              setSaveCommunityError(null);
                              setEditingPreset(preset);
                            }}
                            className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => duplicatePreset(preset)}
                            className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Duplicate &amp; Edit</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void copyPresetJson(preset)}
                          title="Copy preset JSON"
                          className="inline-flex items-center gap-1 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedId === preset.id ? 'Copied' : 'JSON'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadPresetJson(preset)}
                          title="Download preset JSON"
                          aria-label={`Download ${preset.name} JSON`}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {isLocalCustom && (
                          <button
                            type="button"
                            onClick={() => onDeletePreset(preset.id)}
                            title="Delete custom preset"
                            aria-label={`Delete ${preset.name}`}
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-900 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {canEditCommunity && (
                          confirmDeleteId === preset.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={deletingCommunityId === preset.id}
                                onClick={() => void handleConfirmDeleteCommunity(preset.id)}
                                className="min-h-[38px] rounded-lg bg-red-600 hover:bg-red-700 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
                              >
                                {deletingCommunityId === preset.id ? 'Deleting…' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-2 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(preset.id)}
                              title="Delete published community preset"
                              aria-label={`Delete ${preset.name}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-900 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: MY SUBMISSIONS */}
      {activeTab === 'mine' && discordUser && (
        <div className="space-y-4">
          {mySubmissions.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-10 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                You haven&apos;t submitted any public templates yet.
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                Create a custom layout or extract one from your character, then click{' '}
                <strong className="text-zinc-800 dark:text-zinc-200">Submit Publicly</strong> to publish it for all Dramatis users.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {mySubmissions.map((preset) => {
                const status = preset.communityStatus || 'pending';
                const copyKey = `verify-${preset.id}`;
                return (
                  <article
                    key={preset.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3.5 min-w-0">
                          <AvatarFrame
                            src={preset.authorAvatar}
                            name={preset.author}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                              {status === 'approved' ? (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Approved · Live
                                </span>
                              ) : status === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                                  <Clock className="w-3.5 h-3.5" />
                                  Pending Review
                                </span>
                              )}
                              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                                ·
                              </span>
                              <span className="text-zinc-500 dark:text-zinc-400">
                                {preset.fields.length} steps
                              </span>
                              <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                                ·
                              </span>
                              <span className="text-zinc-500 dark:text-zinc-400">
                                {preset.formatStyle.toUpperCase()}
                              </span>
                            </div>
                            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-50 mt-1 truncate">
                              {preset.name}
                            </h2>
                          </div>
                        </div>
                        <CreatorPageLink
                          url={preset.authorUrl}
                          platform={preset.authorPlatform}
                          authorName={preset.author}
                          size="xs"
                        />
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {preset.description}
                      </p>

                      {status === 'pending' && preset.verificationCode && (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0D0F14] px-3 py-2 text-xs">
                          <div className="min-w-0">
                            <span className="text-zinc-500 dark:text-zinc-400">Verification code: </span>
                            <code className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {preset.verificationCode}
                            </code>
                          </div>
                          <button
                            type="button"
                            onClick={() => void copyTextValue(copyKey, preset.verificationCode || '')}
                            className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 cursor-pointer"
                          >
                            {copiedId === copyKey ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === copyKey ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      )}

                      {preset.reviewNote && (
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0D0F14] px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            Admin note:{' '}
                          </span>
                          {preset.reviewNote}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFromExtraction(false);
                          setEditingWantsPublicSubmit(false);
                          setSaveCommunityError(null);
                          setEditingPreset(preset);
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Template</span>
                      </button>

                      {confirmDeleteId === preset.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={deletingCommunityId === preset.id}
                            onClick={() => void handleConfirmDeleteCommunity(preset.id)}
                            className="min-h-[38px] rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
                          >
                            {deletingCommunityId === preset.id ? 'Deleting…' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(preset.id)}
                          className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-900 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: ADMIN REVIEW QUEUE */}
      {activeTab === 'review' && discordUser?.isAdmin && (
        <div className="space-y-4">
          {pendingReviews.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-10 text-center space-y-2">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Review queue is clear.
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                When a creator submits a public template, you&apos;ll get pinged on Discord and it will appear here for one-click verification.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {pendingReviews.map((preset) => {
                const isBusy = reviewBusyId === preset.id;
                return (
                  <article
                    key={preset.id}
                    className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <AvatarFrame
                          src={preset.authorAvatar}
                          name={preset.author}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {preset.author}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              Discord: @{preset.ownerUsername || 'unknown'} (
                              <span className="font-mono">{preset.ownerDiscordId}</span>)
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{preset.fields.length} steps</span>
                            <span aria-hidden="true">·</span>
                            <span>{preset.formatStyle.toUpperCase()}</span>
                          </div>
                          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
                            {preset.name}
                          </h2>
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {preset.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <CreatorPageLink
                          url={preset.authorUrl}
                          platform={preset.authorPlatform}
                          authorName={preset.author}
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFromExtraction(false);
                            setEditingWantsPublicSubmit(false);
                            setSaveCommunityError(null);
                            setEditingPreset(preset);
                          }}
                          className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Inspect &amp; Edit</span>
                        </button>
                      </div>
                    </div>

                    {/* Verification Check Strip */}
                    <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-zinc-600 dark:text-zinc-300">
                          Check creator&apos;s profile for verification code:{' '}
                        </span>
                        <code className="font-mono font-semibold text-blue-700 dark:text-blue-300 select-all">
                          {preset.verificationCode || 'None provided'}
                        </code>
                      </div>
                      {preset.authorUrl &&
                        (preset.authorUrl.startsWith('https://') ||
                          preset.authorUrl.startsWith('http://')) && (
                          <a
                            href={preset.authorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate max-w-xs"
                          >
                            {preset.authorUrl}
                          </a>
                        )}
                    </div>

                    {/* Step Preview */}
                    <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70 text-xs text-zinc-700 dark:text-zinc-300">
                      {preset.fields.map((field, idx) => (
                        <li key={field.id} className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="truncate">{field.label}</span>
                        </li>
                      ))}
                    </ol>

                    {/* Decision Controls */}
                    <div className="pt-4 border-t border-zinc-200/70 dark:border-zinc-800/70 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                        <input
                          type="text"
                          value={reviewNotes[preset.id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [preset.id]: e.target.value }))
                          }
                          placeholder="Optional note to creator (e.g., why rejected or confirmation note)"
                          className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                        />
                        <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={Boolean(reviewVerifyCreator[preset.id])}
                            onChange={(e) =>
                              setReviewVerifyCreator((prev) => ({
                                ...prev,
                                [preset.id]: e.target.checked,
                              }))
                            }
                            className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                          />
                          <span>Mark creator as Verified (auto-approve future presets)</span>
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleReviewDecision(preset.id, 'rejected')}
                          className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-red-300 dark:border-red-900 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleReviewDecision(preset.id, 'approved')}
                          className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-semibold text-white disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Approve &amp; Publish</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Plug-In Creator Preset JSON Modal */}
      {showPluginModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Plug In Creator Preset JSON"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Plug In a Creator Preset Layout
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Paste a shared creator preset JSON or import a `.json` layout file.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPluginModal(false)}
                aria-label="Close modal"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .json File</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPluginJsonText(SAMPLE_PLUGIN_PRESET_JSON);
                  setPluginError(null);
                }}
                className="inline-flex items-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Load Example Schema</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={pluginJsonText}
              onChange={(e) => {
                setPluginJsonText(e.target.value);
                setPluginError(null);
              }}
              placeholder='{"name": "My Creator Layout", "formatStyle": "markdown", "fields": [...]}'
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0D12] p-3.5 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 resize-y"
            />

            {pluginError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {pluginError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPluginModal(false)}
                className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pluginJsonText.trim()}
                onClick={handleImportJsonSubmit}
                className="min-h-[42px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
              >
                Install Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extract Template from Character (AI) Modal */}
      {showExtractModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Extract Template from Character"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Extract Template from Character
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Upload any creator character card (.json, .png with embedded card data, or .txt/.md) and let your connected AI strip character specifics and extract a reusable step-by-step preset.
                </p>
                {extractSubmitPublic && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <Globe className="w-3.5 h-3.5" />
                    Publishing: after extraction you review the steps, then publish them.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={resetExtractModal}
                aria-label="Close modal"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI Connection Banner */}
            {!apiConfig.selectedModel.trim() ? (
              <div className="rounded-xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  Connect an OpenAI-compatible API and pick a model first to run AI template extraction.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowExtractModal(false);
                    onOpenApiSetup();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-3.5 py-1.5 text-xs font-medium hover:opacity-90 shrink-0 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Open API Setup</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#0D0F14] px-3.5 py-2.5 text-xs">
                <div className="min-w-0 truncate text-zinc-600 dark:text-zinc-400">
                  <span>Active AI model: </span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">
                    {apiConfig.selectedModel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExtractModal(false);
                    onOpenApiSetup();
                  }}
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline shrink-0 cursor-pointer"
                >
                  Change
                </button>
              </div>
            )}

            {/* Step 1: Upload or Paste Character */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  1. Creator Character Source
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setExtractPasteMode((prev) => !prev);
                    setExtractError(null);
                  }}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {extractPasteMode ? 'Switch to File Upload' : 'Or paste JSON / raw sheet'}
                </button>
              </div>

              {!extractPasteMode ? (
                <div>
                  <input
                    ref={extractFileInputRef}
                    type="file"
                    accept=".json,.png,.txt,.md,application/json,image/png,text/plain,text/markdown"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleExtractFileSelected(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setExtractDragActive(true);
                    }}
                    onDragLeave={() => setExtractDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setExtractDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void handleExtractFileSelected(file);
                    }}
                    onClick={() => extractFileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        extractFileInputRef.current?.click();
                      }
                    }}
                    className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
                      extractDragActive
                        ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-500/10'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0D0F14] hover:border-blue-500/60'
                    }`}
                  >
                    <Upload className="w-5 h-5 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {extractSource ? extractSource.fileName : 'Click or drop a creator character file'}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Supports Character Card V2/V3 <span className="font-mono">.json</span>, embedded{' '}
                      <span className="font-mono">.png</span> cards, or raw <span className="font-mono">.txt/.md</span> sheets
                    </p>
                  </div>
                </div>
              ) : (
                <textarea
                  rows={6}
                  value={extractRawText}
                  onChange={(e) => {
                    setExtractRawText(e.target.value);
                    setExtractSource(null);
                    setExtractError(null);
                  }}
                  placeholder="Paste a Character Card JSON or raw creator character sheet / template text here..."
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0D12] p-3.5 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 resize-y"
                />
              )}

              {/* Detected Character Card Summary */}
              {extractSource && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#0D0F14] p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {extractSource.characterName}{' '}
                          <span className="font-normal text-zinc-500 dark:text-zinc-400">
                            (identifying details will be stripped)
                          </span>
                        </p>
                        {extractSource.creatorName && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                            Detected creator: {extractSource.creatorName}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExtractSource(null)}
                      className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Detected fields:</span>
                    {[
                      extractSource.fields.description ? 'Description' : null,
                      extractSource.fields.personality ? 'Personality' : null,
                      extractSource.hasScenario ? 'Scenario' : null,
                      extractSource.hasMesExample ? 'Example Scenes' : null,
                      extractSource.hasFirstMes ? 'Opening' : null,
                      extractSource.hasAlternateGreetings
                        ? `${extractSource.fields.alternate_greetings.length} Alt Greeting(s)`
                        : null,
                      extractSource.hasCharacterNote ? 'Character Note' : null,
                      extractSource.hasSystemPrompt ? 'System Prompt' : null,
                      extractSource.hasPostHistory ? 'Final Instructions' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Extraction Instructions */}
            <div className="space-y-3">
              <label
                htmlFor="extract-ai-instructions"
                className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200"
              >
                2. Instructions for AI Extraction
              </label>
              <textarea
                id="extract-ai-instructions"
                rows={3}
                value={extractInstructions}
                onChange={(e) => setExtractInstructions(e.target.value)}
                placeholder="e.g., Keep the exact bracketed blocks and add a <Thoughts:> block in Example Scenes. Strip all sci-fi specifics so it works for any genre. Keep the system prompt as fill-in-the-blanks."
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2.5 text-xs leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
              />

              <div className="flex flex-col gap-2.5 pt-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={extractFillInBlanks}
                      onChange={(e) => setExtractFillInBlanks(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                    />
                    <span>Keep system prompts as fill-in-the-blanks</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={extractExcludeNotes}
                      onChange={(e) => setExtractExcludeNotes(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                    />
                    <span>Exclude Creator Notes</span>
                  </label>
                </div>

              </div>
            </div>

            {/* Step 3: Optional Creator Attribution */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0D0F14] p-4 space-y-3.5">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                3. Creator Attribution (Optional)
              </p>
              <CreatorAvatarPicker
                src={extractAuthorAvatar}
                name={extractCreatorName || extractSource?.creatorName || 'Creator'}
                onChange={setExtractAuthorAvatar}
                hint="The creator's picture, shown on the preset card. You can also change it later in the editor."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Creator Name
                  </label>
                  <input
                    type="text"
                    value={extractCreatorName}
                    onChange={(e) => setExtractCreatorName(e.target.value)}
                    placeholder={extractSource?.creatorName || 'Auto-detect from card'}
                    className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Theme / Genre
                  </label>
                  <input
                    type="text"
                    value={extractTheme}
                    onChange={(e) => setExtractTheme(e.target.value)}
                    placeholder="Auto-detect (e.g. Slice of Life, Dark Fantasy)"
                    className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Platform (e.g. Wyvern, Chub)
                  </label>
                  <input
                    type="text"
                    value={extractPlatform}
                    onChange={(e) => setExtractPlatform(e.target.value)}
                    placeholder="Wyvern"
                    className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Creator Profile URL
                  </label>
                  <input
                    type="url"
                    value={extractAuthorUrl}
                    onChange={(e) => setExtractAuthorUrl(e.target.value)}
                    placeholder="https://app.wyvern.chat/profiles/..."
                    className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {extractError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {extractError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
              {extractLoading ? (
                <button
                  type="button"
                  onClick={() => extractAbortRef.current?.abort()}
                  className="inline-flex items-center gap-1.5 min-h-[42px] rounded-xl border border-red-300 dark:border-red-900 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetExtractModal}
                  className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                disabled={
                  extractLoading ||
                  !apiConfig.selectedModel.trim() ||
                  (!extractSource && !extractRawText.trim())
                }
                onClick={() => void handleRunAiExtraction()}
                className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {extractLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting Template…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Extract Template with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish a Preset Modal */}
      {showPublishModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Publish a Preset"
        >
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Publish a Preset
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Share your own preset layout with every Dramatis user. Published presets stay in the Preset Picker for everyone, with your name, picture and profile link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                aria-label="Close modal"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
              {[
                ['1', 'Pick or make a preset'],
                ['2', 'Sign in with Discord (only for publishing)'],
                ['3', 'Add your picture & profile link'],
              ].map(([n, label]) => (
                <li
                  key={n}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#0D0F14] px-2.5 py-2"
                >
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white font-semibold shrink-0">
                    {n}
                  </span>
                  <span className="leading-snug">{label}</span>
                </li>
              ))}
            </ol>

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Your presets</p>
              {localCustomPresets.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  You don&apos;t have a preset of your own yet. Make one from one of your characters, or build one from scratch below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {localCustomPresets.map((preset) => (
                    <li
                      key={preset.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarFrame src={preset.authorAvatar} name={preset.author} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {preset.name}
                          </p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {preset.fields.length} steps · {preset.formatStyle.toUpperCase()} · {preset.theme || 'General RP'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPublishModal(false);
                          setSubmitModalPreset(preset);
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shrink-0 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Or make a new one to publish</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowPublishModal(false);
                    openExtractModal(true);
                  }}
                  className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    From my character
                  </span>
                  <span className="block mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    AI turns one of your own character cards into a reusable layout.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPublishModal(false);
                    setEditingFromExtraction(false);
                    startNewPreset();
                    setEditingWantsPublicSubmit(true);
                  }}
                  className="text-left rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 hover:border-emerald-500 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    From scratch
                  </span>
                  <span className="block mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Build the steps yourself, then click Save &amp; Publish.
                  </span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70">
              Only publish layouts you made yourself. Your first preset is checked by the admin before it goes live; after that you can publish straight away.
            </p>
          </div>
        </div>
      )}

      {/* Submit Template Publicly Modal */}
      {submitModalPreset && (
        <SubmitPublicModal
          preset={submitModalPreset}
          discordUser={discordUser}
          authLoading={authLoading}
          authError={authError}
          onSignInDiscord={() => void onSignInDiscord()}
          onClose={() => setSubmitModalPreset(null)}
          onSubmit={onSubmitPublicPreset}
        />
      )}
    </div>
  );
};
