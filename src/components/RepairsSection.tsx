import {useMemo, useState} from 'react';
import {Plus, Search, Printer, Trash2, Pencil, FileSpreadsheet} from 'lucide-react';
import type {RepairOrder, RepairStatus} from '../types';
import {formatARS} from '../utils/format';
import {exportRepairsToExcel} from '../utils/excelExport';

interface RepairsSectionProps {
  reparaciones: RepairOrder[];
  onNewRepair: () => void;
  onEditRepair: (order: RepairOrder) => void;
  onPrintRepair: (order: RepairOrder) => void;
  onDeleteRepair: (order: RepairOrder) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function RepairsSection({
  reparaciones,
  onNewRepair,
  onEditRepair,
  onPrintRepair,
  onDeleteRepair,
  onNotify,
}: RepairsSectionProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | RepairStatus>('TODOS');
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return [...reparaciones]
      .reverse()
      .filter((r) => {
        if (statusFilter !== 'TODOS' && r.estado !== statusFilter) return false;
        if (!q) return true;
        return (
          r.n_orden.toLowerCase().includes(q) ||
          r.cliente.toLowerCase().includes(q) ||
          r.telefono.toLowerCase().includes(q) ||
          r.equipo.toLowerCase().includes(q) ||
          r.falla.toLowerCase().includes(q)
        );
      });
  }, [reparaciones, query, statusFilter]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportRepairsToExcel(filtered);
      onNotify('success', `Planilla Excel generada (${filtered.length} órdenes).`);
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
            Servicio Técnico
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onNewRepair}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ingresar Dispositivo</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            <span>{exporting ? 'Generando...' : 'Exportar Excel'}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por N° orden, cliente, teléfono o equipo..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(['TODOS', 'En Reparación', 'Listo para Entregar', 'Retirado'] as const).map(
            (tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'TODOS' ? 'Todas' : tab}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">N° Orden</th>
                <th className="py-3 px-4">Ingreso</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Equipo / Modelo</th>
                <th className="py-3 px-4">Falla Declarada</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Presupuesto / Seña</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center text-slate-500">
                    No se encontraron órdenes de servicio técnico con ese criterio.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const saldo = Math.max(0, (r.presupuesto || 0) - (r.senia || 0));
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
                        {r.n_orden}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                        {r.fecha}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{r.cliente}</div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {r.telefono || '-'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{r.equipo}</td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                        <span className="line-clamp-2">{r.falla || 'Revisión técnica'}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            r.estado === 'Retirado'
                              ? 'text-emerald-700'
                              : r.estado === 'Listo para Entregar'
                                ? 'text-teal-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {r.estado}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {formatARS(r.presupuesto, false)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Seña {formatARS(r.senia, false)} · Resta{' '}
                          <span
                            className={
                              saldo > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'
                            }
                          >
                            {formatARS(saldo, false)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditRepair(r)}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Editar orden / cambiar estado"
                            aria-label="Editar orden"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintRepair(r)}
                            className="p-2 rounded-lg border border-slate-200 text-teal-700 hover:bg-teal-50 transition-colors"
                            title="Imprimir comprobante"
                            aria-label="Imprimir orden"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRepair(r)}
                            className="p-2 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar orden"
                            aria-label="Eliminar orden"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
