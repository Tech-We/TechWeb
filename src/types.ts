export type SectionId =
  | 'panel'
  | 'escaner'
  | 'tecnico'
  | 'inventario'
  | 'pos'
  | 'balance'
  | 'excel';

export type RepairStatus =
  | 'En Reparación'
  | 'Listo para Entregar'
  | 'Retirado';

export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta de Débito'
  | 'Tarjeta de Crédito';

export interface Product {
  codigo: string;
  nombre: string;
  categoria: string;
  costo: number;
  precio: number;
  stock: number;
}

export interface RepairOrder {
  id: number;
  n_orden: string;
  cliente: string;
  telefono: string;
  equipo: string;
  falla: string;
  estado: RepairStatus;
  presupuesto: number;
  senia: number;
  costo_repuesto: number;
  fecha: string;
}

export interface SaleItem {
  codigo?: string;
  nombre: string;
  precio: number;
  costo?: number;
  cantidad: number;
  es_reparacion?: boolean;
}

export interface SaleRecord {
  n_recibo: string;
  fecha: string;
  detalle: string;
  metodo_pago: PaymentMethod | string;
  total: number;
  descuento?: number;
  paga_con?: number;
  vuelto?: number;
  editado?: string;
  items?: SaleItem[];
}

export interface CartItem {
  id?: number;
  codigo?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  es_reparacion: boolean;
  maxStock?: number;
}

export type ReceiptData =
  | {
      type: 'sale';
      n_recibo: string;
      fecha: string;
      metodo_pago: PaymentMethod | string;
      items: SaleItem[];
      subtotal: number;
      descuento: number;
      total: number;
      paga_con: number;
      vuelto: number;
    }
  | {
      type: 'repair';
      orden: RepairOrder;
    };

export interface AppState {
  revision: number;
  productos: Product[];
  reparaciones: RepairOrder[];
  historial: SaleRecord[];
}
