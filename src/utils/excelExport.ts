import ExcelJS from 'exceljs';
import type {Product, RepairOrder, SaleRecord} from '../types';
import {getLocalDateStr} from './format';
import {formatearFechaCorta, OFFICIAL_LOGO_PATH} from './thermalPrint';

const NAVY_FILL = 'FF0F172A';
const SLATE_FILL = 'FF1E293B';
const TEAL_FILL = 'FF0D9488';
const MINT_TOTAL_FILL = 'FFCCFBF1';
const ZEBRA_FILL = 'FFF8FAFC';
const ARS_FORMAT = '"$ "#,##0.00';

async function loadLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(OFFICIAL_LOGO_PATH);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  return wb.xlsx.writeBuffer().then((buffer) => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

async function applyBrandBanner(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  colCount: number,
): Promise<void> {
  const lastColLetter = ws.getColumn(colCount).letter;
  ws.mergeCells(`A1:${lastColLetter}1`);
  ws.mergeCells(`A2:${lastColLetter}2`);

  const r1 = ws.getRow(1);
  r1.height = 36;
  const c1 = ws.getCell('A1');
  c1.value = title;
  c1.font = {name: 'Calibri', size: 16, bold: true, color: {argb: 'FFFFFFFF'}};
  c1.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: NAVY_FILL}};
  c1.alignment = {vertical: 'middle', horizontal: 'left', indent: 1};

  const r2 = ws.getRow(2);
  r2.height = 22;
  const c2 = ws.getCell('A2');
  c2.value = subtitle;
  c2.font = {name: 'Calibri', size: 10, italic: true, color: {argb: 'FF5EEAD4'}};
  c2.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: SLATE_FILL}};
  c2.alignment = {vertical: 'middle', horizontal: 'left', indent: 1};

  const logoBuf = await loadLogoBuffer();
  if (logoBuf) {
    const imgId = wb.addImage({
      buffer: logoBuf,
      extension: 'png',
    });
    ws.addImage(imgId, {
      tl: {col: Math.max(0, colCount - 1.15), row: 0.1},
      ext: {width: 56, height: 34},
    });
  }
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number): void {
  row.height = 26;
  for (let i = 1; i <= colCount; i++) {
    const cell = row.getCell(i);
    cell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FFFFFFFF'}};
    cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: TEAL_FILL}};
    cell.alignment = {vertical: 'middle', horizontal: 'center', wrapText: true};
    cell.border = {
      top: {style: 'thin', color: {argb: 'FF0F766E'}},
      bottom: {style: 'medium', color: {argb: 'FF0F766E'}},
      left: {style: 'thin', color: {argb: 'FF99F6E4'}},
      right: {style: 'thin', color: {argb: 'FF99F6E4'}},
    };
  }
}

