import React, {useEffect, useRef} from 'react';
import type {User} from 'firebase/auth';
import {
  Cloud,
  CloudDownload,
  CloudOff,
  CloudUpload,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import type {SessionMode, SyncState} from './Sidebar';

interface AccountFloatingMenuProps {
  open: boolean;
  onSetOpen: (open: boolean) => void;
  sessionMode: SessionMode;
  googleUser: User | null;
  syncState: SyncState;
  manualCloudSaving: boolean;
  cloudRestoring: boolean;
  onSaveToCloud: () => Promise<void> | void;
  onRestoreFromCloud: () => Promise<void> | void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onSwitchAccount: () => void;
  onSignOut: () => Promise<void> | void;
}

export function AccountFloatingMenu({
  open,
  onSetOpen,
  sessionMode,
  googleUser,
  syncState,
  manualCloudSaving,
  cloudRestoring,
  onSaveToCloud,
  onRestoreFromCloud,
  onExportBackup,
  onImportBackup,
  onSwitchAccount,
  onSignOut,
}: AccountFloatingMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onSetOpen]);

  if (sessionMode === 'pending') return null;

  const isCloudConnected = sessionMode === 'cloud' && Boolean(googleUser);
  const displayName =
    isCloudConnected && googleUser
      ? googleUser.displayName || googleUser.email || 'Usuario Google'
      : 'Invitado';

  const cloudSyncDetail =
    syncState === 'error'
      ? 'Error al sincronizar'
      : syncState === 'saving' || manualCloudSaving || cloudRestoring
        ? 'Sincronizando...'
        : syncState === 'loading'
          ? 'Cargando...'
          : 'Sincronizado';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      e.target.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Circular Floating Button (ONLY user photo/avatar) in bottom-right corner */}
      <button
        type="button"
        onClick={() => onSetOpen(!open)}
        aria-label={`Menú de cuenta (${displayName})`}
        title={displayName}
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 w-12 h-12 rounded-full bg-slate-900 border-2 border-white shadow-xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
      >
        {isCloudConnected && googleUser?.photoURL ? (
          <img
            src={googleUser.photoURL}
            alt={displayName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
            <UserRound className="w-5 h-5 text-teal-300" />
          </div>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-slate-950/35"
            onClick={() => onSetOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú de cuenta"
            className="fixed bottom-20 right-4 sm:bottom-22 sm:right-5 z-[70] w-[min(21rem,calc(100vw-2rem))] max-h-[calc(100dvh-6.5rem)] overflow-y-auto bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200"
          >
            <div className="p-4 bg-slate-900 text-white relative">
              <button
                type="button"
                onClick={() => onSetOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Cerrar menú de cuenta"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 pr-7">
                {isCloudConnected && googleUser?.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border-2 border-teal-400/70 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center shrink-0">
                    <UserRound className="w-6 h-6 text-slate-300" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{displayName}</p>
                  {isCloudConnected && googleUser?.email && (
                    <p className="text-[11px] text-slate-400 truncate">
                      {googleUser.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                {isCloudConnected ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-teal-300">
                    <Cloud className="w-3.5 h-3.5 shrink-0" />
                    Conectado a la nube
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-300">
                    <CloudOff className="w-3.5 h-3.5 shrink-0" />
                    No conectado a la nube
                  </span>
                )}
                <span
                  className={`text-[11px] font-medium shrink-0 ${
                    syncState === 'error'
                      ? 'text-red-400'
                      : syncState === 'saving' || manualCloudSaving || cloudRestoring
                        ? 'text-amber-300'
                        : 'text-slate-400'
                  }`}
                >
                  {isCloudConnected ? cloudSyncDetail : 'Modo local'}
                </span>
              </div>
            </div>

            <div className="p-3.5 space-y-2 bg-white">
              <button
                type="button"
                disabled={manualCloudSaving || cloudRestoring}
                onClick={async () => {
                  await onSaveToCloud();
                  if (!isCloudConnected) {
                    onSetOpen(false);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              >
                {manualCloudSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <CloudUpload className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {manualCloudSaving
                    ? 'Guardando copia en la nube...'
                    : 'Guardar copia en la nube'}
                </span>
              </button>

              <button
                type="button"
                disabled={manualCloudSaving || cloudRestoring}
                onClick={async () => {
                  await onRestoreFromCloud();
                  onSetOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 disabled:opacity-60 text-teal-900 text-xs font-semibold transition-colors cursor-pointer"
              >
                {cloudRestoring ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-teal-700" />
                ) : (
                  <CloudDownload className="w-4 h-4 shrink-0 text-teal-700" />
                )}
                <span>
                  {cloudRestoring
                    ? 'Restableciendo desde la nube...'
                    : 'Restablecer copia en la nube'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onExportBackup();
                    onSetOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Descargar JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSetOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>Importar JSON</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSetOpen(false);
                    onSwitchAccount();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-teal-700 bg-teal-50/70 hover:bg-teal-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Cambiar de cuenta</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    onSetOpen(false);
                    await onSignOut();
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
