import React, { useState } from 'react';
import { formatearMonto, formatearPorcentaje } from '../services/bcvApi';
import {
  DistribucionCategoriaItem,
  SerieMensualItem,
} from '../utils/calculations';

interface ChartProps {
  serie: SerieMensualItem[];
  locale: 'es-VE' | 'en-US';
}

/**
 * 1. Gráfica de barras de ingresos frente a gastos por mes
 */
export const IncomeVsExpenseBarChart: React.FC<ChartProps> = ({ serie, locale }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    100,
    ...serie.map((s) => Math.max(s.ingresosUsd, s.gastosUsd))
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[var(--income-color)] inline-block" />
            Ingresos (USD)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[var(--pink-primary)] inline-block" />
            Gastos (USD)
          </span>
        </div>
        {hoveredIdx !== null && serie[hoveredIdx] && (
          <div className="text-xs font-mono-tabular text-[var(--text-primary)]">
            {serie[hoveredIdx].label}: +{formatearMonto(serie[hoveredIdx].ingresosUsd, 'USD', locale)} · -
            {formatearMonto(serie[hoveredIdx].gastosUsd, 'USD', locale)}
          </div>
        )}
      </div>

      <div className="relative flex-1 min-h-[210px] flex items-end gap-3 pt-6 pb-2 border-b border-[var(--border-hairline)]">
        {/* Líneas guía horizontales */}
        <div className="absolute inset-x-0 top-6 bottom-2 flex flex-col justify-between pointer-events-none">
          {[1, 0.75, 0.5, 0.25, 0].map((step) => (
            <div
              key={step}
              className="w-full border-b border-dashed border-[var(--border-divider)] flex items-center"
            >
              <span className="text-[10px] font-mono-tabular text-[var(--text-secondary)] -mt-3 bg-[var(--surface)]/80 pr-1">
                ${Math.round(maxVal * step)}
              </span>
            </div>
          ))}
        </div>

        {serie.map((item, idx) => {
          const incHeight = Math.max(2, (item.ingresosUsd / maxVal) * 165);
          const expHeight = Math.max(2, (item.gastosUsd / maxVal) * 165);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={item.monthKey}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="relative z-10 flex-1 flex flex-col items-center group cursor-pointer"
            >
              <div className="w-full flex items-end justify-center gap-1.5 h-[170px]">
                <div
                  style={{ height: `${incHeight}px` }}
                  className={`w-3.5 sm:w-5 rounded-t-md transition-opacity duration-150 bg-[var(--income-color)] ${
                    isHovered ? 'opacity-100' : 'opacity-85'
                  }`}
                  title={`Ingresos ${item.label}: ${formatearMonto(item.ingresosUsd, 'USD', locale)}`}
                />
                <div
                  style={{ height: `${expHeight}px` }}
                  className={`w-3.5 sm:w-5 rounded-t-md transition-opacity duration-150 bg-[var(--pink-primary)] ${
                    isHovered ? 'opacity-100' : 'opacity-85'
                  }`}
                  title={`Gastos ${item.label}: ${formatearMonto(item.gastosUsd, 'USD', locale)}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        {serie.map((item) => (
          <div
            key={item.monthKey}
            className="flex-1 text-center text-xs text-[var(--text-secondary)] font-medium truncate"
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 2. Gráfica de línea con la evolución del balance mensual y 6. Evolución de ingresos, gastos y capacidad de ahorro
 */
export const MonthlyBalanceLineChart: React.FC<
  ChartProps & { showIncomeAndExpenseLines?: boolean }
> = ({ serie, locale, showIncomeAndExpenseLines = false }) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const values = serie.flatMap((s) =>
    showIncomeAndExpenseLines
      ? [s.ingresosUsd, s.gastosUsd, s.balanceUsd]
      : [s.balanceUsd, s.patrimonioAcumuladoUsd]
  );
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(100, ...values);
  const range = Math.max(1, maxVal - minVal);

  const width = 560;
  const height = 190;
  const padX = 36;
  const padY = 20;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const getX = (i: number) =>
    serie.length <= 1 ? width / 2 : padX + (i / (serie.length - 1)) * plotW;
  const getY = (val: number) =>
    padY + plotH - ((val - minVal) / range) * plotH;

  const buildPath = (getter: (s: SerieMensualItem) => number) =>
    serie
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(getter(s)).toFixed(1)}`)
      .join(' ');

  const balancePath = buildPath((s) => s.balanceUsd);
  const zeroY = getY(0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[var(--rose-gold)] inline-block" />
            Balance / Capacidad de ahorro
          </span>
          {showIncomeAndExpenseLines && (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--income-color)] inline-block" />
                Ingresos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[var(--expense-color)] inline-block" />
                Gastos
              </span>
            </>
          )}
        </div>
        {activeIdx !== null && serie[activeIdx] && (
          <div className="text-xs font-mono-tabular text-[var(--text-primary)]">
            {serie[activeIdx].label}: Balance{' '}
            {formatearMonto(serie[activeIdx].balanceUsd, 'USD', locale)}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-[200px] overflow-visible"
        >
          {/* Línea de cero */}
          <line
            x1={padX}
            y1={zeroY}
            x2={width - padX}
            y2={zeroY}
            stroke="var(--border-input)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {showIncomeAndExpenseLines && (
            <>
              <path
                d={buildPath((s) => s.ingresosUsd)}
                fill="none"
                stroke="var(--income-color)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d={buildPath((s) => s.gastosUsd)}
                fill="none"
                stroke="var(--expense-color)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </>
          )}

          {/* Línea principal de balance neto mensual */}
          <path
            d={balancePath}
            fill="none"
            stroke="var(--rose-gold)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Puntos interactivos */}
          {serie.map((s, i) => {
            const cx = getX(i);
            const cy = getY(s.balanceUsd);
            return (
              <g
                key={s.monthKey}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={activeIdx === i ? 6 : 4}
                  fill="var(--surface)"
                  stroke="var(--rose-gold)"
                  strokeWidth="2.5"
                />
                <text
                  x={cx}
                  y={height - 2}
                  textAnchor="middle"
                  className="text-[10px] fill-[var(--text-secondary)]"
                >
                  {s.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

/**
 * 3. Gráfica de dona para la distribución de gastos por categoría
 */
export const CategoryDonutChart: React.FC<{
  items: DistribucionCategoriaItem[];
  locale: 'es-VE' | 'en-US';
}> = ({ items, locale }) => {
  const total = items.reduce((acc, i) => acc + i.amountUsd, 0);

  if (items.length === 0 || total <= 0) {
    return (
      <div className="h-[210px] flex flex-col items-center justify-center text-center px-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Aún no hay gastos registrados en este periodo para mostrar la distribución por categoría.
        </p>
      </div>
    );
  }

  const size = 168;
  const strokeWidth = 24;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {items.map((item) => {
            const pct = item.percentage / 100;
            const dashArray = `${pct * circumference} ${circumference}`;
            const dashOffset = -accumulatedPercent * circumference;
            accumulatedPercent += pct;

            return (
              <circle
                key={item.categoryId}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                className="transition-opacity duration-150 hover:opacity-85"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-[11px] text-[var(--text-secondary)]">Total gastos</span>
          <span className="text-sm font-semibold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(total, 'USD', locale)}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2 max-h-[190px] overflow-y-auto pr-1">
        {items.slice(0, 6).map((item) => (
          <div
            key={item.categoryId}
            className="flex items-center justify-between text-xs py-1 border-b border-[var(--border-divider)] last:border-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[var(--text-primary)] truncate">{item.categoryName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono-tabular">
              <span className="text-[var(--text-primary)] font-medium">
                {formatearMonto(item.amountUsd, 'USD', locale)}
              </span>
              <span className="text-[var(--text-secondary)]">·</span>
              <span className="text-[var(--text-secondary)] w-12 text-right">
                {formatearPorcentaje(item.percentage, 1, locale)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 4. Gráfica del progreso acumulado de los ahorros y patrimonio
 */
export const SavingsProgressChart: React.FC<ChartProps> = ({ serie, locale }) => {
  const maxVal = Math.max(
    100,
    ...serie.map((s) => Math.max(s.ahorroAcumuladoUsd, s.patrimonioAcumuladoUsd))
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] mb-4">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-[var(--lavender-accent)] inline-block" />
          Ahorro acumulado (USD)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs bg-[var(--pink-soft)] inline-block" />
          Patrimonio total (USD)
        </span>
      </div>

      <div className="flex-1 min-h-[180px] flex items-end gap-3 pt-4 pb-2 border-b border-[var(--border-hairline)]">
        {serie.map((s) => {
          const savH = Math.max(4, (s.ahorroAcumuladoUsd / maxVal) * 145);
          const patH = Math.max(4, (Math.max(0, s.patrimonioAcumuladoUsd) / maxVal) * 145);

          return (
            <div key={s.monthKey} className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-end justify-center gap-1.5 h-[150px]">
                <div
                  style={{ height: `${savH}px` }}
                  className="w-4 sm:w-5 bg-[var(--lavender-accent)] rounded-t-md transition-opacity hover:opacity-90"
                  title={`Ahorro acumulado (${s.label}): ${formatearMonto(s.ahorroAcumuladoUsd, 'USD', locale)}`}
                />
                <div
                  style={{ height: `${patH}px` }}
                  className="w-4 sm:w-5 bg-[var(--pink-soft)] rounded-t-md transition-opacity hover:opacity-90"
                  title={`Patrimonio (${s.label}): ${formatearMonto(s.patrimonioAcumuladoUsd, 'USD', locale)}`}
                />
              </div>
              <span className="text-[11px] text-[var(--text-secondary)] mt-2">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 5. Gráfica de comparación entre presupuesto planificado y gastos reales
 */
export const BudgetComparisonChart: React.FC<{
  items: {
    categoryName: string;
    plannedUsd: number;
    actualUsd: number;
  }[];
  locale: 'es-VE' | 'en-US';
}> = ({ items, locale }) => {
  if (items.length === 0) {
    return (
      <div className="h-[190px] flex items-center justify-center text-center px-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Configura límites por categoría en «Presupuesto mensual» para comparar lo planificado frente al gasto real.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
      {items.map((row) => {
        const pct = row.plannedUsd > 0 ? (row.actualUsd / row.plannedUsd) * 100 : 0;
        const barWidth = Math.min(100, Math.max(0, pct));
        const barColor =
          pct > 100
            ? 'var(--expense-color)'
            : pct >= 80
              ? 'var(--warning-color)'
              : 'var(--pink-primary)';

        return (
          <div key={row.categoryName} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--text-primary)] truncate">
                {row.categoryName}
              </span>
              <span className="font-mono-tabular text-[var(--text-secondary)]">
                {formatearMonto(row.actualUsd, 'USD', locale)} /{' '}
                {formatearMonto(row.plannedUsd, 'USD', locale)} (
                {formatearPorcentaje(pct, 0, locale)})
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--pink-light)] rounded-full overflow-hidden">
              <div
                style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                className="h-full rounded-full transition-all duration-150"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
