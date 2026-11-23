import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { CardSlot, CreatorPreset, FieldType, OutputFormat, PresetField } from '../src/types';
import {
  clearSessionCookie,
  createOAuthState,
  createSessionToken,
  extractSessionFromRequest,
  isAdminDiscordId,
  setSessionCookie,
  verifyOAuthState,
  type SessionPayload,
} from './auth.js';
import {
  createCommunityPreset,
  deleteCommunityPreset,
  getCommunityPresetById,
  getDatabaseMode,
  isVerifiedCreator,
  listApprovedPresets,
  listPendingAndRejectedPresets,
  listPresetsByOwner,
  setVerifiedCreator,
  updateCommunityPreset,
  type StoredCommunityPreset,
} from './db.js';
import {
  buildDiscordAvatarUrl,
  exchangeDiscordCode,
  getDiscordEnv,
  sendSubmissionWebhook,
} from './discord.js';

interface AuthedRequest extends Request {
  user?: SessionPayload & { isAdmin: boolean };
}

const VALID_FIELD_TYPES = new Set<FieldType>([
  'short_text',
  'long_text',
  'traits',
  'dialogue',
  'list',
]);

const VALID_MAPPINGS = new Set<CardSlot>([
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'character_note',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
  'alternate_greetings',
  'tags',
  'custom',
]);

const VALID_FORMATS = new Set<OutputFormat>([
  'bracketed',
  'markdown',
  'plist',
  'wpp',
  'plain',
]);

function clampStr(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function sanitizeOptionalUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    // ignore invalid URL
  }
  return undefined;
}

function sanitizeOptionalAvatar(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const val = raw.trim();
  // Cap data URI thumbnails to ~450KB to keep DB lean
  if (val.startsWith('data:image/') && val.length <= 450_000) {
    return val;
  }
  if (val.startsWith('/assets/') && val.length <= 300) {
    return val;
  }
  return sanitizeOptionalUrl(val);
}

function sanitizePresetPayload(
  raw: unknown,
  presetId: string,
  fallbackAuthor: string
): { preset?: CreatorPreset; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Preset payload must be an object.' };
  }
  const obj = raw as Record<string, unknown>;
  const name = clampStr(obj.name, 120);
  if (!name) {
    return { error: 'Preset name is required.' };
  }
  if (!Array.isArray(obj.fields) || obj.fields.length === 0) {
    return { error: 'Preset must include at least one step field.' };
  }
  if (obj.fields.length > 40) {
    return { error: 'Preset cannot exceed 40 steps.' };
  }

  const sanitizedFields: PresetField[] = obj.fields.map((item, idx) => {
    const f = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const label = clampStr(f.label, 80) || `Step ${idx + 1}`;
    const key =
      clampStr(f.key, 64) ||
      label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') ||
      `step_${idx + 1}`;

    const fieldType = VALID_FIELD_TYPES.has(String(f.fieldType) as FieldType)
      ? (String(f.fieldType) as FieldType)
      : 'long_text';
    const cardMapping = VALID_MAPPINGS.has(String(f.cardMapping) as CardSlot)
      ? (String(f.cardMapping) as CardSlot)
      : 'description';

    const rawTokens = typeof f.tokenTarget === 'number' ? Math.round(f.tokenTarget) : 150;
    const tokenTarget = Math.min(2000, Math.max(20, Number.isFinite(rawTokens) ? rawTokens : 150));

    return {
      id: clampStr(f.id, 80) || `field-${idx + 1}-${crypto.randomBytes(3).toString('hex')}`,
      key,
      label,
      stage: clampStr(f.stage, 48) || 'Character',
      fieldType,
      cardMapping,
      promptHint: clampStr(f.promptHint, 1200) || `Fill in ${label} for {{char}}.`,
      aiSystemDirective:
        clampStr(f.aiSystemDirective, 1200) ||
        `Write concise, vivid roleplay content for "${label}" using {{char}}.`,
      placeholder: clampStr(f.placeholder, 1200),
      initialTemplate:
        typeof f.initialTemplate === 'string' && f.initialTemplate.length > 0
          ? f.initialTemplate.slice(0, 12000)
          : undefined,
      tokenTarget,
      required: Boolean(f.required),
      bracketInline: Boolean(f.bracketInline),
      rawBlock: Boolean(f.rawBlock),
      fillInTheBlanks: Boolean(f.fillInTheBlanks),
    };
  });

  const formatStyle = VALID_FORMATS.has(String(obj.formatStyle) as OutputFormat)
    ? (String(obj.formatStyle) as OutputFormat)
    : 'bracketed';

  const preset: CreatorPreset = {
    id: presetId,
    name,
    author: clampStr(obj.author, 80) || fallbackAuthor,
    authorAvatar: sanitizeOptionalAvatar(obj.authorAvatar),
    authorUrl: sanitizeOptionalUrl(obj.authorUrl),
    authorPlatform: clampStr(obj.authorPlatform, 40) || undefined,
    theme: clampStr(obj.theme, 60) || 'General RP',
    description: clampStr(obj.description, 500) || 'Community RP character preset layout.',
    formatStyle,
    isBuiltIn: false,
    isCommunity: true,
    updatedAt: new Date().toISOString(),
    fields: sanitizedFields,
  };

  return { preset };
}

