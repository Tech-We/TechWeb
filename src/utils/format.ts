import type {Product, RepairOrder, SaleRecord} from '../types';

export function formatARS(amount: number, showDecimals = true): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(safe);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getLocalDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getLocalDateTimeStr(d: Date = new Date()): string {
  return `${getLocalDateStr(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function downloadJSONBackup(data: {
  productos: Product[];
  reparaciones: RepairOrder[];
  historial: SaleRecord[];
}): void {
  const payload = {
    app: 'TECH',
    exportedAt: new Date().toISOString(),
    productos: data.productos,
    reparaciones: data.reparaciones,
    historial: data.historial,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tech-respaldo-${getLocalDateStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
