import type {Product, SaleRecord} from '../types';

export interface ProductSaleSummary {
  codigo: string;
  nombre: string;
  unidades: number;
  ingreso: number;
  costo: number;
}

export function siguienteNroRecibo(historial: SaleRecord[]): string {
  const maxNum = historial.reduce((max, s) => {
    const match = String(s.n_recibo || '').match(/(\d+)$/);
    if (!match) return max;
    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 1000);
  return `TFX-REC-${maxNum + 1}`;
}

function parseSaleTimestamp(fecha: string): number | null {
  if (!fecha) return null;
  const isoLike = fecha.trim().replace(' ', 'T');
  const ms = Date.parse(isoLike);
  return Number.isFinite(ms) ? ms : null;
}

export function detectarVentasDuplicadas(historial: SaleRecord[]): Set<SaleRecord> {
  const duplicadas = new Set<SaleRecord>();
  const WINDOW_MS = 5 * 60 * 1000;

  for (let i = 0; i < historial.length; i++) {
    const a = historial[i];
    const detA = String(a.detalle || '').trim().toLowerCase();
    const totA = Number(a.total) || 0;
    const tA = parseSaleTimestamp(a.fecha);
    if (!detA) continue;

    for (let j = i + 1; j < historial.length; j++) {
      const b = historial[j];
      const detB = String(b.detalle || '').trim().toLowerCase();
      const totB = Number(b.total) || 0;
      if (detA !== detB || Math.abs(totA - totB) > 0.01) continue;

      const tB = parseSaleTimestamp(b.fecha);
      if (tA !== null && tB !== null) {
        if (Math.abs(tA - tB) <= WINDOW_MS) {
          duplicadas.add(a);
          duplicadas.add(b);
        }
      } else if (String(a.fecha).substring(0, 16) === String(b.fecha).substring(0, 16)) {
        duplicadas.add(a);
        duplicadas.add(b);
      }
    }
  }

  return duplicadas;
}

export function productosDeVenta(
  sale: SaleRecord,
  productos: Product[],
): Array<{prod: Product; cantidad: number}> {
  const byKey = new Map<string, {prod: Product; cantidad: number}>();

  if (Array.isArray(sale.items) && sale.items.length > 0) {
    for (const item of sale.items) {
      if (item.es_reparacion) continue;
      const prod =
        (item.codigo
          ? productos.find((p) => p.codigo === item.codigo)
          : undefined) ||
        productos.find(
          (p) => p.nombre.toLowerCase() === String(item.nombre || '').toLowerCase(),
        );
      if (!prod) continue;
      const qty = Math.max(1, Number(item.cantidad) || 1);
      const prev = byKey.get(prod.codigo);
      if (prev) {
        prev.cantidad += qty;
      } else {
        byKey.set(prod.codigo, {prod, cantidad: qty});
      }
    }
    return Array.from(byKey.values());
  }

  // Fallback: parse "2x Nombre producto, 1x Otro (Escáner)"
  const cleanDetalle = String(sale.detalle || '').replace(/\s*\(Escáner\)\s*$/i, '');
  const parts = cleanDetalle.split(',');
  for (const rawPart of parts) {
    const match = rawPart.trim().match(/^(\d+)x\s+(.+)$/i);
    if (!match) continue;
    const qty = Math.max(1, parseInt(match[1], 10) || 1);
    const name = match[2].trim().toLowerCase();
    const prod = productos.find((p) => p.nombre.toLowerCase() === name);
    if (!prod) continue;
    const prev = byKey.get(prod.codigo);
    if (prev) {
      prev.cantidad += qty;
    } else {
      byKey.set(prod.codigo, {prod, cantidad: qty});
    }
  }

  return Array.from(byKey.values());
}

export function resumenVentasProductos(
  historial: SaleRecord[],
  productos: Product[],
): Map<string, ProductSaleSummary> {
  const map = new Map<string, ProductSaleSummary>();
  const catalogByCode = new Map(productos.map((p) => [p.codigo, p]));
  const catalogByName = new Map(
    productos.map((p) => [p.nombre.toLowerCase(), p]),
  );

  for (const sale of historial) {
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      const subtotalItems = sale.items.reduce(
        (s, it) => s + (Number(it.precio) || 0) * (Number(it.cantidad) || 1),
        0,
      );
      const descuento = Number(sale.descuento) || 0;
      const factor =
        subtotalItems > 0 && descuento > 0
          ? Math.max(0, (subtotalItems - descuento) / subtotalItems)
          : 1;

      for (const item of sale.items) {
        if (item.es_reparacion) continue;
        const catalogProd =
          (item.codigo ? catalogByCode.get(item.codigo) : undefined) ||
          catalogByName.get(String(item.nombre || '').toLowerCase());
        const key = catalogProd
          ? catalogProd.codigo
          : item.codigo
            ? item.codigo
            : `n:${item.nombre}`;
        const qty = Math.max(0, Number(item.cantidad) || 0);
        const unitPrice = Number(item.precio) || 0;
        const unitCost =
          item.costo !== undefined
            ? Number(item.costo) || 0
            : Number(catalogProd?.costo) || 0;
        const ingreso = unitPrice * qty * factor;
        const costo = unitCost * qty;

        const existing = map.get(key);
        if (existing) {
          existing.unidades += qty;
          existing.ingreso += ingreso;
          existing.costo += costo;
        } else {
          map.set(key, {
            codigo: catalogProd?.codigo || item.codigo || '',
            nombre: catalogProd?.nombre || item.nombre,
            unidades: qty,
            ingreso,
            costo,
          });
        }
      }
    } else {
      // If items array is empty/absent (e.g. legacy or manually edited summary), match against detalle
      const parsed = productosDeVenta(sale, productos);
      if (parsed.length > 0) {
        const rawSum = parsed.reduce(
          (s, p) => s + (Number(p.prod.precio) || 0) * p.cantidad,
          0,
        );
        const ratio =
          rawSum > 0 ? Math.max(0, (Number(sale.total) || 0) / rawSum) : 1;

        for (const {prod, cantidad} of parsed) {
          const ingreso = (Number(prod.precio) || 0) * cantidad * ratio;
          const costo = (Number(prod.costo) || 0) * cantidad;
          const existing = map.get(prod.codigo);
          if (existing) {
            existing.unidades += cantidad;
            existing.ingreso += ingreso;
            existing.costo += costo;
          } else {
            map.set(prod.codigo, {
              codigo: prod.codigo,
              nombre: prod.nombre,
              unidades: cantidad,
              ingreso,
              costo,
            });
          }
        }
      }
    }
  }

  return map;
}
