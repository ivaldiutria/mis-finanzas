import React, { useState, useEffect } from 'react';
import { Calculator, RefreshCw, ArrowRight } from 'lucide-react';
import { sanitizeDecimalInput, parseNumberInput } from '../utils/numberFormat';

export interface UsdToVesHelperProps {
  officialRate: number | null;
  defaultManualRate?: number | null;
  currentRate?: number | null;
  rateSource?: 'bcv' | 'manual';
  locale?: string;
  onApplyVesAmount: (vesAmountStr: string, usedRate: number, source: 'bcv' | 'manual') => void;
  label?: string;
  compact?: boolean;
}

export const UsdToVesHelper: React.FC<UsdToVesHelperProps> = ({
  officialRate,
  defaultManualRate,
  currentRate,
  rateSource = 'bcv',
  locale = 'es-VE',
  onApplyVesAmount,
  label = '¿Conoces el monto en Dólares ($)? Ingrésalo para calcular los Bs:',
  compact = false,
}) => {
  const [usdInput, setUsdInput] = useState<string>('');
  const [mode, setMode] = useState<'bcv' | 'manual'>(
    rateSource === 'manual' ? 'manual' : officialRate && officialRate > 0 ? 'bcv' : 'manual'
  );
  const [manualRateStr, setManualRateStr] = useState<string>(() => {
    const initRate = currentRate && currentRate > 0
      ? currentRate
      : defaultManualRate && defaultManualRate > 0
        ? defaultManualRate
        : officialRate && officialRate > 0
          ? officialRate
          : 0;
    return initRate > 0 ? String(Number(initRate.toFixed(2))) : '';
  });

  // Sync mode if parent rateSource changes externally
  useEffect(() => {
    if (rateSource === 'bcv' && officialRate && officialRate > 0) {
      setMode('bcv');
    } else if (rateSource === 'manual') {
      setMode('manual');
    }
  }, [rateSource, officialRate]);

  // Sync manualRateStr if parent currentRate changes while in manual mode and user hasn't typed custom
  useEffect(() => {
    if (currentRate && currentRate > 0 && mode === 'manual' && !manualRateStr) {
      setManualRateStr(String(Number(currentRate.toFixed(2))));
    }
  }, [currentRate, mode, manualRateStr]);

  const parsedUsd = parseNumberInput(usdInput);
  const parsedManualRate = parseNumberInput(manualRateStr);
  const activeRate =
    mode === 'bcv' && officialRate && officialRate > 0
      ? Number(officialRate.toFixed(2))
      : parsedManualRate !== null && parsedManualRate > 0
        ? Number(parsedManualRate.toFixed(2))
        : currentRate && currentRate > 0
          ? Number(currentRate.toFixed(2))
          : officialRate && officialRate > 0
            ? Number(officialRate.toFixed(2))
            : 0;

  const calculatedVes =
    parsedUsd !== null && parsedUsd > 0 && activeRate > 0
      ? Number((parsedUsd * activeRate).toFixed(2))
      : null;

  const triggerCalculation = (nextUsdStr: string, nextMode: 'bcv' | 'manual', nextManualRateStr: string) => {
    const usdVal = parseNumberInput(nextUsdStr);
    const manRateVal = parseNumberInput(nextManualRateStr);
    const rawRateToUse =
      nextMode === 'bcv' && officialRate && officialRate > 0
        ? officialRate
        : manRateVal !== null && manRateVal > 0
          ? manRateVal
          : currentRate && currentRate > 0
            ? currentRate
            : officialRate && officialRate > 0
              ? officialRate
              : 0;
    const rateToUse = rawRateToUse > 0 ? Number(rawRateToUse.toFixed(2)) : 0;

    if (usdVal !== null && usdVal > 0 && rateToUse > 0) {
      const vesFixed = (usdVal * rateToUse).toFixed(2);
      onApplyVesAmount(vesFixed, rateToUse, nextMode);
    }
  };

  const handleUsdChange = (val: string) => {
    const clean = sanitizeDecimalInput(val);
    setUsdInput(clean);
    triggerCalculation(clean, mode, manualRateStr);
  };

  const handleModeSwitch = (nextMode: 'bcv' | 'manual') => {
    setMode(nextMode);
    if (nextMode === 'manual' && !manualRateStr) {
      const fallback = defaultManualRate && defaultManualRate > 0
        ? String(Number(defaultManualRate.toFixed(2)))
        : officialRate && officialRate > 0
          ? String(Number(officialRate.toFixed(2)))
          : '';
      setManualRateStr(fallback);
      triggerCalculation(usdInput, nextMode, fallback);
    } else {
      triggerCalculation(usdInput, nextMode, manualRateStr);
    }
  };

  const handleManualRateChange = (val: string) => {
    const clean = sanitizeDecimalInput(val);
    setManualRateStr(clean);
    triggerCalculation(usdInput, 'manual', clean);
  };

  return (
    <div
      className={`rounded-xl border-2 border-[var(--border-input)] bg-[var(--surface-subtle)] shadow-xs ${
        compact ? 'p-2.5' : 'p-3.5'
      } transition-all`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Calculator className="w-3.5 h-3.5" />
          </span>
          {label}
        </span>
        <div className="flex items-center gap-1 bg-[var(--surface)] p-1 rounded-lg border border-[var(--border-input)]">
          <button
            type="button"
            onClick={() => handleModeSwitch('bcv')}
            disabled={!officialRate || officialRate <= 0}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              mode === 'bcv'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-40'
            }`}
          >
            BCV {officialRate && officialRate > 0 ? `(${officialRate.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('manual')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              mode === 'manual'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
            }`}
          >
            Tasa Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
        {/* Input en Dólares ($) */}
        <div className={`${mode === 'manual' ? 'sm:col-span-5' : 'sm:col-span-6'} relative`}>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold pointer-events-none leading-none">
            USD $
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={usdInput}
            onChange={(e) => handleUsdChange(e.target.value)}
            placeholder="Monto en $ (ej. 20)"
            className="w-full pl-14 pr-3 py-2 bg-[var(--surface)] border-2 border-[var(--border-input)] rounded-lg text-xs font-bold font-mono-tabular text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:font-normal focus:outline-none focus:border-emerald-600 transition-colors"
          />
        </div>

        {/* Input de Tasa Manual cuando está en modo manual */}
        {mode === 'manual' && (
          <div className="sm:col-span-4 relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-amber-600 text-white text-[10px] font-extrabold pointer-events-none leading-none">
              Tasa
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={manualRateStr}
              onChange={(e) => handleManualRateChange(e.target.value)}
              placeholder="Bs/$"
              className="w-full pl-13 pr-2.5 py-2 bg-[var(--surface)] border-2 border-amber-500 rounded-lg text-xs font-bold font-mono-tabular text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:font-normal focus:outline-none focus:border-amber-600 transition-colors"
            />
          </div>
        )}

        {/* Resultado automático aplicado */}
        <div className={`${mode === 'manual' ? 'sm:col-span-3' : 'sm:col-span-6'} flex items-center justify-between sm:justify-end gap-1.5`}>
          {calculatedVes !== null ? (
            <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg w-full sm:w-auto justify-between sm:justify-end shadow-xs">
              <span className="text-[11px] font-bold flex items-center gap-1 opacity-95">
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                En Bs:
              </span>
              <span className="text-xs font-extrabold font-mono-tabular">
                Bs {calculatedVes.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Escribe los $ y se calcularán los Bs automáticamente
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
