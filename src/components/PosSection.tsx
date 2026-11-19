import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ScanBarcode,
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Wrench,
  Package,
  Camera,
  CameraOff,
  CornerDownLeft,
  ZoomIn,
} from 'lucide-react';
import type {Html5Qrcode} from 'html5-qrcode';
import type {CartItem, PaymentMethod, Product, RepairOrder} from '../types';
import {formatARS} from '../utils/format';
import {
  CLAVE_ZOOM,
  crearLectorCamara,
  iniciarMejorCamara,
  sonidoEscaneo,
  type ZoomCapabilities,
} from '../utils/camera';

interface PosSectionProps {
  productos: Product[];
  reparaciones: RepairOrder[];
  modalOpen: boolean;
  onCheckout: (payload: {
    items: CartItem[];
    descuento: number;
    metodoPago: PaymentMethod;
    pagaCon: number;
  }) => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function PosSection({
  productos,
  reparaciones,
  modalOpen,
  onCheckout,
  onNotify,
}: PosSectionProps) {
  const [posTab, setPosTab] = useState<'productos' | 'reparaciones'>('productos');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastScanStatus, setLastScanStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [descuentoStr, setDescuentoStr] = useState('0');
  const [metodoPago, setMetodoPago] = useState<PaymentMethod>('Efectivo');
  const [pagaConStr, setPagaConStr] = useState('');

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [zoomCap, setZoomCap] = useState<ZoomCapabilities | null>(null);
  const [zoomVal, setZoomVal] = useState(1);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const posCameraRef = useRef<Html5Qrcode | null>(null);
  const lastCamScanRef = useRef<{code: string; time: number}>({code: '', time: 0});
  const usbBufferRef = useRef<{buf: string; lastTime: number}>({buf: '', lastTime: 0});

  useEffect(() => {
    barcodeInputRef.current?.focus();
    return () => {
      if (posCameraRef.current) {
        if (posCameraRef.current.isScanning) {
          posCameraRef.current.stop().catch(() => undefined);
        }
        posCameraRef.current = null;
      }
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return productos.filter(
      (p) =>
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q),
    );
  }, [productos, searchQuery]);

  const pendingRepairs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return reparaciones
      .filter((r) => r.estado !== 'Retirado')
      .filter(
        (r) =>
          !q ||
          r.n_orden.toLowerCase().includes(q) ||
          r.cliente.toLowerCase().includes(q) ||
          r.equipo.toLowerCase().includes(q),
      );
  }, [reparaciones, searchQuery]);

  const addProductToCart = useCallback(
    (prod: Product): boolean => {
      if (prod.stock <= 0) {
        onNotify('error', `"${prod.nombre}" no tiene stock disponible.`);
        return false;
      }

      let addedOk = true;
      setCart((prev) => {
        const existing = prev.find(
          (i) => !i.es_reparacion && i.codigo === prod.codigo,
        );
        if (existing) {
          if (existing.cantidad >= prod.stock) {
            addedOk = false;
            onNotify(
              'error',
              `Sin stock suficiente de "${prod.nombre}" (disponible: ${prod.stock}).`,
            );
            return prev;
          }
          return prev.map((i) =>
            !i.es_reparacion && i.codigo === prod.codigo
              ? {...i, cantidad: i.cantidad + 1}
              : i,
          );
        }
        return [
          ...prev,
          {
            codigo: prod.codigo,
            nombre: prod.nombre,
            precio: prod.precio,
            cantidad: 1,
            es_reparacion: false,
            maxStock: prod.stock,
          },
        ];
      });
      return addedOk;
    },
    [onNotify],
  );

  const addRepairToCart = useCallback(
    (rep: RepairOrder): boolean => {
      const saldo = Math.max(0, (rep.presupuesto || 0) - (rep.senia || 0));
      let addedOk = true;
      setCart((prev) => {
        const already = prev.some((i) => i.es_reparacion && i.id === rep.id);
        if (already) {
          addedOk = false;
          onNotify('info', `La orden ${rep.n_orden} ya está en el carrito.`);
          return prev;
        }
        return [
          ...prev,
          {
            id: rep.id,
            nombre: `Reparación ${rep.n_orden} (${rep.equipo})`,
            precio: saldo,
            cantidad: 1,
            es_reparacion: true,
          },
        ];
      });
      return addedOk;
    },
    [onNotify],
  );

  const processBarcodePOS = useCallback(
    (rawCode: string) => {
      const code = String(rawCode ?? '').trim();
      if (!code) return;
      const norm = code.toLowerCase();

      const prod = productos.find((p) => p.codigo.toLowerCase() === norm);
      if (prod) {
        const ok = addProductToCart(prod);
        sonidoEscaneo(ok);
        if (ok) {
          setLastScanStatus({
            ok: true,
            message: `${prod.nombre} · ${formatARS(prod.precio, false)} agregado al carrito`,
          });
        }
        return;
      }

      const rep = reparaciones.find(
        (r) => r.n_orden.toLowerCase() === norm && r.estado !== 'Retirado',
      );
      if (rep) {
        const ok = addRepairToCart(rep);
        sonidoEscaneo(ok);
        if (ok) {
          setLastScanStatus({
            ok: true,
            message: `Reparación ${rep.n_orden} · ${rep.cliente} agregada al carrito`,
          });
        }
        return;
      }

      sonidoEscaneo(false);
      setLastScanStatus({
        ok: false,
        message: `Código "${code}" no encontrado en el inventario.`,
      });
      onNotify(
        'error',
        `No hay ningún producto con el código "${code}". Cargalo desde Escáner / Movimiento.`,
      );
    },
    [productos, reparaciones, addProductToCart, addRepairToCart, onNotify],
  );

  // Global USB barcode wedge listener when POS is active and no modal/input has focus
  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (modalOpen) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }

      const ahora = Date.now();
      if (ahora - usbBufferRef.current.lastTime > 80) {
        usbBufferRef.current.buf = '';
      }
      usbBufferRef.current.lastTime = ahora;

      if (e.key === 'Enter') {
        if (usbBufferRef.current.buf.length >= 3) {
          e.preventDefault();
          processBarcodePOS(usbBufferRef.current.buf);
        }
        usbBufferRef.current.buf = '';
      } else if (e.key.length === 1) {
        usbBufferRef.current.buf += e.key;
      }
    };

    document.addEventListener('keydown', onDocKeyDown);
    return () => document.removeEventListener('keydown', onDocKeyDown);
  }, [modalOpen, processBarcodePOS]);

  const stopCameraPOS = async () => {
    if (posCameraRef.current) {
      try {
        if (posCameraRef.current.isScanning) {
          await posCameraRef.current.stop();
        }
        posCameraRef.current.clear();
      } catch {
        // ignore
      }
      posCameraRef.current = null;
    }
    setCameraActive(false);
    setZoomCap(null);
  };

  const toggleCameraPOS = async () => {
    if (cameraActive) {
      await stopCameraPOS();
      return;
    }

    setCameraActive(true);
    try {
      const qr = await crearLectorCamara('pos-qr-reader');
      posCameraRef.current = qr;
      const zoom = await iniciarMejorCamara(qr, (decodedText) => {
        const now = Date.now();
        if (
          decodedText === lastCamScanRef.current.code &&
          now - lastCamScanRef.current.time < 2000
        ) {
          return;
        }
        lastCamScanRef.current = {code: decodedText, time: now};
        processBarcodePOS(decodedText);
      });
      setZoomCap(zoom);
      if (zoom) setZoomVal(zoom.valor);
    } catch {
      await stopCameraPOS();
      onNotify('error', 'No se pudo iniciar la cámara del Punto de Venta.');
    }
  };

  const handleZoomChangePOS = (val: number) => {
    setZoomVal(val);
    localStorage.setItem(CLAVE_ZOOM, String(val));
    try {
      posCameraRef.current
        ?.applyVideoConstraints({advanced: [{zoom: val}]} as unknown as MediaTrackConstraints)
        .catch(() => undefined);
    } catch {
      // ignore
    }
  };

  const handleManualBarcodeSubmit = () => {
    const clean = barcodeInput.trim();
    if (!clean) {
      barcodeInputRef.current?.focus();
      return;
    }
    processBarcodePOS(clean);
    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualBarcodeSubmit();
    }
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, idx) => {
          if (idx !== index) return item;
          if (item.es_reparacion) return item;
          const nextQty = item.cantidad + delta;
          if (nextQty <= 0) return null;
          if (item.maxStock !== undefined && nextQty > item.maxStock) {
            onNotify('error', `Stock máximo disponible: ${item.maxStock} un.`);
            return item;
          }
          return {...item, cantidad: nextQty};
        })
        .filter((x): x is CartItem => x !== null),
    );
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  const descuento = Math.max(0, parseFloat(descuentoStr || '0') || 0);
  const total = Math.max(0, subtotal - descuento);
  const pagaConNum =
    pagaConStr.trim() === '' || parseFloat(pagaConStr) === 0
      ? total
      : Math.max(0, parseFloat(pagaConStr) || 0);
  const vuelto = Math.max(0, pagaConNum - total);

  const handleFinalize = () => {
    if (cart.length === 0) {
      onNotify('error', 'Agregá al menos un producto o reparación al carrito.');
      return;
    }
    onCheckout({
      items: cart,
      descuento,
      metodoPago,
      pagaCon: pagaConNum,
    });
    setCart([]);
    setDescuentoStr('0');
    setPagaConStr('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Punto de Venta
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Catalog */}
        <div className="lg:col-span-8 space-y-4">
          {/* Segmented Switch */}
          <div className="bg-white p-1.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setPosTab('productos')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2.5 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-colors min-w-0 ${
                posTab === 'productos'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span className="truncate">Repuestos / Accesorios</span>
            </button>
            <button
              type="button"
              onClick={() => setPosTab('reparaciones')}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2.5 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-colors min-w-0 ${
                posTab === 'reparaciones'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-4 h-4 shrink-0" />
              <span className="truncate">Cobrar Reparación</span>
            </button>
          </div>

          {/* Search & Barcode + Camera */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center text-xs">
              <label
                htmlFor="pos-barcode-input"
                className="font-bold uppercase tracking-wider text-teal-700"
              >
                Buscar producto por código
              </label>
            </div>

            <div className="flex items-stretch rounded-lg border-2 border-teal-600 overflow-hidden bg-white">
              <div className="flex items-center pl-2.5 sm:pl-3 text-teal-600 shrink-0">
                <ScanBarcode className="w-5 h-5" />
              </div>
              <input
                ref={barcodeInputRef}
                id="pos-barcode-input"
                type="text"
                autoComplete="off"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Código o N° orden..."
                className="flex-1 min-w-0 px-2.5 sm:px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleManualBarcodeSubmit}
                className="px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 border-l border-teal-100 transition-colors"
                title="Buscar código"
                aria-label="Buscar código"
              >
                <CornerDownLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggleCameraPOS}
                className="inline-flex items-center gap-1.5 px-3.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors whitespace-nowrap"
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-4 h-4" />
                    <span className="hidden sm:inline">Cerrar</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline">Cámara</span>
                  </>
                )}
              </button>
            </div>

            {cameraActive && (
              <div className="rounded-xl bg-slate-900 text-white p-3 space-y-2">
                <div
                  id="pos-qr-reader"
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
                        onChange={(e) => handleZoomChangePOS(parseFloat(e.target.value))}
                        className="flex-1 accent-teal-500"
                      />
                      <span className="font-mono w-10 text-right tabular-nums">
                        {zoomVal.toFixed(1)}x
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Apunte al código: cada lectura se suma al carrito.</span>
                  <button
                    type="button"
                    onClick={stopCameraPOS}
                    className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    Cerrar cámara
                  </button>
                </div>
              </div>
            )}

            {lastScanStatus && (
              <p
                className={`text-xs font-medium ${
                  lastScanStatus.ok ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {lastScanStatus.message}
              </p>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, código o N° de orden..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-teal-600"
              />
            </div>
          </div>

          {/* Grid Items */}
          {posTab === 'productos' ? (
            filteredProducts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 py-12 px-4 text-center text-sm text-slate-500">
                No se encontraron repuestos o accesorios.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredProducts.map((p) => (
                  <button
                    key={p.codigo}
                    type="button"
                    onClick={() => addProductToCart(p)}
                    disabled={p.stock <= 0}
                    className={`text-left bg-white rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                      p.stock <= 0
                        ? 'border-slate-200 opacity-55 cursor-not-allowed'
                        : 'border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 cursor-pointer'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                        <span>{p.categoria}</span>
                        <span className="font-mono">#{p.codigo}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {p.nombre}
                      </h3>
                    </div>

                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          p.stock <= 2 ? 'text-red-600' : 'text-slate-500'
                        }`}
                      >
                        Stock: {p.stock} un.
                      </span>
                      <span className="text-base font-bold text-teal-700 tabular-nums">
                        {formatARS(p.precio, false)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : pendingRepairs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-12 px-4 text-center text-sm text-slate-500">
              No hay reparaciones pendientes de cobro.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {pendingRepairs.map((r) => {
                const saldo = Math.max(0, (r.presupuesto || 0) - (r.senia || 0));
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addRepairToCart(r)}
                    className="text-left bg-white rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 p-4 transition-colors flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
                        <span className="font-mono font-bold text-slate-900">
                          {r.n_orden}
                        </span>
                        <span className="font-semibold text-amber-700">{r.estado}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{r.equipo}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.cliente} · Presupuesto {formatARS(r.presupuesto, false)} (Seña{' '}
                        {formatARS(r.senia, false)})
                      </p>
                    </div>
                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-500">
                        Saldo a cobrar
                      </span>
                      <span className="text-base font-bold text-teal-700 tabular-nums">
                        {formatARS(saldo, false)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sticky Cart */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 lg:sticky lg:top-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900">Carrito de Cobro</h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Vaciar
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                El carrito está vacío. Seleccioná un producto o reparación.
              </p>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={`${item.es_reparacion ? 'rep' : 'prod'}-${item.id ?? item.codigo}`}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {item.nombre}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatARS(item.precio, false)} c/u
                    </p>
                  </div>

                  {!item.es_reparacion && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(idx, -1)}
                        className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        aria-label="Restar unidad"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold tabular-nums">
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(idx, 1)}
                        className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        aria-label="Sumar unidad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-teal-700 tabular-nums">
                      {formatARS(item.precio * item.cantidad, false)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(idx)}
                      className="text-slate-400 hover:text-red-600 p-1"
                      aria-label="Quitar del carrito"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2.5 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold tabular-nums">{formatARS(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <label htmlFor="pos-discount">Descuento ($)</label>
              <input
                id="pos-discount"
                type="number"
                min="0"
                step="0.01"
                value={descuentoStr}
                onChange={(e) => setDescuentoStr(e.target.value)}
                className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-right font-semibold tabular-nums text-slate-900 focus:outline-none focus:border-teal-600"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-base font-bold text-slate-900">
              <span>Total a Cobrar</span>
              <span className="text-xl text-teal-700 tabular-nums">{formatARS(total)}</span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label
                htmlFor="pos-payment-method"
                className="block text-xs font-semibold text-slate-600 mb-1"
              >
                Método de Pago
              </label>
              <select
                id="pos-payment-method"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-teal-600"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="pos-paga-con"
                  className="block text-xs font-semibold text-slate-600 mb-1"
                >
                  Paga con ($)
                </label>
                <input
                  id="pos-paga-con"
                  type="number"
                  min="0"
                  step="0.01"
                  value={pagaConStr}
                  onChange={(e) => setPagaConStr(e.target.value)}
                  placeholder={String(total)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold tabular-nums text-slate-900 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Vuelto ($)
                </label>
                <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-teal-700 tabular-nums">
                  {formatARS(vuelto)}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinalize}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finalizar y Cobrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