export async function exportInventoryToExcel(productos: Product[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TECH';
  wb.created = new Date();

  const ws = wb.addWorksheet('Inventario', {
    views: [{state: 'frozen', ySplit: 3}],
  });

  const colCount = 11;
  ws.columns = [
    {key: 'codigo', width: 16},
    {key: 'nombre', width: 34},
    {key: 'categoria', width: 16},
    {key: 'stock', width: 10},
    {key: 'estado', width: 13},
    {key: 'costo', width: 16},
    {key: 'precio', width: 16},
    {key: 'margenUnit', width: 16},
    {key: 'margenPct', width: 13},
    {key: 'valorCosto', width: 18},
    {key: 'valorVenta', width: 18},
  ];

  const totalUnits = productos.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const nowStr = formatearFechaCorta(
    `${getLocalDateStr()} ${new Date().toTimeString().slice(0, 5)}`,
  );

  await applyBrandBanner(
    wb,
    ws,
    'TECH · Inventario y Precios',
    `Servicio Técnico & Repuestos · ${productos.length} productos · ${totalUnits} unidades en stock · Generado: ${nowStr}`,
    colCount,
  );

  const headerRow = ws.getRow(3);
  headerRow.values = [
    'CÓDIGO / SKU',
    'PRODUCTO / REPUESTO',
    'CATEGORÍA',
    'STOCK',
    'ESTADO',
    'COSTO UNIT.',
    'PRECIO VENTA',
    'MARGEN UNIT.',
    'MARGEN %',
    'VALOR STOCK (COSTO)',
    'VALOR STOCK (VENTA)',
  ];
  styleHeaderRow(headerRow, colCount);

  const firstDataRow = 4;
  productos.forEach((p, idx) => {
    const rIdx = firstDataRow + idx;
    const stock = Number(p.stock) || 0;
    const costo = Number(p.costo) || 0;
    const precio = Number(p.precio) || 0;
    const estado = stock < 3 ? 'CRÍTICO' : stock <= 5 ? 'BAJO' : 'OK';

    const row = ws.getRow(rIdx);
    row.height = 20;
    row.values = [
      p.codigo,
      p.nombre,
      p.categoria || 'Repuestos',
      stock,
      estado,
      costo,
      precio,
      {formula: `G${rIdx}-F${rIdx}`},
      {formula: `IF(G${rIdx}>0,(G${rIdx}-F${rIdx})/G${rIdx},0)`},
      {formula: `D${rIdx}*F${rIdx}`},
      {formula: `D${rIdx}*G${rIdx}`},
    ];

    const bg = idx % 2 === 1 ? ZEBRA_FILL : 'FFFFFFFF';
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = {name: 'Calibri', size: 10, color: {argb: 'FF0F172A'}};
      cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: bg}};
      cell.border = {
        bottom: {style: 'thin', color: {argb: 'FFE2E8F0'}},
        left: {style: 'thin', color: {argb: 'FFF1F5F9'}},
        right: {style: 'thin', color: {argb: 'FFF1F5F9'}},
      };
      cell.alignment = {vertical: 'middle'};
    }

    row.getCell(2).font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
    row.getCell(3).alignment = {vertical: 'middle', horizontal: 'center'};
    row.getCell(4).alignment = {vertical: 'middle', horizontal: 'center'};
    row.getCell(4).font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: {argb: stock < 3 ? 'FFDC2626' : 'FF0F172A'},
    };

    const statusCell = row.getCell(5);
    statusCell.alignment = {vertical: 'middle', horizontal: 'center'};
    if (estado === 'CRÍTICO') {
      statusCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFEE2E2'}};
      statusCell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FFB91C1C'}};
    } else if (estado === 'BAJO') {
      statusCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFFEF3C7'}};
      statusCell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FFB45309'}};
    } else {
      statusCell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFDCFCE7'}};
      statusCell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF15803D'}};
    }

    [6, 7, 8, 10, 11].forEach((c) => {
      row.getCell(c).numFmt = ARS_FORMAT;
      row.getCell(c).alignment = {vertical: 'middle', horizontal: 'right'};
    });
    row.getCell(9).numFmt = '0.0%';
    row.getCell(9).alignment = {vertical: 'middle', horizontal: 'right'};
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + productos.length - 1);
  ws.autoFilter = {
    from: {row: 3, column: 1},
    to: {row: lastDataRow, column: colCount},
  };

  if (productos.length > 0) {
    const totalsRowIdx = lastDataRow + 1;
    const totalsRow = ws.getRow(totalsRowIdx);
    totalsRow.height = 24;
    totalsRow.values = [
      '',
      '',
      'TOTALES',
      {formula: `SUM(D${firstDataRow}:D${lastDataRow})`},
      '',
      '',
      '',
      '',
      '',
      {formula: `SUM(J${firstDataRow}:J${lastDataRow})`},
      {formula: `SUM(K${firstDataRow}:K${lastDataRow})`},
    ];
    for (let c = 1; c <= colCount; c++) {
      const cell = totalsRow.getCell(c);
      cell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
      cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: MINT_TOTAL_FILL}};
      cell.border = {
        top: {style: 'double', color: {argb: 'FF0D9488'}},
        bottom: {style: 'thin', color: {argb: 'FF0D9488'}},
      };
      cell.alignment = {vertical: 'middle'};
    }
    totalsRow.getCell(3).alignment = {vertical: 'middle', horizontal: 'right'};
    totalsRow.getCell(4).alignment = {vertical: 'middle', horizontal: 'center'};
    totalsRow.getCell(10).numFmt = ARS_FORMAT;
    totalsRow.getCell(10).alignment = {vertical: 'middle', horizontal: 'right'};
    totalsRow.getCell(11).numFmt = ARS_FORMAT;
    totalsRow.getCell(11).alignment = {vertical: 'middle', horizontal: 'right'};

    const profitRowIdx = totalsRowIdx + 1;
    const profitRow = ws.getRow(profitRowIdx);
    profitRow.height = 24;
    ws.mergeCells(`A${profitRowIdx}:J${profitRowIdx}`);
    profitRow.getCell(1).value = 'GANANCIA POTENCIAL DEL STOCK (venta - costo)';
    profitRow.getCell(11).value = {formula: `K${totalsRowIdx}-J${totalsRowIdx}`};
    for (let c = 1; c <= colCount; c++) {
      const cell = profitRow.getCell(c);
      cell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
      cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: MINT_TOTAL_FILL}};
      cell.border = {
        top: {style: 'thin', color: {argb: 'FF0D9488'}},
        bottom: {style: 'medium', color: {argb: 'FF0D9488'}},
      };
      cell.alignment = {vertical: 'middle'};
    }
    profitRow.getCell(1).alignment = {vertical: 'middle', horizontal: 'right'};
    profitRow.getCell(11).numFmt = ARS_FORMAT;
    profitRow.getCell(11).alignment = {vertical: 'middle', horizontal: 'right'};
  }

  await downloadWorkbook(wb, `TECH-Inventario-${getLocalDateStr()}.xlsx`);
}

