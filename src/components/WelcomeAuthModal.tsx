import {HardDrive, Loader2, UserRound, WifiOff, X} from 'lucide-react';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import {OFFICIAL_LOGO_PATH} from '../utils/thermalPrint';
import type {LegalDocType} from './LegalPage';

interface WelcomeAuthModalProps {
  open: boolean;
  canDismiss: boolean;
  loading: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onGoogleLogin: () => void;
  onContinueAsGuest: () => void;
  onClose: () => void;
  onNavigateLegal: (doc: LegalDocType) => void;
}

function GoogleLogoSvg() {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="w-5 h-5 shrink-0"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

export function WelcomeAuthModal({
  open,
  canDismiss,
  loading,
  statusMessage,
  errorMessage,
  onGoogleLogin,
  onContinueAsGuest,
  onClose,
  onNavigateLegal,
}: WelcomeAuthModalProps) {
  const isOnline = useOnlineStatus();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto">
        {canDismiss && !loading && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="p-6 sm:p-7 space-y-5">
          {/* Brand Header */}
          <div className="text-center space-y-2.5">
            <div className="inline-flex items-center justify-center w-24 h-16 rounded-2xl bg-slate-950 border border-slate-800 shadow-md p-2 mx-auto">
              <img
                src={OFFICIAL_LOGO_PATH}
                alt="G TECH"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                ¡Bienvenido a G TECH!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                Elegí cómo querés guardar tu inventario, reparaciones e historial de ventas.
              </p>
            </div>
          </div>

          {/* Alerts / Progress */}
          {!isOnline && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 font-medium flex items-start gap-2">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Sin conexión a internet. Podés entrar como{' '}
                <strong>Invitado</strong> y seguir trabajando offline en este equipo.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 font-medium">
              {errorMessage}
            </div>
          )}

          {statusMessage && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-xs text-teal-800 font-medium flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-teal-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Google Sign-In */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={loading || !isOnline}
              onClick={() => onGoogleLogin()}
              className="gsi-material-button w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-[#747775]/40 text-[#1f1f1f] text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <GoogleLogoSvg />
              <span className="gsi-material-button-contents">
                Iniciar sesión con Google
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              o bien
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Guest Mode Option */}
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={loading}
              onClick={onContinueAsGuest}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              <UserRound className="w-4 h-4 text-slate-600" />
              <span>Entrar como Invitado</span>
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
              <HardDrive className="w-3 h-3 text-slate-400 shrink-0" />
              <span>En modo invitado los datos se guardan localmente en este equipo.</span>
            </p>
          </div>

          {/* Public Legal Links Footer (Google Auth Platform Verification Ready) */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <a
              href="/privacidad"
              onClick={(e) => {
                e.preventDefault();
                onNavigateLegal('privacidad');
              }}
              className="hover:text-teal-700 font-medium underline underline-offset-2 transition-colors"
            >
              Política de Privacidad
            </a>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <a
              href="/terminos"
              onClick={(e) => {
                e.preventDefault();
                onNavigateLegal('terminos');
              }}
              className="hover:text-teal-700 font-medium underline underline-offset-2 transition-colors"
            >
              Términos de Servicio
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
