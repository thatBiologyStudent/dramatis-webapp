import crypto from 'node:crypto';
import type { Request, Response } from 'express';

export interface SessionPayload {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  exp: number;
}

const SESSION_COOKIE_NAME = 'dramatis_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const STATE_TTL_SECONDS = 60 * 10; // 10 minutes

// Ephemeral in-memory fallback when SESSION_SECRET is unset (never written to disk)
const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_SECRET;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const padded = input.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signString(data: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', getSigningSecret()).update(data).digest()
  );
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createSessionToken(user: Omit<SessionPayload, 'exp'>): string {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = signString(encoded);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = signString(encoded);
  if (!safeEqual(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createOAuthState(): string {
  const payload = {
    n: crypto.randomBytes(12).toString('hex'),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${signString(encoded)}`;
}

export function verifyOAuthState(state: string | undefined | null): boolean {
  if (!state || typeof state !== 'string') return false;
  const parts = state.split('.');
  if (parts.length !== 2) return false;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return false;
  if (!safeEqual(sig, signString(encoded))) return false;

  try {
    const parsed = JSON.parse(base64UrlDecode(encoded)) as { exp?: number };
    return typeof parsed.exp === 'number' && parsed.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function extractSessionFromRequest(req: Request): {
  session: SessionPayload | null;
  viaCookie: boolean;
} {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const session = verifySessionToken(token);
    if (session) return { session, viaCookie: false };
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  const session = verifySessionToken(cookieToken);
  return { session, viaCookie: Boolean(session) };
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    Boolean(process.env.APP_URL?.startsWith('https://')) ||
    Boolean(process.env.VERCEL);

  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    Boolean(process.env.APP_URL?.startsWith('https://')) ||
    Boolean(process.env.VERCEL);

  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (isHttps) {
    parts.push('Secure', 'Partitioned');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function isAdminDiscordId(discordId: string | undefined | null): boolean {
  const adminId = process.env.ADMIN_DISCORD_ID?.trim();
  if (!adminId || !discordId) return false;
  return safeEqual(discordId.trim(), adminId);
}
