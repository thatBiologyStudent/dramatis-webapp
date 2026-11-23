import type { CharacterDraft, CreatorPreset } from '../types';
import { BASE } from './base';
import { getEffectivePresetFields, interpolateMacros } from './tokens';

/**
 * "Generate with Alembic": opens Alembic Generative Studio in a popup, hands it a
 * portrait request, and receives the picked image back (see Alembic's src/lib/dramatis.ts).
 */

/** Where Alembic lives: next to Dramatis on the same site, or the local dev server. */
export function alembicUrl(): string {
  const configured = import.meta.env.VITE_ALEMBIC_URL as string | undefined;
  if (configured) return configured;
  if (import.meta.env.DEV) return 'http://localhost:5178/';
  return new URL('../alembic/', window.location.origin + BASE).toString();
}

const LOOKS = /appear|look|physic|profile|body|outfit|cloth|hair|face|visual|feature|style/i;

/** Builds a portrait request from the character's name, tagline and appearance steps. */
export function buildPortraitPrompt(character: CharacterDraft, preset: CreatorPreset, aspect = '2:3'): string {
  const name = character.name.trim() || 'the character';
  const fields = getEffectivePresetFields(preset, Boolean(character.includeExtraStandardFields));
  const filled = fields
    .map((f) => ({ f, v: (character.values[f.id] || '').trim() }))
    .filter((x) => x.v);
  const looks = filled.filter((x) => LOOKS.test(`${x.f.label} ${x.f.stage} ${x.f.key}`));
  // One paragraph on purpose: Alembic treats a multi-line request as a batch (one image per line).
  const flat = (t: string) => t.replace(/\s*\n+\s*/g, '; ').replace(/\s{2,}/g, ' ').trim();
  const chosen = (looks.length ? looks : filled.slice(0, 1)).map(
    (x) => `${x.f.label}: ${flat(interpolateMacros(x.v, name))}`
  );
  let details = chosen.join(' | ');
  if (details.length > 2500) details = `${details.slice(0, 2500)}…`;

  const tagline = character.tagline.trim();
  return [
    `Create one character portrait of ${name}${tagline ? `, ${tagline}` : ''}.`,
    details ? `Character details (use what describes the look): ${details}.` : '',
    `Head and upper body, ${aspect} portrait orientation, no text, no watermark.`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Opens Alembic and wires up the handshake. Calls onImage with a data URL when the user
 * picks a picture there. Returns a cleanup function. Throws if the popup was blocked.
 */
export function openAlembicPortrait(
  request: { characterName: string; prompt: string; aspect: string },
  onImage: (dataUrl: string) => void
): () => void {
  const url = new URL(alembicUrl());
  url.searchParams.set('from', 'dramatis');
  const origin = url.origin;
  let win: Window | null = null;

  const onMessage = (e: MessageEvent) => {
    if (e.origin !== origin || !win || e.source !== win) return;
    const d = e.data as Record<string, unknown> | null;
    if (d?.type === 'alembic:ready') {
      win.postMessage({ type: 'dramatis:portrait-request', ...request }, origin);
    } else if (d?.type === 'alembic:portrait' && typeof d.dataUrl === 'string' && d.dataUrl.startsWith('data:image/')) {
      onImage(d.dataUrl);
    }
  };

  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    window.clearInterval(timer);
  };

  window.addEventListener('message', onMessage);
  win = window.open(url.toString(), 'dramatis-alembic', 'popup,width=1280,height=860');
  const timer = window.setInterval(() => {
    if (!win || win.closed) cleanup();
  }, 1000);
  if (!win) {
    cleanup();
    throw new Error('Your browser blocked the Alembic window. Allow pop-ups for this site and try again.');
  }
  win.focus();
  return cleanup;
}
