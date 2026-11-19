import {
  AlertTriangle,
  Cloud,
  CloudUpload,
  HardDrive,
  Loader2,
  X,
} from 'lucide-react';
import type {CloudDataset} from '../utils/firestoreDb';

interface DatasetCounts {
  productos: number;
  reparaciones: number;
  historial: number;
}

interface CloudConflictModalProps {
  open: boolean;
  userEmail: string;
  cloudData: CloudDataset | null;
  localCounts: DatasetCounts;
  busy: boolean;
  onUseCloud: () => void;
  onUploadLocalToCloud: () => void;
  onCancel: () => void;
}

export function CloudConflictModal({
  open,
  userEmail,
  cloudData,
  localCounts,
  busy,
  onUseCloud,
  onUploadLocalToCloud,
  onCancel,
}: CloudConflictModalProps) {
  if (!open || !cloudData) return null;

  const formatSummary = (c: DatasetCounts) =>
    `${c.productos} productos · ${c.reparaciones} reparaciones · ${c.historial} ventas`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold">Elegir base de datos a utilizar</h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="text-slate-300 hover:text-white p-1 disabled:opacity-50"
            aria-label="Cancelar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            La cuenta <strong className="text-slate-900">{userEmail}</strong> ya tiene datos guardados en la nube y también hay datos locales en tu sesión de invitado. Confirmá qué base de datos querés usar:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-900">
                <Cloud className="w-4 h-4 text-teal-600" />
                <span>En tu cuenta (Nube)</span>
              </div>
              <p className="text-xs text-slate-700">
                {formatSummary({
                  productos: cloudData.productos.length,
                  reparaciones: cloudData.reparaciones.length,
                  historial: cloudData.historial.length,
                })}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <HardDrive className="w-4 h-4 text-slate-600" />
                <span>En sesión local</span>
              </div>
              <p className="text-xs text-slate-700">{formatSummary(localCounts)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onUploadLocalToCloud}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5" />
              )}
              <span>Subir datos locales a la nube</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onUseCloud}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold disabled:opacity-50"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Usar datos de la nube</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
