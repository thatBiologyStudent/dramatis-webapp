import React, { useMemo, useRef, useState } from 'react';
import { Copy, Download, Plus, Search, Trash2, Upload } from 'lucide-react';
import { CharacterDraft, CreatorPreset } from '../types';
import {
  compileCharacterCardV2,
  getCharacterTotalTokens,
  getEffectivePresetFields,
  isFieldUntouchedTemplate,
} from '../utils/tokens';
import { AvatarFrame } from './AvatarFrame';
import { PWAInstallButton } from './PWAInstallButton';

interface CharacterLibraryProps {
  characters: CharacterDraft[];
  activeCharacterId: string;
  presets: CreatorPreset[];
  onSelectCharacter: (characterId: string) => void;
  onDuplicateCharacter: (characterId: string) => void;
  onDeleteCharacter: (characterId: string) => void;
  onOpenNewCharacterModal: () => void;
  onImportV2Card: (rawJson: string) => { ok: boolean; error?: string };
}

export const CharacterLibrary: React.FC<CharacterLibraryProps> = ({
  characters,
  activeCharacterId,
  presets,
  onSelectCharacter,
  onDuplicateCharacter,
  onDeleteCharacter,
  onOpenNewCharacterModal,
  onImportV2Card,
}) => {
  const [query, setQuery] = useState('');
  const [presetFilter, setPresetFilter] = useState<string>('all');
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const presetMap = useMemo(() => {
    const map = new Map<string, CreatorPreset>();
    presets.forEach((p) => map.set(p.id, p));
    return map;
  }, [presets]);

  const filteredCharacters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (presetFilter !== 'all' && c.presetId !== presetFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q)
      );
    });
  }, [characters, presetFilter, query]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportV2Card(content);
      if (!res.ok) {
        setImportError(res.error || 'Could not import Character Card V2 JSON.');
      } else {
        setImportError(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportV2 = (character: CharacterDraft) => {
    const preset = presetMap.get(character.presetId) || presets[0];
    if (!preset) return;
    const json = JSON.stringify(compileCharacterCardV2(character, preset), null, 2);
    const slug = (character.name || 'character')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'character'}.card-v2.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-14 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            Local Character Roster · {characters.length} saved drafts
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1 text-balance">
            Your Characters
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171F] px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Card V2</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewCharacterModal}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Character</span>
          </button>
          <PWAInstallButton variant="compact" />
        </div>
      </div>

      {importError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {importError}
        </div>
      )}

      {/* Search & Filter Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter characters by name or tagline..."
            className="w-full min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={presetFilter}
          onChange={(e) => setPresetFilter(e.target.value)}
          aria-label="Filter by creator preset"
          className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] px-3.5 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="all">All Creator Presets</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3-Column Editorial Roster Grid */}
      {filteredCharacters.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-12 text-center space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No matching characters found.
          </p>
          <button
            type="button"
            onClick={onOpenNewCharacterModal}
            className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Start a New Character</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCharacters.map((character) => {
            const preset = presetMap.get(character.presetId) || presets[0];
            const activeFields = preset
              ? getEffectivePresetFields(preset, Boolean(character.includeExtraStandardFields))
              : [];
            const totalSteps = activeFields.length;
            const filledSteps = activeFields.filter(
              (f) => !isFieldUntouchedTemplate(character.values[f.id], f, character.name)
            ).length;
            const tokens = preset ? getCharacterTotalTokens(character, preset) : 0;
            const isActive = character.id === activeCharacterId;
            const pct = totalSteps > 0 ? Math.round((filledSteps / totalSteps) * 100) : 0;

            return (
              <article
                key={character.id}
                className={`rounded-2xl border bg-white dark:bg-[#12141A] p-5 flex flex-col justify-between gap-5 transition-colors ${
                  isActive
                    ? 'border-blue-500/70 dark:border-blue-500/60'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <AvatarFrame src={character.avatarUrl} name={character.name} size="lg" />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {character.name || 'Unnamed Character'}
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {character.tagline || 'No tagline added yet.'}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="truncate max-w-[140px]">{preset?.name || 'Preset'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">~{tokens}t</span>
                      </div>
                    </div>
                  </div>

                  {/* Step Completion Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
                      <span className="tabular-nums">
                        {filledSteps} of {totalSteps} steps written
                      </span>
                      <span className="font-mono tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 dark:bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70">
                  <button
                    type="button"
                    onClick={() => onSelectCharacter(character.id)}
                    className="min-h-[40px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 text-xs font-medium hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    {isActive ? 'Open in Studio' : 'Continue Step'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateCharacter(character.id)}
                      title="Duplicate character"
                      aria-label={`Duplicate ${character.name}`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => exportV2(character)}
                      title="Export Card V2 JSON"
                      aria-label={`Export ${character.name} Card V2`}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {characters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteCharacter(character.id)}
                        title="Delete character"
                        aria-label={`Delete ${character.name}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
