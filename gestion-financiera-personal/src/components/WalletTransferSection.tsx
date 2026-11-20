import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  AppDataSchema,
  WalletAccount,
  WalletTransfer,
} from '../types/finance';
import {
  compararRegistrosConHoraRecientesPrimero,
  obtenerFechaLocalIso,
  obtenerInfoHoraProcesoTransaccion,
  ResumenBilleteraItem,
} from '../utils/calculations';
import { StorageService } from '../utils/storage';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { UsdToVesHelper } from './UsdToVesHelper';

interface WalletTransferSectionProps {
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  resumenBilleteras: ResumenBilleteraItem[];
  effectiveConversionRate: number | null;
  locale: 'es-VE' | 'en-US';
  showToast: (text: string, kind?: 'success' | 'error' | 'info') => void;
}

export const WalletTransferSection: React.FC<WalletTransferSectionProps> = ({
  appData,
  setAppData,
  resumenBilleteras,
  effectiveConversionRate,
  locale,
  showToast,
}) => {
  const sourceWallets = useMemo(
    () =>
      (appData.wallets || []).filter(
        (w) => w.active && !w.isThirdPartyExpenseAccount
      ),
    [appData.wallets]
  );

  const destinationWallets = useMemo(
    () => (appData.wallets || []).filter((w) => w.active),
    [appData.wallets]
  );

  const defaultRate = Number(
    (
      effectiveConversionRate ||
      appData.settings.lastOfficialRate ||
      appData.settings.defaultExchangeRate ||
      450
    ).toFixed(2)
  );

  const [sourceWalletId, setSourceWalletId] = useState<string>(() => {
    const firstUsd = sourceWallets.find((w) => w.currency !== 'VES');
    return firstUsd?.id || sourceWallets[0]?.id || '';
  });

  const [destinationWalletId, setDestinationWalletId] = useState<string>(() => {
    const firstVes = destinationWallets.find(
      (w) => w.currency === 'VES' && !w.isThirdPartyExpenseAccount
    );
    if (firstVes && firstVes.id !== sourceWalletId) return firstVes.id;
    const other = destinationWallets.find((w) => w.id !== sourceWalletId);
    return other?.id || '';
  });

  const [date, setDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [amountOutInput, setAmountOutInput] = useState<string>('');
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() =>
    String(defaultRate)
  );
  const [manualCreditOverride, setManualCreditOverride] = useState<string>('');
  const [isManualCreditMode, setIsManualCreditMode] = useState<boolean>(false);
  const [feeMode, setFeeMode] = useState<'none' | 'pago_movil' | 'transferencia'>('none');
  const [notes, setNotes] = useState<string>('');

  const sourceWallet = useMemo<WalletAccount | undefined>(
    () => (appData.wallets || []).find((w) => w.id === sourceWalletId),
    [appData.wallets, sourceWalletId]
  );

  const destinationWallet = useMemo<WalletAccount | undefined>(
    () => (appData.wallets || []).find((w) => w.id === destinationWalletId),
    [appData.wallets, destinationWalletId]
  );

  const sourceWalletSummary = useMemo(
    () => resumenBilleteras.find((wb) => wb.wallet.id === sourceWalletId),
    [resumenBilleteras, sourceWalletId]
  );

  const destWalletSummary = useMemo(
    () => resumenBilleteras.find((wb) => wb.wallet.id === destinationWalletId),
    [resumenBilleteras, destinationWalletId]
  );

  const isSameCurrencyFamily = useMemo(() => {
    if (!sourceWallet || !destinationWallet) return false;
    const srcIsVes = sourceWallet.currency === 'VES';
    const dstIsVes = destinationWallet.currency === 'VES';
    return srcIsVes === dstIsVes;
  }, [sourceWallet, destinationWallet]);

  // Ajustar tasa automáticamente si cambia entre misma moneda (1:1) y multimoneda (BCV/P2P)
  useEffect(() => {
    if (!sourceWallet || !destinationWallet) return;
    if (isSameCurrencyFamily) {
      setExchangeRateInput('1');
    } else {
      const currentVal = Number(exchangeRateInput.replace(',', '.'));
      if (!Number.isFinite(currentVal) || currentVal <= 1.05) {
        setExchangeRateInput(String(defaultRate));
      }
    }
    if (sourceWallet.currency !== 'VES') {
      setFeeMode('none');
    }
    setIsManualCreditMode(false);
    setManualCreditOverride('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceWalletId, destinationWalletId, isSameCurrencyFamily]);

  const parsedAmountOut = useMemo(() => {
    const val = Number(amountOutInput.replace(',', '.'));
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [amountOutInput]);

  const parsedRate = useMemo(() => {
    const val = Number(exchangeRateInput.replace(',', '.'));
    return Number.isFinite(val) && val > 0 ? val : 0;
  }, [exchangeRateInput]);

  const computedBankFee = useMemo(() => {
    if (!sourceWallet || sourceWallet.currency !== 'VES' || feeMode === 'none' || parsedAmountOut <= 0) {
      return 0;
    }
    if (feeMode === 'pago_movil') {
      const pct = sourceWallet.comisionPagoMovil != null ? sourceWallet.comisionPagoMovil : 0.3;
      const raw = (parsedAmountOut * pct) / 100;
      return Number(Math.max(14, raw).toFixed(2));
    }
    // transferencia
    const trTipo = sourceWallet.comisionTransferenciaTipo || (sourceWallet.isBonusCard ? 'percent' : 'fixed_ves');
    if (trTipo === 'percent') {
      const pct = sourceWallet.comisionTransferencia != null ? sourceWallet.comisionTransferencia : 1.5;
      return Number(((parsedAmountOut * pct) / 100).toFixed(2));
    }
    const fixedBs =
      sourceWallet.comisionTransferencia != null && sourceWallet.comisionTransferencia >= 1
        ? sourceWallet.comisionTransferencia
        : 54;
    return Number(fixedBs.toFixed(2));
  }, [sourceWallet, feeMode, parsedAmountOut]);

  const autoAmountIn = useMemo(() => {
    if (!sourceWallet || !destinationWallet || parsedAmountOut <= 0 || parsedRate <= 0) {
      return 0;
    }
    return StorageService.calculateWalletTransferCreditAmount(
      parsedAmountOut,
      sourceWallet.currency,
      destinationWallet.currency,
      parsedRate
    );
  }, [sourceWallet, destinationWallet, parsedAmountOut, parsedRate]);

  const effectiveAmountIn = useMemo(() => {
    if (isManualCreditMode) {
      const manualVal = Number(manualCreditOverride.replace(',', '.'));
      return Number.isFinite(manualVal) && manualVal > 0 ? manualVal : 0;
    }
    return autoAmountIn;
  }, [isManualCreditMode, manualCreditOverride, autoAmountIn]);

  const sourceCurrentRealBalance = useMemo(() => {
    if (!sourceWalletSummary) return 0;
    return sourceWalletSummary.wallet.currency === 'VES'
      ? sourceWalletSummary.saldoActualVes
      : sourceWalletSummary.saldoActualUsd;
  }, [sourceWalletSummary]);

  const destCurrentRealBalance = useMemo(() => {
    if (!destWalletSummary) return 0;
    return destWalletSummary.wallet.currency === 'VES'
      ? destWalletSummary.saldoActualVes
      : destWalletSummary.saldoActualUsd;
  }, [destWalletSummary]);

  const sourceNewRealBalance = useMemo(
    () => sourceCurrentRealBalance - parsedAmountOut - computedBankFee,
    [sourceCurrentRealBalance, parsedAmountOut, computedBankFee]
  );

  const destNewRealBalance = useMemo(
    () => destCurrentRealBalance + effectiveAmountIn,
    [destCurrentRealBalance, effectiveAmountIn]
  );

  const handleSwapWallets = () => {
    if (!sourceWalletId || !destinationWalletId) return;
    if (destinationWallet?.isThirdPartyExpenseAccount) {
      showToast(
        `La cuenta de ${destinationWallet.beneficiaryName || destinationWallet.name} solo puede recibir fondos, no puede usarse como cuenta de origen.`,
        'info'
      );
      return;
    }
    const prevSource = sourceWalletId;
    setSourceWalletId(destinationWalletId);
    setDestinationWalletId(prevSource);
  };

  const handleSubmitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWallet || !destinationWallet) {
      showToast('Selecciona la Wallet Origen y la Wallet Destino.', 'error');
      return;
    }
    if (sourceWallet.id === destinationWallet.id) {
      showToast(
        'La Wallet Origen y la Wallet Destino deben ser cuentas diferentes.',
        'error'
      );
      return;
    }
    if (parsedAmountOut <= 0) {
      showToast('Ingresa un monto a debitar mayor que cero.', 'error');
      return;
    }
    if (parsedRate <= 0) {
      showToast(
        'Ingresa una tasa de cambio válida para esta operación.',
        'error'
      );
      return;
    }
    if (effectiveAmountIn <= 0) {
      showToast('El monto a acreditar debe ser mayor que cero.', 'error');
      return;
    }

    try {
      const { updatedData, transfer } = StorageService.registerWalletTransfer(
        {
          date,
          sourceWalletId: sourceWallet.id,
          destinationWalletId: destinationWallet.id,
          amountOut: parsedAmountOut,
          exchangeRate: parsedRate,
          amountIn: effectiveAmountIn,
          feeAmount: computedBankFee > 0 ? computedBankFee : undefined,
          feeExchangeRateUsd: defaultRate,
          notes,
        },
        appData
      );

      setAppData(updatedData);
      setAmountOutInput('');
      setManualCreditOverride('');
      setIsManualCreditMode(false);
      setNotes('');

      const srcFormatted = formatearMonto(
        transfer.amountOut,
        transfer.sourceCurrency === 'VES' ? 'VES' : 'USD',
        locale
      );
      const dstFormatted = formatearMonto(
        transfer.amountIn,
        transfer.destinationCurrency === 'VES' ? 'VES' : 'USD',
        locale
      );

      if (destinationWallet.isThirdPartyExpenseAccount) {
        showToast(
          `Dinero enviado a ${destinationWallet.name}: Se debitaron -${srcFormatted}${computedBankFee > 0 ? ` (+ ${formatearMonto(computedBankFee, 'VES', locale)} comisión)` : ''} de ${sourceWallet.name} y se sumaron +${dstFormatted} al acumulado familiar y a tus Gastos del mes.`,
          'success'
        );
      } else {
        showToast(
          `Transferencia registrada: -${srcFormatted}${computedBankFee > 0 ? ` (+ ${formatearMonto(computedBankFee, 'VES', locale)} comisión)` : ''} en ${sourceWallet.name} → +${dstFormatted} en ${destinationWallet.name}.`,
          'success'
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar la transferencia entre wallets.',
        'error'
      );
    }
  };

  const handleDeleteTransfer = (tr: WalletTransfer) => {
    const updatedData = StorageService.deleteWalletTransfer(tr.id, appData);
    setAppData(updatedData);
    showToast(
      'Transferencia revertida. Los saldos reales de ambas Wallets han sido restablecidos.',
      'info'
    );
  };

  const transfersList = useMemo(
    () =>
      [...(appData.walletTransfers || [])].sort((a, b) =>
        compararRegistrosConHoraRecientesPrimero(a, b)
      ),
    [appData.walletTransfers]
  );

  const getWalletName = (id: string) =>
    (appData.wallets || []).find((w) => w.id === id)?.name || 'Cuenta eliminada';

  const getWalletColor = (id: string) =>
    (appData.wallets || []).find((w) => w.id === id)?.color || '#8A79A6';

  const conversionFormulaExplanation = useMemo(() => {
    if (!sourceWallet || !destinationWallet) return '';
    const srcIsVes = sourceWallet.currency === 'VES';
    const dstIsVes = destinationWallet.currency === 'VES';
    if (!srcIsVes && dstIsVes) {
      return `Conversión ${sourceWallet.currency} → Bs: Monto a debitar × Tasa (${formatearTasa(parsedRate || defaultRate, locale)} Bs/$)`;
    }
    if (srcIsVes && !dstIsVes) {
      return `Conversión Bs → ${destinationWallet.currency}: Monto a debitar ÷ Tasa (${formatearTasa(parsedRate || defaultRate, locale)} Bs/$)`;
    }
    return `Transferencia misma moneda (${sourceWallet.currency} → ${destinationWallet.currency}): Monto × Factor (${parsedRate || 1})`;
  }, [sourceWallet, destinationWallet, parsedRate, defaultRate, locale]);

  return (
    <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-6">
      {/* Encabezado del Módulo 1 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)]">
              <ArrowLeftRight className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Transferencias entre Wallets con Tasa Personalizada (Conversor P2P)
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Mueve tu propio dinero entre tus cuentas (ej. de Binance USDT a Mercantil Bs) o envía desde tu cuenta Mercantil a una Cuenta Familiar (Mamá).
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--income-bg)] text-[var(--income-color)] text-[11px] font-semibold self-start md:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span>Descuenta de la cuenta origen al instante</span>
        </div>
      </div>

      {/* Formulario del Conversor P2P entre Wallets */}
      <form onSubmit={handleSubmitTransfer} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-end">
          {/* 1. Wallet Origen */}
          <div className="lg:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[var(--text-primary)]">
                1. Wallet Origen (Donde se debita)
              </label>
              {sourceWallet && (
                <span className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                  Saldo Real:{' '}
                  <strong className="text-[var(--text-primary)]">
                    {formatearMonto(
                      sourceCurrentRealBalance,
                      sourceWallet.currency === 'VES' ? 'VES' : 'USD',
                      locale
                    )}
                  </strong>
                </span>
              )}
            </div>
            <select
              value={sourceWalletId}
              onChange={(e) => setSourceWalletId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl font-medium"
            >
              {sourceWallets.map((w) => {
                const wb = resumenBilleteras.find((item) => item.wallet.id === w.id);
                const bal = wb
                  ? w.currency === 'VES'
                    ? wb.saldoActualVes
                    : wb.saldoActualUsd
                  : 0;
                return (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency}) — Disp:{' '}
                    {formatearMonto(
                      bal,
                      w.currency === 'VES' ? 'VES' : 'USD',
                      locale
                    )}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Botón Intercambiar Origen <-> Destino */}
          <div className="lg:col-span-1 flex justify-center">
            <button
              type="button"
              onClick={handleSwapWallets}
              title="Intercambiar Wallet Origen y Destino"
              className="p-2.5 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] text-[var(--pink-primary)] border border-[var(--border-input)] transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Wallet Destino */}
          <div className="lg:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-[var(--text-primary)]">
                2. Wallet Destino (Donde se acredita)
              </label>
              {destinationWallet && (
                <span className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                  {destinationWallet.isThirdPartyExpenseAccount
                    ? 'Acumulado histórico:'
                    : 'Saldo Real:'}{' '}
                  <strong className="text-[var(--text-primary)]">
                    {formatearMonto(
                      destCurrentRealBalance,
                      destinationWallet.currency === 'VES' ? 'VES' : 'USD',
                      locale
                    )}
                  </strong>
                </span>
              )}
            </div>
            <select
              value={destinationWalletId}
              onChange={(e) => setDestinationWalletId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl font-medium"
            >
              {destinationWallets.map((w) => {
                const wb = resumenBilleteras.find((item) => item.wallet.id === w.id);
                const bal = wb
                  ? w.currency === 'VES'
                    ? wb.saldoActualVes
                    : wb.saldoActualUsd
                  : 0;
                const isTp = Boolean(w.isThirdPartyExpenseAccount);
                return (
                  <option key={w.id} value={w.id}>
                    {isTp ? `👩‍👧‍👦 ${w.name} (${w.currency}) — Uso de ${w.beneficiaryName || 'Familiar'} · Acum:` : `${w.name} (${w.currency}) — Disp:`}{' '}
                    {formatearMonto(
                      bal,
                      w.currency === 'VES' ? 'VES' : 'USD',
                      locale
                    )}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {destinationWallet?.isThirdPartyExpenseAccount && (
          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border-2 border-amber-500/50 text-xs text-[var(--text-primary)] flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="text-amber-600">
                👩‍👧‍👦 Envío a cuenta de gastos familiar ({destinationWallet.beneficiaryName || destinationWallet.name}):
              </strong>{' '}
              Se descontará de tu cuenta <strong>{sourceWallet?.name}</strong> y se sumará al monto pasado este mes, al acumulado histórico de {destinationWallet.name} y a tus <strong>Gastos del mes</strong>.
            </div>
          </div>
        )}

        {sourceWallet?.currency === 'VES' && (
          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                ¿Aplica comisión bancaria en {sourceWallet.name}?
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] block">
                Si transfieres a otro banco o vía Pago Móvil, se descontará la comisión de {sourceWallet.name}.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFeeMode('none')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  feeMode === 'none'
                    ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                    : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                }`}
              >
                Mismo banco (0 Bs)
              </button>
              <button
                type="button"
                onClick={() => setFeeMode('pago_movil')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  feeMode === 'pago_movil'
                    ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                    : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                }`}
              >
                📲 Pago Móvil ({sourceWallet.comisionPagoMovil ?? 0.3}% · mín 14 Bs)
              </button>
              <button
                type="button"
                onClick={() => setFeeMode('transferencia')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  feeMode === 'transferencia'
                    ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                    : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                }`}
              >
                🏦 Transferencia (
                {sourceWallet.comisionTransferenciaTipo === 'percent'
                  ? `${sourceWallet.comisionTransferencia ?? 1.5}%`
                  : `${sourceWallet.comisionTransferencia != null && sourceWallet.comisionTransferencia >= 1 ? sourceWallet.comisionTransferencia : 54} Bs`}
                )
              </button>
            </div>
            {computedBankFee > 0 && (
              <div className="w-full pt-2 border-t border-[var(--border-divider)] flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-[var(--text-secondary)]">
                  Comisión bancaria a descontar de {sourceWallet.name}:
                </span>
                <strong className="text-[var(--expense-color)]">
                  -{formatearMonto(computedBankFee, 'VES', locale)} (Total a debitar:{' '}
                  {formatearMonto(parsedAmountOut + computedBankFee, 'VES', locale)})
                </strong>
              </div>
            )}
          </div>
        )}

        {/* Fila 2: Monto a debitar, Tasa de Cambio de esta operación, Monto a acreditar (Autocalculado) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Monto a debitar (moneda origen) */}
          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Monto a debitar ({sourceWallet?.currency || 'USD'})
              </label>
              {sourceCurrentRealBalance > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setAmountOutInput(
                      String(
                        Number(
                          sourceCurrentRealBalance.toFixed(
                            sourceWallet?.currency === 'VES' ? 2 : 2
                          )
                        )
                      )
                    )
                  }
                  className="text-[10px] font-semibold text-[var(--pink-primary)] hover:underline"
                >
                  Usar máximo disponible
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={amountOutInput}
                onChange={(e) => setAmountOutInput(e.target.value)}
                placeholder={
                  sourceWallet?.currency === 'VES' ? 'Ej. 5000.00' : 'Ej. 25.00'
                }
                className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono-tabular font-semibold text-[var(--text-secondary)]">
                {sourceWallet?.currency || 'USD'}
              </span>
            </div>
            {sourceWallet?.currency === 'VES' && (
              <UsdToVesHelper
                officialRate={appData.settings.lastOfficialRate}
                defaultManualRate={appData.settings.defaultExchangeRate}
                currentRate={Number(exchangeRateInput) || effectiveConversionRate}
                locale={locale}
                compact
                label="Calcular Bs desde $:"
                onApplyVesAmount={(vesStr, usedRate) => {
                  setAmountOutInput(vesStr);
                  if (!isSameCurrencyFamily && usedRate > 0) {
                    setExchangeRateInput(String(usedRate));
                  }
                }}
              />
            )}
            <p className="text-[11px] text-[var(--text-secondary)]">
              Se descontará del Saldo Real de{' '}
              <strong className="text-[var(--text-primary)]">
                {sourceWallet?.name || 'Wallet Origen'}
              </strong>
              .
            </p>
          </div>

          {/* Tasa de Cambio de esta operación */}
          <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between gap-1">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Tasa de Cambio de esta operación
              </label>
              <div className="flex items-center gap-1">
                {!isSameCurrencyFamily && appData.settings.lastOfficialRate && (
                  <button
                    type="button"
                    onClick={() => {
                      setExchangeRateInput(
                        String(appData.settings.lastOfficialRate)
                      );
                      setIsManualCreditMode(false);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--pink-light)] text-[var(--pink-primary)] hover:opacity-90"
                  >
                    BCV
                  </button>
                )}
                {!isSameCurrencyFamily &&
                  appData.settings.defaultExchangeRate && (
                    <button
                      type="button"
                      onClick={() => {
                        setExchangeRateInput(
                          String(appData.settings.defaultExchangeRate)
                        );
                        setIsManualCreditMode(false);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--lavender-soft)] text-[var(--lavender-text)] hover:opacity-90"
                    >
                      Manual
                    </button>
                  )}
                {isSameCurrencyFamily && (
                  <button
                    type="button"
                    onClick={() => {
                      setExchangeRateInput('1');
                      setIsManualCreditMode(false);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]"
                  >
                    1:1
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={exchangeRateInput}
                onChange={(e) => {
                  setExchangeRateInput(e.target.value);
                  setIsManualCreditMode(false);
                }}
                placeholder="Ej. 64.50"
                className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                {isSameCurrencyFamily ? 'Factor' : 'Bs / USD'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {conversionFormulaExplanation}
            </p>
          </div>

          {/* Monto a acreditar (moneda destino - cálculo automático) */}
          <div className="p-4 rounded-xl bg-[var(--income-bg)]/50 border border-[var(--income-color)]/30 space-y-2">
            <div className="flex items-center justify-between gap-1">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Monto a acreditar ({destinationWallet?.currency || 'VES'})
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!isManualCreditMode) {
                    setManualCreditOverride(
                      autoAmountIn > 0 ? String(autoAmountIn) : ''
                    );
                    setIsManualCreditMode(true);
                  } else {
                    setIsManualCreditMode(false);
                    setManualCreditOverride('');
                  }
                }}
                className="text-[10px] font-semibold text-[var(--income-color)] hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>
                  {isManualCreditMode ? 'Volver a automático' : 'Ajustar manual'}
                </span>
              </button>
            </div>

            {isManualCreditMode ? (
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={manualCreditOverride}
                  onChange={(e) => {
                    const val = e.target.value;
                    setManualCreditOverride(val);
                    const num = Number(val.replace(',', '.'));
                    if (
                      Number.isFinite(num) &&
                      num > 0 &&
                      parsedAmountOut > 0 &&
                      sourceWallet &&
                      destinationWallet
                    ) {
                      const srcIsVes = sourceWallet.currency === 'VES';
                      const dstIsVes = destinationWallet.currency === 'VES';
                      if (!srcIsVes && dstIsVes) {
                        setExchangeRateInput(
                          String(Number((num / parsedAmountOut).toFixed(2)))
                        );
                      } else if (srcIsVes && !dstIsVes) {
                        setExchangeRateInput(
                          String(Number((parsedAmountOut / num).toFixed(2)))
                        );
                      } else {
                        setExchangeRateInput(
                          String(Number((num / parsedAmountOut).toFixed(2)))
                        );
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold bg-[var(--surface)] text-[var(--income-color)] border border-[var(--income-color)] rounded-xl"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono-tabular font-semibold text-[var(--income-color)]">
                  {destinationWallet?.currency || 'VES'}
                </span>
              </div>
            ) : (
              <div className="px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-between">
                <span className="text-base font-bold font-mono-tabular text-[var(--income-color)]">
                  +
                  {formatearMonto(
                    effectiveAmountIn,
                    destinationWallet?.currency === 'VES' ? 'VES' : 'USD',
                    locale
                  )}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--income-bg)] text-[var(--income-color)]">
                  Autocalculado
                </span>
              </div>
            )}

            <p className="text-[11px] text-[var(--text-secondary)]">
              Se sumará al Saldo Real de{' '}
              <strong className="text-[var(--text-primary)]">
                {destinationWallet?.name || 'Wallet Destino'}
              </strong>
              .
            </p>
          </div>
        </div>

        {/* Vista previa en vivo del impacto en Saldos Reales */}
        {parsedAmountOut > 0 &&
          effectiveAmountIn > 0 &&
          sourceWallet &&
          destinationWallet && (
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)]">
                <div>
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Impacto en Wallet Origen ({sourceWallet.name})
                  </span>
                  <div className="text-xs font-mono-tabular mt-0.5">
                    <span className="text-[var(--text-secondary)]">
                      {formatearMonto(
                        sourceCurrentRealBalance,
                        sourceWallet.currency === 'VES' ? 'VES' : 'USD',
                        locale
                      )}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 inline mx-1.5 text-[var(--text-secondary)]" />
                    <strong
                      className={
                        sourceNewRealBalance >= 0
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--expense-color)]'
                      }
                    >
                      {formatearMonto(
                        sourceNewRealBalance,
                        sourceWallet.currency === 'VES' ? 'VES' : 'USD',
                        locale
                      )}
                    </strong>
                  </div>
                </div>
                <span className="text-xs font-mono-tabular font-bold text-[var(--expense-color)]">
                  -
                  {formatearMonto(
                    parsedAmountOut,
                    sourceWallet.currency === 'VES' ? 'VES' : 'USD',
                    locale
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)]">
                <div>
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Impacto en Wallet Destino ({destinationWallet.name})
                  </span>
                  <div className="text-xs font-mono-tabular mt-0.5">
                    <span className="text-[var(--text-secondary)]">
                      {formatearMonto(
                        destCurrentRealBalance,
                        destinationWallet.currency === 'VES' ? 'VES' : 'USD',
                        locale
                      )}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 inline mx-1.5 text-[var(--text-secondary)]" />
                    <strong className="text-[var(--income-color)]">
                      {formatearMonto(
                        destNewRealBalance,
                        destinationWallet.currency === 'VES' ? 'VES' : 'USD',
                        locale
                      )}
                    </strong>
                  </div>
                </div>
                <span className="text-xs font-mono-tabular font-bold text-[var(--income-color)]">
                  +
                  {formatearMonto(
                    effectiveAmountIn,
                    destinationWallet.currency === 'VES' ? 'VES' : 'USD',
                    locale
                  )}
                </span>
              </div>
            </div>
          )}

        {/* Fecha, Nota opcional y Botón de Confirmación */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              Fecha de la operación
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-[var(--text-secondary)] mb-1">
              Concepto o referencia P2P (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Cambio Binance USDT a Mercantil Bs vía P2P"
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ejecutar transferencia</span>
          </button>
        </div>
      </form>

      {/* Historial de Transferencias entre Wallets */}
      <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[var(--pink-primary)]" />
            <span>Historial de transferencias internas entre Wallets</span>
          </h3>
          <span className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            {transfersList.length}{' '}
            {transfersList.length === 1 ? 'operación' : 'operaciones'}
          </span>
        </div>

        {transfersList.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-3">
            Aún no has registrado transferencias entre tus Wallets. Cuando cambies saldo entre tus cuentas (ej. USDT a Bs), aparecerán aquí sin sumarse a tus gastos ni ingresos del mes.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)]">
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Wallet Origen (Débito)</th>
                  <th className="py-2.5 px-3">Tasa Operación</th>
                  <th className="py-2.5 px-3">Wallet Destino (Crédito)</th>
                  <th className="py-2.5 px-3">Referencia / Nota</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-divider)]">
                {transfersList.slice(0, 15).map((tr) => {
                  const trTime = obtenerInfoHoraProcesoTransaccion(tr, locale);
                  return (
                  <tr
                    key={tr.id}
                    className="hover:bg-[var(--surface-subtle)]/60 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                      <div className="font-semibold text-[var(--text-primary)]">
                        {tr.date}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        Hora: {trTime.timeFormatted}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: getWalletColor(tr.sourceWalletId),
                          }}
                        />
                        <span>{getWalletName(tr.sourceWalletId)}</span>
                      </div>
                      <div className="font-mono-tabular font-semibold text-[var(--expense-color)]">
                        -
                        {formatearMonto(
                          tr.amountOut,
                          tr.sourceCurrency === 'VES' ? 'VES' : 'USD',
                          locale
                        )}{' '}
                        <span className="text-[10px] font-normal text-[var(--text-secondary)]">
                          ({tr.sourceCurrency})
                        </span>
                      </div>
                      {tr.feeAmount && tr.feeAmount > 0 ? (
                        <div className="text-[10px] font-mono-tabular text-amber-400">
                          Comisión: -{formatearMonto(tr.feeAmount, tr.sourceCurrency === 'VES' ? 'VES' : 'USD', locale)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                      {formatearTasa(tr.exchangeRate, locale)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: getWalletColor(
                              tr.destinationWalletId
                            ),
                          }}
                        />
                        <span>{getWalletName(tr.destinationWalletId)}</span>
                      </div>
                      <div className="font-mono-tabular font-semibold text-[var(--income-color)]">
                        +
                        {formatearMonto(
                          tr.amountIn,
                          tr.destinationCurrency === 'VES' ? 'VES' : 'USD',
                          locale
                        )}{' '}
                        <span className="text-[10px] font-normal text-[var(--text-secondary)]">
                          ({tr.destinationCurrency})
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {tr.notes || 'Transferencia interna P2P'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDeleteTransfer(tr)}
                        title="Revertir y eliminar transferencia"
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--expense-color)] hover:bg-[var(--expense-bg)] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
