import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  X,
  Wrench,
  Package,
  Printer,
  ShieldAlert,
  Check,
  ScanBarcode,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Pencil,
  Camera,
  CameraOff,
  ZoomIn,
} from 'lucide-react';
import type {Html5Qrcode} from 'html5-qrcode';
import {
  CLAVE_ZOOM,
  crearLectorCamara,
  iniciarMejorCamara,
  sonidoEscaneo,
  type ZoomCapabilities,
} from '../utils/camera';
import type {
  PaymentMethod,
  Product,
  ReceiptData,
  RepairOrder,
  RepairStatus,
  SaleRecord,
} from '../types';
import {formatARS} from '../utils/format';
import {
  TICKET_CSS,
  buildRepairTicketHTML,
  buildSaleTicketHTML,
  getAnchoPapel,
  imprimirTicketIframe,
  prepararLogoTicket,
  prepararLogoWatermark,
  setAnchoPapel,
  type PaperWidth,
  OFFICIAL_LOGO_PATH,
} from '../utils/thermalPrint';
import {productosDeVenta, siguienteNroRecibo} from '../utils/salesAnalytics';

interface RepairModalProps {
  open: boolean;
  editingOrder: RepairOrder | null;
  onClose: () => void;
  onSave: (data: {
    id?: number;
    cliente: string;
    telefono: string;
    equipo: string;
    falla: string;
    estado: RepairStatus;
    presupuesto: number;
    senia: number;
    costo_repuesto: number;
  }) => void;
}

