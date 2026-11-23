/**
 * Character card PNGs: an ordinary PNG picture with the Character Card JSON stored
 * in a tEXt chunk named "chara" (base64 of the UTF-8 JSON). Wyvern, SillyTavern,
 * Chub and others read the character back out of the picture.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function textChunk(keyword: string, text: string): Uint8Array {
  const data = new TextEncoder().encode(`${keyword}\0${text}`); // base64 text is plain ASCII
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set([0x74, 0x45, 0x58, 0x74], 4); // "tEXt"
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

/** Returns a copy of the PNG with the card JSON embedded (replacing any existing chara/ccv3 text). */
export function embedCardInPng(png: Uint8Array, cardJson: string): Uint8Array {
  const parts: Uint8Array[] = [png.subarray(0, 8)];
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  let inserted = false;
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    const chunk = png.subarray(offset, end);
    let keep = true;
    if (type === 'tEXt') {
      const zero = chunk.indexOf(0, 8);
      const keyword = new TextDecoder('latin1').decode(chunk.subarray(8, zero)).toLowerCase();
      if (keyword === 'chara' || keyword === 'ccv3') keep = false;
    }
    if (type === 'IEND' && !inserted) {
      parts.push(textChunk('chara', utf8ToBase64(cardJson)));
      inserted = true;
    }
    if (keep) parts.push(chunk);
    offset = end;
    if (type === 'IEND') break;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the character picture.'));
    img.src = src;
  });
}

/** Draws the portrait (or a simple name card when there is none) and returns PNG bytes. */
async function renderPortraitPng(avatarSrc: string | undefined, name: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create the picture.');

  let drawn = false;
  if (avatarSrc) {
    try {
      const img = await loadImage(avatarSrc);
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      drawn = true;
    } catch {
      // fall back to the name card
    }
  }
  if (!drawn) {
    canvas.width = 512;
    canvas.height = 768;
    const g = ctx.createLinearGradient(0, 0, 512, 768);
    g.addColorStop(0, '#2a1a5e');
    g.addColorStop(1, '#0f1115');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 768);
    ctx.fillStyle = '#f1f3f5';
    ctx.textAlign = 'center';
    ctx.font = '600 40px system-ui, sans-serif';
    ctx.fillText(name.slice(0, 22), 256, 384);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Your browser could not create the picture.');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Builds the character card PNG and downloads it. */
export async function downloadCharacterPng(params: {
  card: unknown;
  avatarSrc?: string;
  name: string;
}): Promise<void> {
  const png = await renderPortraitPng(params.avatarSrc, params.name);
  const withCard = embedCardInPng(png, JSON.stringify(params.card));
  const slug = (params.name || 'character')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const url = URL.createObjectURL(new Blob([withCard as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug || 'character'}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Shrinks a picture (keeping its shape) so it is light enough to store in the browser. */
export async function imageFileToStoredPortrait(file: Blob, maxSide = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * s);
    canvas.height = Math.round(img.naturalHeight * s);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
