import {useMemo, useState} from 'react';
import {Search, FileSpreadsheet, Plus, Pencil, Trash2} from 'lucide-react';
import type {Product} from '../types';
import {formatARS} from '../utils/format';
import {exportInventoryToExcel} from '../utils/excelExport';

interface InventorySectionProps {
  productos: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function InventorySection({
  productos,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onNotify,
}: InventorySectionProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODAS');
  const [exporting, setExporting] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return ['TODAS', ...Array.from(set).sort()];
  }, [productos]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return productos.filter((p) => {
      if (selectedCategory !== 'TODAS' && p.categoria !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      );
    });
  }, [productos, query, selectedCategory]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await exportInventoryToExcel(filtered);
      onNotify('success', `Planilla Excel generada (${filtered.length} productos).`);
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
            Inventario y Precios
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Repuesto</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            <span>{exporting ? 'Generando...' : 'Exportar Excel'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-7 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código de barras o nombre de repuesto..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-600"
          />
        </div>

        <div className="md:col-span-5">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-teal-600"
            aria-label="Filtrar por categoría"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'TODAS' ? 'Todas las Categorías' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Cód. Barras</th>
                <th className="py-3 px-4">Repuesto / Producto</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4 text-right">Costo ($)</th>
                <th className="py-3 px-4 text-right">Precio Venta ($)</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center text-slate-500">
                    No hay repuestos registrados que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.codigo} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {p.codigo}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.nombre}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {p.categoria}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular-nums whitespace-nowrap">
                      <span
                        className={`font-bold ${
                          p.stock <= 2 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {p.stock} un.
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600 tabular-nums whitespace-nowrap">
                      {formatARS(p.costo, false)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatARS(p.precio, false)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditProduct(p)}
                          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Editar repuesto"
                          aria-label="Editar repuesto"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProduct(p)}
                          className="p-2 rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar repuesto"
                          aria-label="Eliminar repuesto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
