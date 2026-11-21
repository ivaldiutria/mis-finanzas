import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Info,
  Landmark,
  Layers,
  Percent,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppDataSchema,
  Category,
  CreditInstallment,
  CreditPurchase,
  CurrencyCode,
  ExchangeRateSource,
  InstallmentFrequency,
  MonthlyFinancialSummary,
  RateHistoryEntry,
  Transaction,
  WalletAccount,
} from '../types/finance';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { obtenerFechaLocalIso } from '../utils/calculations';
import { obtenerTasaPorFecha } from '../utils/historicalRatesImporter';
import {
  calcularResumenComprasACuotas,
  crearCompraACuotas,
  eliminarAbonoCuotaCompraEnAppData,
  eliminarCompraCreditoEnAppData,
  generarCronogramaCuotas,
  obtenerEstadoAbonosCuotaCompra,
  PayInstallmentInput,
  registrarPagoCuotaEnAppData,
  revertirPagoCuotaEnAppData,
  UpcomingInstallmentItem,
} from '../utils/installmentsController';

interface PayInstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: CreditPurchase | null;
  installment: CreditInstallment | null;
  wallets: WalletAccount[];
  officialRate: number | null;
  defaultManualRate: number | null;
  preferManualByDefault?: boolean;
  rateHistory?: RateHistoryEntry[];
  existingTransactions?: Transaction[];
  locale?: string;
  onConfirmPay: (
    purchaseId: string,
    installmentId: string,
    payment: PayInstallmentInput
  ) => void;
}

/**
 * MODAL DE PAGO O ABONO DE CUOTA:
 * Permite:
 * 1) Pagar la cuota completa (o el saldo restante) o hacer un ABONO PARCIAL.
 * 2) Marcar tanto la cuota completa como el abono parcial como "Ya se pagó antes"
 *    (sin descontar dinero de las billeteras) o debitarlo ahora de una billetera en USD o Bs.
 */
