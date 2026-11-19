import {useMemo, useState} from 'react';
import {
  FileSpreadsheet,
  RotateCcw,
  Printer,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import type {SaleRecord} from '../types';
import {formatARS} from '../utils/format';
import {exportSalesToExcel} from '../utils/excelExport';
import {detectarVentasDuplicadas} from '../utils/salesAnalytics';
import {formatearFechaCorta} from '../utils/thermalPrint';

interface HistorySectionProps {
  historial: SaleRecord[];
  onReprintSale: (sale: SaleRecord) => void;
  onEditSale: (sale: SaleRecord) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function HistorySection({
  historial,
  onReprintSale,
  onEditSale,
  onNotify,
}: HistorySectionProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);

  const duplicadas = useMemo(
    () => detectarVentasDuplicadas(historial),
    [historial],
  );

  const filtered = useMemo(() => {
    return historial
      .filter((v) => {
        const day = (v.fecha || '').substring(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      })
      .slice()
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  }, [historial, dateFrom, dateTo]);

  const totalFiltered = filtered.reduce((sum, v) => sum + (v.total || 0), 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportSalesToExcel(filtered, dateFrom, dateTo);
      onNotify('success', `Excel de ventas generado (${filtered.length} registros).`);
    } catch {
      onNotify('error', 'No se pudo generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Historial de Cobros & Exportar
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 tabular-nums">
            Se encontraron {filtered.length} registros · Total acumulado:{' '}
            <span className="font-semibold text-slate-900">{formatARS(totalFiltered)}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{exporting ? 'Generando...' : 'Exportar Excel'}</span>
        </button>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <label htmlFor="hist-from" className="text-xs font-semibold text-slate-600 shrink-0">
              Desde:
            </label>
            <input
              id="hist-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2">
            <label htmlFor="hist-to" className="text-xs font-semibold text-slate-600 shrink-0">
              Hasta:
            </label>
            <input
              id="hist-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar filtro</span>
          </button>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">N° Recibo</th>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Detalle de Trabajos / Repuestos</th>
                <th className="py-3 px-4">Método de Pago</th>
                <th className="py-3 px-4 text-right">Monto Total ($)</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-slate-500">
                    No hay registros de ventas para el período seleccionado.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const isDup = duplicadas.has(v);
                  return (
                    <tr
                      key={v.n_recibo}
                      className={
                        isDup
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {v.n_recibo}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {formatearFechaCorta(v.fecha)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800">
                        <span>{v.detalle}</span>
                        {isDup && (
                          <span
                            className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800"
                            title="Mismo detalle y monto que otra venta registrada pocos minutos antes o después"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Posible duplicado</span>
                          </span>
                        )}
                        {v.editado && (
                          <span className="ml-1.5 text-xs italic text-slate-400">
                            (editada)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-teal-700 whitespace-nowrap">
                        {v.metodo_pago}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatARS(v.total)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditSale(v)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Editar o eliminar venta"
                            aria-label="Editar o eliminar venta"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onReprintSale(v)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-teal-700" />
                            <span>Ticket</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
