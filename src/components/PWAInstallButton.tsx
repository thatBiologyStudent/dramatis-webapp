import React, { useState } from 'react';
import { Download, Share, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'prominent';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          variant === 'prominent'
            ? 'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171F] px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500/50 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'prominent'
              ? 'inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
              : 'inline-flex items-center justify-center gap-1.5 min-h-[38px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#14171F] px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:border-blue-500/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
          }
        >
          <Share className="w-3.5 h-3.5 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Install Dramatis on iOS"
          >
            <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12141A] p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Install Dramatis on iPhone or iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed list-decimal list-inside">
                <li>
                  Tap the <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Share</strong> icon in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Add to Home Screen</strong>.
                </li>
                <li>
                  Launch Dramatis anytime—Manual Mode and saved presets work offline.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2.5 rounded-xl border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-950/90 px-3.5 py-2 text-xs font-medium text-amber-900 dark:text-amber-100 shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
      <span>Offline Mode — Manual drafting and local presets remain available.</span>
    </div>
  );
};
