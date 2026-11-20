import React, { useEffect, useState } from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Landmark,
  ArrowRightLeft,
  Percent,
  ShoppingBag,
  Plus,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  Tag,
  FileText,
  Repeat,
} from 'lucide-react';
import {
  Category,
  CurrencyCode,
  ExchangeRateSource,
  ExpenseKind,
  Transaction,
  TransactionPurchasedItem,
  TransactionStatus,
  TransactionType,
  WalletAccount,
  RateHistoryEntry,
} from '../types/finance';
import {
  calcularEquivalenteUsd,
  obtenerFechaLocalIso,
  obtenerIdCategoriaComisionBancaria,
} from '../utils/calculations';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { obtenerTasaPorFecha } from '../utils/historicalRatesImporter';
import { UsdToVesHelper } from './UsdToVesHelper';

export interface PresetTransactionValues {
  description?: string;
  amount?: number;
  currency?: CurrencyCode;
  categoryId?: string;
  notes?: string;
  walletId?: string;
  expenseType?: ExpenseKind;
  isInterbankTransfer?: boolean;
  interbankFeeType?: 'pago_movil' | 'transferencia';
  paymentMethod?: string;
  forceCompletedStatus?: boolean;
  enableItemizedMode?: boolean;
  storeName?: string;
  purchasedItems?: TransactionPurchasedItem[];
}

interface TransactionModalProps {
  isOpen: boolean;
  initialType: TransactionType;
  editingTransaction: Transaction | null;
  presetValues?: PresetTransactionValues | null;
  categories: Category[];
  wallets: WalletAccount[];
  officialRate: number | null;
  officialRateDate: string | null;
  defaultManualRate: number | null;
  preferManualByDefault: boolean;
  rateHistory?: RateHistoryEntry[];
  existingTransactions?: Transaction[];
  locale: 'es-VE' | 'en-US';
  onClose: () => void;
  onSave: (txn: Transaction, feeTxn?: Transaction) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  initialType,
  editingTransaction,
  presetValues,
  categories,
  wallets,
  officialRate,
  officialRateDate,
  defaultManualRate,
  preferManualByDefault,
  rateHistory = [],
  existingTransactions = [],
  locale,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [status, setStatus] = useState<TransactionStatus>('completed');
  const [walletId, setWalletId] = useState<string>('');
  const [date, setDate] = useState<string>(() => obtenerFechaLocalIso());
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [rateSource, setRateSource] = useState<ExchangeRateSource>('bcv');
  const [lockedOfficialRate, setLockedOfficialRate] = useState<number | null>(null);
  const [manualRateStr, setManualRateStr] = useState<string>('');
  const [dateRateHint, setDateRateHint] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [expenseType, setExpenseType] = useState<ExpenseKind>('variable');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applyRateForSelectedDate = (targetDateIso: string) => {
    setDate(targetDateIso);
    const lookup = obtenerTasaPorFecha(
      targetDateIso,
      rateHistory,
      officialRate || defaultManualRate,
      existingTransactions
    );
    if (lookup.rate && lookup.rate > 0) {
      const rounded = Number(lookup.rate.toFixed(2));
      setLockedOfficialRate(rounded);
      setManualRateStr(String(rounded));
      if (lookup.exactMatch || lookup.matchedDate) {
        setDateRateHint(`${lookup.sourceLabel}: ${rounded.toFixed(2)} Bs/$`);
      } else {
        setDateRateHint(null);
      }
    } else {
      setDateRateHint(null);
    }
  };

  // Estados para automatización de comisiones bancarias (Pago Móvil / Transferencia a otro banco)
  const [isOtherBank, setIsOtherBank] = useState<boolean>(false);
  const [interbankType, setInterbankType] = useState<'pago_movil' | 'transferencia'>('pago_movil');
  const [transferFeeMode, setTransferFeeMode] = useState<'fixed_ves' | 'percent'>('fixed_ves');
  const [feePercentStr, setFeePercentStr] = useState<string>('0.3');