function toClientPreset(
  record: StoredCommunityPreset,
  includePrivateMeta: boolean
): CreatorPreset {
  const base: CreatorPreset = {
    ...record.preset,
    id: record.id,
    isBuiltIn: false,
    isCommunity: true,
    communityStatus: record.status,
    ownerDiscordId: record.ownerDiscordId,
    ownerUsername: record.ownerUsername,
    updatedAt: record.updatedAt,
  };
  if (includePrivateMeta) {
    base.verificationCode = record.verificationCode;
    base.reviewNote = record.reviewNote;
  }
  return base;
}

function getBaseAppUrl(req: Request): string {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl && envAppUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envAppUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return envAppUrl.replace(/\/+$/, '');
      }
    } catch {
      // fallback below
    }
  }
  const forwardedHost = req.headers['x-forwarded-host'];
  const rawHost =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.headers.host || '';
  const host = rawHost.split(',')[0].trim();
  const forwardedProto = req.headers['x-forwarded-proto'];
  const rawProto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || req.protocol || 'https';
  const proto = rawProto.split(',')[0].trim().toLowerCase() === 'http' ? 'http' : 'https';
  if (host && /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(host)) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, '')}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

function generateVerificationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `DRAMATIS-${code}`;
}

function safeJsonForInlineScript(data: unknown): string {
  return JSON.stringify(data)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const { session, viaCookie } = extractSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Sign in with Discord first.' });
    return;
  }
  // CSRF check on cookie-authenticated mutations
  if (viaCookie && req.method !== 'GET' && req.method !== 'HEAD') {
    const xrw = req.headers['x-requested-with'];
    if (xrw !== 'Dramatis') {
      res.status(403).json({ error: 'Missing required request header.' });
      return;
    }
  }
  req.user = {
    ...session,
    isAdmin: isAdminDiscordId(session.id),
  };
  next();
}

