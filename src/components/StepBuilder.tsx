import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileCode2,
  Moon,
  Plus,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import {
  AiAssistAction,
  ApiConfig,
  CharacterDraft,
  CreatorPreset,
  OutputFormat,
  PresetField,
  StandardCardOverrideKey,
  WorkspaceMode,
} from '../types';
import {
  compileCharacterCardV2,
  compileCharacterSheet,
  estimateTokens,
  getCharacterTotalTokens,
  getEffectivePresetFields,
  getMissingStandardFields,
  isFieldUntouchedTemplate,
  resolveStandardCardFields,
} from '../utils/tokens';
import { resolveFieldTemplate } from '../data/presets';
import { requestFieldAssistance } from '../utils/openaiClient';
import { AvatarFrame } from './AvatarFrame';
import { downloadCharacterPng } from '../utils/pngCard';
import { withBase } from '../utils/base';
import { CreatorPageLink } from './CreatorPageLink';
import { PWAInstallButton } from './PWAInstallButton';

interface StepBuilderProps {
  character: CharacterDraft;
  preset: CreatorPreset;
  allPresets: CreatorPreset[];
  mode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  apiConfig: ApiConfig;
  isDark: boolean;
  onToggleTheme: () => void;
  onUpdateCharacter: (updater: (prev: CharacterDraft) => CharacterDraft) => void;
  onOpenApiSetup: () => void;
  onOpenCharacters: () => void;
  onSwitchPreset: (presetId: string) => void;
}

type ExportPreviewTab = 'v2json' | OutputFormat;

interface DialoguePair {
  user: string;
  char: string;
}

function parseDialogueBlocks(raw: string): DialoguePair[] {
  if (!raw.trim()) return [];
  const chunks = raw
    .split(/<START>/i)
    .map((c) => c.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const userMatch = chunk.match(/\{\{user\}\}\s*:\s*([\s\S]*?)(?=\{\{char\}\}\s*:|$)/i);
    const charMatch = chunk.match(/\{\{char\}\}\s*:\s*([\s\S]*)$/i);
    return {
      user: userMatch ? userMatch[1].trim() : '',
      char: charMatch ? charMatch[1].trim() : chunk,
    };
  });
}

function serializeDialogueBlocks(pairs: DialoguePair[]): string {
  return pairs
    .filter((p) => p.user.trim() || p.char.trim())
    .map((p) => `<START>\n{{user}}: ${p.user.trim()}\n{{char}}: ${p.char.trim()}`)
    .join('\n');
}

