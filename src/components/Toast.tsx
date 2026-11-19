import {CheckCircle2, AlertTriangle, Info, X} from 'lucide-react';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({toasts, onDismiss}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 inset-x-3 sm:inset-x-auto sm:top-5 sm:right-5 z-[80] flex flex-col gap-2 sm:max-w-sm sm:w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const icon =
          t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : t.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-teal-600 shrink-0" />
          );

        const borderClass =
          t.type === 'success'
            ? 'border-emerald-200 bg-white'
            : t.type === 'error'
              ? 'border-red-200 bg-white'
              : 'border-slate-200 bg-white';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm text-slate-800 ${borderClass}`}
          >
            <div className="mt-0.5">{icon}</div>
            <p className="flex-1 font-medium leading-snug">{t.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
