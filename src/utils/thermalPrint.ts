import type {RepairOrder, SaleItem} from '../types';
import {formatARS} from './format';

export const OFFICIAL_LOGO_PATH = '/assets/aistudio/logo_1a55bcb5_1a55bcb5.png';

export type PaperWidth = '80' | '58' | 'A4';

const PAPER_STORAGE_KEY = 'tech_paper_width';

export function getAnchoPapel(): PaperWidth {
  try {
    const saved = localStorage.getItem(PAPER_STORAGE_KEY);
    if (saved === '58' || saved === '80' || saved === 'A4') {
      return saved;
    }
  } catch {
    // ignore
  }
  return '80';
}

export function setAnchoPapel(val: PaperWidth): void {
  try {
    localStorage.setItem(PAPER_STORAGE_KEY, val);
  } catch {
    // ignore
  }
}

export const TICKET_CSS = `
  .tech-ticket {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #0f172a;
    font-size: 11px;
    line-height: 1.45;
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }
  .tech-ticket-header {
    text-align: center;
    padding-bottom: 8px;
    border-bottom: 1px dashed #94a3b8;
    margin-bottom: 8px;
  }
  .tech-ticket-logo {
    max-width: 120px;
    max-height: 54px;
    margin: 0 auto 6px auto;
    display: block;
    object-fit: contain;
  }
  .tech-ticket-brand {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #0f172a;
  }
  .tech-ticket-sub {
    font-size: 10px;
    color: #475569;
  }
  .tech-ticket-title {
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 4px 0;
    margin-bottom: 6px;
    border-bottom: 1px dashed #94a3b8;
  }
  .tech-ticket-meta {
    font-size: 10.5px;
    margin-bottom: 8px;
  }
  .tech-ticket-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }
  .tech-ticket-divider {
    border-top: 1px dashed #94a3b8;
    margin: 8px 0;
  }
  .tech-ticket-items {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  .tech-ticket-items th {
    text-align: left;
    font-weight: 700;
    padding: 3px 0;
    border-bottom: 1px solid #cbd5e1;
    font-size: 9.5px;
    text-transform: uppercase;
  }
  .tech-ticket-items td {
    padding: 4px 0;
    vertical-align: top;
  }
  .tech-ticket-right {
    text-align: right;
    white-space: nowrap;
  }
  .tech-ticket-total-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 800;
    padding-top: 4px;
    margin-top: 4px;
    border-top: 1px solid #0f172a;
  }
  .tech-ticket-box {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 8px;
    margin: 8px 0;
    background: #f8fafc;
  }
  .tech-ticket-footer {
    text-align: center;
    font-size: 10px;
    color: #475569;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed #94a3b8;
  }
`;

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatearFechaCorta(str: string): string {
  if (!str) return '—';
  const clean = str.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return clean;
  const [, yyyy, mm, dd, hh, min] = match;
  return hh && min ? `${dd}/${mm}/${yyyy} ${hh}:${min}` : `${dd}/${mm}/${yyyy}`;
}

let cachedThermalLogoPromise: Promise<string> | null = null;
let cachedWatermarkPromise: Promise<string> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });
}

export function prepararLogoTicket(): Promise<string> {
  if (cachedThermalLogoPromise) return cachedThermalLogoPromise;
  cachedThermalLogoPromise = loadImage(OFFICIAL_LOGO_PATH)
    .then((img) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 320;
      canvas.height = img.naturalHeight || 190;
      const ctx = canvas.getContext('2d');
      if (!ctx) return OFFICIAL_LOGO_PATH;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert black-background logo to crisp dark-on-transparent thermal print ink
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance < 28) {
          data[i + 3] = 0;
        } else {
          const ink = Math.max(0, Math.min(255, Math.round(255 - luminance * 1.15)));
          data[i] = ink;
          data[i + 1] = ink;
          data[i + 2] = ink;
          data[i + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    })
    .catch(() => OFFICIAL_LOGO_PATH);

  return cachedThermalLogoPromise;
}

