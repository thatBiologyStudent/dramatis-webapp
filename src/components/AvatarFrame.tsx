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
    if (!file || !onChangeAvatar) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;

      // Resize portrait to max 384x384 JPEG so localStorage remains lightweight
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetSize = 384;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setImgFailed(false);
          onChangeAvatar(result);
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setImgFailed(false);
        onChangeAvatar(compressed);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