export async function exportSalesToExcel(
  ventas: SaleRecord[],
  dateFrom: string,
  dateTo: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TECH';
  wb.created = new Date();

  const ws = wb.addWorksheet('Ventas', {
    views: [{state: 'frozen', ySplit: 3}],
  });

  const colCount = 6;
  ws.columns = [
    {key: 'recibo', width: 18},
    {key: 'fecha', width: 20},
    {key: 'detalle', width: 48},
    {key: 'metodo', width: 20},
    {key: 'descuento', width: 15},
    {key: 'total', width: 18},
  ];

  const periodLabel =
    dateFrom || dateTo
      ? `Período: ${dateFrom || 'Inicio'} a ${dateTo || 'Hoy'}`
      : 'Período completo';
  const nowStr = formatearFechaCorta(
    `${getLocalDateStr()} ${new Date().toTimeString().slice(0, 5)}`,
  );

  await applyBrandBanner(
    wb,
    ws,
    'TECH · Historial de Ventas y Cobros',
    `${periodLabel} · ${ventas.length} registros · Generado: ${nowStr}`,
    colCount,
  );

  const headerRow = ws.getRow(3);
  headerRow.values = [
    'N° RECIBO',
    'FECHA Y HORA',
    'DETALLE DE TRABAJOS / REPUESTOS',
    'MÉTODO DE PAGO',
    'DESCUENTO',
    'MONTO TOTAL',
  ];
  styleHeaderRow(headerRow, colCount);

  const firstDataRow = 4;
  ventas.forEach((v, idx) => {
    const rIdx = firstDataRow + idx;
    const row = ws.getRow(rIdx);
    row.height = 20;
    row.values = [
      v.n_recibo,
      formatearFechaCorta(v.fecha),
      v.detalle,
      v.metodo_pago,
      Number(v.descuento) || 0,
      Number(v.total) || 0,
    ];

    const bg = idx % 2 === 1 ? ZEBRA_FILL : 'FFFFFFFF';
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = {name: 'Calibri', size: 10, color: {argb: 'FF0F172A'}};
      cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: bg}};
      cell.border = {bottom: {style: 'thin', color: {argb: 'FFE2E8F0'}}};
      cell.alignment = {vertical: 'middle'};
    }
    row.getCell(1).font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
    row.getCell(4).alignment = {vertical: 'middle', horizontal: 'center'};
    row.getCell(5).numFmt = ARS_FORMAT;
    row.getCell(5).alignment = {vertical: 'middle', horizontal: 'right'};
    row.getCell(6).numFmt = ARS_FORMAT;
    row.getCell(6).font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
    row.getCell(6).alignment = {vertical: 'middle', horizontal: 'right'};
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + ventas.length - 1);
  ws.autoFilter = {
    from: {row: 3, column: 1},
    to: {row: lastDataRow, column: colCount},
  };

  if (ventas.length > 0) {
    const totalsRowIdx = lastDataRow + 1;
    const totalsRow = ws.getRow(totalsRowIdx);
    totalsRow.height = 24;
    totalsRow.values = [
      '',
      '',
      '',
      'TOTAL COBRADO',
      {formula: `SUM(E${firstDataRow}:E${lastDataRow})`},
      {formula: `SUM(F${firstDataRow}:F${lastDataRow})`},
    ];
    for (let c = 1; c <= colCount; c++) {
      const cell = totalsRow.getCell(c);
      cell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
      cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: MINT_TOTAL_FILL}};
      cell.border = {
        top: {style: 'double', color: {argb: 'FF0D9488'}},
        bottom: {style: 'medium', color: {argb: 'FF0D9488'}},
      };
      cell.alignment = {vertical: 'middle'};
    }
    totalsRow.getCell(4).alignment = {vertical: 'middle', horizontal: 'right'};
    totalsRow.getCell(5).numFmt = ARS_FORMAT;
    totalsRow.getCell(5).alignment = {vertical: 'middle', horizontal: 'right'};
    totalsRow.getCell(6).numFmt = ARS_FORMAT;
    totalsRow.getCell(6).alignment = {vertical: 'middle', horizontal: 'right'};
  }

  await downloadWorkbook(wb, `TECH-Ventas-${getLocalDateStr()}.xlsx`);
}

