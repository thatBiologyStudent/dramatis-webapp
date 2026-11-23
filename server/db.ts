import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import type { CreatorPreset } from '../src/types';

export type CommunityPresetStatus = 'pending' | 'approved' | 'rejected';

export interface StoredCommunityPreset {
  id: string;
  ownerDiscordId: string;
  ownerUsername: string;
  status: CommunityPresetStatus;
  verificationCode: string;
  reviewNote: string;
  preset: CreatorPreset;
  createdAt: string;
  updatedAt: string;
}

interface LocalStoreFile {
  presets: StoredCommunityPreset[];
  verifiedCreators: Record<string, { username: string; verifiedAt: string }>;
}

const LOCAL_DATA_DIR = path.resolve(process.cwd(), '.data');
const LOCAL_DATA_FILE = path.resolve(LOCAL_DATA_DIR, 'community-presets.json');

let pool: Pool | null = null;
let schemaInitialized = false;

function getDatabaseUrl(): string | null {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    '';
  return url || null;
}

export function getDatabaseMode(): 'postgres' | 'local' {
  return getDatabaseUrl() ? 'postgres' : 'local';
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.');
    }
    const isLocalHost =
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensurePgSchema(): Promise<void> {
  if (schemaInitialized) return;
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS community_presets (
      id TEXT PRIMARY KEY,
      owner_discord_id TEXT NOT NULL,
      owner_username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      verification_code TEXT NOT NULL DEFAULT '',
      review_note TEXT NOT NULL DEFAULT '',
      preset_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_community_presets_status
    ON community_presets (status, updated_at DESC);
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_community_presets_owner
    ON community_presets (owner_discord_id, updated_at DESC);
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS verified_creators (
      discord_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  schemaInitialized = true;
}

// Local JSON fallback for preview/testing before DATABASE_URL is connected
function readLocalStore(): LocalStoreFile {
  try {
    if (!fs.existsSync(LOCAL_DATA_FILE)) {
      return { presets: [], verifiedCreators: {} };
    }
    const raw = fs.readFileSync(LOCAL_DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalStoreFile>;
    return {
      presets: Array.isArray(parsed.presets) ? parsed.presets : [],
      verifiedCreators:
        parsed.verifiedCreators && typeof parsed.verifiedCreators === 'object'
          ? parsed.verifiedCreators
          : {},
    };
  } catch {
    return { presets: [], verifiedCreators: {} };
  }
}

function writeLocalStore(store: LocalStoreFile): void {
  try {
    if (!fs.existsSync(LOCAL_DATA_DIR)) {
      fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Could not persist local fallback store:', err);
  }
}

function mapPgRow(row: Record<string, unknown>): StoredCommunityPreset {
  const presetObj =
    typeof row.preset_json === 'string'
      ? (JSON.parse(row.preset_json) as CreatorPreset)
      : (row.preset_json as CreatorPreset);

  return {
    id: String(row.id),
    ownerDiscordId: String(row.owner_discord_id),
    ownerUsername: String(row.owner_username),
    status: (row.status as CommunityPresetStatus) || 'pending',
    verificationCode: String(row.verification_code || ''),
    reviewNote: String(row.review_note || ''),
    preset: presetObj,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || new Date().toISOString()),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at || new Date().toISOString()),
  };
}

export async function isVerifiedCreator(discordId: string): Promise<boolean> {
  if (!discordId) return false;
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query(
      'SELECT 1 FROM verified_creators WHERE discord_id = $1 LIMIT 1',
      [discordId]
    );
    return (res.rowCount ?? 0) > 0;
  }
  const store = readLocalStore();
  return Boolean(store.verifiedCreators[discordId]);
}

export async function setVerifiedCreator(
  discordId: string,
  username: string,
  verified: boolean
): Promise<void> {
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    if (verified) {
      await getPool().query(
        `INSERT INTO verified_creators (discord_id, username, verified_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (discord_id) DO UPDATE SET username = EXCLUDED.username`,
        [discordId, username]
      );
    } else {
      await getPool().query('DELETE FROM verified_creators WHERE discord_id = $1', [discordId]);
    }
    return;
  }

  const store = readLocalStore();
  if (verified) {
    store.verifiedCreators[discordId] = { username, verifiedAt: new Date().toISOString() };
  } else {
    delete store.verifiedCreators[discordId];
  }
  writeLocalStore(store);
}

