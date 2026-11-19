import React, {useEffect, useRef, useState} from 'react';
import {
  ArrowDownToLine,
  ShoppingCart,
  ScanBarcode,
  Camera,
  CameraOff,
  Check,
  ZoomIn,
  RefreshCw,
  Trash2,
  Receipt,
} from 'lucide-react';
import type {Html5Qrcode} from 'html5-qrcode';
import type {Product} from '../types';
import {formatARS} from '../utils/format';
import {
  CLAVE_CAMARA,
  CLAVE_ZOOM,
  crearLectorCamara,
  iniciarLectorConOpciones,
  obtenerCamarasTraseras,
  type CameraDevice,
  type ZoomCapabilities,
} from '../utils/camera';
import type {ScannerCartLine} from './Modals';

interface ScannerSectionProps {
  mode: 'ENTRADA' | 'VENTA';
  onChangeMode: (mode: 'ENTRADA' | 'VENTA') => void;
  prefillCode?: string;
  onClearPrefill: () => void;
  productos: Product[];
  scannerCart: ScannerCartLine[];
  onStockEntry: (product: Product, addQuantity: number) => void;
  onAddScannerSaleItem: (prod: Product) => void;
  onOpenScannerConfirm: () => void;
  onClearScannerCart: () => void;
  onNotify: (type: 'success' | 'error' | 'info', text: string) => void;
}

