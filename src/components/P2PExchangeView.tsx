import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Info,
  Layers,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Trash2,
  User,
  Users,
  Wallet,
  X,
  Calculator,
  Sparkles,
  Edit3,
} from 'lucide-react';
import {
  AppDataSchema,
  CurrencyCode,
  P2PDirection,
  P2POperation,
  P2POperationStatus,
  P2POperationType,
  WalletAccount,
} from '../types/finance';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { obtenerFechaLocalIso } from '../utils/calculations';
import {
  actualizarOperacionP2P,
  calcularResumenP2P,
  ContactP2PGroup,
  CreateP2POperationInput,
  crearOperacionP2P,
  eliminarOperacionP2P,
  liquidarOperacionP2P,
  revertirOperacionP2P,
  SettleP2POperationInput,
} from '../utils/p2pController';

interface SettleP2PModalProps {
  isOpen: boolean;
  onClose: () => void;
  operation: P2POperation | null;
  wallets: WalletAccount[];
  officialRate: number | null;
  locale?: 'es-VE' | 'en-US';
  onConfirmSettle: (operationId: string, input: SettleP2POperationInput) => void;
}

/**
 * MODAL DE LIQUIDACIÓN RÁPIDA:
 * - Si direction === 'receivable': Confirma que recibiste el dinero que te debían (suma al Saldo Real).
 * - Si direction === 'payable': Confirma que ya entregaste los dólares/efectivo que debías (resta del Saldo Real).
 */
