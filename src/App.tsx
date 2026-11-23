import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { withBase } from './utils/base';
import { BookOpen, Layers, SlidersHorizontal, Users, X } from 'lucide-react';
import {
  ApiConfig,
  AppView,
  CharacterDraft,
  CreatorPreset,
  DiscordUser,
  ServerCommunityStatus,
  WorkspaceMode,
} from './types';
import {
  BUILT_IN_PRESETS,
  buildInitialValuesForPreset,
  RETIRED_EXAMPLE_CHARACTERS,
  STARTER_CHARACTERS,
} from './data/presets';
import { getEffectivePresetFields, getMissingStandardFields } from './utils/tokens';
import {
  deleteCommunityPresetApi,
  fetchAdminReviewQueue,
  fetchCurrentDiscordUser,
  fetchMyCommunitySubmissions,
  fetchPublicCommunityPresets,
  fetchServerStatus,
  logoutDiscordSession,
  requestDiscordAuthUrl,
  reviewCommunityPresetApi,
  setMemoryAuthToken,
  submitPublicPresetApi,
  updateCommunityPresetApi,
} from './utils/communityClient';
import { StepBuilder } from './components/StepBuilder';
import { PresetStudio } from './components/PresetStudio';
import { CharacterLibrary } from './components/CharacterLibrary';
import { ApiSettingsView } from './components/ApiSettingsView';
import { AvatarFrame } from './components/AvatarFrame';
import { CreatorPageLink } from './components/CreatorPageLink';
import { OfflineIndicator } from './components/PWAInstallButton';

