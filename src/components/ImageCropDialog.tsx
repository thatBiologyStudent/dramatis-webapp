import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X, ZoomIn } from 'lucide-react';

export type CropAspect = 'original' | '1:1' | '2:3' | '3:4';

const ASPECT_LABELS: Record<CropAspect, string> = {
  original: 'Original',
  '2:3': '2:3',
  '3:4': '3:4',
  '1:1': 'Square',
};

interface ImageCropDialogProps {
  /** Data URL of the picked image */
  src: string;
  /** Shapes the user can choose from; the first one is selected initially */
  aspects: CropAspect[];
  /** Longest side of the saved image in pixels */
  maxOutput: number;
  title?: string;
  onCancel: () => void;
  onDone: (dataUrl: string) => void;
}

const FRAME_MAX = 300; // longest side of the on-screen crop frame, in CSS px

/** Lets the user choose the shape, framing and zoom of a picture before it is saved. */
export const ImageCropDialog: React.FC<ImageCropDialogProps> = ({
  src,
  aspects,
  maxOutput,
  title = 'Crop picture',
  onCancel,
  onDone,
}) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<CropAspect>(aspects[0] || '1:1');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);

  // width / height of the chosen shape
  const ratio = useMemo(() => {
    if (aspect === 'original') return img ? img.naturalWidth / img.naturalHeight : 1;
    const [w, h] = aspect.split(':').map(Number);
    return w / h;
  }, [aspect, img]);

  const frameW = ratio >= 1 ? FRAME_MAX : Math.round(FRAME_MAX * ratio);
  const frameH = ratio >= 1 ? Math.round(FRAME_MAX / ratio) : FRAME_MAX;

  const scale = img
    ? Math.max(frameW / img.naturalWidth, frameH / img.naturalHeight) * zoom
    : 1;
  const dispW = img ? img.naturalWidth * scale : 0;
  const dispH = img ? img.naturalHeight * scale : 0;
  const maxX = Math.max(0, (dispW - frameW) / 2);
  const maxY = Math.max(0, (dispH - frameH) / 2);
  const clamp = (v: number, m: number) => Math.min(m, Math.max(-m, v));
  const ox = clamp(offset.x, maxX);
  const oy = clamp(offset.y, maxY);
  const left = (frameW - dispW) / 2 + ox;
  const top = (frameH - dispH) / 2 + oy;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox, oy };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.px),
      y: drag.current.oy + (e.clientY - drag.current.py),
    });
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const save = () => {
    if (!img) return;
    const outW = ratio >= 1 ? maxOutput : Math.round(maxOutput * ratio);
    const outH = ratio >= 1 ? Math.round(maxOutput / ratio) : maxOutput;
    // Never upscale beyond the source pixels inside the crop
    const srcW = frameW / scale;
    const srcH = frameH / scale;
    const shrink = Math.min(1, srcW / outW);
    const w = Math.max(1, Math.round(outW * shrink));
    const h = Math.max(1, Math.round(outH * shrink));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, -left / scale, -top / scale, srcW, srcH, 0, 0, w, h);
    onDone(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel cropping"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {aspects.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-[#0D0F14] border border-zinc-200 dark:border-zinc-800 w-fit">
            {aspects.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  setAspect(a);
                  setOffset({ x: 0, y: 0 });
                }}
                className={`min-h-[32px] px-3 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                  aspect === a
                    ? 'bg-white dark:bg-[#222735] text-zinc-900 dark:text-zinc-50 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {ASPECT_LABELS[a]}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-center rounded-xl bg-zinc-100 dark:bg-[#0B0D12] py-4">
          <div
            className="relative overflow-hidden rounded-lg ring-2 ring-white/80 dark:ring-white/60 shadow-lg cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ width: frameW, height: frameH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {img && (
              <img
                src={src}
                alt="Picture being cropped"
                draggable={false}
                className="absolute max-w-none pointer-events-none"
                style={{ width: dispW, height: dispH, left, top }}
              />
            )}
          </div>
        </div>

        <label className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <ZoomIn className="w-4 h-4 shrink-0" />
          <span className="sr-only">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
        </label>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Drag the picture to choose what stays in the frame.</p>

        <div className="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!img}
            onClick={save}
            className="inline-flex items-center gap-2 min-h-[40px] rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Use picture</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/** Reads a picked file as a data URL. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
}
