import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Calendar,
  FileText,
  Landmark,
  Printer,
  Sparkles,
} from 'lucide-react';
import { AppDataSchema, Transaction } from '../types/finance';
import {
  DEFAULT_APP_TIMEZONE,
  normalizarCategoriaGastoComision,
  obtenerFechaLocalIso,
  obtenerInfoHoraProcesoTransaccion,
} from '../utils/calculations';
import { StorageService } from '../utils/storage';
import {
  formatearMonto,
  formatearPorcentaje,
  formatearTasa,
} from '../services/bcvApi';

interface MonthlyReportPdfViewProps {
  appData: AppDataSchema;
  selectedMonth: string;
  onChangeMonth?: (monthKey: string) => void;
  locale: 'es-VE' | 'en-US';
}

export const MonthlyReportPdfView: React.FC<MonthlyReportPdfViewProps> = ({
  appData,
  selectedMonth,
  onChangeMonth,
  locale,
}) => {
  const [reportMonth, setReportMonth] = useState<string>(selectedMonth);
  const [includeMovementsAnnex, setIncludeMovementsAnnex] =
    useState<boolean>(true);
  const [customStatementNote, setCustomStatementNote] = useState<string>('');

  const activeMonth = onChangeMonth ? selectedMonth : reportMonth;

  const handleMonthChange = (val: string) => {
    if (!val) return;
    setReportMonth(val);
    if (onChangeMonth) {
      onChangeMonth(val);
    }
  };

  const report = useMemo(
    () => StorageService.getMonthlyStatementReport(activeMonth, appData),
    [activeMonth, appData]
  );

  const handleGeneratePdf = () => {
    window.print();
  };

  const getWalletName = (id?: string) =>
    (appData.wallets || []).find((w) => w.id === id)?.name || 'General';

  const getCategoryName = (id: string, txn?: Transaction) => {
    const effectiveId =
      txn && (txn.type === 'expense' || txn.isThirdPartyAllowance)
        ? normalizarCategoriaGastoComision(id, appData.categories, txn)
        : id;
    return (
      appData.categories.find((c) => c.id === effectiveId)?.name ||
      (effectiveId === 'cat_exp_bank_fees' ? 'Comisiones Bancarias' : 'General')
    );
  };

  const formattedIssueDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'es-VE', {
        timeZone: DEFAULT_APP_TIMEZONE,
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return obtenerFechaLocalIso();
    }
  }, [locale]);

  return (
    <div className="space-y-6">
      {/* Barra de controles superior (Oculta al imprimir con .no-print) */}
      <div className="no-print bg-[var(--surface)] p-5 sm:p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)]">
              <FileText className="w-4 h-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">
              Estado de Cuenta Mensual (Generador PDF)
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Selecciona el mes para consultar tu resumen ejecutivo y presiona{' '}
            <strong className="text-[var(--text-primary)]">«Generar PDF»</strong>{' '}
            para exportar o imprimir en formato limpio A4 / Carta.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de mes */}
          <div className="flex items-center gap-2 bg-[var(--surface-subtle)] px-3.5 py-2 rounded-xl border border-[var(--border-input)]">
            <Calendar className="w-4 h-4 text-[var(--pink-primary)]" />
            <label
              htmlFor="statement-month-picker"
              className="text-xs text-[var(--text-secondary)] font-medium"
            >
              Mes:
            </label>
            <input
              id="statement-month-picker"
              type="month"
              value={activeMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="text-xs font-semibold text-[var(--text-primary)] bg-transparent focus:outline-none"
            />
          </div>

          {/* Toggle para incluir anexo de movimientos individuales */}
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeMovementsAnnex}
              onChange={(e) => setIncludeMovementsAnnex(e.target.checked)}
              className="rounded text-[var(--pink-primary)]"
            />
            <span>Incluir detalle de movimientos</span>
          </label>

          {/* Botón Primario: Generar PDF (window.print) */}
          <button
            type="button"
            onClick={handleGeneratePdf}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Generar PDF</span>
          </button>
        </div>
      </div>

      {/* Nota opcional personalizable para el encabezado del PDF (Oculta el input al imprimir) */}
      <div className="no-print bg-[var(--surface-subtle)] px-5 py-3.5 rounded-2xl border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap">
          Nota o subtítulo del reporte (opcional):
        </label>
        <input
          type="text"
          value={customStatementNote}
          onChange={(e) => setCustomStatementNote(e.target.value)}
          placeholder="Ej. Cierre contable personal — Octubre 2026"
          className="flex-1 px-3 py-1.5 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
        />
      </div>

      {/* ====================================================================
       * HOJA DE ESTADO DE CUENTA (Optimizada para @media print A4 / Carta)
       * ==================================================================== */}
      <article className="printable-report-sheet bg-[var(--surface)] p-6 sm:p-10 rounded-2xl border border-[var(--border-hairline)] space-y-8 shadow-2xs">
        {/* 1. ENCABEZADO DEL ESTADO DE CUENTA */}
        <header className="pb-6 border-b-2 border-[var(--border-hairline)] print-border-strong flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-[var(--text-secondary)] print-text-muted">
              ESTADO DE CUENTA FINANCIERO · REPORTE MENSUAL
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-editorial text-[var(--text-primary)] print-text-strong capitalize">
              {report.monthLabel}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] print-text-muted">
              Titular:{' '}
              <strong className="text-[var(--text-primary)] print-text-strong">
                {report.userName}
              </strong>
              {customStatementNote ? ` · ${customStatementNote}` : ''}
            </p>
          </div>

          <div className="text-left sm:text-right font-mono-tabular text-xs space-y-1 text-[var(--text-secondary)] print-text-muted">
            <div>
              Fecha de emisión:{' '}
              <strong className="text-[var(--text-primary)] print-text-strong">
                {formattedIssueDate}
              </strong>
            </div>
            <div>
              Tasa de referencia:{' '}
              <strong className="text-[var(--text-primary)] print-text-strong">
                1 USD = {formatearTasa(report.activeRate, locale)} Bs
              </strong>
            </div>
            <div>
              Período evaluado:{' '}
              <strong className="text-[var(--text-primary)] print-text-strong">
                {report.monthKey}
              </strong>
            </div>
          </div>
        </header>

        {/* 2. RESUMEN EJECUTIVO DEL MES: TOTAL INGRESOS, TOTAL EGRESOS Y BALANCE NETO */}
        <section className="print-avoid-break space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] print-text-strong">
            1. Resumen Ejecutivo del Mes ({report.monthLabel})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print-grid-3">
            {/* Total Ingresos */}
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] print-card space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] print-text-muted">
                <span className="font-semibold">Total Ingresos del Mes</span>
                <ArrowUpRight className="w-4 h-4 text-[var(--income-color)] no-print" />
              </div>
              <div className="text-2xl font-bold font-mono-tabular text-[var(--income-color)] print-text-strong">
                {formatearMonto(
                  report.resumenMes.ingresosMesUsd,
                  'USD',
                  locale
                )}
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                ≈{' '}
                {formatearMonto(
                  report.resumenMes.ingresosMesUsd * report.activeRate,
                  'VES',
                  locale
                )}
              </div>
              <div className="pt-2 border-t border-[var(--border-divider)] text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted flex justify-between">
                <span>USD directo:</span>
                <span>
                  {formatearMonto(
                    report.resumenMes.ingresosMesSoloUsd,
                    'USD',
                    locale
                  )}
                </span>
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted flex justify-between">
                <span>Bs recibidos:</span>
                <span>
                  {formatearMonto(
                    report.resumenMes.ingresosMesVesOriginal,
                    'VES',
                    locale
                  )}
                </span>
              </div>
            </div>

            {/* Total Egresos */}
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] print-card space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] print-text-muted">
                <span className="font-semibold">Total Egresos del Mes</span>
                <ArrowDownRight className="w-4 h-4 text-[var(--expense-color)] no-print" />
              </div>
              <div className="text-2xl font-bold font-mono-tabular text-[var(--expense-color)] print-text-strong">
                {formatearMonto(report.resumenMes.gastosMesUsd, 'USD', locale)}
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                ≈{' '}
                {formatearMonto(
                  report.resumenMes.gastosMesUsd * report.activeRate,
                  'VES',
                  locale
                )}
              </div>
              <div className="pt-2 border-t border-[var(--border-divider)] text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted flex justify-between">
                <span>USD directo:</span>
                <span>
                  {formatearMonto(
                    report.resumenMes.gastosMesSoloUsd,
                    'USD',
                    locale
                  )}
                </span>
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted flex justify-between">
                <span>Bs pagados:</span>
                <span>
                  {formatearMonto(
                    report.resumenMes.gastosMesVesOriginal,
                    'VES',
                    locale
                  )}
                </span>
              </div>
            </div>

            {/* Resultado Neto del Mes */}
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] print-card space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] print-text-muted">
                <span className="font-semibold">Balance Neto Mensual</span>
                <Sparkles className="w-4 h-4 text-[var(--rose-gold)] no-print" />
              </div>
              <div
                className={`text-2xl font-bold font-mono-tabular print-text-strong ${
                  report.resumenMes.balanceNetoMensualUsd >= 0
                    ? 'text-[var(--income-color)]'
                    : 'text-[var(--expense-color)]'
                }`}
              >
                {report.resumenMes.balanceNetoMensualUsd >= 0 ? '+' : ''}
                {formatearMonto(
                  report.resumenMes.balanceNetoMensualUsd,
                  'USD',
                  locale
                )}
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                ≈{' '}
                {report.resumenMes.balanceNetoMensualUsd >= 0 ? '+' : ''}
                {formatearMonto(
                  report.resumenMes.balanceNetoMensualUsd * report.activeRate,
                  'VES',
                  locale
                )}
              </div>
              <div className="pt-2 border-t border-[var(--border-divider)] text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted flex justify-between">
                <span>Relación Egresos / Ingresos:</span>
                <strong>
                  {formatearPorcentaje(
                    report.resumenMes.porcentajeGastosSobreIngresos,
                    1,
                    locale
                  )}
                </strong>
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted flex justify-between">
                <span>Movimientos del mes:</span>
                <strong>{report.monthTransactions.length}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* 3. GASTOS DESGLOSADOS POR CATEGORÍA */}
        <section className="print-avoid-break space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] print-text-strong">
              2. Gastos Desglosados por Categoría ({report.monthLabel})
            </h3>
            <span className="text-xs font-mono-tabular text-[var(--text-secondary)] print-text-muted">
              Total Egresos:{' '}
              <strong className="text-[var(--text-primary)] print-text-strong">
                {formatearMonto(report.resumenMes.gastosMesUsd, 'USD', locale)}
              </strong>
            </span>
          </div>

          {report.gastosPorCategoria.length === 0 ? (
            <div className="p-5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] print-card text-xs text-[var(--text-secondary)] print-text-muted">
              No se registraron egresos completados en {report.monthLabel}.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)] print-table-wrapper">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)] print-table-header">
                    <th className="py-2.5 px-4">Categoría</th>
                    <th className="py-2.5 px-4 text-center">Operaciones</th>
                    <th className="py-2.5 px-4 text-right">% del Total</th>
                    <th className="py-2.5 px-4 text-right">Monto en USD</th>
                    <th className="py-2.5 px-4 text-right">
                      Equivalente en Bs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)]">
                  {report.gastosPorCategoria.map((cat) => (
                    <tr key={cat.categoryId} className="print-table-row">
                      <td className="py-2.5 px-4 font-medium text-[var(--text-primary)] print-text-strong">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span>{cat.categoryName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                        {cat.count}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                        {formatearPorcentaje(cat.percentage, 1, locale)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-[var(--text-primary)] print-text-strong">
                        {formatearMonto(cat.amountUsd, 'USD', locale)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                        {formatearMonto(
                          cat.amountUsd * report.activeRate,
                          'VES',
                          locale
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--surface-subtle)] border-t-2 border-[var(--border-hairline)] font-semibold font-mono-tabular text-xs print-table-header">
                    <td className="py-2.5 px-4 text-[var(--text-primary)] print-text-strong">
                      Total Egresos por Categorías
                    </td>
                    <td className="py-2.5 px-4 text-center text-[var(--text-secondary)] print-text-muted">
                      {report.gastosPorCategoria.reduce(
                        (acc, c) => acc + c.count,
                        0
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[var(--text-secondary)] print-text-muted">
                      100,0%
                    </td>
                    <td className="py-2.5 px-4 text-right text-[var(--expense-color)] print-text-strong">
                      {formatearMonto(
                        report.resumenMes.gastosMesUsd,
                        'USD',
                        locale
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[var(--text-secondary)] print-text-muted">
                      {formatearMonto(
                        report.resumenMes.gastosMesUsd * report.activeRate,
                        'VES',
                        locale
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* 4. SALDO REAL ACTUAL DE TODAS LAS WALLETS */}
        <section className="print-avoid-break space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] print-text-strong flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[var(--pink-primary)] no-print" />
              <span>3. Saldo Real Actual de Todas las Wallets</span>
            </h3>
            <div className="text-xs font-mono-tabular text-[var(--text-secondary)] print-text-muted">
              Patrimonio Disponible Consolidado:{' '}
              <strong className="text-[var(--text-primary)] print-text-strong">
                {formatearMonto(report.totalConsolidadoUsd, 'USD', locale)}
              </strong>{' '}
              (≈{' '}
              {formatearMonto(report.totalConsolidadoVesEquiv, 'VES', locale)})
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)] print-table-wrapper">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)] print-table-header">
                  <th className="py-2.5 px-4">Billetera / Cuenta</th>
                  <th className="py-2.5 px-4">Entidad / Plataforma</th>
                  <th className="py-2.5 px-4 text-center">Moneda Nativa</th>
                  <th className="py-2.5 px-4 text-right">
                    Saldo Real Actual (Moneda Nativa)
                  </th>
                  <th className="py-2.5 px-4 text-right">
                    Equivalente Consolidado (USD)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-divider)]">
                {report.billeterasActivas.map((wb) => {
                  const isVes = wb.wallet.currency === 'VES';
                  const isMonthlyThirdParty = Boolean(
                    wb.wallet.isThirdPartyExpenseAccount ||
                      wb.wallet.isPassThroughAccount
                  );
                  const nativeBalance = isMonthlyThirdParty
                    ? isVes
                      ? wb.pasadoMesVes
                      : wb.pasadoMesUsd
                    : isVes
                      ? wb.saldoActualVes
                      : wb.saldoActualUsd;
                  const usdBalance = isMonthlyThirdParty
                    ? wb.pasadoMesUsd
                    : wb.saldoActualUsd;
                  return (
                    <tr key={wb.wallet.id} className="print-table-row">
                      <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)] print-text-strong">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: wb.wallet.color }}
                          />
                          <span>{wb.wallet.name}</span>
                          {wb.wallet.isThirdPartyExpenseAccount && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] print-text-muted">
                              Solo mes ({wb.pasadoMesCount}{' '}
                              {wb.pasadoMesCount === 1 ? 'envío' : 'envíos'})
                            </span>
                          )}
                          {wb.wallet.isPassThroughAccount && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] print-text-muted">
                              Puente terceros (Solo mes)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-secondary)] print-text-muted">
                        {wb.wallet.isThirdPartyExpenseAccount
                          ? `${wb.wallet.banco ? `${wb.wallet.banco} · ` : ''}Pasado en ${report.monthLabel} (${wb.wallet.beneficiaryName || 'Familiar'})`
                          : wb.wallet.isPassThroughAccount
                            ? `${wb.wallet.banco ? `${wb.wallet.banco} · ` : ''}Paso terceros en ${report.monthLabel}`
                            : wb.wallet.banco || 'Cuenta personal'}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono-tabular font-semibold text-[var(--text-secondary)] print-text-strong">
                        {wb.wallet.currency}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[var(--text-primary)] print-text-strong">
                        {formatearMonto(
                          nativeBalance,
                          isVes ? 'VES' : 'USD',
                          locale
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                        {formatearMonto(usdBalance, 'USD', locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--surface-subtle)] border-t-2 border-[var(--border-hairline)] font-semibold font-mono-tabular text-xs print-table-header">
                  <td
                    colSpan={3}
                    className="py-2.5 px-4 text-[var(--text-primary)] print-text-strong"
                  >
                    Totales por Moneda Nativa y Consolidado General
                  </td>
                  <td className="py-2.5 px-4 text-right text-[var(--text-primary)] print-text-strong">
                    <div>
                      USD/USDT:{' '}
                      {formatearMonto(
                        report.resumenSoloUsd.saldoActualUsd,
                        'USD',
                        locale
                      )}
                    </div>
                    <div>
                      VES:{' '}
                      {formatearMonto(
                        report.resumenSoloVes.saldoActualVes,
                        'VES',
                        locale
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-[var(--income-color)] print-text-strong">
                    {formatearMonto(report.totalConsolidadoUsd, 'USD', locale)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* 5. TRANSFERENCIAS INTERNAS ENTRE WALLETS DEL MES (Si existen) */}
        {report.monthWalletTransfers.length > 0 && (
          <section className="print-avoid-break space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] print-text-strong flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-[var(--pink-primary)] no-print" />
                <span>
                  4. Conversiones y Transferencias entre Wallets ({report.monthLabel})
                </span>
              </h3>
              <span className="text-[11px] text-[var(--text-secondary)] print-text-muted">
                Operaciones neutras (no suman a Ingresos ni Egresos)
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)] print-table-wrapper">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)] print-table-header">
                    <th className="py-2 px-3">Fecha y Hora</th>
                    <th className="py-2 px-3">Wallet Origen (Débito)</th>
                    <th className="py-2 px-3 text-right">Tasa</th>
                    <th className="py-2 px-3">Wallet Destino (Crédito)</th>
                    <th className="py-2 px-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)]">
                  {report.monthWalletTransfers.map((tr) => {
                    const trTime = obtenerInfoHoraProcesoTransaccion(tr, locale);
                    return (
                    <tr key={tr.id} className="print-table-row">
                      <td className="py-2 px-3 font-mono-tabular text-[var(--text-secondary)] print-text-muted whitespace-nowrap">
                        <div className="font-semibold text-[var(--text-primary)] print-text-strong">
                          {tr.date}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)] print-text-muted">
                          Hora: {trTime.timeFormatted}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono-tabular text-[var(--text-primary)] print-text-strong">
                        {getWalletName(tr.sourceWalletId)}: -
                        {formatearMonto(
                          tr.amountOut,
                          tr.sourceCurrency === 'VES' ? 'VES' : 'USD',
                          locale
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-[var(--text-secondary)] print-text-muted">
                        {formatearTasa(tr.exchangeRate, locale)}
                      </td>
                      <td className="py-2 px-3 font-mono-tabular text-[var(--text-primary)] print-text-strong">
                        {getWalletName(tr.destinationWalletId)}: +
                        {formatearMonto(
                          tr.amountIn,
                          tr.destinationCurrency === 'VES' ? 'VES' : 'USD',
                          locale
                        )}
                      </td>
                      <td className="py-2 px-3 text-[var(--text-secondary)] print-text-muted">
                        {tr.notes || 'Conversión P2P entre cuentas propias'}
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 6. ANEXO OPCIONAL: DETALLE CRONOLÓGICO DE MOVIMIENTOS DEL MES */}
        {includeMovementsAnnex && report.monthTransactions.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-secondary)] print-text-strong">
                {report.monthWalletTransfers.length > 0 ? '5.' : '4.'} Detalle de
                Movimientos Registrados ({report.monthLabel})
              </h3>
              <span className="text-[11px] font-medium text-[var(--text-secondary)] print-text-muted">
                Ordenados del más reciente al más viejo por fecha y hora de proceso
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)] print-table-wrapper">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)] print-table-header">
                    <th className="py-2 px-3">Fecha y Hora de Proceso</th>
                    <th className="py-2 px-3">Descripción</th>
                    <th className="py-2 px-3">Categoría</th>
                    <th className="py-2 px-3">Wallet</th>
                    <th className="py-2 px-3 text-right">Monto Original</th>
                    <th className="py-2 px-3 text-right">Equivalente USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)]">
                  {report.monthTransactions.map((txn) => {
                    const procInfo = obtenerInfoHoraProcesoTransaccion(
                      txn,
                      locale
                    );
                    return (
                      <tr key={txn.id} className="print-table-row">
                        <td className="py-2 px-3 font-mono-tabular text-[var(--text-secondary)] print-text-muted whitespace-nowrap">
                          <div className="font-semibold text-[var(--text-primary)] print-text-strong">
                            {txn.date}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)] print-text-muted">
                            {procInfo.hasExplicitTime
                              ? `Hora: ${procInfo.timeFormatted}`
                              : 'Hora: --:--'}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-medium text-[var(--text-primary)] print-text-strong">
                          {txn.description}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-secondary)] print-text-muted">
                          {getCategoryName(txn.categoryId, txn)}
                        </td>
                        <td className="py-2 px-3 text-[var(--text-secondary)] print-text-muted">
                          {getWalletName(txn.walletId)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular text-[var(--text-secondary)] print-text-muted whitespace-nowrap">
                          {formatearMonto(
                            txn.amount,
                            txn.currency === 'VES' ? 'VES' : 'USD',
                            locale
                          )}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono-tabular font-semibold whitespace-nowrap print-text-strong ${
                            txn.type === 'income'
                              ? 'text-[var(--income-color)]'
                              : 'text-[var(--expense-color)]'
                          }`}
                        >
                          {txn.type === 'income' ? '+' : '-'}
                          {formatearMonto(txn.amountUsd, 'USD', locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Pie de página del Estado de Cuenta */}
        <footer className="pt-4 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono-tabular text-[var(--text-secondary)] print-text-muted">
          <span>
            Estado de Cuenta generado por {report.userName} · Moneda base USD
          </span>
          <span>
            Las transferencias internas entre Wallets propias no se contabilizan
            como ingresos ni egresos.
          </span>
        </footer>
      </article>
    </div>
  );
};
