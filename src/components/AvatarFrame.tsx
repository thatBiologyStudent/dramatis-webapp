import React, { useEffect, useRef, useState } from 'react';
import { Upload, User } from 'lucide-react';

interface AvatarFrameProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onChangeAvatar?: (dataUrl: string) => void;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-11 h-11 rounded-xl text-sm',
  md: 'w-16 h-16 rounded-2xl text-lg',
  lg: 'w-24 h-24 rounded-2xl text-2xl',
};

/** Reads an image file and returns a square, centre-cropped 384px JPEG data URL. */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Could not read this image.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('This file is not a supported image.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetSize = 384;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export const AvatarFrame: React.FC<AvatarFrameProps> = ({
  src,
  name,
  size = 'md',
  editable = false,
  onChangeAvatar,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const initials = (name || 'C')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onChangeAvatar) return;
    void fileToAvatarDataUrl(file).then((dataUrl) => {
      setImgFailed(false);
      onChangeAvatar(dataUrl);
    });
  };

  const showImage = Boolean(src) && !imgFailed;

  return (
    <div className={`relative shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-[#161922] ${SIZE_CLASSES[size]}`}>
      {showImage ? (
        <img
          src={src}
          alt={name ? `Portrait of ${name}` : 'Character portrait'}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-200/80 to-zinc-100 dark:from-[#1B202C] dark:to-[#12141A] text-zinc-600 dark:text-zinc-300 font-display font-semibold select-none">
          {initials ? <span>{initials}</span> : <User className="w-5 h-5 opacity-70" />}
        </div>
      )}

      {editable && onChangeAvatar && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload character portrait"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title="Upload portrait"
            aria-label="Upload character portrait"
            className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 hover:opacity-100 focus-visible:opacity-100 transition-opacity text-white cursor-pointer"
          >
            <Upload className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

interface CreatorAvatarPickerProps {
  src?: string;
  name: string;
  onChange: (dataUrl: string) => void;
  /** Shown as a "Use Discord picture" option when set and different from src */
  discordAvatarUrl?: string;
  hint?: string;
}

/** Creator portrait with an always-visible upload button (works on touch screens too). */
export const CreatorAvatarPicker: React.FC<CreatorAvatarPickerProps> = ({
  src,
  name,
  onChange,
  discordAvatarUrl,
  hint = 'Shown next to your presets in the Preset Picker, like on the built-in ones. Square images work best.',
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    fileToAvatarDataUrl(file)
      .then(onChange)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not read this image.'));
  };

  const isCustom = Boolean(src) && src !== discordAvatarUrl;

  return (
    <div className="flex items-center gap-4">
      <AvatarFrame src={src} name={name} size="md" editable onChangeAvatar={onChange} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Creator profile picture</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{hint}</p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            aria-label="Upload creator profile picture"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 min-h-[34px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#12141A] px-3 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{src ? 'Change picture' : 'Upload picture'}</span>
          </button>
          {discordAvatarUrl && isCustom && (
            <button
              type="button"
              onClick={() => onChange(discordAvatarUrl)}
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              Use Discord picture
            </button>
          )}
          {!discordAvatarUrl && src && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
