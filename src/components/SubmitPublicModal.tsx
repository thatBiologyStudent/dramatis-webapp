import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Globe, Loader2, ShieldCheck, X } from 'lucide-react';
import type { CreatorPreset, DiscordUser } from '../types';
import { generateClientVerificationCode } from '../utils/communityClient';
import { CreatorAvatarPicker } from './AvatarFrame';

/** Last-used public creator details, so repeat publishers don't retype them. */
const CREATOR_PROFILE_KEY = 'dramatis_creator_profile';

interface SavedCreatorProfile {
  author?: string;
  authorPlatform?: string;
  authorUrl?: string;
  authorAvatar?: string;
}

function loadCreatorProfile(): SavedCreatorProfile {
  try {
    const raw = localStorage.getItem(CREATOR_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as SavedCreatorProfile) : {};
  } catch {
    return {};
  }
}

function saveCreatorProfile(profile: SavedCreatorProfile) {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // storage full or blocked: not important
  }
}

interface SubmitPublicModalProps {
  preset: CreatorPreset;
  discordUser: DiscordUser | null;
  authLoading: boolean;
  authError: string | null;
  onSignInDiscord: () => void;
  onClose: () => void;
  /** Saves the picture, name and links onto your own copy of the preset as well. */
  onSaveCreatorDetails?: (preset: CreatorPreset) => void;
  onSubmit: (
    preset: CreatorPreset,
    verificationCode: string
  ) => Promise<{ preset: CreatorPreset; autoApproved: boolean; webhookNotified: boolean }>;
}

