import type {User} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {Product, RepairOrder, RepairStatus, SaleItem, SaleRecord} from '../types';
import {db} from './firebaseClient';
import {handleFirestoreError, OperationType} from './firestoreErrors';

export interface CloudDataset {
  productos: Product[];
  reparaciones: RepairOrder[];
  historial: SaleRecord[];
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;

function sanitizeToValidDocId(prefix: string, rawKey: string): string {
  const trimmed = String(rawKey ?? '').trim();
  const candidate = `${prefix}${trimmed}`;
  if (candidate.length >= 1 && candidate.length <= 128 && VALID_ID_RE.test(candidate)) {
    return candidate;
  }
  // Deterministic hex encoding for arbitrary barcodes (spaces, slashes, dots, unicode)
  let hex = '';
  for (let i = 0; i < trimmed.length; i++) {
    hex += trimmed.charCodeAt(i).toString(16).padStart(4, '0');
  }
  const encoded = `${prefix}h_${hex || 'empty'}`;
  return encoded.slice(0, 128);
}

function productDocId(codigo: string): string {
  return sanitizeToValidDocId('p_', codigo);
}

function repairDocId(r: RepairOrder): string {
  return sanitizeToValidDocId('r_', String(r.id));
}

function saleDocId(nRecibo: string): string {
  return sanitizeToValidDocId('s_', nRecibo);
}

function buildProductPayload(uid: string, p: Product, includeCreateFields: boolean) {
  const base = {
    nombre: String(p.nombre || 'Producto').slice(0, 160),
    categoria: String(p.categoria || 'Repuestos').slice(0, 80),
    costo: Math.max(0, Number(p.costo) || 0),
    precio: Math.max(0, Number(p.precio) || 0),
    stock: Math.max(0, Number(p.stock) || 0),
    updatedAt: serverTimestamp(),
  };
  if (includeCreateFields) {
    return {
      ownerUid: uid,
      codigo: String(p.codigo).slice(0, 64),
      ...base,
      createdAt: serverTimestamp(),
    };
  }
  return base;
}

function buildRepairPayload(uid: string, r: RepairOrder, includeCreateFields: boolean) {
  const validStatuses: RepairStatus[] = [
    'En Reparación',
    'Listo para Entregar',
    'Retirado',
  ];
  const estado: RepairStatus = validStatuses.includes(r.estado)
    ? r.estado
    : 'En Reparación';

  const updatable = {
    cliente: String(r.cliente || 'Cliente').slice(0, 120),
    telefono: String(r.telefono ?? '').slice(0, 40),
    equipo: String(r.equipo || 'Equipo').slice(0, 160),
    falla: String(r.falla ?? '').slice(0, 500),
    estado,
    presupuesto: Math.max(0, Number(r.presupuesto) || 0),
    senia: Math.max(0, Number(r.senia) || 0),
    costo_repuesto: Math.max(0, Number(r.costo_repuesto) || 0),
    fecha: String(r.fecha || '').slice(0, 32) || new Date().toISOString().slice(0, 10),
    updatedAt: serverTimestamp(),
  };

  if (includeCreateFields) {
    const cleanOrder = sanitizeToValidDocId('', String(r.n_orden || `TFX-${r.id}`)).slice(0, 32);
    return {
      ownerUid: uid,
      id: Math.max(0, Number(r.id) || 0),
      n_orden: cleanOrder,
      ...updatable,
      createdAt: serverTimestamp(),
    };
  }
  return updatable;
}

function sanitizeSaleItems(items?: SaleItem[]): SaleItem[] | undefined {
  if (!Array.isArray(items)) return undefined;
  return items.slice(0, 100).map((it) => {
    const clean: SaleItem = {
      nombre: String(it.nombre || 'Item').slice(0, 160),
      precio: Math.max(0, Number(it.precio) || 0),
      cantidad: Math.max(1, Number(it.cantidad) || 1),
    };
    if (it.codigo !== undefined) clean.codigo = String(it.codigo).slice(0, 64);
    if (it.costo !== undefined) clean.costo = Math.max(0, Number(it.costo) || 0);
    if (it.es_reparacion !== undefined) clean.es_reparacion = Boolean(it.es_reparacion);
    return clean;
  });
}

function buildSalePayload(uid: string, s: SaleRecord, includeCreateFields: boolean) {
  const updatable: Record<string, unknown> = {
    fecha: String(s.fecha || '').slice(0, 32) || new Date().toISOString().slice(0, 19).replace('T', ' '),
    detalle: String(s.detalle || 'Venta').slice(0, 600),
    metodo_pago: String(s.metodo_pago || 'Efectivo').slice(0, 40),
    total: Math.max(0, Number(s.total) || 0),
    updatedAt: serverTimestamp(),
  };

  if (typeof s.descuento === 'number' && Number.isFinite(s.descuento)) {
    updatable.descuento = Math.max(0, s.descuento);
  }
  if (typeof s.paga_con === 'number' && Number.isFinite(s.paga_con)) {
    updatable.paga_con = Math.max(0, s.paga_con);
  }
  if (typeof s.vuelto === 'number' && Number.isFinite(s.vuelto)) {
    updatable.vuelto = Math.max(0, s.vuelto);
  }
  if (typeof s.editado === 'string' && s.editado.length > 0) {
    updatable.editado = s.editado.slice(0, 40);
  }
  const cleanItems = sanitizeSaleItems(s.items);
  if (cleanItems !== undefined) {
    updatable.items = cleanItems;
  }

  if (includeCreateFields) {
    const cleanReceipt = sanitizeToValidDocId('', String(s.n_recibo || 'TFX-REC-1')).slice(0, 40);
    return {
      ownerUid: uid,
      n_recibo: cleanReceipt,
      ...updatable,
      createdAt: serverTimestamp(),
    };
  }
  return updatable;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const path = `users/${user.uid}`;
  try {
    const snap = await getDoc(userRef);
    const email = (user.email || `${user.uid}@google.local`).slice(0, 160);
    const displayName = user.displayName ? user.displayName.slice(0, 120) : undefined;
    const photoURL = user.photoURL ? user.photoURL.slice(0, 500) : undefined;

    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        ownerUid: user.uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (displayName) payload.displayName = displayName;
      if (photoURL) payload.photoURL = photoURL;
      await setDoc(userRef, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        email,
        updatedAt: serverTimestamp(),
      };
      if (displayName) updatePayload.displayName = displayName;
      if (photoURL) updatePayload.photoURL = photoURL;
      await updateDoc(userRef, updatePayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

function mapDocToProduct(data: Record<string, unknown>): Product {
  return {
    codigo: String(data.codigo ?? ''),
    nombre: String(data.nombre ?? ''),
    categoria: String(data.categoria ?? 'Repuestos'),
    costo: Number(data.costo) || 0,
    precio: Number(data.precio) || 0,
    stock: Number(data.stock) || 0,
  };
}

function mapDocToRepair(data: Record<string, unknown>): RepairOrder {
  return {
    id: Number(data.id) || 0,
    n_orden: String(data.n_orden ?? ''),
    cliente: String(data.cliente ?? ''),
    telefono: String(data.telefono ?? ''),
    equipo: String(data.equipo ?? ''),
    falla: String(data.falla ?? ''),
    estado: (data.estado as RepairStatus) || 'En Reparación',
    presupuesto: Number(data.presupuesto) || 0,
    senia: Number(data.senia) || 0,
    costo_repuesto: Number(data.costo_repuesto) || 0,
    fecha: String(data.fecha ?? ''),
  };
}

function mapDocToSale(data: Record<string, unknown>): SaleRecord {
  const sale: SaleRecord = {
    n_recibo: String(data.n_recibo ?? ''),
    fecha: String(data.fecha ?? ''),
    detalle: String(data.detalle ?? ''),
    metodo_pago: String(data.metodo_pago ?? 'Efectivo'),
    total: Number(data.total) || 0,
  };
  if (typeof data.descuento === 'number') sale.descuento = data.descuento;
  if (typeof data.paga_con === 'number') sale.paga_con = data.paga_con;
  if (typeof data.vuelto === 'number') sale.vuelto = data.vuelto;
  if (typeof data.editado === 'string') sale.editado = data.editado;
  if (Array.isArray(data.items)) sale.items = data.items as SaleItem[];
  return sale;
}

export async function fetchUserCloudData(uid: string): Promise<CloudDataset> {
  try {
    const prodQ = query(
      collection(db, 'users', uid, 'productos'),
      where('ownerUid', '==', uid),
    );
    const repQ = query(
      collection(db, 'users', uid, 'reparaciones'),
      where('ownerUid', '==', uid),
    );
    const histQ = query(
      collection(db, 'users', uid, 'historial'),
      where('ownerUid', '==', uid),
    );

    const [prodSnap, repSnap, histSnap] = await Promise.all([
      getDocs(prodQ),
      getDocs(repQ),
      getDocs(histQ),
    ]);

    const productos = prodSnap.docs
      .map((d) => mapDocToProduct(d.data() as Record<string, unknown>))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const reparaciones = repSnap.docs
      .map((d) => mapDocToRepair(d.data() as Record<string, unknown>))
      .sort((a, b) => a.id - b.id);

    const historial = histSnap.docs
      .map((d) => mapDocToSale(d.data() as Record<string, unknown>))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.n_recibo.localeCompare(b.n_recibo));

    return {productos, reparaciones, historial};
  } catch (err) {
    return handleFirestoreError(err, OperationType.LIST, `users/${uid}`);
  }
}

export function subscribeUserCloudData(
  uid: string,
  callbacks: {
    onProductos: (items: Product[]) => void;
    onReparaciones: (items: RepairOrder[]) => void;
    onHistorial: (items: SaleRecord[]) => void;
    onError: (err: Error) => void;
  },
): Unsubscribe {
  const prodQ = query(
    collection(db, 'users', uid, 'productos'),
    where('ownerUid', '==', uid),
  );
  const repQ = query(
    collection(db, 'users', uid, 'reparaciones'),
    where('ownerUid', '==', uid),
  );
  const histQ = query(
    collection(db, 'users', uid, 'historial'),
    where('ownerUid', '==', uid),
  );

  const reportError = (err: unknown, path: string) => {
    try {
      handleFirestoreError(err, OperationType.LIST, path);
    } catch (wrapped) {
      callbacks.onError(
        wrapped instanceof Error ? wrapped : new Error(String(wrapped)),
      );
    }
  };

  const unsubProd = onSnapshot(
    prodQ,
    (snap) => {
      const items = snap.docs
        .map((d) => mapDocToProduct(d.data() as Record<string, unknown>))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      callbacks.onProductos(items);
    },
    (err) => reportError(err, `users/${uid}/productos`),
  );

  const unsubRep = onSnapshot(
    repQ,
    (snap) => {
      const items = snap.docs
        .map((d) => mapDocToRepair(d.data() as Record<string, unknown>))
        .sort((a, b) => a.id - b.id);
      callbacks.onReparaciones(items);
    },
    (err) => reportError(err, `users/${uid}/reparaciones`),
  );

  const unsubHist = onSnapshot(
    histQ,
    (snap) => {
      const items = snap.docs
        .map((d) => mapDocToSale(d.data() as Record<string, unknown>))
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.n_recibo.localeCompare(b.n_recibo));
      callbacks.onHistorial(items);
    },
    (err) => reportError(err, `users/${uid}/historial`),
  );

  return () => {
    unsubProd();
    unsubRep();
    unsubHist();
  };
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

export async function syncCloudDatasetDiff(
  uid: string,
  prev: CloudDataset,
  next: CloudDataset,
): Promise<void> {
  type Op =
    | {kind: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown>}
    | {kind: 'update'; ref: ReturnType<typeof doc>; data: Record<string, unknown>}
    | {kind: 'delete'; ref: ReturnType<typeof doc>};

  const ops: Op[] = [];

  // 1. Productos diff
  const prevProdMap = new Map(prev.productos.map((p) => [p.codigo, p]));
  const nextProdMap = new Map(next.productos.map((p) => [p.codigo, p]));

  prevProdMap.forEach((_, codigo) => {
    if (!nextProdMap.has(codigo)) {
      ops.push({
        kind: 'delete',
        ref: doc(db, 'users', uid, 'productos', productDocId(codigo)),
      });
    }
  });

  nextProdMap.forEach((prod, codigo) => {
    const oldProd = prevProdMap.get(codigo);
    const ref = doc(db, 'users', uid, 'productos', productDocId(codigo));
    if (!oldProd) {
      ops.push({
        kind: 'set',
        ref,
        data: buildProductPayload(uid, prod, true),
      });
    } else if (stableStringify(oldProd) !== stableStringify(prod)) {
      ops.push({
        kind: 'update',
        ref,
        data: buildProductPayload(uid, prod, false),
      });
    }
  });

  // 2. Reparaciones diff
  const prevRepMap = new Map(prev.reparaciones.map((r) => [r.id, r]));
  const nextRepMap = new Map(next.reparaciones.map((r) => [r.id, r]));

  prevRepMap.forEach((oldRep, id) => {
    if (!nextRepMap.has(id)) {
      ops.push({
        kind: 'delete',
        ref: doc(db, 'users', uid, 'reparaciones', repairDocId(oldRep)),
      });
    }
  });

  nextRepMap.forEach((rep, id) => {
    const oldRep = prevRepMap.get(id);
    const ref = doc(db, 'users', uid, 'reparaciones', repairDocId(rep));
    if (!oldRep) {
      ops.push({
        kind: 'set',
        ref,
        data: buildRepairPayload(uid, rep, true),
      });
    } else if (stableStringify(oldRep) !== stableStringify(rep)) {
      ops.push({
        kind: 'update',
        ref,
        data: buildRepairPayload(uid, rep, false),
      });
    }
  });

  // 3. Historial diff
  const prevHistMap = new Map(prev.historial.map((s) => [s.n_recibo, s]));
  const nextHistMap = new Map(next.historial.map((s) => [s.n_recibo, s]));

  prevHistMap.forEach((_, nRecibo) => {
    if (!nextHistMap.has(nRecibo)) {
      ops.push({
        kind: 'delete',
        ref: doc(db, 'users', uid, 'historial', saleDocId(nRecibo)),
      });
    }
  });

  nextHistMap.forEach((sale, nRecibo) => {
    const oldSale = prevHistMap.get(nRecibo);
    const ref = doc(db, 'users', uid, 'historial', saleDocId(nRecibo));
    if (!oldSale) {
      ops.push({
        kind: 'set',
        ref,
        data: buildSalePayload(uid, sale, true),
      });
    } else if (stableStringify(oldSale) !== stableStringify(sale)) {
      ops.push({
        kind: 'update',
        ref,
        data: buildSalePayload(uid, sale, false),
      });
    }
  });

  if (ops.length === 0) return;

  // Execute in chunks of 400 batch operations (Firestore max is 500 per batch)
  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const slice = ops.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of slice) {
        if (op.kind === 'set') {
          batch.set(op.ref, op.data);
        } else if (op.kind === 'update') {
          batch.update(op.ref, op.data);
        } else {
          batch.delete(op.ref);
        }
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}
