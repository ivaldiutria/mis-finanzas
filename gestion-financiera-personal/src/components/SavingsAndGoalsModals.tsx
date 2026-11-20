import React, { useEffect, useState } from 'react';
import {
  X,
  AlertCircle,
  PiggyBank,
  Target,
  Calendar,
  Tag,
  Wallet,
  FileText,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Category,
  CurrencyCode,
  ExchangeRateSource,
  SavingsGoal,
  SavingsMovement,
  SavingsMovementType,
  WalletAccount,
} from '../types/finance';
import { calcularEquivalenteUsd, obtenerFechaLocalIso } from '../utils/calculations';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { UsdToVesHelper } from './UsdToVesHelper';

interface SavingsModalProps {
  isOpen: boolean;
  editingMovement: SavingsMovement | null;
  categories: Category[];
  wallets: WalletAccount[];
  goals: SavingsGoal[];
  officialRate: number | null;
  defaultManualRate: number | null;
  locale: 'es-VE' | 'en-US';
  onClose: () => void;
  onSave: (movement: SavingsMovement) => void;
}

export const SavingsModal: React.FC<SavingsModalProps> = ({
  isOpen,
  editingMovement,
  categories,
  wallets,
  goals,
  officialRate,
  defaultManualRate,
  locale,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<SavingsMovementType>('deposit');
  const [walletId, setWalletId] = useState<string>('');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'add' | 'subtract'>('add');
  const [date, setDate] = useState<string>(() => obtenerFechaLocalIso());
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [goalId, setGoalId] = useState<string>('');
  const [originCurrency, setOriginCurrency] = useState<CurrencyCode>('USD');
  const [amountInputStr, setAmountInputStr] = useState<string>('');
  const [rateSource, setRateSource] = useState<ExchangeRateSource>('bcv');
  const [manualRateStr, setManualRateStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const savingsCategories = categories.filter(
    (c) => c.type === 'savings' && (c.active || c.id === categoryId)
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    const defaultWallet =
      wallets.find((w) => w.active && !w.isThirdPartyExpenseAccount)?.id ||
      wallets[0]?.id ||
      '';
    if (editingMovement) {
      setType(editingMovement.type);
      setWalletId(editingMovement.walletId || defaultWallet);
      setAdjustmentDirection(editingMovement.adjustmentDirection || 'add');
      setDate(editingMovement.date);
      setDescription(editingMovement.description);
      setCategoryId(editingMovement.categoryId);
      setGoalId(editingMovement.goalId || '');
      setOriginCurrency(editingMovement.originalCurrency || 'USD');
      if (editingMovement.originalCurrency === 'VES' && editingMovement.originalAmountVes) {
        setAmountInputStr(String(editingMovement.originalAmountVes));
        setRateSource(editingMovement.exchangeRateSource === 'bcv' ? 'bcv' : 'manual');
        setManualRateStr(
          editingMovement.exchangeRateUsed
            ? String(Number(editingMovement.exchangeRateUsed.toFixed(2)))
            : ''
        );
      } else {
        setAmountInputStr(String(editingMovement.amountUsd));
        setRateSource(officialRate ? 'bcv' : 'manual');
        setManualRateStr(
          defaultManualRate ? String(Number(defaultManualRate.toFixed(2))) : ''
        );
      }
      setNotes(editingMovement.notes || '');
    } else {
      setType('deposit');
      setWalletId(defaultWallet);
      setAdjustmentDirection('add');
      setDate(obtenerFechaLocalIso());
      setDescription('');
      setCategoryId(savingsCategories[0]?.id || 'cat_sav_emergency');
      setGoalId('');
      setOriginCurrency('USD');
      setAmountInputStr('');
      setRateSource(officialRate ? 'bcv' : 'manual');
      setManualRateStr(
        defaultManualRate
          ? String(Number(defaultManualRate.toFixed(2)))
          : officialRate
            ? String(Number(officialRate.toFixed(2)))
            : ''
      );
      setNotes('');
    }
  }, [isOpen, editingMovement]);

  if (!isOpen) return null;

  const parsedInput = Number(amountInputStr.replace(',', '.'));
  const selectedRateVal =
    rateSource === 'bcv'
      ? officialRate
      : Number(manualRateStr.replace(',', '.'));
  const validSelectedRate =
    selectedRateVal && Number.isFinite(selectedRateVal) && selectedRateVal > 0
      ? selectedRateVal
      : null;

  const activeRate = originCurrency === 'USD' ? null : validSelectedRate;

  const computedUsd =
    originCurrency === 'USD'
      ? Number.isFinite(parsedInput) && parsedInput > 0
        ? parsedInput
        : 0
      : calcularEquivalenteUsd(parsedInput, 'VES', activeRate);

  const previewVesFromUsd =
    originCurrency === 'USD' &&
    Number.isFinite(parsedInput) &&
    parsedInput > 0 &&
    validSelectedRate
      ? parsedInput * validSelectedRate
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!description.trim()) {
      setErrorMsg('Ingresa una descripción para el movimiento de ahorro.');
      return;
    }
    if (!Number.isFinite(parsedInput) || parsedInput <= 0) {
      setErrorMsg('El importe debe ser un número positivo mayor que cero.');
      return;
    }
    if (originCurrency === 'VES') {
      if (!activeRate || !Number.isFinite(activeRate) || activeRate <= 0) {
        setErrorMsg(
          'Para convertir bolívares a ahorro en USD debes indicar una tasa de cambio válida mayor que cero.'
        );
        return;
      }
    }
    if (computedUsd <= 0) {
      setErrorMsg('El importe en USD resultante debe ser mayor que cero.');
      return;
    }

    const movement: SavingsMovement = {
      id: editingMovement
        ? editingMovement.id
        : `sav_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date,
      type,
      walletId: type === 'adjustment' ? undefined : walletId || undefined,
      amountUsd: computedUsd,
      adjustmentDirection: type === 'adjustment' ? adjustmentDirection : undefined,
      description: description.trim(),
      categoryId: categoryId || 'cat_sav_other',
      goalId: goalId || null,
      originalCurrency: originCurrency,
      originalAmountVes: originCurrency === 'VES' ? parsedInput : null,
      exchangeRateUsed: originCurrency === 'VES' ? activeRate : null,
      exchangeRateSource:
        originCurrency === 'VES' ? (rateSource === 'bcv' ? 'bcv' : 'manual') : 'none',
      notes: notes.trim(),
      isDemo: editingMovement?.isDemo ?? false,
    };

    onSave(movement);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera amigable con icono contextual */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[var(--lavender-accent)]/15 text-[var(--lavender-accent)] border border-[var(--lavender-accent)]/30 flex items-center justify-center shrink-0">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                {editingMovement ? 'Editar ahorro' : 'Nuevo movimiento de ahorro'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Aporta o retira de tu reserva patrimonial en USD
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-[var(--expense-bg)] border border-[var(--expense-border)] text-xs text-[var(--expense-text-dark)]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Selector compacto de Tipo de movimiento de ahorro */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setType('deposit')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === 'deposit'
                  ? 'bg-[var(--lavender-accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Aporte (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('withdrawal')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === 'withdrawal'
                  ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>Retiro (-)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('adjustment')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === 'adjustment'
                  ? 'bg-[var(--rose-gold)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Ajuste</span>
            </button>
          </div>

          {type === 'adjustment' && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Sentido del ajuste:</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="radio"
                    checked={adjustmentDirection === 'add'}
                    onChange={() => setAdjustmentDirection('add')}
                  />
                  Sumar (+)
                </label>
                <label className="flex items-center gap-1.5 text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="radio"
                    checked={adjustmentDirection === 'subtract'}
                    onChange={() => setAdjustmentDirection('subtract')}
                  />
                  Restar (-)
                </label>
              </div>
            </div>
          )}

          {/* 1. Fecha y Categoría (Antes del monto) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Fecha del movimiento *</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Tag className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Categoría de ahorro *</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              >
                {savingsCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Cuenta y Meta asociada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {type !== 'adjustment' && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  <Wallet className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span>{type === 'deposit' ? 'Desde cuenta' : 'Hacia cuenta'}</span>
                </label>
                <select
                  value={walletId}
                  onChange={(e) => setWalletId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                >
                  {wallets
                    .filter(
                      (w) =>
                        (w.active && !w.isThirdPartyExpenseAccount) ||
                        w.id === walletId
                    )
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency})
                      </option>
                    ))}
                  <option value="">General</option>
                </select>
              </div>
            )}

            <div className={type === 'adjustment' ? 'sm:col-span-2' : ''}>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Target className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Meta asociada (opcional)</span>
              </label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              >
                <option value="">Sin meta específica (ahorro general)</option>
                {goals
                  .filter((g) => g.status !== 'archived' || g.id === goalId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({formatearMonto(g.targetAmountUsd, 'USD', locale)})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* 3. Descripción */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>Concepto del ahorro *</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Aporte quincenal al fondo de emergencia..."
              required
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          {/* 4. Tarjeta Principal de Monto y Conversión */}
          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Monto del ahorro *
              </label>
              <div className="inline-flex p-0.5 bg-[var(--surface)] border border-[var(--border-input)] rounded-xl">
                <button
                  type="button"
                  onClick={() => setOriginCurrency('USD')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    originCurrency === 'USD'
                      ? 'bg-[var(--lavender-accent)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setOriginCurrency('VES')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    originCurrency === 'VES'
                      ? 'bg-[var(--lavender-accent)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Desde Bs
                </button>
              </div>
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xl sm:text-2xl font-bold font-mono-tabular text-[var(--lavender-accent)] select-none">
                {originCurrency === 'USD' ? '$' : 'Bs'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountInputStr}
                onChange={(e) => setAmountInputStr(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-12 pr-4 py-3 text-xl sm:text-2xl font-bold font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-2xl focus:outline-none focus:border-[var(--lavender-accent)]"
              />
            </div>

            {originCurrency === 'VES' && (
              <UsdToVesHelper
                officialRate={officialRate}
                defaultManualRate={defaultManualRate}
                currentRate={activeRate}
                rateSource={rateSource === 'manual' ? 'manual' : 'bcv'}
                locale={locale}
                compact
                onApplyVesAmount={(vesStr, usedRate, src) => {
                  setAmountInputStr(vesStr);
                  setRateSource(src);
                  if (src === 'manual') {
                    setManualRateStr(String(usedRate));
                  }
                }}
              />
            )}

            <div className="pt-2.5 border-t border-[var(--border-hairline)] flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span>Tasa:</span>
                  <div className="inline-flex items-center gap-1 bg-[var(--surface)] p-0.5 rounded-lg border border-[var(--border-input)]">
                    <button
                      type="button"
                      onClick={() => setRateSource('bcv')}
                      disabled={!officialRate}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                        rateSource === 'bcv'
                          ? 'bg-[var(--lavender-accent)] text-white'
                          : 'text-[var(--text-secondary)] disabled:opacity-40'
                      }`}
                    >
                      BCV ({formatearTasa(officialRate, locale)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRateSource('manual')}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                        rateSource === 'manual'
                          ? 'bg-[var(--lavender-accent)] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono-tabular">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {originCurrency === 'VES' ? 'Ahorro en USD:' : 'En Bs:'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] bg-[var(--surface)] px-2.5 py-0.5 rounded-lg border border-[var(--border-hairline)]">
                    {originCurrency === 'VES'
                      ? formatearMonto(computedUsd, 'USD', locale)
                      : validSelectedRate
                        ? formatearMonto(previewVesFromUsd, 'VES', locale)
                        : '—'}
                  </span>
                </div>
              </div>

              {rateSource === 'manual' && (
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
                    Tasa manual (Bs/$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={manualRateStr}
                    onChange={(e) => setManualRateStr(e.target.value)}
                    placeholder="Ej. 881.88"
                    className="w-full px-2.5 py-1 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Nota rápida (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle o recordatorio..."
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
          </div>

          <div className="sticky bottom-0 bg-[var(--surface)] flex items-center justify-end gap-2.5 pt-3 pb-1 border-t border-[var(--border-hairline)] z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl border border-[var(--border-input)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-[var(--lavender-accent)] hover:bg-[var(--lavender-dark)] rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editingMovement ? 'Guardar cambios' : 'Registrar en ahorros'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GoalModalProps {
  isOpen: boolean;
  editingGoal: SavingsGoal | null;
  onClose: () => void;
  onSave: (goal: SavingsGoal) => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  editingGoal,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#C86D85');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (editingGoal) {
      setName(editingGoal.name);
      setDescription(editingGoal.description || '');
      setTargetStr(String(editingGoal.targetAmountUsd));
      setTargetDate(editingGoal.targetDate || '');
      setColor(editingGoal.color || '#C86D85');
    } else {
      setName('');
      setDescription('');
      setTargetStr('');
      setTargetDate('');
      setColor('#C86D85');
    }
  }, [isOpen, editingGoal]);

  if (!isOpen) return null;

  const palette = ['#C86D85', '#1E40AF', '#059669', '#8A79A6', '#0284C7', '#D97706'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = Number(targetStr.replace(',', '.'));
    if (!name.trim()) {
      setErrorMsg('Ingresa un nombre para tu meta de ahorro.');
      return;
    }
    if (!Number.isFinite(targetVal) || targetVal <= 0) {
      setErrorMsg('El importe objetivo en USD debe ser mayor que cero.');
      return;
    }

    const goal: SavingsGoal = {
      id: editingGoal ? editingGoal.id : `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      description: description.trim(),
      targetAmountUsd: targetVal,
      createdAt: editingGoal ? editingGoal.createdAt : obtenerFechaLocalIso(),
      targetDate: targetDate || null,
      status: editingGoal ? editingGoal.status : 'active',
      color,
      isDemo: editingGoal?.isDemo ?? false,
    };

    onSave(goal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] border border-[var(--pink-primary)]/30 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {editingGoal ? 'Editar meta de ahorro' : 'Nueva meta de ahorro'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Define tu objetivo y haz seguimiento a tu progreso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-[var(--expense-bg)] border border-[var(--expense-border)] text-xs text-[var(--expense-text-dark)]">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>Nombre de la meta *</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Comprar laptop, Viaje, Fondo de emergencia..."
              required
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Fecha objetivo (opc.)</span>
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                Color distintivo
              </label>
              <div className="flex items-center gap-2 py-1">
                {palette.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor(hex)}
                    style={{ backgroundColor: hex }}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      color === hex ? 'scale-115 ring-2 ring-offset-2 ring-[var(--text-primary)]' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tarjeta de Monto Objetivo */}
          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
            <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Meta objetivo en USD ($) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xl font-bold font-mono-tabular text-[var(--pink-primary)] select-none">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={targetStr}
                onChange={(e) => setTargetStr(e.target.value)}
                placeholder="1000.00"
                required
                className="w-full pl-10 pr-4 py-2.5 text-xl font-bold font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-2xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Motivación o nota (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Por qué es importante esta meta para ti?"
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] rounded-xl border border-[var(--border-input)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Guardar meta</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

