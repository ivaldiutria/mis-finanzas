import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Flame,
  Heart,
  Home,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { AppDataSchema, YearlyWrappedReport } from '../types/finance';
import { StorageService } from '../utils/storage';
import { formatearMonto } from '../services/bcvApi';

interface YearlyWrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppDataSchema;
  defaultYear?: number;
  locale: string;
}

const SLIDE_DURATION_MS = 5000;
const TICK_INTERVAL_MS = 50;

export const YearlyWrappedModal: React.FC<YearlyWrappedModalProps> = ({
  isOpen,
  onClose,
  appData,
  defaultYear = 2026,
  locale,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Sincronizar el año por defecto al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedYear(defaultYear);
      setCurrentSlide(0);
      setElapsedMs(0);
      setIsPaused(false);
    }
  }, [isOpen, defaultYear]);

  // Extraer datos con StorageService.generateYearlyWrapped(year)
  const wrappedData: YearlyWrappedReport = useMemo(
    () => StorageService.generateYearlyWrapped(selectedYear, appData),
    [selectedYear, appData]
  );

  // Definir las diapositivas estilo Spotify Wrapped / Instagram Stories
  const slides = useMemo(() => {
    const topCategoryName =
      wrappedData.topCategory?.categoryName || 'Tus Finanzas Personales';
    const topCategoryUsd = wrappedData.topCategory?.totalUsd || 0;
    const topCategoryPct = wrappedData.topCategory?.percentage || 0;

    const mostExpensiveName =
      wrappedData.mostExpensiveHomeItem?.name || 'Tus esenciales del hogar';
    const mostExpensiveUsd =
      wrappedData.mostExpensiveHomeItem?.amountUsd || 0;
    const mostExpensiveSource =
      wrappedData.mostExpensiveHomeItem?.sourceLabel || 'Lista de Mercado / Hogar';

    return [
      {
        id: 'intro-total',
        badge: `CÁPSULA DEL TIEMPO FINANCIERA · ${wrappedData.year}`,
        gradient: 'bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-500',
        accentBadgeBg: 'bg-white/15 border-white/25',
        icon: <Sparkles className="w-12 h-12 text-amber-300 animate-bounce" />,
        eyebrow: `Hola, ${appData.settings.userName || 'Protagonista'}`,
        headline: `Tu ${wrappedData.year} financiero estuvo lleno de movimiento`,
        highlightValue: formatearMonto(
          wrappedData.totalSpentYearUsd,
          'USD',
          locale
        ),
        subValue: `≈ ${formatearMonto(wrappedData.totalSpentYearVesEquiv, 'VES', locale)} en ${wrappedData.totalExpensesCount} operaciones registradas`,
        funPhrase:
          wrappedData.totalExpensesCount > 0
            ? `Cada dólar y bolívar tuvo una misión este ${wrappedData.year}. ¡Veamos tus momentos estelares!`
            : `Tu cápsula ${wrappedData.year} está lista para llenarse de grandes metas y recuerdos.`,
      },
      {
        id: 'top-category',
        badge: 'TU CATEGORÍA #1 DEL AÑO',
        gradient: 'bg-gradient-to-br from-pink-600 via-rose-600 to-amber-500',
        accentBadgeBg: 'bg-white/15 border-white/25',
        icon: <Award className="w-12 h-12 text-yellow-200 animate-bounce" />,
        eyebrow: 'Donde se fue la mayor parte de tu presupuesto',
        headline: `Este año fuiste el rey de ${topCategoryName}`,
        highlightValue: formatearMonto(topCategoryUsd, 'USD', locale),
        subValue:
          wrappedData.topCategory
            ? `Representó el ${topCategoryPct}% de todo tu gasto anual (${wrappedData.topCategory.count} movimientos)`
            : 'Registra tus gastos por categoría para coronar tu categoría #1',
        funPhrase: `Nadie dominó ${topCategoryName} como tú en ${wrappedData.year}. ¡Prioridades claras!`,
      },
      {
        id: 'credit-installments',
        badge: 'DOMADOR DE CUOTAS Y CRÉDITOS',
        gradient: 'bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600',
        accentBadgeBg: 'bg-white/15 border-white/25',
        icon: <CreditCard className="w-12 h-12 text-emerald-200 animate-bounce" />,
        eyebrow: 'Compras a Cuotas + Créditos de Apps',
        headline: `Sobreviviste a ${wrappedData.totalCreditInstallmentsPaid} cuotas de créditos`,
        highlightValue: `${wrappedData.totalCreditInstallmentsPaid} ${
          wrappedData.totalCreditInstallmentsPaid === 1 ? 'cuota' : 'cuotas'
        }`,
        subValue: `Total liquidado en cuotas: ${formatearMonto(
          wrappedData.totalCreditInstallmentsPaidUsd,
          'USD',
          locale
        )}`,
        funPhrase:
          wrappedData.totalCreditInstallmentsPaid > 0
            ? 'Cuota a cuota mantuviste tu récord impecable y sin perder la calma.'
            : '¡Cero cuotas vencidas! Llevas tus créditos bajo control total.',
      },
      {
        id: 'home-champion',
        badge: 'LISTA DE MERCADO & HOGAR',
        gradient: 'bg-gradient-to-br from-amber-500 via-orange-600 to-red-600',
        accentBadgeBg: 'bg-white/15 border-white/25',
        icon: <Home className="w-12 h-12 text-amber-100 animate-bounce" />,
        eyebrow: mostExpensiveSource,
        headline: `Tu logro del hogar: compraste ${mostExpensiveName}`,
        highlightValue: formatearMonto(mostExpensiveUsd, 'USD', locale),
        subValue: wrappedData.mostExpensiveHomeItem
          ? `Adquirido el ${wrappedData.mostExpensiveHomeItem.date} · Tu compra estrella de hogar/mercado`
          : 'Tus compras de Lista de Mercado y Bóveda de Garantías brillarán aquí',
        funPhrase:
          'Invertir en tu comodidad y en tu hogar siempre es la mejor decisión financiera.',
      },
      {
        id: 'romance-wrapped',
        badge: 'FONDO DE CITAS & RECUERDOS',
        gradient: 'bg-gradient-to-br from-fuchsia-600 via-pink-600 to-rose-500',
        accentBadgeBg: 'bg-white/15 border-white/25',
        icon: <Heart className="w-12 h-12 text-pink-200 animate-bounce" />,
        eyebrow: 'Romance Budget · Momentos Especiales',
        headline: `Invertiste ${formatearMonto(
          wrappedData.totalRomanceSpentUsd,
          'USD',
          locale
        )} en citas y recuerdos románticos`,
        highlightValue: `${wrappedData.romanceDatesCount} ${
          wrappedData.romanceDatesCount === 1
            ? 'cita inolvidable'
            : 'citas inolvidables'
        }`,
        subValue: wrappedData.lastRomanceMemory
          ? `Último recuerdo destacado: "${wrappedData.lastRomanceMemory}"`
          : 'Usa el Fondo de Citas y la Ruleta para planear su próxima salida especial',
        funPhrase:
          'Porque los mejores intereses compuestos son los recuerdos que construyen juntos.',
      },
      {
        id: 'summary-card',
        badge: `RESUMEN OFICIAL · WRAPPED ${wrappedData.year}`,
        gradient: 'bg-gradient-to-br from-violet-700 via-purple-600 to-blue-600',
        accentBadgeBg: 'bg-white/15 border-white/25',
        icon: <TrendingUp className="w-12 h-12 text-cyan-200 animate-bounce" />,
        eyebrow: 'Tu Huella Financiera Anual',
        headline: `¡Brillante recorrido en ${wrappedData.year}!`,
        highlightValue: formatearMonto(
          wrappedData.totalSpentYearUsd,
          'USD',
          locale
        ),
        subValue: `Rey de ${topCategoryName} · ${wrappedData.totalCreditInstallmentsPaid} cuotas pagadas · ${formatearMonto(
          wrappedData.totalRomanceSpentUsd,
          'USD',
          locale
        )} en citas`,
        funPhrase: `Hogar estrella: ${mostExpensiveName}`,
      },
    ];
  }, [wrappedData, appData.settings.userName, locale]);

  const totalSlides = slides.length;

  const goToNextSlide = useCallback(() => {
    setElapsedMs(0);
    setCurrentSlide((prev) => {
      if (prev < totalSlides - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, [totalSlides]);

  const goToPrevSlide = useCallback(() => {
    setElapsedMs(0);
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  // Temporizador automático cada 5 segundos (5000ms) estilo Instagram Stories
  useEffect(() => {
    if (!isOpen || isPaused) return;

    const timer = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + TICK_INTERVAL_MS;
        if (next >= SLIDE_DURATION_MS) {
          if (currentSlide < totalSlides - 1) {
            setCurrentSlide((s) => Math.min(totalSlides - 1, s + 1));
            return 0;
          } else {
            // Al terminar la última diapositiva se detiene en el resumen final
            setIsPaused(true);
            return SLIDE_DURATION_MS;
          }
        }
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, currentSlide, totalSlides]);

  // Navegación con teclado (Flechas Izquierda/Derecha, Espacio para pausar, Escape para cerrar)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        goToNextSlide();
      } else if (e.key === 'ArrowLeft') {
        goToPrevSlide();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToNextSlide, goToPrevSlide]);

  if (!isOpen) return null;

  const activeSlide = slides[currentSlide] || slides[0];
  const isLastSlide = currentSlide === totalSlides - 1;

  // Años disponibles para explorar la cápsula
  const availableYears = Array.from(
    new Set([
      2026,
      new Date().getFullYear(),
      ...(appData.transactions || []).map(
        (t) => Number(t.date.slice(0, 4)) || 2026
      ),
    ])
  ).sort((a, b) => b - a);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Cápsula del Tiempo Financiera ${selectedYear}`}
    >
      {/* Contenedor vertical formato Story (9:16 en desktop, pantalla completa en móvil) */}
      <div
        className={`relative w-full h-full sm:h-[90vh] sm:max-h-[820px] sm:max-w-[460px] sm:rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex flex-col justify-between text-white transition-all duration-500 ${activeSlide.gradient}`}
      >
        {/* Efectos de luz decorativos de fondo */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-black/25 blur-3xl" />

        {/* Parte Superior: Barras de progreso tipo Instagram Stories + Controles */}
        <div className="relative z-20 pt-4 px-4 sm:px-6 space-y-3 bg-gradient-to-b from-black/50 to-transparent pb-4">
          {/* Barras de progreso segmentadas */}
          <div className="grid grid-cols-6 gap-1.5">
            {slides.map((s, idx) => {
              let widthPct = 0;
              if (idx < currentSlide) {
                widthPct = 100;
              } else if (idx === currentSlide) {
                widthPct = Math.min(
                  100,
                  (elapsedMs / SLIDE_DURATION_MS) * 100
                );
              }
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlide(idx);
                    setElapsedMs(0);
                    setIsPaused(false);
                  }}
                  aria-label={`Ir a historia ${idx + 1}`}
                  className="h-1.5 w-full rounded-full bg-white/30 overflow-hidden cursor-pointer"
                >
                  <div
                    className="h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${widthPct}%` }}
                  />
                </button>
              );
            })}
          </div>

          {/* Barra de cabecera de la Story */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center border border-white/30">
                <Flame className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-white/90">
                  Wrapped Financiero
                </div>
                <div className="text-[10px] text-white/75 flex items-center gap-1">
                  <span>Diapositiva {currentSlide + 1} de {totalSlides}</span>
                  <span>·</span>
                  <span>{isPaused ? 'En pausa' : 'Auto 5s'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Selector rápido de Año */}
              <select
                value={selectedYear}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedYear(Number(e.target.value));
                  setCurrentSlide(0);
                  setElapsedMs(0);
                  setIsPaused(false);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Seleccionar año del resumen"
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-black/35 text-white border border-white/25 focus:outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="text-black">
                    {yr}
                  </option>
                ))}
              </select>

              {/* Botón Pausar / Reanudar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLastSlide && elapsedMs >= SLIDE_DURATION_MS) {
                    setCurrentSlide(0);
                    setElapsedMs(0);
                    setIsPaused(false);
                  } else {
                    setIsPaused((prev) => !prev);
                  }
                }}
                className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white border border-white/20 transition-colors"
                title={isPaused ? 'Reanudar historia' : 'Pausar historia'}
                aria-label={isPaused ? 'Reanudar historia' : 'Pausar historia'}
              >
                {isPaused ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full bg-black/30 hover:bg-black/50 text-white border border-white/20 transition-colors"
                title="Cerrar Cápsula del Tiempo"
                aria-label="Cerrar Cápsula del Tiempo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Contenido Central de la Diapositiva (Hacer clic avanza a la siguiente o retrocede si es en el borde izquierdo) */}
        <div
          key={`${selectedYear}-${activeSlide.id}`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX < rect.width * 0.28) {
              goToPrevSlide();
            } else if (currentSlide < totalSlides - 1) {
              goToNextSlide();
            } else {
              // Si está en la última diapositiva y hace clic a la derecha, reinicia desde la 1
              setCurrentSlide(0);
              setElapsedMs(0);
              setIsPaused(false);
            }
          }}
          className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-8 text-center cursor-pointer space-y-6 overflow-y-auto py-4"
        >
          {/* Insignia superior */}
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold tracking-widest uppercase border backdrop-blur-xs ${activeSlide.accentBadgeBg}`}
          >
            {activeSlide.badge}
          </div>

          {/* Icono animado con rebote */}
          <div className="w-24 h-24 rounded-3xl bg-white/15 border border-white/25 backdrop-blur-md flex items-center justify-center shadow-xl">
            {activeSlide.icon}
          </div>

          {/* Eyebrow */}
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/80">
            {activeSlide.eyebrow}
          </p>

          {/* Frase Principal Dinámica (Tipografía Grande) */}
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight text-white drop-shadow-xs">
            {activeSlide.headline}
          </h2>

          {/* Tarjeta del Número / Resultado Destacado */}
          <div className="w-full bg-black/25 backdrop-blur-md border border-white/20 rounded-2xl p-5 space-y-2 shadow-inner">
            <div className="text-3xl sm:text-4xl font-black font-mono-tabular text-amber-300 tracking-tight animate-pulse">
              {activeSlide.highlightValue}
            </div>
            <p className="text-xs sm:text-sm text-white/90 font-medium">
              {activeSlide.subValue}
            </p>
          </div>

          {/* Si es la última diapositiva, mostramos el póster compacto con los 4 hitos juntos */}
          {isLastSlide ? (
            <div className="w-full grid grid-cols-2 gap-2.5 text-left">
              <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                <span className="text-[10px] uppercase tracking-wider text-white/70 block">
                  Rey de Categoría
                </span>
                <span className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                  {wrappedData.topCategory?.categoryName || 'Sin registros'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                <span className="text-[10px] uppercase tracking-wider text-white/70 block">
                  Cuotas Pagadas
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {wrappedData.totalCreditInstallmentsPaid} cuotas
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                <span className="text-[10px] uppercase tracking-wider text-white/70 block">
                  Logro del Hogar
                </span>
                <span className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                  {wrappedData.mostExpensiveHomeItem?.name || 'Por descubrir'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/10 border border-white/15">
                <span className="text-[10px] uppercase tracking-wider text-white/70 block">
                  Fondo de Citas
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {formatearMonto(
                    wrappedData.totalRomanceSpentUsd,
                    'USD',
                    locale
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-white/85 italic max-w-xs leading-relaxed">
              “{activeSlide.funPhrase}”
            </p>
          )}
        </div>

        {/* Pie de navegación de la Story */}
        <div className="relative z-20 px-5 py-4 bg-gradient-to-t from-black/55 to-transparent flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevSlide();
            }}
            disabled={currentSlide === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 disabled:opacity-35 text-white border border-white/20 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <span className="text-[11px] text-white/75 font-medium text-center">
            Toca para avanzar · 5s por slide
          </span>

          {isLastSlide ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentSlide(0);
                setElapsedMs(0);
                setIsPaused(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-purple-900 hover:bg-white/90 transition-colors shadow-md"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Repetir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNextSlide();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/20 hover:bg-white/30 text-white border border-white/25 transition-colors"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
