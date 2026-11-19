import {useCallback, useEffect, useRef, useState} from 'react';
import {Menu, RefreshCw} from 'lucide-react';
import type {
  AppState,
  CartItem,
  PaymentMethod,
  Product,
  ReceiptData,
  RepairOrder,
  RepairStatus,
  SaleRecord,
  SectionId,
} from './types';
import {
  downloadJSONBackup,
  getLocalDateStr,
  getLocalDateTimeStr,
} from './utils/format';
import type {User} from 'firebase/auth';
import {
  Sidebar,
  TECH_LOGO_PATH,
  type SessionMode,
  type SyncState,
} from './components/Sidebar';
import {AccountFloatingMenu} from './components/AccountFloatingMenu';
import {LegalPage, type LegalDocType} from './components/LegalPage';
import {Logo3DBackground} from './components/Logo3DBackground';
import {WelcomeAuthModal} from './components/WelcomeAuthModal';
import {CloudConflictModal} from './components/DriveModals';
import {
  auth,
  googleSignIn,
  initFirebaseAuth,
  logoutGoogle,
  resetFirestoreCache,
} from './utils/firebaseClient';
import {
  ensureUserProfile,
  fetchUserCloudData,
  subscribeUserCloudData,
  syncCloudDatasetDiff,
  type CloudDataset,
} from './utils/firestoreDb';
import {DashboardSection} from './components/DashboardSection';
import {ScannerSection} from './components/ScannerSection';
import {RepairsSection} from './components/RepairsSection';
import {InventorySection} from './components/InventorySection';
import {PosSection} from './components/PosSection';
import {BalanceSection} from './components/BalanceSection';
import {HistorySection} from './components/HistorySection';
import {
  ConfirmModal,
  EditSaleModal,
  ProductModal,
  ReceiptModal,
  RepairModal,
  ScannerCheckoutModal,
  type ScannerCartLine,
} from './components/Modals';
import {
  detectarVentasDuplicadas,
  productosDeVenta,
  siguienteNroRecibo,
} from './utils/salesAnalytics';
import {ToastContainer, type ToastMessage} from './components/Toast';

const GUEST_STORAGE_KEY = 'tech_guest_state_v1';

function getLegalRouteFromPath(pathname: string): LegalDocType | null {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  if (normalized === '/privacidad' || normalized === '/privacidad.html') {
    return 'privacidad';
  }
  if (normalized === '/terminos' || normalized === '/terminos.html') {
    return 'terminos';
  }
  return null;
}

function readGuestLocalFallback(): AppState {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) {
      return {revision: 0, productos: [], reparaciones: [], historial: []};
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
      productos: Array.isArray(parsed.productos) ? parsed.productos : [],
      reparaciones: Array.isArray(parsed.reparaciones) ? parsed.reparaciones : [],
      historial: Array.isArray(parsed.historial) ? parsed.historial : [],
    };
  } catch {
    return {revision: 0, productos: [], reparaciones: [], historial: []};
  }
}