export function createApiApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  // Non-secret server capabilities status
  app.get('/api/config/status', (_req, res) => {
    const discord = getDiscordEnv();
    res.json({
      discordAuthConfigured: discord.oauthConfigured,
      webhookConfigured: discord.webhookConfigured,
      databaseMode: getDatabaseMode(),
    });
  });

  // Discord OAuth Step 1: Return provider authorize URL (opened directly in popup)
  app.get('/api/auth/discord/url', (req, res) => {
    const { clientId, oauthConfigured } = getDiscordEnv();
    if (!oauthConfigured) {
      res.status(503).json({
        error:
          'Discord sign-in is not configured yet. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in your server environment variables.',
      });
      return;
    }

    const baseUrl = getBaseAppUrl(req);
    const redirectUri = `${baseUrl}/api/auth/discord/callback`;
    const state = createOAuthState();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
      prompt: 'none',
    });

    res.json({
      url: `https://discord.com/api/oauth2/authorize?${params.toString()}`,
      redirectUri,
    });
  });

  // Discord OAuth Step 2: Callback (supports with/without trailing slash)
  const handleDiscordCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    const sendPopupResult = (payload: Record<string, unknown>, status = 200) => {
      const serialized = safeJsonForInlineScript(payload);
      // Only hand the session token to Dramatis itself, never to another opener origin.
      const appBase = getBaseAppUrl(req);
      const appOrigin = safeJsonForInlineScript(new URL(appBase).origin);
      const appHome = safeJsonForInlineScript(appBase + '/');
      res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Dramatis Discord Sign-In</title></head>
  <body style="font-family:system-ui,sans-serif;background:#090A0D;color:#F1F3F5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
    <div>
      <p style="font-size:15px;margin:0 0 8px;">${payload.type === 'OAUTH_AUTH_SUCCESS' ? 'Signed in with Discord.' : 'Could not complete Discord sign-in.'}</p>
      <p style="font-size:12px;color:#9CA3AF;margin:0;">This window will close automatically.</p>
    </div>
    <script>
      (function () {
        var data = ${serialized};
        if (window.opener) {
          window.opener.postMessage(data, ${appOrigin});
          window.close();
        } else {
          window.location.href = ${appHome};
        }
      })();
    </script>
  </body>
</html>`);
    };

    if (oauthError) {
      sendPopupResult({ type: 'OAUTH_AUTH_ERROR', error: 'Discord authorization was canceled.' }, 400);
      return;
    }

    if (!code || !verifyOAuthState(state)) {
      sendPopupResult({ type: 'OAUTH_AUTH_ERROR', error: 'Invalid or expired OAuth state.' }, 400);
      return;
    }

    try {
      const baseUrl = getBaseAppUrl(req);
      const redirectUri = `${baseUrl}/api/auth/discord/callback`;
      const profile = await exchangeDiscordCode({ code, redirectUri });

      const userPayload = {
        id: profile.id,
        username: profile.username,
        displayName: profile.global_name?.trim() || profile.username,
        avatarUrl: buildDiscordAvatarUrl(profile),
      };

      const token = createSessionToken(userPayload);
      setSessionCookie(req, res, token);

      const isAdmin = isAdminDiscordId(profile.id);
      const verified = isAdmin || (await isVerifiedCreator(profile.id));

      sendPopupResult({
        type: 'OAUTH_AUTH_SUCCESS',
        token,
        user: {
          ...userPayload,
          isAdmin,
          isVerifiedCreator: verified,
        },
      });
    } catch (err) {
      console.error('Discord OAuth callback error:', err);
      sendPopupResult(
        {
          type: 'OAUTH_AUTH_ERROR',
          error: err instanceof Error ? err.message : 'Discord sign-in failed.',
        },
        500
      );
    }
  };

  app.get(['/api/auth/discord/callback', '/api/auth/discord/callback/'], handleDiscordCallback);

  // Current signed-in user
  app.get('/api/auth/me', async (req, res) => {
    const { session } = extractSessionFromRequest(req);
    if (!session) {
      res.json({ user: null });
      return;
    }
    const isAdmin = isAdminDiscordId(session.id);
    const verified = isAdmin || (await isVerifiedCreator(session.id));
    res.json({
      user: {
        id: session.id,
        username: session.username,
        displayName: session.displayName,
        avatarUrl: session.avatarUrl,
        isAdmin,
        isVerifiedCreator: verified,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { viaCookie } = extractSessionFromRequest(req);
    if (viaCookie && req.headers['x-requested-with'] !== 'Dramatis') {
      res.status(403).json({ error: 'Missing required request header.' });
      return;
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // Public approved community presets (visible to all users)
  app.get('/api/presets/public', async (_req, res) => {
    try {
      const rows = await listApprovedPresets();
      res.json({
        presets: rows.map((row) => toClientPreset(row, false)),
      });
    } catch (err) {
      console.error('Error loading public presets:', err);
      res.status(500).json({ error: 'Could not load public presets.' });
    }
  });

  // Logged-in creator's own submissions (pending / approved / rejected)
  app.get('/api/presets/mine', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const rows = await listPresetsByOwner(req.user!.id);
      res.json({
        presets: rows.map((row) => toClientPreset(row, true)),
      });
    } catch (err) {
      console.error('Error loading user submissions:', err);
      res.status(500).json({ error: 'Could not load your submissions.' });
    }
  });

  // Admin-only review queue
  app.get('/api/presets/pending', requireAuth, async (req: AuthedRequest, res) => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    try {
      const rows = await listPendingAndRejectedPresets();
      res.json({
        presets: rows.map((row) => toClientPreset(row, true)),
      });
    } catch (err) {
      console.error('Error loading review queue:', err);
      res.status(500).json({ error: 'Could not load review queue.' });
    }
  });

  // Submit a preset publicly ("This is my character / Submit Publicly")
  app.post('/api/presets/submit', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.user!;
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const presetId = `preset-community-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

      const { preset, error } = sanitizePresetPayload(body.preset, presetId, user.displayName);
      if (error || !preset) {
        res.status(400).json({ error: error || 'Invalid preset.' });
        return;
      }

      const rawCode = clampStr(body.verificationCode, 32).toUpperCase();
      const verificationCode = /^DRAMATIS-[A-Z0-9]{4,12}$/.test(rawCode)
        ? rawCode
        : generateVerificationCode();

      const creatorVerified = user.isAdmin || (await isVerifiedCreator(user.id));
      const status = creatorVerified ? 'approved' : 'pending';

      const created = await createCommunityPreset({
        id: presetId,
        ownerDiscordId: user.id,
        ownerUsername: user.username,
        status,
        verificationCode,
        reviewNote: '',
        preset,
      });

      let webhookNotified = false;
      if (status === 'pending') {
        webhookNotified = await sendSubmissionWebhook({
          preset: created.preset,
          applicantDiscordId: user.id,
          applicantUsername: user.username,
          verificationCode,
          appUrl: getBaseAppUrl(req),
        });
      }

      res.status(201).json({
        preset: toClientPreset(created, true),
        autoApproved: status === 'approved',
        webhookNotified,
      });
    } catch (err) {
      console.error('Error submitting public preset:', err);
      res.status(500).json({ error: 'Failed to submit preset.' });
    }
  });

  // Edit an existing community preset (owner or admin only)
  app.put('/api/presets/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.user!;
      const id = clampStr(req.params.id, 120);
      if (!id) {
        res.status(400).json({ error: 'Invalid preset ID.' });
        return;
      }

      const existing = await getCommunityPresetById(id);
      if (!existing) {
        res.status(404).json({ error: 'Community preset not found.' });
        return;
      }

      if (existing.ownerDiscordId !== user.id && !user.isAdmin) {
        res.status(403).json({ error: 'Only the creator or admin can edit this preset.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const { preset, error } = sanitizePresetPayload(body.preset, id, existing.preset.author);
      if (error || !preset) {
        res.status(400).json({ error: error || 'Invalid preset update.' });
        return;
      }

      // If a non-admin edits a previously rejected preset, put it back into pending review
      const nextStatus =
        !user.isAdmin && existing.status === 'rejected' ? 'pending' : existing.status;

      const updated = await updateCommunityPreset(id, {
        preset,
        status: nextStatus,
        reviewNote: nextStatus === 'pending' ? '' : existing.reviewNote,
      });

      if (!updated) {
        res.status(404).json({ error: 'Community preset not found.' });
        return;
      }

      if (!user.isAdmin && existing.status === 'rejected' && nextStatus === 'pending') {
        await sendSubmissionWebhook({
          preset: updated.preset,
          applicantDiscordId: user.id,
          applicantUsername: user.username,
          verificationCode: updated.verificationCode,
          appUrl: getBaseAppUrl(req),
          isResubmission: true,
        });
      }

      res.json({
        preset: toClientPreset(updated, true),
      });
    } catch (err) {
      console.error('Error updating community preset:', err);
      res.status(500).json({ error: 'Failed to update preset.' });
    }
  });

  // Delete a community preset (owner or admin only)
  app.delete('/api/presets/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const user = req.user!;
      const id = clampStr(req.params.id, 120);
      const existing = await getCommunityPresetById(id);
      if (!existing) {
        res.status(404).json({ error: 'Community preset not found.' });
        return;
      }
      if (existing.ownerDiscordId !== user.id && !user.isAdmin) {
        res.status(403).json({ error: 'Only the creator or admin can delete this preset.' });
        return;
      }
      await deleteCommunityPreset(id);
      res.json({ ok: true });
    } catch (err) {
      console.error('Error deleting community preset:', err);
      res.status(500).json({ error: 'Failed to delete preset.' });
    }
  });

  // Admin Review: Approve or Reject + optional Trusted/Verified Creator status
  app.post('/api/presets/:id/review', requireAuth, async (req: AuthedRequest, res) => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    try {
      const id = clampStr(req.params.id, 120);
      const existing = await getCommunityPresetById(id);
      if (!existing) {
        res.status(404).json({ error: 'Community preset not found.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null;
      if (!decision) {
        res.status(400).json({ error: 'Decision must be "approved" or "rejected".' });
        return;
      }

      const reviewNote = clampStr(body.reviewNote, 400);
      const grantVerifiedCreator = Boolean(body.grantVerifiedCreator);

      if (decision === 'approved' && grantVerifiedCreator) {
        await setVerifiedCreator(existing.ownerDiscordId, existing.ownerUsername, true);
      }

      const updated = await updateCommunityPreset(id, {
        status: decision,
        reviewNote,
      });

      res.json({
        preset: updated ? toClientPreset(updated, true) : null,
      });
    } catch (err) {
      console.error('Error reviewing community preset:', err);
      res.status(500).json({ error: 'Failed to review preset.' });
    }
  });

  return app;
}
