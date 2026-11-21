import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Lock,
  Sparkles,
  Trophy,
  X,
  ArrowRight,
} from 'lucide-react';
import {
  AppDataSchema,
  NavigationSection,
  TrophyCheckResult,
  TrophyEvaluationItem,
} from '../types/finance';
import { StorageService } from '../utils/storage';

interface TrophyRoomContentProps {
  appData: AppDataSchema;
  checkResult?: TrophyCheckResult;
  onNavigateToSection?: (section: NavigationSection) => void;
  onCloseModal?: () => void;
}

const TROPHY_TARGET_SECTION: Record<
  string,
  { section: NavigationSection; buttonLabel: string }
> = {
  arquitecto_hogar: {
    section: 'market',
    buttonLabel: 'Ir a Lista de Mercado',
  },
  romantico_empedernido: {
    section: 'romance_fund',
    buttonLabel: 'Ir a Fondo de Citas',
  },
  francotirador_financiero: {
    section: 'market',
    buttonLabel: 'Ir a Compras / Mercado',
  },
  cuentas_claras: {
    section: 'couples',
    buttonLabel: 'Ir a Pareja / Préstamos',
  },
  rey_del_credito: {
    section: 'app_credits',
    buttonLabel: 'Ir a Créditos de Apps',
  },
};

