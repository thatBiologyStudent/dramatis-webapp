import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Upload,
  Zap,
} from 'lucide-react';
import { ApiConfig } from '../types';
import {
  fetchCompatibleModels,
  PROVIDER_PRESETS,
  testCompatibleModel,
} from '../utils/openaiClient';
import { PWAInstallButton } from './PWAInstallButton';

interface ApiSettingsViewProps {
  apiConfig: ApiConfig;
  onUpdateApiConfig: (patch: Partial<ApiConfig>) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onExportWorkspaceBackup: () => void;
  onImportWorkspaceBackup: (rawJson: string) => { ok: boolean; error?: string };
  onReturnToStudio: () => void;
}

export const ApiSettingsView: React.FC<ApiSettingsViewProps> = ({
  apiConfig,
  onUpdateApiConfig,
  isDark,
  onToggleTheme,
  onExportWorkspaceBackup,
  onImportWorkspaceBackup,
  onReturnToStudio,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [testingModel, setTestingModel] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return apiConfig.availableModels;
    return apiConfig.availableModels.filter((id) => id.toLowerCase().includes(q));
  }, [apiConfig.availableModels, modelSearch]);

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setFetchStatus(null);
    try {
      const models = await fetchCompatibleModels(apiConfig.baseUrl, apiConfig.apiKey);
      onUpdateApiConfig({
        availableModels: models,
        selectedModel:
          apiConfig.selectedModel && models.includes(apiConfig.selectedModel)
            ? apiConfig.selectedModel
            : models[0] || apiConfig.selectedModel,
      });
      setFetchStatus({
        type: 'success',
        message: `Fetched ${models.length} models from endpoint.`,
      });
    } catch (err) {
      setFetchStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to fetch models.',
      });
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestModel = async () => {
    setTestingModel(true);
    setTestStatus(null);
    try {
      const reply = await testCompatibleModel(apiConfig);
      setTestStatus({
        type: 'success',
        message: `Verified (${apiConfig.selectedModel}): "${reply}"`,
      });
    } catch (err) {
      setTestStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Model test failed.',
      });
    } finally {
      setTestingModel(false);
    }
  };

  const handleBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportWorkspaceBackup(text);
      setBackupNotice(res.ok ? 'Workspace restored successfully.' : res.error || 'Import failed.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-14 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            OpenAI-Compatible Endpoint &amp; Offline PWA Preferences
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
            API Setup &amp; Workspace
          </h1>
        </div>
        <button
          type="button"
          onClick={onReturnToStudio}
          className="inline-flex items-center justify-center min-h-[42px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 px-4 py-2 text-sm font-medium hover:opacity-90 cursor-pointer shrink-0"
        >
          Back to Studio
        </button>
      </div>

      {/* Section 1: OpenAI-Compatible Connection */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            01. Connect an OpenAI-Compatible API
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Connect directly from your browser to OpenRouter, OpenAI, DeepSeek, Groq, Ollama, LM Studio, or any custom `/v1` server. Credentials remain strictly on your device.
          </p>
        </div>

        {/* Provider Quick Presets */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            Quick Endpoint Presets
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {PROVIDER_PRESETS.map((provider) => {
              const selected = apiConfig.baseUrl.replace(/\/+$/, '') === provider.baseUrl;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => {
                    onUpdateApiConfig({ baseUrl: provider.baseUrl });
                    setFetchStatus(null);
                  }}
                  className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-medium text-center transition-colors cursor-pointer ${
                    selected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#161922] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {provider.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Base URL + Key */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="api-base-url"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
            >
              API Base URL (ends with /v1)
            </label>
            <input
              id="api-base-url"
              type="url"
              value={apiConfig.baseUrl}
              onChange={(e) => onUpdateApiConfig({ baseUrl: e.target.value })}
              placeholder="https://openrouter.ai/api/v1"
              className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 font-mono text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="api-key-input"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
            >
              API Key / Bearer Token (optional for local Ollama or LM Studio)
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiConfig.apiKey}
                onChange={(e) => onUpdateApiConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] pl-3.5 pr-11 py-2 font-mono text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={apiConfig.rememberKey}
              onChange={(e) => onUpdateApiConfig({ rememberKey: e.target.checked })}
              className="rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
            />
            <span>Remember API key in this browser (unchecked keeps key in memory for this session only)</span>
          </label>

          <button
            type="button"
            disabled={fetchingModels || !apiConfig.baseUrl.trim()}
            onClick={() => void handleFetchModels()}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-45 transition-colors cursor-pointer shrink-0"
          >
            {fetchingModels ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{fetchingModels ? 'Fetching Models...' : 'Fetch Models'}</span>
          </button>
        </div>

        {fetchStatus && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm ${
              fetchStatus.type === 'success'
                ? 'border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                : 'border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
            }`}
          >
            {fetchStatus.message}
          </div>
        )}

        {/* Model Selection */}
        <div className="pt-5 border-t border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex-1">
              <label
                htmlFor="manual-model-id"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
              >
                Active Model ID ({apiConfig.availableModels.length} fetched)
              </label>
              <input
                id="manual-model-id"
                type="text"
                value={apiConfig.selectedModel}
                onChange={(e) => onUpdateApiConfig({ selectedModel: e.target.value })}
                placeholder="Fetch models above or type a model ID (e.g., deepseek/deepseek-chat)"
                className="w-full min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2 font-mono text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              disabled={testingModel || !apiConfig.selectedModel.trim()}
              onClick={() => void handleTestModel()}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161922] px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 disabled:opacity-45 cursor-pointer shrink-0"
            >
              {testingModel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>Test Model</span>
            </button>
          </div>

          {testStatus && (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
                testStatus.type === 'success'
                  ? 'border-emerald-200 dark:border-emerald-900/70 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                  : 'border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
              }`}
            >
              {testStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{testStatus.message}</span>
            </div>
          )}

          {apiConfig.availableModels.length > 0 && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search fetched models..."
                  className="w-full min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0D0F14] pl-10 pr-4 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                {filteredModels.slice(0, 120).map((modelId) => {
                  const isSelected = apiConfig.selectedModel === modelId;
                  return (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => onUpdateApiConfig({ selectedModel: modelId })}
                      className={`w-full min-h-[40px] flex items-center justify-between gap-3 px-3.5 py-2 text-left font-mono text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : 'bg-white dark:bg-[#0D0F14] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-[#161922]'
                      }`}
                    >
                      <span className="truncate">{modelId}</span>
                      {isSelected && <span className="text-[11px] shrink-0">Active</span>}
                    </button>
                  );
                })}
                {filteredModels.length === 0 && (
                  <p className="p-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                    No fetched models match &ldquo;{modelSearch}&rdquo;.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Generation Tuning */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 space-y-5">
        <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          02. Co-Writer Tuning
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="temp-slider" className="font-medium text-zinc-600 dark:text-zinc-400">
                Temperature (Creativity)
              </label>
              <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                {apiConfig.temperature.toFixed(2)}
              </span>
            </div>
            <input
              id="temp-slider"
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={apiConfig.temperature}
              onChange={(e) => onUpdateApiConfig({ temperature: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label htmlFor="max-tokens-slider" className="font-medium text-zinc-600 dark:text-zinc-400">
                Max Output Tokens per Step
              </label>
              <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                {apiConfig.maxTokens}
              </span>
            </div>
            <input
              id="max-tokens-slider"
              type="range"
              min={150}
              max={1600}
              step={50}
              value={apiConfig.maxTokens}
              onChange={(e) => onUpdateApiConfig({ maxTokens: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="global-style-prompt"
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5"
          >
            Optional Global Creator Style Notes (included on every step request)
          </label>
          <textarea
            id="global-style-prompt"
            rows={3}
            value={apiConfig.globalStylePrompt}
            onChange={(e) => onUpdateApiConfig({ globalStylePrompt: e.target.value })}
            placeholder="Example: Favor grounded, understated literary prose. Avoid purple prose, melodrama, or controlling {{user}}."
            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-y"
          />
        </div>
      </section>

      {/* Section 3: PWA Install, Appearance & Local Backup */}
      <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 space-y-5">
        <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          03. Offline App &amp; Data
        </h2>

        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-200/80 dark:border-zinc-800/80">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Install Dramatis as a Standalone App
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              All custom creator presets and character drafts are stored locally on your device for offline writing.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <PWAInstallButton variant="prominent" />
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Backup &amp; Restore Local Studio
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Export all custom presets and character drafts to a single JSON file, or restore on another device.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleBackupFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={onExportWorkspaceBackup}
              className="inline-flex items-center gap-2 min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Backup</span>
            </button>
            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="inline-flex items-center gap-2 min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restore Backup</span>
            </button>
          </div>
        </div>

        {backupNotice && (
          <p className="text-xs text-blue-600 dark:text-blue-400">{backupNotice}</p>
        )}
      </section>
    </div>
  );
};
