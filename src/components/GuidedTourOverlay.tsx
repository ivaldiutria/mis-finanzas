import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, Sparkles, X } from 'lucide-react';
import { StorageService } from '../utils/storage';

export interface TourStep {
  selector: string;
  fallbackSelector?: string;
  title: string;
  description: string;
}

/**
 * Arreglo constante TOUR_STEPS con los selectores del DOM a resaltar,
 * título y descripción explicativa de cada módulo clave.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    selector: '#tour-bcv-rate',
    title: 'Tasa BCV y Calculadora Instantánea',
    description:
      'Consulta y sincroniza la tasa oficial del BCV en tiempo real o abre la calculadora rápida ($ ⇄ Bs) para convertir cualquier monto antes de pagar.',
  },
  {
    selector: '#tour-balance-cards',
    title: 'Saldos Reales, Proyectados y Bimonetarios',
    description:
      'Visualiza por separado tu dinero en Dólares (USD/USDT) y en Bolívares (Bs), junto con tu Saldo Real disponible, Saldo Proyectado (descontando compromisos pendientes) y Patrimonio.',
  },
  {
    selector: '#tour-quick-actions',
    title: 'Acciones Rápidas, Wrapped y Sala de Trofeos',
    description:
      'Registra ingresos, gastos o ahorros en un clic, explora tu Cápsula del Tiempo Financiera 2026 estilo Stories y desbloquea medallas en Mis Logros.',
  },
  {
    selector: '#tour-sidebar-nav',
    fallbackSelector: '#tour-header-bar',
    title: 'Módulos Inteligentes Organizados',
    description:
      'Accede desde el menú a tus Billeteras, Cambios P2P, Créditos por Cuotas (Cashea/Ubii), Lista de Mercado por categorías, Planificador de Menú Semanal y Finanzas en Pareja.',
  },
  {
    selector: '#config-menu',
    fallbackSelector: '#tour-header-config-btn',
    title: 'Configuración, Respaldos y Tutorial',
    description:
      'Personaliza el tema visual de la aplicación, descarga copias de seguridad en JSON y vuelve a pulsar «Reproducir Tutorial» cuando quieras repasar esta guía.',
  },
];

/**
 * Clases temporales de Tailwind que se inyectan al elemento del DOM resaltado
 * para elevarlo sobre el overlay oscuro (z-40) y darle foco visual limpio.
 */
const HIGHLIGHT_TAILWIND_CLASSES = [
  'relative',
  '!z-50',
  'ring-4',
  'ring-blue-500/80',
  'shadow-2xl',
  'transition-all',
  'duration-300',
];

interface HighlightedElementSnapshot {
  element: HTMLElement;
  addedClasses: string[];
  originalPosition: string;
  originalZIndex: string;
  originalBackgroundColor: string;
  originalBorderRadius: string;
}

interface TooltipPosition {
  top: number;
  left: number;
  placement: 'bottom' | 'top' | 'right' | 'center';
  targetRect: DOMRect | null;
}

interface GuidedTourOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onEnsureDashboard?: () => void;
}

