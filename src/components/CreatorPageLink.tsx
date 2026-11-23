import React from 'react';
import { ExternalLink } from 'lucide-react';

interface CreatorPageLinkProps {
  url?: string;
  platform?: string;
  authorName?: string;
  size?: 'xs' | 'sm';
}

export function getSafeCreatorUrl(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function inferCreatorPlatform(url: string, explicitPlatform?: string): {
  key: 'wyvern' | 'chub' | 'janitor' | 'github' | 'kofi' | 'patreon' | 'generic';
  label: string;
} {
  const custom = explicitPlatform?.trim();
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // ignore
  }

  const normalized = (custom || host).toLowerCase();

  if (normalized.includes('wyvern')) {
    return { key: 'wyvern', label: custom || 'Wyvern' };
  }
  if (normalized.includes('chub')) {
    return { key: 'chub', label: custom || 'Chub' };
  }
  if (normalized.includes('janitor')) {
    return { key: 'janitor', label: custom || 'JanitorAI' };
  }
  if (normalized.includes('github')) {
    return { key: 'github', label: custom || 'GitHub' };
  }
  if (normalized.includes('ko-fi') || normalized.includes('kofi')) {
    return { key: 'kofi', label: custom || 'Ko-fi' };
  }
  if (normalized.includes('patreon')) {
    return { key: 'patreon', label: custom || 'Patreon' };
  }

  if (custom) {
    return { key: 'generic', label: custom };
  }

  const cleanHost = host.replace(/^www\./, '').replace(/^app\./, '');
  const primary = cleanHost.split('.')[0] || 'Web';
  return {
    key: 'generic',
    label: primary.charAt(0).toUpperCase() + primary.slice(1),
  };
}

/**
 * Minimalist geometric Wyvern winged-serpent crest logo mark.
 */
const WyvernLogo: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4 17.5C6.4 16.9 8.2 15.2 9.1 12.9C7.4 12.6 5.9 11.4 5 9.6C7.1 9.8 8.8 9.2 10.2 7.8C8.9 7.1 8 5.9 7.5 4.4C10.4 4.8 12.6 6.2 14.1 8.4C15.6 6.6 17.8 5.4 20.5 5C19.6 7.4 18.2 9.2 16.3 10.4C17.8 10.9 19 12 19.8 13.5C17.7 13.6 15.9 13.2 14.3 12.3C14 14.9 12.8 17.2 10.8 19C9.8 19.9 8.5 20.4 7 20.5C8.3 19.4 9.1 18.2 9.5 16.8C7.8 17.7 6 18 4 17.5Z"
      fill="currentColor"
    />
    <path
      d="M14.2 5.2L16.4 3.5L15.8 6.1"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CreatorPageLink: React.FC<CreatorPageLinkProps> = ({
  url,
  platform,
  authorName,
  size = 'sm',
}) => {
  const safeUrl = getSafeCreatorUrl(url);
  if (!safeUrl) return null;

  const { key, label } = inferCreatorPlatform(safeUrl, platform);

  const sizeClasses =
    size === 'xs'
      ? 'min-h-[28px] px-2.5 py-1 text-[11px] gap-1.5 rounded-lg'
      : 'min-h-[32px] px-3 py-1 text-xs gap-1.5 rounded-lg';

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Visit ${authorName ? `${authorName} ` : ''}on ${label} (opens in new tab)`}
      className={`inline-flex items-center font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161922] text-zinc-700 dark:text-zinc-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 ${sizeClasses}`}
    >
      <span>On {label}</span>
      {key === 'wyvern' ? (
        <WyvernLogo className={size === 'xs' ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'} />
      ) : (
        <ExternalLink className={size === 'xs' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      )}
    </a>
  );
};
