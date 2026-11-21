import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  Info,
  Layers,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppDataSchema,
  CurrencyCode,
  ExchangeRateSource,
  MonthlyFinancialSummary,
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
  WalletAccount,
} from '../types/finance';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { obtenerFechaLocalIso } from '../utils/calculations';
import {
  actualizarSuscripcionEnAppData,
  alternarEstadoSuscripcionEnAppData,
  avanzarFechaSiguienteCiclo,
  calcularMontoSuscripcionUsd,
  calcularResumenSuscripciones,
  crearSuscripcion,
  eliminarSuscripcionEnAppData,
  PaySubscriptionInput,
  registrarPagoSuscripcionEnAppData,
} from '../utils/subscriptionsController';
import { PushModuleInlineBar } from './PushNotificationCenter';
import { UsdToVesHelper } from './UsdToVesHelper';
import { sanitizeDecimalInput, parseNumberInput } from '../utils/numberFormat';

interface PaySubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  wallets: WalletAccount[];
  officialRate: number | null;
  defaultManualRate: number | null;
  preferManualByDefault?: boolean;
  locale?: string;
  onConfirmPay: (subId: string, payment: PaySubscriptionInput) => void;
}

/**
 * MODAL DE CONFIRMACIÓN DE PAGO DE SUSCRIPCIÓN:
 * Genera un egreso estándar ('completed') en la billetera seleccionada
 * (aplicando la tasa oficial BCV o manual si se ejecuta en Bs) y avanza
 * automáticamente la 'Fecha de Próximo Cobro' al siguiente ciclo.
 */