function writeGuestLocalFallback(state: AppState): void {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export default function App() {
  const [legalRoute, setLegalRoute] = useState<LegalDocType | null>(() =>
    getLegalRouteFromPath(window.location.pathname),
  );

  const [activeSection, setActiveSection] = useState<SectionId>('panel');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [productos, setProductos] = useState<Product[]>([]);
  const [reparaciones, setReparaciones] = useState<RepairOrder[]>([]);
  const [historial, setHistorial] = useState<SaleRecord[]>([]);
  const [syncState, setSyncState] = useState<SyncState>('saved');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Auth & Database Mode (Cloud Firestore vs Guest Local)
  const [sessionMode, setSessionMode] = useState<SessionMode>('pending');
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [rememberedUser, setRememberedUser] = useState<User | null>(null);
  const [cloudUid, setCloudUid] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [conflictState, setConflictState] = useState<{
    user: User;
    cloudData: CloudDataset;
  } | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);
  const [manualCloudSaving, setManualCloudSaving] = useState(false);
  const [cloudRestoring, setCloudRestoring] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const revisionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSavesRef = useRef(0);
  const sessionModeRef = useRef<SessionMode>('pending');
  const cloudUidRef = useRef<string | null>(null);
  const lastCloudDatasetRef = useRef<CloudDataset>({
    productos: [],
    reparaciones: [],
    historial: [],
  });

  useEffect(() => {
    sessionModeRef.current = sessionMode;
  }, [sessionMode]);

  useEffect(() => {
    cloudUidRef.current = cloudUid;
  }, [cloudUid]);

  // Browser history handling for /privacidad and /terminos
  useEffect(() => {
    const onPopState = () => {
      setLegalRoute(getLegalRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateToLegal = useCallback((docType: LegalDocType) => {
    const targetPath = docType === 'privacidad' ? '/privacidad' : '/terminos';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    setLegalRoute(docType);
  }, []);

  const navigateBackFromLegal = useCallback(() => {
    if (window.location.pathname !== '/') {
      window.history.pushState(null, '', '/');
    }
    setLegalRoute(null);
  }, []);

  // Scanner state
  const [scannerMode, setScannerMode] = useState<'ENTRADA' | 'VENTA'>('ENTRADA');
  const [scannerPrefill, setScannerPrefill] = useState<string | undefined>(undefined);
  const [scannerCart, setScannerCart] = useState<ScannerCartLine[]>([]);
  const [scannerCheckoutOpen, setScannerCheckoutOpen] = useState(false);

  // Modals
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairOrder | null>(null);

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<ReceiptData | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => undefined,
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastIdRef = useRef(1);

  const notify = useCallback(
    (type: 'success' | 'error' | 'info', text: string) => {
      const id = toastIdRef.current++;
      setToasts((prev) => [...prev, {id, type, text}]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sequential queue helper so consecutive Firestore ops never race
  const enqueueCloudTask = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const nextRun = saveQueueRef.current.then(task, task);
    saveQueueRef.current = nextRun.then(
      () => undefined,
      () => undefined,
    );
    return nextRun;
  }, []);

  const loadGuestLocalState = useCallback(async () => {
    setSyncState('loading');
    setLoadError(null);
    try {
      const res = await fetch('/api/state');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as AppState;
        if (sessionModeRef.current !== 'guest') return;
        const normalized: AppState = {
          revision: data.revision ?? 0,
          productos: Array.isArray(data.productos) ? data.productos : [],
          reparaciones: Array.isArray(data.reparaciones) ? data.reparaciones : [],
          historial: Array.isArray(data.historial) ? data.historial : [],
        };
        revisionRef.current = normalized.revision;
        setProductos(normalized.productos);
        setReparaciones(normalized.reparaciones);
        setHistorial(normalized.historial);
        writeGuestLocalFallback(normalized);
        setSyncState('saved');
        return;
      }
      throw new Error('Static environment');
    } catch {
      if (sessionModeRef.current !== 'guest') return;
      const fallback = readGuestLocalFallback();
      revisionRef.current = fallback.revision;
      setProductos(fallback.productos);
      setReparaciones(fallback.reparaciones);
      setHistorial(fallback.historial);
      setSyncState('saved');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initFirebaseAuth((user) => {
      setRememberedUser(user);
      setGoogleUser(user);
    });
    return unsubscribe;
  }, []);

  // Real-time Firestore listener when connected to Cloud
  useEffect(() => {
    if (sessionMode !== 'cloud' || !cloudUid) return;
    const unsubscribe = subscribeUserCloudData(cloudUid, {
      onProductos: (items) => {
        lastCloudDatasetRef.current.productos = items;
        setProductos(items);
      },
      onReparaciones: (items) => {
        lastCloudDatasetRef.current.reparaciones = items;
        setReparaciones(items);
      },
      onHistorial: (items) => {
        lastCloudDatasetRef.current.historial = items;
        setHistorial(items);
      },
      onError: (err) => {
        setSyncState('error');
        notify('error', `Error de sincronización en la nube: ${err.message}`);
      },
    });
    return unsubscribe;
  }, [sessionMode, cloudUid, notify]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sessionModeRef.current === 'cloud' && pendingSavesRef.current > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const persistState = useCallback(
    (
      nextProductos: Product[],
      nextReparaciones: RepairOrder[],
      nextHistorial: SaleRecord[],
    ) => {
      if (sessionModeRef.current === 'pending') return;

      pendingSavesRef.current += 1;
      setSyncState('saving');

      const payload: CloudDataset = {
        productos: nextProductos,
        reparaciones: nextReparaciones,
        historial: nextHistorial,
      };

      let hadError = false;

      void enqueueCloudTask(async () => {
        if (sessionModeRef.current === 'cloud' && cloudUidRef.current) {
          const uid = cloudUidRef.current;
          await syncCloudDatasetDiff(uid, lastCloudDatasetRef.current, payload);
          lastCloudDatasetRef.current = payload;
        } else if (sessionModeRef.current === 'guest') {
          const nextRev = revisionRef.current + 1;
          writeGuestLocalFallback({revision: nextRev, ...payload});
          try {
            const res = await fetch('/api/state', {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                ...payload,
                revision: revisionRef.current,
              }),
            });
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const body = await res.json();
              if (!res.ok) {
                throw new Error(body?.error || 'No se pudieron guardar los cambios.');
              }
              revisionRef.current = body.revision;
            } else {
              revisionRef.current = nextRev;
            }
          } catch (err) {
            if (err instanceof Error && err.message.includes('Conflicto')) {
              throw err;
            }
            revisionRef.current = nextRev;
          }
        }
      })
        .catch((err) => {
          hadError = true;
          setSyncState('error');
          notify(
            'error',
            err instanceof Error
              ? err.message
              : 'Error al guardar los cambios en la base de datos.',
          );
        })
        .finally(() => {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          if (pendingSavesRef.current === 0 && !hadError) {
            setSyncState('saved');
          }
        });
    },
    [enqueueCloudTask, notify],
  );

  const handleGoogleLogin = async (forceAccountSelect = false) => {
    setAuthError(null);
    setAuthLoading(true);
    setAuthStatus('Conectando con tu cuenta de Google...');
    try {
      const user =
        !forceAccountSelect && auth.currentUser
          ? auth.currentUser
          : await googleSignIn(forceAccountSelect);

      setGoogleUser(user);
      setRememberedUser(user);
      setAuthStatus('Preparando tu base de datos personal en la nube...');

      await enqueueCloudTask(async () => {
        await ensureUserProfile(user);
        const cloudData = await fetchUserCloudData(user.uid);
        const cloudEmpty =
          cloudData.productos.length === 0 &&
          cloudData.reparaciones.length === 0 &&
          cloudData.historial.length === 0;

        if (cloudEmpty) {
          const initialData: CloudDataset = {
            productos,
            reparaciones,
            historial,
          };
          if (
            initialData.productos.length > 0 ||
            initialData.reparaciones.length > 0 ||
            initialData.historial.length > 0
          ) {
            setAuthStatus('Inicializando datos en tu cuenta...');
            await syncCloudDatasetDiff(
              user.uid,
              {productos: [], reparaciones: [], historial: []},
              initialData,
            );
          }
          lastCloudDatasetRef.current = initialData;
          cloudUidRef.current = user.uid;
          sessionModeRef.current = 'cloud';
          setCloudUid(user.uid);
          setSessionMode('cloud');
          setSyncState('saved');
          setWelcomeOpen(false);
          notify('success', `Base de datos en la nube lista (${user.email}).`);
        } else {
          const hasGuestWork =
            sessionModeRef.current === 'guest' &&
            (productos.length > 0 || reparaciones.length > 0 || historial.length > 0);

          if (hasGuestWork) {
            setWelcomeOpen(false);
            setConflictState({user, cloudData});
          } else {
            lastCloudDatasetRef.current = cloudData;
            cloudUidRef.current = user.uid;
            sessionModeRef.current = 'cloud';
            setProductos(cloudData.productos);
            setReparaciones(cloudData.reparaciones);
            setHistorial(cloudData.historial);
            setCloudUid(user.uid);
            setSessionMode('cloud');
            setSyncState('saved');
            setWelcomeOpen(false);
            notify('success', `Sesión iniciada (${user.email}).`);
          }
        }
      });
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as {code?: unknown}).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Se cerró la ventana de Google antes de completar el ingreso.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'El navegador bloqueó la ventana de Google. Permití las ventanas emergentes e intentá de nuevo.',
        );
      } else {
        setAuthError(
          err instanceof Error
            ? err.message
            : 'No se pudo iniciar sesión con Google.',
        );
      }
      setWelcomeOpen(true);
    } finally {
      setAuthLoading(false);
      setAuthStatus(null);
    }
  };

  const handleSaveToCloudNow = async () => {
    if (sessionModeRef.current !== 'cloud' || !cloudUidRef.current || !auth.currentUser) {
      await handleGoogleLogin(false);
      return;
    }
    const uid = cloudUidRef.current;
    const currentUser = auth.currentUser;
    const currentData: CloudDataset = {
      productos,
      reparaciones,
      historial,
    };

    setManualCloudSaving(true);
    setSyncState('saving');
    try {
      await enqueueCloudTask(async () => {
        await ensureUserProfile(currentUser);
        const serverData = await fetchUserCloudData(uid);
        await syncCloudDatasetDiff(uid, serverData, currentData);
        lastCloudDatasetRef.current = currentData;
      });
      setSyncState('saved');
      notify('success', 'Copia guardada en la nube correctamente.');
    } catch (err) {
      setSyncState('error');
      notify(
        'error',
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los datos en la nube.',
      );
    } finally {
      setManualCloudSaving(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (sessionModeRef.current !== 'cloud' || !cloudUidRef.current || !auth.currentUser) {
      await handleGoogleLogin(false);
      return;
    }
    const uid = cloudUidRef.current;
    setConfirmState({
      open: true,
      title: 'Restablecer copia desde la nube',
      description:
        'Se descargará la copia más reciente guardada en Firestore y reemplazará los datos actuales en pantalla.',
      onConfirm: async () => {
        setConfirmState((prev) => ({...prev, open: false}));
        setCloudRestoring(true);
        setSyncState('loading');
        try {
          const restored = await enqueueCloudTask(async () => {
            const cloudData = await fetchUserCloudData(uid);
            lastCloudDatasetRef.current = cloudData;
            return cloudData;
          });
          setProductos(restored.productos);
          setReparaciones(restored.reparaciones);
          setHistorial(restored.historial);
          setSyncState('saved');
          notify('success', 'Copia en la nube restablecida correctamente.');
        } catch (err) {
          setSyncState('error');
          notify(
            'error',
            err instanceof Error
              ? err.message
              : 'No se pudo restablecer la copia desde la nube.',
          );
        } finally {
          setCloudRestoring(false);
        }
      },
    });
  };

  const handleContinueAsGuest = async () => {
    setAuthError(null);
    setAuthStatus(null);
    cloudUidRef.current = null;
    sessionModeRef.current = 'guest';
    setCloudUid(null);
    setSessionMode('guest');
    setWelcomeOpen(false);
    await loadGuestLocalState();
    notify('info', 'Ingresaste en modo invitado (guardado local).');
  };

  const handleSignOut = async () => {
    setAccountOpen(false);
    setMobileMenuOpen(false);

    try {
      await logoutGoogle();
    } catch {
      // Ignore Firebase Auth signOut errors
    }

    // Clear browser storage & Cache Storage
    try {
      localStorage.clear();
    } catch {
      // Ignore localStorage cleanup errors
    }
    try {
      sessionStorage.clear();
    } catch {
      // Ignore sessionStorage cleanup errors
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((k) => window.caches.delete(k)));
      } catch {
        // Ignore Cache Storage cleanup errors
      }
    }

    // Terminate & clear Firestore IndexedDB persistence
    await resetFirestoreCache();

    // Wipe all in-memory refs and state so the screen is completely blank
    cloudUidRef.current = null;
    sessionModeRef.current = 'pending';
    revisionRef.current = 0;
    pendingSavesRef.current = 0;
    saveQueueRef.current = Promise.resolve();
    lastCloudDatasetRef.current = {productos: [], reparaciones: [], historial: []};

    setCloudUid(null);
    setGoogleUser(null);
    setRememberedUser(null);
    setProductos([]);
    setReparaciones([]);
    setHistorial([]);
    setScannerCart([]);
    setScannerCheckoutOpen(false);
    setScannerPrefill(undefined);
    setRepairModalOpen(false);
    setEditingRepair(null);
    setProductModalOpen(false);
    setEditingProduct(null);
    setEditingSale(null);
    setActiveReceipt(null);
    setConfirmState({
      open: false,
      title: '',
      description: '',
      onConfirm: () => undefined,
    });
    setConflictState(null);
    setLoadError(null);
    setAuthError(null);
    setAuthStatus(null);
    setActiveSection('panel');
    setSyncState('saved');
    setSessionMode('pending');
    setWelcomeOpen(true);

    notify('info', 'Sesión cerrada y caché local eliminada.');
  };

  const handleConfirmUseCloudData = () => {
    if (!conflictState) return;
    const {user, cloudData} = conflictState;
    lastCloudDatasetRef.current = cloudData;
    cloudUidRef.current = user.uid;
    sessionModeRef.current = 'cloud';
    setProductos(cloudData.productos);
    setReparaciones(cloudData.reparaciones);
    setHistorial(cloudData.historial);
    setCloudUid(user.uid);
    setSessionMode('cloud');
    setSyncState('saved');
    setConflictState(null);
    notify('success', `Datos cargados desde tu cuenta (${user.email}).`);
  };

  const handleConfirmUploadLocalToCloud = async () => {
    if (!conflictState) return;
    const {user, cloudData} = conflictState;
    setConflictBusy(true);
    try {
      const localData: CloudDataset = {productos, reparaciones, historial};
      await enqueueCloudTask(async () => {
        await syncCloudDatasetDiff(user.uid, cloudData, localData);
        lastCloudDatasetRef.current = localData;
      });
      cloudUidRef.current = user.uid;
      sessionModeRef.current = 'cloud';
      setCloudUid(user.uid);
      setSessionMode('cloud');
      setSyncState('saved');
      setConflictState(null);
      notify('success', `Datos locales guardados en tu cuenta (${user.email}).`);
    } catch (err) {
      notify(
        'error',
        err instanceof Error
          ? err.message
          : 'No se pudieron subir los datos locales a la nube.',
      );
    } finally {
      setConflictBusy(false);
    }
  };

  // Handlers: Scanner
  const handleOpenScannerMode = (mode: 'ENTRADA' | 'VENTA', prefillCode?: string) => {
    setScannerMode(mode);
    setScannerPrefill(prefillCode);
    setActiveSection('escaner');
  };

  const handleStockEntry = (product: Product, addQuantity: number) => {
    const existing = productos.find((p) => p.codigo === product.codigo);
    const nextProductos = existing
      ? productos.map((p) =>
          p.codigo === product.codigo
            ? {
                ...p,
                nombre: product.nombre,
                categoria: product.categoria,
                costo: product.costo,
                precio: product.precio,
                stock: p.stock + addQuantity,
              }
            : p,
        )
      : [...productos, {...product, stock: addQuantity}];

    setProductos(nextProductos);
    persistState(nextProductos, reparaciones, historial);
    notify('success', `Stock actualizado: ${product.nombre} (+${addQuantity} un.).`);
  };

  const handleAddScannerSaleItem = (prod: Product): boolean => {
    const enCarrito = scannerCart.find((x) => x.prod.codigo === prod.codigo);
    const nuevaCant = (enCarrito ? enCarrito.cantidad : 0) + 1;
    if (nuevaCant > prod.stock) {
      notify(
        'error',
        `Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}.`,
      );
      return false;
    }

    setScannerCart((prev) => {
      const idx = prev.findIndex((x) => x.prod.codigo === prod.codigo);
      if (idx >= 0) {
        return prev.map((x, i) =>
          i === idx ? {...x, cantidad: x.cantidad + 1} : x,
        );
      }
      return [...prev, {prod, cantidad: 1}];
    });
    setScannerCheckoutOpen(true);
    return true;
  };

  const handleAddScannerCodeFromModal = (codigo: string): boolean => {
    const clean = codigo.trim();
    if (!clean) return false;
    const prod = productos.find(
      (p) => p.codigo.toLowerCase() === clean.toLowerCase(),
    );
    if (!prod) {
      notify('error', `Código "${clean}" no encontrado en el inventario.`);
      return false;
    }
    if (prod.stock <= 0) {
      notify('error', `El producto "${prod.nombre}" no tiene stock disponible.`);
      return false;
    }
    return handleAddScannerSaleItem(prod);
  };

  const handleChangeScannerQty = (index: number, delta: number) => {
    const target = scannerCart[index];
    if (!target) return;
    const nextQty = target.cantidad + delta;
    if (delta > 0 && nextQty > target.prod.stock) {
      notify(
        'error',
        `Stock insuficiente para "${target.prod.nombre}". Máximo: ${target.prod.stock}.`,
      );
      return;
    }
    if (nextQty <= 0) {
      const next = scannerCart.filter((_, i) => i !== index);
      setScannerCart(next);
      if (next.length === 0) setScannerCheckoutOpen(false);
      return;
    }
    setScannerCart((prev) =>
      prev.map((item, i) => (i === index ? {...item, cantidad: nextQty} : item)),
    );
  };

  const handleRemoveScannerItem = (index: number) => {
    const next = scannerCart.filter((_, i) => i !== index);
    setScannerCart(next);
    if (next.length === 0) {
      setScannerCheckoutOpen(false);
    }
  };

  const handleCancelScannerSale = () => {
    setScannerCart([]);
    setScannerCheckoutOpen(false);
    notify('info', 'Venta cancelada. No se descontó stock.');
  };

  const handleConfirmScannerSale = ({
    metodo,
    descuento,
    pagaCon,
  }: {
    metodo: PaymentMethod;
    descuento: number;
    pagaCon: number;
  }) => {
    if (scannerCart.length === 0) return;

    for (const line of scannerCart) {
      const latest = productos.find((p) => p.codigo === line.prod.codigo);
      if (!latest || latest.stock < line.cantidad) {
        notify(
          'error',
          `Stock insuficiente para "${line.prod.nombre}" (disponible: ${latest?.stock ?? 0}).`,
        );
        return;
      }
    }

    const nextProductos = productos.map((p) => {
      const line = scannerCart.find((x) => x.prod.codigo === p.codigo);
      return line ? {...p, stock: Math.max(0, p.stock - line.cantidad)} : p;
    });

    const subtotal = scannerCart.reduce(
      (s, x) => s + (Number(x.prod.precio) || 0) * x.cantidad,
      0,
    );
    const total = Math.max(0, subtotal - descuento);
    const vuelto = Math.max(0, pagaCon - total);
    const nRecibo = siguienteNroRecibo(historial);
    const fecha = getLocalDateTimeStr();

    const saleItems = scannerCart.map((x) => ({
      codigo: x.prod.codigo,
      nombre: x.prod.nombre,
      precio: Number(x.prod.precio) || 0,
      costo: Number(x.prod.costo) || 0,
      cantidad: x.cantidad,
      es_reparacion: false,
    }));

    const newSale: SaleRecord = {
      n_recibo: nRecibo,
      fecha,
      detalle:
        scannerCart.map((x) => `${x.cantidad}x ${x.prod.nombre}`).join(', ') +
        ' (Escáner)',
      metodo_pago: metodo,
      total,
      descuento,
      paga_con: pagaCon,
      vuelto,
      items: saleItems,
    };

    const nextHistorial = [...historial, newSale];
    setProductos(nextProductos);
    setHistorial(nextHistorial);
    persistState(nextProductos, reparaciones, nextHistorial);
    setScannerCart([]);
    setScannerCheckoutOpen(false);

    setActiveReceipt({
      type: 'sale',
      n_recibo: nRecibo,
      fecha,
      metodo_pago: metodo,
      items: saleItems,
      subtotal,
      descuento,
      total,
      paga_con: pagaCon,
      vuelto,
    });
    notify('success', `Venta confirmada (${nRecibo}): ${formatSaleCount(scannerCart)}.`);
  };

  // Handlers: Repairs
  const handleSaveRepair = (data: {
    id?: number;
    cliente: string;
    telefono: string;
    equipo: string;
    falla: string;
    estado: RepairStatus;
    presupuesto: number;
    senia: number;
    costo_repuesto: number;
  }) => {
    let nextReparaciones: RepairOrder[];
    let savedOrder: RepairOrder;

    if (data.id) {
      nextReparaciones = reparaciones.map((r) =>
        r.id === data.id
          ? {
              ...r,
              cliente: data.cliente,
              telefono: data.telefono,
              equipo: data.equipo,
              falla: data.falla,
              estado: data.estado,
              presupuesto: data.presupuesto,
              senia: data.senia,
              costo_repuesto: data.costo_repuesto,
            }
          : r,
      );
      savedOrder = nextReparaciones.find((r) => r.id === data.id)!;
      notify('success', `Orden ${savedOrder.n_orden} actualizada.`);
    } else {
      const nextNum =
        reparaciones.reduce((max, r) => {
          const parsed = parseInt((r.n_orden || '').replace(/\D+/g, ''), 10);
          return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
        }, 1000) + 1;

      savedOrder = {
        id: Date.now(),
        n_orden: `TFX-${nextNum}`,
        cliente: data.cliente,
        telefono: data.telefono,
        equipo: data.equipo,
        falla: data.falla,
        estado: data.estado,
        presupuesto: data.presupuesto,
        senia: data.senia,
        costo_repuesto: data.costo_repuesto,
        fecha: getLocalDateStr(),
      };
      nextReparaciones = [...reparaciones, savedOrder];
      notify('success', `Orden ${savedOrder.n_orden} creada con éxito.`);
    }

    setReparaciones(nextReparaciones);
    persistState(productos, nextReparaciones, historial);
    setRepairModalOpen(false);
    setEditingRepair(null);
    setActiveReceipt({type: 'repair', orden: savedOrder});
  };

  const handleRequestDeleteRepair = (order: RepairOrder) => {
    setConfirmState({
      open: true,
      title: `Eliminar orden ${order.n_orden}`,
      description: `Se eliminará la orden de ${order.cliente} (${order.equipo}). Esta acción no se puede deshacer.`,
      onConfirm: () => {
        const nextRep = reparaciones.filter((r) => r.id !== order.id);
        setReparaciones(nextRep);
        persistState(productos, nextRep, historial);
        setConfirmState((prev) => ({...prev, open: false}));
        notify('info', `Orden ${order.n_orden} eliminada.`);
      },
    });
  };

  // Handlers: Inventory
  const handleSaveProduct = (product: Product, isEdit: boolean) => {
    if (!isEdit && productos.some((p) => p.codigo === product.codigo)) {
      notify('error', `Ya existe un repuesto con el código ${product.codigo}.`);
      return;
    }

    const nextProductos = isEdit
      ? productos.map((p) => (p.codigo === product.codigo ? product : p))
      : [...productos, product];

    setProductos(nextProductos);
    persistState(nextProductos, reparaciones, historial);
    setProductModalOpen(false);
    setEditingProduct(null);
    notify(
      'success',
      isEdit ? `Producto "${product.nombre}" actualizado.` : `Producto "${product.nombre}" agregado.`,
    );
  };

  const handleRequestDeleteProduct = (product: Product) => {
    setConfirmState({
      open: true,
      title: `Eliminar ${product.nombre}`,
      description: `Se quitará el código ${product.codigo} del inventario permanentemente.`,
      onConfirm: () => {
        const nextProd = productos.filter((p) => p.codigo !== product.codigo);
        setProductos(nextProd);
        persistState(nextProd, reparaciones, historial);
        setConfirmState((prev) => ({...prev, open: false}));
        notify('info', `Producto ${product.codigo} eliminado del inventario.`);
      },
    });
  };

  // Handlers: POS Checkout
  const handlePosCheckout = ({
    items,
    descuento,
    metodoPago,
    pagaCon,
  }: {
    items: CartItem[];
    descuento: number;
    metodoPago: PaymentMethod;
    pagaCon: number;
  }) => {
    let nextProductos = [...productos];
    let nextReparaciones = [...reparaciones];

    let subtotal = 0;
    items.forEach((item) => {
      subtotal += item.precio * item.cantidad;
      if (item.es_reparacion && item.id) {
        nextReparaciones = nextReparaciones.map((r) =>
          r.id === item.id ? {...r, estado: 'Retirado', senia: r.presupuesto} : r,
        );
      } else if (item.codigo) {
        nextProductos = nextProductos.map((p) =>
          p.codigo === item.codigo
            ? {...p, stock: Math.max(0, p.stock - item.cantidad)}
            : p,
        );
      }
    });

    const total = Math.max(0, subtotal - descuento);
    const vuelto = Math.max(0, pagaCon - total);
    const nRecibo = siguienteNroRecibo(historial);
    const fecha = getLocalDateTimeStr();

    const saleItems = items.map((i) => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      precio: i.precio,
      costo: i.es_reparacion
        ? 0
        : Number(productos.find((p) => p.codigo === i.codigo)?.costo) || 0,
      codigo: i.codigo,
      es_reparacion: i.es_reparacion,
    }));

    const newRecord: SaleRecord = {
      n_recibo: nRecibo,
      fecha,
      detalle: items.map((i) => `${i.cantidad}x ${i.nombre}`).join(', '),
      metodo_pago: metodoPago,
      total,
      descuento,
      paga_con: pagaCon,
      vuelto,
      items: saleItems,
    };

    const nextHistorial = [...historial, newRecord];
    setProductos(nextProductos);
    setReparaciones(nextReparaciones);
    setHistorial(nextHistorial);
    persistState(nextProductos, nextReparaciones, nextHistorial);

    setActiveReceipt({
      type: 'sale',
      n_recibo: nRecibo,
      fecha,
      metodo_pago: metodoPago,
      items: saleItems,
      subtotal,
      descuento,
      total,
      paga_con: pagaCon,
      vuelto,
    });
    notify('success', `Cobro ${nRecibo} registrado con éxito.`);
  };

  const handleReprintSale = (sale: SaleRecord) => {
    const items =
      sale.items && sale.items.length > 0
        ? sale.items
        : [{nombre: sale.detalle, cantidad: 1, precio: sale.total}];

    setActiveReceipt({
      type: 'sale',
      n_recibo: sale.n_recibo,
      fecha: sale.fecha,
      metodo_pago: sale.metodo_pago,
      items,
      subtotal: sale.total + (sale.descuento ?? 0),
      descuento: sale.descuento ?? 0,
      total: sale.total,
      paga_con: sale.paga_con ?? sale.total,
      vuelto: sale.vuelto ?? 0,
    });
  };

  const handleSaveEditedSale = (updated: SaleRecord) => {
    const idx = historial.findIndex((s) => s === editingSale || s.n_recibo === updated.n_recibo);
    if (idx < 0) return;
    const nextHistorial = historial.map((s, i) => (i === idx ? updated : s));
    setHistorial(nextHistorial);
    persistState(productos, reparaciones, nextHistorial);
    setEditingSale(null);
    notify('success', `Venta ${updated.n_recibo} actualizada.`);
  };

  const handleDeleteEditedSale = (sale: SaleRecord, restoreStock: boolean) => {
    let nextProductos = [...productos];
    if (restoreStock) {
      const affected = productosDeVenta(sale, productos);
      affected.forEach(({prod, cantidad}) => {
        nextProductos = nextProductos.map((p) =>
          p.codigo === prod.codigo ? {...p, stock: p.stock + cantidad} : p,
        );
      });
    }
    const nextHistorial = historial.filter(
      (s) => s !== sale && s.n_recibo !== sale.n_recibo,
    );
    setProductos(nextProductos);
    setHistorial(nextHistorial);
    persistState(nextProductos, reparaciones, nextHistorial);
    setEditingSale(null);
    notify('info', `Venta ${sale.n_recibo} eliminada del historial.`);
  };

  // Backup Export / Import
  const handleExportBackup = () => {
    downloadJSONBackup({productos, reparaciones, historial});
    notify('success', 'Copia de seguridad JSON descargada.');
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (
        !parsed ||
        !Array.isArray(parsed.productos) ||
        !Array.isArray(parsed.reparaciones) ||
        !Array.isArray(parsed.historial)
      ) {
        throw new Error('El archivo seleccionado no tiene el formato válido de TECH.');
      }

      if (sessionModeRef.current === 'cloud') {
        setProductos(parsed.productos);
        setReparaciones(parsed.reparaciones);
        setHistorial(parsed.historial);
        persistState(parsed.productos, parsed.reparaciones, parsed.historial);
        notify('success', 'Respaldo restaurado y guardado en tu cuenta en la nube.');
        return;
      }

      try {
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            productos: parsed.productos,
            reparaciones: parsed.reparaciones,
            historial: parsed.historial,
          }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await res.json();
          if (!res.ok) throw new Error(body?.error || 'Error al restaurar respaldo.');
          revisionRef.current = body.revision;
          setProductos(body.productos);
          setReparaciones(body.reparaciones);
          setHistorial(body.historial);
          writeGuestLocalFallback(body);
          setSyncState('saved');
          notify('success', 'Respaldo restaurado y sincronizado correctamente.');
          return;
        }
      } catch {
        // Fall back to localStorage persistence on static deployments
      }

      const nextRev = revisionRef.current + 1;
      const nextState: AppState = {
        revision: nextRev,
        productos: parsed.productos,
        reparaciones: parsed.reparaciones,
        historial: parsed.historial,
      };
      revisionRef.current = nextRev;
      setProductos(nextState.productos);
      setReparaciones(nextState.reparaciones);
      setHistorial(nextState.historial);
      writeGuestLocalFallback(nextState);
      setSyncState('saved');
      notify('success', 'Respaldo JSON importado localmente correctamente.');
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'El archivo seleccionado no es válido.',
      );
    }
  };

  // Public Legal Routes (/privacidad & /terminos) accessible without login
  if (legalRoute) {
    return (
      <LegalPage
        docType={legalRoute}
        onNavigateDoc={navigateToLegal}
        onBack={navigateBackFromLegal}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative overflow-x-hidden">
      {sessionMode !== 'pending' && (
        <>
          <Logo3DBackground sidebarCollapsed={sidebarCollapsed} />

          <Sidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />

          <div
            className={`relative z-10 transition-all duration-200 min-h-screen flex flex-col min-w-0 ${
              sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'
            }`}
          >
            {/* Mobile Header */}
            <header className="md:hidden sticky top-0 z-30 bg-slate-900 text-white px-4 h-14 flex items-center justify-between border-b border-slate-800">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 -ml-2 rounded-lg text-slate-200 hover:bg-slate-800"
                aria-label="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <img
                  src={TECH_LOGO_PATH}
                  alt="TECH"
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded object-cover bg-slate-950"
                />
                <span className="text-sm font-bold tracking-wide text-teal-400">TECH</span>
              </div>
              <div className="w-9" aria-hidden="true" />
            </header>

            <main className="relative z-10 flex-1 min-w-0 p-3.5 sm:p-6 lg:p-8 pb-20 max-w-7xl w-full mx-auto">
              {loadError ? (
                <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-3">
                  <p className="text-sm font-semibold text-red-700">{loadError}</p>
                  <button
                    type="button"
                    onClick={loadGuestLocalState}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reintentar</span>
                  </button>
                </div>
              ) : (
                <>
                  {activeSection === 'panel' && (
                    <DashboardSection
                      productos={productos}
                      reparaciones={reparaciones}
                      historial={historial}
                      onOpenScannerMode={handleOpenScannerMode}
                      onNavigate={setActiveSection}
                      onPrintRepair={(order) => setActiveReceipt({type: 'repair', orden: order})}
                    />
                  )}

                  {activeSection === 'escaner' && (
                    <ScannerSection
                      mode={scannerMode}
                      onChangeMode={setScannerMode}
                      prefillCode={scannerPrefill}
                      onClearPrefill={() => setScannerPrefill(undefined)}
                      productos={productos}
                      scannerCart={scannerCart}
                      onStockEntry={handleStockEntry}
                      onAddScannerSaleItem={handleAddScannerSaleItem}
                      onOpenScannerConfirm={() => setScannerCheckoutOpen(true)}
                      onClearScannerCart={handleCancelScannerSale}
                      onNotify={notify}
                    />
                  )}

                  {activeSection === 'tecnico' && (
                    <RepairsSection
                      reparaciones={reparaciones}
                      onNewRepair={() => {
                        setEditingRepair(null);
                        setRepairModalOpen(true);
                      }}
                      onEditRepair={(order) => {
                        setEditingRepair(order);
                        setRepairModalOpen(true);
                      }}
                      onPrintRepair={(order) => setActiveReceipt({type: 'repair', orden: order})}
                      onDeleteRepair={handleRequestDeleteRepair}
                      onNotify={notify}
                    />
                  )}

                  {activeSection === 'inventario' && (
                    <InventorySection
                      productos={productos}
                      onAddProduct={() => {
                        setEditingProduct(null);
                        setProductModalOpen(true);
                      }}
                      onEditProduct={(prod) => {
                        setEditingProduct(prod);
                        setProductModalOpen(true);
                      }}
                      onDeleteProduct={handleRequestDeleteProduct}
                      onNotify={notify}
                    />
                  )}

                  {activeSection === 'pos' && (
                    <PosSection
                      productos={productos}
                      reparaciones={reparaciones}
                      modalOpen={
                        accountOpen ||
                        welcomeOpen ||
                        conflictState !== null ||
                        repairModalOpen ||
                        productModalOpen ||
                        activeReceipt !== null ||
                        confirmState.open ||
                        scannerCheckoutOpen ||
                        editingSale !== null
                      }
                      onCheckout={handlePosCheckout}
                      onNotify={notify}
                    />
                  )}

                  {activeSection === 'balance' && (
                    <BalanceSection
                      productos={productos}
                      reparaciones={reparaciones}
                      historial={historial}
                    />
                  )}

                  {activeSection === 'excel' && (
                    <HistorySection
                      historial={historial}
                      onReprintSale={handleReprintSale}
                      onEditSale={(sale) => setEditingSale(sale)}
                      onNotify={notify}
                    />
                  )}
                </>
              )}
            </main>
          </div>

          <AccountFloatingMenu
            open={accountOpen}
            onSetOpen={setAccountOpen}
            sessionMode={sessionMode}
            googleUser={googleUser}
            syncState={syncState}
            manualCloudSaving={manualCloudSaving}
            cloudRestoring={cloudRestoring}
            onSaveToCloud={handleSaveToCloudNow}
            onRestoreFromCloud={handleRestoreFromCloud}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onSwitchAccount={() => {
              setAuthError(null);
              setWelcomeOpen(true);
            }}
            onSignOut={handleSignOut}
          />

          <RepairModal
            open={repairModalOpen}
            editingOrder={editingRepair}
            onClose={() => {
              setRepairModalOpen(false);
              setEditingRepair(null);
            }}
            onSave={handleSaveRepair}
          />

          <ProductModal
            open={productModalOpen}
            editingProduct={editingProduct}
            onClose={() => {
              setProductModalOpen(false);
              setEditingProduct(null);
            }}
            onSave={handleSaveProduct}
          />

          <ScannerCheckoutModal
            open={scannerCheckoutOpen}
            items={scannerCart}
            productos={productos}
            historial={historial}
            onAddByCode={handleAddScannerCodeFromModal}
            onChangeQty={handleChangeScannerQty}
            onRemoveItem={handleRemoveScannerItem}
            onCancelSale={handleCancelScannerSale}
            onKeepScanning={() => setScannerCheckoutOpen(false)}
            onConfirmSale={handleConfirmScannerSale}
          />

          <EditSaleModal
            sale={editingSale}
            isDuplicate={
              editingSale ? detectarVentasDuplicadas(historial).has(editingSale) : false
            }
            productos={productos}
            onClose={() => setEditingSale(null)}
            onSave={handleSaveEditedSale}
            onDelete={handleDeleteEditedSale}
          />

          <ReceiptModal
            receipt={activeReceipt}
            onClose={() => setActiveReceipt(null)}
          />

          <ConfirmModal
            open={confirmState.open}
            title={confirmState.title}
            description={confirmState.description}
            onCancel={() => setConfirmState((prev) => ({...prev, open: false}))}
            onConfirm={confirmState.onConfirm}
          />
        </>
      )}

      <WelcomeAuthModal
        open={welcomeOpen}
        canDismiss={sessionMode !== 'pending'}
        rememberedUser={rememberedUser}
        loading={authLoading}
        statusMessage={authStatus}
        errorMessage={authError}
        onGoogleLogin={handleGoogleLogin}
        onContinueAsGuest={handleContinueAsGuest}
        onClose={() => setWelcomeOpen(false)}
        onNavigateLegal={navigateToLegal}
      />

      <CloudConflictModal
        open={conflictState !== null}
        userEmail={conflictState?.user.email || ''}
        cloudData={conflictState?.cloudData || null}
        localCounts={{
          productos: productos.length,
          reparaciones: reparaciones.length,
          historial: historial.length,
        }}
        busy={conflictBusy}
        onUseCloud={handleConfirmUseCloudData}
        onUploadLocalToCloud={handleConfirmUploadLocalToCloud}
        onCancel={() => {
          setConflictState(null);
          if (sessionMode === 'pending') {
            setWelcomeOpen(true);
          }
        }}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function formatSaleCount(cart: ScannerCartLine[]): string {
  const units = cart.reduce((s, x) => s + x.cantidad, 0);
  return `${units} ${units === 1 ? 'unidad' : 'unidades'}`;
}
