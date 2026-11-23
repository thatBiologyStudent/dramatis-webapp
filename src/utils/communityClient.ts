import type { CreatorPreset, DiscordUser, ServerCommunityStatus } from '../types';

// Held strictly in JS memory (never written to localStorage/sessionStorage)
let memoryAuthToken: string | null = null;

export function setMemoryAuthToken(token: string | null): void {
  memoryAuthToken = token;
}

export function generateClientVerificationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `DRAMATIS-${code}`;
}

function buildApiHeaders(includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'Dramatis',
  };
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (memoryAuthToken) {
    headers['Authorization'] = `Bearer ${memoryAuthToken}`;
  }
  return headers;
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`Request failed (HTTP ${res.status})`);
      }
      throw new Error('Unexpected response format from server.');
    }
  }
  if (!res.ok) {
    const errMsg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (HTTP ${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export async function fetchServerStatus(): Promise<ServerCommunityStatus> {
  const res = await fetch('/api/config/status', {
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
  return parseApiResponse<ServerCommunityStatus>(res);
}

export async function fetchCurrentDiscordUser(): Promise<DiscordUser | null> {
  const res = await fetch('/api/auth/me', {
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
  const data = await parseApiResponse<{ user: DiscordUser | null }>(res);
  return data.user ?? null;
}

export async function requestDiscordAuthUrl(): Promise<{ url: string; redirectUri: string }> {
  const res = await fetch('/api/auth/discord/url', {
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
  return parseApiResponse<{ url: string; redirectUri: string }>(res);
}

export async function logoutDiscordSession(): Promise<void> {
  setMemoryAuthToken(null);
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
}

export async function fetchPublicCommunityPresets(): Promise<CreatorPreset[]> {
  const res = await fetch('/api/presets/public', {
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
  const data = await parseApiResponse<{ presets: CreatorPreset[] }>(res);
  return Array.isArray(data.presets) ? data.presets : [];
}

export async function fetchMyCommunitySubmissions(): Promise<CreatorPreset[]> {
  const res = await fetch('/api/presets/mine', {
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
  const data = await parseApiResponse<{ presets: CreatorPreset[] }>(res);
  return Array.isArray(data.presets) ? data.presets : [];
}

export async function fetchAdminReviewQueue(): Promise<CreatorPreset[]> {
  const res = await fetch('/api/presets/pending', {
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
  const data = await parseApiResponse<{ presets: CreatorPreset[] }>(res);
  return Array.isArray(data.presets) ? data.presets : [];
}

export async function submitPublicPresetApi(
  preset: CreatorPreset,
  verificationCode: string
): Promise<{ preset: CreatorPreset; autoApproved: boolean; webhookNotified: boolean }> {
  const res = await fetch('/api/presets/submit', {
    method: 'POST',
    credentials: 'include',
    headers: buildApiHeaders(true),
    body: JSON.stringify({ preset, verificationCode }),
  });
  return parseApiResponse<{ preset: CreatorPreset; autoApproved: boolean; webhookNotified: boolean }>(res);
}

export async function updateCommunityPresetApi(
  presetId: string,
  preset: CreatorPreset
): Promise<CreatorPreset> {
  const res = await fetch(`/api/presets/${encodeURIComponent(presetId)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildApiHeaders(true),
    body: JSON.stringify({ preset }),
  });
  const data = await parseApiResponse<{ preset: CreatorPreset }>(res);
  return data.preset;
}

export async function deleteCommunityPresetApi(presetId: string): Promise<void> {
  const res = await fetch(`/api/presets/${encodeURIComponent(presetId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: buildApiHeaders(false),
  });
  await parseApiResponse<{ ok: boolean }>(res);
}

export async function reviewCommunityPresetApi(
  presetId: string,
  decision: 'approved' | 'rejected',
  options: { reviewNote?: string; grantVerifiedCreator?: boolean }
): Promise<CreatorPreset | null> {
  const res = await fetch(`/api/presets/${encodeURIComponent(presetId)}/review`, {
    method: 'POST',
    credentials: 'include',
    headers: buildApiHeaders(true),
    body: JSON.stringify({
      decision,
      reviewNote: options.reviewNote || '',
      grantVerifiedCreator: Boolean(options.grantVerifiedCreator),
    }),
  });
  const data = await parseApiResponse<{ preset: CreatorPreset | null }>(res);
  return data.preset;
}