export const PaySubscriptionModal: React.FC<PaySubscriptionModalProps> = ({
  isOpen,
  onClose,
  subscription,
  wallets,
  officialRate,
  defaultManualRate,
  preferManualByDefault = false,
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
  const [walletId, setWalletId] = useState<string>(
    () => activeWallets[0]?.id || 'wallet_zelle'
  );
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [rateSource, setRateSource] = useState<ExchangeRateSource>(() =>
    preferManualByDefault && defaultManualRate ? 'manual' : 'bcv'
  );
  const [customRateStr, setCustomRateStr] = useState<string>(() =>
    defaultManualRate
      ? String(defaultManualRate)
      : officialRate
        ? String(officialRate)
        : ''
  );
  const [amountInputStr, setAmountInputStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Método de pago y comisión bancaria
  const [paymentMethod, setPaymentMethod] = useState<string>('Tarjeta / Débito');
  const [isInterbankTransfer, setIsInterbankTransfer] = useState<boolean>(false);
  const [interbankFeeType, setInterbankFeeType] = useState<'pago_movil' | 'transferencia'>('pago_movil');
  const [interbankFeeTransferMode, setInterbankFeeTransferMode] = useState<'percent' | 'fixed_ves'>('fixed_ves');
  const [interbankFeeValueStr, setInterbankFeeValueStr] = useState<string>('0.3');

  const selectedWalletObj = useMemo(
    () => activeWallets.find((w) => w.id === walletId),
    [activeWallets, walletId]
  );

  const effectiveRate = useMemo(() => {
    if (currency === 'USD' || currency === 'USDT') return null;
    if (rateSource === 'bcv' && officialRate && officialRate > 0) {
      return officialRate;
    }
    const parsed = Number(customRateStr.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [currency, rateSource, officialRate, customRateStr]);

  const applyWalletFeeDefaults = (
    w: WalletAccount | undefined,
    feeType: 'pago_movil' | 'transferencia',
    curr: CurrencyCode
  ) => {
    if (feeType === 'pago_movil') {
      const pct = w?.comisionPagoMovil !== undefined ? w.comisionPagoMovil : 0.3;
      setInterbankFeeValueStr(String(pct));
    } else {
      const mode: 'percent' | 'fixed_ves' =
        curr === 'VES'
          ? w?.comisionTransferenciaTipo || (w?.isBonusCard ? 'percent' : 'fixed_ves')
          : 'percent';
      setInterbankFeeTransferMode(mode);
      const val =
        w?.comisionTransferencia !== undefined
          ? w.comisionTransferencia
          : mode === 'fixed_ves'
            ? 54
            : 1.5;
      setInterbankFeeValueStr(String(val));
    }
  };

  // Sincronizar valores iniciales al abrir el modal con la suscripción seleccionada
  useEffect(() => {
    if (!subscription || !isOpen) return;
    setPaidDate(obtenerFechaLocalIso());
    setError(null);
    setNotes('');

    const preferredWallet =
      activeWallets.find((w) => w.id === subscription.defaultWalletId) ||
      activeWallets.find((w) => w.currency === subscription.currency) ||
      activeWallets[0];

    const initialWalletId = preferredWallet?.id || 'wallet_zelle';
    const initialCurrency: CurrencyCode =
      preferredWallet?.currency === 'VES'
        ? 'VES'
        : subscription.currency === 'VES'
          ? 'VES'
          : 'USD';

    setWalletId(initialWalletId);
    setCurrency(initialCurrency);

    const defaultPm =
      initialCurrency === 'VES' ? 'Pago Móvil' : 'Tarjeta / Débito';
    setPaymentMethod(defaultPm);
    if (defaultPm === 'Pago Móvil') {
      setIsInterbankTransfer(true);
      setInterbankFeeType('pago_movil');
      applyWalletFeeDefaults(preferredWallet, 'pago_movil', initialCurrency);
    } else {
      setIsInterbankTransfer(false);
      setInterbankFeeType('pago_movil');
      applyWalletFeeDefaults(preferredWallet, 'pago_movil', initialCurrency);
    }

    const rateForCalc =
      officialRate || subscription.exchangeRate || defaultManualRate || 1;
    const subUsd = calcularMontoSuscripcionUsd(
      subscription,
      officialRate,
      defaultManualRate
    );

    if (initialCurrency === 'VES') {
      const vesAmount =
        subscription.currency === 'VES'
          ? subscription.amount
          : Number((subUsd * rateForCalc).toFixed(2));
      setAmountInputStr(vesAmount.toFixed(2));
    } else {
      setAmountInputStr(subUsd.toFixed(2));
    }
  }, [subscription, isOpen, activeWallets, officialRate, defaultManualRate]);

  if (!isOpen || !subscription) return null;

  const baseUsd = calcularMontoSuscripcionUsd(
    subscription,
    officialRate,
    defaultManualRate
  );
  const nextCyclePreview = avanzarFechaSiguienteCiclo(
    subscription.nextBillingDate,
    subscription.frequency
  );

  const handleCurrencySwitch = (nextCurr: CurrencyCode) => {
    setCurrency(nextCurr);
    const rate =
      (rateSource === 'bcv' && officialRate ? officialRate : null) ||
      Number(customRateStr.replace(',', '.')) ||
      subscription.exchangeRate ||
      1;

    if (nextCurr === 'VES') {
      const vesVal =
        subscription.currency === 'VES'
          ? subscription.amount
          : Number((baseUsd * rate).toFixed(2));
      setAmountInputStr(vesVal.toFixed(2));
    } else {
      setAmountInputStr(baseUsd.toFixed(2));
    }
  };

  const handleWalletChange = (newWalletId: string) => {
    setWalletId(newWalletId);
    const selectedW = activeWallets.find((w) => w.id === newWalletId);
    if (selectedW) {
      const nextCurr: CurrencyCode = selectedW.currency === 'VES' ? 'VES' : 'USD';
      handleCurrencySwitch(nextCurr);
      applyWalletFeeDefaults(selectedW, interbankFeeType, nextCurr);
    }
  };

  const handleSelectPaymentMethod = (method: string) => {
    setPaymentMethod(method);
    if (method === 'Pago Móvil') {
      setIsInterbankTransfer(true);
      setInterbankFeeType('pago_movil');
      applyWalletFeeDefaults(selectedWalletObj, 'pago_movil', currency);
    } else if (method === 'Transferencia') {
      setIsInterbankTransfer(true);
      setInterbankFeeType('transferencia');
      applyWalletFeeDefaults(selectedWalletObj, 'transferencia', currency);
    } else {
      setIsInterbankTransfer(false);
    }
  };

    const parsedNominal = Number(amountInputStr.replace(',', '.')) || 0;
  const equivalentUsdPreview =
    currency === 'VES'
      ? effectiveRate && effectiveRate > 0
        ? Number((parsedNominal / effectiveRate).toFixed(2))
        : 0
      : parsedNominal;

  const parsedFeeVal = parseNumberInput(interbankFeeValueStr);
  const calculatedInterbankFee = (() => {
    if (!isInterbankTransfer || parsedNominal <= 0 || parsedFeeVal === null || parsedFeeVal <= 0) {
      return 0;
    }
    if (interbankFeeType === 'pago_movil') {
      const rawFee = (parsedNominal * parsedFeeVal) / 100;
      const finalFee = currency === 'VES' ? Math.max(14, rawFee) : rawFee;
      return Number(finalFee.toFixed(2));
    }
    const effectiveMode = currency === 'VES' ? interbankFeeTransferMode : 'percent';
    if (effectiveMode === 'fixed_ves') {
      return Number(parsedFeeVal.toFixed(2));
    }
    return Number(((parsedNominal * parsedFeeVal) / 100).toFixed(2));
  })();

  const totalToDebit = Number((parsedNominal + calculatedInterbankFee).toFixed(2));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!walletId) {
      setError('Selecciona una billetera para debitar el pago.');
      return;
    }
    if (parsedNominal <= 0) {
      setError('El monto a pagar debe ser mayor que 0.');
      return;
    }
    if (currency === 'VES' && (!effectiveRate || effectiveRate <= 0)) {
      setError(
        'Ingresa o actualiza una tasa de cambio válida (Bs/USD) para pagar en Bolívares.'
      );
      return;
    }

    onConfirmPay(subscription.id, {
      paidDate,
      walletId,
      currency,
      amountNominal: parsedNominal,
      exchangeRate: currency === 'VES' ? effectiveRate : null,
      exchangeRateSource: currency === 'VES' ? rateSource : 'none',
      notes: notes.trim() || undefined,
      paymentMethod,
      isInterbankTransfer,
      interbankFeeType: isInterbankTransfer ? interbankFeeType : undefined,
      interbankFeeAmount: isInterbankTransfer ? calculatedInterbankFee : 0,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col my-auto shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] border border-[var(--pink-primary)]/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                Registrar Pago · {subscription.name}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Corte: {subscription.nextBillingDate} → Próximo: {nextCyclePreview}
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

          {/* 1. Fecha de pago y Cuenta (Antes del monto) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Fecha de pago *
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Cuenta a debitar *
              </label>
              <select
                value={walletId}
                onChange={(e) => handleWalletChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              >
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Tarjeta Principal de Monto y Moneda */}
          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Monto a debitar *
                </label>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Pactado: {formatearMonto(subscription.amount, subscription.currency, locale)}
                </span>
              </div>
              <div className="inline-flex p-0.5 bg-[var(--surface)] border border-[var(--border-input)] rounded-xl">
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('USD')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    currency === 'USD'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencySwitch('VES')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    currency === 'VES'
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
                {currency === 'USD' ? '$' : 'Bs'}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInputStr}
                onChange={(e) => setAmountInputStr(sanitizeDecimalInput(e.target.value))}
                required
                className="w-full pl-12 pr-4 py-3 text-xl sm:text-2xl font-mono-tabular font-bold rounded-2xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            {currency === 'VES' && (
              <UsdToVesHelper
                officialRate={officialRate}
                defaultManualRate={defaultManualRate}
                currentRate={effectiveRate}
                rateSource={rateSource === 'manual' ? 'manual' : 'bcv'}
                locale={locale}
                compact
                onApplyVesAmount={(vesStr, usedRate, src) => {
                  setAmountInputStr(vesStr);
                  setRateSource(src);
                  if (src === 'manual') {
                    setCustomRateStr(String(usedRate));
                  }
                }}
              />
            )}

            {currency === 'VES' && (
              <div className="pt-2.5 border-t border-[var(--border-hairline)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <span>Tasa:</span>
                    <div className="inline-flex items-center gap-1 bg-[var(--surface)] p-0.5 rounded-lg border border-[var(--border-input)]">
                      <button
                        type="button"
                        onClick={() => {
                          setRateSource('bcv');
                          if (officialRate && subscription.currency === 'USD') {
                            setAmountInputStr((baseUsd * officialRate).toFixed(2));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          rateSource === 'bcv'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        BCV ({formatearTasa(officialRate, locale)})
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
                  <span className="font-mono-tabular font-bold text-[var(--text-primary)]">
                    ≈ {formatearMonto(equivalentUsdPreview, 'USD', locale)}
                  </span>
                </div>

                {rateSource === 'manual' && (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customRateStr}
                    onChange={(e) => setCustomRateStr(sanitizeDecimalInput(e.target.value))}
                    placeholder="Ej: 65.50"
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                  />
                )}
              </div>
            )}
          </div>

          {/* 3. Comisión Bancaria y Método de Pago */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                ¿Aplica comisión bancaria?
              </span>
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-[var(--surface)] rounded-xl border border-[var(--border-input)]">
                <button
                  type="button"
                  onClick={() => setIsInterbankTransfer(false)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    !isInterbankTransfer
                      ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] shadow-xs font-bold'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  Sin comisión
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInterbankTransfer(true);
                    setInterbankFeeType('pago_movil');
                    setPaymentMethod('Pago Móvil');
                    applyWalletFeeDefaults(selectedWalletObj, 'pago_movil', currency);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    isInterbankTransfer && interbankFeeType === 'pago_movil'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs font-bold'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  📲 Pago Móvil
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsInterbankTransfer(true);
                    setInterbankFeeType('transferencia');
                    setPaymentMethod('Transferencia');
                    applyWalletFeeDefaults(selectedWalletObj, 'transferencia', currency);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    isInterbankTransfer && interbankFeeType === 'transferencia'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs font-bold'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  🏦 Transferencia
                </button>
              </div>
            </div>

            {isInterbankTransfer && (
              <div className="space-y-2.5 pt-2.5 border-t border-[var(--border-divider)]">
                {interbankFeeType === 'transferencia' && currency === 'VES' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInterbankFeeTransferMode('fixed_ves');
                        setInterbankFeeValueStr(
                          String(
                            selectedWalletObj?.comisionTransferenciaTipo === 'fixed_ves' &&
                              selectedWalletObj?.comisionTransferencia
                              ? selectedWalletObj.comisionTransferencia
                              : 54
                          )
                        );
                      }}
                      className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold border ${
                        interbankFeeTransferMode === 'fixed_ves'
                          ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                      }`}
                    >
                      Monto fijo (Bs)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInterbankFeeTransferMode('percent');
                        setInterbankFeeValueStr(
                          String(
                            selectedWalletObj?.comisionTransferenciaTipo === 'percent' &&
                              selectedWalletObj?.comisionTransferencia
                              ? selectedWalletObj.comisionTransferencia
                              : 1.5
                          )
                        );
                      }}
                      className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold border ${
                        interbankFeeTransferMode === 'percent'
                          ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                      }`}
                    >
                      Porcentaje (%)
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-1">
                      {interbankFeeType === 'pago_movil'
                        ? 'Comisión Pago Móvil (%)'
                        : interbankFeeTransferMode === 'fixed_ves' && currency === 'VES'
                          ? 'Comisión Fija (Bs)'
                          : 'Comisión Transferencia (%)'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={interbankFeeValueStr}
                      onChange={(e) =>
                        setInterbankFeeValueStr(sanitizeDecimalInput(e.target.value))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs">
                    <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                      <span>Comisión:</span>
                      <span className="font-mono-tabular font-bold text-[var(--expense-color)]">
                        +{formatearMonto(calculatedInterbankFee, currency, locale)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-[var(--text-primary)] pt-0.5 border-t border-[var(--border-divider)] mt-0.5">
                      <span>Total a debitar:</span>
                      <span className="font-mono-tabular text-[var(--pink-primary)]">
                        {formatearMonto(totalToDebit, currency, locale)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Método de pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => handleSelectPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
              >
                {[
                  'Pago Móvil',
                  'Transferencia',
                  'Tarjeta / Débito',
                  'Zelle / Digital',
                  'Efectivo',
                ].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Nota o referencia (opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Referencia #123456"
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
              />
            </div>
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
              <span>Confirmar Pago</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SubscriptionsModuleViewProps {
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  resumenMes: MonthlyFinancialSummary;
  selectedMonth: string;
  officialRate: number | null;
  locale: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setConfirmDialog: React.Dispatch<
    React.SetStateAction<{
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    } | null>
  >;
  onOpenPushCenter?: () => void;
  autoOpenTrigger?: number;
}

const POPULAR_PRESETS: {
  name: string;
  amount: number;
  currency: CurrencyCode;
  frequency: SubscriptionFrequency;
  categoryId: string;
}[] = [
  {
    name: 'Netflix',
    amount: 7.99,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_subscriptions',
  },
  {
    name: 'Spotify Premium',
    amount: 5.99,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_subscriptions',
  },
  {
    name: 'YouTube Premium',
    amount: 7.99,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_subscriptions',
  },
  {
    name: 'ChatGPT Plus',
    amount: 20.0,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_subscriptions',
  },
  {
    name: 'Internet Fibra Óptica',
    amount: 30.0,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_internet',
  },
  {
    name: 'Gimnasio',
    amount: 25.0,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_health',
  },
  {
    name: 'iCloud+ / Google One',
    amount: 2.99,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_subscriptions',
  },
  {
    name: 'Amazon Prime',
    amount: 5.99,
    currency: 'USD',
    frequency: 'monthly',
    categoryId: 'cat_exp_subscriptions',
  },
];

export const SubscriptionsModuleView: React.FC<SubscriptionsModuleViewProps> = ({
  appData,
  setAppData,
  resumenMes,
  selectedMonth,
  officialRate,
  locale,
  showToast,
  setConfirmDialog,
  onOpenPushCenter,
  autoOpenTrigger,
}) => {
  const subscriptions = appData.subscriptions || [];
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

  // Estado del formulario (Crear / Editar suscripción)
  const [showForm, setShowForm] = useState<boolean>(
    subscriptions.length === 0
  );

  useEffect(() => {
    if (autoOpenTrigger && autoOpenTrigger > 0) {
      setShowForm(true);
    }
  }, [autoOpenTrigger]);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(
    () =>
      expenseCategories.find((c) => c.id === 'cat_exp_subscriptions')?.id ||
      expenseCategories[0]?.id ||
      'cat_exp_subscriptions'
  );
  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [customRateStr, setCustomRateStr] = useState<string>(() =>
    officialRate
      ? String(officialRate)
      : appData.settings.defaultExchangeRate
        ? String(appData.settings.defaultExchangeRate)
        : ''
  );
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return obtenerFechaLocalIso(d);
  });
  const [alertDaysBefore, setAlertDaysBefore] = useState<number>(5);
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [defaultWalletId, setDefaultWalletId] = useState<string>(
    () => activeWallets[0]?.id || 'wallet_zelle'
  );
  const [notes, setNotes] = useState<string>('');

  // Filtro de vista de tarjetas
  const [filterTab, setFilterTab] = useState<
    'all' | 'active' | 'alert' | 'paused'
  >('all');

  // Estado del modal de pago
  const [payingSubscription, setPayingSubscription] =
    useState<Subscription | null>(null);

  const summary = useMemo(
    () =>
      calcularResumenSuscripciones(appData, selectedMonth, officialRate),
    [appData, selectedMonth, officialRate]
  );

  const filteredItems = useMemo(() => {
    return summary.items.filter((item) => {
      if (filterTab === 'active') return item.subscription.status === 'active';
      if (filterTab === 'paused') return item.subscription.status === 'paused';
      if (filterTab === 'alert') return item.isWithinAlertWindow;
      return true;
    });
  }, [summary.items, filterTab]);

  const resetForm = () => {
    setEditingSubId(null);
    setName('');
    setAmountStr('');
    setCurrency('USD');
    setFrequency('monthly');
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setNextBillingDate(obtenerFechaLocalIso(d));
    setAlertDaysBefore(5);
    setStatus('active');
    setNotes('');
  };

  const handleApplyPreset = (preset: (typeof POPULAR_PRESETS)[number]) => {
    setName(preset.name);
    setAmountStr(preset.amount.toFixed(2));
    setCurrency(preset.currency);
    setFrequency(preset.frequency);
    if (expenseCategories.some((c) => c.id === preset.categoryId)) {
      setCategoryId(preset.categoryId);
    }
  };

  const handleEditSubscription = (sub: Subscription) => {
    setEditingSubId(sub.id);
    setName(sub.name);
    setCategoryId(sub.categoryId);
    setAmountStr(sub.amount.toFixed(2));
    setCurrency(sub.currency === 'VES' ? 'VES' : 'USD');
    if (sub.exchangeRate) {
      setCustomRateStr(String(sub.exchangeRate));
    }
    setFrequency(sub.frequency);
    setNextBillingDate(sub.nextBillingDate);
    setAlertDaysBefore(sub.alertDaysBefore);
    setStatus(sub.status);
    setDefaultWalletId(
      sub.defaultWalletId || activeWallets[0]?.id || 'wallet_zelle'
    );
    setNotes(sub.notes || '');
    setShowForm(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Ingresa el nombre de la suscripción.', 'error');
      return;
    }
    const parsedAmount = Number(amountStr.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast('Ingresa un monto válido mayor que 0.', 'error');
      return;
    }

    const effectiveRate =
      currency === 'VES'
        ? officialRate && officialRate > 0
          ? officialRate
          : Number(customRateStr.replace(',', '.')) || 1
        : null;

    if (editingSubId) {
      setAppData((prev) =>
        actualizarSuscripcionEnAppData(
          prev,
          editingSubId,
          {
            name: name.trim(),
            categoryId,
            amount: parsedAmount,
            currency,
            exchangeRate: effectiveRate,
            frequency,
            nextBillingDate,
            alertDaysBefore,
            status,
            defaultWalletId,
            notes,
          },
          officialRate
        )
      );
      showToast(`Suscripción "${name.trim()}" actualizada.`, 'success');
    } else {
      const newSub = crearSuscripcion(
        {
          name: name.trim(),
          categoryId,
          amount: parsedAmount,
          currency,
          exchangeRate: effectiveRate,
          frequency,
          nextBillingDate,
          alertDaysBefore,
          status,
          defaultWalletId,
          notes,
        },
        officialRate
      );
      setAppData((prev) => ({
        ...prev,
        subscriptions: [newSub, ...(prev.subscriptions || [])],
      }));
      showToast(
        status === 'active'
          ? `Suscripción "${newSub.name}" creada. Su monto ahora se proyecta en tu Saldo Proyectado sin tocar tu Saldo Real.`
          : `Suscripción "${newSub.name}" creada en estado Pausada.`,
        'success'
      );
    }

    resetForm();
    setShowForm(false);
  };

  const handleToggleStatus = (sub: Subscription) => {
    setAppData((prev) => alternarEstadoSuscripcionEnAppData(prev, sub.id));
    showToast(
      sub.status === 'active'
        ? `"${sub.name}" pausada: dejó de restar en tu Saldo Proyectado.`
        : `"${sub.name}" reactivada: ahora vuelve a proyectarse en tu Saldo Proyectado.`,
      'info'
    );
  };

  const handleDeleteSubscription = (sub: Subscription) => {
    setConfirmDialog({
      title: 'Eliminar suscripción',
      message: `¿Deseas eliminar la suscripción "${sub.name}"? Los pagos históricos que ya registraste en tus billeteras se conservarán intactos.`,
      confirmLabel: 'Sí, eliminar suscripción',
      danger: true,
      onConfirm: () => {
        setAppData((prev) => eliminarSuscripcionEnAppData(prev, sub.id));
        setConfirmDialog(null);
        showToast('Suscripción eliminada.', 'info');
      },
    });
  };

  const handleConfirmPaySubscription = (
    subId: string,
    payment: PaySubscriptionInput
  ) => {
    const targetSub = subscriptions.find((s) => s.id === subId);
    const nextDate = targetSub
      ? avanzarFechaSiguienteCiclo(
          targetSub.nextBillingDate,
          targetSub.frequency
        )
      : '';

    setAppData((prev) =>
      registrarPagoSuscripcionEnAppData(prev, subId, payment, officialRate)
    );
    const feeMsg =
      payment.isInterbankTransfer && payment.interbankFeeAmount && payment.interbankFeeAmount > 0
        ? ` (+ comisión bancaria de ${formatearMonto(payment.interbankFeeAmount, payment.currency, locale)})`
        : '';
    showToast(
      `Pago (${payment.paymentMethod || 'Suscripción'})${feeMsg} registrado en tu billetera. El próximo cobro avanzó al ${nextDate}.`,
      'success'
    );
  };

  const getCategoryName = (catId: string): string =>
    appData.categories.find((c) => c.id === catId)?.name || 'Suscripciones';

  const getWalletName = (wId?: string): string =>
    (appData.wallets || []).find((w) => w.id === wId)?.name || 'Billetera';

  return (
    <div className="space-y-6">
      {/* Cabecera del Gestor de Suscripciones */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[var(--pink-primary)] flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Pagos Recurrentes · Proyección Automática Multimoneda</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Gestor de Suscripciones
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
            Las suscripciones <strong>Activas</strong> restan automáticamente del{' '}
            <strong>Saldo Proyectado</strong> del mes en curso, pero{' '}
            <strong>nunca del Saldo Real</strong>. Al ejecutar{' '}
            <strong>«Registrar Pago»</strong>, se descuenta el egreso real en tu
            billetera y la fecha de próximo cobro avanza al siguiente ciclo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="px-4 py-2.5 rounded-xl bg-[var(--pink-primary)] text-white text-xs font-semibold hover:bg-[var(--pink-dark)] transition-colors flex items-center gap-2 self-start md:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? 'Ocultar formulario' : 'Nueva Suscripción'}</span>
        </button>
      </div>

      {/* Barra de Notificaciones Push integrada con el Service Worker de la PWA */}
      <PushModuleInlineBar
        kind="subscription"
        appData={appData}
        showToast={showToast}
        onOpenPushCenter={onOpenPushCenter}
      />

      {/* KPIs de Enlace con Saldos (Real vs Proyectado) y Alertas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Saldo Real Disponible</span>
            <Wallet className="w-4 h-4 text-[var(--income-color)]" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(
              resumenMes.dineroDisponibleEstimadoUsd,
              'USD',
              locale
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Intacto hasta que confirmes el pago de cada suscripción.
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Reserva en Saldo Proyectado</span>
            <RefreshCw className="w-4 h-4 text-[var(--expense-color)]" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--expense-color)]">
            -{formatearMonto(summary.impactoProyectadoMesUsd, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            {summary.activasCount} activa(s) · Restan solo al Saldo Proyectado del mes.
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Saldo Proyectado del Mes</span>
            <Layers className="w-4 h-4 text-[var(--pink-primary)]" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--pink-primary)]">
            {formatearMonto(resumenMes.saldoProyectadoUsd, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Disponible tras descontar tus suscripciones activas y pendientes.
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Alertas de Corte Próximo</span>
            <Bell className="w-4 h-4 text-amber-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono-tabular ${
              summary.enAlertaCount > 0
                ? 'text-amber-400'
                : 'text-[var(--income-color)]'
            }`}
          >
            {summary.enAlertaCount > 0
              ? `${summary.enAlertaCount} en aviso`
              : '0 alertas hoy'}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Costo mensual equiv.:{' '}
            {formatearMonto(summary.gastoMensualEquivalenteUsd, 'USD', locale)}/mes
          </p>
        </div>
      </div>

      {/* Formulario de Creación / Edición de Suscripción */}
      {showForm && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--pink-primary)]/40 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-divider)] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {editingSubId
                    ? 'Editar Suscripción'
                    : 'Registrar Nueva Suscripción'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Configura el monto en USD o Bolívares, frecuencia, fecha de próximo cobro y días de aviso previos al corte.
                </p>
              </div>
            </div>

            {!editingSubId && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--text-secondary)] mr-1">
                  Plantillas rápidas:
                </span>
                {POPULAR_PRESETS.slice(0, 5).map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Nombre de la suscripción *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Netflix, Spotify, Internet Fibra, Gimnasio..."
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Categoría
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
                  Billetera sugerida al pagar
                </label>
                <select
                  value={defaultWalletId}
                  onChange={(e) => setDefaultWalletId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Monto *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="Ej: 9.99"
                  required
                  className="w-full px-3.5 py-2 text-sm font-mono-tabular font-bold rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Moneda (Bs / $)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      currency === 'USD'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('VES')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      currency === 'VES'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    Bolívares (Bs)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Frecuencia
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFrequency('monthly')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      frequency === 'monthly'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    onClick={() => setFrequency('annual')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                      frequency === 'annual'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    Anual
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Fecha de Próximo Cobro *
                </label>
                <input
                  type="date"
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono-tabular rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Días de Aviso (Alerta)
                </label>
                <div className="flex items-center gap-1.5">
                  {[3, 5, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAlertDaysBefore(d)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-mono-tabular font-semibold border transition-colors ${
                        alertDaysBefore === d
                          ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                          : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={alertDaysBefore}
                    onChange={(e) =>
                      setAlertDaysBefore(
                        Math.max(0, Math.min(60, Number(e.target.value) || 0))
                      )
                    }
                    className="w-14 px-2 py-2 text-center text-xs font-mono-tabular rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                    title="Días de anticipación para resaltar la tarjeta en alerta"
                  />
                </div>
              </div>
            </div>

            {currency === 'VES' && (
              <UsdToVesHelper
                officialRate={officialRate}
                defaultManualRate={appData.settings.defaultExchangeRate}
                currentRate={Number(customRateStr.replace(',', '.')) || officialRate}
                locale={locale}
                compact
                onApplyVesAmount={(vesStr, usedRate) => {
                  setAmountStr(vesStr);
                  setCustomRateStr(String(usedRate));
                }}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Estado de la Suscripción
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      status === 'active'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    Activa (Proyecta)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('paused')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                      status === 'paused'
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    Pausada
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Notas adicionales (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Plan familiar compartido, renovar con tarjeta virtual..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-divider)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <Info className="w-4 h-4 text-[var(--pink-primary)] shrink-0" />
                <span>
                  Si faltan <strong>{alertDaysBefore} día(s) o menos</strong>{' '}
                  para el corte, la tarjeta se resaltará automáticamente con una
                  alerta visual.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {editingSubId
                      ? 'Guardar Cambios'
                      : 'Guardar Suscripción'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filtros y Vista de Tarjetas (Subscription Cards) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            Mis Suscripciones ({filteredItems.length})
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `Todas (${summary.items.length})` },
                { id: 'active', label: `Activas (${summary.activasCount})` },
                {
                  id: 'alert',
                  label: `En Alerta (${summary.enAlertaCount})`,
                },
                { id: 'paused', label: `Pausadas (${summary.pausadasCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  filterTab === tab.id
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border-hairline)] text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-[var(--text-primary)]">
              No hay suscripciones en esta vista
            </h4>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              Registra tus servicios recurrentes (streaming, internet, gimnasio,
              software) para proyectar su impacto en el Saldo Proyectado del mes
              y recibir alertas antes de cada fecha de corte.
            </p>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-4 py-2 rounded-xl bg-[var(--pink-primary)] text-white text-xs font-semibold hover:bg-[var(--pink-dark)] inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar primera suscripción</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const {
                subscription: sub,
                effectiveAmountUsd,
                effectiveAmountVes,
                daysUntilBilling,
                alertState,
                isWithinAlertWindow,
                isPendingThisMonth,
              } = item;

              const isPaused = sub.status === 'paused';
              const isOverdueOrToday =
                alertState === 'overdue' || alertState === 'due_today';

              // Resaltado visual de la tarjeta cuando está dentro de los Días de Aviso
              const cardSurfaceClasses = isPaused
                ? 'bg-[var(--surface)]/65 border-[var(--border-hairline)] opacity-80'
                : isOverdueOrToday
                  ? 'bg-rose-500/[0.08] border-rose-500/60 shadow-sm'
                  : isWithinAlertWindow
                    ? 'bg-amber-500/[0.08] border-amber-500/60 shadow-sm'
                    : 'bg-[var(--surface)] border-[var(--border-hairline)]';

              const alertBannerText =
                alertState === 'overdue'
                  ? `Corte vencido hace ${Math.abs(daysUntilBilling)} día(s)`
                  : alertState === 'due_today'
                    ? '¡Día de corte HOY! Confirmar cobro'
                    : alertState === 'within_alert_window'
                      ? `Aviso de corte: faltan ${daysUntilBilling} día(s)`
                      : null;

              return (
                <div
                  key={sub.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${cardSurfaceClasses}`}
                >
                  <div className="space-y-3">
                    {/* Banner superior resaltado si está dentro de los Días de Aviso */}
                    {isWithinAlertWindow && alertBannerText && (
                      <div
                        className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
                          isOverdueOrToday
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/35'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{alertBannerText}</span>
                        </div>
                        <span className="text-[10px] font-mono-tabular opacity-85">
                          Aviso {sub.alertDaysBefore}d
                        </span>
                      </div>
                    )}

                    {/* Encabezado de la tarjeta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                          <span>{getCategoryName(sub.categoryId)}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {sub.frequency === 'annual' ? 'Anual' : 'Mensual'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              isPaused
                                ? 'text-amber-400 font-semibold'
                                : 'text-emerald-400 font-semibold'
                            }
                          >
                            {isPaused ? 'Pausada' : 'Activa'}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-[var(--text-primary)] truncate mt-0.5">
                          {sub.name}
                        </h4>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold font-mono-tabular text-[var(--text-primary)]">
                          {formatearMonto(sub.amount, sub.currency, locale)}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                          {sub.currency === 'VES'
                            ? `≈ ${formatearMonto(effectiveAmountUsd, 'USD', locale)}`
                            : effectiveAmountVes
                              ? `≈ ${formatearMonto(effectiveAmountVes, 'VES', locale)}`
                              : ''}
                        </div>
                      </div>
                    </div>

                    {/* Detalles de Próximo Cobro, Alerta y Estado en Proyección */}
                    <div className="pt-2.5 border-t border-[var(--border-divider)] space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                          Próximo cobro:
                        </span>
                        <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                          {sub.nextBillingDate}{' '}
                          {!isPaused && daysUntilBilling > sub.alertDaysBefore && (
                            <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                              (en {daysUntilBilling}d)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-secondary)]">
                          Impacto en saldos:
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            isPaused
                              ? 'text-[var(--text-secondary)]'
                              : isPendingThisMonth
                                ? 'text-[var(--pink-primary)]'
                                : 'text-emerald-400'
                          }`}
                        >
                          {isPaused
                            ? 'Sin impacto (Pausada)'
                            : isPendingThisMonth
                              ? `Resta ${formatearMonto(effectiveAmountUsd, 'USD', locale)} al Proyectado`
                              : 'Cubierta en el mes actual'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                        <span>
                          Alerta configurada: {sub.alertDaysBefore} día(s) antes
                        </span>
                        {sub.lastPaidDate && (
                          <span>Últ. pago: {sub.lastPaidDate}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="pt-2 border-t border-[var(--border-divider)] space-y-2">
                    <button
                      type="button"
                      onClick={() => setPayingSubscription(sub)}
                      className="w-full py-2 px-3 rounded-xl bg-[var(--pink-primary)] text-white text-xs font-semibold hover:bg-[var(--pink-dark)] transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Registrar Pago (Avanzar Ciclo)</span>
                    </button>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(sub)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1 transition-colors"
                      >
                        {isPaused ? (
                          <>
                            <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Reactivar</span>
                          </>
                        ) : (
                          <>
                            <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span>Pausar</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditSubscription(sub)}
                        className="p-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title="Editar suscripción"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSubscription(sub)}
                        className="p-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                        title="Eliminar suscripción"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Pago */}
      <PaySubscriptionModal
        isOpen={Boolean(payingSubscription)}
        onClose={() => setPayingSubscription(null)}
        subscription={payingSubscription}
        wallets={appData.wallets || []}
        officialRate={officialRate}
        defaultManualRate={appData.settings.defaultExchangeRate}
        preferManualByDefault={appData.settings.preferManualRateByDefault}
        locale={locale}
        onConfirmPay={handleConfirmPaySubscription}
      />
    </div>
  );
};
