import React, { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  Flame,
  Clock,
  ExternalLink,
  Tag,
  CheckCircle2,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  Category,
  CurrencyCode,
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from '../types/finance';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { calcularEquivalenteUsd, obtenerFechaLocalIso } from '../utils/calculations';
import { UsdToVesHelper } from './UsdToVesHelper';

interface WishlistModalProps {
  isOpen: boolean;
  editingWish: WishlistItem | null;
  categories: Category[];
  officialRate: number | null;
  defaultManualRate: number | null;
  locale: 'es-VE' | 'en-US';
  onClose: () => void;
  onSave: (wish: WishlistItem) => void;
}

export const PRIORITY_CONFIG: Record<
  WishlistPriority,
  { label: string; description: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Alta: {
    label: 'Alta',
    description: 'Necesidad importante o meta primordial',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    icon: Flame,
  },
  Media: {
    label: 'Media',
    description: 'Deseo planificado para mediano plazo',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: Clock,
  },
  Baja: {
    label: 'Baja',
    description: 'Compra secundaria sin apuro',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: Tag,
  },
  Capricho: {
    label: 'Capricho',
    description: 'Gusto espontáneo o auto-regalo especial',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30',
    icon: Sparkles,
  },
};

export const WishlistModal: React.FC<WishlistModalProps> = ({
  isOpen,
  editingWish,
  categories,
  officialRate,
  defaultManualRate,
  locale,
  onClose,
  onSave,
}) => {
  const [nombre, setNombre] = useState('');
  const [costoStr, setCostoStr] = useState('');
  const [moneda, setMoneda] = useState<CurrencyCode>('USD');
  const [categoriaId, setCategoriaId] = useState('');
  const [prioridad, setPrioridad] = useState<WishlistPriority>('Media');
  const [url, setUrl] = useState('');
  const [notas, setNotas] = useState('');
  const [fechaMeta, setFechaMeta] = useState('');
  const [estado, setEstado] = useState<WishlistStatus>('Pendiente');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === 'expense' && c.active);
  const activeRate = officialRate || defaultManualRate || null;

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);

    if (editingWish) {
      setNombre(editingWish.nombre);
      setCostoStr(String(editingWish.costoEstimado));
      setMoneda(editingWish.moneda);
      setCategoriaId(editingWish.categoriaId);
      setPrioridad(editingWish.prioridad);
      setUrl(editingWish.url || '');
      setNotas(editingWish.notas || '');
      setFechaMeta(editingWish.fechaMeta || '');
      setEstado(editingWish.estado);
    } else {
      setNombre('');
      setCostoStr('');
      setMoneda('USD');
      setCategoriaId(expenseCategories[0]?.id || 'cat_exp_personal');
      setPrioridad('Media');
      setUrl('');
      setNotas('');
      setFechaMeta('');
      setEstado('Pendiente');
    }
  }, [isOpen, editingWish]);

  if (!isOpen) return null;

  const parsedCosto = Number(costoStr.replace(',', '.'));
  const costoUsdEquiv =
    moneda === 'USD'
      ? parsedCosto
      : activeRate
        ? calcularEquivalenteUsd(parsedCosto, 'VES', activeRate)
        : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      setErrorMsg('Por favor ingresa el nombre o descripción del deseo.');
      return;
    }

    if (!Number.isFinite(parsedCosto) || parsedCosto <= 0) {
      setErrorMsg('El costo estimado debe ser un monto mayor a cero.');
      return;
    }

    if (!categoriaId) {
      setErrorMsg('Debes seleccionar una categoría.');
      return;
    }

    const item: WishlistItem = {
      id: editingWish?.id || `wish_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nombre: trimmedNombre,
      costoEstimado: Number(parsedCosto.toFixed(2)),
      moneda,
      categoriaId,
      prioridad,
      url: url.trim() || undefined,
      notas: notas.trim() || undefined,
      fechaMeta: fechaMeta ? fechaMeta : null,
      estado,
      compradoTransactionId: editingWish?.compradoTransactionId || null,
      createdAt: editingWish?.createdAt || obtenerFechaLocalIso(),
      isDemo: editingWish?.isDemo || false,
    };

    onSave(item);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] border border-[var(--pink-primary)]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {editingWish ? 'Editar deseo' : 'Nuevo deseo de compra'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Planifica tus compras futuras sin afectar tu saldo actual
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[var(--expense-bg)] border border-[var(--expense-border)] text-[var(--expense-color)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Categoría y Fecha meta (Antes del monto) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="wish-category" className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] mb-1.5">
                <Tag className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Categoría estimada *</span>
              </label>
              <select
                id="wish-category"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="wish-date" className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Fecha meta deseada (opc.)</span>
              </label>
              <input
                id="wish-date"
                type="date"
                value={fechaMeta}
                onChange={(e) => setFechaMeta(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>
          </div>

          {/* 2. Nombre del deseo */}
          <div>
            <label htmlFor="wish-name" className="block font-semibold text-[var(--text-primary)] mb-1.5">
              ¿Qué deseas comprar? <span className="text-[var(--expense-color)]">*</span>
            </label>
            <input
              id="wish-name"
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Auriculares inalámbricos, Zapatos, Monitor..."
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          {/* 3. Prioridad */}
          <div>
            <label className="block font-semibold text-[var(--text-primary)] mb-1.5">
              Nivel de prioridad
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-hairline)]">
              {(['Alta', 'Media', 'Baja', 'Capricho'] as WishlistPriority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const Icon = cfg.icon;
                const active = prioridad === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridad(p)}
                    title={cfg.description}
                    className={`py-2 px-1 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                      active
                        ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{p}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Tarjeta Principal de Costo Estimado y Moneda */}
          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="wish-cost" className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Costo estimado *
              </label>
              <div className="inline-flex p-0.5 bg-[var(--surface)] border border-[var(--border-input)] rounded-xl">
                <button
                  type="button"
                  onClick={() => setMoneda('USD')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    moneda === 'USD'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setMoneda('VES')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    moneda === 'VES'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Bolívares (Bs)
                </button>
              </div>
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--text-secondary)] select-none">
                {moneda === 'USD' ? '$' : 'Bs'}
              </span>
              <input
                id="wish-cost"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={costoStr}
                onChange={(e) => setCostoStr(e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 text-xl sm:text-2xl font-bold font-mono-tabular rounded-2xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            {moneda === 'VES' && (
              <UsdToVesHelper
                officialRate={officialRate}
                defaultManualRate={defaultManualRate}
                currentRate={activeRate}
                locale={locale}
                compact
                onApplyVesAmount={(vesStr) => {
                  setCostoStr(vesStr);
                }}
              />
            )}

            {moneda === 'VES' && Number.isFinite(parsedCosto) && parsedCosto > 0 && (
              <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>Equivalente en USD:</span>
                <strong className="font-mono-tabular text-[var(--text-primary)]">
                  {costoUsdEquiv != null
                    ? `≈ ${formatearMonto(costoUsdEquiv, 'USD', locale)} (Tasa: ${formatearTasa(activeRate || 0, locale)} Bs)`
                    : 'Sin tasa configurada'}
                </strong>
              </div>
            )}
          </div>

          {/* Estado del deseo (solo si se edita) */}
          {editingWish && (
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-primary)]">
                Estado del deseo
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Pendiente', 'Comprado', 'Descartado'] as WishlistStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setEstado(st)}
                    className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                      estado === st
                        ? 'border-[var(--pink-primary)] bg-[var(--pink-light)] text-[var(--pink-dark)]'
                        : 'border-[var(--border-input)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Enlace Web y Notas en 2 columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wish-url" className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5 mb-1">
                <ExternalLink className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                <span>Enlace o tienda (opc.)</span>
              </label>
              <input
                id="wish-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://tienda.com/..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            <div>
              <label htmlFor="wish-notes" className="font-semibold text-[var(--text-secondary)] block mb-1">
                Nota rápida (opc.)
              </label>
              <input
                id="wish-notes"
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Color, talla, tienda física..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="sticky bottom-0 bg-[var(--surface)] flex items-center justify-end gap-2.5 pt-3 pb-1 border-t border-[var(--border-hairline)] z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[var(--border-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] text-white font-bold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editingWish ? 'Guardar cambios' : 'Agregar a la lista'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