export async function listApprovedPresets(): Promise<StoredCommunityPreset[]> {
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query(
      `SELECT id, owner_discord_id, owner_username, status, verification_code, review_note, preset_json, created_at, updated_at
       FROM community_presets
       WHERE status = 'approved'
       ORDER BY updated_at DESC`
    );
    return res.rows.map((r) => mapPgRow(r as Record<string, unknown>));
  }
  const store = readLocalStore();
  return store.presets
    .filter((p) => p.status === 'approved')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPresetsByOwner(ownerDiscordId: string): Promise<StoredCommunityPreset[]> {
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query(
      `SELECT id, owner_discord_id, owner_username, status, verification_code, review_note, preset_json, created_at, updated_at
       FROM community_presets
       WHERE owner_discord_id = $1
       ORDER BY updated_at DESC`,
      [ownerDiscordId]
    );
    return res.rows.map((r) => mapPgRow(r as Record<string, unknown>));
  }
  const store = readLocalStore();
  return store.presets
    .filter((p) => p.ownerDiscordId === ownerDiscordId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPendingAndRejectedPresets(): Promise<StoredCommunityPreset[]> {
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query(
      `SELECT id, owner_discord_id, owner_username, status, verification_code, review_note, preset_json, created_at, updated_at
       FROM community_presets
       WHERE status IN ('pending', 'rejected')
       ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, updated_at DESC`
    );
    return res.rows.map((r) => mapPgRow(r as Record<string, unknown>));
  }
  const store = readLocalStore();
  return store.presets
    .filter((p) => p.status === 'pending' || p.status === 'rejected')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export async function getCommunityPresetById(id: string): Promise<StoredCommunityPreset | null> {
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query(
      `SELECT id, owner_discord_id, owner_username, status, verification_code, review_note, preset_json, created_at, updated_at
       FROM community_presets
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return mapPgRow(res.rows[0] as Record<string, unknown>);
  }
  const store = readLocalStore();
  return store.presets.find((p) => p.id === id) || null;
}

export async function createCommunityPreset(
  record: Omit<StoredCommunityPreset, 'createdAt' | 'updatedAt'>
): Promise<StoredCommunityPreset> {
  const now = new Date().toISOString();
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query(
      `INSERT INTO community_presets
        (id, owner_discord_id, owner_username, status, verification_code, review_note, preset_json, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW(), NOW())
       RETURNING id, owner_discord_id, owner_username, status, verification_code, review_note, preset_json, created_at, updated_at`,
      [
        record.id,
        record.ownerDiscordId,
        record.ownerUsername,
        record.status,
        record.verificationCode,
        record.reviewNote,
        JSON.stringify(record.preset),
      ]
    );
    return mapPgRow(res.rows[0] as Record<string, unknown>);
  }

  const store = readLocalStore();
  const full: StoredCommunityPreset = {
    ...record,
    createdAt: now,
    updatedAt: now,
  };
  store.presets = [full, ...store.presets.filter((p) => p.id !== record.id)];
  writeLocalStore(store);
  return full;
}

export async function updateCommunityPreset(
  id: string,
  patch: {
    preset?: CreatorPreset;
    status?: CommunityPresetStatus;
    reviewNote?: string;
    verificationCode?: string;
  }
): Promise<StoredCommunityPreset | null> {
  const existing = await getCommunityPresetById(id);
  if (!existing) return null;

  const nextPreset = patch.preset ?? existing.preset;
  const nextStatus = patch.status ?? existing.status;
  const nextNote = patch.reviewNote !== undefined ? patch.reviewNote : existing.reviewNote;
  const nextCode =
    patch.verificationCode !== undefined ? patch.verificationCode : existing.verificationCode;

  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query(
      `UPDATE community_presets
       SET preset_json = $2::jsonb,
           status = $3,
           review_note = $4,
           verification_code = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, owner_discord_id, owner_username, status, verification_code, review_note, preset_json, created_at, updated_at`,
      [id, JSON.stringify(nextPreset), nextStatus, nextNote, nextCode]
    );
    if (res.rows.length === 0) return null;
    return mapPgRow(res.rows[0] as Record<string, unknown>);
  }

  const store = readLocalStore();
  const updated: StoredCommunityPreset = {
    ...existing,
    preset: nextPreset,
    status: nextStatus,
    reviewNote: nextNote,
    verificationCode: nextCode,
    updatedAt: new Date().toISOString(),
  };
  store.presets = store.presets.map((p) => (p.id === id ? updated : p));
  writeLocalStore(store);
  return updated;
}

export async function deleteCommunityPreset(id: string): Promise<boolean> {
  if (getDatabaseUrl()) {
    await ensurePgSchema();
    const res = await getPool().query('DELETE FROM community_presets WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
  const store = readLocalStore();
  const before = store.presets.length;
  store.presets = store.presets.filter((p) => p.id !== id);
  if (store.presets.length !== before) {
    writeLocalStore(store);
    return true;
  }
  return false;
}