export function ScannerSection({
  mode,
  onChangeMode,
  prefillCode,
  onClearPrefill,
  productos,
  scannerCart,
  onStockEntry,
  onAddScannerSaleItem,
  onOpenScannerConfirm,
  onClearScannerCart,
  onNotify,
}: ScannerSectionProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [camaras, setCamaras] = useState<CameraDevice[]>([]);
  const [camIdx, setCamIdx] = useState(0);
  const [zoomCap, setZoomCap] = useState<ZoomCapabilities | null>(null);
  const [zoomVal, setZoomVal] = useState(1);

  const [formVisible, setFormVisible] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('Repuestos');
  const [costo, setCosto] = useState('0');
  const [precio, setPrecio] = useState('0');
  const [cantidad, setCantidad] = useState('1');

  const inputRef = useRef<HTMLInputElement>(null);
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const handleBarcodeLookup = (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean) return;

    const existing = productos.find(
      (p) => p.codigo.toLowerCase() === clean.toLowerCase(),
    );

    if (mode === 'ENTRADA') {
      setCodigo(existing ? existing.codigo : clean);
      if (existing) {
        setNombre(existing.nombre);
        setCategoria(existing.categoria || 'Repuestos');
        setCosto(String(existing.costo));
        setPrecio(String(existing.precio));
      } else {
        setNombre('');
        setCategoria('Repuestos');
        setCosto('0');
        setPrecio('0');
      }
      setCantidad('1');
      setFormVisible(true);
    } else {
      if (!existing) {
        onNotify('error', `Producto con código "${clean}" no encontrado en inventario.`);
        return;
      }
      if (existing.stock <= 0) {
        onNotify('error', `El producto "${existing.nombre}" no tiene stock disponible.`);
        return;
      }
      onAddScannerSaleItem(existing);
      setBarcodeInput('');
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    if (prefillCode) {
      setBarcodeInput(prefillCode);
      handleBarcodeLookup(prefillCode);
      onClearPrefill();
    }
  }, [prefillCode]);

  const stopCamera = async () => {
    if (scannerInstanceRef.current) {
      try {
        if (scannerInstanceRef.current.isScanning) {
          await scannerInstanceRef.current.stop();
        }
        scannerInstanceRef.current.clear();
      } catch {
        // ignore cleanup error
      }
      scannerInstanceRef.current = null;
    }
    setCameraActive(false);
    setZoomCap(null);
  };

  useEffect(() => {
    return () => {
      if (scannerInstanceRef.current) {
        if (scannerInstanceRef.current.isScanning) {
          scannerInstanceRef.current.stop().catch(() => undefined);
        }
        scannerInstanceRef.current = null;
      }
    };
  }, []);

  const startWithCameraIndex = async (
    lector: Html5Qrcode,
    lista: CameraDevice[],
    index: number,
  ) => {
    const deviceId = lista.length ? lista[index].id : null;
    const zoom = await iniciarLectorConOpciones(lector, deviceId, (decodedText) => {
      setBarcodeInput(decodedText);
      stopCamera();
      handleBarcodeLookup(decodedText);
    });
    setZoomCap(zoom);
    if (zoom) setZoomVal(zoom.valor);
  };

  const toggleCamera = async () => {
    if (cameraActive) {
      await stopCamera();
      return;
    }

    setCameraError(null);
    setCameraActive(true);

    try {
      const lista = await obtenerCamarasTraseras().catch(() => []);
      setCamaras(lista);
      let idx = lista.findIndex((c) => c.id === localStorage.getItem(CLAVE_CAMARA));
      if (idx < 0) idx = 0;
      setCamIdx(idx);

      const qr = await crearLectorCamara('qr-reader-container');
      scannerInstanceRef.current = qr;
      await startWithCameraIndex(qr, lista, idx);
    } catch {
      await stopCamera();
      setCameraError(
        'No se pudo acceder a la cámara. Verificá los permisos del navegador o usá pistola USB / ingreso manual.',
      );
      onNotify('error', 'No se pudo iniciar la cámara para escanear.');
    }
  };

  const handleSwitchCamera = async () => {
    if (!scannerInstanceRef.current || camaras.length <= 1) return;
    const nextIdx = (camIdx + 1) % camaras.length;
    setCamIdx(nextIdx);
    localStorage.setItem(CLAVE_CAMARA, camaras[nextIdx].id);
    try {
      if (scannerInstanceRef.current.isScanning) {
        await scannerInstanceRef.current.stop();
      }
      await startWithCameraIndex(scannerInstanceRef.current, camaras, nextIdx);
    } catch {
      onNotify('error', 'No se pudo cambiar de cámara.');
    }
  };

  const handleZoomChange = (val: number) => {
    setZoomVal(val);
    localStorage.setItem(CLAVE_ZOOM, String(val));
    try {
      scannerInstanceRef.current
        ?.applyVideoConstraints({advanced: [{zoom: val}]} as unknown as MediaTrackConstraints)
        .catch(() => undefined);
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeLookup(barcodeInput);
    }
  };

  const handleConfirmEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      onNotify('error', 'Ingresá el nombre del repuesto o producto.');
      return;
    }
    const qty = Math.max(1, parseInt(cantidad || '1', 10));
    onStockEntry(
      {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        categoria: categoria.trim() || 'Repuestos',
        costo: Math.max(0, parseFloat(costo || '0')),
        precio: Math.max(0, parseFloat(precio || '0')),
        stock: qty,
      },
      qty,
    );
    setFormVisible(false);
    setBarcodeInput('');
    inputRef.current?.focus();
  };

  const cartUnits = scannerCart.reduce((s, x) => s + x.cantidad, 0);
  const cartSubtotal = scannerCart.reduce(
    (s, x) => s + (Number(x.prod.precio) || 0) * x.cantidad,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Escáner y Movimiento de Stock
        </h1>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            onChangeMode('ENTRADA');
            setFormVisible(false);
          }}
          className={`flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl text-sm font-bold transition-colors border ${
            mode === 'ENTRADA'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" />
          <span>Modo Ingreso (Stockear)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onChangeMode('VENTA');
            setFormVisible(false);
          }}
          className={`flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl text-sm font-bold transition-colors border ${
            mode === 'VENTA'
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Modo Egreso (Venta / Salida)</span>
        </button>
      </div>

      {/* Dark Scanner Console */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 lg:p-8 border border-slate-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className={`${cameraActive ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4 min-w-0`}>
            <span
              className={`inline-block px-3 py-1 rounded-md text-xs font-bold tracking-wide uppercase ${
                mode === 'ENTRADA' ? 'bg-teal-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {mode === 'ENTRADA'
                ? 'Módulo de ingreso rápido'
                : 'Módulo de egreso / salida'}
            </span>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {mode === 'ENTRADA'
                  ? 'Carga Directa de Stock con Código de Barras'
                  : 'Salida de Stock por Venta o Reparación'}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Utilizá pistola USB, cámara o escribí el código para operar.
              </p>
            </div>

            <div>
              <label
                htmlFor="scanner-barcode-input"
                className="block text-xs font-semibold uppercase tracking-wider text-teal-400 mb-2"
              >
                Escanear Código de Barras
              </label>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1 min-w-0">
                  <ScanBarcode className="w-5 h-5 text-teal-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={inputRef}
                    id="scanner-barcode-input"
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ingrese código y presione Enter..."
                    className="w-full pl-11 pr-3 py-3.5 rounded-xl bg-slate-950 border-2 border-teal-600 text-teal-200 placeholder:text-slate-500 font-mono text-sm focus:outline-none focus:border-teal-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleBarcodeLookup(barcodeInput)}
                  className="px-3.5 sm:px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Buscar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={toggleCamera}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold border border-slate-700 transition-colors"
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="w-4 h-4 text-red-400" />
                    <span>Cerrar Cámara</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-teal-400" />
                    <span>Escanear con la Cámara</span>
                  </>
                )}
              </button>
            </div>

            {cameraError && (
              <p className="text-xs text-red-300 bg-red-950/50 border border-red-800/70 rounded-lg px-3 py-2">
                {cameraError}
              </p>
            )}
          </div>

          {cameraActive && (
            <div className="lg:col-span-5">
              <div className="rounded-xl bg-slate-950 border border-slate-700 p-3 text-center space-y-2.5">
                <div id="qr-reader-container" className="w-full overflow-hidden rounded-lg" />
                {(zoomCap || camaras.length > 1) && (
                  <div className="flex items-center gap-2 text-xs text-slate-200 pt-1">
                    {zoomCap && (
                      <div className="flex items-center gap-2 flex-1">
                        <ZoomIn className="w-4 h-4 text-teal-400 shrink-0" />
                        <input
                          type="range"
                          min={zoomCap.min}
                          max={zoomCap.max}
                          step={zoomCap.step}
                          value={zoomVal}
                          onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                          className="flex-1 accent-teal-500"
                          aria-label="Zoom de la cámara"
                        />
                        <span className="font-mono w-10 text-right tabular-nums">
                          {zoomVal.toFixed(1)}x
                        </span>
                      </div>
                    )}
                    {camaras.length > 1 && (
                      <button
                        type="button"
                        onClick={handleSwitchCamera}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-600 hover:bg-slate-800 text-xs font-medium whitespace-nowrap"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>
                          Cámara {camIdx + 1}/{camaras.length}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Venta en curso banner */}
      {scannerCart.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-red-900">
            <ShoppingCart className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <strong>Venta en curso:</strong>{' '}
              <span className="tabular-nums">
                {cartUnits} artículo(s) · {formatARS(cartSubtotal)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenScannerConfirm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Ver y confirmar</span>
            </button>
            <button
              type="button"
              onClick={onClearScannerCart}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-white hover:bg-red-100 text-red-700 text-xs font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar</span>
            </button>
          </div>
        </div>
      )}

      {/* Product Detail Card for Stock Entry */}
      {formVisible && mode === 'ENTRADA' && (
        <form
          onSubmit={handleConfirmEntry}
          className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Detalles del Producto Escaneado
            </h3>
            <span className="text-xs font-mono text-slate-500">Código {codigo}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-1">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Código
              </label>
              <input
                type="text"
                value={codigo}
                readOnly
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-sm text-slate-700"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Nombre del Repuesto / Producto
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ej: Módulo Display Samsung A12"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Categoría
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Costo ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Precio Venta ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="w-full sm:w-40">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Cantidad a Ingresar
              </label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 tabular-nums focus:outline-none focus:border-teal-600"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setFormVisible(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Ingreso</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