export const DiscordMark: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export const SubmitPublicModal: React.FC<SubmitPublicModalProps> = ({
  preset,
  discordUser,
  authLoading,
  authError,
  onSignInDiscord,
  onClose,
  onSubmit,
  onSaveCreatorDetails,
}) => {
  const [saved] = useState(loadCreatorProfile);
  const presetAuthor = preset.author && preset.author !== 'Custom Creator' ? preset.author : '';
  const [authorName, setAuthorName] = useState(
    presetAuthor || saved.author || discordUser?.displayName || ''
  );
  const [authorPlatform, setAuthorPlatform] = useState(
    preset.authorPlatform || saved.authorPlatform || 'Wyvern'
  );
  const [authorUrl, setAuthorUrl] = useState(preset.authorUrl || saved.authorUrl || '');
  const [authorAvatar, setAuthorAvatar] = useState(preset.authorAvatar || saved.authorAvatar || '');
  const [verificationCode] = useState(() => generateClientVerificationCode());
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmOwned, setConfirmOwned] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ autoApproved: boolean; webhookNotified: boolean } | null>(
    null
  );

  useEffect(() => {
    if (discordUser && !authorName.trim()) {
      setAuthorName(discordUser.displayName);
    }
  }, [discordUser, authorName]);

  // Keep your own copy of the preset in sync with the details entered here,
  // so the picture and links stick even if you never finish publishing.
  const saveDetailsRef = useRef(onSaveCreatorDetails);
  saveDetailsRef.current = onSaveCreatorDetails;
  useEffect(() => {
    const next = {
      author: authorName.trim() || preset.author,
      authorPlatform: authorPlatform.trim() || undefined,
      authorUrl: authorUrl.trim() || undefined,
      authorAvatar: authorAvatar || preset.authorAvatar,
    };
    const changed =
      next.author !== preset.author ||
      next.authorPlatform !== preset.authorPlatform ||
      next.authorUrl !== preset.authorUrl ||
      next.authorAvatar !== preset.authorAvatar;
    if (changed) saveDetailsRef.current?.({ ...preset, ...next });
  }, [preset, authorName, authorPlatform, authorUrl, authorAvatar]);

  const isAutoVerified = Boolean(discordUser?.isAdmin || discordUser?.isVerifiedCreator);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(verificationCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleConfirmSubmit = async () => {
    setError(null);
    if (!discordUser) {
      setError('Sign in with Discord first.');
      return;
    }
    if (!confirmOwned) {
      setError('Confirm that this is your own template or that you have permission to publish it.');
      return;
    }
    if (!isAutoVerified && !authorUrl.trim()) {
      setError('Add your creator profile URL (e.g., Wyvern or Chub) so your verification code can be checked.');
      return;
    }
    if (authorUrl.trim()) {
      try {
        const parsed = new URL(authorUrl.trim());
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          setError('Profile URL must start with https:// or http://.');
          return;
        }
      } catch {
        setError('Enter a valid creator profile URL (e.g. https://app.wyvern.chat/profiles/...).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const enriched: CreatorPreset = {
        ...preset,
        author: authorName.trim() || discordUser.displayName,
        authorPlatform: authorPlatform.trim() || undefined,
        authorUrl: authorUrl.trim() || undefined,
        authorAvatar: authorAvatar || discordUser.avatarUrl,
      };
      const res = await onSubmit(enriched, verificationCode);
      saveCreatorProfile({
        author: enriched.author,
        authorPlatform: enriched.authorPlatform,
        authorUrl: enriched.authorUrl,
        authorAvatar: authorAvatar || undefined,
      });
      setResult({
        autoApproved: res.autoApproved,
        webhookNotified: res.webhookNotified,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit template.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Publish Preset"
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Publish Preset
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Share <strong className="text-zinc-800 dark:text-zinc-200">{preset.name}</strong> permanently with all Dramatis users. Your Discord account links it to you, so only you can edit or remove it later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="space-y-5 py-2">
            <div className="rounded-xl border border-emerald-300/70 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                <Check className="w-4 h-4" />
                <span>
                  {result.autoApproved
                    ? 'Published live for all users!'
                    : 'Submitted for verification!'}
                </span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {result.autoApproved
                  ? 'Your preset is now live in the public Presets directory for everyone. You can edit or remove it anytime while signed in.'
                  : result.webhookNotified
                  ? 'The admin has been notified on Discord. Keep the verification code on your profile until approved—you can track status under My Submissions.'
                  : 'Your preset is queued for admin review. Keep the verification code on your profile until approved—you can track status under My Submissions.'}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Discord Sign-In Gate */}
            {!discordUser ? (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Step 1: Sign in with Discord to publish
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  Discord is only used for publishing: it marks this preset as yours so nobody else can change it. Dramatis only sees your Discord username, ID and avatar, never your email or messages. Everything else in Dramatis works without signing in.
                </p>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={onSignInDiscord}
                  className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-[#5865F2] hover:bg-[#4752C4] px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <DiscordMark className="w-4 h-4" />
                  )}
                  <span>{authLoading ? 'Waiting for Discord…' : 'Sign in with Discord'}</span>
                </button>
                {authError && (
                  <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                    {authError}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-[#0D0F14] px-3.5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={discordUser.avatarUrl}
                    alt={discordUser.displayName}
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {discordUser.displayName}{' '}
                      <span className="font-normal text-zinc-500 dark:text-zinc-400">
                        @{discordUser.username}
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {discordUser.isAdmin
                        ? 'Admin · Publishes immediately'
                        : discordUser.isVerifiedCreator
                        ? 'Verified Creator · Publishes immediately'
                        : 'Verification required for first public submission'}
                    </p>
                  </div>
                </div>
                {isAutoVerified && (
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </div>
            )}

            {/* Ownership Verification Step (skipped for Admin & Verified Creators) */}
            {!isAutoVerified && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 p-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Creator Ownership Verification
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  Paste this one-time code temporarily anywhere in your creator profile bio (e.g., Wyvern, Chub, Carrd) or a bot&apos;s notes so the admin can confirm it&apos;s yours. You can remove it once approved.
                </p>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#0D0F14] px-3 py-2">
                  <code className="font-mono text-sm font-semibold tracking-wider text-blue-700 dark:text-blue-300 select-all">
                    {verificationCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="inline-flex items-center gap-1.5 min-h-[32px] rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:border-blue-500 cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Creator Attribution */}
            <div className="space-y-3.5">
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Public creator details
              </p>
              <CreatorAvatarPicker
                src={authorAvatar || discordUser?.avatarUrl}
                name={authorName || 'Creator'}
                onChange={setAuthorAvatar}
                discordAvatarUrl={discordUser?.avatarUrl}
                hint="Shown next to your presets, like on the built-in ones. Without an upload, your Discord picture is used."
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Creator Handle
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Your creator handle"
                    className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Platform Name (e.g., Wyvern, Chub)
                  </label>
                  <input
                    type="text"
                    value={authorPlatform}
                    onChange={(e) => setAuthorPlatform(e.target.value)}
                    placeholder="Wyvern"
                    className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Creator Profile URL {!isAutoVerified && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="url"
                    value={authorUrl}
                    onChange={(e) => setAuthorUrl(e.target.value)}
                    placeholder="https://app.wyvern.chat/profiles/..."
                    className="w-full min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0D0F14] px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={confirmOwned}
                  onChange={(e) => setConfirmOwned(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600"
                />
                <span>
                  This is my own character/template (or I have explicit permission to publish it) and all character-identifying details have been stripped.
                </span>
              </label>
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!discordUser || submitting}
                onClick={() => void handleConfirmSubmit()}
                className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>{isAutoVerified ? 'Publish Publicly' : 'Submit for Review'}</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
