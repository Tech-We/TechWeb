import {useMemo, useState} from 'react';
import {
  Plus,
  ShoppingBag,
  DollarSign,
  Wrench,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import type {Product, RepairOrder, SaleRecord, SectionId} from '../types';
import {formatARS, getLocalDateStr} from '../utils/format';

interface DashboardSectionProps {
  productos: Product[];
  reparaciones: RepairOrder[];
  historial: SaleRecord[];
  onOpenScannerMode: (mode: 'ENTRADA' | 'VENTA', prefillCode?: string) => void;
  onNavigate: (section: SectionId) => void;
  onPrintRepair: (order: RepairOrder) => void;
}

const CRITICAL_STOCK_THRESHOLD = 3; // Nivel crítico: menor a 3 unidades

export function DashboardSection({
  productos,
  reparaciones,
  historial,
  onOpenScannerMode,
  onNavigate,
  onPrintRepair,
}: DashboardSectionProps) {
  const hoyStr = getLocalDateStr();
  const mesStr = hoyStr.substring(0, 7);

  const ventasHoy = historial
    .filter((h) => h.fecha.startsWith(hoyStr))
    .reduce((sum, h) => sum + (h.total || 0), 0);

  const repPendientes = reparaciones.filter((r) => r.estado !== 'Retirado').length;

  const productosCriticos = useMemo(
    () =>
      productos
        .filter((p) => p.stock < CRITICAL_STOCK_THRESHOLD)
        .sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre)),
    [productos],
  );

  const stockCritico = productosCriticos.length;
  const agotadosCount = productosCriticos.filter((p) => p.stock === 0).length;

  const [alertExpanded, setAlertExpanded] = useState(false);

  const ingresosMes = historial
    .filter((h) => h.fecha.startsWith(mesStr))
    .reduce((sum, h) => sum + (h.total || 0), 0);

  const ultimasReparaciones = [...reparaciones].slice(-5).reverse();

  const visibleCriticalItems = alertExpanded
    ? productosCriticos
    : productosCriticos.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Panel Principal — TECH
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestión de servicio técnico, reparaciones, stock y punto de venta
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenScannerMode('ENTRADA')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ingreso de Stock</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenScannerMode('VENTA')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Egreso / Venta</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 tracking-wide">
              Ventas de Hoy
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
              {formatARS(ventasHoy)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Cobros registrados hoy</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 tracking-wide">
              Reparaciones Pendientes
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
              {repPendientes}
            </p>
            <p className="text-xs text-amber-700 font-medium mt-1">
              En taller o listas para entregar
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div
          className={`rounded-xl border p-5 flex items-start justify-between gap-3 transition-colors ${
            stockCritico > 0
              ? 'bg-red-50/40 border-red-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              {stockCritico > 0 && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-red-600 motion-safe:animate-pulse shrink-0"
                />
              )}
              <p className="text-xs font-semibold text-slate-500 tracking-wide">
                Aviso Stock Crítico
              </p>
            </div>
            <p
              className={`text-2xl font-bold mt-1.5 tabular-nums ${
                stockCritico > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {stockCritico}
            </p>
            <p
              className={`text-xs font-medium mt-1 ${
                stockCritico > 0 ? 'text-red-600' : 'text-slate-500'
              }`}
            >
              {stockCritico > 0
                ? 'Menos de 3 unidades disponibles'
                : 'Sin productos en nivel crítico'}
            </p>
          </div>
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              stockCritico > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 tracking-wide">
              Ingresos del Mes
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1.5 tabular-nums">
              {formatARS(ingresosMes)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Total acumulado mensual</p>
          </div>
          <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900">
              Últimas Reparaciones Registradas
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('tecnico')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">N° Orden</th>
                  <th className="py-3 px-4">Cliente / Teléfono</th>
                  <th className="py-3 px-4">Equipo / Falla</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Presupuesto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {ultimasReparaciones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 px-4 text-center text-slate-500">
                      No hay reparaciones registradas todavía.
                    </td>
                  </tr>
                ) : (
                  ultimasReparaciones.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => onPrintRepair(r)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      title="Clic para ver e imprimir orden"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {r.n_orden}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{r.cliente}</div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          {r.telefono || 'Sin teléfono'}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-slate-900 truncate">{r.equipo}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {r.falla || 'Revisión técnica'}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block text-xs font-semibold ${
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
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatARS(r.presupuesto, false)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alertas de Stock Crítico (< 3 unidades) */}
        <section
          role={stockCritico > 0 ? 'alert' : undefined}
          aria-live="polite"
          className={`lg:col-span-4 rounded-xl overflow-hidden transition-colors ${
            stockCritico > 0
              ? 'bg-white border-2 border-red-300 shadow-sm'
              : 'bg-white border border-slate-200'
          }`}
        >
          <div
            className={`px-5 py-4 flex items-center justify-between gap-2 ${
              stockCritico > 0
                ? 'bg-red-600 text-white'
                : 'border-b border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {stockCritico > 0 ? (
                <div className="relative shrink-0">
                  <AlertTriangle className="w-4 h-4 text-amber-200" />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300 motion-safe:animate-ping"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-300"
                  />
                </div>
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight truncate">
                  {stockCritico > 0
                    ? `Alertas de Stock (${stockCritico})`
                    : 'Alertas de Stock'}
                </h2>
                {stockCritico > 0 && (
                  <p className="text-[11px] text-red-100 mt-0.5 truncate">
                    {agotadosCount > 0
                      ? `${agotadosCount} agotado(s) · ${stockCritico - agotadosCount} crítico(s) (< 3 un.)`
                      : 'Productos con menos de 3 unidades'}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('inventario')}
              className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                stockCritico > 0
                  ? 'px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white'
                  : 'text-teal-700 hover:text-teal-800'
              }`}
            >
              Inventario
            </button>
          </div>

          <div className="divide-y divide-red-100/80">
            {stockCritico === 0 ? (
              <div className="py-10 px-5 text-center text-sm text-slate-500">
                Sin alertas. Todos los productos tienen 3 o más unidades en stock.
              </div>
            ) : (
              visibleCriticalItems.map((item) => {
                const isOut = item.stock === 0;
                return (
                  <div
                    key={item.codigo}
                    className={`px-4 py-3 flex items-center justify-between gap-2.5 transition-colors ${
                      isOut
                        ? 'bg-red-50/70 hover:bg-red-50'
                        : 'bg-red-50/25 hover:bg-red-50/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {item.nombre}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-slate-500 font-mono">
                          Cód. {item.codigo}
                        </span>
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            isOut
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {isOut ? 'Agotado · 0' : `Crítico · ${item.stock} un.`}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenScannerMode('ENTRADA', item.codigo)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Reponer</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {productosCriticos.length > 5 && (
            <div className="px-4 py-2.5 bg-red-50/70 border-t border-red-100 flex justify-center">
              <button
                type="button"
                onClick={() => setAlertExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-900 transition-colors"
              >
                {alertExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    <span>Mostrar menos</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    <span>
                      Ver los {productosCriticos.length - 5} productos restantes
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