export async function exportRepairsToExcel(reparaciones: RepairOrder[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'TECH';
  wb.created = new Date();

  const ws = wb.addWorksheet('Reparaciones', {
    views: [{state: 'frozen', ySplit: 3}],
  });

  const colCount = 10;
  ws.columns = [
    {key: 'orden', width: 14},
    {key: 'fecha', width: 14},
    {key: 'cliente', width: 24},
    {key: 'telefono', width: 16},
    {key: 'equipo', width: 26},
    {key: 'falla', width: 32},
    {key: 'estado', width: 18},
    {key: 'presupuesto', width: 16},
    {key: 'senia', width: 15},
    {key: 'saldo', width: 16},
  ];

  const nowStr = formatearFechaCorta(
    `${getLocalDateStr()} ${new Date().toTimeString().slice(0, 5)}`,
  );

  await applyBrandBanner(
    wb,
    ws,
    'TECH · Órdenes de Servicio Técnico',
    `Taller de Reparaciones · ${reparaciones.length} órdenes · Generado: ${nowStr}`,
    colCount,
  );

  const headerRow = ws.getRow(3);
  headerRow.values = [
    'N° ORDEN',
    'INGRESO',
    'CLIENTE',
    'TELÉFONO',
    'EQUIPO',
    'FALLA DECLARADA',
    'ESTADO',
    'PRESUPUESTO',
    'SEÑA',
    'SALDO',
  ];
  styleHeaderRow(headerRow, colCount);

  const firstDataRow = 4;
  reparaciones.forEach((r, idx) => {
    const rIdx = firstDataRow + idx;
    const presupuesto = Number(r.presupuesto) || 0;
    const senia = r.estado === 'Retirado' ? presupuesto : Number(r.senia) || 0;

    const row = ws.getRow(rIdx);
    row.height = 20;
    row.values = [
      r.n_orden,
      formatearFechaCorta(r.fecha),
      r.cliente,
      r.telefono || '-',
      r.equipo,
      r.falla || 'Revisión técnica',
      r.estado,
      presupuesto,
      senia,
      {formula: `MAX(0,H${rIdx}-I${rIdx})`},
    ];

    const bg = idx % 2 === 1 ? ZEBRA_FILL : 'FFFFFFFF';
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = {name: 'Calibri', size: 10, color: {argb: 'FF0F172A'}};
      cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: bg}};
      cell.border = {bottom: {style: 'thin', color: {argb: 'FFE2E8F0'}}};
      cell.alignment = {vertical: 'middle'};
    }
    row.getCell(1).font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
    row.getCell(7).alignment = {vertical: 'middle', horizontal: 'center'};
    [8, 9, 10].forEach((c) => {
      row.getCell(c).numFmt = ARS_FORMAT;
      row.getCell(c).alignment = {vertical: 'middle', horizontal: 'right'};
    });
  });

  const lastDataRow = Math.max(firstDataRow, firstDataRow + reparaciones.length - 1);
  ws.autoFilter = {
    from: {row: 3, column: 1},
    to: {row: lastDataRow, column: colCount},
  };

  if (reparaciones.length > 0) {
    const totalsRowIdx = lastDataRow + 1;
    const totalsRow = ws.getRow(totalsRowIdx);
    totalsRow.height = 24;
    totalsRow.values = [
      '',
      '',
      '',
      '',
      '',
      '',
      'TOTALES',
      {formula: `SUM(H${firstDataRow}:H${lastDataRow})`},
      {formula: `SUM(I${firstDataRow}:I${lastDataRow})`},
      {formula: `SUM(J${firstDataRow}:J${lastDataRow})`},
    ];
    for (let c = 1; c <= colCount; c++) {
      const cell = totalsRow.getCell(c);
      cell.font = {name: 'Calibri', size: 10, bold: true, color: {argb: 'FF0F172A'}};
      cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: MINT_TOTAL_FILL}};
      cell.border = {
        top: {style: 'double', color: {argb: 'FF0D9488'}},
        bottom: {style: 'medium', color: {argb: 'FF0D9488'}},
      };
      cell.alignment = {vertical: 'middle'};
    }
    totalsRow.getCell(7).alignment = {vertical: 'middle', horizontal: 'right'};
    [8, 9, 10].forEach((c) => {
      totalsRow.getCell(c).numFmt = ARS_FORMAT;
      totalsRow.getCell(c).alignment = {vertical: 'middle', horizontal: 'right'};
    });
  }

  await downloadWorkbook(wb, `TECH-Reparaciones-${getLocalDateStr()}.xlsx`);
}
