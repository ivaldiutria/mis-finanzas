import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  Check,
  ExternalLink,
  Edit3,
  Trash2,
  ShoppingCart,
  RotateCcw,
  Calendar,
  Ban,
} from 'lucide-react';
import {
  Category,
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from '../types/finance';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { calcularEquivalenteUsd } from '../utils/calculations';
import { PRIORITY_CONFIG } from './WishlistModal';

interface WishlistViewProps {
  wishlist: WishlistItem[];
  categories: Category[];
  saldoDisponibleUsd: number;
  officialRate: number | null;
  defaultManualRate: number | null;
  locale: 'es-VE' | 'en-US';
  onAddWish: () => void;
  onEditWish: (wish: WishlistItem) => void;
  onDeleteWish: (wish: WishlistItem) => void;
  onBuyWish: (wish: WishlistItem) => void;
  onToggleStatus: (wish: WishlistItem, nextStatus: WishlistStatus) => void;
}

const PRIORITY_DOT_COLOR: Record<WishlistPriority, string> = {
  Alta: 'bg-rose-500',
  Media: 'bg-amber-500',
  Baja: 'bg-sky-500',
  Capricho: 'bg-fuchsia-500',
};

const PRIORITY_TEXT_COLOR: Record<WishlistPriority, string> = {
  Alta: 'text-rose-500',
  Media: 'text-amber-500',
  Baja: 'text-sky-500',
  Capricho: 'text-fuchsia-500',
};

export const WishlistView: React.FC<WishlistViewProps> = ({
  wishlist,
  categories,
  saldoDisponibleUsd,
  officialRate,
  defaultManualRate,
  locale,
  onAddWish,
  onEditWish,
  onDeleteWish,
  onBuyWish,
  onToggleStatus,
}) => {
  const activeRate = officialRate || defaultManualRate || null;

  // Estados de filtros simplificados
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | WishlistStatus>('Pendiente');
  const [filterPriority, setFilterPriority] = useState<'all' | WishlistPriority>('all');
  const [sortBy, setSortBy] = useState<
    'priority' | 'cost_asc' | 'cost_desc' | 'newest'
  >('priority');

  // Helper para convertir cualquier deseo a USD
  const getCostoUsd = (item: WishlistItem): number => {
    if (item.moneda === 'USD') return item.costoEstimado;
    if (activeRate && activeRate > 0) {
      return calcularEquivalenteUsd(item.costoEstimado, 'VES', activeRate);
    }
    return 0;
  };

  // Estadísticas principales limpias
  const stats = useMemo(() => {
    let totalPendienteUsd = 0;
    let totalCompradoUsd = 0;
    let countPendiente = 0;
    let countComprado = 0;
    let countDescartado = 0;
    let countAffordableToday = 0;

    for (const item of wishlist) {
      const usdVal = getCostoUsd(item);

      if (item.estado === 'Pendiente') {
        countPendiente += 1;
        totalPendienteUsd += usdVal;
        if (usdVal <= saldoDisponibleUsd && saldoDisponibleUsd > 0) {
          countAffordableToday += 1;
        }
      } else if (item.estado === 'Comprado') {
        countComprado += 1;
        totalCompradoUsd += usdVal;
      } else if (item.estado === 'Descartado') {
        countDescartado += 1;
      }
    }

    const totalActiveAndBought = countPendiente + countComprado;
    const completionPct =
      totalActiveAndBought > 0
        ? Math.round((countComprado / totalActiveAndBought) * 100)
        : 0;

    return {
      totalPendienteUsd,
      totalCompradoUsd,
      countPendiente,
      countComprado,
      countDescartado,
      countAffordableToday,
      completionPct,
    };
  }, [wishlist, saldoDisponibleUsd, activeRate]);

  // Filtrado y ordenación
  const filteredWishlist = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return wishlist
      .filter((item) => {
        if (query) {
          const matchName = item.nombre.toLowerCase().includes(query);
          const matchNotes = (item.notas || '').toLowerCase().includes(query);
          const matchUrl = (item.url || '').toLowerCase().includes(query);
          if (!matchName && !matchNotes && !matchUrl) return false;
        }

        if (filterStatus !== 'all' && item.estado !== filterStatus) {
          return false;
        }

        if (filterPriority !== 'all' && item.prioridad !== filterPriority) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Si estamos viendo "Todos", mostrar primero los Pendientes, luego Comprados, luego Descartados
        if (filterStatus === 'all' && a.estado !== b.estado) {
          const statusOrder: Record<WishlistStatus, number> = {
            Pendiente: 1,
            Comprado: 2,
            Descartado: 3,
          };
          return statusOrder[a.estado] - statusOrder[b.estado];
        }

        if (sortBy === 'priority') {
          const rank: Record<WishlistPriority, number> = {
            Alta: 4,
            Media: 3,
            Baja: 2,
            Capricho: 1,
          };
          const diff = rank[b.prioridad] - rank[a.prioridad];
          if (diff !== 0) return diff;
          return getCostoUsd(a) - getCostoUsd(b);
        }

        if (sortBy === 'cost_asc') {
          return getCostoUsd(a) - getCostoUsd(b);
        }

        if (sortBy === 'cost_desc') {
          return getCostoUsd(b) - getCostoUsd(a);
        }

        if (sortBy === 'newest') {
          const dateA = a.createdAt || '';
          const dateB = b.createdAt || '';
          return dateB.localeCompare(dateA);
        }

        return 0;
      });
  }, [wishlist, searchQuery, filterStatus, filterPriority, sortBy, activeRate]);

  const getCategory = (catId: string): Category | undefined =>
    categories.find((c) => c.id === catId);

  return (
    <div className="space-y-6">
      {/* 1. CABECERA EJECUTIVA + STRIP RESUMEN DE 3 MÉTRICAS */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden shadow-2xs">
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-hairline)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--pink-primary)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Metas de Compra · Lista Personal</span>
              {activeRate && (
                <>
                  <span className="text-[var(--text-secondary)]">·</span>
                  <span className="font-mono-tabular text-[var(--text-secondary)]">
                    Tasa {formatearTasa(activeRate, locale)} Bs/$
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Lista de Deseos
            </h1>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
              Guarda tus próximas compras y márcalas como compradas con un solo clic cuando ya las tengas, sin necesidad de hacer registros contables.
            </p>
          </div>

          <button
            type="button"
            onClick={onAddWish}
            className="px-4 py-2.5 text-xs font-bold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center gap-2 shadow-2xs self-start md:self-auto shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo deseo</span>
          </button>
        </div>

        {/* Tira de 3 métricas principales separadas por hairlines */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-hairline)] bg-[var(--surface-subtle)]/40">
          <div className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Por Comprar</span>
              <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                {stats.countPendiente} {stats.countPendiente === 1 ? 'deseo' : 'deseos'}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
              {formatearMonto(stats.totalPendienteUsd, 'USD', locale)}
            </div>
            <p className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
              {activeRate && stats.totalPendienteUsd > 0
                ? `≈ ${formatearMonto(stats.totalPendienteUsd * activeRate, 'VES', locale)}`
                : 'Total estimado pendiente'}
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Alcanzables Hoy</span>
              <span className="font-mono-tabular text-[var(--income-color)] font-semibold">
                Saldo: {formatearMonto(saldoDisponibleUsd, 'USD', locale)}
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--income-color)]">
              {stats.countAffordableToday}{' '}
              <span className="text-sm font-normal text-[var(--text-secondary)]">
                de {stats.countPendiente}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Deseos que cubres con tu saldo actual
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Ya Comprados</span>
              <span className="font-mono-tabular font-semibold text-emerald-500">
                {stats.completionPct}% completado
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
                {stats.countComprado}{' '}
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  ({formatearMonto(stats.totalCompradoUsd, 'USD', locale)})
                </span>
              </span>
            </div>
            <div className="w-full h-1.5 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border-hairline)]">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${stats.completionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE NAVEGACIÓN Y FILTROS SIMPLIFICADA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Pestañas de estado */}
        <div className="inline-flex p-1 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] self-start overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setFilterStatus('Pendiente')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'Pendiente'
                ? 'bg-[var(--pink-primary)] text-white shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Por comprar</span>
            <span
              className={`font-mono-tabular text-[11px] ${
                filterStatus === 'Pendiente' ? 'text-white/90' : 'opacity-70'
              }`}
            >
              ({stats.countPendiente})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('Comprado')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'Comprado'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>Comprados</span>
            <span
              className={`font-mono-tabular text-[11px] ${
                filterStatus === 'Comprado' ? 'text-white/90' : 'opacity-70'
              }`}
            >
              ({stats.countComprado})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              filterStatus === 'all'
                ? 'bg-[var(--pink-primary)] text-white shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Todos ({wishlist.length})
          </button>

          {(stats.countDescartado > 0 || filterStatus === 'Descartado') && (
            <button
              type="button"
              onClick={() => setFilterStatus('Descartado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filterStatus === 'Descartado'
                  ? 'bg-slate-600 text-white shadow-2xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Descartados ({stats.countDescartado})
            </button>
          )}
        </div>

        {/* Buscador, Prioridad y Orden */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial sm:w-56">
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar deseo o tienda..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          <select
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value as 'all' | WishlistPriority)
            }
            className="px-3 py-1.5 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
          >
            <option value="all">Prioridad: Todas</option>
            <option value="Alta">Prioridad Alta</option>
            <option value="Media">Prioridad Media</option>
            <option value="Baja">Prioridad Baja</option>
            <option value="Capricho">Capricho</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as 'priority' | 'cost_asc' | 'cost_desc' | 'newest'
              )
            }
            className="px-3 py-1.5 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
          >
            <option value="priority">Orden: Prioridad</option>
            <option value="cost_asc">Precio: Menor a mayor</option>
            <option value="cost_desc">Precio: Mayor a menor</option>
            <option value="newest">Más recientes</option>
          </select>
        </div>
      </div>

      {/* 3. LISTADO DE DESEOS MODERNO Y SIMPLE */}
      {filteredWishlist.length === 0 ? (
        <div className="bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border-hairline)] text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)] mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              {wishlist.length === 0
                ? 'Tu lista de deseos está vacía'
                : filterStatus === 'Comprado'
                  ? 'Aún no has marcado deseos como comprados'
                  : 'No hay deseos que coincidan con este filtro'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              {wishlist.length === 0
                ? 'Agrega lo que quieres comprar próximamente. Cuando lo adquieras, solo presiona «Ya lo compré» y listo.'
                : 'Prueba cambiando la pestaña superior o limpiando el filtro de búsqueda.'}
            </p>
          </div>
          {wishlist.length === 0 && (
            <button
              type="button"
              onClick={onAddWish}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar mi primer deseo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredWishlist.map((item) => {
            const costUsd = getCostoUsd(item);
            const isAffordableToday =
              costUsd <= saldoDisponibleUsd && saldoDisponibleUsd > 0;
            const diffUsd = saldoDisponibleUsd - costUsd;
            const category = getCategory(item.categoriaId);
            const isPurchased = item.estado === 'Comprado';
            const isDiscarded = item.estado === 'Descartado';

            return (
              <div
                key={item.id}
                className={`group bg-[var(--surface)] rounded-2xl border p-4 sm:p-5 transition-all flex flex-col justify-between gap-4 ${
                  isPurchased
                    ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                    : isDiscarded
                      ? 'border-[var(--border-hairline)] opacity-60 bg-[var(--surface-subtle)]/40'
                      : 'border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/40'
                }`}
              >
                {/* Bloque Superior: Check circular + Información del deseo + Precio */}
                <div className="flex items-start justify-between gap-3.5">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Botón circular rápido 1-clic para marcar/desmarcar como Comprado */}
                    <button
                      type="button"
                      onClick={() =>
                        onToggleStatus(
                          item,
                          isPurchased ? 'Pendiente' : 'Comprado'
                        )
                      }
                      title={
                        isPurchased
                          ? 'Desmarcar y volver a Por comprar'
                          : 'Marcar como Ya comprado (sin registro contable)'
                      }
                      className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                        isPurchased
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs'
                          : 'border-[var(--border-input)] hover:border-emerald-500 text-transparent hover:text-emerald-500/50 bg-[var(--surface-subtle)]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Metadatos limpios en una sola línea (Zero-pill discipline) */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              PRIORITY_DOT_COLOR[item.prioridad]
                            }`}
                          />
                          <span className={PRIORITY_TEXT_COLOR[item.prioridad]}>
                            {PRIORITY_CONFIG[item.prioridad].label}
                          </span>
                        </span>

                        {category && (
                          <>
                            <span className="text-[var(--text-secondary)]">·</span>
                            <span className="text-[var(--text-secondary)] truncate">
                              {category.name}
                            </span>
                          </>
                        )}

                        {item.fechaMeta && (
                          <>
                            <span className="text-[var(--text-secondary)]">·</span>
                            <span className="inline-flex items-center gap-1 font-mono-tabular text-[var(--text-secondary)]">
                              <Calendar className="w-3 h-3" />
                              <span>{item.fechaMeta}</span>
                            </span>
                          </>
                        )}
                      </div>

                      {/* Nombre del artículo */}
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h3
                          className={`text-base font-bold leading-snug ${
                            isPurchased
                              ? 'line-through text-[var(--text-secondary)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {item.nombre}
                        </h3>

                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--pink-primary)] hover:underline shrink-0"
                          >
                            <span>Enlace</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* Notas discretas */}
                      {item.notas && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                          {item.notas}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Precio alineado a la derecha */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-base sm:text-lg font-bold font-mono-tabular ${
                        isPurchased
                          ? 'text-emerald-500'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {formatearMonto(item.costoEstimado, item.moneda, locale)}
                    </div>
                    {item.moneda === 'VES' && activeRate ? (
                      <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                        ≈ {formatearMonto(costUsd, 'USD', locale)}
                      </div>
                    ) : item.moneda === 'USD' && activeRate ? (
                      <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                        ≈ {formatearMonto(costUsd * activeRate, 'VES', locale)}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Barra Inferior: Viabilidad / Estado + Botón directo "Ya lo compré" */}
                <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
                  {/* Indicador limpio a la izquierda */}
                  <div className="text-[11px]">
                    {isPurchased ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-500">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Comprado</span>
                      </span>
                    ) : isDiscarded ? (
                      <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                        <Ban className="w-3.5 h-3.5" />
                        <span>Descartado</span>
                      </span>
                    ) : isAffordableToday ? (
                      <span className="text-emerald-500 font-medium">
                        ✓ Te alcanza con tu saldo disponible
                      </span>
                    ) : (
                      <span className="text-[var(--text-secondary)] font-mono-tabular">
                        Faltan {formatearMonto(Math.abs(diffUsd), 'USD', locale)}
                      </span>
                    )}
                  </div>

                  {/* Acciones rápidas a la derecha */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => onEditWish(item)}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                      title="Editar deseo"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {item.estado === 'Pendiente' && (
                      <button
                        type="button"
                        onClick={() => onBuyWish(item)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--pink-primary)] rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                        title="Opcional: Registrar como gasto descontando de una billetera"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {item.estado === 'Pendiente' && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(item, 'Descartado')}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-amber-500 rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                        title="Mover a descartados"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteWish(item)}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)] rounded-lg transition-colors hover:bg-[var(--surface-subtle)]"
                      title="Eliminar deseo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Botón Principal de 1 Clic: "Ya lo compré" (sin registro de compra) */}
                    {item.estado === 'Pendiente' ? (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(item, 'Comprado')}
                        className="ml-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
                        title="Marcar como comprado directamente sin crear movimiento contable"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Ya lo compré</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(item, 'Pendiente')}
                        className="ml-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 whitespace-nowrap"
                        title="Devolver a deseos por comprar"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Volver a pendiente</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
