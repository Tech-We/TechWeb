import React from 'react';
import {
  LayoutGrid,
  ScanBarcode,
  Wrench,
  Package,
  ShoppingCart,
  TrendingUp,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import type {SectionId} from '../types';
import {OFFICIAL_LOGO_PATH} from '../utils/thermalPrint';

export const TECH_LOGO_PATH = OFFICIAL_LOGO_PATH;

export type SyncState = 'loading' | 'saved' | 'saving' | 'error';
export type SessionMode = 'pending' | 'cloud' | 'guest';

interface SidebarProps {
  activeSection: SectionId;
  onSelectSection: (section: SectionId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: SectionId;
  label: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'panel', label: 'Panel Principal', icon: LayoutGrid},
  {id: 'escaner', label: 'Escáner / Movimiento', icon: ScanBarcode},
  {id: 'tecnico', label: 'Servicio Técnico', icon: Wrench},
  {id: 'inventario', label: 'Inventario y Precios', icon: Package},
  {id: 'pos', label: 'Punto de Venta', icon: ShoppingCart},
  {id: 'balance', label: 'Balance y Ganancias', icon: TrendingUp},
  {id: 'excel', label: 'Historial & Exportar', icon: FileSpreadsheet},
];

export function Sidebar({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-[100dvh] bg-slate-900 text-slate-100 flex flex-col transition-all duration-200 border-r border-slate-800 ${
          collapsed ? 'w-[72px]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="overflow-y-auto flex-1 min-h-0">
          <div
            className={`h-[72px] flex items-center border-b border-slate-800 px-3 ${
              collapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            {!collapsed && (
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={TECH_LOGO_PATH}
                  alt="TECH"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0 border border-slate-700"
                />
                <div className="min-w-0">
                  <span className="block text-sm font-bold tracking-wide text-teal-400 leading-tight">
                    TECH
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    Servicio Técnico
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:inline-flex items-center justify-center p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="mt-3 px-2.5 pb-4 space-y-1" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectSection(item.id);
                    onCloseMobile();
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    collapsed ? 'justify-center px-2' : ''
                  } ${
                    isActive
                      ? 'bg-teal-600/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? 'text-teal-400' : 'text-slate-400'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