const STORAGE_KEYS = {
  CUSTOM_PRESETS: 'dramatis_custom_presets_v1',
  CHARACTERS: 'dramatis_characters_v1',
  ACTIVE_CHAR: 'dramatis_active_character_v1',
  MODE: 'dramatis_mode_v1',
  API_CONFIG: 'dramatis_api_config_v1',
  THEME: 'dramatis_theme_v1',
};

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  rememberKey: false,
  selectedModel: '',
  availableModels: [],
  temperature: 0.75,
  maxTokens: 650,
  globalStylePrompt: '',
};

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [view, setView] = useState<AppView>('characters');

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDark]);

  const [customPresets, setCustomPresets] = useState<CreatorPreset[]>(() =>
    safeReadJson<CreatorPreset[]>(STORAGE_KEYS.CUSTOM_PRESETS, [])
  );

  // Community presets + optional Discord creator session (never blocks offline local use)
  const [communityPresets, setCommunityPresets] = useState<CreatorPreset[]>([]);
  const [mySubmissions, setMySubmissions] = useState<CreatorPreset[]>([]);
  const [pendingReviews, setPendingReviews] = useState<CreatorPreset[]>([]);
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerCommunityStatus | null>(null);

  const refreshCommunityData = useCallback(async (activeUser?: DiscordUser | null) => {
    try {
      const publicList = await fetchPublicCommunityPresets();
      setCommunityPresets(publicList);
    } catch {
      // Offline or API unavailable — built-in + local presets continue working
    }

    const effectiveUser = activeUser !== undefined ? activeUser : discordUser;
    if (effectiveUser) {
      try {
        const mine = await fetchMyCommunitySubmissions();
        setMySubmissions(mine);
      } catch {
        // ignore
      }
      if (effectiveUser.isAdmin) {
        try {
          const queue = await fetchAdminReviewQueue();
          setPendingReviews(queue);
        } catch {
          // ignore
        }
      } else {
        setPendingReviews([]);
      }
    } else {
      setMySubmissions([]);
      setPendingReviews([]);
    }
  }, [discordUser]);

  // Initial load of server status, public presets, and existing Discord session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchServerStatus();
        if (!cancelled) setServerStatus(status);
      } catch {
        // Offline
      }
      let user: DiscordUser | null = null;
      try {
        user = await fetchCurrentDiscordUser();
        if (!cancelled) setDiscordUser(user);
      } catch {
        // Offline
      }
      if (!cancelled) {
        await refreshCommunityData(user);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for OAuth popup completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const isTrustedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:');
      if (!isTrustedOrigin) return;

      const data = event.data as
        | { type?: string; token?: string; user?: DiscordUser; error?: string }
        | undefined;

      if (data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (typeof data.token === 'string' && data.token) {
          setMemoryAuthToken(data.token);
        }
        setAuthLoading(false);
        setAuthError(null);
        if (data.user) {
          setDiscordUser(data.user);
          void refreshCommunityData(data.user);
        } else {
          void fetchCurrentDiscordUser().then((u) => {
            setDiscordUser(u);
            void refreshCommunityData(u);
          });
        }
      } else if (data?.type === 'OAUTH_AUTH_ERROR') {
        setAuthLoading(false);
        setAuthError(data.error || 'Discord sign-in could not be completed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshCommunityData]);

  const handleSignInDiscord = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const { url } = await requestDiscordAuthUrl();
      const popup = window.open(
        url,
        'dramatis_discord_oauth',
        'width=540,height=720,scrollbars=yes,resizable=yes'
      );
      if (!popup) {
        setAuthLoading(false);
        setAuthError('Popup was blocked by your browser. Allow popups for Dramatis to sign in with Discord.');
        return;
      }
      // Reset loading state if user closes popup manually
      const poll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(poll);
          setAuthLoading(false);
        }
      }, 600);
    } catch (err) {
      setAuthLoading(false);
      setAuthError(err instanceof Error ? err.message : 'Could not start Discord sign-in.');
    }
  };

  const handleSignOutDiscord = async () => {
    setAuthError(null);
    try {
      await logoutDiscordSession();
    } catch {
      // ignore
    }
    setDiscordUser(null);
    setMySubmissions([]);
    setPendingReviews([]);
  };

  const handleSubmitPublicPreset = async (preset: CreatorPreset, verificationCode: string) => {
    const result = await submitPublicPresetApi(preset, verificationCode);
    await refreshCommunityData(discordUser);
    return result;
  };

  const handleUpdateCommunityPreset = async (preset: CreatorPreset) => {
    const updated = await updateCommunityPresetApi(preset.id, preset);
    await refreshCommunityData(discordUser);
    return updated;
  };

  const handleDeleteCommunityPreset = async (presetId: string) => {
    await deleteCommunityPresetApi(presetId);
    setCharacters((prev) =>
      prev.map((c) =>
        c.presetId === presetId
          ? { ...c, presetId: BUILT_IN_PRESETS[0].id, activeStepIndex: 0 }
          : c
      )
    );
    await refreshCommunityData(discordUser);
  };

  const handleReviewCommunityPreset = async (
    presetId: string,
    decision: 'approved' | 'rejected',
    options: { reviewNote?: string; grantVerifiedCreator?: boolean }
  ) => {
    await reviewCommunityPresetApi(presetId, decision, options);
    await refreshCommunityData(discordUser);
  };

  // thatBio's own presets always come first; every other preset (other creators'
  // built-ins, published community presets, your local ones) follows newest first.
  const allPresets = useMemo(() => {
    const isOwner = (p: CreatorPreset) => Boolean(p.isBuiltIn) && p.id.startsWith('preset-thatbio-');
    const all = [...BUILT_IN_PRESETS, ...communityPresets, ...customPresets];
    const rest = all
      .filter((p) => !isOwner(p))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return [...all.filter(isOwner), ...rest];
  }, [communityPresets, customPresets]);

  const [characters, setCharacters] = useState<CharacterDraft[]>(() => {
    const stored = safeReadJson<CharacterDraft[]>(STORAGE_KEYS.CHARACTERS, []);
    const kept = stored.filter((c) => RETIRED_EXAMPLE_CHARACTERS[c.id] !== c.updatedAt);
    return kept.length > 0 ? kept : STARTER_CHARACTERS;
  });

  const [activeCharacterId, setActiveCharacterId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAR);
      if (savedId) return savedId;
    } catch {
      // ignore
    }
    return STARTER_CHARACTERS[0]?.id ?? '';
  });

  const [mode, setMode] = useState<WorkspaceMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MODE);
      return saved === 'ai' ? 'ai' : 'manual';
    } catch {
      return 'manual';
    }
  });

  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    const saved = safeReadJson<Partial<ApiConfig>>(STORAGE_KEYS.API_CONFIG, {});
    return {
      ...DEFAULT_API_CONFIG,
      ...saved,
      apiKey: saved.rememberKey ? saved.apiKey || '' : '',
    };
  });

  // New Character Modal state
  const [newCharModalOpen, setNewCharModalOpen] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharTagline, setNewCharTagline] = useState('');
  const [newCharPresetId, setNewCharPresetId] = useState<string>(BUILT_IN_PRESETS[0].id);
  const [newCharIncludeExtra, setNewCharIncludeExtra] = useState<boolean>(false);

  // Persist custom presets
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PRESETS, JSON.stringify(customPresets));
    } catch {
      // ignore
    }
  }, [customPresets]);

  // Persist characters
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters));
    } catch {
      // ignore
    }
  }, [characters]);

  // Persist active character
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAR, activeCharacterId);
    } catch {
      // ignore
    }
  }, [activeCharacterId]);

  // Persist workspace mode
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MODE, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  // Persist API config (strip apiKey unless user explicitly opted in)
  useEffect(() => {
    try {
      const toSave: ApiConfig = {
        ...apiConfig,
        apiKey: apiConfig.rememberKey ? apiConfig.apiKey : '',
      };
      localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [apiConfig]);

  const activeCharacter = useMemo(() => {
    return characters.find((c) => c.id === activeCharacterId) || characters[0];
  }, [characters, activeCharacterId]);

  const activePreset = useMemo(() => {
    return (
      allPresets.find((p) => p.id === activeCharacter?.presetId) || allPresets[0]
    );
  }, [allPresets, activeCharacter?.presetId]);

  const updateActiveCharacter = (updater: (prev: CharacterDraft) => CharacterDraft) => {
    if (!activeCharacter) return;
    setCharacters((prevList) =>
      prevList.map((item) => (item.id === activeCharacter.id ? updater(item) : item))
    );
  };

  const openNewCharacterModal = (preselectedPresetId?: string) => {
    setNewCharName('');
    setNewCharTagline('');
    setNewCharPresetId(preselectedPresetId || activePreset?.id || BUILT_IN_PRESETS[0].id);
    setNewCharIncludeExtra(false);
    setNewCharModalOpen(true);
  };

  const handleCreateNewCharacter = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const charName = newCharName.trim() || 'Untitled Character';
    const selectedPreset =
      allPresets.find((p) => p.id === newCharPresetId) || allPresets[0];
    const seededValues = selectedPreset
      ? buildInitialValuesForPreset(selectedPreset, charName, newCharIncludeExtra)
      : {};

    const created: CharacterDraft = {
      id: `char-${Date.now()}`,
      name: charName,
      tagline: newCharTagline.trim(),
      presetId: newCharPresetId,
      avatarUrl: '',
      values: seededValues,
      includeExtraStandardFields: newCharIncludeExtra,
      depthPromptDepth: 4,
      completedFieldIds: [],
      activeStepIndex: 0,
      createdAt: now,
      updatedAt: now,
    };
    setCharacters((prev) => [created, ...prev]);
    setActiveCharacterId(created.id);
    setNewCharModalOpen(false);
    setView('studio');
  };

  const handleSavePreset = (preset: CreatorPreset) => {
    setCustomPresets((prev) => {
      const exists = prev.some((p) => p.id === preset.id);
      if (exists) {
        return prev.map((p) => (p.id === preset.id ? { ...preset, isBuiltIn: false } : p));
      }
      return [{ ...preset, isBuiltIn: false }, ...prev];
    });
  };

  const handleDeletePreset = (presetId: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== presetId));
    setCharacters((prev) =>
      prev.map((c) =>
        c.presetId === presetId
          ? { ...c, presetId: BUILT_IN_PRESETS[0].id, activeStepIndex: 0 }
          : c
      )
    );
  };

  const handleSwitchCharacterPreset = (nextPresetId: string) => {
    const nextPreset = allPresets.find((p) => p.id === nextPresetId);
    if (!nextPreset) return;
    updateActiveCharacter((prev) => {
      const seeded = buildInitialValuesForPreset(
        nextPreset,
        prev.name,
        Boolean(prev.includeExtraStandardFields)
      );
      return {
        ...prev,
        presetId: nextPresetId,
        values: { ...seeded, ...prev.values },
        activeStepIndex: 0,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleDuplicateCharacter = (characterId: string) => {
    const source = characters.find((c) => c.id === characterId);
    if (!source) return;
    const now = new Date().toISOString();
    const copy: CharacterDraft = {
      ...source,
      id: `char-${Date.now()}`,
      name: `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      values: { ...source.values },
      completedFieldIds: [...source.completedFieldIds],
    };
    setCharacters((prev) => [copy, ...prev]);
  };

  const handleDeleteCharacter = (characterId: string) => {
    setCharacters((prev) => {
      const next = prev.filter((c) => c.id !== characterId);
      if (activeCharacterId === characterId) {
        setActiveCharacterId(next[0]?.id ?? '');
      }
      return next;
    });
  };

  const handleImportV2Card = (rawJson: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(rawJson);
      const data = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      if (!data || typeof data.name !== 'string') {
        return { ok: false, error: 'File does not look like a Character Card V2 JSON (missing name).' };
      }

      const dramatisExt = data?.extensions?.dramatis;
      const matchedPreset =
        allPresets.find((p) => p.id === dramatisExt?.presetId) || BUILT_IN_PRESETS[0];

      const depthPromptObj = data?.extensions?.depth_prompt || parsed?.extensions?.depth_prompt;
      const depthPromptText =
        typeof depthPromptObj?.prompt === 'string' ? depthPromptObj.prompt.trim() : '';
      const depthPromptDepth =
        typeof depthPromptObj?.depth === 'number' && Number.isFinite(depthPromptObj.depth)
          ? depthPromptObj.depth
          : 4;

      const missingSlots = new Set(getMissingStandardFields(matchedPreset).map((f) => f.cardMapping));
      const hasExtraStandardContent =
        (missingSlots.has('character_note') && Boolean(depthPromptText)) ||
        (missingSlots.has('system_prompt') && Boolean(data.system_prompt)) ||
        (missingSlots.has('post_history_instructions') && Boolean(data.post_history_instructions)) ||
        (missingSlots.has('personality') && Boolean(data.personality));

      const includeExtra = Boolean(dramatisExt?.includeExtraStandardFields) || hasExtraStandardContent;

      const values: Record<string, string> = {};
      const standardOverrides: CharacterDraft['standardOverrides'] = {};

      if (dramatisExt?.fieldValues && typeof dramatisExt.fieldValues === 'object') {
        Object.assign(values, dramatisExt.fieldValues);
        if (dramatisExt?.standardOverrides && typeof dramatisExt.standardOverrides === 'object') {
          Object.assign(standardOverrides, dramatisExt.standardOverrides);
        }
      } else {
        // Map standard Card V2 fields onto matching slots of the preset (+ enabled extra standard fields)
        const targetFields = getEffectivePresetFields(matchedPreset, includeExtra);
        for (const field of targetFields) {
          if (field.cardMapping === 'description' && data.description && !values[field.id]) {
            values[field.id] = String(data.description);
          } else if (field.cardMapping === 'personality' && data.personality && !values[field.id]) {
            values[field.id] = String(data.personality);
          } else if (field.cardMapping === 'scenario' && data.scenario && !values[field.id]) {
            values[field.id] = String(data.scenario);
          } else if (field.cardMapping === 'first_mes' && data.first_mes && !values[field.id]) {
            values[field.id] = String(data.first_mes);
          } else if (field.cardMapping === 'mes_example' && data.mes_example && !values[field.id]) {
            values[field.id] = String(data.mes_example);
          } else if (field.cardMapping === 'character_note' && depthPromptText && !values[field.id]) {
            values[field.id] = depthPromptText;
          } else if (field.cardMapping === 'creator_notes' && data.creator_notes && !values[field.id]) {
            values[field.id] = String(data.creator_notes);
          } else if (field.cardMapping === 'system_prompt' && data.system_prompt && !values[field.id]) {
            values[field.id] = String(data.system_prompt);
          } else if (
            field.cardMapping === 'post_history_instructions' &&
            data.post_history_instructions &&
            !values[field.id]
          ) {
            values[field.id] = String(data.post_history_instructions);
          } else if (
            field.cardMapping === 'tags' &&
            Array.isArray(data.tags) &&
            data.tags.length > 0 &&
            !values[field.id]
          ) {
            values[field.id] = data.tags.join(', ');
          }
        }
        // Preserve any standard slots the preset didn't directly map
        if (depthPromptText && !Object.values(values).includes(depthPromptText)) {
          standardOverrides.character_note = depthPromptText;
        }
        if (data.system_prompt && !Object.values(values).includes(String(data.system_prompt))) {
          standardOverrides.system_prompt = String(data.system_prompt);
        }
        if (
          data.post_history_instructions &&
          !Object.values(values).includes(String(data.post_history_instructions))
        ) {
          standardOverrides.post_history_instructions = String(data.post_history_instructions);
        }
        if (data.creator_notes && !Object.values(values).includes(String(data.creator_notes))) {
          standardOverrides.creator_notes = String(data.creator_notes);
        }
        if (Array.isArray(data.tags) && data.tags.length > 0 && !Object.values(values).includes(data.tags.join(', '))) {
          standardOverrides.tags = data.tags.join(', ');
        }
      }

      const now = new Date().toISOString();
      const imported: CharacterDraft = {
        id: `char-${Date.now()}`,
        name: data.name.trim() || 'Imported Character',
        tagline: typeof dramatisExt?.tagline === 'string' ? dramatisExt.tagline : 'Imported Card V2',
        presetId: matchedPreset.id,
        avatarUrl: '',
        values,
        standardOverrides,
        includeExtraStandardFields: includeExtra,
        depthPromptDepth,
        completedFieldIds: Object.keys(values).filter((k) => (values[k] || '').trim().length > 0),
        activeStepIndex: 0,
        createdAt: now,
        updatedAt: now,
      };

      setCharacters((prev) => [imported, ...prev]);
      setActiveCharacterId(imported.id);
      setView('studio');
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? `Invalid JSON: ${err.message}` : 'Could not read JSON file.',
      };
    }
  };

  const handleExportWorkspaceBackup = () => {
    const payload = {
      app: 'Dramatis',
      exportedAt: new Date().toISOString(),
      customPresets,
      characters,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dramatis-studio-backup.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportWorkspaceBackup = (rawJson: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || (!Array.isArray(parsed.characters) && !Array.isArray(parsed.customPresets))) {
        return { ok: false, error: 'Backup JSON must contain characters or customPresets arrays.' };
      }
      if (Array.isArray(parsed.customPresets)) {
        setCustomPresets(parsed.customPresets);
      }
      if (Array.isArray(parsed.characters) && parsed.characters.length > 0) {
        setCharacters(parsed.characters);
        setActiveCharacterId(parsed.characters[0].id);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Invalid backup JSON file.' };
    }
  };

  const navItems: { id: AppView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'characters', label: 'Characters', icon: Users },
    { id: 'presets', label: 'Presets', icon: Layers },
    { id: 'studio', label: 'Studio', icon: BookOpen },
    { id: 'api', label: 'API Setup', icon: SlidersHorizontal },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#0F1115] dark:bg-[#090A0D] dark:text-[#F1F3F5]">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-zinc-200 dark:border-zinc-800/90 bg-white/90 dark:bg-[#090A0D]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          {/* Zone 1: Brand logo + wordmark */}
          <button
            type="button"
            onClick={() => setView('characters')}
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src={withBase('/assets/aistudio/image_8ee5925a.png')}
              alt="Dramatis logo"
              className="w-8 h-8 rounded-lg object-cover ring-1 ring-zinc-200 dark:ring-zinc-800 shrink-0"
            />
            <span>Dramatis</span>
          </button>

          {/* Zone 2: 4 clean single-line text navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'text-zinc-950 dark:text-zinc-50'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-[17px] h-0.5 bg-blue-600 dark:bg-blue-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => openNewCharacterModal()}
              className="min-h-[38px] rounded-lg bg-zinc-950 dark:bg-zinc-100 px-4 py-1.5 text-xs font-medium text-white dark:text-zinc-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              New Character
            </button>
          </div>
        </div>
      </header>

      {/* Main Active Workspace */}
      <main className="flex-1">
        {view === 'studio' && !activeCharacter && (
          <div className="max-w-xl mx-auto px-4 pt-20 pb-24 text-center space-y-4">
            <h1 className="font-display text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              No character open yet
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              The Studio is where you write a character step by step. Start a new character, or open one from the Characters page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => openNewCharacterModal()}
                className="min-h-[42px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
              >
                New Character
              </button>
              <button
                type="button"
                onClick={() => setView('characters')}
                className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Go to Characters
              </button>
            </div>
          </div>
        )}

        {view === 'studio' && activeCharacter && activePreset && (
          <StepBuilder
            character={activeCharacter}
            preset={activePreset}
            allPresets={allPresets}
            mode={mode}
            onChangeMode={setMode}
            apiConfig={apiConfig}
            isDark={isDark}
            onToggleTheme={() => setIsDark((prev) => !prev)}
            onUpdateCharacter={updateActiveCharacter}
            onOpenApiSetup={() => setView('api')}
            onOpenCharacters={() => setView('characters')}
            onSwitchPreset={handleSwitchCharacterPreset}
          />
        )}

        {view === 'presets' && (
          <PresetStudio
            presets={allPresets}
            apiConfig={apiConfig}
            discordUser={discordUser}
            authLoading={authLoading}
            authError={authError}
            serverStatus={serverStatus}
            mySubmissions={mySubmissions}
            pendingReviews={pendingReviews}
            onSignInDiscord={handleSignInDiscord}
            onSignOutDiscord={handleSignOutDiscord}
            onSubmitPublicPreset={handleSubmitPublicPreset}
            onUpdateCommunityPreset={handleUpdateCommunityPreset}
            onDeleteCommunityPreset={handleDeleteCommunityPreset}
            onReviewCommunityPreset={handleReviewCommunityPreset}
            onRefreshCommunity={() => void refreshCommunityData(discordUser)}
            onSavePreset={handleSavePreset}
            onDeletePreset={handleDeletePreset}
            onStartCharacterWithPreset={(presetId) => openNewCharacterModal(presetId)}
            onOpenApiSetup={() => setView('api')}
          />
        )}

        {view === 'characters' && (
          <CharacterLibrary
            characters={characters}
            activeCharacterId={activeCharacterId}
            presets={allPresets}
            onSelectCharacter={(id) => {
              setActiveCharacterId(id);
              setView('studio');
            }}
            onDuplicateCharacter={handleDuplicateCharacter}
            onDeleteCharacter={handleDeleteCharacter}
            onOpenNewCharacterModal={() => openNewCharacterModal()}
            onImportV2Card={handleImportV2Card}
          />
        )}

        {view === 'api' && (
          <ApiSettingsView
            apiConfig={apiConfig}
            onUpdateApiConfig={(patch) =>
              setApiConfig((prev) => ({ ...prev, ...patch }))
            }
            isDark={isDark}
            onToggleTheme={() => setIsDark((prev) => !prev)}
            onExportWorkspaceBackup={handleExportWorkspaceBackup}
            onImportWorkspaceBackup={handleImportWorkspaceBackup}
            onReturnToStudio={() => setView('studio')}
          />
        )}
      </main>

      {/* Mobile Fixed Thumb-Zone Bottom Tab Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#0C0E13]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-4 h-14 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] gap-0.5 transition-colors cursor-pointer ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* New Character Modal (Choose Creator Preset + Begin at Step 01) */}
      {newCharModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Start New Character"
        >
          <form
            onSubmit={handleCreateNewCharacter}
            className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Start a New Character
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Pick a creator preset layout to walk through one step at a time.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewCharModalOpen(false)}
                aria-label="Close modal"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label
                  htmlFor="new-char-name"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
                >
                  Character Name
                </label>
                <input
                  id="new-char-name"
                  type="text"
                  autoFocus
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  placeholder="e.g., Isolde Vance"
                  className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="new-char-tagline"
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
                >
                  One-Line Role or Premise (optional)
                </label>
                <input
                  id="new-char-tagline"
                  type="text"
                  value={newCharTagline}
                  onChange={(e) => setNewCharTagline(e.target.value)}
                  placeholder="e.g., Retired cartographer guarding an unlisted archipelago"
                  className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Creator Preset Layout
                </p>
                <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                  {allPresets.map((preset) => {
                    const selected = newCharPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selected}
                        onClick={() => setNewCharPresetId(preset.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setNewCharPresetId(preset.id);
                          }
                        }}
                        className={`w-full rounded-xl border p-3.5 text-left transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                          selected
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-500/15'
                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0D0F14] hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <AvatarFrame
                            src={preset.authorAvatar}
                            name={preset.author}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {preset.name}
                              </span>
                              <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                                {preset.fields.length} steps
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                  {preset.author}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {preset.theme || 'General RP'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{preset.formatStyle.toUpperCase()}</span>
                              </div>
                              <CreatorPageLink
                                url={preset.authorUrl}
                                platform={preset.authorPlatform}
                                authorName={preset.author}
                                size="xs"
                              />
                            </div>
                            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                              {preset.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {(() => {
                const chosenPreset =
                  allPresets.find((p) => p.id === newCharPresetId) || allPresets[0];
                const missing = chosenPreset ? getMissingStandardFields(chosenPreset) : [];
                if (missing.length === 0) return null;
                return (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={newCharIncludeExtra}
                    onClick={() => setNewCharIncludeExtra((prev) => !prev)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#0D0F14] px-3.5 py-3 text-left hover:border-blue-500/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        Also enable missing standard card fields
                      </span>
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          newCharIncludeExtra ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            newCharIncludeExtra ? 'translate-x-4.5' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Adds {missing.map((f) => f.label).join(', ')} to your step sequence (you can also toggle this anytime inside Studio).
                    </p>
                  </button>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setNewCharModalOpen(false)}
                className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Begin Step 01
              </button>
            </div>
          </form>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
}