export function prepararLogoWatermark(): Promise<string> {
  if (cachedWatermarkPromise) return cachedWatermarkPromise;
  cachedWatermarkPromise = loadImage(OFFICIAL_LOGO_PATH)
    .then((img) => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 320;
      canvas.height = img.naturalHeight || 190;
      const ctx = canvas.getContext('2d');
      if (!ctx) return OFFICIAL_LOGO_PATH;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Strip near-black background while preserving vibrant cyan/magenta/white foreground
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const maxCh = Math.max(r, g, b);
        if (maxCh < 28) {
          data[i + 3] = 0;
        } else if (maxCh < 55) {
          data[i + 3] = Math.round(((maxCh - 28) / 27) * 255);
        }
        // Darken bright white "TECH" text slightly so it reads on light slate backgrounds
        if (r > 210 && g > 210 && b > 210) {
          data[i] = 15;
          data[i + 1] = 23;
          data[i + 2] = 42;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    })
    .catch(() => OFFICIAL_LOGO_PATH);

  return cachedWatermarkPromise;
}

export function buildSaleTicketHTML(params: {
  titulo: string;
  nRecibo: string;
  fecha?: string;
  metodoPago: string;
  items: SaleItem[];
  subtotal: number;
  descuento: number;
  totalFinal: number;
  pagaCon: number;
  vuelto: number;
  logoUrl: string;
}): string {
  const fechaDisplay = params.fecha
    ? formatearFechaCorta(params.fecha)
    : formatearFechaCorta(new Date().toISOString().slice(0, 16).replace('T', ' '));

  const rowsHtml = params.items
    .map((item) => {
      const qty = Math.max(1, Number(item.cantidad) || 1);
      const unit = Number(item.precio) || 0;
      const lineTotal = unit * qty;
      return `
        <tr>
          <td>
            <div><strong>${escapeHtml(item.nombre)}</strong></div>
            ${
              item.codigo
                ? `<div style="font-size:9px;color:#64748b;">Cód. ${escapeHtml(item.codigo)}</div>`
                : ''
            }
          </td>
          <td class="tech-ticket-right">${qty}x ${escapeHtml(formatARS(unit, false))}</td>
          <td class="tech-ticket-right"><strong>${escapeHtml(formatARS(lineTotal, false))}</strong></td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="tech-ticket" id="printable-receipt">
      <div class="tech-ticket-header">
        <img src="${escapeHtml(params.logoUrl)}" alt="TECH" class="tech-ticket-logo" />
        <div class="tech-ticket-brand">TECH</div>
        <div class="tech-ticket-sub">Servicio Técnico Especializado &amp; Repuestos</div>
      </div>

      <div class="tech-ticket-title">${escapeHtml(params.titulo)}</div>

      <div class="tech-ticket-meta">
        <div class="tech-ticket-row"><span>Recibo:</span><strong>${escapeHtml(params.nRecibo)}</strong></div>
        <div class="tech-ticket-row"><span>Fecha:</span><span>${escapeHtml(fechaDisplay)}</span></div>
        <div class="tech-ticket-row"><span>Pago:</span><span>${escapeHtml(params.metodoPago)}</span></div>
      </div>

      <div class="tech-ticket-divider"></div>

      <table class="tech-ticket-items">
        <thead>
          <tr>
            <th>Detalle</th>
            <th class="tech-ticket-right">Cant/P.U</th>
            <th class="tech-ticket-right">Subt.</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="tech-ticket-divider"></div>

      <div class="tech-ticket-row"><span>Subtotal:</span><span>${escapeHtml(formatARS(params.subtotal))}</span></div>
      ${
        params.descuento > 0
          ? `<div class="tech-ticket-row"><span>Descuento:</span><span>-${escapeHtml(formatARS(params.descuento))}</span></div>`
          : ''
      }
      <div class="tech-ticket-total-row">
        <span>TOTAL</span>
        <span>${escapeHtml(formatARS(params.totalFinal))}</span>
      </div>

      ${
        params.metodoPago === 'Efectivo'
          ? `
            <div class="tech-ticket-row" style="margin-top:6px;"><span>Abona con:</span><span>${escapeHtml(formatARS(params.pagaCon))}</span></div>
            <div class="tech-ticket-row"><span>Vuelto:</span><strong>${escapeHtml(formatARS(params.vuelto))}</strong></div>
          `
          : ''
      }

      <div class="tech-ticket-footer">
        <div>¡Gracias por su compra!</div>
        <div>Conserve este comprobante.</div>
      </div>
    </div>
  `;
}

export function buildRepairTicketHTML(orden: RepairOrder, logoUrl: string): string {
  const presupuesto = Number(orden.presupuesto) || 0;
  const senia = orden.estado === 'Retirado' ? presupuesto : Number(orden.senia) || 0;
  const saldo = Math.max(0, presupuesto - senia);

  return `
    <div class="tech-ticket" id="printable-receipt">
      <div class="tech-ticket-header">
        <img src="${escapeHtml(logoUrl)}" alt="TECH" class="tech-ticket-logo" />
        <div class="tech-ticket-brand">TECH</div>
        <div class="tech-ticket-sub">Servicio Técnico Especializado</div>
      </div>

      <div class="tech-ticket-title">ORDEN DE SERVICIO TÉCNICO</div>

      <div class="tech-ticket-meta">
        <div class="tech-ticket-row"><span>N° Orden:</span><strong>${escapeHtml(orden.n_orden)}</strong></div>
        <div class="tech-ticket-row"><span>Ingreso:</span><span>${escapeHtml(formatearFechaCorta(orden.fecha))}</span></div>
        <div class="tech-ticket-row"><span>Estado:</span><strong>${escapeHtml(orden.estado)}</strong></div>
      </div>

      <div class="tech-ticket-box">
        <div class="tech-ticket-row"><span>Cliente:</span><strong>${escapeHtml(orden.cliente)}</strong></div>
        ${
          orden.telefono
            ? `<div class="tech-ticket-row"><span>Teléfono:</span><span>${escapeHtml(orden.telefono)}</span></div>`
            : ''
        }
        <div style="margin-top:4px;"><strong>Equipo:</strong> ${escapeHtml(orden.equipo)}</div>
        <div style="margin-top:2px;"><strong>Falla / Trabajo:</strong> ${escapeHtml(orden.falla || 'Revisión técnica general')}</div>
      </div>

      <div class="tech-ticket-row"><span>Presupuesto:</span><strong>${escapeHtml(formatARS(presupuesto))}</strong></div>
      <div class="tech-ticket-row"><span>Seña abonada:</span><span>${escapeHtml(formatARS(senia))}</span></div>
      <div class="tech-ticket-total-row">
        <span>SALDO RESTANTE</span>
        <span>${escapeHtml(formatARS(saldo))}</span>
      </div>

      <div class="tech-ticket-footer">
        <div>Presentar este comprobante para retirar el equipo.</div>
        <div>Garantía sujeta a revisión de taller.</div>
      </div>
    </div>
  `;
}

export function imprimirTicketIframe(
  html: string,
  title: string,
  papel: PaperWidth,
): void {
  const pageSize =
    papel === '58' ? '58mm auto' : papel === '80' ? '80mm auto' : 'A4 portrait';
  const containerWidth =
    papel === '58' ? '52mm' : papel === '80' ? '74mm' : '110mm';

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page {
        size: ${pageSize};
        margin: ${papel === 'A4' ? '12mm' : '2mm'};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 4px;
        background: #ffffff;
        color: #0f172a;
      }
      .tech-ticket {
        max-width: ${containerWidth};
      }
      ${TICKET_CSS}
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    }
  };

  setTimeout(triggerPrint, 250);
}
