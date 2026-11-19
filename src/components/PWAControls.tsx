import {useState} from 'react';
import {Download, Share, Smartphone, WifiOff, X} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'modal';
  collapsed?: boolean;
}

export function PWAInstallButton({
  variant = 'sidebar',
  collapsed = false,
}: PWAInstallButtonProps) {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleClick = () => {
    if (isInstallable) {
      void install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleClick}
          title={collapsed ? 'Instalar app offline' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 cursor-pointer ${
            collapsed ? 'justify-center px-2' : ''
          }`}
        >
          <Download className="w-4 h-4 shrink-0 text-teal-400" />
          {!collapsed && <span className="truncate">Instalar App Offline</span>}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Smartphone className="w-4 h-4 shrink-0 text-teal-600" />
          <span>Instalar app para usar sin internet</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-5 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Instalar en iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="mt-3 space-y-2.5 text-xs sm:text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <span className="font-bold text-teal-700">1.</span>
                <span>
                  Tocá el botón{' '}
                  <strong className="inline-flex items-center gap-1 text-slate-800">
                    Compartir <Share className="w-3.5 h-3.5 inline" />
                  </strong>{' '}
                  en la barra de Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-teal-700">2.</span>
                <span>
                  Deslizá hacia abajo y elegí{' '}
                  <strong className="text-slate-800">Agregar a inicio</strong>.
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-xl bg-slate-900 hover:bg-slate-800 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-[55] flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-400/50 print:hidden"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Sin internet · Modo offline activo</span>
    </div>
  );
}