export const GuidedTourOverlay: React.FC<GuidedTourOverlayProps> = ({
  isOpen,
  onClose,
  onEnsureDashboard,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({
    top: 120,
    left: 24,
    placement: 'center',
    targetRect: null,
  });

  const snapshotRef = useRef<HighlightedElementSnapshot | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  /**
   * Restaura el z-index, posición y clases originales del último elemento resaltado en el DOM.
   */
  const restoreHighlightedElement = useCallback(() => {
    const snap = snapshotRef.current;
    if (!snap) return;

    const {
      element,
      addedClasses,
      originalPosition,
      originalZIndex,
      originalBackgroundColor,
      originalBorderRadius,
    } = snap;

    addedClasses.forEach((cls) => {
      element.classList.remove(cls);
    });
    element.style.position = originalPosition;
    element.style.zIndex = originalZIndex;
    element.style.backgroundColor = originalBackgroundColor;
    element.style.borderRadius = originalBorderRadius;

    snapshotRef.current = null;
  }, []);

  /**
   * Encuentra el elemento visible del DOM para el paso actual.
   */
  const resolveTargetElement = useCallback((step: TourStep): HTMLElement | null => {
    const primary = document.querySelector(step.selector) as HTMLElement | null;
    if (primary) {
      const rect = primary.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return primary;
      }
    }
    if (step.fallbackSelector) {
      const fallback = document.querySelector(
        step.fallbackSelector
      ) as HTMLElement | null;
      if (fallback) {
        const rect = fallback.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return fallback;
        }
      }
    }
    return primary;
  }, []);

  /**
   * Calcula las coordenadas óptimas del Tooltip usando getBoundingClientRect()
   * garantizando que nunca se desborde de la pantalla.
   */
  const calculateTooltipPosition = useCallback((targetEl: HTMLElement | null) => {
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const tooltipW = Math.min(380, viewportW - 32);
    const tooltipH = tooltipRef.current?.offsetHeight || 235;
    const gap = 16;
    const margin = 16;

    if (!targetEl) {
      setTooltipPos({
        top: Math.max(margin, (viewportH - tooltipH) / 2),
        left: Math.max(margin, (viewportW - tooltipW) / 2),
        placement: 'center',
        targetRect: null,
      });
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setTooltipPos({
        top: Math.max(margin, (viewportH - tooltipH) / 2),
        left: Math.max(margin, (viewportW - tooltipW) / 2),
        placement: 'center',
        targetRect: null,
      });
      return;
    }

    let placement: 'bottom' | 'top' | 'right' | 'center' = 'bottom';
    let top = rect.bottom + gap;
    let left = rect.left;

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const spaceRight = viewportW - rect.right;

    // Si el elemento es alto (ej. barra lateral), posicionar a la derecha si hay espacio
    if (rect.height > viewportH * 0.55 && spaceRight >= tooltipW + gap + margin) {
      placement = 'right';
      top = Math.max(margin + 24, Math.min(rect.top + 32, viewportH - tooltipH - margin));
      left = rect.right + gap;
    } else if (spaceBelow >= tooltipH + gap + margin) {
      placement = 'bottom';
      top = rect.bottom + gap;
      left = rect.left;
    } else if (spaceAbove >= tooltipH + gap + margin) {
      placement = 'top';
      top = rect.top - tooltipH - gap;
      left = rect.left;
    } else if (spaceRight >= tooltipW + gap + margin) {
      placement = 'right';
      top = Math.max(margin, Math.min(rect.top, viewportH - tooltipH - margin));
      left = rect.right + gap;
    } else {
      // Si el elemento ocupa casi toda la pantalla, flotar en la parte inferior o superior visible
      placement = 'bottom';
      top = Math.min(
        viewportH - tooltipH - margin,
        Math.max(margin, rect.top + 24)
      );
      left = (viewportW - tooltipW) / 2;
    }

    // Asegurar límites horizontales y verticales dentro del viewport
    left = Math.max(margin, Math.min(left, viewportW - tooltipW - margin));
    top = Math.max(margin, Math.min(top, viewportH - tooltipH - margin));

    setTooltipPos({
      top,
      left,
      placement,
      targetRect: rect,
    });
  }, []);

  /**
   * Activa el paso indicado: limpia el anterior, resalta el nuevo elemento en el DOM
   * con clases de Tailwind (relative, z-50, etc.) y posiciona el Tooltip.
   */
  const activateStep = useCallback(
    (stepIdx: number) => {
      restoreHighlightedElement();

      const step = TOUR_STEPS[stepIdx];
      if (!step) return;

      const targetEl = resolveTargetElement(step);
      if (!targetEl) {
        calculateTooltipPosition(null);
        return;
      }

      // Guardar estado original antes de inyectar clases temporales
      const computedStyle = window.getComputedStyle(targetEl);
      const originalPosition = targetEl.style.position;
      const originalZIndex = targetEl.style.zIndex;
      const originalBackgroundColor = targetEl.style.backgroundColor;
      const originalBorderRadius = targetEl.style.borderRadius;

      const addedClasses: string[] = [];
      HIGHLIGHT_TAILWIND_CLASSES.forEach((cls) => {
        if (!targetEl.classList.contains(cls)) {
          targetEl.classList.add(cls);
          addedClasses.push(cls);
        }
      });

      if (computedStyle.position === 'static') {
        targetEl.style.position = 'relative';
      }
      targetEl.style.zIndex = '50';

      // Si el elemento tiene fondo transparente, aplicar el fondo de superficie del tema
      // para que sea 100% legible sobre el overlay oscuro bg-black/70
      const bg = computedStyle.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
        targetEl.style.backgroundColor = 'var(--surface)';
      }
      if (!computedStyle.borderRadius || computedStyle.borderRadius === '0px') {
        targetEl.style.borderRadius = '16px';
      }

      snapshotRef.current = {
        element: targetEl,
        addedClasses,
        originalPosition,
        originalZIndex,
        originalBackgroundColor,
        originalBorderRadius,
      };

      // Desplazar suavemente hacia el elemento si está fuera del área cómoda de visión
      const rect = targetEl.getBoundingClientRect();
      const isOutOfViewport =
        rect.top < 70 || rect.bottom > window.innerHeight - 70;
      if (isOutOfViewport) {
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }

      // Calcular posición inmediata y recalcular tras el scroll suave
      calculateTooltipPosition(targetEl);
      window.setTimeout(() => {
        calculateTooltipPosition(targetEl);
      }, 260);
    },
    [calculateTooltipPosition, resolveTargetElement, restoreHighlightedElement]
  );

  // Al abrir el tour, reiniciar al paso 0 y asegurar que el Dashboard esté visible
  useEffect(() => {
    if (!isOpen) {
      restoreHighlightedElement();
      return;
    }

    onEnsureDashboard?.();
    setCurrentStepIndex(0);

    const timer = window.setTimeout(() => {
      activateStep(0);
    }, 80);

    return () => {
      window.clearTimeout(timer);
      restoreHighlightedElement();
    };
  }, [isOpen]);

  // Actualizar elemento resaltado cuando cambia currentStepIndex
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      activateStep(currentStepIndex);
    }, 40);
    return () => window.clearTimeout(timer);
  }, [currentStepIndex, isOpen, activateStep]);

  // Recalcular coordenadas con getBoundingClientRect() al redimensionar o hacer scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => {
      const currentEl = snapshotRef.current?.element || null;
      calculateTooltipPosition(currentEl);
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, calculateTooltipPosition]);

  const finishOrSkipTour = useCallback(() => {
    restoreHighlightedElement();
    StorageService.setHasSeenTutorial(true);
    onClose();
  }, [onClose, restoreHighlightedElement]);

  const handleNextStep = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      finishOrSkipTour();
    }
  }, [currentStepIndex, finishOrSkipTour]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  // Soporte de teclado (Escape para omitir, flechas para avanzar/retroceder)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finishOrSkipTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleNextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStep();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, finishOrSkipTour, handleNextStep, handlePrevStep]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;
  const totalSteps = TOUR_STEPS.length;

  return (
    <>
      {/* Overlay oscuro que cubre toda la pantalla (bg-black/70, fixed, z-40) */}
      <div
        id="guided-tour-overlay"
        onClick={finishOrSkipTour}
        className="fixed inset-0 bg-black/70 backdrop-blur-[1px] z-40 transition-opacity duration-300 no-print"
        aria-hidden="true"
      />

      {/* Tooltip Flotante estilo 'Nordic Clean' (z-[60] para situarse sobre el elemento z-50) */}
      <div
        ref={tooltipRef}
        id="guided-tour-tooltip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
          width: 'min(380px, calc(100vw - 32px))',
        }}
        className="fixed z-[60] bg-[var(--surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-hairline)] shadow-[0_20px_50px_rgba(15,23,42,0.35)] p-5 transition-all duration-300 ease-out no-print"
      >
        {/* Barra de progreso superior minimalista */}
        <div className="w-full h-1 bg-[var(--surface-subtle)] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[var(--pink-primary)] transition-all duration-300 rounded-full"
            style={{
              width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
            }}
          />
        </div>

        {/* Cabecera del Tooltip: Etiqueta Nordic Clean + Contador de pasos ('1 de 5') */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--pink-primary)]">
            <Compass className="w-3.5 h-3.5" />
            <span>Tour Guiado</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono-tabular font-semibold text-[var(--text-secondary)] bg-[var(--surface-subtle)] px-2.5 py-0.5 rounded-md border border-[var(--border-hairline)]">
              {currentStepIndex + 1} de {totalSteps}
            </span>
            <button
              type="button"
              onClick={finishOrSkipTour}
              title="Cerrar tour"
              aria-label="Cerrar tour"
              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Título y Descripción del paso */}
        <div className="space-y-1.5 mb-5">
          <h3
            id="guided-tour-title"
            className="text-base font-bold text-[var(--text-primary)] tracking-tight leading-snug"
          >
            {currentStep.title}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Indicadores de pasos (dots) + Botones de control */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-hairline)]">
          {/* Botón discreto de Omitir Tour */}
          <button
            type="button"
            onClick={finishOrSkipTour}
            className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--surface-subtle)]"
          >
            Omitir Tour
          </button>

          {/* Navegación Anterior / Siguiente o Finalizar */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-3 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-hairline)] rounded-xl transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNextStep}
              className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5"
            >
              {isLastStep ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Finalizar</span>
                </>
              ) : (
                <>
                  <span>Siguiente</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