export const StepBuilder: React.FC<StepBuilderProps> = ({
  character,
  preset,
  allPresets,
  mode,
  onChangeMode,
  apiConfig,
  isDark,
  onToggleTheme,
  onUpdateCharacter,
  onOpenApiSetup,
  onOpenCharacters,
  onSwitchPreset,
}) => {
  const includeExtraStandard = Boolean(character.includeExtraStandardFields);
  const missingStandardFields = useMemo(() => getMissingStandardFields(preset), [preset]);
  const activeFields = useMemo(
    () => getEffectivePresetFields(preset, includeExtraStandard),
    [preset, includeExtraStandard]
  );

  const totalSteps = activeFields.length;
  const clampedIndex = Math.min(Math.max(0, character.activeStepIndex), totalSteps);
  const isReviewStep = clampedIndex === totalSteps;
  const currentField: PresetField | undefined = !isReviewStep ? activeFields[clampedIndex] : undefined;

  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportTab, setExportTab] = useState<ExportPreviewTab>('v2json');
  const [resolveMacros, setResolveMacros] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedStandardSlot, setExpandedStandardSlot] = useState<StandardCardOverrideKey | null>(null);

  // Field-type helper states
  const [traitDraft, setTraitDraft] = useState('');
  const [listItemDraft, setListItemDraft] = useState('');
  const [dialogueRawMode, setDialogueRawMode] = useState(false);
  const [newUserLine, setNewUserLine] = useState('');
  const [newCharLine, setNewCharLine] = useState('');

  // AI Co-Writer state (strictly scoped to active step)
  const [aiDirection, setAiDirection] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset transient AI proposal when switching steps or characters
  useEffect(() => {
    abortRef.current?.abort();
    setAiLoading(false);
    setAiOutput('');
    setAiError(null);
    setAiDirection('');
  }, [character.id, clampedIndex]);

  const totalTokens = useMemo(() => getCharacterTotalTokens(character, preset), [character, preset]);
  const completedCount = useMemo(
    () =>
      activeFields.filter(
        (f) =>
          character.completedFieldIds.includes(f.id) ||
          !isFieldUntouchedTemplate(character.values[f.id], f, character.name)
      ).length,
    [character, activeFields]
  );

  const resolvedCurrentTemplate = currentField?.initialTemplate
    ? resolveFieldTemplate(currentField, character.name)
    : '';
  const currentValue = currentField
    ? character.values[currentField.id] !== undefined
      ? character.values[currentField.id]
      : resolvedCurrentTemplate
    : '';
  const isCurrentUntouched = currentField
    ? isFieldUntouchedTemplate(currentValue, currentField, character.name)
    : true;
  const currentTokens =
    currentField?.fillInTheBlanks || !isCurrentUntouched ? estimateTokens(currentValue) : 0;
  const remainingBlanks = useMemo(() => {
    if (!currentField?.fillInTheBlanks) return [];
    const matches = currentValue.match(/\[[^\]\n]{2,56}\]/g) || [];
    // Exclude valid format markers like [typing…], [gap], [Examples...]
    return matches.filter(
      (m) => m !== '[typing…]' && m !== '[typing...]' && m !== '[gap]'
    );
  }, [currentField?.fillInTheBlanks, currentValue]);
  const isStepMarkedDone = currentField ? character.completedFieldIds.includes(currentField.id) : false;

  const setActiveStep = (index: number) => {
    const safeIdx = Math.min(Math.max(0, index), totalSteps);
    onUpdateCharacter((prev) => ({ ...prev, activeStepIndex: safeIdx }));
    setMobileStepsOpen(false);
  };

  const handleToggleExtraStandardFields = () => {
    const nextEnabled = !includeExtraStandard;
    onUpdateCharacter((prev) => {
      const nextValues = { ...prev.values };
      if (nextEnabled) {
        for (const extraField of missingStandardFields) {
          if (nextValues[extraField.id] === undefined && extraField.initialTemplate) {
            nextValues[extraField.id] = resolveFieldTemplate(extraField, prev.name);
          }
        }
      }
      const nextTotal = nextEnabled ? preset.fields.length + missingStandardFields.length : preset.fields.length;
      return {
        ...prev,
        includeExtraStandardFields: nextEnabled,
        values: nextValues,
        activeStepIndex: Math.min(prev.activeStepIndex, nextTotal),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const updateCurrentFieldValue = (nextValue: string) => {
    if (!currentField) return;
    onUpdateCharacter((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      values: {
        ...prev.values,
        [currentField.id]: nextValue,
      },
    }));
  };

  const toggleStepComplete = (fieldId: string) => {
    onUpdateCharacter((prev) => {
      const exists = prev.completedFieldIds.includes(fieldId);
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        completedFieldIds: exists
          ? prev.completedFieldIds.filter((id) => id !== fieldId)
          : [...prev.completedFieldIds, fieldId],
      };
    });
  };

  const handleSaveAndNext = () => {
    if (currentField) {
      onUpdateCharacter((prev) => {
        const val = prev.values[currentField.id];
        const hasRealContent = !isFieldUntouchedTemplate(val, currentField, prev.name);
        const alreadyMarked = prev.completedFieldIds.includes(currentField.id);
        return {
          ...prev,
          activeStepIndex: Math.min(totalSteps, clampedIndex + 1),
          completedFieldIds:
            hasRealContent && !alreadyMarked
              ? [...prev.completedFieldIds, currentField.id]
              : prev.completedFieldIds,
          updatedAt: new Date().toISOString(),
        };
      });
    }
  };

  const insertMacro = (macro: '{{char}}' | '{{user}}') => {
    const el = textareaRef.current;
    if (!el) {
      updateCurrentFieldValue(currentValue + macro);
      return;
    }
    const start = el.selectionStart ?? currentValue.length;
    const end = el.selectionEnd ?? currentValue.length;
    const next = currentValue.slice(0, start) + macro + currentValue.slice(end);
    updateCurrentFieldValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + macro.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleAiAssist = async (action: AiAssistAction) => {
    if (!currentField) return;
    if (!apiConfig.baseUrl.trim() || !apiConfig.selectedModel.trim()) {
      setAiError('Connect an OpenAI-compatible API and select a model in API Setup first.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    setAiOutput('');

    try {
      const finalText = await requestFieldAssistance({
        config: apiConfig,
        preset,
        field: currentField,
        character,
        userDirection: aiDirection,
        actionMode: action,
        onChunk: (partial) => setAiOutput(partial),
        signal: controller.signal,
      });
      setAiOutput(finalText);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setAiError(err instanceof Error ? err.message : 'Failed to reach the AI endpoint.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const standardizedFields = useMemo(
    () => resolveStandardCardFields(character, preset),
    [character, preset]
  );

  const updateStandardOverride = (key: StandardCardOverrideKey, value: string) => {
    onUpdateCharacter((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      standardOverrides: {
        ...(prev.standardOverrides || {}),
        [key]: value,
      },
    }));
  };

  const compiledOutput = useMemo(() => {
    if (exportTab === 'v2json') {
      return JSON.stringify(compileCharacterCardV2(character, preset), null, 2);
    }
    return compileCharacterSheet(character, preset, exportTab, resolveMacros);
  }, [character, preset, exportTab, resolveMacros]);

  // Traits helper parsing
  const traitsList = useMemo(() => {
    if (currentField?.fieldType !== 'traits') return [];
    return currentValue
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }, [currentField?.fieldType, currentValue]);

  const addTrait = () => {
    const clean = traitDraft.trim();
    if (!clean) return;
    const next = traitsList.length > 0 ? `${traitsList.join(', ')}, ${clean}` : clean;
    updateCurrentFieldValue(next);
    setTraitDraft('');
  };

  const removeTrait = (idx: number) => {
    const next = traitsList.filter((_, i) => i !== idx).join(', ');
    updateCurrentFieldValue(next);
  };

  // List helper parsing
  const listItems = useMemo(() => {
    if (currentField?.fieldType !== 'list') return [];
    return currentValue
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
  }, [currentField?.fieldType, currentValue]);

  const addListItem = () => {
    const clean = listItemDraft.trim();
    if (!clean) return;
    const next = [...listItems, clean].map((item) => `- ${item}`).join('\n');
    updateCurrentFieldValue(next);
    setListItemDraft('');
  };

  const removeListItem = (idx: number) => {
    const next = listItems
      .filter((_, i) => i !== idx)
      .map((item) => `- ${item}`)
      .join('\n');
    updateCurrentFieldValue(next);
  };

  // Dialogue helper parsing
  const dialoguePairs = useMemo(() => {
    if (currentField?.fieldType !== 'dialogue') return [];
    return parseDialogueBlocks(currentValue);
  }, [currentField?.fieldType, currentValue]);

  const addDialoguePair = () => {
    if (!newUserLine.trim() && !newCharLine.trim()) return;
    const nextPairs = [...dialoguePairs, { user: newUserLine.trim(), char: newCharLine.trim() }];
    updateCurrentFieldValue(serializeDialogueBlocks(nextPairs));
    setNewUserLine('');
    setNewCharLine('');
  };

  const removeDialoguePair = (idx: number) => {
    const nextPairs = dialoguePairs.filter((_, i) => i !== idx);
    updateCurrentFieldValue(serializeDialogueBlocks(nextPairs));
  };

  const safeSlug = (character.name || 'character')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-24 md:pb-12">
      {/* Workspace Utility Strip (below the 3-zone top bar) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800/90">
        <div className="flex items-center gap-4 min-w-0">
          <AvatarFrame
            src={character.avatarUrl}
            name={character.name}
            size="md"
            editable
            cropAspects={['original', '2:3', '3:4', '1:1']}
            maxOutput={1024}
            onChangeAvatar={(dataUrl) =>
              onUpdateCharacter((prev) => ({
                ...prev,
                avatarUrl: dataUrl,
                updatedAt: new Date().toISOString(),
              }))
            }
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <input
                type="text"
                value={character.name}
                onChange={(e) =>
                  onUpdateCharacter((prev) => ({
                    ...prev,
                    name: e.target.value,
                    updatedAt: new Date().toISOString(),
                  }))
                }
                placeholder="Character Name"
                aria-label="Character name"
                className="font-display text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full sm:w-auto max-w-md"
              />
            </div>
            <input
              type="text"
              value={character.tagline}
              onChange={(e) =>
                onUpdateCharacter((prev) => ({
                  ...prev,
                  tagline: e.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
              placeholder="Add a short one-line role or premise..."
              aria-label="Character tagline"
              className="mt-0.5 w-full text-sm text-zinc-500 dark:text-zinc-400 bg-transparent border-none p-0 focus:outline-none focus:ring-0"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Preset: {preset.name} by {preset.author}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {preset.theme || 'General RP'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {completedCount}/{totalSteps} steps
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">~{totalTokens} tokens</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenCharacters}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Switch character
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Controls: Mode Segmented Switch + Preview + Theme + Install */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div
            className="inline-flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-[#14171F] border border-zinc-200 dark:border-zinc-800"
            role="group"
            aria-label="Creation mode"
          >
            <button
              type="button"
              onClick={() => onChangeMode('manual')}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'manual'
                  ? 'bg-white dark:bg-[#222735] text-zinc-900 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Manual Mode
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('ai')}
              className={`inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'ai'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>AI Co-Writer</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171F] px-3.5 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>Preview Card</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171F] text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <PWAInstallButton variant="compact" />
        </div>
      </div>

      {/* Mobile Step Selector Bar */}
      <div className="lg:hidden mt-4">
        <button
          type="button"
          onClick={() => setMobileStepsOpen((prev) => !prev)}
          className="w-full min-h-[48px] flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-4 py-2.5 text-left cursor-pointer"
        >
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              {isReviewStep
                ? `Final Step · Review & Export`
                : `Step ${String(clampedIndex + 1).padStart(2, '0')} of ${String(totalSteps).padStart(2, '0')} · ${currentField?.stage}`}
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {isReviewStep ? 'Compile & Export Character' : currentField?.label}
            </p>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${
              mobileStepsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {mobileStepsOpen && (
          <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-2 space-y-1">
            {activeFields.map((field, idx) => {
              const rawVal = character.values[field.id] || '';
              const filled = !isFieldUntouchedTemplate(rawVal, field, character.name);
              const active = clampedIndex === idx;
              return (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white font-medium'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="truncate">
                    {String(idx + 1).padStart(2, '0')}. {field.label}
                    {field.isStandardExtra ? ' (Extra)' : ''}
                  </span>
                  <span className="text-xs font-mono tabular-nums opacity-80 shrink-0">
                    {filled ? `${estimateTokens(rawVal)}t` : '—'}
                  </span>
                </button>
              );
            })}

            {missingStandardFields.length > 0 && (
              <div className="mt-1 pt-2 px-2 pb-1 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeExtraStandard}
                  onClick={handleToggleExtraStandardFields}
                  className="w-full min-h-[44px] flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Include missing standard fields
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {missingStandardFields.map((f) => f.label).join(', ')}
                    </p>
                  </div>
                  <span
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      includeExtraStandard ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        includeExtraStandard ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveStep(totalSteps)}
              className={`w-full min-h-[44px] flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
                isReviewStep
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              }`}
            >
              <span>Review &amp; Export Card</span>
              <FileCode2 className="w-4 h-4 shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Main 2-Column Studio Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[276px_minmax(0,1fr)] gap-8 items-start">
        {/* Left Step-by-Step Progress Rail (Desktop) */}
        <aside className="hidden lg:block sticky top-20 space-y-5">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Step Sequence</span>
              <span className="font-mono tabular-nums">
                {completedCount}/{totalSteps}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-200"
                style={{ width: `${totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0}%` }}
              />
            </div>
          </div>

          <nav aria-label="Character creation steps" className="space-y-1">
            {activeFields.map((field, idx) => {
              const value = character.values[field.id] || '';
              const hasContent = !isFieldUntouchedTemplate(value, field, character.name);
              const fieldTokens = hasContent ? estimateTokens(value) : 0;
              const isDone = character.completedFieldIds.includes(field.id) || hasContent;
              const isActive = clampedIndex === idx;
              const isFirstExtra = field.isStandardExtra && idx === preset.fields.length;

              return (
                <React.Fragment key={field.id}>
                  {isFirstExtra && (
                    <div className="pt-2.5 pb-1 px-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/80 dark:border-zinc-800/80 mt-2">
                      Extra Standard Structures
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveStep(idx)}
                    className={`w-full group flex items-start justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#14171F]'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-md text-[11px] font-mono tabular-nums shrink-0 ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : isDone
                            ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                            : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {isDone && !isActive ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          String(idx + 1).padStart(2, '0')
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">{field.label}</p>
                        <p
                          className={`text-xs mt-0.5 truncate ${
                            isActive
                              ? 'text-zinc-300 dark:text-zinc-600'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {field.isStandardExtra ? `${field.stage} · Extra` : field.stage}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-mono tabular-nums pt-0.5 shrink-0 ${
                        isActive
                          ? 'text-zinc-300 dark:text-zinc-600'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {fieldTokens > 0 ? `${fieldTokens}t` : '—'}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}

            {/* Toggle for Missing Standard Structures not in the active Creator Preset */}
            {missingStandardFields.length > 0 && (
              <div className="pt-2.5 mt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeExtraStandard}
                  onClick={handleToggleExtraStandardFields}
                  className="w-full rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white/80 dark:bg-[#12141A] px-3.5 py-3 text-left hover:border-blue-500/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      Extra standard fields
                    </span>
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        includeExtraStandard ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          includeExtraStandard ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {includeExtraStandard
                      ? `Showing ${missingStandardFields.length} extra card fields not in this preset.`
                      : `Add ${missingStandardFields.slice(0, 3).map((f) => f.label).join(', ')}${
                          missingStandardFields.length > 3
                            ? ` +${missingStandardFields.length - 3} more`
                            : ''
                        }.`}
                  </p>
                </button>
              </div>
            )}

            <div className="pt-2 mt-2 border-t border-zinc-200 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => setActiveStep(totalSteps)}
                className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                  isReviewStep
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#14171F]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileCode2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium truncate">Review &amp; Export</span>
                </div>
                <span className="text-xs font-mono tabular-nums opacity-80 shrink-0">
                  {totalTokens}t
                </span>
              </button>
            </div>
          </nav>

          {/* Active Creator Preset Card & Switcher */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <AvatarFrame src={preset.authorAvatar} name={preset.author} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {preset.author}
                  </p>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate">
                    {preset.theme || 'General RP'} · {preset.formatStyle.toUpperCase()}
                  </p>
                </div>
              </div>
              <CreatorPageLink
                url={preset.authorUrl}
                platform={preset.authorPlatform}
                authorName={preset.author}
                size="xs"
              />
            </div>
            <div>
              <label
                htmlFor="active-preset-select"
                className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5"
              >
                Switch Creator Preset
              </label>
              <select
                id="active-preset-select"
                value={preset.id}
                onChange={(e) => onSwitchPreset(e.target.value)}
                className="w-full min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {allPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.author} ({p.theme})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        {/* Center Single-Step Focus Desk */}
        <section className="min-w-0 rounded-2xl border border-zinc-200 dark:border-zinc-800/90 bg-white dark:bg-[#12141A] p-5 sm:p-8">
          {!isReviewStep && currentField ? (
            <div className="space-y-6">
              {/* Step Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono tabular-nums">
                      Step {String(clampedIndex + 1).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{currentField.stage}</span>
                    <span aria-hidden="true">·</span>
                    <span>Maps to {currentField.cardMapping}</span>
                    {currentField.required && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">Required</span>
                      </>
                    )}
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 text-balance">
                    {currentField.label}
                  </h1>
                </div>

                {/* Live Token Meter */}
                <div className="shrink-0 sm:text-right">
                  <div className="text-sm font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {currentTokens}{' '}
                    <span className="text-zinc-400 dark:text-zinc-500">
                      / ~{currentField.tokenTarget} tokens
                    </span>
                  </div>
                  <div className="mt-1.5 w-36 sm:ml-auto h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        currentTokens > currentField.tokenTarget * 1.35
                          ? 'bg-amber-500'
                          : 'bg-blue-600 dark:bg-blue-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((currentTokens / Math.max(1, currentField.tokenTarget)) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Creator Preset Guidance */}
              {currentField.promptHint && (
                <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/80 dark:bg-[#161922] px-4 py-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {currentField.fillInTheBlanks
                        ? 'Fill-in-the-Blanks Engine Prompt'
                        : 'Creator Guidance'}
                    </p>
                    {currentField.fillInTheBlanks && (
                      <p className="text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        {remainingBlanks.length > 0
                          ? `${remainingBlanks.length} setting ${remainingBlanks.length === 1 ? 'blank' : 'blanks'} left to customize`
                          : 'All setting blanks customized'}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {currentField.promptHint}
                  </p>
                </div>
              )}

              {/* Tailored Field Editor by FieldType */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor={`field-input-${currentField.id}`}
                    className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Draft Content
                  </label>
                  <div className="flex items-center gap-1.5">
                    {(currentField.fieldType === 'long_text' ||
                      currentField.fieldType === 'short_text' ||
                      (currentField.fieldType === 'dialogue' && dialogueRawMode)) && (
                      <>
                        <button
                          type="button"
                          onClick={() => insertMacro('{{char}}')}
                          className="min-h-[32px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          + {'{{char}}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => insertMacro('{{user}}')}
                          className="min-h-[32px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          + {'{{user}}'}
                        </button>
                      </>
                    )}
                    {currentField.fieldType === 'dialogue' && (
                      <button
                        type="button"
                        onClick={() => setDialogueRawMode((prev) => !prev)}
                        className="min-h-[32px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 transition-colors cursor-pointer"
                      >
                        {dialogueRawMode ? 'Structured Builder' : 'Raw Editor'}
                      </button>
                    )}
                    {currentField.cardMapping === 'character_note' && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 mr-1">
                        <span>Depth</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={character.depthPromptDepth ?? 4}
                          onChange={(e) =>
                            onUpdateCharacter((prev) => ({
                              ...prev,
                              depthPromptDepth: Math.max(0, Number(e.target.value) || 0),
                              updatedAt: new Date().toISOString(),
                            }))
                          }
                          aria-label="Character Note injection depth"
                          className="w-14 min-h-[32px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-2 py-1 font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                        />
                      </label>
                    )}
                    {resolvedCurrentTemplate && currentValue !== resolvedCurrentTemplate && (
                      <button
                        type="button"
                        onClick={() => updateCurrentFieldValue(resolvedCurrentTemplate)}
                        title="Restore this block's starter structure"
                        className="min-h-[32px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        Reset template
                      </button>
                    )}
                    {currentValue.trim() && (
                      <button
                        type="button"
                        onClick={() => updateCurrentFieldValue('')}
                        title="Clear this step"
                        className="min-h-[32px] rounded-lg px-2.5 py-1 text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. Short Text */}
                {currentField.fieldType === 'short_text' && (
                  <textarea
                    id={`field-input-${currentField.id}`}
                    ref={textareaRef}
                    rows={4}
                    value={currentValue}
                    onChange={(e) => updateCurrentFieldValue(e.target.value)}
                    placeholder={currentField.placeholder}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-3.5 text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-y"
                  />
                )}

                {/* 2. Long Text */}
                {currentField.fieldType === 'long_text' && (
                  <textarea
                    id={`field-input-${currentField.id}`}
                    ref={textareaRef}
                    rows={9}
                    value={currentValue}
                    onChange={(e) => updateCurrentFieldValue(e.target.value)}
                    placeholder={currentField.placeholder}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-3.5 text-[15px] leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors resize-y"
                  />
                )}

                {/* 3. Traits Composer + Comma Sync */}
                {currentField.fieldType === 'traits' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={traitDraft}
                        onChange={(e) => setTraitDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTrait();
                          }
                        }}
                        placeholder="Add a trait or contradiction and press Enter..."
                        className="flex-1 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addTrait}
                        className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>

                    {traitsList.length > 0 && (
                      <div className="flex flex-wrap gap-2 py-1">
                        {traitsList.map((trait, idx) => (
                          <button
                            key={`${trait}-${idx}`}
                            type="button"
                            onClick={() => removeTrait(idx)}
                            title="Click to remove trait"
                            className="inline-flex items-center gap-1.5 min-h-[34px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#161922] px-3 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-red-300 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <span>{trait}</span>
                            <X className="w-3 h-3 opacity-60" />
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea
                      id={`field-input-${currentField.id}`}
                      ref={textareaRef}
                      rows={4}
                      value={currentValue}
                      onChange={(e) => updateCurrentFieldValue(e.target.value)}
                      placeholder={currentField.placeholder}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-3 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>
                )}

                {/* 4. Bullet List Composer */}
                {currentField.fieldType === 'list' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={listItemDraft}
                        onChange={(e) => setListItemDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addListItem();
                          }
                        }}
                        placeholder="Add an entry or rule and press Enter..."
                        className="flex-1 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addListItem}
                        className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>

                    {listItems.length > 0 && (
                      <ul className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0D0F14]">
                        {listItems.map((item, idx) => (
                          <li key={idx} className="flex items-start justify-between gap-3 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                            <span className="leading-relaxed">{item}</span>
                            <button
                              type="button"
                              onClick={() => removeListItem(idx)}
                              aria-label="Remove item"
                              className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <textarea
                      id={`field-input-${currentField.id}`}
                      ref={textareaRef}
                      rows={5}
                      value={currentValue}
                      onChange={(e) => updateCurrentFieldValue(e.target.value)}
                      placeholder={currentField.placeholder}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-3 text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>
                )}

                {/* 5. Example Dialogue Composer */}
                {currentField.fieldType === 'dialogue' && (
                  dialogueRawMode ? (
                    <textarea
                      id={`field-input-${currentField.id}`}
                      ref={textareaRef}
                      rows={9}
                      value={currentValue}
                      onChange={(e) => updateCurrentFieldValue(e.target.value)}
                      placeholder={currentField.placeholder}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-3.5 font-mono text-xs sm:text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  ) : (
                    <div className="space-y-4">
                      {dialoguePairs.length > 0 && (
                        <div className="space-y-3">
                          {dialoguePairs.map((pair, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#161922] p-4 space-y-2.5"
                            >
                              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="font-mono">Exchange {String(idx + 1).padStart(2, '0')}</span>
                                <button
                                  type="button"
                                  onClick={() => removeDialoguePair(idx)}
                                  className="inline-flex items-center gap-1 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove</span>
                                </button>
                              </div>
                              {pair.user && (
                                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                                  <span className="font-mono text-xs text-zinc-500 mr-2">{'{{user}}'}:</span>
                                  {pair.user}
                                </p>
                              )}
                              <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed">
                                <span className="font-mono text-xs text-blue-600 dark:text-blue-400 mr-2">
                                  {'{{char}}'}:
                                </span>
                                {pair.char}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] p-4 space-y-3">
                        <div>
                          <label className="block text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1">
                            {'{{user}}'} prompt
                          </label>
                          <input
                            type="text"
                            value={newUserLine}
                            onChange={(e) => setNewUserLine(e.target.value)}
                            placeholder='"What made you leave the old guild?"'
                            className="w-full min-h-[40px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-mono text-blue-600 dark:text-blue-400 mb-1">
                            {'{{char}}'} response (actions + dialogue)
                          </label>
                          <textarea
                            rows={3}
                            value={newCharLine}
                            onChange={(e) => setNewCharLine(e.target.value)}
                            placeholder='*They set the brass compass flat on the table.* "They started paying more for quiet maps than accurate ones."'
                            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={addDialoguePair}
                          className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Dialogue Exchange</span>
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Per-Step AI Co-Writer Panel (Strictly scoped to THIS step!) */}
              {mode === 'ai' && (
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/90 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        AI Co-Writer for &ldquo;{currentField.label}&rdquo;
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {apiConfig.selectedModel
                          ? `Using ${apiConfig.selectedModel} · Scoped strictly to this step using prior completed steps as context`
                          : 'No OpenAI-compatible model selected yet'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenApiSetup}
                      className="inline-flex items-center gap-1.5 min-h-[36px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{apiConfig.selectedModel ? 'Change Model' : 'Connect API'}</span>
                    </button>
                  </div>

                  {!apiConfig.selectedModel ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#161922] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-sm text-zinc-600 dark:text-zinc-300">
                        Connect OpenRouter, OpenAI, DeepSeek, Ollama, or any OpenAI-compatible server and fetch models to co-write step by step.
                      </p>
                      <button
                        type="button"
                        onClick={onOpenApiSetup}
                        className="inline-flex items-center justify-center min-h-[40px] rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Open API Setup
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={aiDirection}
                          onChange={(e) => setAiDirection(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !aiLoading) {
                              e.preventDefault();
                              void handleAiAssist(isCurrentUntouched ? 'draft' : 'refine');
                            }
                          }}
                          placeholder="Optional direction for this step (e.g., 'Make her guarded and observant, with dry humor')..."
                          className="flex-1 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
                        />
                        {aiLoading ? (
                          <button
                            type="button"
                            onClick={() => abortRef.current?.abort()}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleAiAssist('draft')}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Draft Step</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={aiLoading || isCurrentUntouched}
                          onClick={() => void handleAiAssist('refine')}
                          className="min-h-[36px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          Refine current text
                        </button>
                        <button
                          type="button"
                          disabled={aiLoading}
                          onClick={() => void handleAiAssist('brainstorm')}
                          className="min-h-[36px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          Brainstorm 3 angles
                        </button>
                        <button
                          type="button"
                          disabled={aiLoading || isCurrentUntouched}
                          onClick={() => void handleAiAssist('compress')}
                          className="min-h-[36px] rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          Trim to ~{currentField.tokenTarget}t
                        </button>
                      </div>

                      {aiError && (
                        <div
                          role="alert"
                          className="rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                        >
                          {aiError}
                        </div>
                      )}

                      {(aiOutput || aiLoading) && (
                        <div className="rounded-xl border border-blue-200 dark:border-blue-900/70 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                            <span className="font-medium text-blue-700 dark:text-blue-300">
                              {aiLoading ? 'Streaming suggestion for this step...' : 'AI Suggestion'}
                            </span>
                            <span className="font-mono tabular-nums">
                              ~{estimateTokens(aiOutput)} tokens
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                            {aiOutput || 'Waiting for model response...'}
                          </div>
                          {!aiLoading && aiOutput && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-200/70 dark:border-blue-900/50">
                              <button
                                type="button"
                                onClick={() => {
                                  updateCurrentFieldValue(aiOutput);
                                  setAiOutput('');
                                }}
                                className="min-h-[36px] rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
                              >
                                Replace field
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const separator = currentValue.trim() ? '\n\n' : '';
                                  updateCurrentFieldValue(currentValue.trim() + separator + aiOutput);
                                  setAiOutput('');
                                }}
                                className="min-h-[36px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#12141A] px-3.5 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 transition-colors cursor-pointer"
                              >
                                Append
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyText(aiOutput, 'ai-suggestion')}
                                className="min-h-[36px] rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#12141A] px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                              >
                                {copiedId === 'ai-suggestion' ? 'Copied' : 'Copy'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setAiOutput('')}
                                className="min-h-[36px] rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                              >
                                Discard
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step Footer Navigation */}
              <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/90 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={clampedIndex === 0}
                  onClick={() => setActiveStep(clampedIndex - 1)}
                  className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#161922] disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleStepComplete(currentField.id)}
                    className={`inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      isStepMarkedDone
                        ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isStepMarkedDone ? 'Completed' : 'Mark Done'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAndNext}
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-5 py-2 text-sm font-medium hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <span>
                      {clampedIndex === totalSteps - 1 ? 'Review & Export' : 'Next Step'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Final Review & Export Step */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    Final Assembly · {completedCount} of {totalSteps} steps filled · ~{totalTokens} tokens total
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
                    Review &amp; Export Character
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveStep(0)}
                  className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Back to Step 01</span>
                </button>
              </div>

              {/* Step Completeness Quick Audit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeFields.map((field, idx) => {
                  const rawVal = (character.values[field.id] || '').trim();
                  const isFilled = !isFieldUntouchedTemplate(rawVal, field, character.name);
                  return (
                    <button
                      key={field.id}
                      type="button"
                      onClick={() => setActiveStep(idx)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#161922] px-3.5 py-2.5 text-left hover:border-blue-500/50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {String(idx + 1).padStart(2, '0')}. {field.label}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {isFilled
                            ? `${estimateTokens(rawVal)} tokens · Edit`
                            : field.initialTemplate
                            ? 'Starter template · Click to fill'
                            : 'Empty · Click to write'}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium shrink-0 ${
                          isFilled
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      >
                        {isFilled ? 'Ready' : 'Empty'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Standardized Character JSON Fields Inspector (all standard slots guaranteed in JSON export) */}
              <div className="space-y-3 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Standardized Character JSON Fields
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Every standard slot below is always included in the exported Character JSON—even if the active preset leaves it empty. Click any field to add an optional override.
                    </p>
                  </div>
                  {missingStandardFields.length > 0 && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeExtraStandard}
                      onClick={handleToggleExtraStandardFields}
                      className="inline-flex items-center gap-2 min-h-[36px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 transition-colors cursor-pointer shrink-0"
                    >
                      <span>{includeExtraStandard ? 'Extra steps enabled' : 'Enable missing steps'}</span>
                      <span
                        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                          includeExtraStandard ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            includeExtraStandard ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(
                    [
                      ['description', 'AI Description', 'description', standardizedFields.description],
                      ['personality', 'Personality', 'personality', standardizedFields.personality],
                      ['scenario', 'Scenario', 'scenario', standardizedFields.scenario],
                      ['first_mes', 'Opening Message', 'first_mes', standardizedFields.first_mes],
                      ['mes_example', 'Example Scenes', 'mes_example', standardizedFields.mes_example],
                      [
                        'character_note',
                        'Character Note',
                        `depth_prompt (depth ${character.depthPromptDepth ?? 4})`,
                        standardizedFields.character_note,
                      ],
                      ['creator_notes', 'Creator Notes', 'creator_notes', standardizedFields.creator_notes],
                      ['system_prompt', 'System Prompt', 'system_prompt', standardizedFields.system_prompt],
                      [
                        'post_history_instructions',
                        'Final Instructions',
                        'post_history_instructions',
                        standardizedFields.post_history_instructions,
                      ],
                      ['tags', 'Tags (comma-separated)', 'tags', standardizedFields.tags.join(', ')],
                    ] as [StandardCardOverrideKey, string, string, string][]
                  ).map(([slotKey, label, jsonKeyLabel, resolvedVal]) => {
                    const isSelected = expandedStandardSlot === slotKey;
                    const hasValue = resolvedVal.trim().length > 0;
                    return (
                      <button
                        key={slotKey}
                        type="button"
                        onClick={() => setExpandedStandardSlot(isSelected ? null : slotKey)}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-500/15'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-[#161922] hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {label}
                          </p>
                          <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                            {jsonKeyLabel}
                          </p>
                        </div>
                        <span
                          className={`text-[11px] font-mono tabular-nums shrink-0 ${
                            hasValue
                              ? 'text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-zinc-400 dark:text-zinc-500'
                          }`}
                        >
                          {hasValue ? `${estimateTokens(resolvedVal)}t` : '""'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {expandedStandardSlot && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-[#0D0F14] p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="standard-slot-override"
                        className="text-xs font-medium text-zinc-800 dark:text-zinc-200 font-mono"
                      >
                        Override &ldquo;{expandedStandardSlot}&rdquo; (leave blank to use step output or empty string)
                      </label>
                      <div className="flex items-center gap-3">
                        {expandedStandardSlot === 'character_note' && (
                          <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                            <span>Depth</span>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={character.depthPromptDepth ?? 4}
                              onChange={(e) =>
                                onUpdateCharacter((prev) => ({
                                  ...prev,
                                  depthPromptDepth: Math.max(0, Number(e.target.value) || 0),
                                  updatedAt: new Date().toISOString(),
                                }))
                              }
                              className="w-14 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-2 py-0.5 font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100"
                            />
                          </label>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedStandardSlot(null)}
                          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                    <textarea
                      id="standard-slot-override"
                      rows={4}
                      value={character.standardOverrides?.[expandedStandardSlot] ?? ''}
                      onChange={(e) => updateStandardOverride(expandedStandardSlot, e.target.value)}
                      placeholder={
                        expandedStandardSlot === 'tags'
                          ? 'Slice of Life, Slow-Burn, AnyPOV, Third, Modern'
                          : expandedStandardSlot === 'character_note'
                          ? 'Depth-injected character note (extensions.depth_prompt.prompt)...'
                          : `Optional custom content for ${expandedStandardSlot}...`
                      }
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3 py-2 text-xs font-mono leading-relaxed text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-y"
                    />
                  </div>
                )}
              </div>

              {/* Output Format Selector + Controls */}
              <div className="space-y-3 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#161922] border border-zinc-200 dark:border-zinc-800"
                    role="tablist"
                    aria-label="Export format"
                  >
                    {(
                      [
                        ['v2json', 'Character JSON'],
                        ['bracketed', 'Bracketed'],
                        ['markdown', 'Markdown'],
                        ['plist', 'PList'],
                        ['wpp', 'W++'],
                        ['plain', 'Plain'],
                      ] as [ExportPreviewTab, string][]
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={exportTab === id}
                        onClick={() => setExportTab(id)}
                        className={`min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                          exportTab === id
                            ? 'bg-white dark:bg-[#222735] text-zinc-900 dark:text-zinc-50 shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {exportTab !== 'v2json' && (
                    <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={resolveMacros}
                        onChange={(e) => setResolveMacros(e.target.checked)}
                        className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                      />
                      <span>Preview with character name instead of {'{{char}}'}</span>
                    </label>
                  )}
                </div>

                <pre className="max-h-[420px] overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0D12] p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                  {compiledOutput || 'No fields filled yet. Jump to Step 01 to begin writing.'}
                </pre>

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    title="A picture of your character with the whole card inside. Wyvern, SillyTavern and Chub can import it."
                    onClick={() =>
                      void downloadCharacterPng({
                        card: compileCharacterCardV2(character, preset),
                        avatarSrc: character.avatarUrl ? withBase(character.avatarUrl) : undefined,
                        name: character.name,
                      }).catch((err: unknown) =>
                        window.alert(err instanceof Error ? err.message : 'Could not create the PNG card.')
                      )
                    }
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export PNG Card (.png)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        JSON.stringify(compileCharacterCardV2(character, preset), null, 2),
                        `${safeSlug || 'character'}.json`,
                        'application/json'
                      )
                    }
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161922] px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export JSON (.json)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText(compiledOutput, 'export-copy')}
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161922] px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copiedId === 'export-copy' ? 'Copied to Clipboard' : 'Copy Preview'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        compileCharacterSheet(character, preset, 'markdown', resolveMacros),
                        `${safeSlug || 'character'}.md`,
                        'text/markdown'
                      )
                    }
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161922] px-4 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Markdown (.md)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Live Card Preview Slide-Over Sheet */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Live Character Card Preview"
        >
          <div className="w-full max-w-xl h-full bg-white dark:bg-[#12141A] border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Live Character Preview
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
                  {preset.name} · ~{totalTokens} tokens
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label="Close preview"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-center gap-4">
                <AvatarFrame src={character.avatarUrl} name={character.name} size="md" />
                <div>
                  <h3 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {character.name || 'Unnamed Character'}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {character.tagline || 'No tagline set yet'}
                  </p>
                </div>
              </div>

              <pre className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0B0D12] p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                {compileCharacterSheet(character, preset, preset.formatStyle, false) ||
                  'Start writing Step 01 to watch your character sheet assemble here.'}
              </pre>
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    compileCharacterSheet(character, preset, preset.formatStyle, false),
                    'drawer-copy'
                  )
                }
                className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedId === 'drawer-copy' ? 'Copied' : 'Copy Sheet'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  setActiveStep(totalSteps);
                }}
                className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 cursor-pointer"
              >
                Full Export Desk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