export function RepairModal({open, editingOrder, onClose, onSave}: RepairModalProps) {
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [equipo, setEquipo] = useState('');
  const [falla, setFalla] = useState('');
  const [costoRepuesto, setCostoRepuesto] = useState('0');
  const [estado, setEstado] = useState<RepairStatus>('En Reparación');
  const [presupuesto, setPresupuesto] = useState('0');
  const [senia, setSenia] = useState('0');

  useEffect(() => {
    if (open) {
      if (editingOrder) {
        setCliente(editingOrder.cliente);
        setTelefono(editingOrder.telefono);
        setEquipo(editingOrder.equipo);
        setFalla(editingOrder.falla);
        setCostoRepuesto(String(editingOrder.costo_repuesto ?? 0));
        setEstado(editingOrder.estado);
        setPresupuesto(String(editingOrder.presupuesto ?? 0));
        setSenia(String(editingOrder.senia ?? 0));
      } else {
        setCliente('');
        setTelefono('');
        setEquipo('');
        setFalla('');
        setCostoRepuesto('0');
        setEstado('En Reparación');
        setPresupuesto('0');
        setSenia('0');
      }
    }
  }, [open, editingOrder]);

  if (!open) return null;

  const presNum = parseFloat(presupuesto || '0') || 0;
  const seniaNum = estado === 'Retirado' ? presNum : parseFloat(senia || '0') || 0;
  const saldoRestante = Math.max(0, presNum - seniaNum);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim() || !equipo.trim()) return;
    onSave({
      id: editingOrder?.id,
      cliente: cliente.trim(),
      telefono: telefono.trim(),
      equipo: equipo.trim(),
      falla: falla.trim(),
      estado,
      presupuesto: presNum,
      senia: seniaNum,
      costo_repuesto: parseFloat(costoRepuesto || '0') || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-4 h-4 text-teal-400" />
            <h2 className="text-base font-bold">
              {editingOrder
                ? `Editar Orden ${editingOrder.n_orden}`
                : 'Ingresar Dispositivo al Taller'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cliente *
              </label>
              <input
                type="text"
                required
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 381 1234567"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Equipo / Modelo *
            </label>
            <input
              type="text"
              required
              value={equipo}
              onChange={(e) => setEquipo(e.target.value)}
              placeholder="Ej: Módulo Samsung A12 / iPhone 11"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Falla Declarada
            </label>
            <textarea
              rows={2}
              value={falla}
              onChange={(e) => setFalla(e.target.value)}
              placeholder="Detalle la falla o trabajo a realizar..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-red-700 mb-1">
                Costo Repuesto (Interno $)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costoRepuesto}
                onChange={(e) => setCostoRepuesto(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-red-200 bg-red-50/30 text-sm tabular-nums focus:outline-none focus:border-red-500"
              />
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Oculto en el ticket del cliente.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado
              </label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as RepairStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
              >
                <option value="En Reparación">En Reparación</option>
                <option value="Listo para Entregar">Listo para Entregar</option>
                <option value="Retirado">Retirado / Pagado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Presupuesto ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Seña Abonada ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                disabled={estado === 'Retirado'}
                value={estado === 'Retirado' ? String(presNum) : senia}
                onChange={(e) => setSenia(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:border-teal-600 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 flex items-center justify-between text-sm font-bold text-teal-900">
            <span>Saldo Restante</span>
            <span className="tabular-nums text-base">{formatARS(saldoRestante)}</span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold"
            >
              <Check className="w-4 h-4" />
              <span>{editingOrder ? 'Actualizar Orden' : 'Guardar Orden'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProductModalProps {
  open: boolean;
  editingProduct: Product | null;
  onClose: () => void;
  onSave: (product: Product, isEdit: boolean) => void;
}

export function ProductModal({open, editingProduct, onClose, onSave}: ProductModalProps) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Repuestos');
  const [stock, setStock] = useState('1');
  const [costo, setCosto] = useState('0');
  const [precio, setPrecio] = useState('0');

  useEffect(() => {
    if (open) {
      if (editingProduct) {
        setCodigo(editingProduct.codigo);
        setNombre(editingProduct.nombre);
        setCategoria(editingProduct.categoria);
        setStock(String(editingProduct.stock));
        setCosto(String(editingProduct.costo));
        setPrecio(String(editingProduct.precio));
      } else {
        setCodigo('');
        setNombre('');
        setCategoria('Repuestos');
        setStock('1');
        setCosto('0');
        setPrecio('0');
      }
    }
  }, [open, editingProduct]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim() || !nombre.trim()) return;
    onSave(
      {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        categoria: categoria.trim() || 'Repuestos',
        stock: Math.max(0, parseInt(stock || '0', 10) || 0),
        costo: Math.max(0, parseFloat(costo || '0') || 0),
        precio: Math.max(0, parseFloat(precio || '0') || 0),
      },
      Boolean(editingProduct),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="bg-slate-800 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Package className="w-4 h-4 text-teal-400" />
            <h2 className="text-base font-bold">
              {editingProduct ? 'Editar Repuesto' : 'Nuevo Repuesto / Producto'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código de Barras *
              </label>
              <input
                type="text"
                required
                readOnly={Boolean(editingProduct)}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej: 2006"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm read-only:bg-slate-100 focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Repuestos"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre del Repuesto / Producto *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Módulo OLED iPhone 13"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stock
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Costo ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Precio ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold"
            >
              {editingProduct ? 'Guardar Cambios' : 'Agregar Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptModal({receipt, onClose}: ReceiptModalProps) {
  const [papel, setPapel] = useState<PaperWidth>(() => getAnchoPapel());
  const [thermalLogoUrl, setThermalLogoUrl] = useState<string>(OFFICIAL_LOGO_PATH);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);

  useEffect(() => {
    prepararLogoTicket().then((url) => setThermalLogoUrl(url));
    prepararLogoWatermark().then((url) => setWatermarkUrl(url));
  }, []);

  const ticketHtml = useMemo(() => {
    if (!receipt) return '';
    if (receipt.type === 'sale') {
      return buildSaleTicketHTML({
        titulo: 'COMPROBANTE DE VENTA',
        nRecibo: receipt.n_recibo,
        fecha: receipt.fecha,
        metodoPago: receipt.metodo_pago,
        items: receipt.items,
        subtotal: receipt.subtotal,
        descuento: receipt.descuento,
        totalFinal: receipt.total,
        pagaCon: receipt.paga_con,
        vuelto: receipt.vuelto,
        logoUrl: thermalLogoUrl,
      });
    }
    return buildRepairTicketHTML(receipt.orden, thermalLogoUrl);
  }, [receipt, thermalLogoUrl]);

  if (!receipt) return null;

  const handleChangePaper = (val: PaperWidth) => {
    setPapel(val);
    setAnchoPapel(val);
  };

  const handlePrint = () => {
    const title =
      receipt.type === 'sale' ? 'Comprobante de venta' : 'Orden de servicio';
    imprimirTicketIframe(ticketHtml, title, papel);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="bg-slate-100 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-teal-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            <h2 className="text-base font-bold">
              {receipt.type === 'sale'
                ? 'Comprobante de Venta / Servicio'
                : 'Orden de Servicio Técnico'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-teal-100 hover:text-white p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-5 max-h-[75dvh] overflow-y-auto">
          <style>{TICKET_CSS}</style>
          <div className="relative bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm mx-auto w-full max-w-[340px] overflow-x-auto overflow-y-hidden">
            {watermarkUrl && (
              <img
                src={watermarkUrl}
                alt=""
                aria-hidden="true"
                className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[230px] h-[135px] object-contain opacity-[0.09] z-0 print:hidden"
              />
            )}
            <div
              className="relative z-10"
              dangerouslySetInnerHTML={{__html: ticketHtml}}
            />
          </div>
        </div>

        <div className="px-5 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <select
            value={papel}
            onChange={(e) => handleChangePaper(e.target.value as PaperWidth)}
            className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-teal-600"
            title="Ancho del papel de la impresora"
          >
            <option value="80">Papel 80 mm</option>
            <option value="58">Papel 58 mm</option>
            <option value="A4">Hoja A4</option>
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ScannerCartLine {
  prod: Product;
  cantidad: number;
}

interface ScannerCheckoutModalProps {
  open: boolean;
  items: ScannerCartLine[];
  productos: Product[];
  historial: SaleRecord[];
  onAddByCode: (codigo: string) => boolean | void;
  onChangeQty: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onCancelSale: () => void;
  onKeepScanning: () => void;
  onConfirmSale: (payload: {
    metodo: PaymentMethod;
    descuento: number;
    pagaCon: number;
  }) => void;
}

export function ScannerCheckoutModal({
  open,
  items,
  historial,
  onAddByCode,
  onChangeQty,
  onRemoveItem,
  onCancelSale,
  onKeepScanning,
  onConfirmSale,
}: ScannerCheckoutModalProps) {
  const [codigoExtra, setCodigoExtra] = useState('');
  const [metodo, setMetodo] = useState<PaymentMethod>('Efectivo');
  const [descuentoStr, setDescuentoStr] = useState('0');
  const [pagaConStr, setPagaConStr] = useState('0');
  const [thermalLogoUrl, setThermalLogoUrl] = useState<string>(OFFICIAL_LOGO_PATH);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);

  // Inline camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [zoomCap, setZoomCap] = useState<ZoomCapabilities | null>(null);
  const [zoomVal, setZoomVal] = useState(1);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const checkoutCamRef = useRef<Html5Qrcode | null>(null);
  const lastCamScanRef = useRef<{code: string; time: number}>({code: '', time: 0});
  const onAddByCodeRef = useRef(onAddByCode);

  useEffect(() => {
    onAddByCodeRef.current = onAddByCode;
  }, [onAddByCode]);

  useEffect(() => {
    prepararLogoTicket().then((url) => setThermalLogoUrl(url));
    prepararLogoWatermark().then((url) => setWatermarkUrl(url));
  }, []);

  const stopModalCamera = async () => {
    if (checkoutCamRef.current) {
      try {
        if (checkoutCamRef.current.isScanning) {
          await checkoutCamRef.current.stop();
        }
        checkoutCamRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      checkoutCamRef.current = null;
    }
    setCameraActive(false);
    setZoomCap(null);
  };

  useEffect(() => {
    if (!open) {
      stopModalCamera();
      setCameraError(null);
      setLastScannedCode(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (checkoutCamRef.current) {
        if (checkoutCamRef.current.isScanning) {
          checkoutCamRef.current.stop().catch(() => undefined);
        }
        checkoutCamRef.current = null;
      }
    };
  }, []);

  const toggleModalCamera = async () => {
    if (cameraActive) {
      await stopModalCamera();
      return;
    }

    setCameraError(null);
    setLastScannedCode(null);
    setCameraActive(true);

    try {
      const qr = await crearLectorCamara('checkout-qr-reader');
      checkoutCamRef.current = qr;
      const zoom = await iniciarMejorCamara(qr, (decodedText) => {
        const now = Date.now();
        if (
          decodedText === lastCamScanRef.current.code &&
          now - lastCamScanRef.current.time < 2000
        ) {
          return;
        }
        lastCamScanRef.current = {code: decodedText, time: now};
        const added = onAddByCodeRef.current(decodedText);
        const ok = added !== false;
        sonidoEscaneo(ok);
        setLastScannedCode(ok ? `Agregado: ${decodedText}` : `No disponible: ${decodedText}`);
      });
      setZoomCap(zoom);
      if (zoom) setZoomVal(zoom.valor);
    } catch {
      await stopModalCamera();
      setCameraError(
        'No se pudo acceder a la cámara. Verificá los permisos o ingresá el código manualmente.',
      );
    }
  };

  const handleModalZoomChange = (val: number) => {
    setZoomVal(val);
    localStorage.setItem(CLAVE_ZOOM, String(val));
    try {
      checkoutCamRef.current
        ?.applyVideoConstraints({advanced: [{zoom: val}]} as unknown as MediaTrackConstraints)
        .catch(() => undefined);
    } catch {
      // ignore
    }
  };

  const subtotal = items.reduce(
    (s, x) => s + (Number(x.prod.precio) || 0) * x.cantidad,
    0,
  );
  const descuento = Math.min(
    subtotal,
    Math.max(0, parseFloat(descuentoStr || '0') || 0),
  );
  const total = Math.max(0, subtotal - descuento);
  const pagaConIngresado = parseFloat(pagaConStr || '0') || 0;
  const pagaCon =
    metodo === 'Efectivo' && pagaConIngresado > 0 ? pagaConIngresado : total;
  const vuelto = Math.max(0, pagaCon - total);

  const previewHtml = useMemo(() => {
    if (!open || items.length === 0) return '';
    return buildSaleTicketHTML({
      titulo: 'VENTA A CONFIRMAR',
      nRecibo: siguienteNroRecibo(historial),
      metodoPago: metodo,
      items: items.map((x) => ({
        codigo: x.prod.codigo,
        nombre: x.prod.nombre,
        precio: Number(x.prod.precio) || 0,
        costo: Number(x.prod.costo) || 0,
        cantidad: x.cantidad,
      })),
      subtotal,
      descuento,
      totalFinal: total,
      pagaCon,
      vuelto,
      logoUrl: thermalLogoUrl,
    });
  }, [open, items, historial, metodo, subtotal, descuento, total, pagaCon, vuelto, thermalLogoUrl]);

  if (!open) return null;

  const handleAddCode = () => {
    const clean = codigoExtra.trim();
    if (!clean) return;
    onAddByCode(clean);
    setCodigoExtra('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4">
      <div className="bg-slate-100 rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="bg-teal-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ScanBarcode className="w-4 h-4" />
            <h2 className="text-base font-bold">Confirmar venta (Escáner)</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              stopModalCamera();
              onKeepScanning();
            }}
            className="text-teal-100 hover:text-white p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-600">
              Agregar otro producto por código
            </label>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={codigoExtra}
                onChange={(e) => setCodigoExtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCode();
                  }
                }}
                placeholder="Escanee o escriba el código y presione Enter..."
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-sm focus:outline-none focus:border-teal-600"
              />
              <button
                type="button"
                onClick={handleAddCode}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shrink-0"
                title="Agregar código"
                aria-label="Agregar código"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggleModalCamera}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 whitespace-nowrap ${
                  cameraActive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
                title={cameraActive ? 'Cerrar cámara' : 'Iniciar cámara para seguir escaneando'}
                aria-label={cameraActive ? 'Cerrar cámara' : 'Iniciar cámara'}
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Cerrar</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-teal-400" />
                    <span>Cámara</span>
                  </>
                )}
              </button>
            </div>

            {cameraActive && (
              <div className="rounded-xl bg-slate-900 text-white p-3 space-y-2">
                <div
                  id="checkout-qr-reader"
                  className="w-full max-w-sm mx-auto overflow-hidden rounded-lg"
                />
                {zoomCap && (
                  <div className="flex items-center gap-2 max-w-sm mx-auto text-xs">
                    <div className="flex items-center gap-2 flex-1">
                      <ZoomIn className="w-4 h-4 text-teal-400 shrink-0" />
                      <input
                        type="range"
                        min={zoomCap.min}
                        max={zoomCap.max}
                        step={zoomCap.step}
                        value={zoomVal}
                        onChange={(e) => handleModalZoomChange(parseFloat(e.target.value))}
                        className="flex-1 accent-teal-500"
                        aria-label="Zoom de la cámara"
                      />
                      <span className="font-mono w-10 text-right tabular-nums">
                        {zoomVal.toFixed(1)}x
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 pt-1">
                  <span>
                    {lastScannedCode
                      ? lastScannedCode
                      : 'Apuntá al código: cada lectura se suma sin cerrar esta ventana.'}
                  </span>
                  <button
                    type="button"
                    onClick={stopModalCamera}
                    className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    Detener cámara
                  </button>
                </div>
              </div>
            )}

            {cameraError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {cameraError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            {items.map((line, idx) => (
              <div
                key={line.prod.codigo}
                className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {line.prod.nombre}
                  </p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {formatARS(line.prod.precio)} · stock {line.prod.stock}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onChangeQty(idx, -1)}
                    className="p-1 rounded border border-slate-200 hover:bg-slate-100"
                    aria-label="Restar"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold tabular-nums">
                    {line.cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeQty(idx, 1)}
                    className="p-1 rounded border border-slate-200 hover:bg-slate-100"
                    aria-label="Sumar"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveItem(idx)}
                  className="p-1.5 rounded text-red-600 hover:bg-red-50"
                  aria-label="Quitar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Método de pago
              </label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-teal-600"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Descuento ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={descuentoStr}
                onChange={(e) => setDescuentoStr(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>

            {metodo === 'Efectivo' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Paga con ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pagaConStr}
                  onChange={(e) => setPagaConStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums focus:outline-none focus:border-teal-600"
                />
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] text-slate-500 text-center mb-2">
              Vista previa del ticket antes de confirmar
            </p>
            <style>{TICKET_CSS}</style>
            <div className="relative bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm mx-auto w-full max-w-[340px] overflow-x-auto overflow-y-hidden">
              {watermarkUrl && (
                <img
                  src={watermarkUrl}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[230px] h-[135px] object-contain opacity-[0.09] z-0 print:hidden"
                />
              )}
              <div
                className="relative z-10"
                dangerouslySetInnerHTML={{__html: previewHtml}}
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              stopModalCamera();
              onCancelSale();
            }}
            className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold"
          >
            Cancelar venta
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stopModalCamera();
                onKeepScanning();
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
            >
              Seguir escaneando
            </button>
            <button
              type="button"
              onClick={() => {
                stopModalCamera();
                onConfirmSale({metodo, descuento, pagaCon});
                setDescuentoStr('0');
                setPagaConStr('0');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar venta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditSaleModalProps {
  sale: SaleRecord | null;
  isDuplicate: boolean;
  productos: Product[];
  onClose: () => void;
  onSave: (updated: SaleRecord) => void;
  onDelete: (sale: SaleRecord, restoreStock: boolean) => void;
}

export function EditSaleModal({
  sale,
  isDuplicate,
  productos,
  onClose,
  onSave,
  onDelete,
}: EditSaleModalProps) {
  const [fechaInput, setFechaInput] = useState('');
  const [detalle, setDetalle] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');
  const [totalStr, setTotalStr] = useState('0');
  const [restoreStock, setRestoreStock] = useState(true);

  useEffect(() => {
    if (sale) {
      setFechaInput(String(sale.fecha || '').substring(0, 16).replace(' ', 'T'));
      setDetalle(sale.detalle || '');
      setMetodo(sale.metodo_pago || 'Efectivo');
      setTotalStr(String(Number(sale.total) || 0));
      setRestoreStock(true);
    }
  }, [sale]);

  const affectedProducts = useMemo(() => {
    if (!sale) return [];
    return productosDeVenta(sale, productos);
  }, [sale, productos]);

  if (!sale) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalNum = parseFloat(totalStr);
    if (!fechaInput || !detalle.trim() || !Number.isFinite(totalNum) || totalNum < 0) {
      return;
    }

    const originalPrefix = String(sale.fecha || '')
      .substring(0, 16)
      .replace(' ', 'T');
    const segundos =
      originalPrefix === fechaInput
        ? String(sale.fecha || '').substring(16, 19) || ':00'
        : ':00';

    const nextSale: SaleRecord = {
      ...sale,
      fecha: `${fechaInput.replace('T', ' ')}${segundos}`,
      detalle: detalle.trim(),
      metodo_pago: metodo,
      total: totalNum,
      editado: new Date().toISOString(),
    };
    if (detalle.trim() !== sale.detalle) {
      nextSale.items = [];
    }
    onSave(nextSale);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-teal-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            <h2 className="text-base font-bold">
              Editar venta · <span className="font-mono">{sale.n_recibo}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-teal-100 hover:text-white p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {isDuplicate && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Esta venta parece un duplicado: existe otra operación con el mismo
                detalle y monto registrada con pocos minutos de diferencia.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha y hora
            </label>
            <input
              type="datetime-local"
              required
              value={fechaInput}
              onChange={(e) => setFechaInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detalle
            </label>
            <textarea
              rows={2}
              required
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Método de pago
              </label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-teal-600"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Monto total ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={totalStr}
                onChange={(e) => setTotalStr(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 space-y-2">
            <p className="text-xs font-bold text-red-700">Eliminar venta</p>
            <p className="text-xs text-slate-600">
              Usalo si la venta se registró por error o quedó duplicada. Se quita del
              historial, del panel y de la exportación Excel.
            </p>
            {affectedProducts.length > 0 && (
              <label className="flex items-start gap-2 text-xs text-slate-800 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreStock}
                  onChange={(e) => setRestoreStock(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                />
                <span>
                  Devolver al inventario:{' '}
                  <strong>
                    {affectedProducts
                      .map((x) => `${x.cantidad}x ${x.prod.nombre}`)
                      .join(', ')}
                  </strong>
                </span>
              </label>
            )}
            <button
              type="button"
              onClick={() => onDelete(sale, affectedProducts.length > 0 && restoreStock)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 bg-white hover:bg-red-50 text-xs font-bold text-red-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar esta venta</span>
            </button>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold"
            >
              <Check className="w-4 h-4" />
              <span>Guardar cambios</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Eliminar',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm max-h-[90dvh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-1">{description}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