  // Estados para Compra con Desglose de Artículos ("Tipo Compras Farmatodo")
  const [isItemizedPurchase, setIsItemizedPurchase] = useState<boolean>(false);
  const [storeName, setStoreName] = useState<string>('');
  const [purchasedItems, setPurchasedItems] = useState<TransactionPurchasedItem[]>([]);
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemQtyStr, setNewItemQtyStr] = useState<string>('1');
  const [newItemPriceStr, setNewItemPriceStr] = useState<string>('');

  const activeWallets = wallets.filter(
    (w) =>
      (w.active && !w.isThirdPartyExpenseAccount) ||
      w.id === walletId ||
      w.id === editingTransaction?.walletId ||
      w.id === presetValues?.walletId
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setDateRateHint(null);
    const defaultWallet =
      wallets.find((w) => w.active && !w.isThirdPartyExpenseAccount)?.id ||
      wallets.find((w) => !w.isThirdPartyExpenseAccount)?.id ||
      wallets[0]?.id ||
      '';

    if (editingTransaction) {
      setType(editingTransaction.type);
      setStatus(
        presetValues?.forceCompletedStatus
          ? 'completed'
          : editingTransaction.status || 'completed'
      );
      setWalletId(editingTransaction.walletId || defaultWallet);
      setDate(
        presetValues?.forceCompletedStatus
          ? obtenerFechaLocalIso()
          : editingTransaction.date
      );
      setDescription(editingTransaction.description);
      setCategoryId(editingTransaction.categoryId);
      setAmountStr(String(editingTransaction.amount));
      setCurrency(editingTransaction.currency);
      setSource(editingTransaction.source || '');
      setPaymentMethod(editingTransaction.paymentMethod || '');
      setExpenseType(editingTransaction.expenseType || 'variable');
      setIsRecurring(Boolean(editingTransaction.isRecurring));
      setNotes(editingTransaction.notes || '');

      if (editingTransaction.currency === 'VES') {
        const rawSavedRate = editingTransaction.exchangeRate || officialRate || defaultManualRate || 0;
        const savedRate = rawSavedRate > 0 ? Number(rawSavedRate.toFixed(2)) : 0;
        setLockedOfficialRate(
          editingTransaction.exchangeRateSource === 'bcv'
            ? savedRate
            : officialRate
              ? Number(officialRate.toFixed(2))
              : null
        );
        setRateSource(
          editingTransaction.exchangeRateSource === 'bcv' ? 'bcv' : 'manual'
        );
        setManualRateStr(savedRate > 0 ? String(savedRate) : '');
      } else {
        setLockedOfficialRate(officialRate ? Number(officialRate.toFixed(2)) : null);
        setRateSource(officialRate ? 'bcv' : 'manual');
        setManualRateStr(
          defaultManualRate ? String(Number(defaultManualRate.toFixed(2))) : ''
        );
      }

      const existingItems = editingTransaction.purchasedItems || [];
      setIsItemizedPurchase(
        existingItems.length > 0 || Boolean(editingTransaction.storeName)
      );
      setStoreName(editingTransaction.storeName || '');
      setPurchasedItems(existingItems);
      setNewItemName('');
      setNewItemQtyStr('1');
      setNewItemPriceStr('');

      const initInterbankType = editingTransaction.interbankFeeType || 'pago_movil';
      setIsOtherBank(Boolean(editingTransaction.isInterbankTransfer));
      setInterbankType(initInterbankType);
      const editWallet = wallets.find((w) => w.id === (editingTransaction.walletId || defaultWallet));
      const editTrMode =
        editWallet?.comisionTransferenciaTipo ||
        (editWallet?.isBonusCard ? 'percent' : 'fixed_ves');
      setTransferFeeMode(editTrMode);
      if (editingTransaction.interbankFeeAmount && editingTransaction.amount > 0) {
        if (initInterbankType === 'transferencia' && editTrMode === 'fixed_ves') {
          setFeePercentStr(String(Number(editingTransaction.interbankFeeAmount.toFixed(2))));
        } else {
          setFeePercentStr(
            String(
              Number(
                ((editingTransaction.interbankFeeAmount / editingTransaction.amount) * 100).toFixed(2)
              )
            )
          );
        }
      } else {
        if (initInterbankType === 'transferencia') {
          const defTrVal =
            editTrMode === 'percent'
              ? editWallet?.comisionTransferencia ?? 1.5
              : editWallet?.comisionTransferencia != null && editWallet.comisionTransferencia > 0.5
                ? editWallet.comisionTransferencia
                : editWallet?.currency === 'VES'
                  ? 54
                  : 0;
          setFeePercentStr(String(defTrVal));
        } else {
          const defPmPct =
            editWallet?.comisionPagoMovil != null
              ? editWallet.comisionPagoMovil
              : editWallet?.currency === 'VES'
                ? 0.3
                : 0;
          setFeePercentStr(String(defPmPct));
        }
      }
    } else {
      setType(initialType);
      setStatus('completed');
      const pickedWalletId = presetValues?.walletId || defaultWallet;
      setWalletId(pickedWalletId);
      setDate(obtenerFechaLocalIso());
      setDescription(presetValues?.description || '');
      const availableCats = categories.filter(
        (c) => c.type === initialType && c.active
      );
      const matchedCat =
        presetValues?.categoryId &&
        categories.some((c) => c.id === presetValues.categoryId)
          ? presetValues.categoryId
          : availableCats[0]?.id || '';
      setCategoryId(matchedCat);
      setAmountStr(
        presetValues?.amount != null && presetValues.amount > 0
          ? String(presetValues.amount)
          : ''
      );
      const presetCurr = presetValues?.currency || 'USD';
      setCurrency(presetCurr);
      setLockedOfficialRate(officialRate ? Number(officialRate.toFixed(2)) : null);
      const useManual =
        preferManualByDefault || (!officialRate && Boolean(defaultManualRate));
      setRateSource(useManual ? 'manual' : 'bcv');
      setManualRateStr(
        defaultManualRate
          ? String(Number(defaultManualRate.toFixed(2)))
          : officialRate
            ? String(Number(officialRate.toFixed(2)))
            : ''
      );
      setSource('');
      setPaymentMethod(presetValues?.paymentMethod || '');
      setExpenseType(presetValues?.expenseType || 'variable');
      setIsRecurring(false);
      setNotes(presetValues?.notes || '');
      setIsItemizedPurchase(
        Boolean(presetValues?.enableItemizedMode) ||
          Boolean(presetValues?.purchasedItems && presetValues.purchasedItems.length > 0) ||
          Boolean(presetValues?.storeName)
      );
      setStoreName(presetValues?.storeName || '');
      setPurchasedItems(presetValues?.purchasedItems || []);
      setNewItemName('');
      setNewItemQtyStr('1');
      setNewItemPriceStr('');
      const isOther = Boolean(presetValues?.isInterbankTransfer);
      setIsOtherBank(isOther);
      const chosenType = presetValues?.interbankFeeType || 'pago_movil';
      setInterbankType(chosenType);

      const curWallet = wallets.find((w) => w.id === pickedWalletId);
      const trMode =
        curWallet?.comisionTransferenciaTipo ||
        (curWallet?.isBonusCard ? 'percent' : 'fixed_ves');
      setTransferFeeMode(trMode);

      if (chosenType === 'transferencia') {
        const defTrVal =
          trMode === 'percent'
            ? curWallet?.comisionTransferencia ?? 1.5
            : curWallet?.comisionTransferencia != null && curWallet.comisionTransferencia > 0.5
              ? curWallet.comisionTransferencia
              : curWallet?.currency === 'VES'
                ? 54
                : 0;
        setFeePercentStr(String(defTrVal));
      } else {
        const defPmPct =
          curWallet?.comisionPagoMovil != null
            ? curWallet.comisionPagoMovil
            : curWallet?.currency === 'VES'
              ? 0.3
              : 0;
        setFeePercentStr(String(defPmPct));
      }
    }
  }, [isOpen, editingTransaction, initialType, presetValues, wallets, officialRate, defaultManualRate, preferManualByDefault]);

  // Actualizar tasa de comisión predeterminada cuando el usuario cambia de billetera o tipo de operación
  useEffect(() => {
    if (!isOpen) return;
    if (
      editingTransaction &&
      editingTransaction.isInterbankTransfer &&
      editingTransaction.walletId === walletId &&
      (editingTransaction.interbankFeeType || 'pago_movil') === interbankType
    ) {
      return;
    }
    const curWallet = wallets.find((w) => w.id === walletId);
    const trMode =
      curWallet?.comisionTransferenciaTipo ||
      (curWallet?.isBonusCard ? 'percent' : 'fixed_ves');
    setTransferFeeMode(trMode);

    if (interbankType === 'pago_movil') {
      const targetPct =
        curWallet?.comisionPagoMovil != null
          ? curWallet.comisionPagoMovil
          : curWallet?.currency === 'VES'
            ? 0.3
            : 0;
      setFeePercentStr(String(targetPct));
    } else {
      const targetTrVal =
        trMode === 'percent'
          ? curWallet?.comisionTransferencia ?? 1.5
          : curWallet?.comisionTransferencia != null && curWallet.comisionTransferencia > 0.5
            ? curWallet.comisionTransferencia
            : curWallet?.currency === 'VES'
              ? 54
              : 0;
      setFeePercentStr(String(targetTrVal));
    }
  }, [isOpen, walletId, interbankType, wallets, editingTransaction]);

  useEffect(() => {
    if (!isOpen) return;
    const validForType = categories.filter(
      (c) => c.type === type && (c.active || c.id === categoryId)
    );
    if (!validForType.some((c) => c.id === categoryId)) {
      setCategoryId(validForType[0]?.id || '');
    }
  }, [type, categories, isOpen, categoryId]);

  if (!isOpen) return null;

  const parsedAmount = Number(amountStr.replace(',', '.'));
  const selectedRateValue =
    rateSource === 'bcv'
      ? lockedOfficialRate
      : Number(manualRateStr.replace(',', '.'));

  const validSelectedRate =
    selectedRateValue &&
    Number.isFinite(selectedRateValue) &&
    selectedRateValue > 0
      ? Number(selectedRateValue.toFixed(2))
      : null;

  const activeExchangeRate = currency === 'USD' ? null : validSelectedRate;

  const handleAddPurchasedItem = () => {
    const cleanName = newItemName.trim();
    if (!cleanName) return;
    const rawQty = Number(newItemQtyStr.replace(',', '.'));
    const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
    const rawPrice = newItemPriceStr.trim()
      ? Number(newItemPriceStr.replace(',', '.'))
      : NaN;
    const unitPrice =
      Number.isFinite(rawPrice) && rawPrice >= 0
        ? Number(rawPrice.toFixed(2))
        : null;

    const item: TransactionPurchasedItem = {
      id: `pitem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      quantity: qty,
      unitPrice,
    };
    setPurchasedItems((prev) => [...prev, item]);
    setNewItemName('');
    setNewItemQtyStr('1');
    setNewItemPriceStr('');
  };

  const handleRemovePurchasedItem = (itemId: string) => {
    setPurchasedItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleUpdatePurchasedItemQuantity = (itemId: string, delta: number) => {
    setPurchasedItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, quantity: Math.max(1, Number((it.quantity + delta).toFixed(2))) }
          : it
      )
    );
  };

  const itemizedSubtotalWithPrices = purchasedItems.reduce((acc, it) => {
    if (it.unitPrice != null && Number.isFinite(it.unitPrice) && it.unitPrice > 0) {
      return acc + it.unitPrice * (it.quantity || 1);
    }
    return acc;
  }, 0);

  const previewUsd =
    currency === 'USD'
      ? Number.isFinite(parsedAmount) && parsedAmount > 0
        ? parsedAmount
        : 0
      : calcularEquivalenteUsd(parsedAmount, 'VES', activeExchangeRate);

  const previewVesFromUsd =
    currency === 'USD' &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    validSelectedRate
      ? parsedAmount * validSelectedRate
      : 0;

  // Cálculos de comisión bancaria interbancaria en tiempo real
  const selectedWalletObj = wallets.find((w) => w.id === walletId);
  const parsedFeePct = Math.max(0, Number(feePercentStr.replace(',', '.')) || 0);

  const rawFeeAmount =
    type === 'expense' && isOtherBank && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? (parsedAmount * parsedFeePct) / 100
      : 0;

  let calculatedFeeAmount = rawFeeAmount;
  let isMinimumFeeApplied = false;

  // Reglas bancarias en Bolívares (VES):
  // - Pago móvil: SIEMPRE cobra comisión sin importar si es del mismo banco (0.30% con piso mínimo de 14 Bs).
  // - Transferencias a otros bancos: puede ser un % (ej. Todoticket) o un monto fijo en Bs (ej. 54 Bs).
  if (type === 'expense' && isOtherBank && Number.isFinite(parsedAmount) && parsedAmount > 0) {
    if (interbankType === 'pago_movil') {
      if (currency === 'VES' || selectedWalletObj?.currency === 'VES') {
        const pct = parsedFeePct > 0 ? parsedFeePct : 0.3;
        const pctFee = (parsedAmount * pct) / 100;
        if (pctFee < 14) {
          calculatedFeeAmount = 14;
          isMinimumFeeApplied = true;
        } else {
          calculatedFeeAmount = pctFee;
          isMinimumFeeApplied = false;
        }
      }
    } else if (interbankType === 'transferencia') {
      if (transferFeeMode === 'percent') {
        calculatedFeeAmount = (parsedAmount * parsedFeePct) / 100;
        isMinimumFeeApplied = false;
      } else {
        calculatedFeeAmount = parsedFeePct; // Monto fijo en Bs (ej. 54 Bs)
        isMinimumFeeApplied = true;
      }
    }
  }

  const totalDebitedFromWallet =
    Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount + calculatedFeeAmount : 0;

  const calculatedFeeUsd =
    currency === 'USD'
      ? calculatedFeeAmount
      : calcularEquivalenteUsd(calculatedFeeAmount, 'VES', activeExchangeRate);

  const totalDebitedUsd =
    currency === 'USD'
      ? totalDebitedFromWallet
      : calcularEquivalenteUsd(totalDebitedFromWallet, 'VES', activeExchangeRate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!description.trim()) {
      setErrorMsg('Por favor ingresa una descripción clara para el movimiento.');
      return;
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErrorMsg('Por favor selecciona una fecha válida.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Por favor selecciona una categoría.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('El importe debe ser un número positivo mayor que cero.');
      return;
    }

    let finalRate: number | null = null;
    let finalRateSource: ExchangeRateSource = 'none';

    if (currency === 'VES') {
      if (
        !activeExchangeRate ||
        !Number.isFinite(activeExchangeRate) ||
        activeExchangeRate <= 0
      ) {
        setErrorMsg(
          'Para registrar un movimiento en bolívares (VES) debes contar con una tasa de cambio válida mayor que cero.'
        );
        return;
      }
      finalRate = Number(activeExchangeRate.toFixed(2));
      finalRateSource = rateSource === 'bcv' ? 'bcv' : 'manual';
    }

    const amountUsd =
      currency === 'USD'
        ? parsedAmount
        : calcularEquivalenteUsd(parsedAmount, 'VES', finalRate);

    const nowIso = new Date().toISOString();

    // Si el usuario escribió un artículo en la cajita pero olvidó darle "+ Agregar", lo incluimos automáticamente
    let finalPurchasedItems = [...purchasedItems];
    if (type === 'expense' && isItemizedPurchase && newItemName.trim()) {
      const rawQty = Number(newItemQtyStr.replace(',', '.'));
      const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
      const rawPrice = newItemPriceStr.trim()
        ? Number(newItemPriceStr.replace(',', '.'))
        : NaN;
      finalPurchasedItems.push({
        id: `pitem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: newItemName.trim(),
        quantity: qty,
        unitPrice:
          Number.isFinite(rawPrice) && rawPrice >= 0
            ? Number(rawPrice.toFixed(2))
            : null,
      });
    }

    const cleanStoreName =
      type === 'expense' && isItemizedPurchase && storeName.trim()
        ? storeName.trim()
        : undefined;

    const newTxn: Transaction = {
      id: editingTransaction ? editingTransaction.id : `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date,
      type,
      status,
      walletId: walletId || undefined,
      description: description.trim(),
      categoryId,
      amount: parsedAmount,
      currency,
      exchangeRate: finalRate,
      amountUsd,
      exchangeRateSource: finalRateSource,
      source: type === 'income' ? source.trim() : undefined,
      paymentMethod:
        paymentMethod.trim() ||
        (selectedWalletObj ? selectedWalletObj.name : undefined),
      expenseType: type === 'expense' ? expenseType : undefined,
      isRecurring: type === 'expense' ? isRecurring : undefined,
      notes: notes.trim(),
      isDemo: editingTransaction?.isDemo ?? false,
      createdAt: editingTransaction?.createdAt || nowIso,
      processedAt:
        status === 'completed'
          ? editingTransaction?.status === 'completed' && editingTransaction?.processedAt
            ? editingTransaction.processedAt
            : nowIso
          : editingTransaction?.processedAt,
      isInterbankTransfer: type === 'expense' ? isOtherBank : false,
      interbankFeeType: type === 'expense' && isOtherBank ? interbankType : undefined,
      interbankFeeAmount:
        type === 'expense' && isOtherBank && calculatedFeeAmount > 0
          ? Number(calculatedFeeAmount.toFixed(4))
          : undefined,
      storeName: cleanStoreName,
      purchasedItems:
        type === 'expense' && isItemizedPurchase && finalPurchasedItems.length > 0
          ? finalPurchasedItems
          : undefined,
    };

    let feeTxn: Transaction | undefined = undefined;
    if (type === 'expense' && isOtherBank && calculatedFeeAmount > 0) {
      const bankFeesCatId = obtenerIdCategoriaComisionBancaria(categories);

      const feeTxnId = `txn_${Date.now()}_fee_${Math.random().toString(36).slice(2, 7)}`;
      newTxn.interbankFeeTxnId = feeTxnId;

      feeTxn = {
        id: feeTxnId,
        date,
        type: 'expense',
        status, // 'completed' afecta inmediatamente el saldo real de la wallet
        walletId: walletId || undefined,
        description: `Comisión bancaria (${interbankType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - ${description.trim()}`,
        categoryId: bankFeesCatId,
        amount: Number(calculatedFeeAmount.toFixed(4)),
        currency,
        exchangeRate: finalRate,
        amountUsd: calculatedFeeUsd,
        exchangeRateSource: finalRateSource,
        notes: isMinimumFeeApplied
          ? `Comisión bancaria de ${formatearMonto(calculatedFeeAmount, currency, locale)} por ${interbankType === 'pago_movil' ? 'Pago Móvil (piso mínimo 14 Bs)' : 'transferencia a otro banco (tarifa fija 54 Bs)'} aplicada al gasto "${description.trim()}".`
          : `Comisión de ${parsedFeePct}% por ${interbankType === 'pago_movil' ? 'Pago Móvil' : 'transferencia a otro banco'} aplicada al gasto "${description.trim()}".`,
        isDemo: editingTransaction?.isDemo ?? false,
        createdAt: nowIso,
        processedAt: status === 'completed' ? nowIso : undefined,
        parentTransactionId: newTxn.id,
      };
    }

    onSave(newTxn, feeTxn);
    onClose();
  };

  const filteredCategories = categories.filter(
    (c) => c.type === type && (c.active || c.id === categoryId)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera amigable con icono contextual */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                type === 'income'
                  ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                  : isItemizedPurchase
                    ? 'bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] border-[var(--pink-primary)]/30'
                    : 'bg-rose-500/15 text-rose-500 border-rose-500/30'
              }`}
            >
              {type === 'income' ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : isItemizedPurchase ? (
                <ShoppingBag className="w-5 h-5" />
              ) : (
                <ArrowDownRight className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">
                {editingTransaction
                  ? isItemizedPurchase
                    ? 'Editar compra detallada'
                    : 'Editar movimiento'
                  : type === 'income'
                    ? 'Nuevo ingreso'
                    : isItemizedPurchase
                      ? 'Compra detallada (Tipo Farmatodo)'
                      : 'Nuevo gasto o pago'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {type === 'income'
                  ? 'Registra una entrada de dinero en tus cuentas'
                  : isItemizedPurchase
                    ? 'Anota los artículos comprados y descuenta el monto total'
                    : 'Registra un pago o salida de dinero de forma rápida'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] rounded-xl transition-colors shrink-0"
            aria-label="Cerrar modal"
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

          {/* Barra superior compacta: Tipo (Ingreso / Gasto) y Estado (Completado / Pendiente) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            {!isItemizedPurchase ? (
              <div className="grid grid-cols-2 p-1 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    type === 'expense'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Gasto</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    type === 'income'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Ingreso</span>
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--pink-primary)]/10 border border-[var(--pink-primary)]/25 text-xs font-bold text-[var(--pink-primary)]">
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                <span>Modo compra detallada ({purchasedItems.length} art.)</span>
              </div>
            )}

            <div className="grid grid-cols-2 p-1 bg-[var(--surface-subtle)] rounded-xl border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => {
                  const todayIso = obtenerFechaLocalIso();
                  if (status === 'pending' && date > todayIso) {
                    if (!notes.includes('Vencimiento original')) {
                      setNotes((prev) =>
                        [prev.trim(), `(Vencimiento original: ${date})`]
                          .filter(Boolean)
                          .join(' · ')
                      );
                    }
                    setDate(todayIso);
                  }
                  setStatus('completed');
                }}
                className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  status === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Afecta tu Saldo Actual real inmediatamente"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Pagado hoy</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  status === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="No descuenta de tu Saldo Actual hasta que lo marques como completado"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Pendiente</span>
              </button>
            </div>
          </div>

          {/* 1. Selección de Fecha y Categoría (Antes del monto para ajustar tasa del día automáticamente) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Fecha del movimiento *</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => applyRateForSelectedDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
              {dateRateHint && (
                <p className="mt-1 text-[10px] font-semibold text-emerald-500">
                  ✓ {dateRateHint}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Tag className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Categoría *</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              >
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Cuenta / Billetera y Clasificación / Origen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <Wallet className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>
                  {type === 'income' ? 'Cuenta donde ingresa *' : 'Cuenta de pago *'}
                </span>
              </label>
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              >
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency})
                  </option>
                ))}
                <option value="">General (Sin billetera)</option>
              </select>
            </div>

            {type === 'income' ? (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  Origen / Fuente (opcional)
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ej. Cliente, Trabajo, Negocio..."
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  Clasificación del gasto
                </label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value as ExpenseKind)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                >
                  <option value="variable">Variable (consumo del día a día)</option>
                  <option value="fixed">Fijo (compromiso mensual)</option>
                </select>
              </div>
            )}
          </div>

          {/* 3. Concepto / Descripción */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>
                {type === 'income'
                  ? '¿De qué es este ingreso? *'
                  : isItemizedPurchase
                    ? 'Título de la compra *'
                    : '¿En qué gastaste o qué pagaste? *'}
              </span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'income'
                  ? 'Ej. Pago de cliente, Quincena, Venta...'
                  : isItemizedPurchase
                    ? 'Ej. Compra en Farmatodo, Compra en Locatel...'
                    : 'Ej. Almuerzo, Supermercado, Uber, Internet...'
              }
              required
              className="w-full px-3.5 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          {/* SOLO SE MUESTRA SI EL USUARIO ENTRÓ AL MODO COMPRA DETALLADA (TIPO FARMATODO) */}
          {type === 'expense' && isItemizedPurchase && (
            <div className="p-4 rounded-2xl border-2 bg-[var(--surface-subtle)] border-[var(--pink-primary)] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                  <ShoppingBag className="w-4 h-4 text-[var(--pink-primary)] shrink-0" />
                  <span>🛍️ Desglose de Artículos (Tipo Farmatodo)</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[var(--pink-primary)] text-white">
                  {purchasedItems.length} artículo(s)
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Anota los productos que compraste y luego indica abajo el <strong>Importe Total</strong> pagado:
                </p>

                {/* Selector rápido de comercio (Farmatodo, Locatel, etc.) */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <label className="text-[11px] font-semibold text-[var(--text-primary)]">
                      Comercio o tienda:
                    </label>
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        'Farmatodo',
                        'Locatel',
                        'Supermercado',
                        'Bodegón',
                        'Farmacia',
                        'Tienda',
                      ].map((presetStore) => (
                        <button
                          key={presetStore}
                          type="button"
                          onClick={() => {
                            setStoreName(presetStore);
                            if (
                              !description.trim() ||
                              description.startsWith('Compra en ')
                            ) {
                              setDescription(`Compra en ${presetStore}`);
                            }
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors ${
                            storeName.toLowerCase() ===
                            presetStore.toLowerCase()
                              ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                              : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {presetStore}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ej. Farmatodo, Locatel, Automercado..."
                    className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                  />
                </div>

                {/* Formulario rápido para añadir cada cosa comprada */}
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-input)] space-y-2">
                  <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                    Agregar artículo a la bolsa:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPurchasedItem();
                          }
                        }}
                        placeholder="Ej. Shampoo, Protector solar..."
                        className="w-full px-3 py-1.5 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg focus:outline-none focus:border-[var(--pink-primary)]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={newItemQtyStr}
                        onChange={(e) => setNewItemQtyStr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPurchasedItem();
                          }
                        }}
                        placeholder="Cant."
                        title="Cantidad"
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular text-center bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg focus:outline-none focus:border-[var(--pink-primary)]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newItemPriceStr}
                        onChange={(e) => setNewItemPriceStr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPurchasedItem();
                          }
                        }}
                        placeholder={`Precio (${currency === 'VES' ? 'Bs' : '$'})`}
                        title="Precio unitario referencial (opcional)"
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg focus:outline-none focus:border-[var(--pink-primary)]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddPurchasedItem}
                        className="w-full py-1.5 px-2.5 text-xs font-bold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Agregar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de cosas compradas agregadas */}
                {purchasedItems.length > 0 ? (
                  <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] overflow-hidden">
                    <div className="px-3 py-2 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-[var(--text-primary)]">
                        🧾 Artículos ({purchasedItems.length}):
                      </span>
                      {itemizedSubtotalWithPrices > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-[var(--text-secondary)]">
                            Suma:{' '}
                            <strong className="text-[var(--text-primary)]">
                              {formatearMonto(
                                itemizedSubtotalWithPrices,
                                currency,
                                locale
                              )}
                            </strong>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setAmountStr(
                                String(
                                  Number(
                                    itemizedSubtotalWithPrices.toFixed(2)
                                  )
                                )
                              )
                            }
                            className="px-2 py-0.5 rounded bg-[var(--pink-light)] text-[var(--pink-primary)] font-bold hover:underline"
                          >
                            Usar como Total
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="divide-y divide-[var(--border-divider)] max-h-44 overflow-y-auto">
                      {purchasedItems.map((it, idx) => (
                        <div
                          key={it.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-[var(--surface-subtle)]/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[var(--pink-light)] text-[var(--pink-primary)] font-mono-tabular text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-[var(--text-primary)] truncate">
                              {it.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdatePurchasedItemQuantity(it.id, -1)
                                }
                                className="px-1.5 py-0.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              >
                                -
                              </button>
                              <span className="px-1.5 text-[11px] font-mono-tabular font-bold text-[var(--text-primary)]">
                                x{it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdatePurchasedItemQuantity(it.id, 1)
                                }
                                className="px-1.5 py-0.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              >
                                +
                              </button>
                            </div>

                            {it.unitPrice != null && it.unitPrice > 0 && (
                              <span className="font-mono-tabular text-[11px] font-semibold text-[var(--text-secondary)]">
                                {formatearMonto(
                                  it.unitPrice * it.quantity,
                                  currency,
                                  locale
                                )}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemovePurchasedItem(it.id)}
                              className="p-1 text-[var(--text-secondary)] hover:text-[var(--expense-color)] rounded"
                              title="Quitar artículo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2.5 px-3 rounded-xl bg-[var(--surface)]/70 border border-dashed border-[var(--border-input)] text-[11px] text-[var(--text-secondary)]">
                    Escribe arriba cada producto que compraste y presiona Enter o «+ Agregar».
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Tarjeta Principal de Monto, Moneda y Conversión en Tiempo Real */}
          <div
            className={`p-4 rounded-2xl border transition-colors space-y-3 ${
              type === 'income'
                ? 'bg-emerald-500/[0.04] border-emerald-500/25'
                : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {type === 'income'
                  ? 'Monto a recibir *'
                  : isItemizedPurchase
                    ? 'Importe total de la factura *'
                    : 'Monto del pago *'}
              </label>

              {/* Selector compacto USD / Bs */}
              <div className="inline-flex p-0.5 bg-[var(--surface)] border border-[var(--border-input)] rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    currency === 'USD'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  USD ($)
                </button>
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
              </div>
            </div>

            {/* Input grande y amigable para el monto */}
            <div className="relative flex items-center">
              <span
                className={`absolute left-3.5 text-xl sm:text-2xl font-bold font-mono-tabular select-none ${
                  type === 'income' ? 'text-emerald-500' : 'text-[var(--text-secondary)]'
                }`}
              >
                {currency === 'USD' ? '$' : 'Bs'}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-12 pr-4 py-3 text-xl sm:text-2xl font-bold font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-2xl focus:outline-none focus:border-[var(--pink-primary)] transition-colors"
              />
            </div>

            {currency === 'VES' && (
              <UsdToVesHelper
                officialRate={lockedOfficialRate || officialRate}
                defaultManualRate={defaultManualRate}
                currentRate={validSelectedRate}
                rateSource={rateSource === 'manual' ? 'manual' : 'bcv'}
                locale={locale}
                onApplyVesAmount={(vesStr, usedRate, src) => {
                  setAmountStr(vesStr);
                  setRateSource(src);
                  if (src === 'manual') {
                    setManualRateStr(String(usedRate));
                  }
                }}
              />
            )}

            {/* Barra de Tasa y Equivalente en vivo */}
            <div className="pt-2.5 border-t border-[var(--border-hairline)] flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span>Tasa ({date}):</span>
                  <div className="inline-flex items-center gap-1 bg-[var(--surface)] p-0.5 rounded-lg border border-[var(--border-input)]">
                    <button
                      type="button"
                      onClick={() => setRateSource('bcv')}
                      disabled={!lockedOfficialRate}
                      className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                        rateSource === 'bcv'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'text-[var(--text-secondary)] disabled:opacity-40'
                      }`}
                    >
                      BCV ({formatearTasa(lockedOfficialRate, locale)})
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
                    {currency === 'VES' ? 'Equivale a:' : 'En Bs:'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] bg-[var(--surface)] px-2.5 py-0.5 rounded-lg border border-[var(--border-hairline)]">
                    {currency === 'VES'
                      ? formatearMonto(previewUsd, 'USD', locale)
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
                    className="w-full px-2.5 py-1 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg focus:outline-none focus:border-[var(--pink-primary)]"
                  />
                </div>
              )}

              {rateSource === 'bcv' &&
                officialRate &&
                lockedOfficialRate &&
                officialRate !== lockedOfficialRate && (
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>
                      Tasa aplicada: {formatearTasa(lockedOfficialRate, locale)} Bs
                    </span>
                    <button
                      type="button"
                      onClick={() => setLockedOfficialRate(officialRate)}
                      className="text-[var(--pink-primary)] font-semibold hover:underline"
                    >
                      Usar tasa BCV de hoy ({formatearTasa(officialRate, locale)})
                    </button>
                  </div>
                )}
            </div>
          </div>

          {/* Comisión Bancaria Rápida (Solo para gastos: selector limpio de 3 botones) */}
          {type === 'expense' && (
            <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                  <Landmark className="w-3.5 h-3.5 text-[var(--pink-primary)] shrink-0" />
                  <span>¿Aplica comisión bancaria?</span>
                </span>
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-[var(--surface)] rounded-xl border border-[var(--border-input)]">
                  <button
                    type="button"
                    onClick={() => setIsOtherBank(false)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      !isOtherBank
                        ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] shadow-xs font-bold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Sin comisión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtherBank(true);
                      setInterbankType('pago_movil');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      isOtherBank && interbankType === 'pago_movil'
                        ? 'bg-[var(--pink-primary)] text-white shadow-xs font-bold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    📲 Pago Móvil
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtherBank(true);
                      setInterbankType('transferencia');
                    }}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
                      isOtherBank && interbankType === 'transferencia'
                        ? 'bg-[var(--pink-primary)] text-white shadow-xs font-bold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    🏦 Transferencia
                  </button>
                </div>
              </div>

              {isOtherBank && (
                <div className="space-y-2.5 pt-2.5 border-t border-[var(--border-hairline)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                    <div className="text-xs bg-[var(--surface)] px-3 py-2 rounded-xl border border-[var(--border-hairline)]">
                      <span className="block text-[10px] uppercase font-bold text-[var(--text-secondary)]">
                        Cuenta origen
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] truncate block">
                        {selectedWalletObj?.banco || selectedWalletObj?.name || 'Billetera seleccionada'}
                      </span>
                    </div>

                    {interbankType === 'pago_movil' ? (
                      <div>
                        <label className="block text-[10px] font-medium text-[var(--text-secondary)] mb-1">
                          % Comisión Pago Móvil (Mín. 14 Bs)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={feePercentStr}
                            onChange={(e) => setFeePercentStr(e.target.value)}
                            className="w-full px-3 py-1.5 pr-8 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                            placeholder="0.3"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">
                            %
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-medium text-[var(--text-secondary)]">
                            Comisión transferencia
                          </label>
                          <div className="inline-flex rounded-md bg-[var(--surface)] p-0.5 border border-[var(--border-input)] text-[10px]">
                            <button
                              type="button"
                              onClick={() => {
                                setTransferFeeMode('percent');
                                if (Number(feePercentStr) >= 10) setFeePercentStr('1.5');
                              }}
                              className={`px-1.5 py-0.5 rounded font-semibold ${
                                transferFeeMode === 'percent'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTransferFeeMode('fixed_ves');
                                if (Number(feePercentStr) < 5) setFeePercentStr('54');
                              }}
                              className={`px-1.5 py-0.5 rounded font-semibold ${
                                transferFeeMode === 'fixed_ves'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              Bs Fijos
                            </button>
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={feePercentStr}
                            onChange={(e) => setFeePercentStr(e.target.value)}
                            className="w-full px-3 py-1.5 pr-9 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                            placeholder={transferFeeMode === 'percent' ? 'Ej. 1.5' : '54'}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">
                            {transferFeeMode === 'percent' ? '%' : 'Bs'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumen compacto de comisión */}
                  <div className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-rose-500 font-medium flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5" />
                      Comisión: +{formatearMonto(calculatedFeeAmount, currency, locale)}
                      {isMinimumFeeApplied && interbankType === 'pago_movil' && (
                        <span className="text-[10px] text-amber-500">(Piso 14 Bs)</span>
                      )}
                    </span>
                    <span className="font-mono-tabular font-bold text-[var(--text-primary)]">
                      Total a descontar:{' '}
                      <strong className="text-[var(--pink-primary)]">
                        {formatearMonto(totalDebitedFromWallet, currency, locale)}
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detalles adicionales compactos (Método, Notas y Recurrente) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                {type === 'income' ? 'Método de recepción (opcional)' : 'Método de pago (opcional)'}
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder={
                  type === 'income'
                    ? 'Ej. Zelle, Pago Móvil, Efectivo...'
                    : 'Ej. Punto de venta, Pago Móvil, Zelle...'
                }
                className="w-full px-3 py-2 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
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
                className="w-full px-3 py-2 text-xs sm:text-sm bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>
          </div>

          {type === 'expense' && (
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-[var(--border-input)] text-[var(--pink-primary)] focus:ring-[var(--pink-primary)]"
              />
              <Repeat className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>Marcar como gasto mensual recurrente</span>
            </label>
          )}

          {/* Botones de acción */}
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
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 ${
                type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {editingTransaction
                  ? 'Guardar cambios'
                  : type === 'income'
                    ? 'Registrar ingreso'
                    : isItemizedPurchase
                      ? 'Guardar compra detallada'
                      : 'Registrar gasto'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