export const PayInstallmentModal: React.FC<PayInstallmentModalProps> = ({
  isOpen,
  onClose,
  purchase,
  installment,
  wallets,
  officialRate,
  defaultManualRate,
  preferManualByDefault = false,
  rateHistory = [],
  existingTransactions = [],
  locale = 'es-VE',
  onConfirmPay,
}) => {
  const activeWallets = useMemo(
    () => wallets.filter((w) => w.active && !w.isThirdPartyExpenseAccount),
    [wallets]
  );

  const [paidDate, setPaidDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [paymentMode, setPaymentMode] = useState<
    '1_cuota' | '2_cuotas' | '3_cuotas' | 'all_cuotas' | 'custom_amount'
  >('1_cuota');
  const [customInputCurrency, setCustomInputCurrency] = useState<'USD' | 'VES'>(
    'USD'
  );
  const [abonoAmountStr, setAbonoAmountStr] = useState<string>('');
  const [walletId, setWalletId] = useState<string>(
    () => activeWallets[0]?.id || 'wallet-usd-digital'
  );
  const [currency, setCurrency] = useState<CurrencyCode>('VES');
  const [rateSource, setRateSource] = useState<ExchangeRateSource>(() =>
    preferManualByDefault && defaultManualRate ? 'manual' : 'bcv'
  );
  const [customRateStr, setCustomRateStr] = useState<string>(() =>
    defaultManualRate ? String(defaultManualRate) : officialRate ? String(officialRate) : ''
  );
  const [matchedDateRate, setMatchedDateRate] = useState<number | null>(null);
  const [dateRateHint, setDateRateHint] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [alreadyPaidExternally, setAlreadyPaidExternally] =
    useState<boolean>(false);
  const [interbankFeeType, setInterbankFeeType] = useState<
    'none' | 'pago_movil' | 'transferencia'
  >('none');
  const [transferFeeMode, setTransferFeeMode] = useState<'fixed_ves' | 'percent'>(
    'fixed_ves'
  );
  const [feeValueStr, setFeeValueStr] = useState<string>('0.3');
  const [error, setError] = useState<string | null>(null);

  const selectedWalletObj = useMemo(
    () => activeWallets.find((w) => w.id === walletId),
    [activeWallets, walletId]
  );

  const handlePaidDateChange = (nextDate: string) => {
    setPaidDate(nextDate);
    const lookup = obtenerTasaPorFecha(
      nextDate,
      rateHistory,
      officialRate || defaultManualRate,
      existingTransactions
    );
    if (lookup.rate && lookup.rate > 0) {
      const rounded = Number(lookup.rate.toFixed(2));
      setMatchedDateRate(rounded);
      setCustomRateStr(String(rounded));
      setDateRateHint(
        lookup.exactMatch || lookup.matchedDate
          ? `${lookup.sourceLabel}: ${rounded.toFixed(2)} Bs/$`
          : null
      );
    } else {
      setMatchedDateRate(null);
      setDateRateHint(null);
    }
  };

  useEffect(() => {
    if (isOpen && installment) {
      setPaidDate(obtenerFechaLocalIso());
      setMatchedDateRate(null);
      setDateRateHint(null);
      setPaymentMode('1_cuota');
      setCustomInputCurrency('USD');
      setAbonoAmountStr('');
      setAlreadyPaidExternally(false);
      setInterbankFeeType('none');
      setNotes('');
      setError(null);
      const preferredW =
        activeWallets.find((w) => w.id === purchase?.initialPaymentWalletId) ||
        activeWallets.find((w) => w.currency === 'VES') ||
        activeWallets[0];
      if (preferredW) {
        setWalletId(preferredW.id);
        setCurrency(preferredW.currency);
      }
      if (officialRate && officialRate > 0 && !preferManualByDefault) {
        setRateSource('bcv');
        setCustomRateStr(String(officialRate));
      } else if (defaultManualRate && defaultManualRate > 0) {
        setCustomRateStr(String(defaultManualRate));
      }
    }
  }, [
    isOpen,
    installment?.id,
    purchase?.initialPaymentWalletId,
    activeWallets,
    officialRate,
    defaultManualRate,
    preferManualByDefault,
  ]);

  useEffect(() => {
    if (interbankFeeType === 'pago_movil') {
      const pmPct =
        selectedWalletObj?.comisionPagoMovil != null &&
        selectedWalletObj.comisionPagoMovil > 0
          ? selectedWalletObj.comisionPagoMovil
          : 0.3;
      setFeeValueStr(String(pmPct));
    } else if (interbankFeeType === 'transferencia') {
      const isBonus =
        Boolean(selectedWalletObj?.isBonusCard) ||
        (selectedWalletObj?.banco || '').toLowerCase().includes('todoticket') ||
        (selectedWalletObj?.name || '').toLowerCase().includes('todoticket');
      const mode =
        selectedWalletObj?.comisionTransferenciaTipo ||
        (isBonus ? 'percent' : 'fixed_ves');
      setTransferFeeMode(mode);
      const trVal =
        selectedWalletObj?.comisionTransferencia != null &&
        selectedWalletObj.comisionTransferencia > 0
          ? mode === 'fixed_ves' && selectedWalletObj.comisionTransferencia < 1
            ? 54
            : selectedWalletObj.comisionTransferencia
          : mode === 'percent'
            ? 1.5
            : 54;
      setFeeValueStr(String(trVal));
    }
  }, [interbankFeeType, selectedWalletObj]);

  if (!isOpen || !purchase || !installment) return null;

  const {
    paidUsd: prevPaidUsd,
    remainingUsd,
    hasPartialPayments,
  } = obtenerEstadoAbonosCuotaCompra(installment);

  // Lista ordenada de todas las cuotas pendientes comenzando por la seleccionada
  const orderedPendingInstallments = [
    installment,
    ...purchase.installments
      .filter((i) => i.status !== 'paid' && i.id !== installment.id)
      .sort((a, b) => a.number - b.number),
  ];

  const pendingInstallmentsWithBalances = orderedPendingInstallments
    .map((inst) => ({
      inst,
      state: obtenerEstadoAbonosCuotaCompra(inst),
    }))
    .filter((item) => item.state.remainingUsd > 0.001);

  const pendingCount = pendingInstallmentsWithBalances.length;
  const twoInstallmentsUsd =
    pendingCount >= 2
      ? Math.round(
          (pendingInstallmentsWithBalances[0].state.remainingUsd +
            pendingInstallmentsWithBalances[1].state.remainingUsd) *
            100
        ) / 100
      : remainingUsd;
  const threeInstallmentsUsd =
    pendingCount >= 3
      ? Math.round(
          (pendingInstallmentsWithBalances[0].state.remainingUsd +
            pendingInstallmentsWithBalances[1].state.remainingUsd +
            pendingInstallmentsWithBalances[2].state.remainingUsd) *
            100
        ) / 100
      : twoInstallmentsUsd;
  const totalPurchaseRemainingUsd =
    Math.round(
      pendingInstallmentsWithBalances.reduce(
        (acc, item) => acc + item.state.remainingUsd,
        0
      ) * 100
    ) / 100;

  const activeBcvOrDateRate = matchedDateRate || officialRate;
  const effectiveRate =
    currency === 'USD'
      ? null
      : rateSource === 'bcv' && activeBcvOrDateRate && activeBcvOrDateRate > 0
        ? activeBcvOrDateRate
        : Number(customRateStr.replace(',', '.')) || 0;

  const parsedCustomInput = Number(abonoAmountStr.replace(',', '.'));
  const parsedAbonoUsd =
    customInputCurrency === 'VES' &&
    effectiveRate &&
    effectiveRate > 0 &&
    Number.isFinite(parsedCustomInput)
      ? Math.round((parsedCustomInput / effectiveRate) * 100) / 100
      : parsedCustomInput;

  const effectivePayUsd =
    paymentMode === '1_cuota'
      ? remainingUsd
      : paymentMode === '2_cuotas'
        ? twoInstallmentsUsd
        : paymentMode === '3_cuotas'
          ? threeInstallmentsUsd
          : paymentMode === 'all_cuotas'
            ? totalPurchaseRemainingUsd
            : Number.isFinite(parsedAbonoUsd) && parsedAbonoUsd > 0
              ? Math.min(
                  totalPurchaseRemainingUsd,
                  Math.round(parsedAbonoUsd * 100) / 100
                )
              : 0;

  const remainingAfterThisPayUsd = Math.max(
    0,
    Math.round((totalPurchaseRemainingUsd - effectivePayUsd) * 100) / 100
  );

  // Simulación en tiempo real de cómo se distribuye este pago entre las cuotas pendientes
  const distributionPreview = (() => {
    const rows: {
      number: number;
      dueDate: string;
      allocatedUsd: number;
      completes: boolean;
      leftAfterUsd: number;
    }[] = [];
    let pool = effectivePayUsd;
    for (const item of pendingInstallmentsWithBalances) {
      if (pool <= 0.001) break;
      const slice = Math.round(Math.min(item.state.remainingUsd, pool) * 100) / 100;
      if (slice <= 0) continue;
      const completes = slice >= item.state.remainingUsd - 0.009;
      const effSlice = completes ? item.state.remainingUsd : slice;
      const leftAfter = completes
        ? 0
        : Math.max(
            0,
            Math.round((item.state.remainingUsd - effSlice) * 100) / 100
          );
      rows.push({
        number: item.inst.number,
        dueDate: item.inst.dueDate,
        allocatedUsd: effSlice,
        completes,
        leftAfterUsd: leftAfter,
      });
      pool = Math.max(0, Math.round((pool - effSlice) * 100) / 100);
    }
    return rows;
  })();

  const amountVesPreview =
    currency === 'VES' && effectiveRate && effectiveRate > 0 && effectivePayUsd > 0
      ? customInputCurrency === 'VES' &&
        paymentMode === 'custom_amount' &&
        Number.isFinite(parsedCustomInput) &&
        parsedCustomInput > 0 &&
        parsedAbonoUsd <= totalPurchaseRemainingUsd
        ? Number(parsedCustomInput.toFixed(2))
        : Number((effectivePayUsd * effectiveRate).toFixed(2))
      : 0;

  const basePaymentNominal =
    currency === 'VES' ? amountVesPreview : effectivePayUsd;

  const parsedFeeInput = Math.max(0, Number(feeValueStr.replace(',', '.')) || 0);
  const rawFeeNominal =
    !alreadyPaidExternally &&
    interbankFeeType !== 'none' &&
    basePaymentNominal > 0
      ? interbankFeeType === 'pago_movil'
        ? (basePaymentNominal * parsedFeeInput) / 100
        : transferFeeMode === 'percent'
          ? (basePaymentNominal * parsedFeeInput) / 100
          : parsedFeeInput
      : 0;

  const calculatedFeeNominal =
    !alreadyPaidExternally &&
    interbankFeeType !== 'none' &&
    basePaymentNominal > 0
      ? currency === 'VES' && interbankFeeType === 'pago_movil'
        ? Number(Math.max(14, rawFeeNominal).toFixed(2))
        : Number(rawFeeNominal.toFixed(2))
      : 0;

  const totalToDebitNominal = Number(
    (basePaymentNominal + calculatedFeeNominal).toFixed(2)
  );

  const handleWalletChange = (newWalletId: string) => {
    setWalletId(newWalletId);
    const selectedW = activeWallets.find((w) => w.id === newWalletId);
    if (selectedW) {
      setCurrency(selectedW.currency);
      if (selectedW.currency === 'USD') {
        setInterbankFeeType('none');
        setCustomInputCurrency('USD');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (paymentMode === 'custom_amount') {
      if (!Number.isFinite(parsedAbonoUsd) || parsedAbonoUsd <= 0) {
        setError('Ingresa un monto válido mayor a 0.');
        return;
      }
      if (parsedAbonoUsd > totalPurchaseRemainingUsd + 0.05) {
        setError(
          `El monto no puede superar la deuda total pendiente de esta compra (${formatearMonto(
            totalPurchaseRemainingUsd,
            'USD',
            locale
          )}).`
        );
        return;
      }
    }

    if (!alreadyPaidExternally) {
      if (!walletId) {
        setError('Selecciona una billetera para debitar el pago o abono.');
        return;
      }

      if (currency === 'VES' && (!effectiveRate || effectiveRate <= 0)) {
        setError(
          'Ingresa o actualiza una tasa de cambio válida (Bs/USD) para pagar en Bolívares.'
        );
        return;
      }
    }

    const isPartialSingle =
      effectivePayUsd < remainingUsd - 0.009;

    onConfirmPay(purchase.id, installment.id, {
      paidDate,
      isPartialPayment: isPartialSingle,
      abonoAmountUsd: effectivePayUsd,
      walletId,
      currency: alreadyPaidExternally ? 'USD' : currency,
      exchangeRate:
        !alreadyPaidExternally && currency === 'VES' ? effectiveRate : null,
      exchangeRateSource:
        !alreadyPaidExternally && currency === 'VES' ? rateSource : 'none',
      interbankFeeType: !alreadyPaidExternally ? interbankFeeType : 'none',
      interbankFeeAmount:
        !alreadyPaidExternally &&
        interbankFeeType !== 'none' &&
        calculatedFeeNominal > 0
          ? calculatedFeeNominal
          : 0,
      notes: notes.trim() || undefined,
      alreadyPaidExternally,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] border border-[var(--pink-primary)]/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                Abonar o Pagar Cuota #{installment.number}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {purchase.concept} · {purchase.storeOrPlatform}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-2xl bg-[var(--expense-bg)] text-[var(--expense-color)] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector rápido estilo Cashea: 1 cuota, 2 cuotas, Todas o Pagar otro monto */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                ¿Qué deseas pagar hoy?
              </span>
              <div className="inline-flex p-0.5 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setAlreadyPaidExternally(false)}
                  className={`py-1 px-2.5 text-[11px] font-bold rounded-lg transition-all ${
                    !alreadyPaidExternally
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Descontar hoy
                </button>
                <button
                  type="button"
                  onClick={() => setAlreadyPaidExternally(true)}
                  className={`py-1 px-2.5 text-[11px] font-bold rounded-lg transition-all ${
                    alreadyPaidExternally
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Ya pagada antes
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMode('1_cuota')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  paymentMode === '1_cuota'
                    ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] shadow-xs'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                }`}
              >
                <div className="text-[11px] font-bold">
                  1 Cuota (#{installment.number})
                </div>
                <div className="text-xs font-mono-tabular font-extrabold mt-0.5">
                  {formatearMonto(remainingUsd, 'USD', locale)}
                </div>
              </button>

              {pendingCount >= 2 && (
                <button
                  type="button"
                  onClick={() => setPaymentMode('2_cuotas')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    paymentMode === '2_cuotas'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] shadow-xs'
                      : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-bold">2 Cuotas</div>
                  <div className="text-xs font-mono-tabular font-extrabold mt-0.5">
                    {formatearMonto(twoInstallmentsUsd, 'USD', locale)}
                  </div>
                </button>
              )}

              {pendingCount > 2 && (
                <button
                  type="button"
                  onClick={() => setPaymentMode('all_cuotas')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    paymentMode === 'all_cuotas'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] shadow-xs'
                      : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-bold">
                    Todas ({pendingCount})
                  </div>
                  <div className="text-xs font-mono-tabular font-extrabold mt-0.5">
                    {formatearMonto(totalPurchaseRemainingUsd, 'USD', locale)}
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setPaymentMode('custom_amount');
                  if (!abonoAmountStr) {
                    setCustomInputCurrency('USD');
                    setAbonoAmountStr(remainingUsd.toFixed(2));
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  paymentMode === 'custom_amount'
                    ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] shadow-xs'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                }`}
              >
                <div className="text-[11px] font-bold">Otro monto</div>
                <div className="text-[11px] font-medium mt-0.5 opacity-90">
                  Abono o libre
                </div>
              </button>
            </div>
          </div>

          {/* 1. Fecha y Cuenta (Antes del monto para aplicar tasa de la fecha automáticamente) */}
          <div
            className={`grid grid-cols-1 ${
              alreadyPaidExternally ? '' : 'sm:grid-cols-2'
            } gap-3.5`}
          >
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Fecha de pago *
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => handlePaidDateChange(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
              {dateRateHint && (
                <p className="mt-1 text-[10px] font-semibold text-emerald-500">
                  ✓ {dateRateHint}
                </p>
              )}
            </div>

            {!alreadyPaidExternally && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  Cuenta de pago *
                </label>
                <select
                  value={walletId}
                  onChange={(e) => handleWalletChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.banco ? `(${w.banco})` : ''} · {w.currency}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2. Tarjeta de Monto a Pagar, Moneda, Tasa y Desglose por Cuota */}
          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--text-secondary)] block">
                  {paymentMode === 'custom_amount'
                    ? 'Monto personalizado a cancelar'
                    : paymentMode === 'all_cuotas'
                      ? `Liquidación total (${pendingCount} cuotas)`
                      : paymentMode === '2_cuotas'
                        ? 'Pago de 2 cuotas en 1 movimiento'
                        : hasPartialPayments
                          ? 'Saldo pendiente de la cuota'
                          : 'Monto de la cuota'}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Deuda total restante en esta compra:{' '}
                  <strong className="font-mono-tabular text-[var(--text-primary)]">
                    {formatearMonto(totalPurchaseRemainingUsd, 'USD', locale)}
                  </strong>
                </span>
              </div>

              {!alreadyPaidExternally && (
                <div className="inline-flex p-0.5 bg-[var(--surface)] border border-[var(--border-input)] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCurrency('VES')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      currency === 'VES'
                        ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Bolívares (Bs)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency('USD');
                      setCustomInputCurrency('USD');
                      setInterbankFeeType('none');
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      currency === 'USD'
                        ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    USD ($)
                  </button>
                </div>
              )}
            </div>

            {paymentMode === 'custom_amount' ? (
              <div className="space-y-2">
                {currency === 'VES' && !alreadyPaidExternally && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-secondary)]">
                      Escribir monto en:
                    </span>
                    <div className="inline-flex p-0.5 bg-[var(--surface)] rounded-lg border border-[var(--border-input)]">
                      <button
                        type="button"
                        onClick={() => {
                          if (customInputCurrency !== 'USD') {
                            setCustomInputCurrency('USD');
                            setAbonoAmountStr(effectivePayUsd.toFixed(2));
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          customInputCurrency === 'USD'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        Dólares ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            customInputCurrency !== 'VES' &&
                            effectiveRate &&
                            effectiveRate > 0
                          ) {
                            setCustomInputCurrency('VES');
                            setAbonoAmountStr(
                              (effectivePayUsd * effectiveRate).toFixed(2)
                            );
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          customInputCurrency === 'VES'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        Bolívares (Bs)
                      </button>
                    </div>
                  </div>
                )}

                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-base font-bold font-mono-tabular text-[var(--text-secondary)] select-none">
                    {customInputCurrency === 'VES' ? 'Bs' : '$'}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={abonoAmountStr}
                    onChange={(e) => setAbonoAmountStr(e.target.value)}
                    placeholder={
                      customInputCurrency === 'VES' && effectiveRate
                        ? `Ej: ${(remainingUsd * effectiveRate).toFixed(2)}`
                        : `Ej: ${remainingUsd.toFixed(2)}`
                    }
                    className="w-full pl-11 pr-4 py-2.5 text-xl font-mono-tabular font-bold rounded-2xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
                  />
                </div>

                {/* Atajos rápidos dentro de Otro monto */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-[var(--text-secondary)]">
                  <span>
                    Equivale a:{' '}
                    <strong className="font-mono-tabular text-[var(--text-primary)]">
                      {formatearMonto(effectivePayUsd, 'USD', locale)}
                    </strong>
                    {currency === 'VES' && amountVesPreview > 0
                      ? ` (${formatearMonto(amountVesPreview, 'VES', locale)})`
                      : ''}
                  </span>
                  <span>
                    Restará en compra:{' '}
                    <strong className="font-mono-tabular text-[var(--text-primary)]">
                      {formatearMonto(remainingAfterThisPayUsd, 'USD', locale)}
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-between">
                <span className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
                  {formatearMonto(effectivePayUsd, 'USD', locale)}
                </span>
                {!alreadyPaidExternally && currency === 'VES' && amountVesPreview > 0 && (
                  <span className="text-sm font-bold font-mono-tabular text-[var(--pink-primary)]">
                    ≈ {formatearMonto(amountVesPreview, 'VES', locale)}
                  </span>
                )}
              </div>
            )}

            {/* Desglose de aplicación del pago en las cuotas (1 solo movimiento bancario) */}
            {distributionPreview.length > 0 && (
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-[var(--text-primary)]">
                    Aplicación del pago ({distributionPreview.length}{' '}
                    {distributionPreview.length === 1 ? 'cuota' : 'cuotas'}):
                  </span>
                  {!alreadyPaidExternally && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      1 solo movimiento bancario
                    </span>
                  )}
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {distributionPreview.map((row) => (
                    <div
                      key={row.number}
                      className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-[var(--surface-subtle)]"
                    >
                      <span className="font-medium text-[var(--text-primary)]">
                        Cuota #{row.number}{' '}
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          (Vence {row.dueDate})
                        </span>
                      </span>
                      <div className="flex items-center gap-2 font-mono-tabular">
                        <span className="font-bold text-[var(--text-primary)]">
                          {formatearMonto(row.allocatedUsd, 'USD', locale)}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            row.completes
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {row.completes
                            ? 'Queda Pagada'
                            : `Abono (Resta ${formatearMonto(row.leftAfterUsd, 'USD', locale)})`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barra de Tasa cuando se paga en Bolívares (VES) */}
            {!alreadyPaidExternally && currency === 'VES' && (
              <div className="pt-2.5 border-t border-[var(--border-hairline)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <span>Tasa ({paidDate}):</span>
                    <div className="inline-flex items-center gap-1 bg-[var(--surface)] p-0.5 rounded-lg border border-[var(--border-input)]">
                      <button
                        type="button"
                        onClick={() => setRateSource('bcv')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          rateSource === 'bcv'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        BCV {activeBcvOrDateRate ? `(${formatearTasa(activeBcvOrDateRate, locale)})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRateSource('manual')}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          rateSource === 'manual'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  <span className="font-mono-tabular font-bold text-[var(--pink-primary)]">
                    {amountVesPreview > 0
                      ? formatearMonto(amountVesPreview, 'VES', locale)
                      : '—'}
                  </span>
                </div>

                {(rateSource === 'manual' || !activeBcvOrDateRate) && (
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-[var(--text-secondary)] shrink-0">
                      Tasa (Bs/$):
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customRateStr}
                      onChange={(e) => setCustomRateStr(e.target.value)}
                      placeholder="Ej: 65.50"
                      className="w-full px-2.5 py-1 text-xs font-mono-tabular rounded-lg bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Selector compacto de Comisión Bancaria */}
          {!alreadyPaidExternally && (
            <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-[var(--pink-primary)] shrink-0" />
                  <span>¿Aplica comisión bancaria?</span>
                </label>

                <div className="grid grid-cols-3 gap-1 p-0.5 bg-[var(--surface)] rounded-xl border border-[var(--border-input)]">
                  <button
                    type="button"
                    onClick={() => setInterbankFeeType('none')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      interbankFeeType === 'none'
                        ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] shadow-xs font-bold'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Sin comisión
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterbankFeeType('pago_movil')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      interbankFeeType === 'pago_movil'
                        ? 'bg-[var(--pink-primary)] text-white shadow-xs font-bold'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    📲 Pago Móvil
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterbankFeeType('transferencia')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      interbankFeeType === 'transferencia'
                        ? 'bg-[var(--pink-primary)] text-white shadow-xs font-bold'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    🏦 Transferencia
                  </button>
                </div>
              </div>

              {interbankFeeType !== 'none' && (
                <div className="pt-2.5 border-t border-[var(--border-divider)] space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                    <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] block">
                        Cuenta origen
                      </span>
                      <span className="font-bold text-[var(--text-primary)] truncate block">
                        {selectedWalletObj?.name} {selectedWalletObj?.banco ? `(${selectedWalletObj.banco})` : ''}
                      </span>
                    </div>

                    {interbankFeeType === 'pago_movil' ? (
                      <div>
                        <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1">
                          % Comisión Pago Móvil {currency === 'VES' ? '(Mín. 14 Bs)' : ''}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={feeValueStr}
                            onChange={(e) => setFeeValueStr(e.target.value)}
                            className="w-full px-3 py-1.5 pr-8 text-xs font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">
                            %
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-medium text-[var(--text-secondary)]">
                            Comisión Transferencia
                          </label>
                          <div className="inline-flex rounded-md bg-[var(--surface)] p-0.5 border border-[var(--border-input)] text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                setTransferFeeMode('fixed_ves');
                                if (Number(feeValueStr) < 5) setFeeValueStr('54');
                              }}
                              className={`px-1.5 py-0.5 rounded font-semibold ${
                                transferFeeMode === 'fixed_ves'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              Bs Fijos
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferFeeMode('percent');
                                if (Number(feeValueStr) >= 10) setFeeValueStr('1.5');
                              }}
                              className={`px-1.5 py-0.5 rounded font-semibold ${
                                transferFeeMode === 'percent'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              %
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={feeValueStr}
                            onChange={(e) => setFeeValueStr(e.target.value)}
                            className="w-full px-3 py-1.5 pr-9 text-xs font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">
                            {transferFeeMode === 'percent' ? '%' : currency === 'VES' ? 'Bs' : '$'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
                    <span className="text-[var(--expense-color)] font-sans font-medium flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5" />
                      Comisión: +{formatearMonto(calculatedFeeNominal, currency, locale)}
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      Total:{' '}
                      <strong className="text-[var(--pink-primary)]">
                        {formatearMonto(totalToDebitNominal, currency, locale)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Nota o referencia (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Pago Móvil ref #8492"
              className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
            />
          </div>

          <div className="sticky bottom-0 bg-[var(--surface)] pt-3 pb-1 border-t border-[var(--border-hairline)] flex items-center justify-end gap-2.5 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-[var(--border-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {distributionPreview.length > 1
                  ? `Pagar ${distributionPreview.length} Cuotas (${formatearMonto(effectivePayUsd, 'USD', locale)})`
                  : paymentMode === 'custom_amount' &&
                      effectivePayUsd < remainingUsd - 0.009
                    ? `Confirmar Abono (${formatearMonto(effectivePayUsd, 'USD', locale)})`
                    : `Confirmar Pago (${formatearMonto(effectivePayUsd, 'USD', locale)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface InstallmentsModuleViewProps {
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  resumenMes: MonthlyFinancialSummary;
  officialRate: number | null;
  locale: string;
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'info'
  ) => void;
  setConfirmDialog: React.Dispatch<
    React.SetStateAction<{
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    } | null>
  >;
  autoOpenTrigger?: number;
}

export const InstallmentsModuleView: React.FC<InstallmentsModuleViewProps> = ({
  appData,
  setAppData,
  resumenMes,
  officialRate,
  locale,
  showToast,
  setConfirmDialog,
  autoOpenTrigger,
}) => {
  const creditPurchases = appData.creditPurchases || [];
  const activeWallets = useMemo(
    () =>
      (appData.wallets || []).filter(
        (w) => w.active && !w.isThirdPartyExpenseAccount
      ),
    [appData.wallets]
  );
  const expenseCategories = useMemo(
    () => appData.categories.filter((c) => c.type === 'expense' && c.active),
    [appData.categories]
  );

  // Estado del formulario de nueva compra a cuotas
  const [showCreateForm, setShowCreateForm] = useState<boolean>(
    creditPurchases.length === 0
  );

  useEffect(() => {
    if (autoOpenTrigger && autoOpenTrigger > 0) {
      setShowCreateForm(true);
    }
  }, [autoOpenTrigger]);
  const [concept, setConcept] = useState<string>('');
  const [storeOrPlatform, setStoreOrPlatform] = useState<string>('Cashea');
  const [categoryId, setCategoryId] = useState<string>(
    () => expenseCategories[0]?.id || 'cat-exp-shopping'
  );
  const [purchaseDate, setPurchaseDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [totalAmountStr, setTotalAmountStr] = useState<string>('');
  const [initialPctPreset, setInitialPctPreset] = useState<number | 'custom'>(
    40
  );
  const [initialPaymentStr, setInitialPaymentStr] = useState<string>('');
  const [initialWalletId, setInitialWalletId] = useState<string>(
    () => activeWallets[0]?.id || 'wallet-usd-digital'
  );
  const [initialCurrency, setInitialCurrency] = useState<CurrencyCode>('USD');
  const [initialRateSource, setInitialRateSource] =
    useState<ExchangeRateSource>('bcv');
  const [initialCustomRateStr, setInitialCustomRateStr] = useState<string>(() =>
    appData.settings.defaultExchangeRate
      ? String(appData.settings.defaultExchangeRate)
      : officialRate
        ? String(officialRate)
        : ''
  );
  const [purchaseDateMatchedRate, setPurchaseDateMatchedRate] = useState<number | null>(null);
  const [purchaseDateRateHint, setPurchaseDateRateHint] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<InstallmentFrequency>('biweekly');
  const [installmentsCount, setInstallmentsCount] = useState<number>(3);
  const [customDatesOverride, setCustomDatesOverride] = useState<
    Record<number, string>
  >({});
  const [initialAlreadyPaidExternally, setInitialAlreadyPaidExternally] =
    useState<boolean>(false);
  const [initialFeeType, setInitialFeeType] = useState<
    'none' | 'pago_movil' | 'transferencia'
  >('none');
  const [initialTransferFeeMode, setInitialTransferFeeMode] = useState<
    'fixed_ves' | 'percent'
  >('fixed_ves');
  const [initialFeeValueStr, setInitialFeeValueStr] = useState<string>('0.3');
  const [prePaidInstallmentsMap, setPrePaidInstallmentsMap] = useState<
    Record<number, boolean>
  >({});
  const [notes, setNotes] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');

  const selectedInitialWalletObj = useMemo(
    () => activeWallets.find((w) => w.id === initialWalletId),
    [activeWallets, initialWalletId]
  );

  useEffect(() => {
    if (initialFeeType === 'pago_movil') {
      const pmPct =
        selectedInitialWalletObj?.comisionPagoMovil != null &&
        selectedInitialWalletObj.comisionPagoMovil > 0
          ? selectedInitialWalletObj.comisionPagoMovil
          : 0.3;
      setInitialFeeValueStr(String(pmPct));
    } else if (initialFeeType === 'transferencia') {
      const isBonus =
        Boolean(selectedInitialWalletObj?.isBonusCard) ||
        (selectedInitialWalletObj?.banco || '')
          .toLowerCase()
          .includes('todoticket') ||
        (selectedInitialWalletObj?.name || '')
          .toLowerCase()
          .includes('todoticket');
      const mode =
        selectedInitialWalletObj?.comisionTransferenciaTipo ||
        (isBonus ? 'percent' : 'fixed_ves');
      setInitialTransferFeeMode(mode);
      const trVal =
        selectedInitialWalletObj?.comisionTransferencia != null &&
        selectedInitialWalletObj.comisionTransferencia > 0
          ? mode === 'fixed_ves' &&
            selectedInitialWalletObj.comisionTransferencia < 1
            ? 54
            : selectedInitialWalletObj.comisionTransferencia
          : mode === 'percent'
            ? 1.5
            : 54;
      setInitialFeeValueStr(String(trVal));
    }
  }, [initialFeeType, selectedInitialWalletObj]);

  // Estado para el modal de pago de cuota
  const [payingTarget, setPayingTarget] = useState<{
    purchase: CreditPurchase;
    installment: CreditInstallment;
  } | null>(null);

  // Cálculos en vivo del formulario
  const parsedTotalUsd = useMemo(() => {
    const val = Number(totalAmountStr.replace(',', '.'));
    return Number.isFinite(val) && val > 0 ? Number(val.toFixed(2)) : 0;
  }, [totalAmountStr]);

  const parsedInitialUsd = useMemo(() => {
    if (initialPctPreset !== 'custom') {
      return Number(((parsedTotalUsd * initialPctPreset) / 100).toFixed(2));
    }
    const val = Number(initialPaymentStr.replace(',', '.'));
    return Number.isFinite(val) && val >= 0
      ? Math.min(parsedTotalUsd, Number(val.toFixed(2)))
      : 0;
  }, [initialPctPreset, initialPaymentStr, parsedTotalUsd]);

  const financedAmountUsd = useMemo(
    () => Number(Math.max(0, parsedTotalUsd - parsedInitialUsd).toFixed(2)),
    [parsedTotalUsd, parsedInitialUsd]
  );

  // Cronograma autogenerado en tiempo real según frecuencia (quincenal/mensual)
  const previewSchedule = useMemo(() => {
    const base = generarCronogramaCuotas(
      parsedTotalUsd,
      parsedInitialUsd,
      purchaseDate,
      frequency,
      installmentsCount
    );
    return base.map((item) => ({
      ...item,
      dueDate: customDatesOverride[item.number] || item.dueDate,
      alreadyPaidExternally: Boolean(prePaidInstallmentsMap[item.number]),
    }));
  }, [
    parsedTotalUsd,
    parsedInitialUsd,
    purchaseDate,
    frequency,
    installmentsCount,
    customDatesOverride,
    prePaidInstallmentsMap,
  ]);

  const effectiveInitialRate = useMemo(() => {
    if (initialCurrency === 'USD') return null;
    const targetBcvRate = purchaseDateMatchedRate || officialRate;
    if (initialRateSource === 'bcv' && targetBcvRate && targetBcvRate > 0) {
      return targetBcvRate;
    }
    const manual = Number(initialCustomRateStr.replace(',', '.'));
    return Number.isFinite(manual) && manual > 0 ? manual : null;
  }, [initialCurrency, initialRateSource, purchaseDateMatchedRate, officialRate, initialCustomRateStr]);

  const summary = useMemo(
    () => calcularResumenComprasACuotas(creditPurchases),
    [creditPurchases]
  );

  const handleSelectInitialPct = (pct: number | 'custom') => {
    setInitialPctPreset(pct);
    if (pct !== 'custom' && parsedTotalUsd > 0) {
      setInitialPaymentStr(((parsedTotalUsd * pct) / 100).toFixed(2));
    }
  };

  const initialBaseNominal = useMemo(() => {
    if (initialCurrency === 'VES') {
      return effectiveInitialRate && effectiveInitialRate > 0
        ? Number((parsedInitialUsd * effectiveInitialRate).toFixed(2))
        : 0;
    }
    return parsedInitialUsd;
  }, [initialCurrency, effectiveInitialRate, parsedInitialUsd]);

  const calculatedInitialFeeNominal = useMemo(() => {
    if (
      initialAlreadyPaidExternally ||
      initialFeeType === 'none' ||
      initialBaseNominal <= 0
    ) {
      return 0;
    }
    const val = Math.max(0, Number(initialFeeValueStr.replace(',', '.')) || 0);
    if (initialFeeType === 'pago_movil') {
      const raw = (initialBaseNominal * val) / 100;
      return initialCurrency === 'VES'
        ? Number(Math.max(14, raw).toFixed(2))
        : Number(raw.toFixed(2));
    }
    const raw =
      initialTransferFeeMode === 'percent'
        ? (initialBaseNominal * val) / 100
        : val;
    return Number(raw.toFixed(2));
  }, [
    initialAlreadyPaidExternally,
    initialFeeType,
    initialBaseNominal,
    initialFeeValueStr,
    initialCurrency,
    initialTransferFeeMode,
  ]);

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!concept.trim()) {
      showToast('Ingresa el concepto o producto de la compra.', 'error');
      return;
    }
    if (parsedTotalUsd <= 0) {
      showToast('El monto total debe ser mayor a 0 USD.', 'error');
      return;
    }
    if (parsedInitialUsd >= parsedTotalUsd) {
      showToast(
        'El pago inicial debe ser menor al monto total para financiar en cuotas.',
        'error'
      );
      return;
    }
    if (
      !initialAlreadyPaidExternally &&
      initialCurrency === 'VES' &&
      (!effectiveInitialRate || effectiveInitialRate <= 0)
    ) {
      showToast(
        'Indica una tasa de cambio válida para registrar la inicial en Bolívares.',
        'error'
      );
      return;
    }

    const { purchase, transactionsToCreate } = crearCompraACuotas({
      concept: concept.trim(),
      storeOrPlatform: storeOrPlatform.trim() || 'Tienda',
      categoryId,
      purchaseDate,
      totalAmountUsd: parsedTotalUsd,
      initialPaymentUsd: parsedInitialUsd,
      initialPaymentWalletId: initialWalletId,
      initialPaymentCurrency: initialAlreadyPaidExternally ? 'USD' : initialCurrency,
      initialPaymentExchangeRate: initialAlreadyPaidExternally
        ? null
        : effectiveInitialRate,
      initialPaymentExchangeRateSource:
        !initialAlreadyPaidExternally && initialCurrency === 'VES'
          ? initialRateSource
          : 'none',
      initialInterbankFeeType: !initialAlreadyPaidExternally
        ? initialFeeType
        : 'none',
      initialInterbankFeeAmount:
        !initialAlreadyPaidExternally &&
        initialFeeType !== 'none' &&
        calculatedInitialFeeNominal > 0
          ? calculatedInitialFeeNominal
          : 0,
      initialAlreadyPaidExternally,
      frequency,
      installmentsCount,
      customSchedule: previewSchedule,
      notes,
    });

    setAppData((prev) => ({
      ...prev,
      creditPurchases: [purchase, ...(prev.creditPurchases || [])],
      transactions: [...transactionsToCreate, ...prev.transactions],
    }));

    const prePaidCount = previewSchedule.filter(
      (i) => i.alreadyPaidExternally
    ).length;

    // Limpiar formulario
    setConcept('');
    setTotalAmountStr('');
    setInitialPaymentStr('');
    setCustomDatesOverride({});
    setInitialAlreadyPaidExternally(false);
    setInitialFeeType('none');
    setPrePaidInstallmentsMap({});
    setNotes('');
    setShowCreateForm(false);

    if (initialAlreadyPaidExternally || prePaidCount > 0) {
      showToast(
        `Compra por cuota registrada: los pagos marcados como "pagados antes" no afectaron tu balance actual.`,
        'success'
      );
    } else {
      showToast(
        `Compra registrada: Inicial de ${formatearMonto(parsedInitialUsd, 'USD', locale)}${calculatedInitialFeeNominal > 0 ? ` + comisión bancaria` : ''} descontada del Saldo Real y ${installmentsCount} cuotas agregadas al Saldo Proyectado.`,
        'success'
      );
    }
  };

  const handleConfirmPayInstallment = (
    purchaseId: string,
    installmentId: string,
    payment: PayInstallmentInput
  ) => {
    setAppData((prev) =>
      registrarPagoCuotaEnAppData(prev, purchaseId, installmentId, payment)
    );
    if (payment.isPartialPayment) {
      showToast(
        payment.alreadyPaidExternally
          ? 'Abono parcial registrado como pagado anteriormente (sin descontar de tus billeteras).'
          : 'Abono parcial registrado y descontado de tu billetera seleccionada.',
        'success'
      );
    } else if (payment.alreadyPaidExternally) {
      showToast(
        'Cuota marcada como pagada anteriormente. No se descontó dinero de tus billeteras ni afectó tu balance general.',
        'success'
      );
    } else {
      showToast(
        'Cuota marcada como Pagada. Se registró el egreso real en tu billetera y se actualizó tu Saldo Real.',
        'success'
      );
    }
  };

  const handleDeletePartialPayment = (
    purchase: CreditPurchase,
    inst: CreditInstallment,
    partialId: string,
    amountUsd: number
  ) => {
    setConfirmDialog({
      title: `Eliminar abono de Cuota #${inst.number}`,
      message: `¿Deseas eliminar este abono de ${formatearMonto(
        amountUsd,
        'USD',
        locale
      )} en "${purchase.concept}"? Si fue descontado de una billetera, se revertirá el movimiento.`,
      confirmLabel: 'Sí, eliminar abono',
      danger: true,
      onConfirm: () => {
        setAppData((prev) =>
          eliminarAbonoCuotaCompraEnAppData(
            prev,
            purchase.id,
            inst.id,
            partialId
          )
        );
        setConfirmDialog(null);
        showToast('Abono parcial eliminado de la cuota.', 'info');
      },
    });
  };

  const handleQuickMarkPaidBefore = (
    purchase: CreditPurchase,
    inst: CreditInstallment
  ) => {
    const todayIso = obtenerFechaLocalIso();
    const effectivePaidDate =
      inst.dueDate && inst.dueDate <= todayIso ? inst.dueDate : todayIso;
    setAppData((prev) =>
      registrarPagoCuotaEnAppData(prev, purchase.id, inst.id, {
        paidDate: effectivePaidDate,
        walletId:
          purchase.initialPaymentWalletId ||
          activeWallets[0]?.id ||
          'wallet-usd-digital',
        currency: 'USD',
        exchangeRate: null,
        exchangeRateSource: 'none',
        alreadyPaidExternally: true,
      })
    );
    showToast(
      `Cuota #${inst.number} marcada como pagada antes (sin afectar tu balance general).`,
      'success'
    );
  };

  const handleRevertInstallment = (
    purchase: CreditPurchase,
    inst: CreditInstallment
  ) => {
    setConfirmDialog({
      title: `Revertir pago de Cuota #${inst.number}`,
      message: `¿Deseas volver a marcar la cuota #${inst.number} de "${purchase.concept}" como Pendiente? El monto dejará de restar en tu Saldo Real y volverá a restar únicamente en el Saldo Proyectado.`,
      confirmLabel: 'Sí, revertir a Pendiente',
      onConfirm: () => {
        setAppData((prev) =>
          revertirPagoCuotaEnAppData(prev, purchase.id, inst.id)
        );
        setConfirmDialog(null);
        showToast(
          'Cuota devuelta a estado Pendiente (Saldo Proyectado).',
          'info'
        );
      },
    });
  };

  const handleDeletePurchase = (purchase: CreditPurchase) => {
    setConfirmDialog({
      title: 'Eliminar compra a cuotas',
      message: `¿Estás seguro de eliminar "${purchase.concept}" (${purchase.storeOrPlatform})? Se eliminarán también su pago inicial y las cuotas vinculadas de tus movimientos.`,
      confirmLabel: 'Sí, eliminar compra y movimientos',
      onConfirm: () => {
        setAppData((prev) =>
          eliminarCompraCreditoEnAppData(prev, purchase.id, true)
        );
        setConfirmDialog(null);
        showToast('Compra a cuotas eliminada correctamente.', 'info');
      },
    });
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPurchaseIds, setExpandedPurchaseIds] = useState<
    Record<string, boolean>
  >({});

  const toggleExpandPurchase = (id: string) => {
    setExpandedPurchaseIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredPurchases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return creditPurchases.filter((p) => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (q) {
        const matchConcept = p.concept.toLowerCase().includes(q);
        const matchStore = p.storeOrPlatform.toLowerCase().includes(q);
        if (!matchConcept && !matchStore) return false;
      }
      return true;
    });
  }, [creditPurchases, filterStatus, searchQuery]);

  const getCategoryName = (catId: string): string =>
    appData.categories.find((c) => c.id === catId)?.name || 'Compras';

  const getWalletName = (wId?: string | null): string =>
    (appData.wallets || []).find((w) => w.id === wId)?.name || 'Billetera';

  return (
    <div className="space-y-6">
      {/* CABECERA EJECUTIVA + STRIP FINANCIERO UNIFICADO */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden shadow-2xs">
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-hairline)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--pink-primary)]">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Financiamiento Comercial · Cashea / Krece / Tiendas</span>
              {officialRate && (
                <>
                  <span className="text-[var(--text-secondary)]">·</span>
                  <span className="font-mono-tabular text-[var(--text-secondary)]">
                    BCV {formatearTasa(officialRate, locale)} Bs/$
                  </span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Compras por Cuota
            </h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
              Controla tu financiamiento comercial sin distorsionar tu liquidez real. Liquida 1 cuota, varias cuotas o abona cualquier monto en un solo movimiento bancario.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start md:self-auto shrink-0 whitespace-nowrap shadow-2xs ${
              showCreateForm
                ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-hairline)]'
                : 'bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)]'
            }`}
          >
            {showCreateForm ? (
              <>
                <X className="w-4 h-4" />
                <span>Cerrar registro</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Nueva Compra</span>
              </>
            )}
          </button>
        </div>

        {/* Tira de 4 KPIs Financieros separada por hairlines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-hairline)] bg-[var(--surface-subtle)]/40">
          <div className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Saldo Real Disponible</span>
              <Wallet className="w-3.5 h-3.5 text-[var(--income-color)]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
              {formatearMonto(resumenMes.dineroDisponibleEstimadoUsd, 'USD', locale)}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Liquidez actual en billeteras
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Deuda en Cuotas</span>
              <Clock className="w-3.5 h-3.5 text-[var(--warning-color)]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--expense-color)]">
              -{formatearMonto(summary.totalFinancedPendingUsd, 'USD', locale)}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {summary.pendingInstallmentsCount} cuota(s) por pagar · {summary.activePurchasesCount} activa(s)
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Saldo Libre Proyectado</span>
              <Layers className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--pink-primary)]">
              {formatearMonto(resumenMes.saldoProyectadoUsd, 'USD', locale)}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Disponible tras liquidar cuotas
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Próximo Compromiso</span>
              <CalendarClock className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
            </div>
            {summary.nextDueInstallment ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
                    {formatearMonto(
                      summary.nextDueInstallment.remainingUsd,
                      'USD',
                      locale
                    )}
                  </span>
                  <span className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                    {summary.nextDueInstallment.installment.dueDate}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  {summary.nextDueInstallment.storeOrPlatform} · Cuota #
                  {summary.nextDueInstallment.installment.number} (
                  {summary.nextDueInstallment.concept})
                </p>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-[var(--income-color)]">
                  Al día
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Sin vencimientos pendientes
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FORMULARIO CON AUTOGENERADOR DE FECHAS DE CUOTAS */}
      {showCreateForm && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--pink-primary)]/40 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-[var(--surface-subtle)]/50 border-b border-[var(--border-hairline)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Registrar Nueva Compra por Cuota
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Genera el cronograma automático y marca cualquier pago previo como «Ya pagada antes» si no deseas afectar tu saldo actual.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreatePurchase} className="p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Columna Izquierda: Datos de la Compra e Inicial */}
              <div className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Concepto o artículo comprado *
                    </label>
                    <input
                      type="text"
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      placeholder="Ej: Zapatos deportivos, Audífonos, Televisor..."
                      required
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Plataforma / Tienda
                    </label>
                    <input
                      type="text"
                      value={storeOrPlatform}
                      onChange={(e) => setStoreOrPlatform(e.target.value)}
                      placeholder="Cashea, Krece, Tienda..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Categoría del gasto
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    >
                      {expenseCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Fecha de la compra (Pago Inicial)
                    </label>
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => {
                        const nextDate = e.target.value;
                        setPurchaseDate(nextDate);
                        setCustomDatesOverride({});
                        const lookup = obtenerTasaPorFecha(
                          nextDate,
                          appData.rateHistory,
                          officialRate || appData.settings.defaultExchangeRate,
                          appData.transactions
                        );
                        if (lookup.rate && lookup.rate > 0) {
                          const rounded = Number(lookup.rate.toFixed(2));
                          setPurchaseDateMatchedRate(rounded);
                          setInitialCustomRateStr(String(rounded));
                          setPurchaseDateRateHint(
                            lookup.exactMatch || lookup.matchedDate
                              ? `${lookup.sourceLabel}: ${rounded.toFixed(2)} Bs/$`
                              : null
                          );
                        } else {
                          setPurchaseDateMatchedRate(null);
                          setPurchaseDateRateHint(null);
                        }
                      }}
                      required
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    />
                    {purchaseDateRateHint && (
                      <p className="mt-1 text-[10px] font-semibold text-emerald-500">
                        ✓ {purchaseDateRateHint}
                      </p>
                    )}
                  </div>
                </div>

                {/* Monto Total y Pago Inicial */}
                <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                        Monto Total de la Compra (USD) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={totalAmountStr}
                        onChange={(e) => setTotalAmountStr(e.target.value)}
                        placeholder="Ej: 120.00"
                        required
                        className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-[var(--text-primary)]">
                          Pago Inicial (USD)
                        </label>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={
                          initialPctPreset === 'custom'
                            ? initialPaymentStr
                            : parsedInitialUsd > 0
                              ? parsedInitialUsd.toFixed(2)
                              : '0.00'
                        }
                        onChange={(e) => {
                          setInitialPctPreset('custom');
                          setInitialPaymentStr(e.target.value);
                        }}
                        placeholder="Ej: 48.00"
                        className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--income-color)]"
                      />
                    </div>
                  </div>

                  {/* Atajos de porcentaje para el Pago Inicial */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-secondary)] mr-1">
                      Nivel Inicial:
                    </span>
                    {[
                      { pct: 40, label: '40% (Nivel 2+)' },
                      { pct: 50, label: '50% (Nivel 1)' },
                      { pct: 60, label: '60% (Inicial alta)' },
                      { pct: 25, label: '25%' },
                    ].map((preset) => (
                      <button
                        key={preset.pct}
                        type="button"
                        onClick={() => handleSelectInitialPct(preset.pct)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                          initialPctPreset === preset.pct
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleSelectInitialPct('custom')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                        initialPctPreset === 'custom'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                      }`}
                    >
                      Monto manual
                    </button>
                  </div>

                  {/* Opción para indicar si la inicial ya fue pagada antes */}
                  <div className="pt-2 border-t border-[var(--border-divider)] space-y-2">
                    <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                      ¿Cuándo hiciste el Pago Inicial?
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInitialAlreadyPaidExternally(false)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors ${
                          !initialAlreadyPaidExternally
                            ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                        }`}
                      >
                        <div>Pagué hoy (Descontar de billetera)</div>
                        <div className="text-[10px] opacity-80 font-normal">
                          Resta la inicial de tu Saldo Real actual
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInitialAlreadyPaidExternally(true)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors ${
                          initialAlreadyPaidExternally
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                        }`}
                      >
                        <div>✓ Ya pagué la inicial antes</div>
                        <div className="text-[10px] opacity-80 font-normal">
                          No descuenta de tus billeteras ni afecta tu balance
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Billetera y Moneda del Pago Inicial (solo si se descuenta hoy) */}
                  {!initialAlreadyPaidExternally ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-divider)]">
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                            Billetera para descontar la Inicial
                          </label>
                          <select
                            value={initialWalletId}
                            onChange={(e) => {
                              setInitialWalletId(e.target.value);
                              const w = activeWallets.find(
                                (item) => item.id === e.target.value
                              );
                              if (w) setInitialCurrency(w.currency);
                            }}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                          >
                            {activeWallets.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.currency})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                            Moneda en que pagaste la Inicial
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInitialCurrency('USD')}
                              className={`py-2 px-2.5 rounded-xl text-xs font-semibold border ${
                                initialCurrency === 'USD'
                                  ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                              }`}
                            >
                              USD ($)
                            </button>
                            <button
                              type="button"
                              onClick={() => setInitialCurrency('VES')}
                              className={`py-2 px-2.5 rounded-xl text-xs font-semibold border ${
                                initialCurrency === 'VES'
                                  ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                              }`}
                            >
                              Bolívares (Bs)
                            </button>
                          </div>
                        </div>
                      </div>

                      {initialCurrency === 'VES' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--text-secondary)]">
                              Tasa inicial:
                            </span>
                            <button
                              type="button"
                              onClick={() => setInitialRateSource('bcv')}
                              className={`px-2 py-1 rounded text-[11px] font-medium ${
                                initialRateSource === 'bcv'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)]'
                              }`}
                            >
                              Tasa del día {(purchaseDateMatchedRate || officialRate) ? `(${formatearTasa(purchaseDateMatchedRate || officialRate || 0, locale)})` : ''}
                            </button>
                            <button
                              type="button"
                              onClick={() => setInitialRateSource('manual')}
                              className={`px-2 py-1 rounded text-[11px] font-medium ${
                                initialRateSource === 'manual'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)]'
                              }`}
                            >
                              Manual
                            </button>
                            {(initialRateSource === 'manual' || !officialRate) && (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={initialCustomRateStr}
                                onChange={(e) =>
                                  setInitialCustomRateStr(e.target.value)
                                }
                                placeholder="Tasa Bs/USD"
                                className="w-24 px-2.5 py-1 text-xs font-mono-tabular rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)]"
                              />
                            )}
                          </div>
                          {effectiveInitialRate && parsedInitialUsd > 0 && (
                            <span className="font-mono-tabular font-semibold text-[var(--pink-primary)]">
                              Inicial en Bs:{' '}
                              {formatearMonto(
                                parsedInitialUsd * effectiveInitialRate,
                                'VES',
                                locale
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Comisión Bancaria para el Pago Inicial */}
                      <div className="pt-2.5 border-t border-[var(--border-divider)] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1">
                            <Landmark className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                            <span>
                              ¿Comisión bancaria en la inicial ({selectedInitialWalletObj?.name || 'tu cuenta'})?
                            </span>
                          </label>
                          {initialFeeType !== 'none' && calculatedInitialFeeNominal > 0 && (
                            <span className="text-[11px] font-mono-tabular font-bold text-[var(--expense-color)]">
                              +{formatearMonto(calculatedInitialFeeNominal, initialCurrency, locale)}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInitialFeeType('none')}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                              initialFeeType === 'none'
                                ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                            }`}
                          >
                            Sin comisión
                          </button>
                          <button
                            type="button"
                            onClick={() => setInitialFeeType('pago_movil')}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                              initialFeeType === 'pago_movil'
                                ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                            }`}
                          >
                            📲 Pago Móvil
                          </button>
                          <button
                            type="button"
                            onClick={() => setInitialFeeType('transferencia')}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                              initialFeeType === 'transferencia'
                                ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                            }`}
                          >
                            🏦 Transferencia
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        La inicial de{' '}
                        <strong>{formatearMonto(parsedInitialUsd, 'USD', locale)}</strong>{' '}
                        quedará registrada como pagada anteriormente sin descontar dinero de tus billeteras.
                      </span>
                    </div>
                  )}
                </div>

                {/* Configuración de Frecuencia y Cantidad de Cuotas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Frecuencia de las cuotas
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFrequency('biweekly');
                          setCustomDatesOverride({});
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                          frequency === 'biweekly'
                            ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                            : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                        }`}
                      >
                        Quincenal (14 días)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFrequency('monthly');
                          setCustomDatesOverride({});
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                          frequency === 'monthly'
                            ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                            : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                        }`}
                      >
                        Mensual (Cada mes)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      Número de cuotas
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[3, 4, 6, 9, 12].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setInstallmentsCount(n);
                            setCustomDatesOverride({});
                          }}
                          className={`flex-1 py-2 rounded-xl text-xs font-mono-tabular font-semibold border transition-colors ${
                            installmentsCount === n
                              ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                              : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={36}
                        value={installmentsCount}
                        onChange={(e) => {
                          setInstallmentsCount(
                            Math.max(1, Math.min(36, Number(e.target.value) || 1))
                          );
                          setCustomDatesOverride({});
                        }}
                        className="w-16 px-2 py-2 text-center text-xs font-mono-tabular rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]"
                        title="Cantidad personalizada de cuotas"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Vista Previa del Cronograma Autogenerado */}
              <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[var(--pink-primary)]" />
                      Cronograma ({frequency === 'biweekly' ? 'Cada 14 días' : 'Mensual'})
                    </span>
                    <span className="text-[11px] font-mono-tabular font-semibold text-[var(--pink-primary)]">
                      Financiado: {formatearMonto(financedAmountUsd, 'USD', locale)}
                    </span>
                  </div>

                  {previewSchedule.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                      Ingresa un monto total mayor a 0 USD para previsualizar las fechas y marcar si alguna cuota ya fue pagada antes.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] max-h-72 overflow-y-auto">
                      {/* Fila 0: Pago Inicial */}
                      <div className="p-3 bg-[var(--income-bg)]/30 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-[var(--income-color)]">
                            Pago Inicial · {purchaseDate}
                          </span>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            {initialAlreadyPaidExternally
                              ? 'Pagada antes · No afecta tu balance actual'
                              : 'Egreso inmediato · Resta al Saldo Real'}
                          </div>
                        </div>
                        <span className="font-mono-tabular font-bold text-[var(--income-color)]">
                          {formatearMonto(parsedInitialUsd, 'USD', locale)}
                        </span>
                      </div>

                      {/* Filas de cuotas futuras */}
                      {previewSchedule.map((item) => {
                        const isMarkedPaidBefore = Boolean(
                          prePaidInstallmentsMap[item.number]
                        );
                        return (
                          <div
                            key={item.number}
                            className={`p-3 flex flex-col gap-2 text-xs transition-colors ${
                              isMarkedPaidBefore ? 'bg-emerald-500/5' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-semibold text-[var(--text-primary)]">
                                  Cuota #{item.number}
                                </span>
                                <span className="text-[10px] text-[var(--text-secondary)] ml-2">
                                  · {isMarkedPaidBefore ? 'Pagada antes' : 'Pendiente'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={item.dueDate}
                                  onChange={(e) =>
                                    setCustomDatesOverride((prev) => ({
                                      ...prev,
                                      [item.number]: e.target.value,
                                    }))
                                  }
                                  className="px-2 py-1 text-[11px] font-mono-tabular rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                                />
                                <span className="font-mono-tabular font-bold text-[var(--text-primary)] whitespace-nowrap">
                                  {formatearMonto(item.amountUsd, 'USD', locale)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setPrePaidInstallmentsMap((prev) => ({
                                    ...prev,
                                    [item.number]: !prev[item.number],
                                  }))
                                }
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                                  isMarkedPaidBefore
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>
                                  {isMarkedPaidBefore
                                    ? '✓ Ya pagada antes (Sin descontar)'
                                    : 'Marcar como ya pagada antes'}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3.5 py-2 text-xs font-medium rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Guardar Compra</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* AGENDA DE PRÓXIMOS VENCIMIENTOS (ESTILO LIBRO MAYOR DE ALTA DENSIDAD) */}
      {summary.upcomingInstallments.length > 0 && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[var(--pink-primary)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Agenda de Próximos Vencimientos ({summary.upcomingInstallments.length})
              </h3>
            </div>
            <span className="text-[11px] text-[var(--text-secondary)]">
              Ordenadas por fecha de compromiso · Liquida 1 o varias cuotas en un solo movimiento
            </span>
          </div>

          <div className="divide-y divide-[var(--border-hairline)]">
            {summary.upcomingInstallments.slice(0, 6).map((item) => {
              const targetPurchase = creditPurchases.find(
                (p) => p.id === item.purchaseId
              );
              const urgencyColor =
                item.urgency === 'overdue'
                  ? 'text-[var(--expense-color)] font-bold'
                  : item.urgency === 'today' || item.urgency === 'soon'
                    ? 'text-amber-500 font-semibold'
                    : 'text-[var(--text-secondary)]';

              const urgencyLabel =
                item.daysUntilDue < 0
                  ? `Vencida hace ${Math.abs(item.daysUntilDue)}d`
                  : item.daysUntilDue === 0
                    ? 'Vence hoy'
                    : `En ${item.daysUntilDue} día(s)`;

              return (
                <div
                  key={item.installment.id}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-subtle)]/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Fecha compacta */}
                    <div className="w-12 h-11 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col items-center justify-center shrink-0 font-mono-tabular">
                      <span className="text-[10px] uppercase text-[var(--text-secondary)] leading-none">
                        {item.installment.dueDate.slice(5, 7)}/{item.installment.dueDate.slice(2, 4)}
                      </span>
                      <span className="text-sm font-bold text-[var(--text-primary)] leading-tight mt-0.5">
                        {item.installment.dueDate.slice(8, 10)}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-[var(--pink-primary)]">
                          {item.storeOrPlatform}
                        </span>
                        <span className="text-[var(--text-secondary)]">·</span>
                        <span className="font-mono-tabular font-semibold text-[var(--text-secondary)]">
                          Cuota #{item.installment.number}/{item.totalInstallments}
                        </span>
                        <span className="text-[var(--text-secondary)]">·</span>
                        <span className={urgencyColor}>{urgencyLabel}</span>
                      </div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {item.concept}
                      </h4>
                      {item.paidUsd > 0 && (
                        <p className="text-[11px] font-mono-tabular text-amber-500">
                          Abonado: {formatearMonto(item.paidUsd, 'USD', locale)} · Resta:{' '}
                          {formatearMonto(item.remainingUsd, 'USD', locale)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-hairline)]">
                    <div className="text-left sm:text-right">
                      <div className="text-sm sm:text-base font-bold font-mono-tabular text-[var(--text-primary)]">
                        {formatearMonto(item.remainingUsd, 'USD', locale)}
                      </div>
                      {officialRate && (
                        <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                          ≈ {formatearMonto(item.remainingUsd * officialRate, 'VES', locale)}
                        </div>
                      )}
                    </div>

                    {targetPurchase && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPayingTarget({
                              purchase: targetPurchase,
                              installment: item.installment,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] text-white text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Pagar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleQuickMarkPaidBefore(
                              targetPurchase,
                              item.installment
                            )
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-emerald-500 hover:border-emerald-500/40 text-[11px] font-semibold transition-colors whitespace-nowrap"
                          title="Marcar como pagada anteriormente sin descontar de tus billeteras"
                        >
                          Ya pagada
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PLANES DE FINANCIAMIENTO Y DESGLOSE DE CUOTAS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Planes de Financiamiento
            </h3>
            <span className="text-xs font-mono-tabular text-[var(--text-secondary)]">
              {filteredPurchases.length} registro(s)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:w-56">
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar compra o tienda..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
              />
            </div>

            <div className="inline-flex p-1 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
              {(
                [
                  { id: 'all', label: 'Todas' },
                  { id: 'active', label: 'En curso' },
                  { id: 'completed', label: 'Solventes' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    filterStatus === tab.id
                      ? 'bg-[var(--pink-primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredPurchases.length === 0 ? (
          <div className="bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border-hairline)] text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">
              No hay compras financiadas que coincidan con este filtro
            </h4>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              Registra tus compras en cuotas de Cashea, Krece o tiendas comerciales para llevar control exacto de tus pagos iniciales y vencimientos quincenales.
            </p>
            {!showCreateForm && (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 rounded-xl bg-[var(--pink-primary)] text-white text-xs font-bold hover:bg-[var(--pink-dark)] inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar primera compra</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredPurchases.map((purchase) => {
              const paidInstallments = purchase.installments.filter(
                (i) => i.status === 'paid'
              );
              const installmentsPaidAndPartialSumUsd = purchase.installments.reduce(
                (acc, inst) =>
                  acc + obtenerEstadoAbonosCuotaCompra(inst).paidUsd,
                0
              );
              const totalPaidSoFarUsd = Number(
                (
                  purchase.initialPaymentUsd + installmentsPaidAndPartialSumUsd
                ).toFixed(2)
              );
              const remainingDebtUsd = Number(
                Math.max(0, purchase.totalAmountUsd - totalPaidSoFarUsd).toFixed(
                  2
                )
              );
              const progressPct =
                purchase.totalAmountUsd > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (totalPaidSoFarUsd / purchase.totalAmountUsd) * 100
                      )
                    )
                  : 100;

              const nextPendingInst = purchase.installments
                .filter((i) => i.status !== 'paid')
                .sort((a, b) => a.number - b.number)[0];

              // Por defecto expandimos las compras activas para acceso rápido o según toggle del usuario
              const isExpanded =
                expandedPurchaseIds[purchase.id] ?? purchase.status === 'active';

              return (
                <div
                  key={purchase.id}
                  className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden transition-all"
                >
                  {/* Cabecera principal de la compra */}
                  <div className="p-5 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <span className="font-bold uppercase tracking-wider text-[var(--pink-primary)]">
                            {purchase.storeOrPlatform}
                          </span>
                          <span className="text-[var(--text-secondary)]">·</span>
                          <span className="text-[var(--text-secondary)]">
                            {getCategoryName(purchase.categoryId)}
                          </span>
                          <span className="text-[var(--text-secondary)]">·</span>
                          <span className="font-mono-tabular text-[var(--text-secondary)]">
                            {purchase.purchaseDate}
                          </span>
                          <span className="text-[var(--text-secondary)]">·</span>
                          <span
                            className={`font-semibold ${
                              purchase.status === 'completed'
                                ? 'text-[var(--income-color)]'
                                : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {purchase.status === 'completed'
                              ? '✓ Liquidada 100%'
                              : `${paidInstallments.length}/${purchase.installmentsCount} cuotas cubiertas`}
                          </span>
                        </div>

                        <h4 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                          {purchase.concept}
                        </h4>
                      </div>

                      {/* Resumen financiero en línea + Acciones */}
                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 sm:gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-[var(--border-hairline)]">
                        <div className="flex items-center gap-5">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block">
                              Total
                            </span>
                            <span className="text-sm sm:text-base font-bold font-mono-tabular text-[var(--text-primary)]">
                              {formatearMonto(
                                purchase.totalAmountUsd,
                                'USD',
                                locale
                              )}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block">
                              Pagado ({progressPct}%)
                            </span>
                            <span className="text-sm sm:text-base font-bold font-mono-tabular text-[var(--income-color)]">
                              {formatearMonto(totalPaidSoFarUsd, 'USD', locale)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block">
                              Por pagar
                            </span>
                            <span
                              className={`text-sm sm:text-base font-bold font-mono-tabular ${
                                remainingDebtUsd > 0
                                  ? 'text-[var(--expense-color)]'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              {formatearMonto(remainingDebtUsd, 'USD', locale)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {purchase.status !== 'completed' && nextPendingInst && (
                            <button
                              type="button"
                              onClick={() =>
                                setPayingTarget({
                                  purchase,
                                  installment: nextPendingInst,
                                })
                              }
                              className="px-3.5 py-2 rounded-xl bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs whitespace-nowrap transition-colors"
                              title="Pagar 1 cuota, 2 cuotas, liquidar todas o abonar otro monto en un solo movimiento bancario"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Pagar / Liquidar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => toggleExpandPurchase(purchase.id)}
                            className="px-2.5 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>{isExpanded ? 'Ocultar cuotas' : 'Ver cuotas'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePurchase(purchase)}
                            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--expense-color)] hover:bg-[var(--surface-subtle)] transition-colors"
                            title="Eliminar compra a cuotas"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stepper Segmentado tipo Fintech (Inicial + cada Cuota) */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-1.5 h-2.5 w-full">
                        {/* Segmento Inicial */}
                        {purchase.initialPaymentUsd > 0 && (
                          <div
                            className="h-full rounded-l-full bg-emerald-500 transition-all"
                            style={{
                              width: `${Math.max(
                                12,
                                Math.round(
                                  (purchase.initialPaymentUsd /
                                    Math.max(1, purchase.totalAmountUsd)) *
                                    100
                                )
                              )}%`,
                            }}
                            title={`Inicial cubierta: ${formatearMonto(
                              purchase.initialPaymentUsd,
                              'USD',
                              locale
                            )}`}
                          />
                        )}

                        {/* Segmentos por cada cuota */}
                        {purchase.installments.map((inst, idx) => {
                          const { paidUsd: instPaidUsd } =
                            obtenerEstadoAbonosCuotaCompra(inst);
                          const fillPct =
                            inst.amountUsd > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (instPaidUsd / inst.amountUsd) * 100
                                  )
                                )
                              : 100;
                          const isLast =
                            idx === purchase.installments.length - 1;

                          return (
                            <div
                              key={inst.id}
                              className={`flex-1 h-full bg-[var(--surface-subtle)] border border-[var(--border-hairline)] overflow-hidden ${
                                isLast ? 'rounded-r-full' : 'rounded-xs'
                              }`}
                              title={`Cuota #${inst.number}: ${formatearMonto(
                                instPaidUsd,
                                'USD',
                                locale
                              )} / ${formatearMonto(
                                inst.amountUsd,
                                'USD',
                                locale
                              )} (${inst.dueDate})`}
                            >
                              <div
                                className={`h-full transition-all duration-300 ${
                                  inst.status === 'paid'
                                    ? 'bg-[var(--pink-primary)]'
                                    : instPaidUsd > 0
                                      ? 'bg-amber-500'
                                      : 'bg-transparent'
                                }`}
                                style={{ width: `${fillPct}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                        <span>
                          Inicial:{' '}
                          <strong className="font-mono-tabular text-[var(--text-primary)]">
                            {formatearMonto(
                              purchase.initialPaymentUsd,
                              'USD',
                              locale
                            )}
                          </strong>{' '}
                          {purchase.initialAlreadyPaidExternally
                            ? '· Pagada antes (sin descontar)'
                            : `· ${getWalletName(purchase.initialPaymentWalletId)}`}
                        </span>

                        {nextPendingInst ? (
                          <span className="font-mono-tabular">
                            Próxima cuota: #{nextPendingInst.number} (
                            {formatearMonto(
                              obtenerEstadoAbonosCuotaCompra(nextPendingInst)
                                .remainingUsd,
                              'USD',
                              locale
                            )}
                            ) vence el{' '}
                            <strong className="text-[var(--text-primary)]">
                              {nextPendingInst.dueDate}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-[var(--income-color)] font-semibold">
                            Todas las cuotas han sido liquidadas
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* DESGLOSE DE CUOTAS EN FORMATO LEDGER (FILAS SEPARADAS POR HAIRLINE) */}
                  {isExpanded && (
                    <div className="border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)]/30 divide-y divide-[var(--border-hairline)]">
                      {purchase.installments.map((inst) => {
                        const isPaid = inst.status === 'paid';
                        const {
                          paidUsd: instPaidUsd,
                          remainingUsd: instRemainingUsd,
                          hasPartialPayments,
                          partialPayments,
                        } = obtenerEstadoAbonosCuotaCompra(inst);
                        const instPct =
                          inst.amountUsd > 0
                            ? Math.min(
                                100,
                                Math.round((instPaidUsd / inst.amountUsd) * 100)
                              )
                            : 0;

                        return (
                          <div
                            key={inst.id}
                            className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-subtle)]/60 transition-colors"
                          >
                            {/* Izquierda: Número de cuota, estado, vencimiento y abonos */}
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isPaid
                                      ? 'bg-emerald-500'
                                      : hasPartialPayments
                                        ? 'bg-amber-500'
                                        : 'bg-[var(--text-secondary)]/40'
                                  }`}
                                />
                                <span className="font-bold text-[var(--text-primary)]">
                                  Cuota #{inst.number}
                                </span>
                                <span className="text-[var(--text-secondary)]">·</span>
                                <span className="font-mono-tabular text-[var(--text-secondary)]">
                                  {isPaid
                                    ? inst.alreadyPaidExternally
                                      ? `Cubierta antes (${inst.paidAt || inst.dueDate})`
                                      : `Pagada el ${inst.paidAt} · ${getWalletName(inst.paidWalletId)}`
                                    : `Vence ${inst.dueDate}`}
                                </span>
                                <span className="text-[var(--text-secondary)]">·</span>
                                <span
                                  className={`text-[11px] font-semibold ${
                                    isPaid
                                      ? 'text-[var(--income-color)]'
                                      : hasPartialPayments
                                        ? 'text-amber-500'
                                        : 'text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {isPaid
                                    ? inst.alreadyPaidExternally
                                      ? 'Sin descuento en balance'
                                      : 'Saldo Real'
                                    : hasPartialPayments
                                      ? `Abonado ${instPct}% (${formatearMonto(instPaidUsd, 'USD', locale)})`
                                      : 'Pendiente'}
                                </span>
                              </div>

                              {isPaid &&
                                !inst.alreadyPaidExternally &&
                                inst.paidCurrency === 'VES' &&
                                inst.paidAmountNominal && (
                                  <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)] pl-4">
                                    Pagado en Bs:{' '}
                                    {formatearMonto(
                                      inst.paidAmountNominal,
                                      'VES',
                                      locale
                                    )}{' '}
                                    (Tasa:{' '}
                                    {formatearTasa(
                                      inst.paidExchangeRate || 0,
                                      locale
                                    )}
                                    )
                                  </div>
                                )}

                              {/* Lista compacta de abonos parciales registrados */}
                              {partialPayments.length > 0 && (
                                <div className="pl-4 pt-1 flex flex-wrap items-center gap-1.5">
                                  {partialPayments.map((abono) => (
                                    <span
                                      key={abono.id}
                                      className="inline-flex items-center gap-1.5 text-[10px] py-0.5 px-2 rounded-md bg-[var(--surface)] border border-[var(--border-hairline)] font-mono-tabular text-[var(--text-secondary)]"
                                    >
                                      <strong className="text-[var(--text-primary)]">
                                        {formatearMonto(
                                          abono.amountUsd,
                                          'USD',
                                          locale
                                        )}
                                      </strong>
                                      <span>· {abono.date}</span>
                                      <span>
                                        {abono.alreadyPaidExternally
                                          ? '(Antes)'
                                          : `(${getWalletName(abono.walletId)})`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeletePartialPayment(
                                            purchase,
                                            inst,
                                            abono.id,
                                            abono.amountUsd
                                          )
                                        }
                                        className="text-[var(--text-secondary)] hover:text-[var(--expense-color)] ml-0.5"
                                        title="Eliminar este abono"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Derecha: Monto + Acciones de la fila */}
                            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-4 sm:pl-0">
                              <div className="text-left sm:text-right">
                                <span className="text-sm font-bold font-mono-tabular text-[var(--text-primary)] block">
                                  {formatearMonto(
                                    isPaid ? inst.amountUsd : instRemainingUsd,
                                    'USD',
                                    locale
                                  )}
                                </span>
                                {!isPaid && hasPartialPayments && (
                                  <span className="text-[10px] font-mono-tabular text-[var(--text-secondary)]">
                                    de {formatearMonto(inst.amountUsd, 'USD', locale)}
                                  </span>
                                )}
                              </div>

                              {!isPaid ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPayingTarget({
                                        purchase,
                                        installment: inst,
                                      })
                                    }
                                    className="py-1.5 px-3 rounded-lg bg-[var(--pink-primary)] text-white text-[11px] font-bold hover:bg-[var(--pink-dark)] transition-colors flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                                    <span>Pagar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickMarkPaidBefore(purchase, inst)
                                    }
                                    className="py-1.5 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-emerald-500 hover:border-emerald-500/40 text-[11px] font-semibold transition-colors whitespace-nowrap"
                                    title="Marcar cuota como pagada anteriormente sin descontar de tu balance"
                                  >
                                    Pagada antes
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRevertInstallment(purchase, inst)
                                  }
                                  className="py-1 px-2.5 rounded-lg text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-hairline)] flex items-center gap-1 whitespace-nowrap"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Revertir</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal para pagar 1 cuota, varias cuotas o abonar otro monto en USD o Bs */}
      <PayInstallmentModal
        isOpen={Boolean(payingTarget)}
        onClose={() => setPayingTarget(null)}
        purchase={payingTarget?.purchase || null}
        installment={payingTarget?.installment || null}
        wallets={appData.wallets || []}
        officialRate={officialRate}
        defaultManualRate={appData.settings.defaultExchangeRate}
        preferManualByDefault={appData.settings.preferManualRateByDefault}
        rateHistory={appData.rateHistory}
        existingTransactions={appData.transactions}
        locale={locale}
        onConfirmPay={handleConfirmPayInstallment}
      />
    </div>
  );
};
