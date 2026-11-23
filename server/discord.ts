import type { CreatorPreset } from '../src/types';

export interface DiscordUserProfile {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export function getDiscordEnv() {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim() || '';
  const adminDiscordId = process.env.ADMIN_DISCORD_ID?.trim() || '';
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim() || '';
  return {
    clientId,
    clientSecret,
    adminDiscordId,
    webhookUrl,
    oauthConfigured: Boolean(clientId && clientSecret),
    webhookConfigured: isValidDiscordWebhookUrl(webhookUrl),
  };
}

export function isValidDiscordWebhookUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

export function buildDiscordAvatarUrl(profile: DiscordUserProfile): string {
  if (profile.avatar) {
    return `https://cdn.discordapp.com/avatars/${encodeURIComponent(profile.id)}/${encodeURIComponent(profile.avatar)}.png?size=128`;
  }
  const fallbackIndex = Number(BigInt(profile.id || '0') >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${Math.abs(fallbackIndex)}.png`;
}

export async function exchangeDiscordCode(params: {
  code: string;
  redirectUri: string;
}): Promise<DiscordUserProfile> {
  const { clientId, clientSecret } = getDiscordEnv();
  if (!clientId || !clientSecret) {
    throw new Error('Discord OAuth is not configured on the server.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Discord token exchange failed (HTTP ${tokenRes.status}).`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('Discord did not return an access token.');
  }

  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userRes.ok) {
    throw new Error(`Discord profile lookup failed (HTTP ${userRes.status}).`);
  }

  return (await userRes.json()) as DiscordUserProfile;
}

function clampText(value: string, maxLen: number): string {
  const clean = value.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

export async function sendSubmissionWebhook(params: {
  preset: CreatorPreset;
  applicantDiscordId: string;
  applicantUsername: string;
  verificationCode: string;
  appUrl: string;
  isResubmission?: boolean;
}): Promise<boolean> {
  const { webhookUrl, adminDiscordId } = getDiscordEnv();
  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    return false;
  }

  const safeProfileUrl =
    params.preset.authorUrl &&
    (params.preset.authorUrl.startsWith('https://') ||
      params.preset.authorUrl.startsWith('http://'))
      ? params.preset.authorUrl
      : 'Not provided';

  const mentionPrefix = adminDiscordId ? `<@${adminDiscordId}> ` : '';
  const heading = params.isResubmission
    ? `${mentionPrefix}Updated public template waiting for review on **Dramatis**`
    : `${mentionPrefix}New public template application on **Dramatis**`;

  const payload = {
    username: 'Dramatis',
    content: heading,
    allowed_mentions: {
      parse: [] as string[],
      users: adminDiscordId ? [adminDiscordId] : [],
    },
    embeds: [
      {
        title: clampText(params.preset.name || 'Untitled Preset', 180),
        description: clampText(
          params.preset.description || 'No description provided.',
          350
        ),
        color: 0x2563eb,
        fields: [
          {
            name: 'Creator Handle',
            value: clampText(params.preset.author || params.applicantUsername, 80),
            inline: true,
          },
          {
            name: 'Theme & Format',
            value: `${clampText(params.preset.theme || 'General RP', 48)} · ${params.preset.formatStyle.toUpperCase()} (${params.preset.fields.length} steps)`,
            inline: true,
          },
          {
            name: 'Verification Code',
            value: `\`${params.verificationCode}\``,
            inline: true,
          },
          {
            name: 'Discord Applicant',
            value: `@${clampText(params.applicantUsername, 64)} (\`${params.applicantDiscordId}\`)`,
            inline: true,
          },
          {
            name: 'Creator Profile URL',
            value: clampText(safeProfileUrl, 240),
            inline: false,
          },
          ...(params.appUrl
            ? [
                {
                  name: 'Review Queue',
                  value: `[Open Dramatis Presets](${params.appUrl})`,
                  inline: false,
                },
              ]
            : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send Discord webhook notification:', err);
    return false;
  }
}
