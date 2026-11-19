import {Wrench, Package} from 'lucide-react';
import type {Product, RepairOrder, SaleRecord} from '../types';
import {formatARS} from '../utils/format';
import {resumenVentasProductos, type ProductSaleSummary} from '../utils/salesAnalytics';

interface BalanceSectionProps {
  productos: Product[];
  reparaciones: RepairOrder[];
  historial: SaleRecord[];
}

export function BalanceSection({
  productos,
  reparaciones,
  historial,
}: BalanceSectionProps) {
  const ventasPorProd = resumenVentasProductos(historial, productos);

  const inversionStock = productos.reduce(
    (sum, p) => sum + (Number(p.costo) || 0) * (Number(p.stock) || 0),
    0,
  );
  const costoRepuestosTaller = reparaciones.reduce(
    (sum, r) => sum + (Number(r.costo_repuesto) || 0),
    0,
  );
  const totalInvertido = inversionStock + costoRepuestosTaller;

  // Combinar productos actuales + productos ya vendidos que no estén en catálogo
  const usados = new Set<ProductSaleSummary>();
  const productRows: Array<{
    key: string;
    codigo: string;
    nombre: string;
    prod: Product | null;
    summary: ProductSaleSummary | null;
  }> = [];

  productos.forEach((p) => {
    const r = ventasPorProd.get(p.codigo) || ventasPorProd.get(`n:${p.nombre}`) || null;
    if (r) usados.add(r);
    productRows.push({
      key: `p-${p.codigo}`,
      codigo: p.codigo,
      nombre: p.nombre,
      prod: p,
      summary: r,
    });
  });

  ventasPorProd.forEach((r, key) => {
    if (!usados.has(r)) {
      productRows.push({
        key: `v-${key}`,
        codigo: r.codigo,
        nombre: r.nombre,
        prod: null,
        summary: r,
      });
    }
  });

  let unidadesVendidas = 0;
  let ingresoProductos = 0;
  let gananciaProductos = 0;

  productRows.forEach(({summary}) => {
    if (summary) {
      unidadesVendidas += summary.unidades;
      ingresoProductos += summary.ingreso;
      gananciaProductos += summary.ingreso - summary.costo;
    }
  });

  const ingresosReparaciones = reparaciones.reduce(
    (sum, r) => sum + (r.estado === 'Retirado' ? r.presupuesto || 0 : r.senia || 0),
    0,
  );
  const gananciaReparaciones = ingresosReparaciones - costoRepuestosTaller;

  const totalIngresos = ingresoProductos + ingresosReparaciones;
  const gananciaNetaTotal = gananciaProductos + gananciaReparaciones;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Balance y Ganancias
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Inversiones, costos de repuestos y ganancias netas reales
        </p>
      </div>

      {/* 3 Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Total Invertido (Stock + Repuestos)
          </p>
          <p className="text-2xl font-bold text-red-600 mt-2 tabular-nums">
            {formatARS(totalInvertido)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Stock actual: {formatARS(inversionStock, false)} · Taller:{' '}
            {formatARS(costoRepuestosTaller, false)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Total Ingresos (Ventas + Reparaciones)
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
            {formatARS(totalIngresos)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Productos: {formatARS(ingresoProductos, false)} · Taller:{' '}
            {formatARS(ingresosReparaciones, false)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Ganancia Neta Total
          </p>
          <p
            className={`text-2xl font-bold mt-2 tabular-nums ${
              gananciaNetaTotal >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatARS(gananciaNetaTotal)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Ventas: {formatARS(gananciaProductos, false)} · Taller:{' '}
            {formatARS(gananciaReparaciones, false)}
          </p>
        </div>
      </div>

      {/* Desglose Reparaciones */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-600" />
          <h2 className="text-base font-bold text-slate-900">
            Desglose de Servicio Técnico (Reparaciones)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">N° Orden</th>
                <th className="py-3 px-4">Equipo</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Ingresado ($)</th>
                <th className="py-3 px-4 text-right">Costo Repuesto ($)</th>
                <th className="py-3 px-4 text-right">Ganancia Rep. ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {reparaciones.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                    No hay reparaciones cargadas para calcular el balance.
                  </td>
                </tr>
              ) : (
                reparaciones.map((r) => {
                  const ingresado =
                    r.estado === 'Retirado' ? r.presupuesto || 0 : r.senia || 0;
                  const costo = r.costo_repuesto || 0;
                  const ganancia = ingresado - costo;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs font-bold text-slate-900">
                        {r.n_orden}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {r.equipo}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        <span
                          className={
                            r.estado === 'Retirado'
                              ? 'text-emerald-700'
                              : r.estado === 'Listo para Entregar'
                                ? 'text-teal-700'
                                : 'text-amber-700'
                          }
                        >
                          {r.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                        {formatARS(ingresado)}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 tabular-nums">
                        {formatARS(costo)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold tabular-nums ${
                          ganancia >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {formatARS(ganancia)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Desglose Inventario y Ventas de Productos */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">
              Desglose de Inventario y Ventas de Productos
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Incluye todo lo vendido por Punto de Venta y por Escáner. La ganancia es lo
            cobrado menos el costo de las unidades vendidas.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Repuesto</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4 text-right">Costo Unit.</th>
                <th className="py-3 px-4 text-right">Inversión Stock</th>
                <th className="py-3 px-4 text-right">Precio Venta</th>
                <th className="py-3 px-4 text-right">Vendidas</th>
                <th className="py-3 px-4 text-right">Total Vendido</th>
                <th className="py-3 px-4 text-right">Ganancia Neta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {productRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 px-4 text-center text-slate-500">
                    No hay productos ni ventas registradas.
                  </td>
                </tr>
              ) : (
                productRows.map(({key, codigo, nombre, prod, summary}) => {
                  const inv = prod
                    ? (Number(prod.costo) || 0) * (Number(prod.stock) || 0)
                    : 0;
                  const gan = summary ? summary.ingreso - summary.costo : 0;
                  return (
                    <tr key={key} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700">
                        {codigo || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900">{nombre}</span>
                        {!prod && (
                          <span className="ml-1.5 text-xs italic text-slate-400">
                            (ya no está en inventario)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                        {prod ? `${prod.stock} un.` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                        {prod ? formatARS(prod.costo) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900">
                        {prod ? formatARS(inv) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-900">
                        {prod ? formatARS(prod.precio) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-teal-700">
                        {summary && summary.unidades > 0 ? `${summary.unidades} un.` : '0'}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-900">
                        {formatARS(summary ? summary.ingreso : 0)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tabular-nums font-bold ${
                          gan < 0 ? 'text-red-600' : 'text-emerald-600'
                        }`}
                      >
                        {formatARS(gan)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {ventasPorProd.size > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 text-sm font-bold text-slate-900">
                  <td colSpan={6} className="py-3 px-4 text-right">
                    TOTAL VENTAS DE PRODUCTOS
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-teal-700">
                    {unidadesVendidas} un.
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {formatARS(ingresoProductos)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right tabular-nums ${
                      gananciaProductos < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatARS(gananciaProductos)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
