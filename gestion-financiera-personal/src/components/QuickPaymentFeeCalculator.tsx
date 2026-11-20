import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Smartphone,
  Landmark,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  TrendingDown,
  Layers,
  ArrowLeftRight,
  ShieldAlert,
} from 'lucide-react';
import {
  CurrencyCode,
  WalletAccount,
} from '../types/finance';
import {
  formatearMonto,
  formatearPorcentaje,
  formatearTasa,
} from '../services/bcvApi';
import { ResumenBilleteraItem } from '../utils/calculations';
import { PresetTransactionValues } from './TransactionModal';

export interface QuickPaymentFeeCalculatorProps {
  wallets: WalletAccount[];
  walletSummaries?: ResumenBilleteraItem[];
  officialRate: number | null;
  defaultManualRate: number | null;
  locale: 'es-VE' | 'en-US';
  onRegisterExpense?: (preset: PresetTransactionValues) => void;
  onNavigateToWallets?: () => void;
}

export type CalcViewMode = 'comparison' | 'pago_movil' | 'transferencia';

export const QuickPaymentFeeCalculator: React.FC<QuickPaymentFeeCalculatorProps> = ({
  wallets,
  walletSummaries = [],
  officialRate,
  defaultManualRate,
  locale,
  onRegisterExpense,
  onNavigateToWallets,
}) => {
  // Moneda de entrada del usuario ('VES' o 'USD')
  const [inputCurrency, setInputCurrency] = useState<CurrencyCode>('VES');
  const [amountStr, setAmountStr] = useState<string>('500');

  // Billetera seleccionada ('custom' o ID de wallet)
  // Intentamos preseleccionar la primera billetera en VES que esté activa
  const personalActiveWallets = useMemo(
    () =>
      wallets.filter(
        (w) =>
          w.active && !w.isThirdPartyExpenseAccount && !w.isPassThroughAccount
      ),
    [wallets]
  );

  const vesWallets = useMemo(
    () => personalActiveWallets.filter((w) => w.currency === 'VES'),
    [personalActiveWallets]
  );
  const [selectedWalletId, setSelectedWalletId] = useState<string>(() => {
    return vesWallets[0]?.id || personalActiveWallets[0]?.id || 'custom';
  });

  // Modo de visualización: comparativa lado a lado, solo pago móvil o solo transferencia
  const [viewMode, setViewMode] = useState<CalcViewMode>('comparison');

  // ¿Transferencia interbancaria (a otro banco)?
  const [isInterbank, setIsInterbank] = useState<boolean>(true);

  // Permitir personalizar tasas de comisión manualmente si el usuario lo desea
  const [customRatesOpen, setCustomRatesOpen] = useState<boolean>(false);
  const [customPagoMovilPctStr, setCustomPagoMovilPctStr] = useState<string>('');
  const [customTransferenciaPctStr, setCustomTransferenciaPctStr] =
    useState<string>('');

  // Tasa de cambio efectiva para conversiones referenciales
  const activeExchangeRate = useMemo(() => {
    if (officialRate && officialRate > 0) return officialRate;
    if (defaultManualRate && defaultManualRate > 0) return defaultManualRate;
    return 75.0; // Fallback razonable si no hay tasa registrada
  }, [officialRate, defaultManualRate]);

  // Billetera actualmente elegida
  const currentWallet = useMemo(() => {
    if (selectedWalletId === 'custom') return null;
    return wallets.find((w) => w.id === selectedWalletId) || null;
  }, [wallets, selectedWalletId]);

  // Resumen de saldo de la billetera elegida
  const currentWalletSummary = useMemo(() => {
    if (!currentWallet) return null;
    return walletSummaries.find((s) => s.wallet.id === currentWallet.id) || null;
  }, [currentWallet, walletSummaries]);

  // Saldo disponible en Bolívares de la cuenta seleccionada
  const walletBalanceBs = useMemo(() => {
    if (!currentWallet) return null;
    if (currentWalletSummary && Number.isFinite(currentWalletSummary.saldoActualVes)) {
      return Math.max(0, currentWalletSummary.saldoActualVes);
    }
    if (currentWallet.currency === 'VES' && currentWallet.initialBalanceVes != null) {
      return Math.max(0, currentWallet.initialBalanceVes);
    }
    const balanceUsd = currentWalletSummary
      ? currentWalletSummary.saldoActualUsd
      : currentWallet.initialBalanceUsd;
    return Math.max(0, balanceUsd * activeExchangeRate);
  }, [currentWallet, currentWalletSummary, activeExchangeRate]);

  // Porcentajes de comisión efectivos
  const effectivePagoMovilPct = useMemo(() => {
    if (!isInterbank) return 0;
    if (customPagoMovilPctStr.trim()) {
      const parsed = Number(customPagoMovilPctStr.replace(',', '.'));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    if (currentWallet?.comisionPagoMovil != null) {
      return currentWallet.comisionPagoMovil;
    }
    return 0.3; // 0.30% estándar interbancario en Venezuela
  }, [isInterbank, customPagoMovilPctStr, currentWallet]);

  const effectiveTransferenciaPct = useMemo(() => {
    if (!isInterbank) return 0;
    if (customTransferenciaPctStr.trim()) {
      const parsed = Number(customTransferenciaPctStr.replace(',', '.'));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    if (currentWallet?.comisionTransferencia != null) {
      return currentWallet.comisionTransferencia;
    }
    return 0.12; // 0.12% estándar interbancario en Venezuela
  }, [isInterbank, customTransferenciaPctStr, currentWallet]);

  // Monto numérico introducido
  const parsedRawAmount = useMemo(() => {
    const cleaned = amountStr.replace(/\s+/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountStr]);

  // Monto base en Bolívares (VES)
  const baseAmountBs = useMemo(() => {
    if (parsedRawAmount <= 0) return 0;
    if (inputCurrency === 'VES') return parsedRawAmount;
    // Si ingresó en USD, convertir a Bs con la tasa activa
    return parsedRawAmount * activeExchangeRate;
  }, [parsedRawAmount, inputCurrency, activeExchangeRate]);

  // Monto base en Dólares (USD)
  const baseAmountUsd = useMemo(() => {
    if (parsedRawAmount <= 0) return 0;
    if (inputCurrency === 'USD') return parsedRawAmount;
    return activeExchangeRate > 0 ? parsedRawAmount / activeExchangeRate : 0;
  }, [parsedRawAmount, inputCurrency, activeExchangeRate]);

  // Cálculos para Pago Móvil (SIEMPRE cobra comisión: 0.30% con piso mínimo de 14 Bs, incluso al mismo banco)
  const calcPagoMovil = useMemo(() => {
    let feeBs = 0;
    let rawFeeBs = 0;
    let appliesMinimum = false;

    // Regla de Pago Móvil: SIEMPRE se cobra comisión sin importar si es del mismo banco.
    // Tasa 0.30%, pero si es menor a 14 Bs, la comisión es 14 Bs.
    if (baseAmountBs > 0) {
      rawFeeBs = (baseAmountBs * effectivePagoMovilPct) / 100;
      if (rawFeeBs < 14) {
        feeBs = 14;
        appliesMinimum = true;
      } else {
        feeBs = rawFeeBs;
      }
    }

    const totalBs = baseAmountBs + feeBs;
    const feeUsd = activeExchangeRate > 0 ? feeBs / activeExchangeRate : 0;
    const totalUsd = activeExchangeRate > 0 ? totalBs / activeExchangeRate : 0;

    let balanceStatus: 'sufficient' | 'fee_shortfall' | 'insufficient' | 'no_wallet' =
      'no_wallet';
    let remainingBs: number | null = null;
    let shortfallBs: number | null = null;

    if (walletBalanceBs != null) {
      if (walletBalanceBs >= totalBs) {
        balanceStatus = 'sufficient';
        remainingBs = walletBalanceBs - totalBs;
      } else if (walletBalanceBs >= baseAmountBs) {
        balanceStatus = 'fee_shortfall';
        shortfallBs = totalBs - walletBalanceBs;
      } else {
        balanceStatus = 'insufficient';
        shortfallBs = totalBs - walletBalanceBs;
      }
    }

    return {
      feePct: effectivePagoMovilPct,
      rawFeeBs,
      feeBs,
      feeUsd,
      appliesMinimum,
      totalBs,
      totalUsd,
      balanceStatus,
      remainingBs,
      shortfallBs,
    };
  }, [
    baseAmountBs,
    effectivePagoMovilPct,
    activeExchangeRate,
    walletBalanceBs,
  ]);

  // Cálculos para Transferencia Bancaria (Mismo banco = 0 Bs; A otros bancos = 54 Bs fijos sin %)
  const calcTransferencia = useMemo(() => {
    let feeBs = 0;
    let appliesMinimum = false;

    // Regla de Transferencias: 54 Bs fijos para todas sin % si es a otros bancos.
    // Si es al mismo banco (!isInterbank), no cobran nada (0 Bs).
    if (isInterbank && baseAmountBs > 0) {
      feeBs = 54;
      appliesMinimum = true;
    } else {
      feeBs = 0;
    }

    const totalBs = baseAmountBs + feeBs;
    const feeUsd = activeExchangeRate > 0 ? feeBs / activeExchangeRate : 0;
    const totalUsd = activeExchangeRate > 0 ? totalBs / activeExchangeRate : 0;

    let balanceStatus: 'sufficient' | 'fee_shortfall' | 'insufficient' | 'no_wallet' =
      'no_wallet';
    let remainingBs: number | null = null;
    let shortfallBs: number | null = null;

    if (walletBalanceBs != null) {
      if (walletBalanceBs >= totalBs) {
        balanceStatus = 'sufficient';
        remainingBs = walletBalanceBs - totalBs;
      } else if (walletBalanceBs >= baseAmountBs) {
        balanceStatus = 'fee_shortfall';
        shortfallBs = totalBs - walletBalanceBs;
      } else {
        balanceStatus = 'insufficient';
        shortfallBs = totalBs - walletBalanceBs;
      }
    }

    return {
      feePct: isInterbank ? 0 : 0,
      rawFeeBs: feeBs,
      feeBs,
      feeUsd,
      appliesMinimum,
      totalBs,
      totalUsd,
      balanceStatus,
      remainingBs,
      shortfallBs,
    };
  }, [
    baseAmountBs,
    isInterbank,
    activeExchangeRate,
    walletBalanceBs,
  ]);

  // Diferencia y ahorro entre Transferencia y Pago Móvil
  const comparisonDiff = useMemo(() => {
    const diffBs = calcPagoMovil.feeBs - calcTransferencia.feeBs;
    const diffUsd = calcPagoMovil.feeUsd - calcTransferencia.feeUsd;
    const pagoMovilAhorra = calcPagoMovil.feeBs < calcTransferencia.feeBs - 0.001;
    const transferenciaAhorra = calcTransferencia.feeBs < calcPagoMovil.feeBs - 0.001;
    const ahorroBs = Math.abs(diffBs);
    const ahorroUsd = Math.abs(diffUsd);

    return {
      diffBs,
      diffUsd,
      ahorroBs,
      ahorroUsd,
      pagoMovilAhorra,
      transferenciaAhorra,
      iguales: Math.abs(diffBs) < 0.001,
    };
  }, [calcPagoMovil, calcTransferencia]);

  // Estado para feedback de copia al portapapeles
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleCopySummary = (type: 'pago_movil' | 'transferencia' | 'both') => {
    let text = '';
    const bankName = currentWallet?.banco || currentWallet?.name || 'Banco de Venezuela';

    if (type === 'pago_movil') {
      const feeDetail = calcPagoMovil.appliesMinimum
        ? `${formatearMonto(14, 'VES', locale)} (Piso mínimo de 14 Bs aplicado)`
        : `${formatearMonto(calcPagoMovil.feeBs, 'VES', locale)} (${calcPagoMovil.feePct}%)`;
      text = `Simulación de Pago Móvil:
- Monto a enviar: ${formatearMonto(baseAmountBs, 'VES', locale)}
- Comisión bancaria: ${feeDetail} (Pago Móvil siempre cobra comisión)
- TOTAL A DEBITAR: ${formatearMonto(calcPagoMovil.totalBs, 'VES', locale)}
- Cuenta: ${bankName}`;
    } else if (type === 'transferencia') {
      const feeDetail = !isInterbank
        ? '0,00 Bs (Mismo banco no cobran)'
        : '54,00 Bs (Tarifa fija interbancaria sin %)';
      text = `Simulación de Transferencia:
- Monto a enviar: ${formatearMonto(baseAmountBs, 'VES', locale)}
- Comisión bancaria: ${feeDetail}
- TOTAL A DEBITAR: ${formatearMonto(calcTransferencia.totalBs, 'VES', locale)}
- Cuenta: ${bankName}`;
    } else {
      let advice = '';
      if (!isInterbank) {
        advice = `💡 Al ser transferencia al mismo banco es gratis (0,00 Bs), mientras que Pago Móvil siempre cobra comisión (${formatearMonto(calcPagoMovil.feeBs, 'VES', locale)}).`;
      } else if (comparisonDiff.pagoMovilAhorra) {
        advice = `💡 A otro banco te conviene Pago Móvil: pagas ${formatearMonto(calcPagoMovil.feeBs, 'VES', locale)} y ahorras ${formatearMonto(comparisonDiff.ahorroBs, 'VES', locale)} frente a la transferencia (tarifa fija de 54 Bs).`;
      } else if (comparisonDiff.transferenciaAhorra) {
        advice = `💡 A otro banco te conviene Transferencia: pagas 54 Bs fijos y ahorras ${formatearMonto(comparisonDiff.ahorroBs, 'VES', locale)} frente al 0.30% de Pago Móvil.`;
      }

      text = `Comparativa de Pagos en Bs:
Monto: ${formatearMonto(baseAmountBs, 'VES', locale)} (${isInterbank ? 'A otro banco' : 'Mismo banco'})
• Pago Móvil: Total ${formatearMonto(calcPagoMovil.totalBs, 'VES', locale)} (Comisión: ${formatearMonto(calcPagoMovil.feeBs, 'VES', locale)}${calcPagoMovil.appliesMinimum ? ' [piso mínimo 14 Bs]' : ''})
• Transferencia: Total ${formatearMonto(calcTransferencia.totalBs, 'VES', locale)} (Comisión: ${!isInterbank ? '0,00 Bs [mismo banco]' : '54,00 Bs [tarifa fija]'})
${advice}`;
    }

    navigator.clipboard?.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleRegisterExpenseAction = (type: 'pago_movil' | 'transferencia') => {
    if (!onRegisterExpense) return;
    const feeObj = type === 'pago_movil' ? calcPagoMovil : calcTransferencia;
    const methodName = type === 'pago_movil' ? 'Pago Móvil' : 'Transferencia';
    const bankName = currentWallet?.banco || currentWallet?.name || 'Otro Banco';
    const feeDetail = type === 'pago_movil'
      ? (feeObj.appliesMinimum ? 'piso mínimo bancario 14 Bs' : `${feeObj.feePct}%`)
      : (isInterbank ? 'tarifa fija interbancaria 54 Bs' : 'mismo banco 0 Bs');

    onRegisterExpense({
      description: `${methodName} a ${bankName}`,
      amount: Number(baseAmountBs.toFixed(2)),
      currency: 'VES',
      walletId: currentWallet?.id || undefined,
      isInterbankTransfer: type === 'pago_movil' ? true : isInterbank,
      interbankFeeType: type,
      paymentMethod: methodName,
      notes: `Simulado en Calculadora Rápida: Monto ${formatearMonto(baseAmountBs, 'VES', locale)} + Comisión ${formatearMonto(feeObj.feeBs, 'VES', locale)} (${feeDetail}). Total debitado: ${formatearMonto(feeObj.totalBs, 'VES', locale)}`,
    });
  };

  return (
    <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center shrink-0 shadow-sm">
              <Calculator className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold font-editorial text-[var(--text-primary)]">
              Calculadora Rápida de Comisiones: Pago Móvil vs Transferencia
            </h3>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-[var(--lavender-soft)] text-[var(--lavender-text)]">
              Simulador Bancario
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
            Calcula en tiempo real cuánto te cobrará tu banco por comisión y el{' '}
            <strong>total exacto que gastarás</strong> antes de ejecutar la transacción, verificando si tu cuenta tiene saldo suficiente.
          </p>
        </div>

        {/* Selector de modo de vista */}
        <div className="flex items-center bg-[var(--surface-subtle)] p-1 rounded-xl border border-[var(--border-hairline)] shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('comparison')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'comparison'
                ? 'bg-[var(--surface)] text-[var(--pink-primary)] font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Comparar ambos</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pago_movil')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'pago_movil'
                ? 'bg-[var(--surface)] text-[var(--pink-primary)] font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Pago Móvil</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('transferencia')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'transferencia'
                ? 'bg-[var(--surface)] text-[var(--pink-primary)] font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Transferencia</span>
          </button>
        </div>
      </div>

      {/* Controles de Entrada */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Columna 1: Monto y Moneda (7 cols) */}
        <div className="lg:col-span-7 space-y-4 p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Monto a pagar o transferir
            </label>
            {/* Toggle de Moneda de entrada */}
            <div className="flex items-center bg-[var(--surface)] p-0.5 rounded-lg border border-[var(--border-hairline)] text-xs">
              <button
                type="button"
                onClick={() => {
                  if (inputCurrency !== 'VES') {
                    setInputCurrency('VES');
                    if (baseAmountBs > 0) setAmountStr(baseAmountBs.toFixed(2));
                  }
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  inputCurrency === 'VES'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                En Bolívares (Bs)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (inputCurrency !== 'USD') {
                    setInputCurrency('USD');
                    if (baseAmountUsd > 0) setAmountStr(baseAmountUsd.toFixed(2));
                  }
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  inputCurrency === 'USD'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                En Dólares ($)
              </button>
            </div>
          </div>

          {/* Input principal del monto */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono-tabular font-bold text-lg text-[var(--text-secondary)]">
              {inputCurrency === 'VES' ? 'Bs' : '$'}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0,00"
              className="w-full pl-12 pr-12 py-3.5 text-2xl font-bold font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)] focus:ring-2 focus:ring-[var(--pink-primary)]/20 transition-all"
            />
            {amountStr && (
              <button
                type="button"
                onClick={() => setAmountStr('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-md"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Referencia de conversión cambiaria en vivo */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)] px-1">
            <div>
              {inputCurrency === 'VES' ? (
                <span>
                  Equivale a{' '}
                  <strong className="font-mono-tabular text-[var(--pink-primary)] font-semibold">
                    ~{formatearMonto(baseAmountUsd, 'USD', locale)} USD
                  </strong>{' '}
                  a tasa activa ({formatearTasa(activeExchangeRate, locale)} Bs/$)
                </span>
              ) : (
                <span>
                  Equivale a{' '}
                  <strong className="font-mono-tabular text-[var(--pink-primary)] font-semibold">
                    ~{formatearMonto(baseAmountBs, 'VES', locale)}
                  </strong>{' '}
                  a tasa activa ({formatearTasa(activeExchangeRate, locale)} Bs/$)
                </span>
              )}
            </div>

            {/* Chips rápidos de montos */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(inputCurrency === 'VES'
                ? [100, 500, 1000, 2500, 5000]
                : [5, 10, 20, 50, 100]
              ).map((chipVal) => (
                <button
                  key={chipVal}
                  type="button"
                  onClick={() => setAmountStr(String(chipVal))}
                  className="px-2 py-0.5 text-[11px] font-mono-tabular font-medium rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
                >
                  +{chipVal}
                </button>
              ))}
              {walletBalanceBs != null && walletBalanceBs > 0 && inputCurrency === 'VES' && (
                <button
                  type="button"
                  onClick={() => {
                    // Usar todo el saldo disponible para pagar
                    setAmountStr(walletBalanceBs.toFixed(2));
                  }}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-[var(--pink-light)] text-[var(--pink-primary)] font-semibold hover:bg-[var(--pink-primary)] hover:text-white transition-colors"
                >
                  Todo mi saldo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Columna 2: Selección de Cuenta y Parámetros (5 cols) */}
        <div className="lg:col-span-5 space-y-4 p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Cuenta o Billetera en Bs
              </label>
              {onNavigateToWallets && (
                <button
                  type="button"
                  onClick={onNavigateToWallets}
                  className="text-[11px] font-medium text-[var(--pink-primary)] hover:underline"
                >
                  Ajustar comisiones →
                </button>
              )}
            </div>

            <select
              value={selectedWalletId}
              onChange={(e) => setSelectedWalletId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-medium focus:outline-none focus:border-[var(--pink-primary)]"
            >
              <optgroup label="Tus Cuentas en Bolívares (VES)">
                {vesWallets.map((w) => {
                  const summary = walletSummaries.find((s) => s.wallet.id === w.id);
                  const balBs = summary
                    ? Math.max(0, summary.saldoActualVes)
                    : w.initialBalanceVes != null
                      ? Math.max(0, w.initialBalanceVes)
                      : Math.max(0, w.initialBalanceUsd * activeExchangeRate);
                  return (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.banco ? `(${w.banco})` : ''} — Saldo: {formatearMonto(balBs, 'VES', locale)}
                    </option>
                  );
                })}
              </optgroup>

              {personalActiveWallets.some((w) => w.currency !== 'VES') && (
                <optgroup label="Otras Billeteras Personales (USD)">
                  {personalActiveWallets
                    .filter((w) => w.currency !== 'VES')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} (USD)
                      </option>
                    ))}
                </optgroup>
              )}

              <option value="custom">⚙️ Simular sin cuenta (Banco genérico)</option>
            </select>

            {/* Badge de Saldo Disponible de la cuenta seleccionada */}
            {currentWallet && walletBalanceBs != null && (
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: currentWallet.color }}
                  />
                  <span className="font-medium text-[var(--text-primary)]">
                    Saldo disponible:
                  </span>
                </div>
                <div className="text-right font-mono-tabular">
                  <span className="font-bold text-[var(--text-primary)]">
                    {formatearMonto(walletBalanceBs, 'VES', locale)}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] ml-1.5">
                    (~{formatearMonto(currentWalletSummary ? currentWalletSummary.saldoActualUsd : currentWallet.initialBalanceUsd, 'USD', locale)})
                  </span>
                </div>
              </div>
            )}

            {/* Checkbox: Pago a otro banco vs mismo banco */}
            <div className="pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  checked={isInterbank}
                  onChange={(e) => setIsInterbank(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border-hairline)] text-[var(--pink-primary)] accent-[var(--pink-primary)] cursor-pointer"
                />
                <span>¿Es pago interbancario (a otro banco)?</span>
              </label>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 ml-6">
                {isInterbank
                  ? 'Aplica comisión bancaria: Pago Móvil 0.30% (mínimo 14 Bs) / Transferencia a otros bancos (mínimo fijo 54 Bs).'
                  : 'Si es al mismo banco (ej. Banesco a Banesco o BDV a BDV), la comisión es 0,00 Bs (no cobran).'}
              </p>
            </div>
          </div>

          {/* Desplegable para afinar tasas de comisión */}
          <div className="pt-2 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setCustomRatesOpen(!customRatesOpen)}
              className="text-[11px] font-medium text-[var(--pink-primary)] hover:underline flex items-center gap-1"
            >
              <span>{customRatesOpen ? '▼ Ocultar' : '▶ Ajustar porcentajes de comisión'}</span>
            </button>

            {customRatesOpen && (
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    % Pago Móvil (Piso mín. 14 Bs)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customPagoMovilPctStr}
                    onChange={(e) => setCustomPagoMovilPctStr(e.target.value)}
                    placeholder={String(currentWallet?.comisionPagoMovil ?? 0.3)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono-tabular rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Transferencia a otros bancos
                  </label>
                  <div className="px-2.5 py-1.5 text-xs font-mono-tabular rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-medium">
                    54,00 Bs tarifa fija (sin %)
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RESULTADOS Y COMPARATIVA */}
      {baseAmountBs <= 0 ? (
        <div className="p-8 text-center rounded-2xl bg-[var(--surface-subtle)] border border-dashed border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
          Introduce un monto mayor a cero para calcular inmediatamente las comisiones bancarias y verificar si te alcanza el saldo.
        </div>
      ) : (
        <div className="space-y-4">
          {/* BANNER DE COMPARATIVA / RESUMEN INTELIGENTE */}
          {viewMode === 'comparison' && (
            <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-[var(--income-bg)] text-[var(--income-color)] flex items-center justify-center shrink-0 shadow-xs">
                  <TrendingDown className="w-4 h-4" />
                </span>
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">
                    Diagnóstico de Ahorro:
                  </span>{' '}
                  {!isInterbank ? (
                    <span className="text-[var(--text-primary)]">
                      Para operaciones al <strong>mismo banco</strong> te conviene{' '}
                      <strong className="text-blue-600 dark:text-blue-400 font-semibold">Transferencia bancaria</strong>: ¡no cobran nada (<strong>0,00 Bs</strong>)! Ahorras{' '}
                      <strong className="text-[var(--income-color)] font-mono-tabular font-bold">
                        {formatearMonto(comparisonDiff.ahorroBs, 'VES', locale)}
                      </strong>{' '}
                      (~{formatearMonto(comparisonDiff.ahorroUsd, 'USD', locale)}) frente a Pago Móvil (que siempre cobra comisión: {formatearMonto(calcPagoMovil.feeBs, 'VES', locale)}).
                    </span>
                  ) : comparisonDiff.pagoMovilAhorra ? (
                    <span className="text-[var(--text-primary)]">
                      Para este monto de <strong>{formatearMonto(baseAmountBs, 'VES', locale)}</strong> te conviene{' '}
                      <strong className="text-[var(--pink-primary)] font-semibold">Pago Móvil</strong>: pagas{' '}
                      <strong>{formatearMonto(calcPagoMovil.feeBs, 'VES', locale)}</strong>{' '}
                      {calcPagoMovil.appliesMinimum && '(piso mínimo de 14 Bs)'} y ahorras{' '}
                      <strong className="text-[var(--income-color)] font-mono-tabular font-bold">
                        {formatearMonto(comparisonDiff.ahorroBs, 'VES', locale)}
                      </strong>{' '}
                      (~{formatearMonto(comparisonDiff.ahorroUsd, 'USD', locale)}) frente a la transferencia (tarifa fija de 54 Bs).
                    </span>
                  ) : comparisonDiff.transferenciaAhorra ? (
                    <span className="text-[var(--text-primary)]">
                      Para este monto de <strong>{formatearMonto(baseAmountBs, 'VES', locale)}</strong> te conviene{' '}
                      <strong className="text-blue-600 dark:text-blue-400 font-semibold">Transferencia bancaria</strong>: pagas la tarifa fija de <strong>54,00 Bs</strong> y ahorras{' '}
                      <strong className="text-[var(--income-color)] font-mono-tabular font-bold">
                        {formatearMonto(comparisonDiff.ahorroBs, 'VES', locale)}
                      </strong>{' '}
                      (~{formatearMonto(comparisonDiff.ahorroUsd, 'USD', locale)}) frente al 0.30% de Pago Móvil ({formatearMonto(calcPagoMovil.feeBs, 'VES', locale)}).
                    </span>
                  ) : (
                    <span className="text-[var(--text-primary)]">
                      Ambas opciones tienen exactamente el mismo costo de comisión ({formatearMonto(calcPagoMovil.feeBs, 'VES', locale)}).
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopySummary('both')}
                className="self-end sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] transition-colors shrink-0"
              >
                {copiedType === 'both' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span>Copiar comparativa</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TARJETAS DE RESULTADOS */}
          <div
            className={`grid gap-5 ${
              viewMode === 'comparison'
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 max-w-xl mx-auto'
            }`}
          >
            {/* TARJETA 1: PAGO MÓVIL */}
            {(viewMode === 'comparison' || viewMode === 'pago_movil') && (
              <div
                className={`p-6 rounded-2xl border-2 transition-all space-y-5 flex flex-col justify-between ${
                  calcPagoMovil.balanceStatus === 'sufficient'
                    ? 'bg-[var(--surface)] border-[var(--pink-primary)]/40 shadow-sm'
                    : calcPagoMovil.balanceStatus === 'fee_shortfall'
                      ? 'bg-[var(--surface)] border-amber-500/50 shadow-sm'
                      : calcPagoMovil.balanceStatus === 'insufficient'
                        ? 'bg-[var(--surface)] border-rose-500/50 shadow-sm'
                        : 'bg-[var(--surface)] border-[var(--border-hairline)]'
                }`}
              >
                <div className="space-y-4">
                  {/* Encabezado de la opción */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center font-bold">
                        <Smartphone className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <span>Pago Móvil</span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--lavender-soft)] text-[var(--lavender-text)]">
                            Inmediato 24/7
                          </span>
                        </h4>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {calcPagoMovil.appliesMinimum ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Piso mínimo aplicado: 14,00 Bs (0.30% calculaba menos de 14 Bs)
                            </span>
                          ) : (
                            <span>Comisión bancaria: <strong>{calcPagoMovil.feePct}%</strong> (supera piso de 14 Bs)</span>
                          )}
                          <span className="block text-[10px] text-[var(--text-secondary)] mt-0.5">
                            Pago Móvil siempre cobra comisión (incluso mismo banco)
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySummary('pago_movil')}
                      title="Copiar desglose de Pago Móvil"
                      className="p-2 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {copiedType === 'pago_movil' ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Desglose Numérico */}
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                      <span>Monto base a transferir:</span>
                      <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                        {formatearMonto(baseAmountBs, 'VES', locale)}
                        <span className="text-[11px] text-[var(--text-secondary)] ml-1">
                          (~{formatearMonto(baseAmountUsd, 'USD', locale)})
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                      <div>
                        <span>Comisión bancaria:</span>
                        {calcPagoMovil.appliesMinimum ? (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Piso mínimo de 14 Bs (0.30% = {formatearMonto(calcPagoMovil.rawFeeBs, 'VES', locale)})
                          </span>
                        ) : (
                          <span className="block text-[10px] text-[var(--text-secondary)]">
                            0.30% aplicado ({formatearMonto(calcPagoMovil.feeBs, 'VES', locale)})
                          </span>
                        )}
                        <span className="block text-[10px] text-[var(--text-secondary)] opacity-85">
                          Siempre se cobra comisión ({isInterbank ? 'Interbancario' : 'Mismo banco'})
                        </span>
                      </div>
                      <span className="font-mono-tabular font-semibold text-[var(--expense-color)] text-right">
                        +{formatearMonto(calcPagoMovil.feeBs, 'VES', locale)}
                        <span className="text-[11px] text-[var(--text-secondary)] ml-1 block sm:inline">
                          (~{formatearMonto(calcPagoMovil.feeUsd, 'USD', locale)})
                        </span>
                      </span>
                    </div>

                    {/* Línea divisoria y TOTAL QUE GASTARÁS */}
                    <div className="pt-2 border-t border-[var(--border-hairline)] flex items-baseline justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        Total a gastar:
                      </span>
                      <div className="text-right">
                        <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--pink-primary)]">
                          {formatearMonto(calcPagoMovil.totalBs, 'VES', locale)}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                          ~{formatearMonto(calcPagoMovil.totalUsd, 'USD', locale)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Diagnóstico de Saldo en la Cuenta */}
                  {currentWallet && (
                    <div>
                      {calcPagoMovil.balanceStatus === 'sufficient' && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold">¡Saldo suficiente para pagar!</p>
                            <p className="text-[11px] opacity-90">
                              Te quedarán{' '}
                              <strong className="font-mono-tabular">
                                {formatearMonto(calcPagoMovil.remainingBs || 0, 'VES', locale)}
                              </strong>{' '}
                              en tu cuenta tras debitar el monto y la comisión.
                            </p>
                          </div>
                        </div>
                      )}

                      {calcPagoMovil.balanceStatus === 'fee_shortfall' && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold">
                              ¡Atención! Te alcanza para el monto, pero NO para la comisión
                            </p>
                            <p className="text-[11px] opacity-90">
                              Tienes los Bs para la transferencia, pero te faltan{' '}
                              <strong className="font-mono-tabular">
                                {formatearMonto(calcPagoMovil.shortfallBs || 0, 'VES', locale)}
                              </strong>{' '}
                              para cubrir la comisión del banco. El banco rechazará el débito.
                            </p>
                          </div>
                        </div>
                      )}

                      {calcPagoMovil.balanceStatus === 'insufficient' && (
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold">Saldo insuficiente en la cuenta</p>
                            <p className="text-[11px] opacity-90">
                              Te faltan{' '}
                              <strong className="font-mono-tabular">
                                {formatearMonto(calcPagoMovil.shortfallBs || 0, 'VES', locale)}
                              </strong>{' '}
                              para poder realizar este Pago Móvil con su comisión incluida.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón de Acción Directa */}
                {onRegisterExpense && (
                  <button
                    type="button"
                    onClick={() => handleRegisterExpenseAction('pago_movil')}
                    className="w-full mt-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] text-white shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <span>Registrar egreso como Pago Móvil</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* TARJETA 2: TRANSFERENCIA BANCARIA */}
            {(viewMode === 'comparison' || viewMode === 'transferencia') && (
              <div
                className={`p-6 rounded-2xl border-2 transition-all space-y-5 flex flex-col justify-between ${
                  calcTransferencia.balanceStatus === 'sufficient'
                    ? 'bg-[var(--surface)] border-blue-500/40 shadow-sm'
                    : calcTransferencia.balanceStatus === 'fee_shortfall'
                      ? 'bg-[var(--surface)] border-amber-500/50 shadow-sm'
                      : calcTransferencia.balanceStatus === 'insufficient'
                        ? 'bg-[var(--surface)] border-rose-500/50 shadow-sm'
                        : 'bg-[var(--surface)] border-[var(--border-hairline)]'
                }`}
              >
                <div className="space-y-4">
                  {/* Encabezado de la opción */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                        <Landmark className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <span>Transferencia Bancaria</span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400">
                            {isInterbank ? 'Tarifa fija 54 Bs' : 'Mismo banco (0 Bs)'}
                          </span>
                        </h4>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {isInterbank ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              Tarifa fija para todas a otros bancos: 54,00 Bs (sin %)
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Mismo banco: no cobran nada (0,00 Bs)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopySummary('transferencia')}
                      title="Copiar desglose de Transferencia"
                      className="p-2 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {copiedType === 'transferencia' ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Desglose Numérico */}
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                      <span>Monto base a transferir:</span>
                      <span className="font-mono-tabular font-medium text-[var(--text-primary)]">
                        {formatearMonto(baseAmountBs, 'VES', locale)}
                        <span className="text-[11px] text-[var(--text-secondary)] ml-1">
                          (~{formatearMonto(baseAmountUsd, 'USD', locale)})
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                      <div>
                        <span>Comisión bancaria:</span>
                        {isInterbank ? (
                          <span className="block text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            Tarifa fija a otros bancos: 54,00 Bs (sin %)
                          </span>
                        ) : (
                          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            Mismo banco: 0,00 Bs (No cobran nada)
                          </span>
                        )}
                      </div>
                      <span className="font-mono-tabular font-semibold text-[var(--expense-color)] text-right">
                        +{formatearMonto(calcTransferencia.feeBs, 'VES', locale)}
                        <span className="text-[11px] text-[var(--text-secondary)] ml-1 block sm:inline">
                          (~{formatearMonto(calcTransferencia.feeUsd, 'USD', locale)})
                        </span>
                      </span>
                    </div>

                    {/* Línea divisoria y TOTAL QUE GASTARÁS */}
                    <div className="pt-2 border-t border-[var(--border-hairline)] flex items-baseline justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        Total a gastar:
                      </span>
                      <div className="text-right">
                        <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-blue-600 dark:text-blue-400">
                          {formatearMonto(calcTransferencia.totalBs, 'VES', locale)}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                          ~{formatearMonto(calcTransferencia.totalUsd, 'USD', locale)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Diagnóstico de Saldo en la Cuenta */}
                  {currentWallet && (
                    <div>
                      {calcTransferencia.balanceStatus === 'sufficient' && (
                        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold">¡Saldo suficiente para pagar!</p>
                            <p className="text-[11px] opacity-90">
                              Te quedarán{' '}
                              <strong className="font-mono-tabular">
                                {formatearMonto(calcTransferencia.remainingBs || 0, 'VES', locale)}
                              </strong>{' '}
                              en tu cuenta tras debitar el monto y la comisión.
                            </p>
                          </div>
                        </div>
                      )}

                      {calcTransferencia.balanceStatus === 'fee_shortfall' && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold">
                              ¡Atención! Te alcanza para el monto, pero NO para la comisión
                            </p>
                            <p className="text-[11px] opacity-90">
                              Tienes los Bs para la transferencia, pero te faltan{' '}
                              <strong className="font-mono-tabular">
                                {formatearMonto(calcTransferencia.shortfallBs || 0, 'VES', locale)}
                              </strong>{' '}
                              para cubrir la comisión del banco. El banco rechazará el débito.
                            </p>
                          </div>
                        </div>
                      )}

                      {calcTransferencia.balanceStatus === 'insufficient' && (
                        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-semibold">Saldo insuficiente en la cuenta</p>
                            <p className="text-[11px] opacity-90">
                              Te faltan{' '}
                              <strong className="font-mono-tabular">
                                {formatearMonto(calcTransferencia.shortfallBs || 0, 'VES', locale)}
                              </strong>{' '}
                              para poder realizar esta Transferencia con su comisión incluida.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Botón de Acción Directa */}
                {onRegisterExpense && (
                  <button
                    type="button"
                    onClick={() => handleRegisterExpenseAction('transferencia')}
                    className="w-full mt-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    <span>Registrar egreso como Transferencia</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