export const TrophyRoomContent: React.FC<TrophyRoomContentProps> = ({
  appData,
  checkResult,
  onNavigateToSection,
  onCloseModal,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'unlocked' | 'locked'>(
    'all'
  );

  const evaluation = useMemo<TrophyCheckResult>(() => {
    if (checkResult) return checkResult;
    return StorageService.checkAchievements(appData);
  }, [appData, checkResult]);

  const filteredTrophies = useMemo(() => {
    if (filterMode === 'unlocked') {
      return evaluation.trophies.filter((t) => t.unlocked);
    }
    if (filterMode === 'locked') {
      return evaluation.trophies.filter((t) => !t.unlocked);
    }
    return evaluation.trophies;
  }, [evaluation.trophies, filterMode]);

  const completionPercentage =
    evaluation.totalCount > 0
      ? Math.round((evaluation.unlockedCount / evaluation.totalCount) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Banner Resumen de Progreso General */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-orange-500/15 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center shadow-md shrink-0">
              <Trophy className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-800 dark:text-amber-200 text-[11px] font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" />
                <span>Sala de Trofeos y Logros</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-editorial text-[var(--text-primary)]">
                Mis Logros Financieros
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                Supera metas reales en tu gestión de hogar, citas, presupuestos
                y créditos para desbloquear todas las insignias.
              </p>
            </div>
          </div>

          {/* Contador e indicador circular/barra */}
          <div className="flex flex-col items-start sm:items-end justify-center bg-[var(--surface)]/90 backdrop-blur-xs px-4 py-3 rounded-xl border border-amber-400/40 shrink-0 min-w-[180px]">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold font-mono-tabular text-amber-600 dark:text-amber-400">
                {evaluation.unlockedCount}
              </span>
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                / {evaluation.totalCount} Trofeos
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-subtle)] overflow-hidden mt-2 border border-[var(--border-hairline)]">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className="text-[11px] font-mono-tabular text-[var(--text-muted)] mt-1">
              {completionPercentage}% completado
            </span>
          </div>
        </div>
      </div>

      {/* Filtros de visualización */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'all'
                ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Todos ({evaluation.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('unlocked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'unlocked'
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            🏆 Desbloqueados ({evaluation.unlockedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('locked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'locked'
                ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            🔒 Bloqueados ({evaluation.totalCount - evaluation.unlockedCount})
          </button>
        </div>

        <span className="text-xs text-[var(--text-muted)]">
          Evaluación automática en tiempo real con tus datos de localStorage
        </span>
      </div>

      {/* Grid (Cuadrícula) de Tarjetas de Trofeos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTrophies.map((trophy) => (
          <TrophyCard
            key={trophy.id}
            trophy={trophy}
            onNavigate={(section) => {
              if (onNavigateToSection) {
                onNavigateToSection(section);
              }
              if (onCloseModal) {
                onCloseModal();
              }
            }}
          />
        ))}
      </div>

      {filteredTrophies.length === 0 && (
        <div className="p-8 text-center rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)]">
          <Award className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-2 opacity-60" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            No hay trofeos en este filtro
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Cambia el filtro superior para ver todas las metas disponibles.
          </p>
        </div>
      )}
    </div>
  );
};

interface TrophyCardProps {
  trophy: TrophyEvaluationItem;
  onNavigate?: (section: NavigationSection) => void;
}

const TrophyCard: React.FC<TrophyCardProps> = ({ trophy, onNavigate }) => {
  const { unlocked, progress } = trophy;
  const pct =
    progress.target > 0
      ? Math.min(100, Math.round((progress.current / progress.target) * 100))
      : unlocked
      ? 100
      : 0;

  const targetLink = TROPHY_TARGET_SECTION[trophy.id];

  return (
    <div
      className={`relative rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between ${
        unlocked
          ? 'border-2 border-amber-400 bg-gradient-to-br from-amber-50/95 via-yellow-50/90 to-amber-100/90 dark:from-amber-950/50 dark:via-yellow-950/35 dark:to-amber-900/40 shadow-md opacity-100 hover:shadow-lg hover:-translate-y-0.5'
          : 'border border-[var(--border-hairline)] bg-[var(--surface-subtle)] grayscale opacity-60 hover:opacity-80'
      }`}
    >
      <div>
        {/* Cabecera de la tarjeta: Icono del trofeo + Estado (Desbloqueado / Candado) */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl select-none shrink-0 ${
              unlocked
                ? 'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 shadow-sm ring-2 ring-amber-300/60'
                : 'bg-[var(--surface)] border border-[var(--border-hairline)]'
            }`}
            aria-hidden="true"
          >
            {trophy.icono}
          </div>

          {unlocked ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Desbloqueado</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]"
              title="Trofeo bloqueado"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>🔒 Bloqueado</span>
            </span>
          )}
        </div>

        {/* Categoría, Título y Descripción */}
        <div className="space-y-1.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              unlocked
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {trophy.categoriaLabel}
          </span>
          <h3
            className={`text-base font-bold leading-snug ${
              unlocked
                ? 'text-amber-950 dark:text-amber-100'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {trophy.titulo}
          </h3>
          <p
            className={`text-xs leading-relaxed ${
              unlocked
                ? 'text-amber-900/85 dark:text-amber-200/85'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            {trophy.descripcion}
          </p>
        </div>
      </div>

      {/* Pie de tarjeta: Barra de progreso + Acceso directo */}
      <div className="mt-5 pt-3.5 border-t border-amber-500/20 dark:border-amber-400/15 space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono-tabular">
          <span
            className={
              unlocked
                ? 'font-semibold text-amber-900 dark:text-amber-200'
                : 'text-[var(--text-secondary)]'
            }
          >
            {progress.detailText}
          </span>
          <span
            className={`font-bold ${
              unlocked
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {pct}%
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              unlocked
                ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500'
                : 'bg-slate-400 dark:bg-slate-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {targetLink && onNavigate && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate(targetLink.section)}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                unlocked
                  ? 'text-amber-800 dark:text-amber-300 hover:underline'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline'
              }`}
            >
              <span>{targetLink.buttonLabel}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface TrophyRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppDataSchema;
  checkResult?: TrophyCheckResult;
  onNavigateToSection?: (section: NavigationSection) => void;
}

export const TrophyRoomModal: React.FC<TrophyRoomModalProps> = ({
  isOpen,
  onClose,
  appData,
  checkResult,
  onNavigateToSection,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--background)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Modal */}
        <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface)] border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Sala de Trofeos y Logros
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Tus medallas e hitos desbloqueados en Mis Finanzas
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Sala de Trofeos"
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          <TrophyRoomContent
            appData={appData}
            checkResult={checkResult}
            onNavigateToSection={onNavigateToSection}
            onCloseModal={onClose}
          />
        </div>
      </div>
    </div>
  );
};