export const SettleP2PModal: React.FC<SettleP2PModalProps> = ({
  isOpen,
  onClose,
  operation,
  wallets,
  officialRate,
  locale = 'es-VE',
  onConfirmSettle,
}) => {
  const activeWallets = useMemo(
    () => wallets.filter((w) => w.active && !w.isThirdPartyExpenseAccount),
    [wallets]
  );

  const [settledAt, setSettledAt] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [settledWalletId, setSettledWalletId] = useState<string>('');
  const [settledAmountStr, setSettledAmountStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [settleFeeMode, setSettleFeeMode] = useState<
    'none' | 'pago_movil' | 'transferencia' | 'custom'
  >('none');
  const [settleCustomFeeStr, setSettleCustomFeeStr] = useState<string>('');

  // Sincronizar estado cuando se abre para una operación específica
  React.useEffect(() => {
    if (operation) {
      const isPayable = operation.direction === 'payable';
      setSettledWalletId(
        isPayable
          ? operation.sourceWalletId || activeWallets[0]?.id || ''
          : operation.destinationWalletId || activeWallets[0]?.id || ''
      );
      setSettledAmountStr(
        String(isPayable ? operation.deliveredAmount : operation.expectedAmount)
      );
      setSettledAt(obtenerFechaLocalIso());
      setNotes('');
      setSettleFeeMode('none');
      setSettleCustomFeeStr('');
    }
  }, [operation, activeWallets]);

  if (!isOpen || !operation) return null;

  const isPayable = operation.direction === 'payable';
  const defaultAmount = isPayable
    ? operation.deliveredAmount
    : operation.expectedAmount;
  const targetCurrency = isPayable
    ? operation.deliveredCurrency
    : operation.expectedCurrency;
  const parsedSettledAmount =
    Number(settledAmountStr.replace(',', '.')) || defaultAmount;

  const selectedSettleWallet = activeWallets.find(
    (w) => w.id === settledWalletId
  );

  const computedSettleFeeVes = (() => {
    if (
      !isPayable ||
      targetCurrency !== 'VES' ||
      settleFeeMode === 'none' ||
      parsedSettledAmount <= 0
    ) {
      return 0;
    }
    if (settleFeeMode === 'pago_movil') {
      const pct =
        selectedSettleWallet?.comisionPagoMovil != null
          ? selectedSettleWallet.comisionPagoMovil
          : 0.3;
      const raw = (parsedSettledAmount * pct) / 100;
      return Number(Math.max(14, raw).toFixed(2));
    }
    if (settleFeeMode === 'transferencia') {
      const trTipo =
        selectedSettleWallet?.comisionTransferenciaTipo ||
        (selectedSettleWallet?.isBonusCard ? 'percent' : 'fixed_ves');
      if (trTipo === 'percent') {
        const pct =
          selectedSettleWallet?.comisionTransferencia != null
            ? selectedSettleWallet.comisionTransferencia
            : 1.5;
        return Number(((parsedSettledAmount * pct) / 100).toFixed(2));
      }
      const fixedBs =
        selectedSettleWallet?.comisionTransferencia != null &&
        selectedSettleWallet.comisionTransferencia >= 1
          ? selectedSettleWallet.comisionTransferencia
          : 54;
      return Number(fixedBs.toFixed(2));
    }
    if (settleFeeMode === 'custom') {
      const customVal = Number(settleCustomFeeStr.replace(',', '.'));
      return Number.isFinite(customVal) && customVal > 0
        ? Number(customVal.toFixed(2))
        : 0;
    }
    return 0;
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmSettle(operation.id, {
      settledAt,
      settledWalletId:
        settledWalletId ||
        (isPayable ? operation.sourceWalletId : operation.destinationWalletId),
      settledAmount: parsedSettledAmount,
      notes: notes.trim() || undefined,
      hasBankFee: computedSettleFeeVes > 0,
      bankFeeType: computedSettleFeeVes > 0 ? settleFeeMode : 'none',
      bankFeeAmount: computedSettleFeeVes > 0 ? computedSettleFeeVes : 0,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isPayable
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-500'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {isPayable
                  ? 'Confirmar Entrega de Divisas / Efectivo'
                  : 'Liquidar Operación P2P (Cobrar)'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {isPayable
                  ? `Marcar que ya entregaste el dinero a ${operation.contactName}`
                  : `Cobro recibido de ${operation.contactName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                {isPayable ? 'Monto que debías entregar:' : 'Monto Pactado a Recibir:'}
              </span>
              <span
                className={`font-mono-tabular font-bold text-lg ${
                  isPayable
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {formatearMonto(defaultAmount, targetCurrency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border-divider)]">
              <span className="text-[var(--text-secondary)]">
                {isPayable ? 'Recibido previamente:' : 'Entregado previamente:'}
              </span>
              <span className="font-mono-tabular text-[var(--text-primary)]">
                {isPayable
                  ? operation.alreadyPaidExternally
                    ? operation.expectedAmount > 0
                      ? `${formatearMonto(operation.expectedAmount, operation.expectedCurrency, locale)} (Ya recibido antes · Sin duplicar saldo)`
                      : 'Ya recibido antes (Sin duplicar saldo)'
                    : formatearMonto(
                        operation.expectedAmount,
                        operation.expectedCurrency,
                        locale
                      )
                  : operation.alreadyPaidExternally
                    ? operation.deliveredAmount > 0
                      ? `${formatearMonto(operation.deliveredAmount, operation.deliveredCurrency, locale)} (Ya pagado antes · Sin descuento)`
                      : 'Ya pagado antes (Sin descuento de saldo)'
                    : formatearMonto(
                        operation.deliveredAmount,
                        operation.deliveredCurrency,
                        locale
                      )}
              </span>
            </div>
            {operation.rateDescription && (
              <div className="text-[11px] text-[var(--text-secondary)]">
                Tasa acordada:{' '}
                <strong className="text-[var(--text-primary)]">
                  {operation.rateDescription}
                </strong>
              </div>
            )}
          </div>

          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              isPayable
                ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/30 text-amber-900 dark:text-amber-300'
                : 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
            }`}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {isPayable ? (
                <>
                  Al confirmar que entregaste el dinero, el monto se descontará del{' '}
                  <strong>Saldo Real</strong> de la billetera seleccionada y dejará de figurar como deuda pendiente por entregar.
                </>
              ) : (
                <>
                  Al confirmar, el monto ingresará al <strong>Saldo Real</strong> de la billetera seleccionada y saldrá de tus Cuentas por Cobrar en tránsito.
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {isPayable ? 'Fecha en que entregaste' : 'Fecha de recepción real'}
              </label>
              <input
                type="date"
                value={settledAt}
                onChange={(e) => setSettledAt(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {isPayable
                  ? 'Billetera de donde entregaste'
                  : 'Billetera receptora final'}
              </label>
              <select
                value={settledWalletId}
                onChange={(e) => setSettledWalletId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
              >
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              {isPayable
                ? `Monto efectivamente entregado (${targetCurrency})`
                : `Monto efectivamente recibido (${targetCurrency})`}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={settledAmountStr}
              onChange={(e) => setSettledAmountStr(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm font-mono-tabular font-bold rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
            />
          </div>

          {isPayable && targetCurrency === 'VES' && (
            <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  ¿Este pago en Bolívares tuvo comisión bancaria?
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Marca si al transferir los Bs te cobraron comisión por Pago Móvil o Transferencia.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSettleFeeMode('none')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    settleFeeMode === 'none'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                  }`}
                >
                  Sin comisión (0 Bs)
                </button>
                <button
                  type="button"
                  onClick={() => setSettleFeeMode('pago_movil')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    settleFeeMode === 'pago_movil'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                  }`}
                >
                  📲 Pago Móvil ({selectedSettleWallet?.comisionPagoMovil ?? 0.3}% · mín 14 Bs)
                </button>
                <button
                  type="button"
                  onClick={() => setSettleFeeMode('transferencia')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    settleFeeMode === 'transferencia'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                  }`}
                >
                  🏦 Transferencia (
                  {selectedSettleWallet?.comisionTransferenciaTipo === 'percent'
                    ? `${selectedSettleWallet?.comisionTransferencia ?? 1.5}%`
                    : `${selectedSettleWallet?.comisionTransferencia != null && selectedSettleWallet.comisionTransferencia >= 1 ? selectedSettleWallet.comisionTransferencia : 54} Bs`}
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setSettleFeeMode('custom')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                    settleFeeMode === 'custom'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                  }`}
                >
                  ✏️ Otro monto manual
                </button>
              </div>
              {settleFeeMode === 'custom' && (
                <div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={settleCustomFeeStr}
                    onChange={(e) => setSettleCustomFeeStr(e.target.value)}
                    placeholder="Monto de la comisión en Bs (Ej: 18.50)"
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular font-bold rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </div>
              )}
              {computedSettleFeeVes > 0 && (
                <div className="pt-2 border-t border-[var(--border-divider)] flex items-center justify-between text-xs font-mono-tabular">
                  <span className="text-[var(--text-secondary)]">
                    Comisión a descontar:
                  </span>
                  <strong className="text-rose-600 dark:text-rose-400">
                    -{formatearMonto(computedSettleFeeVes, 'VES', locale)} (Total:{' '}
                    {formatearMonto(
                      parsedSettledAmount + computedSettleFeeVes,
                      'VES',
                      locale
                    )}
                    )
                  </strong>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Nota o comprobante (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isPayable
                  ? 'Ej: Entregué el billete de $20 en efectivo en persona'
                  : 'Ej: Efectivo entregado en persona / Ref Pago Móvil #9384'
              }
              className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-semibold rounded-xl text-white flex items-center gap-1.5 shadow-md ${
                isPayable
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isPayable
                  ? 'Confirmar Entrega y Restar de mi Wallet'
                  : 'Confirmar y Sumar al Saldo Real'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface P2PRateCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  officialRate: number | null;
  locale?: 'es-VE' | 'en-US';
  initialMode?: 'buy_usd' | 'sell_usd' | 'from_ves';
  onApplyCalculation: (data: {
    direction?: P2PDirection;
    deliveredAmount: number;
    deliveredCurrency: CurrencyCode;
    expectedAmount: number;
    expectedCurrency: CurrencyCode;
    agreedRate: number;
    rateDescription: string;
  }) => void;
}

/**
 * CALCULADORA RÁPIDA P2P ($ ⇄ Bs):
 * Permite calcular al instante la equivalencia exacta entre Dólares/USDT y Bolívares
 * tanto cuando compras $ (entregas Bs y te deben $) como cuando vendes $ (te pasaron Bs y tú debes entregar $).
 */
export const P2PRateCalculatorModal: React.FC<P2PRateCalculatorModalProps> = ({
  isOpen,
  onClose,
  officialRate,
  locale = 'es-VE',
  initialMode = 'buy_usd',
  onApplyCalculation,
}) => {
  // Modo de cálculo:
  // 'buy_usd': "Compré $ / USDT con Bs (Me deben $)"
  // 'sell_usd': "Vendí $ / USDT por Bs (Recibí Bs y yo debo entregar $)"
  // 'from_ves': "Tengo Bs → Ver cuántos $ son"
  const [calcMode, setCalcMode] = useState<'buy_usd' | 'sell_usd' | 'from_ves'>(
    'buy_usd'
  );

  // Moneda extranjera deseada (USD o USDT)
  const [foreignCurrency, setForeignCurrency] = useState<CurrencyCode>('USD');

  // Entradas numéricas
  const [usdInputStr, setUsdInputStr] = useState<string>('20');
  const [vesInputStr, setVesInputStr] = useState<string>('');

  // Tasa de cambio
  const [rateSource, setRateSource] = useState<'bcv' | 'custom'>('bcv');
  const [customRateStr, setCustomRateStr] = useState<string>(() =>
    officialRate ? String(officialRate) : '65.50'
  );

  // Sincronizar tasa si cambia la tasa oficial
  React.useEffect(() => {
    if (officialRate && (!customRateStr || customRateStr === '65.50')) {
      setCustomRateStr(String(officialRate));
    }
  }, [officialRate]);

  // Manejar modo inicial al abrir
  React.useEffect(() => {
    if (initialMode === 'from_ves') {
      setCalcMode('from_ves');
    } else if (initialMode === 'sell_usd') {
      setCalcMode('sell_usd');
    } else {
      setCalcMode('buy_usd');
    }
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const activeRate =
    rateSource === 'bcv' && officialRate && officialRate > 0
      ? officialRate
      : Number(customRateStr.replace(',', '.')) || 0;

  const parsedUsd = Number(usdInputStr.replace(',', '.')) || 0;
  const parsedVes = Number(vesInputStr.replace(',', '.')) || 0;

  // Cálculos en tiempo real según el modo
  let calculatedVes = 0;
  let calculatedUsd = 0;

  if (calcMode === 'buy_usd' || calcMode === 'sell_usd') {
    calculatedVes =
      parsedUsd > 0 && activeRate > 0
        ? Number((parsedUsd * activeRate).toFixed(2))
        : 0;
    calculatedUsd = parsedUsd;
  } else {
    calculatedUsd =
      parsedVes > 0 && activeRate > 0
        ? Number((parsedVes / activeRate).toFixed(2))
        : 0;
    calculatedVes = parsedVes;
  }

  const handleApply = () => {
    if (activeRate <= 0) return;

    if (calcMode === 'sell_usd') {
      if (calculatedUsd <= 0 || calculatedVes <= 0) return;
      onApplyCalculation({
        direction: 'payable',
        deliveredAmount: calculatedUsd,
        deliveredCurrency: foreignCurrency,
        expectedAmount: calculatedVes,
        expectedCurrency: 'VES',
        agreedRate: activeRate,
        rateDescription: `1 USD = ${formatearTasa(activeRate, locale)} Bs`,
      });
    } else if (calcMode === 'buy_usd') {
      if (calculatedUsd <= 0 || calculatedVes <= 0) return;
      onApplyCalculation({
        direction: 'receivable',
        deliveredAmount: calculatedVes,
        deliveredCurrency: 'VES',
        expectedAmount: calculatedUsd,
        expectedCurrency: foreignCurrency,
        agreedRate: activeRate,
        rateDescription: `1 USD = ${formatearTasa(activeRate, locale)} Bs`,
      });
    } else {
      if (calculatedVes <= 0 || calculatedUsd <= 0) return;
      onApplyCalculation({
        direction: 'receivable',
        deliveredAmount: calculatedVes,
        deliveredCurrency: 'VES',
        expectedAmount: calculatedUsd,
        expectedCurrency: foreignCurrency,
        agreedRate: activeRate,
        rateDescription: `1 USD = ${formatearTasa(activeRate, locale)} Bs`,
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-blue-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Calculadora de Cambio P2P ($ ⇄ Bs)
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Calcula compras o ventas de divisas y aplícalo en 1 clic
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Pestañas de Modo */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setCalcMode('buy_usd')}
              className={`py-2 px-2 text-[11px] font-semibold rounded-lg transition-all text-center ${
                calcMode === 'buy_usd'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Compré $ (Me deben $)
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('sell_usd')}
              className={`py-2 px-2 text-[11px] font-semibold rounded-lg transition-all text-center ${
                calcMode === 'sell_usd'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Vendí $ (Yo debo $)
            </button>
            <button
              type="button"
              onClick={() => setCalcMode('from_ves')}
              className={`py-2 px-2 text-[11px] font-semibold rounded-lg transition-all text-center ${
                calcMode === 'from_ves'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Tengo Bs → Ver $
            </button>
          </div>

          {/* 1. CONFIGURACIÓN DE TASA DE CAMBIO */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Tasa de cambio aplicada
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!officialRate}
                  onClick={() => setRateSource('bcv')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    rateSource === 'bcv' && officialRate
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] disabled:opacity-40'
                  }`}
                >
                  BCV {officialRate ? `(${formatearTasa(officialRate, locale)})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setRateSource('custom')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                    rateSource === 'custom' || !officialRate
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                  }`}
                >
                  Tasa Personalizada
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-mono-tabular text-[var(--text-secondary)]">
                1 USD =
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={rateSource === 'bcv' && officialRate ? formatearTasa(officialRate, locale) : customRateStr}
                onChange={(e) => {
                  setRateSource('custom');
                  setCustomRateStr(e.target.value);
                }}
                placeholder="Escribe la tasa pactada en Bs..."
                className="w-full pl-16 pr-10 py-1.5 text-sm font-bold font-mono-tabular rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-3 top-2 text-xs font-mono-tabular text-[var(--text-secondary)]">
                Bs
              </span>
            </div>
          </div>

          {/* 2. CAMPOS DE ENTRADA SEGÚN EL MODO */}
          {calcMode === 'buy_usd' || calcMode === 'sell_usd' ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    {calcMode === 'sell_usd'
                      ? '¿Cuántos Dólares / USDT vendiste y debes entregar?'
                      : '¿Cuántos Dólares / USDT vas a comprar o recibir?'}
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setForeignCurrency('USD')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        foreignCurrency === 'USD'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForeignCurrency('USDT')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        foreignCurrency === 'USDT'
                          ? 'bg-teal-600 text-white'
                          : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      USDT
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span
                    className={`absolute left-3.5 top-2.5 text-base font-bold font-mono-tabular ${
                      calcMode === 'sell_usd'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={usdInputStr}
                    onChange={(e) => setUsdInputStr(e.target.value)}
                    placeholder="Ej: 20"
                    autoFocus
                    className={`w-full pl-8 pr-3 py-2 text-xl font-bold font-mono-tabular rounded-xl bg-[var(--surface-subtle)] border focus:outline-none ${
                      calcMode === 'sell_usd'
                        ? 'border-amber-500/50 text-amber-800 dark:text-amber-400 focus:border-amber-500'
                        : 'border-emerald-500/50 text-emerald-800 dark:text-emerald-400 focus:border-emerald-500'
                    }`}
                  />
                </div>

                {/* Atajos rápidos de montos típicos de compra/venta P2P */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-[var(--text-secondary)]">Atajos:</span>
                  {[5, 10, 15, 20, 50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setUsdInputStr(String(amt))}
                      className={`px-2 py-0.5 text-[11px] font-mono-tabular rounded-md transition-colors ${
                        parsedUsd === amt
                          ? calcMode === 'sell_usd'
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-emerald-600 text-white font-bold'
                          : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] dark:text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* TARJETA DE RESULTADO: BOLÍVARES */}
              <div
                className={`p-4 rounded-xl border space-y-1 ${
                  calcMode === 'sell_usd'
                    ? 'bg-amber-500/10 dark:bg-amber-950/25 border-amber-500/35'
                    : 'bg-blue-500/10 dark:bg-blue-950/25 border-blue-500/35'
                }`}
              >
                <div
                  className={`flex items-center justify-between text-xs font-medium ${
                    calcMode === 'sell_usd'
                      ? 'text-amber-900 dark:text-amber-300'
                      : 'text-blue-900 dark:text-blue-300'
                  }`}
                >
                  <span>
                    {calcMode === 'sell_usd'
                      ? 'Bolívares recibidos por esta venta:'
                      : 'Monto exacto a transferir en Bolívares:'}
                  </span>
                  <span className="font-mono-tabular text-[11px] font-bold">
                    {parsedUsd} {foreignCurrency} × {formatearTasa(activeRate, locale)} Bs
                  </span>
                </div>
                <div
                  className={`text-2xl font-bold font-mono-tabular ${
                    calcMode === 'sell_usd'
                      ? 'text-amber-800 dark:text-amber-400'
                      : 'text-blue-700 dark:text-blue-400'
                  }`}
                >
                  {formatearMonto(calculatedVes, 'VES', locale)}
                </div>
                <p
                  className={`text-[11px] ${
                    calcMode === 'sell_usd'
                      ? 'text-amber-900 dark:text-amber-200'
                      : 'text-blue-900 dark:text-blue-300'
                  }`}
                >
                  {calcMode === 'sell_usd' ? (
                    <>
                      Se configurará como <strong>Yo debo entregar {formatearMonto(calculatedUsd, foreignCurrency, locale)}</strong> y que recibiste {formatearMonto(calculatedVes, 'VES', locale)}.
                    </>
                  ) : (
                    <>
                      Se configurará como <strong>Me deben {formatearMonto(calculatedUsd, foreignCurrency, locale)}</strong> entregando {formatearMonto(calculatedVes, 'VES', locale)}.
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  ¿Cuántos Bolívares vas a transferir? (Monto en Bs)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold font-mono-tabular text-[var(--text-secondary)]">
                    Bs
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={vesInputStr}
                    onChange={(e) => setVesInputStr(e.target.value)}
                    placeholder="Ej: 655.00"
                    autoFocus
                    className="w-full pl-10 pr-3 py-2 text-xl font-bold font-mono-tabular rounded-xl bg-[var(--surface-subtle)] border border-blue-500/40 text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* TARJETA DE RESULTADO: DÓLARES A RECIBIR */}
              <div className="p-4 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/25 border border-emerald-500/35 space-y-1">
                <div className="flex items-center justify-between text-xs font-medium text-emerald-900 dark:text-emerald-300">
                  <span>Monto que recibirás ({foreignCurrency}):</span>
                  <span className="font-mono-tabular text-[11px] font-bold text-emerald-800 dark:text-emerald-400/80">
                    {parsedVes} Bs ÷ {formatearTasa(activeRate, locale)}
                  </span>
                </div>
                <div className="text-2xl font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
                  {formatearMonto(calculatedUsd, foreignCurrency, locale)}
                </div>
                <p className="text-[11px] text-emerald-900 dark:text-emerald-300/80">
                  Este monto se colocará en tu <strong>Monto a Recibir ({foreignCurrency})</strong> como Cuenta por Cobrar.
                </p>
              </div>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-[var(--border-divider)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={activeRate <= 0 || (calcMode === 'from_ves' ? calculatedUsd <= 0 : calculatedVes <= 0)}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {calcMode === 'sell_usd'
                  ? `Aplicar Venta (${formatearMonto(calculatedVes, 'VES', locale)} recibidos · Debo ${formatearMonto(calculatedUsd, foreignCurrency, locale)})`
                  : `Aplicar a Operación P2P (${formatearMonto(calculatedVes, 'VES', locale)} ➜ ${formatearMonto(calculatedUsd, foreignCurrency, locale)})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface P2PExchangeViewProps {
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  officialRate: number | null;
  locale: 'es-VE' | 'en-US';
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
  autoOpenTrigger?: number;
}

export const P2PExchangeView: React.FC<P2PExchangeViewProps> = ({
  appData,
  setAppData,
  officialRate,
  locale = 'es-VE',
  showToast,
  setConfirmDialog,
  autoOpenTrigger,
}) => {
  const operations = appData.p2pOperations || [];
  const activeWallets = useMemo(
    () =>
      (appData.wallets || []).filter(
        (w) => w.active && !w.isThirdPartyExpenseAccount
      ),
    [appData.wallets]
  );

  // Estados de vista y filtros
  const [statusFilter, setStatusFilter] = useState<'in_transit' | 'settled' | 'all'>('in_transit');
  const [directionFilter, setDirectionFilter] = useState<'all' | P2PDirection>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | P2POperationType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingOperationId, setEditingOperationId] = useState<string | null>(null);
  const [settledAtDate, setSettledAtDate] = useState<string>('');

  // Operación seleccionada para liquidar
  const [settlingOperation, setSettlingOperation] = useState<P2POperation | null>(null);

  // Estado de la calculadora de conversión P2P ($ ⇄ Bs)
  const [isCalcModalOpen, setIsCalcModalOpen] = useState<boolean>(false);
  const [calcModalInitialMode, setCalcModalInitialMode] = useState<
    'buy_usd' | 'sell_usd' | 'from_ves'
  >('buy_usd');

  // Estado del formulario de nueva/editar operación P2P
  const [contactName, setContactName] = useState<string>('');
  const [operationType, setOperationType] = useState<P2POperationType>('currency_exchange');
  const [direction, setDirection] = useState<P2PDirection>('receivable');
  const [concept, setConcept] = useState<string>('');
  const [alreadyPaidExternally, setAlreadyPaidExternally] = useState<boolean>(false);
  const [sourceWalletId, setSourceWalletId] = useState<string>(
    () => activeWallets[0]?.id || 'wallet_bank_ves'
  );
  const [deliveredAmountStr, setDeliveredAmountStr] = useState<string>('');
  const [deliveredCurrency, setDeliveredCurrency] = useState<CurrencyCode>('VES');
  const [destinationWalletId, setDestinationWalletId] = useState<string>(
    () => activeWallets[1]?.id || 'wallet_zelle'
  );
  const [expectedAmountStr, setExpectedAmountStr] = useState<string>('');
  const [expectedCurrency, setExpectedCurrency] = useState<CurrencyCode>('USD');
  const [agreedRateStr, setAgreedRateStr] = useState<string>(() =>
    officialRate ? officialRate.toFixed(2) : ''
  );
  const [operationDate, setOperationDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [estimatedSettlementDate, setEstimatedSettlementDate] =
    useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [bankFeeMode, setBankFeeMode] = useState<
    'none' | 'pago_movil' | 'transferencia' | 'custom'
  >('none');
  const [customBankFeeStr, setCustomBankFeeStr] = useState<string>('');

  const editingOperation = useMemo(
    () =>
      editingOperationId
        ? operations.find((o) => o.id === editingOperationId) || null
        : null,
    [operations, editingOperationId]
  );

  const handleOpenNewModal = () => {
    setEditingOperationId(null);
    setSettledAtDate('');
    setContactName('');
    setOperationType('currency_exchange');
    setDirection('receivable');
    setConcept('');
    setAlreadyPaidExternally(false);
    setDeliveredAmountStr('');
    setExpectedAmountStr('');
    setAgreedRateStr(officialRate ? officialRate.toFixed(2) : '');
    setOperationDate(obtenerFechaLocalIso());
    setEstimatedSettlementDate('');
    setNotes('');
    setBankFeeMode('none');
    setCustomBankFeeStr('');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (op: P2POperation) => {
    setEditingOperationId(op.id);
    setContactName(op.contactName || '');
    setOperationType(op.operationType || 'currency_exchange');
    setDirection(op.direction || 'receivable');
    setConcept(op.concept || '');
    setAlreadyPaidExternally(Boolean(op.alreadyPaidExternally));
    setSourceWalletId(
      op.sourceWalletId || activeWallets[0]?.id || 'wallet_bank_ves'
    );
    setDeliveredAmountStr(
      op.deliveredAmount > 0 ? String(op.deliveredAmount) : ''
    );
    setDeliveredCurrency(op.deliveredCurrency || 'VES');
    setDestinationWalletId(
      op.destinationWalletId || activeWallets[1]?.id || 'wallet_zelle'
    );
    setExpectedAmountStr(
      op.expectedAmount > 0 ? String(op.expectedAmount) : ''
    );
    setExpectedCurrency(op.expectedCurrency || 'USD');
    setAgreedRateStr(op.agreedRate ? op.agreedRate.toFixed(2) : '');
    setOperationDate(op.operationDate || obtenerFechaLocalIso());
    setEstimatedSettlementDate(op.estimatedSettlementDate || '');
    setSettledAtDate(op.settledAt || op.operationDate || obtenerFechaLocalIso());
    setNotes(op.notes || '');
    if (op.hasBankFee && op.bankFeeAmount && op.bankFeeAmount > 0) {
      setBankFeeMode(op.bankFeeType || 'custom');
      setCustomBankFeeStr(String(op.bankFeeAmount));
    } else {
      setBankFeeMode('none');
      setCustomBankFeeStr('');
    }
    setShowCreateModal(true);
  };

  React.useEffect(() => {
    if (autoOpenTrigger && autoOpenTrigger > 0) {
      handleOpenNewModal();
    }
  }, [autoOpenTrigger]);

  // Resumen general y agrupado por persona
  const summary = useMemo(() => calcularResumenP2P(operations), [operations]);

  // Contactos previos para autocompletar rápidamente
  const existingContacts = useMemo(() => {
    const set = new Set<string>();
    operations.forEach((op) => set.add(op.contactName));
    return Array.from(set);
  }, [operations]);

  // Cálculos automáticos para el formulario
  const parsedDeliveredAmount =
    Number(deliveredAmountStr.replace(',', '.')) || 0;
  const parsedExpectedAmount =
    Number(expectedAmountStr.replace(',', '.')) || 0;

  const selectedSourceWallet = useMemo(
    () => activeWallets.find((w) => w.id === sourceWalletId),
    [activeWallets, sourceWalletId]
  );

  // Cálculo automático de la comisión bancaria cuando se entrega/paga en Bolívares (VES) hoy
  const computedBankFeeVes = useMemo(() => {
    if (
      direction !== 'receivable' ||
      alreadyPaidExternally ||
      deliveredCurrency !== 'VES' ||
      bankFeeMode === 'none' ||
      parsedDeliveredAmount <= 0
    ) {
      return 0;
    }
    if (bankFeeMode === 'pago_movil') {
      const pct =
        selectedSourceWallet?.comisionPagoMovil != null
          ? selectedSourceWallet.comisionPagoMovil
          : 0.3;
      const raw = (parsedDeliveredAmount * pct) / 100;
      return Number(Math.max(14, raw).toFixed(2));
    }
    if (bankFeeMode === 'transferencia') {
      const trTipo =
        selectedSourceWallet?.comisionTransferenciaTipo ||
        (selectedSourceWallet?.isBonusCard ? 'percent' : 'fixed_ves');
      if (trTipo === 'percent') {
        const pct =
          selectedSourceWallet?.comisionTransferencia != null
            ? selectedSourceWallet.comisionTransferencia
            : 1.5;
        return Number(((parsedDeliveredAmount * pct) / 100).toFixed(2));
      }
      const fixedBs =
        selectedSourceWallet?.comisionTransferencia != null &&
        selectedSourceWallet.comisionTransferencia >= 1
          ? selectedSourceWallet.comisionTransferencia
          : 54;
      return Number(fixedBs.toFixed(2));
    }
    if (bankFeeMode === 'custom') {
      const customVal = Number(customBankFeeStr.replace(',', '.'));
      return Number.isFinite(customVal) && customVal > 0
        ? Number(customVal.toFixed(2))
        : 0;
    }
    return 0;
  }, [
    direction,
    alreadyPaidExternally,
    deliveredCurrency,
    bankFeeMode,
    parsedDeliveredAmount,
    selectedSourceWallet,
    customBankFeeStr,
  ]);

  // Cambiar sentido de la operación (Me deben vs Yo debo entregar) con preajustes inteligentes
  const handleSelectDirection = (newDir: P2PDirection) => {
    setDirection(newDir);
    if (newDir === 'payable') {
      const usdWallet =
        activeWallets.find((w) => w.type === 'cash_usd' || w.currency === 'USD') ||
        activeWallets[0];
      const vesWallet =
        activeWallets.find((w) => w.currency === 'VES') || activeWallets[0];
      if (usdWallet) {
        setSourceWalletId(usdWallet.id);
        setDeliveredCurrency(usdWallet.currency === 'VES' ? 'USD' : usdWallet.currency);
      } else {
        setDeliveredCurrency('USD');
      }
      if (vesWallet) {
        setDestinationWalletId(vesWallet.id);
        setExpectedCurrency('VES');
      } else {
        setExpectedCurrency('VES');
      }
      setAlreadyPaidExternally(true);
    } else {
      const vesWallet =
        activeWallets.find((w) => w.currency === 'VES') || activeWallets[0];
      const usdWallet =
        activeWallets.find((w) => w.currency === 'USD' || w.currency === 'USDT') ||
        activeWallets[1] ||
        activeWallets[0];
      if (vesWallet) {
        setSourceWalletId(vesWallet.id);
        setDeliveredCurrency(vesWallet.currency);
      }
      if (usdWallet) {
        setDestinationWalletId(usdWallet.id);
        setExpectedCurrency(usdWallet.currency === 'VES' ? 'USD' : usdWallet.currency);
      }
      setAlreadyPaidExternally(false);
    }
  };

  // Actualizar tasa implícita o montos
  const handleCalculateRate = () => {
    if (parsedDeliveredAmount > 0 && parsedExpectedAmount > 0) {
      if (
        deliveredCurrency === 'VES' &&
        (expectedCurrency === 'USD' || expectedCurrency === 'USDT')
      ) {
        const rate = (parsedDeliveredAmount / parsedExpectedAmount).toFixed(2);
        setAgreedRateStr(rate);
      } else if (
        (deliveredCurrency === 'USD' || deliveredCurrency === 'USDT') &&
        expectedCurrency === 'VES'
      ) {
        const rate = (parsedExpectedAmount / parsedDeliveredAmount).toFixed(2);
        setAgreedRateStr(rate);
      }
    }
  };

  const handleApplyRateToExpected = (rateVal: number) => {
    if (rateVal <= 0) return;
    if (parsedDeliveredAmount > 0) {
      if (
        deliveredCurrency === 'VES' &&
        (expectedCurrency === 'USD' || expectedCurrency === 'USDT')
      ) {
        setExpectedAmountStr((parsedDeliveredAmount / rateVal).toFixed(2));
      } else if (
        (deliveredCurrency === 'USD' || deliveredCurrency === 'USDT') &&
        expectedCurrency === 'VES'
      ) {
        setExpectedAmountStr((parsedDeliveredAmount * rateVal).toFixed(2));
      }
    } else if (parsedExpectedAmount > 0) {
      if (
        expectedCurrency === 'VES' &&
        (deliveredCurrency === 'USD' || deliveredCurrency === 'USDT')
      ) {
        setDeliveredAmountStr((parsedExpectedAmount / rateVal).toFixed(2));
      } else if (
        (expectedCurrency === 'USD' || expectedCurrency === 'USDT') &&
        deliveredCurrency === 'VES'
      ) {
        setDeliveredAmountStr((parsedExpectedAmount * rateVal).toFixed(2));
      }
    }
  };

  const handleSourceWalletChange = (walletId: string) => {
    setSourceWalletId(walletId);
    const w = activeWallets.find((item) => item.id === walletId);
    if (w) setDeliveredCurrency(w.currency);
  };

  const handleDestinationWalletChange = (walletId: string) => {
    setDestinationWalletId(walletId);
    const w = activeWallets.find((item) => item.id === walletId);
    if (w) setExpectedCurrency(w.currency);
  };

  // Abrir la calculadora de conversión rápida
  const openCalculator = (
    mode: 'buy_usd' | 'sell_usd' | 'from_ves' = 'buy_usd'
  ) => {
    setCalcModalInitialMode(mode);
    setIsCalcModalOpen(true);
  };

  // Aplicar el resultado de la calculadora directamente a los campos de la operación
  const handleApplyCalculation = (data: {
    direction?: P2PDirection;
    deliveredAmount: number;
    deliveredCurrency: CurrencyCode;
    expectedAmount: number;
    expectedCurrency: CurrencyCode;
    agreedRate: number;
    rateDescription: string;
  }) => {
    if (data.direction) {
      setDirection(data.direction);
      if (data.direction === 'payable') {
        const usdWallet =
          activeWallets.find(
            (w) => w.type === 'cash_usd' || w.currency === data.deliveredCurrency
          ) || activeWallets[0];
        if (usdWallet) setSourceWalletId(usdWallet.id);
      }
    }
    setDeliveredAmountStr(data.deliveredAmount.toFixed(2));
    setDeliveredCurrency(data.deliveredCurrency);
    setExpectedAmountStr(data.expectedAmount.toFixed(2));
    setExpectedCurrency(data.expectedCurrency);
    setAgreedRateStr(data.agreedRate.toFixed(2));
    setShowCreateModal(true);
    setIsCalcModalOpen(false);
    showToast(
      data.direction === 'payable'
        ? `Venta calculada: Recibiste ${data.expectedAmount.toFixed(2)} ${data.expectedCurrency} y debes entregar ${data.deliveredAmount.toFixed(2)} ${data.deliveredCurrency} (Tasa: ${formatearTasa(data.agreedRate, locale)})`
        : `Cálculo aplicado: ${data.deliveredAmount.toFixed(2)} ${data.deliveredCurrency} por ${data.expectedAmount.toFixed(2)} ${data.expectedCurrency} (Tasa: ${formatearTasa(data.agreedRate, locale)})`,
      'success'
    );
  };

  const handleCreateOperation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) {
      showToast('Ingresa el nombre de la persona o contacto.', 'error');
      return;
    }

    if (direction === 'receivable') {
      if (!alreadyPaidExternally && parsedDeliveredAmount <= 0) {
        showToast(
          'Ingresa el monto entregado mayor a 0 (o marca «Ya lo pagué antes»).',
          'error'
        );
        return;
      }
      if (parsedExpectedAmount <= 0) {
        showToast('Ingresa el monto que te deben recibir mayor a 0.', 'error');
        return;
      }
    } else {
      if (parsedDeliveredAmount <= 0) {
        showToast(
          'Ingresa el monto que tú debes entregar mayor a 0 (ej: 20).',
          'error'
        );
        return;
      }
      if (!alreadyPaidExternally && parsedExpectedAmount <= 0) {
        showToast(
          'Ingresa el monto que recibiste hoy (o marca «Ya recibí ese dinero antes»).',
          'error'
        );
        return;
      }
    }

    const rateNum = Number(agreedRateStr.replace(',', '.')) || null;
    let rateDescription = undefined;
    if (rateNum && rateNum > 0) {
      if (deliveredCurrency === 'VES' || expectedCurrency === 'VES') {
        rateDescription = `1 USD = ${formatearTasa(rateNum, locale)} Bs`;
      } else if (deliveredCurrency === expectedCurrency) {
        rateDescription = 'Paridad 1:1';
      } else {
        rateDescription = `Tasa: ${rateNum}`;
      }
    }

    let finalExpectedAmount = parsedExpectedAmount;
    if (
      direction === 'payable' &&
      alreadyPaidExternally &&
      finalExpectedAmount <= 0 &&
      parsedDeliveredAmount > 0 &&
      rateNum &&
      rateNum > 0 &&
      (deliveredCurrency === 'USD' || deliveredCurrency === 'USDT') &&
      expectedCurrency === 'VES'
    ) {
      finalExpectedAmount = Number((parsedDeliveredAmount * rateNum).toFixed(2));
    }

    const input: CreateP2POperationInput = {
      contactName: contactName.trim(),
      operationType,
      direction,
      concept: concept.trim() || undefined,
      alreadyPaidExternally,
      deliveredAmount: parsedDeliveredAmount,
      deliveredCurrency,
      sourceWalletId:
        direction === 'receivable' && alreadyPaidExternally ? '' : sourceWalletId,
      expectedAmount: finalExpectedAmount,
      expectedCurrency,
      destinationWalletId:
        direction === 'payable' && alreadyPaidExternally
          ? ''
          : destinationWalletId,
      agreedRate: rateNum,
      rateDescription,
      operationDate,
      estimatedSettlementDate: estimatedSettlementDate || null,
      notes: notes.trim() || undefined,
      deliveredRateUsed: rateNum,
      expectedRateUsed: rateNum,
      hasBankFee: computedBankFeeVes > 0,
      bankFeeType: computedBankFeeVes > 0 ? bankFeeMode : 'none',
      bankFeeAmount: computedBankFeeVes > 0 ? computedBankFeeVes : 0,
      categories: appData.categories,
    };

    if (editingOperationId) {
      setAppData((prev) =>
        actualizarOperacionP2P(
          prev,
          editingOperationId,
          {
            ...input,
            settledAt:
              editingOperation?.status === 'settled'
                ? settledAtDate || operationDate
                : null,
          },
          officialRate
        )
      );
      setEditingOperationId(null);
      setSettledAtDate('');
      setShowCreateModal(false);
      showToast(
        `Operación P2P con ${contactName.trim()} actualizada correctamente.`,
        'success'
      );
      return;
    }

    const { operation, transactionsToCreate } = crearOperacionP2P(
      input,
      officialRate
    );

    setAppData((prev) => ({
      ...prev,
      p2pOperations: [operation, ...(prev.p2pOperations || [])],
      transactions: [...transactionsToCreate, ...prev.transactions],
    }));

    setContactName('');
    setConcept('');
    setAlreadyPaidExternally(direction === 'payable');
    setDeliveredAmountStr('');
    setExpectedAmountStr('');
    setNotes('');
    setEstimatedSettlementDate('');
    setBankFeeMode('none');
    setCustomBankFeeStr('');
    setShowCreateModal(false);

    if (direction === 'payable') {
      showToast(
        alreadyPaidExternally
          ? `Compromiso registrado: Ya recibiste el pago antes y debes entregar ${formatearMonto(operation.deliveredAmount, operation.deliveredCurrency, locale)} a ${operation.contactName}.`
          : `Venta registrada: Se sumaron ${formatearMonto(operation.expectedAmount, operation.expectedCurrency, locale)} a tu Wallet y quedó agendado entregar ${formatearMonto(operation.deliveredAmount, operation.deliveredCurrency, locale)} a ${operation.contactName}.`,
        'success'
      );
    } else {
      showToast(
        alreadyPaidExternally
          ? `Operación con ${operation.contactName} registrada como ya pagada previamente. No afectó tu balance actual y quedó agendada por cobrar.`
          : `Operación registrada con ${operation.contactName}. Se debitó de tu Saldo Real${operation.bankFeeAmount && operation.bankFeeAmount > 0 ? ` (+ ${formatearMonto(operation.bankFeeAmount, 'VES', locale)} de comisión bancaria)` : ''} y sumó a tus Cuentas por Cobrar.`,
        'success'
      );
    }
  };

  const handleConfirmSettle = (
    operationId: string,
    input: SettleP2POperationInput
  ) => {
    const targetOp = operations.find((o) => o.id === operationId);
    const isPayable = targetOp?.direction === 'payable';
    setAppData((prev) =>
      liquidarOperacionP2P(prev, operationId, input, officialRate)
    );
    showToast(
      isPayable
        ? 'Entrega confirmada. El monto entregado se descontó de tu Saldo Real.'
        : 'Operación liquidada con éxito. El monto ingresó a tu Saldo Real.',
      'success'
    );
  };

  const handleRevert = (op: P2POperation) => {
    const isPayable = op.direction === 'payable';
    setConfirmDialog({
      title: 'Revertir operación liquidada',
      message: isPayable
        ? `¿Deseas volver a colocar el compromiso con ${op.contactName} como "Pendiente por Entregar"? El dinero entregado volverá a tu Saldo Real y quedará otra vez como pendiente de entrega.`
        : `¿Deseas volver a colocar la operación con ${op.contactName} en estado "En Tránsito"? El monto dejará de sumar a tu Saldo Real y volverá a tus Cuentas por Cobrar.`,
      confirmLabel: 'Sí, volver a poner Pendiente',
      onConfirm: () => {
        setAppData((prev) => revertirOperacionP2P(prev, op.id));
        setConfirmDialog(null);
        showToast('Operación devuelta a estado En Tránsito.', 'info');
      },
    });
  };

  const handleDelete = (op: P2POperation) => {
    const isPayable = op.direction === 'payable';
    setConfirmDialog({
      title: 'Eliminar operación P2P',
      message: isPayable
        ? op.alreadyPaidExternally
          ? `¿Estás seguro de eliminar este compromiso por entregar a ${op.contactName}? Se anulará la deuda pendiente de entrega.`
          : `¿Estás seguro de eliminar esta operación con ${op.contactName}? Se revertirá el ingreso recibido y se anulará el compromiso de entrega.`
        : op.alreadyPaidExternally
          ? `¿Estás seguro de eliminar este registro con ${op.contactName}? Se anulará la cuenta por cobrar (no hubo descuento en tu billetera origen).`
          : `¿Estás seguro de eliminar esta operación con ${op.contactName}? Se revertirá la salida de dinero en tu wallet origen y se anulará la cuenta por cobrar.`,
      confirmLabel: 'Sí, eliminar operación',
      danger: true,
      onConfirm: () => {
        setAppData((prev) => eliminarOperacionP2P(prev, op.id));
        setConfirmDialog(null);
        showToast('Operación y movimientos vinculados eliminados.', 'info');
      },
    });
  };

  // Filtrado de grupos y operaciones
  const filteredContactGroups = useMemo(() => {
    return summary.contactGroups
      .map((group) => {
        const ops = group.operations.filter((op) => {
          const opDir: P2PDirection =
            op.direction === 'payable' ? 'payable' : 'receivable';
          if (statusFilter !== 'all' && op.status !== statusFilter) return false;
          if (directionFilter !== 'all' && opDir !== directionFilter)
            return false;
          if (typeFilter !== 'all' && op.operationType !== typeFilter)
            return false;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchContact = op.contactName.toLowerCase().includes(q);
            const matchConcept = op.concept?.toLowerCase().includes(q) || false;
            const matchNotes = op.notes?.toLowerCase().includes(q) || false;
            if (!matchContact && !matchConcept && !matchNotes) return false;
          }
          return true;
        });

        const inTransitOps = ops.filter((o) => o.status === 'in_transit');
        const receivableOps = inTransitOps.filter(
          (o) => o.direction !== 'payable'
        );
        const payableOps = inTransitOps.filter(
          (o) => o.direction === 'payable'
        );
        const totalInTransitUsd = receivableOps.reduce(
          (acc, o) => acc + o.expectedAmountUsd,
          0
        );
        const totalPayableInTransitUsd = payableOps.reduce(
          (acc, o) => acc + o.deliveredAmountUsd,
          0
        );

        return {
          ...group,
          operations: ops,
          inTransitCount: inTransitOps.length,
          receivableInTransitCount: receivableOps.length,
          payableInTransitCount: payableOps.length,
          totalInTransitUsd,
          totalPayableInTransitUsd,
        };
      })
      .filter((group) => group.operations.length > 0);
  }, [
    summary.contactGroups,
    statusFilter,
    directionFilter,
    typeFilter,
    searchQuery,
  ]);

  const getWallet = (wId?: string | null) =>
    (appData.wallets || []).find((w) => w.id === wId);

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[11px] font-semibold border border-blue-500/20">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Módulo Multimoneda P2P · Bs · USD · USDT</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Cambios P2P: Por Cobrar y Por Entregar
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
            Registra tanto cuando <strong>compras divisas y te deben entregar</strong> el efectivo en otra fecha, como cuando <strong>vendes divisas (ya recibiste los Bs antes) y tú debes entregar los dólares</strong> en otra fecha.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => openCalculator('buy_usd')}
            className="px-3.5 py-2.5 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-all shadow-xs"
            title="Calcular compras o ventas de Dólares / USDT con Bolívares"
          >
            <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Calculadora ($ ⇄ Bs)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewModal}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Operación P2P</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Me Deben (Por Cobrar)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
            {formatearMonto(summary.totalInTransitUsd, 'USD', locale)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-divider)] font-mono-tabular">
            {summary.receivableInTransitCount === 0 && (
              <span>Sin cobros pendientes</span>
            )}
            {summary.breakdownInTransit.USD > 0 && (
              <span className="bg-emerald-500/10 dark:bg-[var(--surface-subtle)] text-emerald-800 dark:text-[var(--text-secondary)] font-semibold px-1.5 py-0.5 rounded">
                ${summary.breakdownInTransit.USD.toFixed(2)} USD
              </span>
            )}
            {summary.breakdownInTransit.USDT > 0 && (
              <span className="bg-emerald-500/10 dark:bg-[var(--surface-subtle)] text-emerald-800 dark:text-[var(--text-secondary)] font-semibold px-1.5 py-0.5 rounded">
                {summary.breakdownInTransit.USDT.toFixed(2)} USDT
              </span>
            )}
            {summary.breakdownInTransit.VES > 0 && (
              <span className="bg-emerald-500/10 dark:bg-[var(--surface-subtle)] text-emerald-800 dark:text-[var(--text-secondary)] font-semibold px-1.5 py-0.5 rounded">
                {formatearMonto(summary.breakdownInTransit.VES, 'VES', locale)}
              </span>
            )}
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Yo Debo Entregar (Por Entregar)</span>
            <ArrowDownRight className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-amber-700 dark:text-amber-400">
            {formatearMonto(summary.totalPayableInTransitUsd, 'USD', locale)}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-divider)] font-mono-tabular">
            {summary.payableInTransitCount === 0 && (
              <span>Sin entregas pendientes</span>
            )}
            {summary.breakdownPayableInTransit.USD > 0 && (
              <span className="bg-amber-500/15 dark:bg-[var(--surface-subtle)] px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-300 font-semibold">
                Debes ${summary.breakdownPayableInTransit.USD.toFixed(2)} USD
              </span>
            )}
            {summary.breakdownPayableInTransit.USDT > 0 && (
              <span className="bg-amber-500/15 dark:bg-[var(--surface-subtle)] px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-300 font-semibold">
                Debes {summary.breakdownPayableInTransit.USDT.toFixed(2)} USDT
              </span>
            )}
            {summary.breakdownPayableInTransit.VES > 0 && (
              <span className="bg-amber-500/15 dark:bg-[var(--surface-subtle)] px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-300 font-semibold">
                Debes {formatearMonto(summary.breakdownPayableInTransit.VES, 'VES', locale)}
              </span>
            )}
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Total Liquidado (Cerrado)</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(summary.totalSettledUsd, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-divider)]">
            {summary.settledCount} operación(es) completada(s) en Saldo Real.
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Tasa BCV de Referencia</span>
            <Banknote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold font-mono-tabular text-[var(--text-primary)]">
            {officialRate
              ? `1 USD = ${formatearTasa(officialRate, locale)} Bs`
              : 'Sin tasa oficial'}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-divider)]">
            {summary.activeContactsCount} contacto(s) con operaciones activas.
          </p>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-hairline)] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Pestañas de Estado */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
            {(
              [
                { id: 'in_transit', label: 'Pendientes' },
                { id: 'settled', label: 'Liquidadas' },
                { id: 'all', label: 'Todas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtro rápido por sentido: Todos / Me deben / Yo debo entregar */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setDirectionFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                directionFilter === 'all'
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] font-semibold shadow-xs border border-[var(--border-hairline)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Ambos sentidos
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('receivable')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                directionFilter === 'receivable'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-emerald-700 dark:hover:text-emerald-400'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Me deben ({summary.receivableInTransitCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('payable')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                directionFilter === 'payable'
                  ? 'bg-amber-600 text-white font-semibold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-amber-700 dark:hover:text-amber-400'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Yo debo entregar ({summary.payableInTransitCount})</span>
            </button>
          </div>
        </div>

        {/* Filtro por Tipo y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-xl px-2.5 py-1.5 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as 'all' | P2POperationType)
              }
              className="bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="all">Todos los tipos</option>
              <option value="currency_exchange">Cambios P2P</option>
              <option value="loan">Préstamos</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar persona o concepto..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Listado Agrupado por Persona / Contacto */}
      {filteredContactGroups.length === 0 ? (
        <div className="bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border-hairline)] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-[var(--text-primary)]">
            No hay operaciones P2P en esta vista
          </h4>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            {statusFilter === 'in_transit'
              ? 'No tienes operaciones pendientes de cobro ni de entrega en este filtro. ¡Estás al día!'
              : 'Registra tus operaciones de compra o venta P2P para llevar control de lo que te deben o lo que tú debes entregar.'}
          </p>
          <div className="flex items-center justify-center pt-1">
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Operación P2P</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredContactGroups.map((group) => {
            return (
              <div
                key={group.contactName}
                className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden shadow-xs"
              >
                {/* Cabecera del Contacto con Subtotales */}
                <div className="p-4 sm:p-5 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/15 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm shrink-0">
                      {group.contactName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          {group.contactName}
                        </h3>
                        {group.hasOverdue && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/15 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                            Fecha vencida
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {group.operations.length} movimiento(s) registrado(s) · Último:{' '}
                        <span className="font-semibold text-[var(--text-primary)]">{group.lastDate}</span>
                      </p>
                    </div>
                  </div>

                  {/* Resumen de deuda del contacto (Por cobrar y/o Por entregar) */}
                  <div className="flex flex-wrap items-center gap-4 self-end sm:self-auto">
                    {group.totalInTransitUsd > 0 && (
                      <div className="text-right">
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400/90 block font-semibold">
                          Te debe (Por Cobrar)
                        </span>
                        <span className="text-base font-bold font-mono-tabular text-emerald-700 dark:text-emerald-400">
                          {formatearMonto(group.totalInTransitUsd, 'USD', locale)}
                        </span>
                        <div className="text-[10px] text-[var(--text-primary)] dark:text-[var(--text-secondary)] font-semibold font-mono-tabular">
                          {group.inTransitBreakdown.USD > 0 &&
                            `${group.inTransitBreakdown.USD} USD `}
                          {group.inTransitBreakdown.USDT > 0 &&
                            `${group.inTransitBreakdown.USDT} USDT `}
                          {group.inTransitBreakdown.VES > 0 &&
                            `${formatearMonto(group.inTransitBreakdown.VES, 'VES', locale)}`}
                        </div>
                      </div>
                    )}

                    {group.totalPayableInTransitUsd > 0 && (
                      <div className="text-right">
                        <span className="text-[11px] text-amber-800 dark:text-amber-400 block font-semibold">
                          Debes entregar (Por Pagar)
                        </span>
                        <span className="text-base font-bold font-mono-tabular text-amber-700 dark:text-amber-400">
                          {formatearMonto(
                            group.totalPayableInTransitUsd,
                            'USD',
                            locale
                          )}
                        </span>
                        <div className="text-[10px] text-[var(--text-primary)] dark:text-[var(--text-secondary)] font-semibold font-mono-tabular">
                          {group.payableBreakdown.USD > 0 &&
                            `${group.payableBreakdown.USD} USD `}
                          {group.payableBreakdown.USDT > 0 &&
                            `${group.payableBreakdown.USDT} USDT `}
                          {group.payableBreakdown.VES > 0 &&
                            `${formatearMonto(group.payableBreakdown.VES, 'VES', locale)}`}
                        </div>
                      </div>
                    )}

                    {group.totalInTransitUsd <= 0 &&
                      group.totalPayableInTransitUsd <= 0 && (
                        <div className="px-3 py-1 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/25 text-xs font-semibold">
                          Al día / Liquidado
                        </div>
                      )}
                  </div>
                </div>

                {/* Lista de Operaciones de este Contacto */}
                <div className="p-4 sm:p-5 space-y-3">
                  {group.operations.map((op) => {
                    const isInTransit = op.status === 'in_transit';
                    const isPayable = op.direction === 'payable';
                    const srcW = getWallet(op.sourceWalletId);
                    const dstW = getWallet(op.destinationWalletId);
                    const isExchange = op.operationType === 'currency_exchange';

                    return (
                      <div
                        key={op.id}
                        className={`p-4 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
                          isInTransit
                            ? isPayable
                              ? 'bg-[var(--surface-subtle)] border-amber-500/40 hover:border-amber-500/60'
                              : 'bg-[var(--surface-subtle)] border-emerald-500/30 hover:border-emerald-500/50'
                            : 'bg-[var(--surface-subtle)]/40 border-[var(--border-hairline)] opacity-85'
                        }`}
                      >
                        {/* Datos de la Operación */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isExchange
                                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30'
                                  : 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30'
                              }`}
                            >
                              {isExchange ? 'Cambio P2P' : 'Préstamo'}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                isPayable
                                  ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {isPayable ? (
                                <>
                                  <ArrowDownRight className="w-3 h-3" />
                                  <span>Yo debo entregar</span>
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>Me deben (Por cobrar)</span>
                                </>
                              )}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isInTransit
                                  ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30 animate-pulse'
                                  : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {isInTransit ? (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>
                                    {isPayable
                                      ? 'Pendiente por entregar'
                                      : 'En Tránsito por cobrar'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>
                                    {isPayable
                                      ? `Entregado (${op.settledAt})`
                                      : `Liquidado (${op.settledAt})`}
                                  </span>
                                </>
                              )}
                            </span>
                            <span className="text-xs font-semibold font-mono-tabular text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                              Fecha: {op.operationDate}
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {op.concept ||
                              (isPayable
                                ? `Venta de ${op.deliveredCurrency} por ${op.expectedCurrency}`
                                : isExchange
                                  ? 'Cambio de divisas'
                                  : 'Préstamo acordado')}
                          </h4>

                          {/* Flujo Visual Adaptado según sea Por Cobrar o Por Entregar */}
                          {isPayable ? (
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                              {op.alreadyPaidExternally ? (
                                <div className="p-2 rounded-lg bg-[var(--surface)] border border-teal-500/30 min-w-[155px]">
                                  <span className="text-[10px] text-teal-700 dark:text-teal-400 flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                                    Ya recibí ese dinero antes
                                  </span>
                                  <div className="font-mono-tabular font-bold text-[var(--text-primary)] text-sm">
                                    {op.expectedAmount > 0
                                      ? formatearMonto(
                                          op.expectedAmount,
                                          op.expectedCurrency,
                                          locale
                                        )
                                      : 'Recibido previamente'}
                                  </div>
                                  <span className="text-[10px] text-[var(--text-secondary)] truncate block">
                                    No duplicó tu saldo actual
                                  </span>
                                </div>
                              ) : (
                                <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] min-w-[155px]">
                                  <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                                    <ArrowUpRight className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                                    Recibido hoy (Saldo Real)
                                  </span>
                                  <div className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                    {formatearMonto(
                                      op.expectedAmount,
                                      op.expectedCurrency,
                                      locale
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[var(--text-secondary)] truncate block">
                                    En: {dstW?.name || 'Wallet'}
                                  </span>
                                </div>
                              )}

                              <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0 hidden sm:block" />

                              <div className="p-2 rounded-lg bg-[var(--surface)] border border-amber-500/40 min-w-[155px]">
                                <span className="text-[10px] text-amber-800 dark:text-amber-300 flex items-center gap-1 font-semibold">
                                  <ArrowDownRight className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                                  {isInTransit
                                    ? 'Yo Debo Entregar (Pendiente)'
                                    : 'Entregado (Saldo Real)'}
                                </span>
                                <div className="font-mono-tabular font-bold text-amber-700 dark:text-amber-400 text-sm">
                                  {formatearMonto(
                                    op.deliveredAmount,
                                    op.deliveredCurrency,
                                    locale
                                  )}
                                </div>
                                {op.bankFeeAmount && op.bankFeeAmount > 0 && (
                                  <div className="text-[10px] font-mono-tabular font-semibold text-rose-700 dark:text-rose-300 mt-0.5">
                                    + Comisión: {formatearMonto(op.bankFeeAmount, 'VES', locale)} (Total:{' '}
                                    {formatearMonto(
                                      op.deliveredAmount + op.bankFeeAmount,
                                      'VES',
                                      locale
                                    )}
                                    )
                                  </div>
                                )}
                                <span className="text-[10px] text-[var(--text-secondary)] truncate block">
                                  De: {srcW?.name || 'Efectivo / Wallet'}
                                </span>
                              </div>

                              {op.rateDescription && (
                                <div className="text-[11px] text-[var(--text-secondary)]">
                                  Tasa pactada:{' '}
                                  <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                                    {op.rateDescription}
                                  </span>
                                </div>
                              )}

                              {op.estimatedSettlementDate && isInTransit && (
                                <div className="text-[11px] font-mono-tabular text-amber-800 dark:text-amber-300 font-semibold">
                                  Fecha para entregar: {op.estimatedSettlementDate}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                              {op.alreadyPaidExternally ? (
                                <div className="p-2 rounded-lg bg-[var(--surface)] border border-teal-500/30 min-w-[140px]">
                                  <span className="text-[10px] text-teal-700 dark:text-teal-400 flex items-center gap-1 font-semibold">
                                    <CheckCircle2 className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                                    Ya pagado previamente
                                  </span>
                                  <div className="font-mono-tabular font-bold text-[var(--text-primary)] text-sm">
                                    {op.deliveredAmount > 0
                                      ? formatearMonto(
                                          op.deliveredAmount,
                                          op.deliveredCurrency,
                                          locale
                                        )
                                      : 'Pago previo'}
                                  </div>
                                  <span className="text-[10px] text-[var(--text-secondary)] truncate block">
                                    Sin descuento en tu balance
                                  </span>
                                </div>
                              ) : (
                                <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] min-w-[140px]">
                                  <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                                    <ArrowDownRight className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                    Entregado (Saldo Real)
                                  </span>
                                  <div className="font-mono-tabular font-bold text-rose-600 dark:text-rose-400 text-sm">
                                    {formatearMonto(
                                      op.deliveredAmount,
                                      op.deliveredCurrency,
                                      locale
                                    )}
                                  </div>
                                  {op.bankFeeAmount && op.bankFeeAmount > 0 && (
                                    <div className="text-[10px] font-mono-tabular font-semibold text-rose-700 dark:text-rose-300 mt-0.5">
                                      + Comisión: {formatearMonto(op.bankFeeAmount, 'VES', locale)} (Total:{' '}
                                      {formatearMonto(
                                        op.deliveredAmount + op.bankFeeAmount,
                                        'VES',
                                        locale
                                      )}
                                      )
                                    </div>
                                  )}
                                  <span className="text-[10px] text-[var(--text-secondary)] truncate block">
                                    De: {srcW?.name || 'Wallet'}
                                  </span>
                                </div>
                              )}

                              <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0 hidden sm:block" />

                              <div className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] min-w-[140px]">
                                <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                                  <ArrowUpRight className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                                  Por Recibir ({isInTransit ? 'Proyectado' : 'Real'})
                                </span>
                                <div className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                                  {formatearMonto(
                                    op.expectedAmount,
                                    op.expectedCurrency,
                                    locale
                                  )}
                                </div>
                                <span className="text-[10px] text-[var(--text-secondary)] truncate block">
                                  A: {dstW?.name || 'Wallet'}
                                </span>
                              </div>

                              {op.rateDescription && (
                                <div className="text-[11px] text-[var(--text-secondary)]">
                                  Tasa pactada:{' '}
                                  <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                                    {op.rateDescription}
                                  </span>
                                </div>
                              )}

                              {op.estimatedSettlementDate && isInTransit && (
                                <div className="text-[11px] font-mono-tabular text-amber-800 dark:text-amber-300 font-semibold">
                                  Cobro estimado: {op.estimatedSettlementDate}
                                </div>
                              )}
                            </div>
                          )}

                          {op.notes && (
                            <p className="text-[11px] text-[var(--text-secondary)] italic pt-1">
                              «{op.notes}»
                            </p>
                          )}
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex flex-wrap items-center gap-2 self-end lg:self-center shrink-0">
                          {isInTransit ? (
                            <button
                              type="button"
                              onClick={() => setSettlingOperation(op)}
                              className={`px-3.5 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                                isPayable
                                  ? 'bg-amber-600 hover:bg-amber-500'
                                  : 'bg-emerald-600 hover:bg-emerald-500'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {isPayable
                                  ? 'Marcar como Entregado'
                                  : 'Liquidar y Recibir'}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevert(op)}
                              className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] text-xs flex items-center gap-1.5 transition-all"
                              title="Revertir a Pendiente"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Revertir</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(op)}
                            className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] text-xs font-semibold flex items-center gap-1.5 transition-all"
                            title="Editar fecha, monto o detalles de la operación"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(op)}
                            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-rose-400 hover:bg-[var(--surface)] border border-transparent hover:border-rose-500/20 transition-all"
                            title="Eliminar operación"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Registrar o Editar Operación P2P */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          onClick={() => {
            setShowCreateModal(false);
            setEditingOperationId(null);
          }}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    direction === 'payable'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                  }`}
                >
                  {editingOperationId ? (
                    <Edit3 className="w-5 h-5" />
                  ) : (
                    <ArrowLeftRight className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {editingOperationId
                      ? 'Editar Operación P2P / Préstamo'
                      : 'Registrar Operación P2P / Préstamo'}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {editingOperationId
                      ? 'Modifica fechas, montos, contacto, billeteras o tasa y tus saldos se ajustarán automáticamente'
                      : direction === 'payable'
                        ? 'Vendí divisas / Ya recibí el pago y debo entregar en otra fecha'
                        : 'Compré divisas / Entregué fondos y espero recibir en otra fecha'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingOperationId(null);
                }}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOperation} className="p-6 space-y-5">
              {/* Selector Principal: ¿Me deben o Yo debo entregar? */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  ¿Cuál es el sentido de esta operación?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectDirection('receivable')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      direction === 'receivable'
                        ? 'bg-emerald-600/15 border-emerald-500 text-[var(--text-primary)] shadow-md'
                        : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        direction === 'receivable'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[var(--surface)] text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Me deben recibir (Compré $)
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-snug mt-0.5">
                        Ej: Compré $20, pasé los Bs (hoy o antes) y me darán el efectivo en otra fecha.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectDirection('payable')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      direction === 'payable'
                        ? 'bg-amber-600/15 border-amber-500 text-[var(--text-primary)] shadow-md'
                        : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        direction === 'payable'
                          ? 'bg-amber-600 text-white'
                          : 'bg-[var(--surface)] text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Yo debo entregar (Vendí $)
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-snug mt-0.5">
                        Ej: Vendí $20, ya me pasaron los Bs antes y yo debo entregar los $20 en otra fecha.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Selector de Tipo (Cambio P2P vs Préstamo) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  Categoría del acuerdo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOperationType('currency_exchange')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      operationType === 'currency_exchange'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Cambio de Divisas (P2P)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperationType('loan')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      operationType === 'loan'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Préstamo / Adelanto</span>
                  </button>
                </div>
              </div>

              {/* Contacto y Concepto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Persona / Contacto *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej: Carlos Gómez, Binance P2P, Mamá..."
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                  {existingContacts.length > 0 && !contactName && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        Frecuentes:
                      </span>
                      {existingContacts.slice(0, 3).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setContactName(name)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-subtle)] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Concepto o referencia breve
                  </label>
                  <input
                    type="text"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder={
                      direction === 'payable'
                        ? 'Ej: Vendí $20, recibí los Bs y debo entregar el efectivo'
                        : operationType === 'currency_exchange'
                          ? 'Ej: Transfiero Bs hoy, recibo $ mañana en efectivo'
                          : 'Ej: Préstamo para repuesto de auto'
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {direction === 'receivable' ? (
                <>
                  {/* FORMULARIO MODO 1: ME DEBEN (COMPRÉ DIVISAS / ENTREGUÉ PRIMERO) */}
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-divider)]">
                      <div>
                        <span
                          className={`text-xs font-bold flex items-center gap-1.5 ${
                            alreadyPaidExternally
                              ? 'text-teal-700 dark:text-teal-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {alreadyPaidExternally ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                1. Operación ya pagada antes (No afecta tu balance actual)
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="w-4 h-4" />
                              <span>
                                1. Salida: Monto que entregas hoy (Descuenta de tu Saldo Real)
                              </span>
                            </>
                          )}
                        </span>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          {alreadyPaidExternally
                            ? 'Ideal para compras de divisas que ya pagaste antes: registra que te deben sin descontar de nuevo de tu cuenta en Bs.'
                            : 'El dinero sale hoy de la billetera que elijas y se descuenta de tu Saldo Real.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => setAlreadyPaidExternally(false)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            !alreadyPaidExternally
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          Pagué hoy (Descontar)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlreadyPaidExternally(true)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                            alreadyPaidExternally
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ya lo pagué antes</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {alreadyPaidExternally ? (
                        <div className="p-2.5 rounded-xl bg-teal-500/10 dark:bg-teal-950/25 border border-teal-500/30 flex flex-col justify-center">
                          <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                            Sin descuento de billetera
                          </span>
                          <span className="text-[10px] text-teal-700 dark:text-teal-200/80 mt-0.5">
                            No restará Bs ni USD de tus cuentas actuales.
                          </span>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                            Wallet de Origen *
                          </label>
                          <select
                            value={sourceWalletId}
                            onChange={(e) =>
                              handleSourceWalletChange(e.target.value)
                            }
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                          >
                            {activeWallets.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.currency})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                            {alreadyPaidExternally
                              ? 'Monto pagado (Ref. opcional)'
                              : 'Monto a Entregar *'}
                          </label>
                          <button
                            type="button"
                            onClick={() => openCalculator('buy_usd')}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-semibold flex items-center gap-1"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Calcular</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={deliveredAmountStr}
                            onChange={(e) => setDeliveredAmountStr(e.target.value)}
                            placeholder={
                              alreadyPaidExternally
                                ? 'Opcional (Solo referencia)'
                                : 'Ej: 1310.00'
                            }
                            required={!alreadyPaidExternally}
                            className="w-full px-3 py-2 pr-8 text-xs font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() => openCalculator('buy_usd')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-blue-400 p-1"
                            title="Abrir calculadora"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Moneda Entregada
                        </label>
                        <select
                          value={deliveredCurrency}
                          onChange={(e) =>
                            setDeliveredCurrency(e.target.value as CurrencyCode)
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                        >
                          <option value="VES">Bolívares (VES)</option>
                          <option value="USD">Dólares (USD)</option>
                          <option value="USDT">USDT (Crypto)</option>
                        </select>
                      </div>
                    </div>

                    {/* SELECTOR DE COMISIÓN BANCARIA AL PAGAR EN BOLÍVARES (VES) */}
                    {!alreadyPaidExternally && deliveredCurrency === 'VES' && (
                      <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-[var(--text-primary)] block">
                              ¿Este pago en Bolívares tiene comisión bancaria?
                            </span>
                            <span className="text-[11px] text-[var(--text-secondary)]">
                              Marca si al transferir los Bs desde{' '}
                              <strong className="text-[var(--text-primary)]">
                                {selectedSourceWallet?.name || 'tu banco'}
                              </strong>{' '}
                              aplica comisión de Pago Móvil o Transferencia.
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setBankFeeMode('none')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                              bankFeeMode === 'none'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-blue-500/40'
                            }`}
                          >
                            Mismo banco / Sin comisión (0 Bs)
                          </button>

                          <button
                            type="button"
                            onClick={() => setBankFeeMode('pago_movil')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                              bankFeeMode === 'pago_movil'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-rose-500/40'
                            }`}
                          >
                            📲 Pago Móvil (
                            {selectedSourceWallet?.comisionPagoMovil ?? 0.3}% · mín
                            14 Bs)
                          </button>

                          <button
                            type="button"
                            onClick={() => setBankFeeMode('transferencia')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                              bankFeeMode === 'transferencia'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-rose-500/40'
                            }`}
                          >
                            🏦 Transferencia (
                            {selectedSourceWallet?.comisionTransferenciaTipo ===
                            'percent'
                              ? `${selectedSourceWallet?.comisionTransferencia ?? 1.5}%`
                              : `${selectedSourceWallet?.comisionTransferencia != null && selectedSourceWallet.comisionTransferencia >= 1 ? selectedSourceWallet.comisionTransferencia : 54} Bs`}
                            )
                          </button>

                          <button
                            type="button"
                            onClick={() => setBankFeeMode('custom')}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                              bankFeeMode === 'custom'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-rose-500/40'
                            }`}
                          >
                            ✏️ Otro monto manual
                          </button>
                        </div>

                        {bankFeeMode === 'custom' && (
                          <div className="pt-1">
                            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                              Monto de la comisión bancaria en Bolívares (Bs)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={customBankFeeStr}
                              onChange={(e) =>
                                setCustomBankFeeStr(e.target.value)
                              }
                              placeholder="Ej: 18.50"
                              className="w-full sm:w-64 px-3 py-1.5 text-xs font-mono-tabular font-bold rounded-lg bg-[var(--surface-subtle)] border border-rose-500/40 text-[var(--text-primary)]"
                            />
                          </div>
                        )}

                        {computedBankFeeVes > 0 && (
                          <div className="pt-2 border-t border-[var(--border-divider)] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono-tabular">
                            <span className="text-[var(--text-secondary)] font-sans">
                              Comisión bancaria a descontar de{' '}
                              <strong className="text-[var(--text-primary)]">
                                {selectedSourceWallet?.name || 'tu cuenta'}
                              </strong>
                              :
                            </span>
                            <strong className="text-rose-600 dark:text-rose-400">
                              -{formatearMonto(computedBankFeeVes, 'VES', locale)}{' '}
                              (Total a debitar:{' '}
                              {formatearMonto(
                                parsedDeliveredAmount + computedBankFeeVes,
                                'VES',
                                locale
                              )}
                              )
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN 2 (RECEIVABLE): LO QUE TE DEBEN RECIBIR */}
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4" />
                        2. Retorno: Divisas o monto que te deben (Cuenta por Cobrar)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Wallet Destino (al cobrar) *
                        </label>
                        <select
                          value={destinationWalletId}
                          onChange={(e) =>
                            handleDestinationWalletChange(e.target.value)
                          }
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                            Monto que te deben *
                          </label>
                          <button
                            type="button"
                            onClick={() => openCalculator('buy_usd')}
                            className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-semibold flex items-center gap-1"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Calcular</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={expectedAmountStr}
                            onChange={(e) => setExpectedAmountStr(e.target.value)}
                            placeholder="Ej: 20.00"
                            required
                            className="w-full px-3 py-2 pr-8 text-xs font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={() => openCalculator('buy_usd')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-emerald-600 dark:hover:text-emerald-400 p-1"
                            title="Abrir calculadora"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Moneda Esperada
                        </label>
                        <select
                          value={expectedCurrency}
                          onChange={(e) =>
                            setExpectedCurrency(e.target.value as CurrencyCode)
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                        >
                          <option value="USD">Dólares (USD)</option>
                          <option value="USDT">USDT (Crypto)</option>
                          <option value="VES">Bolívares (VES)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* FORMULARIO MODO 2: YO DEBO ENTREGAR (VENDÍ $ / RECIBÍ ANTES) */}
                  <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-divider)]">
                      <div>
                        <span
                          className={`text-xs font-bold flex items-center gap-1.5 ${
                            alreadyPaidExternally
                              ? 'text-teal-700 dark:text-teal-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {alreadyPaidExternally ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                1. Ya recibí ese dinero antes (No volver a sumar a mi balance)
                              </span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-4 h-4" />
                              <span>
                                1. Entrada: Dinero que me pasaron hoy (Suma a mi Saldo Real)
                              </span>
                            </>
                          )}
                        </span>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          {alreadyPaidExternally
                            ? 'Como ya recibiste esos Bolívares o pago previamente, no se volverán a sumar para no duplicar el saldo de tu cuenta.'
                            : 'El monto que te transfirieron hoy se sumará inmediatamente al Saldo Real de tu billetera receptora.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => setAlreadyPaidExternally(true)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                            alreadyPaidExternally
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Ya recibí ese dinero antes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAlreadyPaidExternally(false)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                            !alreadyPaidExternally
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          Lo recibí hoy (Sumar)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {alreadyPaidExternally ? (
                        <div className="p-2.5 rounded-xl bg-teal-500/10 dark:bg-teal-950/25 border border-teal-500/30 flex flex-col justify-center">
                          <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
                            Dinero ya recibido
                          </span>
                          <span className="text-[10px] text-teal-700 dark:text-teal-200/80 mt-0.5">
                            No duplicará el saldo en Bs de tu banco.
                          </span>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                            Wallet donde recibiste *
                          </label>
                          <select
                            value={destinationWalletId}
                            onChange={(e) =>
                              handleDestinationWalletChange(e.target.value)
                            }
                            className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                          >
                            {activeWallets.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.currency})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                            {alreadyPaidExternally
                              ? 'Monto que te pasaron (Ref. opcional)'
                              : 'Monto que te pasaron *'}
                          </label>
                          <button
                            type="button"
                            onClick={() => openCalculator('sell_usd')}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-semibold flex items-center gap-1"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Calcular</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={expectedAmountStr}
                            onChange={(e) => setExpectedAmountStr(e.target.value)}
                            placeholder={
                              alreadyPaidExternally
                                ? 'Opcional (Ej: 1310.00 Bs)'
                                : 'Ej: 1310.00'
                            }
                            required={!alreadyPaidExternally}
                            className="w-full px-3 py-2 pr-8 text-xs font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() => openCalculator('sell_usd')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-blue-400 p-1"
                            title="Abrir calculadora"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Moneda que te pasaron
                        </label>
                        <select
                          value={expectedCurrency}
                          onChange={(e) =>
                            setExpectedCurrency(e.target.value as CurrencyCode)
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                        >
                          <option value="VES">Bolívares (VES)</option>
                          <option value="USD">Dólares (USD)</option>
                          <option value="USDT">USDT (Crypto)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 2 (PAYABLE): LO QUE YO DEBO ENTREGAR EN OTRA FECHA */}
                  <div className="p-4 rounded-xl bg-amber-500/10 dark:bg-amber-950/15 border border-amber-500/35 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                        <ArrowDownRight className="w-4 h-4" />
                        2. Compromiso: Monto en efectivo o divisas que TÚ DEBES ENTREGAR
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Wallet de donde entregarás *
                        </label>
                        <select
                          value={sourceWalletId}
                          onChange={(e) =>
                            handleSourceWalletChange(e.target.value)
                          }
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-amber-900 dark:text-amber-300">
                            Monto que tú debes entregar *
                          </label>
                          <button
                            type="button"
                            onClick={() => openCalculator('sell_usd')}
                            className="text-[10px] text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 font-semibold flex items-center gap-1"
                          >
                            <Calculator className="w-3 h-3" />
                            <span>Calcular</span>
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={deliveredAmountStr}
                            onChange={(e) => setDeliveredAmountStr(e.target.value)}
                            placeholder="Ej: 20.00"
                            required
                            className="w-full px-3 py-2 pr-8 text-xs font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-amber-500/50 text-amber-800 dark:text-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() => openCalculator('sell_usd')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-amber-700 dark:hover:text-amber-400 p-1"
                            title="Abrir calculadora"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                          Moneda que debes entregar
                        </label>
                        <select
                          value={deliveredCurrency}
                          onChange={(e) =>
                            setDeliveredCurrency(e.target.value as CurrencyCode)
                          }
                          className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                        >
                          <option value="USD">Dólares Efectivo / USD ($)</option>
                          <option value="USDT">USDT (Crypto)</option>
                          <option value="VES">Bolívares (VES)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Tasa de cambio pactada y calculadora rápida */}
              <div className="px-4 py-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-secondary)]">Tasa pactada:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={agreedRateStr}
                    onChange={(e) => {
                      setAgreedRateStr(e.target.value);
                      const num = Number(e.target.value.replace(',', '.'));
                      if (num > 0) handleApplyRateToExpected(num);
                    }}
                    placeholder="Bs/USD"
                    className="w-24 px-2 py-1 text-xs font-mono-tabular font-bold rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleCalculateRate}
                    className="px-2 py-1 rounded bg-[var(--surface)] text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline border border-[var(--border-hairline)]"
                  >
                    Auto-calcular tasa
                  </button>
                </div>

                {officialRate && (
                  <button
                    type="button"
                    onClick={() => {
                      setAgreedRateStr(String(officialRate));
                      handleApplyRateToExpected(officialRate);
                    }}
                    className="text-[11px] font-semibold text-[var(--text-primary)] dark:text-[var(--text-secondary)] hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Usar BCV ({formatearTasa(officialRate, locale)})
                  </button>
                )}
              </div>

              {/* Fechas */}
              <div
                className={`grid grid-cols-1 ${
                  editingOperation?.status === 'settled'
                    ? 'sm:grid-cols-3'
                    : 'sm:grid-cols-2'
                } gap-3`}
              >
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    {direction === 'payable'
                      ? alreadyPaidExternally
                        ? 'Fecha en que recibiste los Bs / pactaste la venta'
                        : 'Fecha de recepción de los Bs'
                      : alreadyPaidExternally
                        ? 'Fecha en que hiciste el acuerdo / pago'
                        : 'Fecha de la operación / entrega'}
                  </label>
                  <input
                    type="date"
                    value={operationDate}
                    onChange={(e) => setOperationDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    {direction === 'payable'
                      ? 'Fecha estimada para entregar divisas'
                      : 'Fecha estimada de cobro de divisas'}
                  </label>
                  <input
                    type="date"
                    value={estimatedSettlementDate}
                    onChange={(e) => setEstimatedSettlementDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] border border-amber-500/45 text-[var(--text-primary)]"
                  />
                </div>

                {editingOperation?.status === 'settled' && (
                  <div>
                    <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      Fecha real de liquidación / entrega
                    </label>
                    <input
                      type="date"
                      value={settledAtDate}
                      onChange={(e) => setSettledAtDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] border border-emerald-500/45 text-[var(--text-primary)]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Notas adicionales / Referencia
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    direction === 'payable'
                      ? 'Ej: Ya me pasó el Pago Móvil, le entrego los $20 en efectivo el viernes'
                      : 'Ej: Acordamos entrega en café el viernes'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                />
              </div>

              {/* Caja de Protección de Saldos */}
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  direction === 'payable'
                    ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/35 text-amber-900 dark:text-amber-200'
                    : alreadyPaidExternally
                      ? 'bg-teal-500/10 dark:bg-teal-950/20 border-teal-500/35 text-teal-900 dark:text-teal-300'
                      : 'bg-blue-500/10 dark:bg-blue-950/20 border-blue-500/30 text-blue-900 dark:text-blue-300'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    {direction === 'payable'
                      ? alreadyPaidExternally
                        ? 'Modo «Ya recibí ese dinero antes y yo debo entregar»'
                        : 'Modo «Recibí hoy y debo entregar en otra fecha»'
                      : alreadyPaidExternally
                        ? 'Modo «Ya lo pagué antes»: Tu balance actual no se verá afectado'
                        : 'Protección Automática de Saldos'}
                  </span>
                </div>
                <p className="text-[11px] opacity-95">
                  {direction === 'payable' ? (
                    alreadyPaidExternally ? (
                      <>
                        <strong>No se volverán a sumar los Bs</strong> a tu cuenta para evitar duplicados. Los{' '}
                        <strong>
                          {formatearMonto(
                            parsedDeliveredAmount,
                            deliveredCurrency,
                            locale
                          )}
                        </strong>{' '}
                        que debes entregar quedarán registrados como compromiso pendiente (restando de tu Saldo Proyectado) y solo se descontarán de tu Saldo Real cuando presiones «Marcar como Entregado».
                      </>
                    ) : (
                      <>
                        El monto recibido ({formatearMonto(parsedExpectedAmount, expectedCurrency, locale)}) se sumará hoy a tu Saldo Real. Los{' '}
                        <strong>
                          {formatearMonto(
                            parsedDeliveredAmount,
                            deliveredCurrency,
                            locale
                          )}
                        </strong>{' '}
                        que debes entregar quedarán agendados como pendientes en tu Saldo Proyectado hasta que los entregues.
                      </>
                    )
                  ) : alreadyPaidExternally ? (
                    <>
                      <strong>No se descontará nada</strong> de tus billeteras en Bs ni de tu balance general. Las divisas que te deben ({formatearMonto(parsedExpectedAmount, expectedCurrency, locale)}) quedarán registradas como pendientes por cobrar para la fecha establecida y solo sumarán a tu Saldo Real cuando presiones «Liquidar y Recibir».
                    </>
                  ) : (
                    <>
                      El monto entregado ({formatearMonto(parsedDeliveredAmount, deliveredCurrency, locale)}
                      {computedBankFeeVes > 0
                        ? ` + ${formatearMonto(computedBankFeeVes, 'VES', locale)} de comisión bancaria = ${formatearMonto(parsedDeliveredAmount + computedBankFeeVes, 'VES', locale)}`
                        : ''}
                      ) se debitará hoy de tu Saldo Real. El retorno ({formatearMonto(parsedExpectedAmount, expectedCurrency, locale)}) sumará únicamente a tus Cuentas por Cobrar en el Saldo Proyectado, y <strong>NO entrará al Saldo Real</strong> de tu billetera destino hasta que presiones «Liquidar y Recibir».
                    </>
                  )}
                </p>
              </div>

              {/* Botones de Envío */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--border-divider)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingOperationId(null);
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-semibold rounded-xl text-white flex items-center gap-1.5 shadow-lg ${
                    direction === 'payable'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {editingOperationId
                      ? 'Guardar Cambios de la Operación'
                      : direction === 'payable'
                        ? 'Guardar Compromiso por Entregar'
                        : 'Guardar Operación por Cobrar'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Calculadora de Cambio P2P ($ ⇄ Bs) */}
      <P2PRateCalculatorModal
        isOpen={isCalcModalOpen}
        onClose={() => setIsCalcModalOpen(false)}
        officialRate={officialRate}
        locale={locale}
        initialMode={calcModalInitialMode}
        onApplyCalculation={handleApplyCalculation}
      />

      {/* Modal para Liquidar Operación */}
      <SettleP2PModal
        isOpen={Boolean(settlingOperation)}
        onClose={() => setSettlingOperation(null)}
        operation={settlingOperation}
        wallets={appData.wallets || []}
        officialRate={officialRate}
        locale={locale}
        onConfirmSettle={handleConfirmSettle}
      />
    </div>
  );
};
