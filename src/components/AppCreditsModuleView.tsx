import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppCredit,
  AppCreditInstallment,
  AppDataSchema,
  CurrencyCode,
} from '../types/finance';
import {
  CreateAppCreditInput,
  DisburseAppCreditInput,
  PayAppCreditInstallmentInput,
  abonarDesembolsoCreditoAppEnAppData,
  actualizarMontoCuotaCreditoAppEnAppData,
  calcularResumenCreditosApp,
  crearCreditoApp,
  eliminarAbonoCuotaCreditoAppEnAppData,
  eliminarCreditoAppEnAppData,
  generarCronogramaCreditoApp,
  obtenerEstadoAbonosCuotaCreditoApp,
  registrarPagoCuotaCreditoAppEnAppData,
  revertirPagoCuotaCreditoAppEnAppData,
} from '../utils/appCreditsController';
import { calcularResumenBilleteras, obtenerFechaLocalIso } from '../utils/calculations';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { obtenerTasaPorFecha } from '../utils/historicalRatesImporter';
import { PushModuleInlineBar } from './PushNotificationCenter';

interface AppCreditsModuleViewProps {
  data: AppDataSchema;
  activeRate: number | null;
  onUpdateData: (updater: (prev: AppDataSchema) => AppDataSchema) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenPushCenter?: () => void;
  autoOpenTrigger?: number;
}

const POPULAR_APPS = [
  { name: 'Ubii App', defaultDays: 14, defaultInstallments: 4 },
  { name: 'Avila Pay', defaultDays: 15, defaultInstallments: 4 },
  { name: 'Krece', defaultDays: 14, defaultInstallments: 6 },
  { name: 'Wepa', defaultDays: 15, defaultInstallments: 4 },
];

function formatDateShort(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export const AppCreditsModuleView: React.FC<AppCreditsModuleViewProps> = ({
  data,
  activeRate,
  onUpdateData,
  showToast,
  onOpenPushCenter,
  autoOpenTrigger,
}) => {
  const todayStr = obtenerFechaLocalIso();
  const locale = data.settings.numberFormatLocale || 'es-VE';

  // Estado del formulario de creación de Crédito de App
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (autoOpenTrigger && autoOpenTrigger > 0) {
      setShowCreateForm(true);
    }
  }, [autoOpenTrigger]);
  const [appName, setAppName] = useState('Ubii App');
  const [concept, setConcept] = useState('');
  const [categoryId, setCategoryId] = useState('cat_exp_other');
  const [requestDate, setRequestDate] = useState(todayStr);
  const [requestedAmountInput, setRequestedAmountInput] = useState('100');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [exchangeRateInput, setExchangeRateInput] = useState(
    activeRate && activeRate > 0 ? String(activeRate) : '450'
  );
  const [requestDateRateHint, setRequestDateRateHint] = useState<string | null>(null);
  const [installmentsCount, setInstallmentsCount] = useState(4);
  const [frequencyDays, setFrequencyDays] = useState(15);
  const [feePerInstallmentInput, setFeePerInstallmentInput] = useState('2');
  const [alreadyPaidNumbers, setAlreadyPaidNumbers] = useState<number[]>([]);
  const [customInstallmentInputs, setCustomInstallmentInputs] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');

  // Desembolso del préstamo en cuenta/billetera (personal o cuenta de terceros / dinero de paso)
  const personalWallets = useMemo(
    () =>
      (data.wallets ?? []).filter(
        (w) =>
          w.active !== false &&
          !w.isThirdPartyExpenseAccount &&
          !w.isPassThroughAccount
      ),
    [data.wallets]
  );
  const passThroughWallets = useMemo(
    () =>
      (data.wallets ?? []).filter(
        (w) => w.active !== false && Boolean(w.isPassThroughAccount)
      ),
    [data.wallets]
  );
  const activeWallets = useMemo(
    () =>
      (data.wallets ?? []).filter(
        (w) => w.active !== false && !w.isThirdPartyExpenseAccount
      ),
    [data.wallets]
  );
  const defaultVesWallet = useMemo(
    () =>
      personalWallets.find((w) => w.currency === 'VES') ||
      personalWallets[0] ||
      activeWallets[0] ||
      null,
    [personalWallets, activeWallets]
  );

  const [depositDestinationMode, setDepositDestinationMode] = useState<
    'personal_wallet' | 'third_party_direct' | 'none'
  >('personal_wallet');
  const [depositToWallet, setDepositToWallet] = useState<boolean>(true);
  const [depositWalletId, setDepositWalletId] = useState<string>(
    () => defaultVesWallet?.id || ''
  );
  const [thirdPartyWalletId, setThirdPartyWalletId] = useState<string>(
    () => passThroughWallets[0]?.id || ''
  );
  const [thirdPartyRecipientName, setThirdPartyRecipientName] =
    useState<string>('');
  const [createReceivableLoanForFriend, setCreateReceivableLoanForFriend] =
    useState<boolean>(true);
  const [loanAmountMode, setLoanAmountMode] = useState<
    'principal_only' | 'total_with_fees'
  >('total_with_fees');
  const [depositCurrency, setDepositCurrency] = useState<CurrencyCode>(
    () => defaultVesWallet?.currency || 'VES'
  );
  const [depositRateInput, setDepositRateInput] = useState<string>(() =>
    activeRate && activeRate > 0 ? String(activeRate) : '450'
  );
  const [depositBankFeePctInput, setDepositBankFeePctInput] = useState<string>('0.5');
  const [depositNetManualInput, setDepositNetManualInput] = useState<string>('');

  useEffect(() => {
    if (activeRate && activeRate > 0) {
      setDepositRateInput(String(activeRate));
    }
  }, [activeRate]);

  const handleQuickCreatePassThroughWallet = () => {
    const cleanFriend = thirdPartyRecipientName.trim() || 'Terceros / Amigos';
    const newId = `wallet_pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newWallet = {
      id: newId,
      name: `Cuenta de Terceros (${cleanFriend})`,
      type: 'other' as const,
      currency: 'VES' as CurrencyCode,
      initialBalanceUsd: 0,
      initialBalanceVes: 0,
      color: '#7C5CFC',
      active: true,
      isPassThroughAccount: true,
      hidePassThroughHistory: false,
      beneficiaryName: cleanFriend,
      notes:
        'Cuenta puente / dinero de terceros que no pasa por mis cuentas personales ni suma ingresos.',
    };
    onUpdateData((prev) => ({
      ...prev,
      wallets: [...(prev.wallets ?? []), newWallet],
    }));
    setThirdPartyWalletId(newId);
    showToast(
      `Cuenta de terceros "${newWallet.name}" creada en Bolívares (no suma a tus ingresos ni a tu saldo disponible).`,
      'success'
    );
  };

  // Filtro de estado
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paid'>('all');

  // Control de listas desplegables abiertas por tarjeta (por defecto abrimos los créditos activos)
  const [expandedCreditIds, setExpandedCreditIds] = useState<Record<string, boolean>>({});

  // Modal de confirmación de pago o abono de cuota
  const [payingTarget, setPayingTarget] = useState<{
    credit: AppCredit;
    installment: AppCreditInstallment;
    initialMode?: 'full' | 'partial';
  } | null>(null);

  // Modal para abonar/pasar el dinero prestado a una cuenta en créditos ya creados
  const [disbursingCredit, setDisbursingCredit] = useState<AppCredit | null>(null);

  // Modal de confirmación de eliminación
  const [deletingCredit, setDeletingCredit] = useState<AppCredit | null>(null);

  // Estado para edición en línea del monto/fecha de una cuota existente
  const [editingInstallment, setEditingInstallment] = useState<{
    creditId: string;
    installmentId: string;
    amountInput: string;
    dueDateInput: string;
  } | null>(null);

  const appCredits = data.appCredits ?? [];

  const summary = useMemo(
    () => calcularResumenCreditosApp(appCredits),
    [appCredits]
  );

  const walletSummaries = useMemo(
    () => calcularResumenBilleteras(data),
    [data]
  );

  const expenseCategories = useMemo(
    () => data.categories.filter((c) => c.type === 'expense' && c.active !== false),
    [data.categories]
  );

  const parsedCustomInstallmentAmounts = useMemo(() => {
    const map: Record<number, number> = {};
    for (const [k, rawVal] of Object.entries(customInstallmentInputs)) {
      const numKey = Number(k);
      const val = Number(rawVal);
      if (numKey >= 1 && rawVal.trim() !== '' && Number.isFinite(val) && val > 0) {
        map[numKey] = val;
      }
    }
    return map;
  }, [customInstallmentInputs]);

  // Vista previa en tiempo real del Motor de Generación de Cuotas
  const livePreviewInstallments = useMemo(() => {
    const reqAmt = Number(requestedAmountInput) || 0;
    const feeAmt = Math.max(0, Number(feePerInstallmentInput) || 0);
    const rate =
      currency === 'VES'
        ? Number(exchangeRateInput) > 0
          ? Number(exchangeRateInput)
          : activeRate || 1
        : null;

    if (reqAmt <= 0 || installmentsCount < 1 || frequencyDays < 1) return [];

    return generarCronogramaCreditoApp({
      requestedAmount: reqAmt,
      currency,
      exchangeRate: rate,
      installmentsCount,
      frequencyDays,
      feePerInstallment: feeAmt,
      requestDate: requestDate || todayStr,
      alreadyPaidInstallmentNumbers: alreadyPaidNumbers,
      customInstallmentAmounts: parsedCustomInstallmentAmounts,
      idPrefix: 'preview',
    });
  }, [
    requestedAmountInput,
    feePerInstallmentInput,
    currency,
    exchangeRateInput,
    activeRate,
    installmentsCount,
    frequencyDays,
    requestDate,
    alreadyPaidNumbers,
    parsedCustomInstallmentAmounts,
    todayStr,
  ]);

  const toggleExpandCredit = (creditId: string) => {
    setExpandedCreditIds((prev) => ({
      ...prev,
      [creditId]: !(prev[creditId] ?? true),
    }));
  };

  const toggleAlreadyPaidNumber = (num: number) => {
    setAlreadyPaidNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const handleCreateCredit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const requestedAmount = Number(requestedAmountInput);
      const feePerInstallment = Math.max(0, Number(feePerInstallmentInput) || 0);
      const exchangeRate =
        currency === 'VES'
          ? Number(exchangeRateInput) > 0
            ? Number(exchangeRateInput)
            : activeRate
          : null;

      if (!appName.trim()) {
        showToast('Ingresa el nombre de la aplicación (ej. Ubii App, Avila Pay).', 'error');
        return;
      }

      const isPersonalDeposit = depositDestinationMode === 'personal_wallet';
      const isThirdPartyDirect = depositDestinationMode === 'third_party_direct';

      const selectedDepositWallet = isPersonalDeposit
        ? personalWallets.find((w) => w.id === depositWalletId) ||
          activeWallets.find((w) => w.id === depositWalletId)
        : isThirdPartyDirect && thirdPartyWalletId
          ? (data.wallets ?? []).find((w) => w.id === thirdPartyWalletId)
          : undefined;

      const effectiveDepositRate =
        Number(depositRateInput) > 0
          ? Number(depositRateInput)
          : activeRate && activeRate > 0
            ? activeRate
            : exchangeRate;

      if (isPersonalDeposit && !selectedDepositWallet) {
        showToast(
          'Selecciona tu cuenta o billetera personal donde recibes el dinero prestado.',
          'error'
        );
        return;
      }

      if (
        isThirdPartyDirect &&
        !thirdPartyRecipientName.trim() &&
        !selectedDepositWallet
      ) {
        showToast(
          'Escribe el nombre del amigo/tercero o selecciona una Cuenta de Terceros.',
          'error'
        );
        return;
      }

      const parsedBankFeePct = Math.max(0, Number(depositBankFeePctInput) || 0);
      const parsedNetManual =
        depositNetManualInput.trim() !== '' && Number(depositNetManualInput) > 0
          ? Number(depositNetManualInput)
          : null;

      const effectiveRecipientName =
        thirdPartyRecipientName.trim() ||
        selectedDepositWallet?.beneficiaryName ||
        selectedDepositWallet?.name ||
        'Amigo / Tercero';

      const input: CreateAppCreditInput = {
        appName: appName.trim(),
        concept:
          concept.trim() ||
          (isThirdPartyDirect ? `Préstamo para ${effectiveRecipientName}` : ''),
        categoryId,
        requestDate: requestDate || todayStr,
        requestedAmount,
        currency,
        exchangeRate,
        installmentsCount,
        frequencyDays,
        feePerInstallment,
        alreadyPaidInstallmentNumbers: alreadyPaidNumbers,
        customInstallmentAmounts:
          Object.keys(parsedCustomInstallmentAmounts).length > 0
            ? parsedCustomInstallmentAmounts
            : undefined,
        depositDestinationMode,
        depositToWallet: isPersonalDeposit,
        depositWalletId:
          isPersonalDeposit || isThirdPartyDirect
            ? selectedDepositWallet?.id || null
            : null,
        depositWalletName: selectedDepositWallet?.name,
        depositWalletIsPassThrough: isThirdPartyDirect,
        thirdPartyRecipientName: isThirdPartyDirect
          ? effectiveRecipientName
          : null,
        createReceivableLoanForFriend:
          isThirdPartyDirect && createReceivableLoanForFriend,
        loanAmountMode,
        depositCurrency:
          isPersonalDeposit || isThirdPartyDirect
            ? selectedDepositWallet?.currency || depositCurrency
            : undefined,
        depositExchangeRate:
          isPersonalDeposit || isThirdPartyDirect ? effectiveDepositRate : null,
        depositBankFeePercent:
          isPersonalDeposit || isThirdPartyDirect ? parsedBankFeePct : null,
        depositNetAmountManual:
          isPersonalDeposit || isThirdPartyDirect ? parsedNetManual : null,
        notes,
      };

      const { appCredit, newTransactions, newLoan } = crearCreditoApp(input);

      onUpdateData((prev) => ({
        ...prev,
        appCredits: [appCredit, ...(prev.appCredits ?? [])],
        transactions: [...newTransactions, ...prev.transactions],
        debts: newLoan ? [newLoan, ...(prev.debts ?? [])] : prev.debts,
      }));

      setExpandedCreditIds((prev) => ({ ...prev, [appCredit.id]: true }));
      setShowCreateForm(false);
      setConcept('');
      setAlreadyPaidNumbers([]);
      setCustomInstallmentInputs({});
      setDepositNetManualInput('');
      setThirdPartyRecipientName('');
      setNotes('');

      if (isThirdPartyDirect) {
        showToast(
          newLoan
            ? `Crédito de ${appCredit.appName} registrado directo a ${effectiveRecipientName} (sin sumar ingreso a tus cuentas) + cuenta por cobrar creada en Préstamos.`
            : `Crédito de ${appCredit.appName} registrado directo a ${effectiveRecipientName}. No suma ingreso ni altera tus cuentas personales.`,
          'success'
        );
      } else if (appCredit.depositToWallet && appCredit.depositAmountNominal) {
        const formattedDebo = formatearMonto(
          appCredit.depositAmountNominal,
          appCredit.depositCurrency || 'VES',
          locale
        );
        showToast(
          `Crédito de ${appCredit.appName} registrado y ${formattedDebo} abonados en ${selectedDepositWallet?.name || 'tu cuenta'}.`,
          'success'
        );
      } else {
        showToast(
          `Crédito de ${appCredit.appName} registrado con ${appCredit.installmentsCount} cuotas cada ${appCredit.frequencyDays} días.`,
          'success'
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al generar el crédito de app.',
        'error'
      );
    }
  };

  const handleConfirmDisburseCredit = (input: DisburseAppCreditInput) => {
    try {
      const targetWallet = data.wallets.find((w) => w.id === input.walletId);
      onUpdateData((prev) => abonarDesembolsoCreditoAppEnAppData(prev, input));
      setDisbursingCredit(null);
      if (input.depositDestinationMode === 'third_party_direct') {
        showToast(
          `Marcado como pasado directo a ${input.thirdPartyRecipientName || targetWallet?.name || 'Cuenta de Tercero'} (no suma ingreso a tus cuentas personales).`,
          'success'
        );
      } else if (input.depositDestinationMode === 'none') {
        showToast(
          'Desembolso desvinculado de tus cuentas personales (no suma ingreso).',
          'info'
        );
      } else {
        showToast(
          `El dinero prestado fue convertido a tasa BCV y abonado en ${
            targetWallet?.name || 'tu cuenta'
          }.`,
          'success'
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el destino del préstamo.',
        'error'
      );
    }
  };

  const handleConfirmPayInstallment = (input: PayAppCreditInstallmentInput) => {
    try {
      onUpdateData((prev) => registrarPagoCuotaCreditoAppEnAppData(prev, input));
      setPayingTarget(null);
      if (input.paidByThirdPartyDirect) {
        const payer = input.thirdPartyPayerName?.trim() || 'Amigo / Tercero';
        showToast(
          input.isPartialPayment
            ? `Abono directo de ${payer} registrado (sin descontar de tus cuentas).`
            : `Cuota pagada directo a la App por ${payer} (sin descontar de tus cuentas).`,
          'success'
        );
      } else if (input.isPartialPayment) {
        showToast(
          input.alreadyPaidExternally
            ? 'Abono registrado como pagado anteriormente (sin descontar de tus billeteras).'
            : 'Abono a la cuota registrado y descontado de tu Saldo Real.',
          'success'
        );
      } else {
        showToast(
          input.alreadyPaidExternally
            ? 'Cuota marcada como pagada anteriormente (sin descontar de tus billeteras).'
            : 'Pago de cuota confirmado y descontado de tu Saldo Real.',
          'success'
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'No se pudo registrar el pago o abono de la cuota.',
        'error'
      );
    }
  };

  const handleDeletePartialPayment = (
    creditId: string,
    installmentId: string,
    partialId: string,
    instNumber: number
  ) => {
    onUpdateData((prev) =>
      eliminarAbonoCuotaCreditoAppEnAppData(prev, creditId, installmentId, partialId)
    );
    showToast(`Abono eliminado de la Cuota #${instNumber}.`, 'info');
  };

  const handleRevertInstallment = (creditId: string, installmentId: string, num: number) => {
    onUpdateData((prev) =>
      revertirPagoCuotaCreditoAppEnAppData(prev, creditId, installmentId)
    );
    showToast(`Cuota #${num} revertida a estado pendiente.`, 'info');
  };

  const handleSaveEditedInstallment = (credit: AppCredit, inst: AppCreditInstallment) => {
    if (!editingInstallment) return;
    try {
      const parsedAmt = Number(editingInstallment.amountInput);
      if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
        showToast('Ingresa un monto válido mayor que cero para la cuota.', 'error');
        return;
      }
      onUpdateData((prev) =>
        actualizarMontoCuotaCreditoAppEnAppData(prev, {
          appCreditId: credit.id,
          installmentId: inst.id,
          newTotalAmount: parsedAmt,
          newDueDate: editingInstallment.dueDateInput || inst.dueDate,
        })
      );
      setEditingInstallment(null);
      const sym = credit.currency === 'VES' ? 'Bs. ' : '$';
      showToast(
        `Cuota #${inst.number} actualizada a ${sym}${parsedAmt.toFixed(2)}.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'No se pudo actualizar el monto de la cuota.',
        'error'
      );
    }
  };

  const handleDeleteCredit = (credit: AppCredit, deletePaidMovements: boolean) => {
    onUpdateData((prev) =>
      eliminarCreditoAppEnAppData(prev, credit.id, deletePaidMovements)
    );
    setDeletingCredit(null);
    showToast(`Crédito de ${credit.appName} eliminado.`, 'info');
  };

  const filteredCredits = useMemo(() => {
    return appCredits.filter((c) => {
      if (statusFilter === 'active') return c.status === 'active';
      if (statusFilter === 'paid') return c.status === 'paid';
      return true;
    });
  }, [appCredits, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Encabezado del módulo */}
      <div className="rounded-3xl bg-gradient-to-r from-[#2D1E3E] via-[#4A2545] to-[#7A3B5E] p-6 text-white shadow-md">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-rose-100">
              <Smartphone className="h-3.5 w-3.5" />
              Microcréditos y Financiamiento por Apps
            </span>
            <h2 className="mt-2 font-editorial text-2xl font-bold sm:text-3xl">
              Créditos de Apps (Ubii App / Avila Pay)
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-rose-100/90">
              Autogenera tu cronograma de cuotas sumando días exactos (cada 14 o 15 días) con
              desglose de <strong>Capital + Comisión por Cuota</strong>. Las cuotas pendientes
              restan liquidez de tu <strong>Saldo Proyectado</strong> y solo afectan tu{' '}
              <strong>Saldo Real</strong> cuando confirmas el pago.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#4A2545] shadow-sm transition hover:bg-rose-50"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Cerrar Formulario' : 'Nuevo Crédito de App'}
          </button>
        </div>

        {/* Tarjetas de resumen ejecutivo */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
            <span className="text-xs font-medium text-rose-100/80">
              Pasivo Pendiente (Saldo Proyectado)
            </span>
            <p className="mt-1 font-mono-tabular text-2xl font-bold text-white">
              {formatearMonto(summary.totalDebtPendingUsd, 'USD', locale)}
            </p>
            <p className="mt-0.5 text-[11px] text-rose-100/80">
              Capital: {formatearMonto(summary.totalPrincipalPendingUsd, 'USD', locale)} + Comisiones:{' '}
              {formatearMonto(summary.totalFeesPendingUsd, 'USD', locale)}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
            <span className="text-xs font-medium text-rose-100/80">Créditos Activos</span>
            <p className="mt-1 font-mono-tabular text-2xl font-bold text-white">
              {summary.activeCreditsCount}
            </p>
            <p className="mt-0.5 text-[11px] text-rose-100/80">
              {summary.pendingInstallmentsCount} cuota(s) por vencer
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
            <span className="text-xs font-medium text-rose-100/80">Total Pagado a la Fecha</span>
            <p className="mt-1 font-mono-tabular text-2xl font-bold text-emerald-200">
              {formatearMonto(summary.totalPaidUsd, 'USD', locale)}
            </p>
            <p className="mt-0.5 text-[11px] text-rose-100/80">
              {summary.completedCreditsCount} crédito(s) solventes
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
            <span className="text-xs font-medium text-rose-100/80">Próximo Vencimiento</span>
            {summary.nextUpcomingInstallment ? (
              <>
                <p className="mt-1 font-editorial text-lg font-bold text-amber-200 truncate">
                  {summary.nextUpcomingInstallment.credit.appName} · Cuota #
                  {summary.nextUpcomingInstallment.installment.number}
                </p>
                <p className="mt-0.5 text-[11px] text-rose-100/90">
                  {formatDateShort(summary.nextUpcomingInstallment.installment.dueDate)} ·{' '}
                  {formatearMonto(
                    summary.nextUpcomingInstallment.installment.totalInstallmentAmountUsd,
                    'USD',
                    locale
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 font-editorial text-lg font-bold text-emerald-200">
                  Sin cuotas pendientes
                </p>
                <p className="mt-0.5 text-[11px] text-rose-100/80">Todo al día</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Notificaciones Push integrada con el Service Worker de la PWA */}
      <PushModuleInlineBar
        kind="app_credit"
        appData={data}
        showToast={showToast}
        onOpenPushCenter={onOpenPushCenter}
      />

      {/* Formulario interactivo con Motor de Generación de Cuotas */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateCredit}
          className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface)] p-6 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
            <div>
              <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                Registrar Nuevo Crédito de App
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Ingresa el monto solicitado, cantidad de cuotas, frecuencia en días y comisión
                por cuota para autogenerar las fechas y montos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-xl p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Atajos de Apps populares */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Selección rápida de App
            </label>
            <div className="flex flex-wrap gap-2">
              {POPULAR_APPS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setAppName(preset.name);
                    setFrequencyDays(preset.defaultDays);
                    setInstallmentsCount(preset.defaultInstallments);
                  }}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold border transition ${
                    appName === preset.name
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-light)] text-[var(--pink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {preset.name} ({preset.defaultInstallments} cuotas c/{preset.defaultDays} días)
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Nombre de la App *
              </label>
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Ej. Ubii App, Avila Pay..."
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Concepto o destino (opcional)
              </label>
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej. Liquidez quincenal, Compra..."
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Fecha de Solicitud / Inicio *
              </label>
              <input
                type="date"
                required
                value={requestDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setRequestDate(nextDate);
                  const lookup = obtenerTasaPorFecha(
                    nextDate,
                    data.rateHistory,
                    activeRate || data.settings.defaultExchangeRate,
                    data.transactions
                  );
                  if (lookup.rate && lookup.rate > 0) {
                    const rounded = Number(lookup.rate.toFixed(2));
                    setExchangeRateInput(String(rounded));
                    setDepositRateInput(String(rounded));
                    setRequestDateRateHint(
                      lookup.exactMatch || lookup.matchedDate
                        ? `${lookup.sourceLabel}: ${rounded.toFixed(2)} Bs/$`
                        : null
                    );
                  } else {
                    setRequestDateRateHint(null);
                  }
                }}
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
              />
              {requestDateRateHint && (
                <p className="mt-1 text-[10px] font-semibold text-emerald-500">
                  ✓ {requestDateRateHint}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Moneda del Crédito *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`rounded-xl py-2.5 text-xs font-bold border transition ${
                    currency === 'USD'
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-primary)] text-white'
                      : 'border-[var(--border-input)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  Dólares (USD $)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrency('VES');
                    if (activeRate && activeRate > 0) {
                      setExchangeRateInput(String(activeRate));
                    }
                  }}
                  className={`rounded-xl py-2.5 text-xs font-bold border transition ${
                    currency === 'VES'
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-primary)] text-white'
                      : 'border-[var(--border-input)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                  }`}
                >
                  Bolívares (VES Bs)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Monto Solicitado (Capital Total en {currency === 'VES' ? 'Bs' : '$'}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={requestedAmountInput}
                onChange={(e) => setRequestedAmountInput(e.target.value)}
                placeholder="100.00"
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
              />
              {currency === 'USD' &&
                Number(requestedAmountInput) >= 500 &&
                (activeRate || Number(depositRateInput) || 450) > 1 && (
                  <div className="mt-2 rounded-xl border border-amber-500/50 bg-amber-500/15 p-2.5 text-[11px] text-[var(--text-primary)] space-y-1.5">
                    <div className="font-bold text-amber-300">
                      ⚠️ Pusiste ${Number(requestedAmountInput).toLocaleString('es-VE')} en Dólares ($)
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      Al cambio BCV eso serían{' '}
                      <strong className="text-amber-300">
                        {formatearMonto(
                          Number(requestedAmountInput) *
                            (activeRate || Number(depositRateInput) || 450),
                          'VES',
                          locale
                        )}
                      </strong>
                      . ¿Ese monto está en realidad en Bolívares (Bs)?
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrency('VES');
                          if (activeRate && activeRate > 0) {
                            setExchangeRateInput(String(activeRate));
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold text-[10px] hover:bg-amber-400"
                      >
                        Sí, son Bs. {Number(requestedAmountInput).toFixed(2)} (Cambiar a Bs)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const r =
                            activeRate || Number(depositRateInput) || 450;
                          const convertedUsd = Number(
                            (Number(requestedAmountInput) / r).toFixed(2)
                          );
                          setRequestedAmountInput(String(convertedUsd));
                          if (Number(feePerInstallmentInput) > 50) {
                            setFeePerInstallmentInput(
                              String(
                                Number(
                                  (Number(feePerInstallmentInput) / r).toFixed(2)
                                )
                              )
                            );
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-amber-500/40 text-amber-300 font-bold text-[10px]"
                      >
                        Convertir a $ USD (÷ {formatearTasa(activeRate || 450, locale)} = $
                        {(
                          Number(requestedAmountInput) /
                          (activeRate || Number(depositRateInput) || 450)
                        ).toFixed(2)}
                        )
                      </button>
                    </div>
                  </div>
                )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Comisión Fija por Cuota ({currency === 'VES' ? 'Bs' : '$'}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={feePerInstallmentInput}
                onChange={(e) => setFeePerInstallmentInput(e.target.value)}
                placeholder="2.00"
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Cantidad de Cuotas *
              </label>
              <input
                type="number"
                min="1"
                max="48"
                required
                value={installmentsCount}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(48, Number(e.target.value) || 1));
                  setInstallmentsCount(val);
                  setAlreadyPaidNumbers((prev) => prev.filter((n) => n <= val));
                }}
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Frecuencia en Días (ej. 14 o 15 días) *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={frequencyDays}
                  onChange={(e) =>
                    setFrequencyDays(Math.max(1, Math.min(365, Number(e.target.value) || 15)))
                  }
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setFrequencyDays(14)}
                  className={`rounded-xl px-3 text-xs font-bold border ${
                    frequencyDays === 14
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-light)] text-[var(--pink-primary)]'
                      : 'border-[var(--border-input)] text-[var(--text-secondary)]'
                  }`}
                >
                  14d
                </button>
                <button
                  type="button"
                  onClick={() => setFrequencyDays(15)}
                  className={`rounded-xl px-3 text-xs font-bold border ${
                    frequencyDays === 15
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-light)] text-[var(--pink-primary)]'
                      : 'border-[var(--border-input)] text-[var(--text-secondary)]'
                  }`}
                >
                  15d
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Categoría de Gasto
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {currency === 'VES' && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Tasa de Cambio Referencial (Bs/USD) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={exchangeRateInput}
                  onChange={(e) => setExchangeRateInput(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* DESEMBOLSO: ¿A DÓNDE FUE EL DINERO QUE TE PRESTARON? */}
          {/* ===================================================================== */}
          <div className="rounded-2xl border border-[var(--pink-primary)]/40 bg-[var(--surface-subtle)] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)]">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    ¿A dónde fue el dinero que pediste en {appName || 'la app'}?
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Elige si el dinero entró a <strong>tu cuenta personal</strong> o si se lo{' '}
                    <strong>pasaste directo a la cuenta de un amigo / tercero</strong> (sin pasar por tus cuentas ni sumarte un ingreso falso).
                  </p>
                </div>
              </div>

              {/* Selector de 3 modos de destino */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDepositDestinationMode('personal_wallet');
                    setDepositToWallet(true);
                  }}
                  className={`text-left rounded-xl p-3 border transition-all ${
                    depositDestinationMode === 'personal_wallet'
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-light)]/40 ring-1 ring-[var(--pink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    🏦 A mi cuenta personal
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Entra a mi banco/billetera al cambio BCV y suma a mi saldo disponible.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDepositDestinationMode('third_party_direct');
                    setDepositToWallet(false);
                    setDepositNetManualInput('');
                  }}
                  className={`text-left rounded-xl p-3 border transition-all ${
                    depositDestinationMode === 'third_party_direct'
                      ? 'border-violet-500 bg-violet-500/15 ring-1 ring-violet-500'
                      : 'border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="text-xs font-bold text-violet-400">
                    🤝 Directo a Cuenta de Tercero / Amigo
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Nunca pasó por mis cuentas. No suma ingreso ni altera mi saldo personal.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDepositDestinationMode('none');
                    setDepositToWallet(false);
                    setDepositNetManualInput('');
                  }}
                  className={`text-left rounded-xl p-3 border transition-all ${
                    depositDestinationMode === 'none'
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-light)]/40 ring-1 ring-[var(--pink-primary)]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    📋 Solo registrar cuotas
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    No tocar ninguna cuenta por ahora; solo llevar el control de cuotas.
                  </div>
                </button>
              </div>
            </div>

            {depositDestinationMode === 'third_party_direct' && (
              <div className="space-y-4 pt-3 border-t border-[var(--border-divider)]">
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3.5 text-xs text-[var(--text-primary)] space-y-1">
                  <div className="font-bold text-violet-400">
                    🛡️ Dinero de Paso / Prestado a un Amigo desde {appName || 'la app'}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Como le pasaste los{' '}
                    <strong>
                      {currency === 'USD' ? '$' : 'Bs. '}
                      {requestedAmountInput || '0'}
                    </strong>{' '}
                    directo a su cuenta de la app o a su banco, <strong>este monto NO se sumará a tus ingresos del mes ni a tu saldo disponible</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      ¿A quién le pasaste ese dinero? (Nombre del amigo / tercero) *
                    </label>
                    <input
                      type="text"
                      value={thirdPartyRecipientName}
                      onChange={(e) => setThirdPartyRecipientName(e.target.value)}
                      placeholder="Ej: Carlos, Amigo del trabajo, Primo..."
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Cuenta de Terceros (Opcional · Sin afectar tu saldo)
                      </label>
                      <button
                        type="button"
                        onClick={handleQuickCreatePassThroughWallet}
                        className="text-[11px] font-bold text-violet-400 hover:underline"
                      >
                        + Crear cuenta de terceros rápida
                      </button>
                    </div>
                    <select
                      value={thirdPartyWalletId}
                      onChange={(e) => setThirdPartyWalletId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                    >
                      <option value="">
                        Sin cuenta en Wallets (No guardar en historial de cuentas)
                      </option>
                      {passThroughWallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          🤝 {w.name} ({w.currency}) — Cuenta de Terceros (No suma ingreso)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Opción para crear automáticamente la deuda a tu favor en Préstamos */}
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] p-3.5 space-y-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createReceivableLoanForFriend}
                      onChange={(e) => setCreateReceivableLoanForFriend(e.target.checked)}
                      className="mt-0.5 rounded accent-[var(--pink-primary)]"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[var(--text-primary)] block">
                        Anotar automáticamente en «Préstamos» que {thirdPartyRecipientName.trim() || 'tu amigo'} te debe este dinero
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                        Así cuando tu amigo te vaya pagando las cuotas o el total, podrás cobrarlo sin perder la cuenta.
                      </span>
                    </div>
                  </label>

                  {createReceivableLoanForFriend && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 pl-6">
                      <button
                        type="button"
                        onClick={() => setLoanAmountMode('total_with_fees')}
                        className={`text-left rounded-xl p-2.5 border text-xs transition ${
                          loanAmountMode === 'total_with_fees'
                            ? 'border-[var(--pink-primary)] bg-[var(--pink-light)]/30 font-bold text-[var(--text-primary)]'
                            : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        Me debe capital + comisiones de la app (
                        {currency === 'USD' ? '$' : 'Bs. '}
                        {(
                          (Number(requestedAmountInput) || 0) +
                          installmentsCount * (Number(feePerInstallmentInput) || 0)
                        ).toFixed(2)}
                        )
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoanAmountMode('principal_only')}
                        className={`text-left rounded-xl p-2.5 border text-xs transition ${
                          loanAmountMode === 'principal_only'
                            ? 'border-[var(--pink-primary)] bg-[var(--pink-light)]/30 font-bold text-[var(--text-primary)]'
                            : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        Me debe solo el capital prestado (
                        {currency === 'USD' ? '$' : 'Bs. '}
                        {(Number(requestedAmountInput) || 0).toFixed(2)})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {depositDestinationMode === 'personal_wallet' && (
              <div className="space-y-4 pt-2 border-t border-[var(--border-divider)]">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-end">
                  {/* Selector de Cuenta / Billetera destino */}
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Mi cuenta personal donde recibo el dinero *
                    </label>
                    <select
                      value={depositWalletId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setDepositWalletId(nextId);
                        const found = personalWallets.find((w) => w.id === nextId);
                        if (found?.currency) {
                          setDepositCurrency(found.currency);
                        }
                      }}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                    >
                      {personalWallets.map((w) => {
                        const wSum = walletSummaries.billeteras.find(
                          (b) => b.wallet.id === w.id
                        );
                        const balText = wSum
                          ? w.currency === 'VES'
                            ? formatearMonto(wSum.saldoActualVes, 'VES', locale)
                            : formatearMonto(wSum.saldoActualUsd, 'USD', locale)
                          : '';
                        return (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.currency === 'VES' ? 'Bolívares Bs' : 'Dólares USD'})
                            {balText ? ` — Saldo: ${balText}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Tasa BCV aplicada para el cambio a Bs */}
                  <div className="sm:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Tasa BCV del cambio (Bs/$)
                      </label>
                      {activeRate && activeRate > 0 && (
                        <button
                          type="button"
                          onClick={() => setDepositRateInput(String(activeRate))}
                          className="text-[10px] font-bold text-[var(--pink-primary)] hover:underline"
                        >
                          Usar BCV ({formatearTasa(activeRate, locale)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={depositRateInput}
                      onChange={(e) => setDepositRateInput(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-mono-tabular font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                    />
                  </div>

                  {/* % Comisión por pasar al banco */}
                  <div className="sm:col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        % Comisión por pasar al banco
                      </label>
                      <div className="flex items-center gap-1">
                        {['0', '0.3', '0.5', '1'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setDepositBankFeePctInput(preset);
                              setDepositNetManualInput('');
                            }}
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${
                              depositBankFeePctInput === preset &&
                              depositNetManualInput.trim() === ''
                                ? 'bg-[var(--pink-primary)] text-white'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={depositBankFeePctInput}
                        onChange={(e) => {
                          setDepositBankFeePctInput(e.target.value);
                          setDepositNetManualInput('');
                        }}
                        placeholder="Ej: 0.5"
                        className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 pr-8 text-sm font-mono-tabular font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fila 2: Monto manual que pasará a la cuenta + Resumen de liquidación */}
                {(() => {
                  const reqNum = Math.max(0, Number(requestedAmountInput) || 0);
                  const rateNum =
                    Number(depositRateInput) > 0
                      ? Number(depositRateInput)
                      : activeRate || 450;
                  const selectedW = personalWallets.find(
                    (w) => w.id === depositWalletId
                  );
                  const targetCur: CurrencyCode =
                    selectedW?.currency || depositCurrency || 'VES';

                  const reqUsd =
                    currency === 'USD'
                      ? reqNum
                      : rateNum > 0
                        ? reqNum / rateNum
                        : 0;
                  const grossNominal = Number(
                    (targetCur === 'VES'
                      ? currency === 'VES'
                        ? reqNum
                        : reqUsd * rateNum
                      : reqUsd
                    ).toFixed(2)
                  );

                  const feePct = Math.max(0, Number(depositBankFeePctInput) || 0);
                  const autoNetNominal = Number(
                    (grossNominal * (1 - feePct / 100)).toFixed(2)
                  );
                  const hasManualNet =
                    depositNetManualInput.trim() !== '' &&
                    Number(depositNetManualInput) > 0;
                  const netNominal = hasManualNet
                    ? Number(Number(depositNetManualInput).toFixed(2))
                    : autoNetNominal;
                  const feeAmountNominal = Math.max(
                    0,
                    Number((grossNominal - netNominal).toFixed(2))
                  );
                  const effectivePct =
                    grossNominal > 0
                      ? Number(((feeAmountNominal / grossNominal) * 100).toFixed(2))
                      : 0;

                  return (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-center">
                      <div className="sm:col-span-5">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                            Monto final que pasará a mi cuenta (Manual opcional)
                          </label>
                          {hasManualNet && (
                            <button
                              type="button"
                              onClick={() => setDepositNetManualInput('')}
                              className="text-[10px] font-bold text-[var(--pink-primary)] hover:underline"
                            >
                              Calcular por %
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={depositNetManualInput}
                          onChange={(e) => setDepositNetManualInput(e.target.value)}
                          placeholder={`Automático: ${autoNetNominal.toFixed(2)}`}
                          className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-mono-tabular font-semibold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                        />
                        <span className="mt-1 block text-[10px] text-[var(--text-secondary)]">
                          Puedes dejar que se calcule con el % o escribir directo el monto exacto que te cayó al banco (ej. 8817.96).
                        </span>
                      </div>

                      <div className="sm:col-span-7">
                        <div className="rounded-xl bg-[var(--income-bg)] border border-emerald-500/30 p-3.5 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[var(--income-color)]">
                              Monto Neto que entrará a {selectedW?.name || 'tu cuenta'}:
                            </span>
                            <span className="text-lg font-bold font-mono-tabular text-[var(--income-color)]">
                              + {formatearMonto(netNominal, targetCur, locale)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tabular text-[var(--text-secondary)] pt-1 border-t border-emerald-500/20">
                            <span>
                              Bruto BCV: <strong>{formatearMonto(grossNominal, targetCur, locale)}</strong>
                            </span>
                            <span>
                              Comisión banco ({effectivePct}%):{' '}
                              <strong className="text-rose-400">
                                - {formatearMonto(feeAmountNominal, targetCur, locale)}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Vista previa del Motor de Generación de Cuotas */}
          {livePreviewInstallments.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Vista Previa del Cronograma Autogenerado ({livePreviewInstallments.length}{' '}
                    cuotas cada {frequencyDays} días)
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Puedes <strong>editar el monto exacto de cada cuota</strong> si tu app (ej. Avila Pay) redondea distinto algún centavo, o marcarla como ya pagada.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {Object.keys(customInstallmentInputs).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCustomInstallmentInputs({})}
                      className="rounded-lg border border-[var(--border-input)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--pink-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      Restablecer montos automáticos
                    </button>
                  )}
                  <div className="text-right">
                    <span className="text-xs text-[var(--text-secondary)]">
                      Total Crédito (Capital + Comisión):{' '}
                    </span>
                    <span className="text-sm font-bold font-mono-tabular text-[var(--text-primary)]">
                      {currency === 'VES'
                        ? formatearMonto(
                            livePreviewInstallments.reduce(
                              (acc, i) => acc + i.totalInstallmentAmount,
                              0
                            ),
                            'VES',
                            locale
                          )
                        : formatearMonto(
                            livePreviewInstallments.reduce(
                              (acc, i) => acc + i.totalInstallmentAmountUsd,
                              0
                            ),
                            'USD',
                            locale
                          )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {livePreviewInstallments.map((inst) => {
                  const isMarkedPaid = alreadyPaidNumbers.includes(inst.number);
                  const symbol = currency === 'VES' ? 'Bs. ' : '$';
                  const rawCustomValue = customInstallmentInputs[inst.number];
                  const isCustomEdited =
                    rawCustomValue !== undefined && rawCustomValue.trim() !== '';

                  return (
                    <div
                      key={inst.id}
                      className={`rounded-xl border p-3 transition space-y-2 ${
                        isMarkedPaid
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : 'border-[var(--border-hairline)] bg-[var(--surface)] hover:border-[var(--pink-primary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Cuota #{inst.number} (+{inst.number * frequencyDays}d)
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleAlreadyPaidNumber(inst.number)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                            isMarkedPaid
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                          }`}
                        >
                          {isMarkedPaid ? 'Ya pagada antes' : 'Pendiente'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-[var(--text-secondary)] mb-0.5">
                          Monto de la cuota ({currency === 'VES' ? 'Bs' : '$'}):
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">
                            {symbol}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={
                              isCustomEdited
                                ? rawCustomValue
                                : inst.totalInstallmentAmount.toFixed(2)
                            }
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setCustomInstallmentInputs((prev) => ({
                                ...prev,
                                [inst.number]: nextVal,
                              }));
                            }}
                            className="w-full rounded-lg border border-[var(--border-input)] bg-[var(--surface-subtle)] pl-7 pr-2.5 py-1.5 font-mono-tabular text-sm font-bold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Capital: {symbol}
                        {inst.principalAmount.toFixed(2)} + Comisión: {symbol}
                        {inst.feeAmount.toFixed(2)}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-secondary)]">
                        <Calendar className="h-3 w-3 text-[var(--pink-primary)]" />
                        Vence: {formatDateShort(inst.dueDate)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-xl border border-[var(--border-input)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--pink-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--pink-dark)]"
            >
              <CheckCircle2 className="h-4 w-4" />
              Guardar Crédito y Proyectar Cuotas
            </button>
          </div>
        </form>
      )}

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'active', 'paid'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-[var(--pink-primary)] text-white'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)] hover:bg-[var(--surface-subtle)]'
              }`}
            >
              {st === 'all'
                ? `Todos (${appCredits.length})`
                : st === 'active'
                  ? `Activos (${summary.activeCreditsCount})`
                  : `Pagados (${summary.completedCreditsCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de tarjetas de Créditos de Apps */}
      {filteredCredits.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-hairline)] bg-[var(--surface)] p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)]">
            <Smartphone className="h-6 w-6" />
          </div>
          <h3 className="mt-3 font-editorial text-lg font-bold text-[var(--text-primary)]">
            No tienes créditos de apps registrados en esta vista
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-secondary)]">
            Registra tus financiamientos de Ubii App, Avila Pay u otras plataformas para llevar
            el control exacto de capital, comisión por cuota y su impacto en tu Saldo Proyectado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredCredits.map((credit) => {
            const paidCount = credit.installments.filter((i) => i.status === 'paid').length;
            const totalCount = credit.installments.length;
            const pendingUsd = credit.installments
              .filter((i) => i.status === 'pending')
              .reduce(
                (sum, i) => sum + obtenerEstadoAbonosCuotaCreditoApp(i).remainingUsd,
                0
              );
            const totalPaidUsdInCredit = Math.max(
              0,
              credit.totalToPayAmountUsd - pendingUsd
            );
            const progressPct =
              credit.totalToPayAmountUsd > 0
                ? Math.min(
                    100,
                    Math.round((totalPaidUsdInCredit / credit.totalToPayAmountUsd) * 100)
                  )
                : totalCount > 0
                  ? Math.round((paidCount / totalCount) * 100)
                  : 0;
            const isExpanded = expandedCreditIds[credit.id] ?? true;
            const symbol = credit.currency === 'VES' ? 'Bs. ' : '$';

            return (
              <div
                key={credit.id}
                className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface)] p-5 shadow-sm transition hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Cabecera de la tarjeta */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-sm ${
                          credit.status === 'paid'
                            ? 'bg-emerald-600'
                            : 'bg-gradient-to-br from-[#6D28D9] to-[#C86D85]'
                        }`}
                      >
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                            {credit.appName}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              credit.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}
                          >
                            {credit.status === 'paid' ? 'Pagado' : 'Activo'}
                          </span>
                          <span className="rounded-full bg-[var(--pink-light)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--pink-primary)]">
                            Cada {credit.frequencyDays} días
                          </span>
                        </div>
                        {credit.concept && (
                          <p className="text-xs font-medium text-[var(--text-primary)]">
                            {credit.concept}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Solicitado el {formatDateShort(credit.requestDate)} · Capital:{' '}
                          <strong>
                            {symbol}
                            {credit.requestedAmount.toFixed(2)}
                          </strong>{' '}
                          + Comisión/cuota:{' '}
                          <strong>
                            {symbol}
                            {credit.feePerInstallment.toFixed(2)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeletingCredit(credit)}
                      title="Eliminar crédito"
                      className="rounded-xl p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Estado del Desembolso: Cuenta donde se recibió el dinero prestado */}
                  {(() => {
                    const depositWallet = credit.depositWalletId
                      ? data.wallets.find((w) => w.id === credit.depositWalletId)
                      : null;

                    const isThirdPartyDirect =
                      credit.depositDestinationMode === 'third_party_direct' ||
                      Boolean(depositWallet?.isPassThroughAccount);

                    if (isThirdPartyDirect) {
                      const targetLabel =
                        credit.thirdPartyRecipientName ||
                        depositWallet?.beneficiaryName ||
                        depositWallet?.name ||
                        'Amigo / Tercero';
                      return (
                        <div className="mt-3 rounded-2xl border border-violet-500/35 bg-violet-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-violet-300 font-bold text-[11px] shrink-0">
                              🤝
                            </span>
                            <span className="text-[var(--text-primary)]">
                              Pasado directo a Cuenta de Tercero / Amigo:{' '}
                              <strong className="text-violet-300">
                                {targetLabel}
                              </strong>{' '}
                              ·{' '}
                              <span className="text-[11px] text-[var(--text-secondary)]">
                                No pasó por tus cuentas personales ni suma ingreso
                                {depositWallet ? ` (${depositWallet.name})` : ''}
                              </span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDisbursingCredit(credit)}
                            className="text-[11px] font-semibold text-violet-300 hover:underline"
                          >
                            Editar destino / cuenta
                          </button>
                        </div>
                      );
                    }

                    if (credit.depositToWallet && depositWallet) {
                      const depCur =
                        credit.depositCurrency || depositWallet.currency || 'VES';
                      const depAmt =
                        credit.depositAmountNominal ??
                        (depCur === 'VES'
                          ? credit.requestedAmountUsd *
                            (credit.depositExchangeRate || activeRate || 450)
                          : credit.requestedAmountUsd);
                      const feeAmt = credit.depositBankFeeAmountNominal ?? 0;
                      const grossAmt = credit.depositGrossAmountNominal ?? depAmt;
                      return (
                        <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <ArrowDownRight className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span className="text-[var(--text-primary)]">
                              Dinero neto recibido en{' '}
                              <strong>{depositWallet.name}</strong>:{' '}
                              <strong className="font-mono-tabular text-emerald-400">
                                + {formatearMonto(depAmt, depCur, locale)}
                              </strong>
                              {depCur === 'VES' && credit.depositExchangeRate ? (
                                <span className="text-[11px] text-[var(--text-secondary)] ml-1">
                                  (Bruto BCV: {formatearMonto(grossAmt, depCur, locale)}
                                  {feeAmt > 0
                                    ? ` · Comisión banco: -${formatearMonto(feeAmt, depCur, locale)}`
                                    : ''}{' '}
                                  · Tasa {formatearTasa(credit.depositExchangeRate, locale)} Bs/$)
                                </span>
                              ) : null}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDisbursingCredit(credit)}
                            className="text-[11px] font-semibold text-[var(--pink-primary)] hover:underline"
                          >
                            Editar destino / cuenta
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs text-[var(--text-primary)]">
                          <span className="font-bold text-amber-400">
                            ¿A dónde fueron los{' '}
                            {formatearMonto(credit.requestedAmountUsd, 'USD', locale)}?
                          </span>{' '}
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            Pásalos a tu cuenta al cambio BCV o márcalos como pasados directo a un amigo/tercero (sin sumar ingreso).
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDisbursingCredit(credit)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pink-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--pink-dark)] shrink-0 self-start sm:self-auto"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          <span>Elegir destino (Mi cuenta o Tercero)</span>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Barra de progreso: X de Y cuotas pagadas */}
                  <div className="mt-4 rounded-2xl bg-[var(--surface-subtle)] p-3.5 border border-[var(--border-hairline)]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[var(--text-primary)]">
                        Barra de progreso: {paidCount} de {totalCount} cuotas pagadas ({progressPct}%)
                      </span>
                      <span className="font-semibold font-mono-tabular text-[var(--pink-primary)]">
                        Resta: {formatearMonto(pendingUsd, 'USD', locale)}
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface)] border border-[var(--border-hairline)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          credit.status === 'paid'
                            ? 'bg-emerald-500'
                            : 'bg-gradient-to-r from-[#6D28D9] to-[#C86D85]'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between text-[11px] text-[var(--text-secondary)]">
                      <span>
                        Total Capital: {symbol}
                        {credit.requestedAmount.toFixed(2)}
                      </span>
                      <span>
                        Total Comisiones: {symbol}
                        {credit.totalFeeAmount.toFixed(2)}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        Total Crédito: {symbol}
                        {credit.totalToPayAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Botón de Lista Desplegable de Cuotas */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleExpandCredit(credit.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                    >
                      <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-[var(--pink-primary)]" />
                        Desglose de Cuotas (Fechas, Capital y Comisión)
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 space-y-2">
                        {credit.installments.map((inst) => {
                          const isOverdue =
                            inst.status === 'pending' && inst.dueDate < todayStr;
                          const paidWallet = inst.paidWalletId
                            ? data.wallets.find((w) => w.id === inst.paidWalletId)
                            : null;
                          const isEditingThis =
                            editingInstallment?.creditId === credit.id &&
                            editingInstallment?.installmentId === inst.id;
                          const abonoState = obtenerEstadoAbonosCuotaCreditoApp(inst);
                          const hasPartialAbonos =
                            abonoState.partialPayments.length > 0 &&
                            abonoState.paidInCreditCurrency > 0;

                          return (
                            <div
                              key={inst.id}
                              className={`flex flex-col justify-between gap-2 rounded-2xl border p-3 sm:flex-row sm:items-start ${
                                inst.status === 'paid'
                                  ? 'border-emerald-500/30 bg-emerald-500/10'
                                  : isOverdue
                                    ? 'border-rose-500/40 bg-rose-500/10'
                                    : hasPartialAbonos
                                      ? 'border-[var(--pink-primary)]/40 bg-[var(--surface-subtle)]'
                                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)]'
                              }`}
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-bold text-[var(--text-primary)]">
                                    Cuota #{inst.number}
                                  </span>
                                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                                    · Vence: {formatDateShort(inst.dueDate)}
                                  </span>
                                  {inst.status === 'paid' ? (
                                    inst.paidByThirdPartyDirect ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300 border border-violet-500/30">
                                        <CheckCircle2 className="h-3 w-3" />
                                        🤝 Pagó directo {inst.thirdPartyPayerName || 'Tercero'}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" />
                                        {inst.alreadyPaidExternally
                                          ? 'Pagada antes'
                                          : 'Pagada'}
                                      </span>
                                    )
                                  ) : isOverdue ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                                      <AlertCircle className="h-3 w-3" />
                                      Vencida
                                    </span>
                                  ) : hasPartialAbonos ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pink-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--pink-primary)]">
                                      <Clock className="h-3 w-3" />
                                      Con abono parcial
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                      <Clock className="h-3 w-3" />
                                      Pendiente
                                    </span>
                                  )}
                                </div>

                                {isEditingThis ? (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface)] p-2 border border-[var(--pink-primary)]/50">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                        Monto ({symbol.trim()}):
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        autoFocus
                                        value={editingInstallment.amountInput}
                                        onChange={(e) =>
                                          setEditingInstallment((prev) =>
                                            prev
                                              ? { ...prev, amountInput: e.target.value }
                                              : null
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveEditedInstallment(credit, inst);
                                          } else if (e.key === 'Escape') {
                                            setEditingInstallment(null);
                                          }
                                        }}
                                        className="w-24 rounded-lg border border-[var(--border-input)] bg-[var(--surface-subtle)] px-2 py-1 font-mono-tabular text-xs font-bold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                        Vence:
                                      </span>
                                      <input
                                        type="date"
                                        value={editingInstallment.dueDateInput}
                                        onChange={(e) =>
                                          setEditingInstallment((prev) =>
                                            prev
                                              ? { ...prev, dueDateInput: e.target.value }
                                              : null
                                          )
                                        }
                                        className="rounded-lg border border-[var(--border-input)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 ml-auto">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSaveEditedInstallment(credit, inst)
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                                      >
                                        <Check className="h-3 w-3" />
                                        Guardar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingInstallment(null)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-input)] bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[var(--text-secondary)]">
                                    Capital:{' '}
                                    <strong className="text-[var(--text-primary)]">
                                      {symbol}
                                      {inst.principalAmount.toFixed(2)}
                                    </strong>{' '}
                                    + Comisión:{' '}
                                    <strong className="text-[var(--text-primary)]">
                                      {symbol}
                                      {inst.feeAmount.toFixed(2)}
                                    </strong>{' '}
                                    ={' '}
                                    <strong className="text-[var(--pink-primary)] font-mono-tabular">
                                      {symbol}
                                      {inst.totalInstallmentAmount.toFixed(2)}
                                    </strong>{' '}
                                    ({formatearMonto(inst.totalInstallmentAmountUsd, 'USD', locale)})
                                  </p>
                                )}

                                {/* Resumen de abonos parciales en esta cuota */}
                                {inst.status === 'pending' && hasPartialAbonos && (
                                  <div className="mt-1.5 rounded-xl bg-[var(--surface)] p-2 border border-[var(--border-hairline)] space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                      <span className="font-semibold text-emerald-400 font-mono-tabular">
                                        Abonado: {symbol}
                                        {abonoState.paidInCreditCurrency.toFixed(2)}
                                      </span>
                                      <span className="font-bold text-[var(--pink-primary)] font-mono-tabular">
                                        Resta por pagar: {symbol}
                                        {abonoState.remainingInCreditCurrency.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      {abonoState.partialPayments.map((part, idx) => {
                                        const partWallet = part.walletId
                                          ? data.wallets.find((w) => w.id === part.walletId)
                                          : null;
                                        return (
                                          <div
                                            key={part.id}
                                            className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-secondary)] border-t border-[var(--border-hairline)] pt-1"
                                          >
                                            <span>
                                              Abono #{idx + 1} ({formatDateShort(part.date)}):{' '}
                                              <strong className="font-mono-tabular text-[var(--text-primary)]">
                                                {symbol}
                                                {part.amountInCreditCurrency.toFixed(2)}
                                              </strong>{' '}
                                              {part.paidByThirdPartyDirect ? (
                                                <span className="text-violet-300 font-semibold">
                                                  (🤝 Pagó directo {part.thirdPartyPayerName || 'Tercero'} a {credit.appName} · sin tocar tus cuentas)
                                                </span>
                                              ) : part.alreadyPaidExternally ? (
                                                <span className="text-emerald-400 font-semibold">
                                                  (Pagado antes · sin descontar billetera)
                                                </span>
                                              ) : (
                                                <span>
                                                  desde {partWallet?.name || 'Billetera'} (
                                                  {formatearMonto(
                                                    part.paymentAmountNominal,
                                                    part.paymentCurrency,
                                                    locale
                                                  )}
                                                  )
                                                </span>
                                              )}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDeletePartialPayment(
                                                  credit.id,
                                                  inst.id,
                                                  part.id,
                                                  inst.number
                                                )
                                              }
                                              title="Eliminar este abono"
                                              className="rounded p-0.5 text-[var(--text-secondary)] hover:text-rose-500"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {inst.status === 'paid' && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-emerald-400">
                                      {inst.paidByThirdPartyDirect
                                        ? `🤝 Pagada el ${formatDateShort(inst.paidAt || todayStr)} directo a ${credit.appName} por ${inst.thirdPartyPayerName || 'Amigo / Tercero'} (sin pasar por tus cuentas)`
                                        : inst.alreadyPaidExternally
                                          ? 'Marcada como pagada previamente (no descontó de billeteras)'
                                          : `Pagada el ${formatDateShort(inst.paidAt || todayStr)} desde ${
                                              paidWallet?.name || 'Billetera'
                                            }`}
                                    </p>
                                    {abonoState.partialPayments.length > 1 && (
                                      <p className="text-[10px] text-[var(--text-secondary)]">
                                        Liquidada en {abonoState.partialPayments.length} abonos.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center shrink-0">
                                {!isEditingThis && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingInstallment({
                                        creditId: credit.id,
                                        installmentId: inst.id,
                                        amountInput: inst.totalInstallmentAmount.toFixed(2),
                                        dueDateInput: inst.dueDate,
                                      })
                                    }
                                    title="Modificar monto o fecha de esta cuota"
                                    className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--pink-primary)] hover:text-[var(--pink-primary)]"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    <span>Editar monto</span>
                                  </button>
                                )}

                                {inst.status === 'pending' ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPayingTarget({
                                          credit,
                                          installment: inst,
                                          initialMode: 'partial',
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--pink-primary)] bg-[var(--pink-light)] px-2.5 py-1.5 text-xs font-bold text-[var(--pink-primary)] transition hover:bg-[var(--pink-primary)] hover:text-white"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      Abonar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPayingTarget({
                                          credit,
                                          installment: inst,
                                          initialMode: 'full',
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pink-primary)] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--pink-dark)]"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      {hasPartialAbonos ? 'Pagar Restante' : 'Pagar Cuota'}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRevertInstallment(
                                        credit.id,
                                        inst.id,
                                        inst.number
                                      )
                                    }
                                    title="Revertir cuota a pendiente"
                                    className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Revertir
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Confirmar Pago o Abono de Cuota */}
      {payingTarget && (
        <PayAppCreditInstallmentModal
          credit={payingTarget.credit}
          installment={payingTarget.installment}
          initialMode={payingTarget.initialMode}
          data={data}
          activeRate={activeRate}
          walletSummaries={walletSummaries}
          onClose={() => setPayingTarget(null)}
          onConfirm={handleConfirmPayInstallment}
        />
      )}

      {/* Modal para Abonar/Pasar el dinero prestado a una cuenta a tasa BCV */}
      {disbursingCredit && (
        <DisburseAppCreditModal
          credit={disbursingCredit}
          data={data}
          activeRate={activeRate}
          walletSummaries={walletSummaries}
          onClose={() => setDisbursingCredit(null)}
          onConfirm={handleConfirmDisburseCredit}
        />
      )}

      {/* Modal para Eliminar Crédito */}
      {deletingCredit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-4">
            <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
              Eliminar crédito de {deletingCredit.appName}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Las cuotas pendientes dejarán de restar en tu Saldo Proyectado. ¿Qué deseas hacer
              con las cuotas que ya habías pagado desde tus billeteras?
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleDeleteCredit(deletingCredit, false)}
                className="w-full rounded-xl bg-[var(--pink-primary)] px-4 py-2.5 text-xs font-bold text-white hover:bg-[var(--pink-dark)]"
              >
                Eliminar crédito pero conservar egresos ya pagados
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCredit(deletingCredit, true)}
                className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Eliminar crédito y borrar también los pagos realizados
              </button>
              <button
                type="button"
                onClick={() => setDeletingCredit(null)}
                className="w-full rounded-xl border border-[var(--border-input)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WIDGET INTERACTIVO PARA EL DASHBOARD PRINCIPAL (Tarjetas de Progreso + Desplegable)
// ============================================================================

interface AppCreditsDashboardWidgetProps {
  data: AppDataSchema;
  activeRate: number | null;
  onUpdateData: (updater: (prev: AppDataSchema) => AppDataSchema) => void;
  onNavigateToModule: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AppCreditsDashboardWidget: React.FC<AppCreditsDashboardWidgetProps> = ({
  data,
  activeRate,
  onUpdateData,
  onNavigateToModule,
  showToast,
}) => {
  const locale = data.settings.numberFormatLocale || 'es-VE';
  const appCredits = data.appCredits ?? [];
  const activeCredits = useMemo(
    () => appCredits.filter((c) => c.status === 'active'),
    [appCredits]
  );
  const summary = useMemo(
    () => calcularResumenCreditosApp(appCredits),
    [appCredits]
  );
  const walletSummaries = useMemo(
    () => calcularResumenBilleteras(data),
    [data]
  );

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [payingTarget, setPayingTarget] = useState<{
    credit: AppCredit;
    installment: AppCreditInstallment;
  } | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] shrink-0">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Créditos de Apps (Ubii App / Avila Pay)
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {summary.activeCreditsCount} activo(s) · Pasivo proyectado:{' '}
              <strong className="font-mono-tabular text-[var(--pink-primary)]">
                {formatearMonto(summary.totalDebtPendingUsd, 'USD', locale)}
              </strong>{' '}
              (Capital {formatearMonto(summary.totalPrincipalPendingUsd, 'USD', locale)} + Comisión{' '}
              {formatearMonto(summary.totalFeesPendingUsd, 'USD', locale)})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToModule}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Gestionar Créditos de Apps →</span>
        </button>
      </div>

      {appCredits.length === 0 ? (
        <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-[var(--text-secondary)]">
            Registra tus microcréditos de Ubii App, Avila Pay u otras apps con cálculo automático de cuotas cada 14 o 15 días (Capital + Comisión).
          </span>
          <button
            type="button"
            onClick={onNavigateToModule}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-input)] font-semibold text-[var(--pink-primary)] hover:bg-[var(--surface-hover)] shrink-0"
          >
            + Nuevo Crédito de App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(activeCredits.length > 0 ? activeCredits : appCredits.slice(0, 2)).map((credit) => {
            const paidCount = credit.installments.filter((i) => i.status === 'paid').length;
            const totalCount = credit.installments.length;
            const pct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
            const isOpen = Boolean(expandedIds[credit.id]);
            const symbol = credit.currency === 'VES' ? 'Bs. ' : '$';
            const pendingInstallments = credit.installments.filter(
              (i) => i.status === 'pending'
            );

            return (
              <div
                key={credit.id}
                className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-editorial text-base font-bold text-[var(--text-primary)]">
                      {credit.appName}
                    </span>
                    {credit.concept && (
                      <span className="ml-2 text-xs text-[var(--text-secondary)]">
                        · {credit.concept}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--pink-primary)] border border-[var(--border-hairline)]">
                    {paidCount} de {totalCount} cuotas pagadas
                  </span>
                </div>

                {/* Barra de progreso */}
                <div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface)] border border-[var(--border-hairline)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#6D28D9] to-[#C86D85] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>Frecuencia: cada {credit.frequencyDays} días</span>
                    <span>
                      Cuota: {symbol}
                      {(
                        credit.requestedAmount / credit.installmentsCount +
                        credit.feePerInstallment
                      ).toFixed(2)}{' '}
                      (Cap. + Com.)
                    </span>
                  </div>
                </div>

                {/* Lista desplegable de cuotas pendientes */}
                <button
                  type="button"
                  onClick={() => toggleExpand(credit.id)}
                  className="flex w-full items-center justify-between rounded-xl bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] border border-[var(--border-hairline)] hover:bg-[var(--surface-hover)]"
                >
                  <span>
                    {pendingInstallments.length > 0
                      ? `Desplegar ${pendingInstallments.length} cuota(s) pendiente(s) (Fechas, Capital y Comisión)`
                      : 'Ver desglose de cuotas pagadas'}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-[var(--text-secondary)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[var(--text-secondary)]" />
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-1.5 pt-1">
                    {credit.installments.map((inst) => (
                      <div
                        key={inst.id}
                        className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-3 py-2 text-xs border border-[var(--border-hairline)]"
                      >
                        <div>
                          <p className="font-bold text-[var(--text-primary)]">
                            Cuota #{inst.number} · Vence: {formatDateShort(inst.dueDate)}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            Capital: {symbol}
                            {inst.principalAmount.toFixed(2)} + Comisión: {symbol}
                            {inst.feeAmount.toFixed(2)} ={' '}
                            <strong className="text-[var(--pink-primary)] font-mono-tabular">
                              {symbol}
                              {inst.totalInstallmentAmount.toFixed(2)}
                            </strong>
                          </p>
                        </div>
                        {inst.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => setPayingTarget({ credit, installment: inst })}
                            className="rounded-lg bg-[var(--pink-primary)] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[var(--pink-dark)]"
                          >
                            Pagar
                          </button>
                        ) : (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            Pagada
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {payingTarget && (
        <PayAppCreditInstallmentModal
          credit={payingTarget.credit}
          installment={payingTarget.installment}
          data={data}
          activeRate={activeRate}
          walletSummaries={walletSummaries}
          onClose={() => setPayingTarget(null)}
          onConfirm={(input) => {
            try {
              onUpdateData((prev) => registrarPagoCuotaCreditoAppEnAppData(prev, input));
              setPayingTarget(null);
              showToast(
                input.paidByThirdPartyDirect
                  ? `Cuota pagada directo a la App por ${input.thirdPartyPayerName || 'tercero'} (sin descontar de tus cuentas).`
                  : 'Pago de cuota registrado en tu Saldo Real.',
                'success'
              );
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : 'Error al pagar cuota.',
                'error'
              );
            }
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// MODAL DE CONFIRMACIÓN DE PAGO O ABONO DE CUOTA (MI CUENTA / TERCERO DIRECTO / YA PAGADA ANTES)
// ============================================================================

export interface PayAppCreditInstallmentModalProps {
  credit: AppCredit;
  installment: AppCreditInstallment;
  initialMode?: 'full' | 'partial';
  data: AppDataSchema;
  activeRate: number | null;
  walletSummaries: ReturnType<typeof calcularResumenBilleteras>;
  onClose: () => void;
  onConfirm: (input: PayAppCreditInstallmentInput) => void;
}

export const PayAppCreditInstallmentModal: React.FC<PayAppCreditInstallmentModalProps> = ({
  credit,
  installment,
  initialMode = 'full',
  data,
  activeRate,
  walletSummaries,
  onClose,
  onConfirm,
}) => {
  const todayStr = obtenerFechaLocalIso();
  const locale = data.settings.numberFormatLocale || 'es-VE';
  const activeWallets = data.wallets.filter(
    (w) =>
      w.active !== false &&
      !w.isThirdPartyExpenseAccount &&
      !w.isPassThroughAccount
  );
  const passThroughWallets = data.wallets.filter(
    (w) => w.active !== false && Boolean(w.isPassThroughAccount)
  );
  const abonoState = useMemo(
    () => obtenerEstadoAbonosCuotaCreditoApp(installment),
    [installment]
  );

  // Si el crédito fue sacado para un amigo (depositDestinationMode === 'third_party_direct' o tiene thirdPartyRecipientName),
  // pre-seleccionamos por comodidad el modo "Pagó directo un Amigo / Tercero"
  const [paymentOriginMode, setPaymentOriginMode] = useState<
    'personal_wallet' | 'third_party_direct' | 'already_paid'
  >(() => {
    if (
      credit.depositDestinationMode === 'third_party_direct' ||
      Boolean(credit.thirdPartyRecipientName)
    ) {
      return 'third_party_direct';
    }
    return 'personal_wallet';
  });

  const [thirdPartyPayerName, setThirdPartyPayerName] = useState<string>(
    () => credit.thirdPartyRecipientName || credit.concept || ''
  );
  const [thirdPartyPassThroughWalletId, setThirdPartyPassThroughWalletId] =
    useState<string>(() => {
      if (
        credit.depositWalletId &&
        passThroughWallets.some((w) => w.id === credit.depositWalletId)
      ) {
        return credit.depositWalletId;
      }
      return '';
    });

  // Préstamos por cobrar pendientes en la sección Préstamos (por si quiere descontarlo de la deuda del amigo)
  const pendingReceivableLoans = useMemo(
    () =>
      (data.debts || []).filter(
        (d) => d.kind !== 'payable' && d.status === 'pending'
      ),
    [data.debts]
  );
  const [deductFromLinkedLoan, setDeductFromLinkedLoan] = useState<boolean>(() =>
    Boolean(
      credit.linkedLoanId &&
        pendingReceivableLoans.some((d) => d.id === credit.linkedLoanId)
    )
  );
  const [linkedLoanIdToDeduct, setLinkedLoanIdToDeduct] = useState<string>(() => {
    if (
      credit.linkedLoanId &&
      pendingReceivableLoans.some((d) => d.id === credit.linkedLoanId)
    ) {
      return credit.linkedLoanId;
    }
    return pendingReceivableLoans[0]?.id || '';
  });

  // Cuotas pendientes ordenadas desde la seleccionada (para pagar 1, 2, todas u otro monto en 1 solo movimiento bancario)
  const selectedInstIdx = useMemo(
    () => credit.installments.findIndex((i) => i.id === installment.id),
    [credit.installments, installment.id]
  );

  const orderedPendingInstallments = useMemo(() => {
    const startIdx = selectedInstIdx >= 0 ? selectedInstIdx : 0;
    return [
      ...credit.installments.slice(startIdx).filter((i) => i.status !== 'paid'),
      ...credit.installments.slice(0, startIdx).filter((i) => i.status !== 'paid'),
    ];
  }, [credit.installments, selectedInstIdx]);

  const twoInstallmentsCreditCur = useMemo(() => {
    const slice = orderedPendingInstallments.slice(0, 2);
    return Number(
      slice
        .reduce(
          (sum, i) => sum + obtenerEstadoAbonosCuotaCreditoApp(i).remainingInCreditCurrency,
          0
        )
        .toFixed(2)
    );
  }, [orderedPendingInstallments]);

  const allPendingCreditCur = useMemo(() => {
    return Number(
      orderedPendingInstallments
        .reduce(
          (sum, i) => sum + obtenerEstadoAbonosCuotaCreditoApp(i).remainingInCreditCurrency,
          0
        )
        .toFixed(2)
    );
  }, [orderedPendingInstallments]);

  type AppCreditPreset = 'one' | 'two' | 'all' | 'custom';
  const [paymentPreset, setPaymentPreset] = useState<AppCreditPreset>(
    initialMode === 'partial' ? 'custom' : 'one'
  );

  const [isPartialPayment, setIsPartialPayment] = useState<boolean>(
    initialMode === 'partial'
  );
  const [abonoCreditCurInput, setAbonoCreditCurInput] = useState<string>(() => {
    const half = Math.max(
      0.01,
      Math.round((abonoState.remainingInCreditCurrency / 2) * 100) / 100
    );
    return initialMode === 'partial'
      ? half.toFixed(2)
      : abonoState.remainingInCreditCurrency.toFixed(2);
  });

  const [paidDate, setPaidDate] = useState(todayStr);
  const [walletId, setWalletId] = useState(() => {
    const preferred =
      activeWallets.find((w) => w.currency === 'VES') || activeWallets[0];
    return preferred?.id || 'wallet_zelle';
  });
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>(() => {
    const preferred =
      activeWallets.find((w) => w.currency === 'VES') || activeWallets[0];
    return preferred?.currency || credit.currency;
  });
  const [rateSource, setRateSource] = useState<'bcv' | 'manual'>('bcv');
  const [matchedDateRate, setMatchedDateRate] = useState<number | null>(null);
  const [paidDateRateHint, setPaidDateRateHint] = useState<string | null>(null);
  const [exchangeRateInput, setExchangeRateInput] = useState(
    activeRate && activeRate > 0
      ? String(activeRate)
      : credit.exchangeRate
        ? String(credit.exchangeRate)
        : '450'
  );

  // Estado para comisión bancaria (Pago Móvil / Transferencia)
  const [interbankFeeType, setInterbankFeeType] = useState<
    'none' | 'pago_movil' | 'transferencia'
  >('none');
  const [transferFeeMode, setTransferFeeMode] = useState<'fixed_ves' | 'percent'>(
    'fixed_ves'
  );
  const [feeValueStr, setFeeValueStr] = useState<string>('0.3');

  const selectedWallet = useMemo(
    () => activeWallets.find((w) => w.id === walletId),
    [activeWallets, walletId]
  );

  const effectiveBcvOrDateRate = matchedDateRate || activeRate;
  const currentRate =
    paymentCurrency === 'VES'
      ? rateSource === 'bcv' && effectiveBcvOrDateRate && effectiveBcvOrDateRate > 0
        ? effectiveBcvOrDateRate
        : Number(exchangeRateInput) || 1
      : null;

  // Monto efectivo en la moneda del crédito que se va a pagar/abonar en esta operación
  const targetCreditCurAmount = useMemo(() => {
    if (paymentPreset === 'one') return abonoState.remainingInCreditCurrency;
    if (paymentPreset === 'two') return twoInstallmentsCreditCur;
    if (paymentPreset === 'all') return allPendingCreditCur;
    return Math.max(
      0,
      Math.min(allPendingCreditCur, Number(abonoCreditCurInput) || 0)
    );
  }, [
    paymentPreset,
    abonoState.remainingInCreditCurrency,
    twoInstallmentsCreditCur,
    allPendingCreditCur,
    abonoCreditCurInput,
  ]);

  const targetUsdAmount =
    credit.currency === 'USD'
      ? targetCreditCurAmount
      : credit.exchangeRate && credit.exchangeRate > 0
        ? Number((targetCreditCurAmount / credit.exchangeRate).toFixed(2))
        : targetCreditCurAmount;

  const paymentAllocationBreakdown = useMemo(() => {
    let rem = targetCreditCurAmount;
    const items: Array<{
      number: number;
      appliedCreditCur: number;
      completes: boolean;
      leftAfterCreditCur: number;
    }> = [];
    for (const inst of orderedPendingInstallments) {
      if (rem <= 0.004) break;
      const st = obtenerEstadoAbonosCuotaCreditoApp(inst);
      if (st.remainingInCreditCurrency <= 0.004) continue;
      const applied = Number(
        Math.min(rem, st.remainingInCreditCurrency).toFixed(2)
      );
      rem = Number(Math.max(0, rem - applied).toFixed(2));
      const completes = applied >= st.remainingInCreditCurrency - 0.009;
      const leftAfter = completes
        ? 0
        : Number(
            Math.max(0, st.remainingInCreditCurrency - applied).toFixed(2)
          );
      items.push({
        number: inst.number,
        appliedCreditCur: completes ? st.remainingInCreditCurrency : applied,
        completes,
        leftAfterCreditCur: leftAfter,
      });
    }
    return items;
  }, [targetCreditCurAmount, orderedPendingInstallments]);

  const computeNominalFromTarget = (
    creditCurAmt: number,
    payCur: CurrencyCode,
    rateVal: number | null
  ) => {
    const usdEq =
      credit.currency === 'USD'
        ? creditCurAmt
        : credit.exchangeRate && credit.exchangeRate > 0
          ? creditCurAmt / credit.exchangeRate
          : creditCurAmt;
    if (payCur === 'USD') {
      return Number(usdEq.toFixed(2));
    }
    if (credit.currency === 'VES') {
      return Number(creditCurAmt.toFixed(2));
    }
    return Number((usdEq * (rateVal || activeRate || 450)).toFixed(2));
  };

  const defaultNominal = computeNominalFromTarget(
    targetCreditCurAmount,
    paymentCurrency,
    currentRate
  );

  const [amountNominalInput, setAmountNominalInput] = useState(
    String(defaultNominal.toFixed(2))
  );
  const [notes, setNotes] = useState('');

  const syncNominalWithAbono = (
    nextCreditCurAmt: number,
    nextPayCur: CurrencyCode = paymentCurrency,
    nextRate: number | null = currentRate
  ) => {
    const computed = computeNominalFromTarget(nextCreditCurAmt, nextPayCur, nextRate);
    setAmountNominalInput(computed.toFixed(2));
  };

  const handleSelectPreset = (preset: AppCreditPreset) => {
    setPaymentPreset(preset);
    if (preset === 'one') {
      setIsPartialPayment(false);
      setAbonoCreditCurInput(abonoState.remainingInCreditCurrency.toFixed(2));
      syncNominalWithAbono(abonoState.remainingInCreditCurrency);
    } else if (preset === 'two') {
      setIsPartialPayment(false);
      setAbonoCreditCurInput(twoInstallmentsCreditCur.toFixed(2));
      syncNominalWithAbono(twoInstallmentsCreditCur);
    } else if (preset === 'all') {
      setIsPartialPayment(false);
      setAbonoCreditCurInput(allPendingCreditCur.toFixed(2));
      syncNominalWithAbono(allPendingCreditCur);
    } else {
      setIsPartialPayment(true);
      const half = Math.max(
        0.01,
        Math.round((abonoState.remainingInCreditCurrency / 2) * 100) / 100
      );
      setAbonoCreditCurInput(half.toFixed(2));
      syncNominalWithAbono(half);
    }
  };

  const handleWalletChange = (newWalletId: string) => {
    setWalletId(newWalletId);
    const w = activeWallets.find((item) => item.id === newWalletId);
    if (w) {
      const nextCur: CurrencyCode = w.currency === 'VES' ? 'VES' : 'USD';
      setPaymentCurrency(nextCur);
      const rate =
        rateSource === 'bcv' && effectiveBcvOrDateRate && effectiveBcvOrDateRate > 0
          ? effectiveBcvOrDateRate
          : Number(exchangeRateInput) || 450;
      syncNominalWithAbono(targetCreditCurAmount, nextCur, rate);
      if (interbankFeeType === 'pago_movil') {
        setFeeValueStr(String(w.comisionPagoMovil ?? 0.3));
      } else if (interbankFeeType === 'transferencia') {
        if (w.isBonusCard) {
          setTransferFeeMode('percent');
          setFeeValueStr(String(w.comisionTransferencia ?? 1.5));
        } else {
          setTransferFeeMode('fixed_ves');
          setFeeValueStr(String(w.comisionTransferencia ?? 54));
        }
      }
    }
  };

  const handleFeeTypeChange = (
    nextType: 'none' | 'pago_movil' | 'transferencia'
  ) => {
    setInterbankFeeType(nextType);
    if (nextType === 'pago_movil') {
      setFeeValueStr(String(selectedWallet?.comisionPagoMovil ?? 0.3));
    } else if (nextType === 'transferencia') {
      if (selectedWallet?.isBonusCard) {
        setTransferFeeMode('percent');
        setFeeValueStr(String(selectedWallet?.comisionTransferencia ?? 1.5));
      } else {
        setTransferFeeMode('fixed_ves');
        setFeeValueStr(String(selectedWallet?.comisionTransferencia ?? 54));
      }
    }
  };

  const parsedNominalAmount = Number(amountNominalInput) || defaultNominal;

  const calculatedFeeAmount = useMemo(() => {
    if (paymentOriginMode !== 'personal_wallet' || interbankFeeType === 'none') return 0;
    const rawVal = Number(feeValueStr.replace(',', '.')) || 0;
    if (rawVal <= 0 || parsedNominalAmount <= 0) return 0;

    if (interbankFeeType === 'pago_movil') {
      const rawFee = Number(((parsedNominalAmount * rawVal) / 100).toFixed(2));
      return paymentCurrency === 'VES' ? Math.max(14, rawFee) : rawFee;
    }

    if (interbankFeeType === 'transferencia') {
      if (transferFeeMode === 'percent') {
        return Number(((parsedNominalAmount * rawVal) / 100).toFixed(2));
      }
      return Number(rawVal.toFixed(2));
    }
    return 0;
  }, [
    paymentOriginMode,
    interbankFeeType,
    feeValueStr,
    parsedNominalAmount,
    paymentCurrency,
    transferFeeMode,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isThirdParty = paymentOriginMode === 'third_party_direct';
    const isAlreadyPaid = paymentOriginMode === 'already_paid';
    const isStrictlyPartial =
      targetCreditCurAmount < abonoState.remainingInCreditCurrency - 0.009;

    onConfirm({
      appCreditId: credit.id,
      installmentId: installment.id,
      paidDate,
      isPartialPayment: isStrictlyPartial,
      abonoAmountInCreditCurrency: targetCreditCurAmount,
      paymentOriginMode,
      alreadyPaidExternally: isAlreadyPaid || isThirdParty,
      paidByThirdPartyDirect: isThirdParty,
      thirdPartyPayerName: isThirdParty
        ? thirdPartyPayerName.trim() ||
          credit.thirdPartyRecipientName ||
          'Amigo / Tercero'
        : null,
      thirdPartyPassThroughWalletId: isThirdParty
        ? thirdPartyPassThroughWalletId || null
        : null,
      deductFromLinkedLoan: isThirdParty && deductFromLinkedLoan,
      linkedLoanIdToDeduct:
        isThirdParty && deductFromLinkedLoan ? linkedLoanIdToDeduct || null : null,
      walletId: paymentOriginMode === 'personal_wallet' ? walletId : null,
      paymentCurrency,
      paymentAmountNominal: parsedNominalAmount,
      exchangeRate: paymentCurrency === 'VES' ? currentRate : null,
      exchangeRateSource: paymentCurrency === 'VES' ? rateSource : 'none',
      interbankFeeType:
        paymentOriginMode === 'personal_wallet' ? interbankFeeType : 'none',
      interbankFeeAmount:
        paymentOriginMode === 'personal_wallet' ? calculatedFeeAmount : 0,
      notes,
    });
  };

  const symbol = credit.currency === 'VES' ? 'Bs. ' : '$';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera limpia con icono contextual */}
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--surface-subtle)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)] border border-[var(--pink-primary)]/20">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                {paymentPreset === 'all' && orderedPendingInstallments.length > 1
                  ? `Liquidar Total (${orderedPendingInstallments.length} cuotas)`
                  : paymentPreset === 'two' && orderedPendingInstallments.length >= 2
                    ? `Pagar 2 Cuotas (#${orderedPendingInstallments[0].number} y #${orderedPendingInstallments[1].number})`
                    : paymentPreset === 'custom'
                      ? `Pagar Otro Monto · ${credit.appName}`
                      : `Pagar Cuota #${installment.number} de ${credit.installmentsCount}`}
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {credit.appName} · Total crédito pendiente: {symbol}{allPendingCreditCur.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Selector estilo Cashea: 1 Cuota | 2 Cuotas | Todas | Otro monto */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">
              ¿Qué monto deseas pagar hoy? (Se registrará como 1 solo movimiento bancario)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl bg-[var(--surface-subtle)] p-1.5 border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => handleSelectPreset('one')}
                className={`rounded-xl px-2.5 py-2 text-left transition-all ${
                  paymentPreset === 'one'
                    ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/60'
                }`}
              >
                <span className="block text-[11px] font-bold leading-tight">
                  1 Cuota (#{installment.number})
                </span>
                <span className="block font-mono-tabular text-[10px] opacity-90 mt-0.5">
                  {symbol}{abonoState.remainingInCreditCurrency.toFixed(2)}
                </span>
              </button>

              {orderedPendingInstallments.length >= 2 && (
                <button
                  type="button"
                  onClick={() => handleSelectPreset('two')}
                  className={`rounded-xl px-2.5 py-2 text-left transition-all ${
                    paymentPreset === 'two'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/60'
                  }`}
                >
                  <span className="block text-[11px] font-bold leading-tight">
                    2 Cuotas
                  </span>
                  <span className="block font-mono-tabular text-[10px] opacity-90 mt-0.5">
                    {symbol}{twoInstallmentsCreditCur.toFixed(2)}
                  </span>
                </button>
              )}

              {orderedPendingInstallments.length >= 2 && (
                <button
                  type="button"
                  onClick={() => handleSelectPreset('all')}
                  className={`rounded-xl px-2.5 py-2 text-left transition-all ${
                    paymentPreset === 'all'
                      ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/60'
                  }`}
                >
                  <span className="block text-[11px] font-bold leading-tight">
                    Todas ({orderedPendingInstallments.length})
                  </span>
                  <span className="block font-mono-tabular text-[10px] opacity-90 mt-0.5">
                    {symbol}{allPendingCreditCur.toFixed(2)}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`rounded-xl px-2.5 py-2 text-left transition-all ${
                  paymentPreset === 'custom'
                    ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/60'
                }`}
              >
                <span className="block text-[11px] font-bold leading-tight">
                  Otro monto
                </span>
                <span className="block text-[10px] opacity-90 mt-0.5">
                  Abono o adelanto
                </span>
              </button>
            </div>
          </div>

          {/* Selector de Origen del Pago: Mi cuenta | Pagó directo un Amigo | Ya pagada antes */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">
              ¿Desde dónde se realiza este {isPartialPayment ? 'abono' : 'pago'}?
            </label>
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--surface-subtle)] p-1 border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setPaymentOriginMode('personal_wallet')}
                className={`rounded-xl py-2 px-2 text-[11px] font-bold transition-all ${
                  paymentOriginMode === 'personal_wallet'
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs border border-[var(--border-hairline)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                🏦 Mi cuenta
              </button>
              <button
                type="button"
                onClick={() => setPaymentOriginMode('third_party_direct')}
                className={`rounded-xl py-2 px-2 text-[11px] font-bold transition-all ${
                  paymentOriginMode === 'third_party_direct'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                🤝 Pagó directo Amigo
              </button>
              <button
                type="button"
                onClick={() => setPaymentOriginMode('already_paid')}
                className={`rounded-xl py-2 px-2 text-[11px] font-bold transition-all ${
                  paymentOriginMode === 'already_paid'
                    ? 'bg-[var(--surface)] text-emerald-500 shadow-xs border border-[var(--border-hairline)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                📋 Ya pagada antes
              </button>
            </div>
          </div>

          {/* Aviso explicativo cuando paga directo un amigo/tercero */}
          {paymentOriginMode === 'third_party_direct' && (
            <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-3 text-xs text-[var(--text-primary)] space-y-1">
              <strong className="text-violet-300 block">
                🛡️ Pago directo a {credit.appName} (Sin pasar por tus cuentas)
              </strong>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Tu amigo o tercero pagó directamente a la App sin usar tus cuentas. No necesitas elegir una cuenta de origen tuya y no se restará nada de tu Saldo Real.
              </p>
            </div>
          )}

          {/* 1. Fecha del pago/abono + Cuenta / Quién pagó (Antes del monto para cargar tasa histórica) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Fecha del {isPartialPayment ? 'abono' : 'pago'} *
              </label>
              <input
                type="date"
                required
                value={paidDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setPaidDate(nextDate);
                  const lookup = obtenerTasaPorFecha(
                    nextDate,
                    data.rateHistory,
                    activeRate || data.settings.defaultExchangeRate,
                    data.transactions
                  );
                  if (lookup.rate && lookup.rate > 0) {
                    const rounded = Number(lookup.rate.toFixed(2));
                    setMatchedDateRate(rounded);
                    setExchangeRateInput(String(rounded));
                    if (paymentCurrency === 'VES') {
                      syncNominalWithAbono(targetCreditCurAmount, 'VES', rounded);
                    }
                    setPaidDateRateHint(
                      lookup.exactMatch || lookup.matchedDate
                        ? `${lookup.sourceLabel}: ${rounded.toFixed(2)} Bs/$`
                        : null
                    );
                  } else {
                    setMatchedDateRate(null);
                    setPaidDateRateHint(null);
                  }
                }}
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
              />
              {paidDateRateHint && (
                <p className="mt-1 text-[10px] font-semibold text-emerald-500">
                  ✓ {paidDateRateHint}
                </p>
              )}
            </div>

            {paymentOriginMode === 'personal_wallet' ? (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Cuenta de pago *
                </label>
                <select
                  value={walletId}
                  onChange={(e) => handleWalletChange(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
                >
                  {activeWallets.map((w) => {
                    const ws = walletSummaries.billeteras.find((s) => s.wallet.id === w.id);
                    const balText = ws
                      ? w.currency === 'VES'
                        ? formatearMonto(ws.saldoActualVes, 'VES', locale)
                        : formatearMonto(ws.saldoActualUsd, 'USD', locale)
                      : '$0.00';
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.banco || w.currency}) — Disp: {balText}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : paymentOriginMode === 'third_party_direct' ? (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  ¿Quién pagó directo a {credit.appName}? *
                </label>
                <input
                  type="text"
                  required
                  value={thirdPartyPayerName}
                  onChange={(e) => setThirdPartyPayerName(e.target.value)}
                  placeholder="Ej. Carlos, Amigo..."
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Nota opcional
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Pagado anteriormente..."
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
                />
              </div>
            )}
          </div>

          {/* Opciones adicionales para Pago Directo de Amigo: Cuenta de Terceros opcional y descuento automático de Préstamo por Cobrar */}
          {paymentOriginMode === 'third_party_direct' && (
            <div className="space-y-2.5">
              {passThroughWallets.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Cuenta de Terceros opcional (solo si deseas reflejarlo en Wallets)
                  </label>
                  <select
                    value={thirdPartyPassThroughWalletId}
                    onChange={(e) => setThirdPartyPassThroughWalletId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">
                      Sin cuenta de origen (Pagó directo desde su banco a {credit.appName})
                    </option>
                    {passThroughWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        🤝 {w.name} ({w.currency}) — Cuenta de Terceros
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {pendingReceivableLoans.length > 0 && (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-3 space-y-2">
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs">
                    <input
                      type="checkbox"
                      checked={deductFromLinkedLoan}
                      onChange={(e) => setDeductFromLinkedLoan(e.target.checked)}
                      className="mt-0.5 rounded border-[var(--border-input)] text-violet-600"
                    />
                    <div>
                      <span className="font-bold text-[var(--text-primary)]">
                        Descontar este pago de su deuda conmigo en "Préstamos"
                      </span>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Rebaja automáticamente este monto de lo que te debe esa persona (sin sumar ingreso a tus cuentas personales).
                      </p>
                    </div>
                  </label>

                  {deductFromLinkedLoan && (
                    <select
                      value={linkedLoanIdToDeduct}
                      onChange={(e) => setLinkedLoanIdToDeduct(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      {pendingReceivableLoans.map((loan) => {
                        const paidSoFar = (loan.payments || []).reduce(
                          (acc, p) => acc + (Number(p.amountUsd) || 0),
                          0
                        );
                        const remUsd = Math.max(0, loan.totalAmountUsd - paidSoFar);
                        return (
                          <option key={loan.id} value={loan.id}>
                            {loan.creditor} — {loan.description} (Resta: {formatearMonto(remUsd, 'USD', locale)})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Si es Otro monto (Custom): Cuánto se va a pagar/abonar */}
          {paymentPreset === 'custom' && (
            <div className="rounded-2xl border border-[var(--pink-primary)]/40 bg-[var(--surface-subtle)]/60 p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-[var(--text-primary)]">
                  Monto personalizado a pagar ({credit.currency === 'VES' ? 'Bs.' : '$ USD'}) *
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { label: '50% cuota', val: abonoState.remainingInCreditCurrency * 0.5 },
                    { label: '1 cuota', val: abonoState.remainingInCreditCurrency },
                    ...(orderedPendingInstallments.length >= 2
                      ? [{ label: '2 cuotas', val: twoInstallmentsCreditCur }]
                      : []),
                    ...(orderedPendingInstallments.length >= 2
                      ? [{ label: 'Total', val: allPendingCreditCur }]
                      : []),
                  ].map((item) => {
                    const val = Math.max(0.01, Math.round(item.val * 100) / 100);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setAbonoCreditCurInput(val.toFixed(2));
                          syncNominalWithAbono(val);
                        }}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--pink-primary)] hover:bg-[var(--pink-light)]"
                      >
                        {item.label} ({symbol}{val.toFixed(2)})
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">
                  {symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={allPendingCreditCur}
                  required
                  value={abonoCreditCurInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setAbonoCreditCurInput(raw);
                    const num = Number(raw);
                    if (Number.isFinite(num) && num > 0) {
                      syncNominalWithAbono(num);
                    }
                  }}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] pl-8 pr-3.5 py-2 font-mono-tabular text-sm font-bold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Resumen visual de cómo se aplica este pago a las cuotas (1 solo movimiento bancario) */}
          {paymentAllocationBreakdown.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-[var(--text-primary)]">
                  Aplicación del pago ({symbol}{targetCreditCurAmount.toFixed(2)})
                </span>
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                  1 solo movimiento bancario
                </span>
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {paymentAllocationBreakdown.map((row) => (
                  <div
                    key={row.number}
                    className="flex items-center justify-between text-[11px] py-0.5 border-b border-[var(--border-hairline)]/60 last:border-b-0"
                  >
                    <span className="text-[var(--text-secondary)] font-medium">
                      Cuota #{row.number}
                    </span>
                    <div className="flex items-center gap-2 font-mono-tabular">
                      <span className="font-bold text-[var(--text-primary)]">
                        {symbol}{row.appliedCreditCur.toFixed(2)}
                      </span>
                      {row.completes ? (
                        <span className="text-[10px] font-semibold text-emerald-500">
                          ✓ Queda pagada
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-500">
                          Resta {symbol}{row.leftAfterCreditCur.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Tarjeta Principal de Monto y Moneda (para Mi cuenta o para dejar constancia de cuánto pagó el amigo) */}
          {paymentOriginMode !== 'already_paid' && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {paymentOriginMode === 'third_party_direct'
                    ? `Monto pagado directo a ${credit.appName}`
                    : 'Monto a debitar y moneda'}
                </span>
                <div className="inline-flex rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-hairline)]">
                  {(['USD', 'VES'] as CurrencyCode[]).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => {
                        setPaymentCurrency(cur);
                        const rate =
                          rateSource === 'bcv' && effectiveBcvOrDateRate && effectiveBcvOrDateRate > 0
                            ? effectiveBcvOrDateRate
                            : Number(exchangeRateInput) || 450;
                        syncNominalWithAbono(targetCreditCurAmount, cur, rate);
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        paymentCurrency === cur
                          ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {cur === 'USD' ? 'USD $' : 'Bolívares Bs'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-lg font-bold text-[var(--text-secondary)] font-mono-tabular select-none">
                  {paymentCurrency === 'USD' ? '$' : 'Bs.'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountNominalInput}
                  onChange={(e) => setAmountNominalInput(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] pl-12 pr-4 py-3 text-xl font-bold font-mono-tabular text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
                />
              </div>

              {paymentCurrency === 'VES' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)] text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--text-secondary)]">Tasa del día:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRateSource('bcv');
                        const targetR = matchedDateRate || activeRate;
                        if (targetR && targetR > 0) {
                          setExchangeRateInput(String(targetR));
                          setAmountNominalInput((targetUsdAmount * targetR).toFixed(2));
                        }
                      }}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        rateSource === 'bcv'
                          ? 'bg-[var(--pink-light)] text-[var(--pink-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      BCV {effectiveBcvOrDateRate ? `(${effectiveBcvOrDateRate.toFixed(2)})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRateSource('manual')}
                      className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                        rateSource === 'manual'
                          ? 'bg-[var(--pink-light)] text-[var(--pink-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Manual
                    </button>
                    {rateSource === 'manual' && (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={exchangeRateInput}
                        onChange={(e) => {
                          setExchangeRateInput(e.target.value);
                          const r = Number(e.target.value) || 0;
                          if (r > 0) {
                            setAmountNominalInput((targetUsdAmount * r).toFixed(2));
                          }
                        }}
                        className="w-20 rounded-lg border border-[var(--border-input)] bg-[var(--surface)] px-2 py-0.5 text-xs font-mono-tabular font-semibold text-[var(--text-primary)]"
                      />
                    )}
                  </div>

                  <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                    ≈ {formatearMonto(targetUsdAmount, 'USD', locale)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 3. Comisión bancaria compacta (solo cuando sale de Mi cuenta personal) */}
          {paymentOriginMode === 'personal_wallet' && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  Comisión bancaria ({selectedWallet?.name || 'Cuenta'})
                </span>
                <div className="inline-flex rounded-xl bg-[var(--surface)] p-0.5 border border-[var(--border-hairline)]">
                  {[
                    { id: 'none', label: 'Sin comisión' },
                    {
                      id: 'pago_movil',
                      label: `📲 Pago Móvil (${selectedWallet?.comisionPagoMovil ?? 0.3}%)`,
                    },
                    { id: 'transferencia', label: '🏦 Transferencia' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        handleFeeTypeChange(opt.id as 'none' | 'pago_movil' | 'transferencia')
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                        interbankFeeType === opt.id
                          ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {interbankFeeType !== 'none' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)] text-xs">
                  <div className="flex items-center gap-2">
                    {interbankFeeType === 'transferencia' && (
                      <div className="inline-flex rounded-lg bg-[var(--surface)] p-0.5 border border-[var(--border-input)]">
                        <button
                          type="button"
                          onClick={() => {
                            setTransferFeeMode('fixed_ves');
                            setFeeValueStr(String(selectedWallet?.comisionTransferencia ?? 54));
                          }}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            transferFeeMode === 'fixed_ves'
                              ? 'bg-[var(--pink-primary)] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          Monto fijo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferFeeMode('percent');
                            setFeeValueStr('1.5');
                          }}
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            transferFeeMode === 'percent'
                              ? 'bg-[var(--pink-primary)] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          %
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={feeValueStr}
                        onChange={(e) => setFeeValueStr(e.target.value)}
                        className="w-20 rounded-lg border border-[var(--border-input)] bg-[var(--surface)] px-2 py-1 text-right font-mono-tabular text-xs font-bold text-[var(--text-primary)]"
                      />
                      <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                        {interbankFeeType === 'pago_movil' || transferFeeMode === 'percent'
                          ? '%'
                          : paymentCurrency === 'VES'
                            ? 'Bs.'
                            : '$'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono-tabular">
                    <span className="text-[var(--text-secondary)]">Comisión: </span>
                    <strong className="text-[var(--pink-primary)]">
                      +{formatearMonto(calculatedFeeAmount, paymentCurrency, locale)}
                    </strong>
                    <span className="ml-1.5 text-[var(--text-primary)] font-bold">
                      (Total: {formatearMonto(parsedNominalAmount + calculatedFeeAmount, paymentCurrency, locale)})
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nota opcional para Mi cuenta o Pago directo de Amigo */}
          {paymentOriginMode !== 'already_paid' && (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Nota opcional
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  paymentOriginMode === 'third_party_direct'
                    ? `Ej. Pagó directo a ${credit.appName} desde su banco...`
                    : isPartialPayment
                      ? 'Ej. Adelanto parcial...'
                      : 'Ej. Pago puntual...'
                }
                className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-[var(--border-input)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 text-xs font-bold rounded-xl text-white transition-colors shadow-sm ${
                paymentOriginMode === 'third_party_direct'
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)]'
              }`}
            >
              {paymentOriginMode === 'third_party_direct'
                ? isPartialPayment
                  ? `Registrar Abono Directo (${thirdPartyPayerName.trim() || 'Amigo'})`
                  : `Registrar Pago Directo (${thirdPartyPayerName.trim() || 'Amigo'})`
                : isPartialPayment
                  ? 'Registrar Abono'
                  : 'Confirmar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MODAL DE DESEMBOLSO: SELECCIONAR CUENTA Y ABONAR PRÉSTAMO AL CAMBIO BCV
// ============================================================================

interface DisburseAppCreditModalProps {
  credit: AppCredit;
  data: AppDataSchema;
  activeRate: number | null;
  walletSummaries: ReturnType<typeof calcularResumenBilleteras>;
  onClose: () => void;
  onConfirm: (input: DisburseAppCreditInput) => void;
}

const DisburseAppCreditModal: React.FC<DisburseAppCreditModalProps> = ({
  credit,
  data,
  activeRate,
  walletSummaries,
  onClose,
  onConfirm,
}) => {
  const locale = data.settings.numberFormatLocale || 'es-VE';
  const personalWallets = data.wallets.filter(
    (w) =>
      w.active !== false &&
      !w.isThirdPartyExpenseAccount &&
      !w.isPassThroughAccount
  );
  const passThroughWallets = data.wallets.filter(
    (w) => w.active !== false && Boolean(w.isPassThroughAccount)
  );
  const activeWallets = data.wallets.filter((w) => w.active !== false);

  const defaultVesWallet =
    personalWallets.find((w) => w.id === credit.depositWalletId) ||
    personalWallets.find((w) => w.currency === 'VES') ||
    personalWallets[0] ||
    activeWallets[0];

  const [destinationMode, setDestinationMode] = useState<
    'personal_wallet' | 'third_party_direct' | 'none'
  >(() => {
    if (credit.depositDestinationMode) return credit.depositDestinationMode;
    const existingW = data.wallets.find((w) => w.id === credit.depositWalletId);
    if (existingW?.isPassThroughAccount) return 'third_party_direct';
    return 'personal_wallet';
  });

  const [walletId, setWalletId] = useState<string>(defaultVesWallet?.id || '');
  const [thirdPartyWalletId, setThirdPartyWalletId] = useState<string>(() => {
    const existingW = data.wallets.find((w) => w.id === credit.depositWalletId);
    if (existingW?.isPassThroughAccount) return existingW.id;
    return passThroughWallets[0]?.id || '';
  });
  const [thirdPartyRecipientName, setThirdPartyRecipientName] =
    useState<string>(credit.thirdPartyRecipientName || '');

  const [depositCurrency, setDepositCurrency] = useState<CurrencyCode>(
    credit.depositCurrency || defaultVesWallet?.currency || 'VES'
  );
  const [rateInput, setRateInput] = useState<string>(() =>
    credit.depositExchangeRate && credit.depositExchangeRate > 0
      ? String(credit.depositExchangeRate)
      : activeRate && activeRate > 0
        ? String(activeRate)
        : credit.exchangeRate && credit.exchangeRate > 0
          ? String(credit.exchangeRate)
          : '450'
  );
  const [bankFeePctInput, setBankFeePctInput] = useState<string>(() =>
    credit.depositBankFeePercent !== undefined && credit.depositBankFeePercent !== null
      ? String(credit.depositBankFeePercent)
      : '0.5'
  );
  const [netManualInput, setNetManualInput] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(credit.requestDate);

  const selectedWallet =
    destinationMode === 'third_party_direct'
      ? passThroughWallets.find((w) => w.id === thirdPartyWalletId)
      : personalWallets.find((w) => w.id === walletId) ||
        activeWallets.find((w) => w.id === walletId);

  const effectiveCurrency: CurrencyCode =
    selectedWallet?.currency || depositCurrency || 'VES';
  const parsedRate =
    Number(rateInput) > 0 ? Number(rateInput) : activeRate || 450;

  const grossNominal =
    effectiveCurrency === 'VES'
      ? credit.currency === 'VES'
        ? credit.requestedAmount
        : Number((credit.requestedAmountUsd * parsedRate).toFixed(2))
      : credit.requestedAmountUsd;

  const parsedFeePct = Math.max(0, Number(bankFeePctInput) || 0);
  const autoNetNominal = Number(
    (grossNominal * (1 - parsedFeePct / 100)).toFixed(2)
  );
  const hasManualNet =
    netManualInput.trim() !== '' && Number(netManualInput) > 0;
  const nominalToCredit = hasManualNet
    ? Number(Number(netManualInput).toFixed(2))
    : autoNetNominal;
  const feeAmountNominal = Math.max(
    0,
    Number((grossNominal - nominalToCredit).toFixed(2))
  );
  const effectiveFeePct =
    grossNominal > 0
      ? Number(((feeAmountNominal / grossNominal) * 100).toFixed(2))
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveWalletId =
      destinationMode === 'personal_wallet'
        ? walletId
        : destinationMode === 'third_party_direct'
          ? thirdPartyWalletId || null
          : null;

    onConfirm({
      appCreditId: credit.id,
      depositDestinationMode: destinationMode,
      walletId: effectiveWalletId,
      walletIsPassThrough: destinationMode === 'third_party_direct',
      thirdPartyRecipientName:
        destinationMode === 'third_party_direct'
          ? thirdPartyRecipientName.trim() ||
            selectedWallet?.beneficiaryName ||
            selectedWallet?.name ||
            'Amigo / Tercero'
          : null,
      depositCurrency: effectiveCurrency,
      exchangeRate: effectiveCurrency === 'VES' ? parsedRate : null,
      bankFeePercent: parsedFeePct,
      netAmountManual: hasManualNet ? nominalToCredit : null,
      depositDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabecera con icono contextual */}
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--surface-subtle)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)] border border-[var(--pink-primary)]/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                ¿A dónde fue este préstamo?
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {credit.appName} · Préstamo de {formatearMonto(credit.requestedAmountUsd, 'USD', locale)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Selector de modo en el modal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setDestinationMode('personal_wallet')}
              className={`text-left rounded-xl p-2.5 border text-xs transition ${
                destinationMode === 'personal_wallet'
                  ? 'border-[var(--pink-primary)] bg-[var(--pink-light)]/40 font-bold text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              🏦 A mi cuenta personal
            </button>
            <button
              type="button"
              onClick={() => setDestinationMode('third_party_direct')}
              className={`text-left rounded-xl p-2.5 border text-xs transition ${
                destinationMode === 'third_party_direct'
                  ? 'border-violet-500 bg-violet-500/15 font-bold text-violet-300'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              🤝 Directo a Tercero / Amigo
            </button>
            <button
              type="button"
              onClick={() => setDestinationMode('none')}
              className={`text-left rounded-xl p-2.5 border text-xs transition ${
                destinationMode === 'none'
                  ? 'border-[var(--pink-primary)] bg-[var(--pink-light)]/40 font-bold text-[var(--text-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              📋 Sin abonar a cuenta
            </button>
          </div>

          {destinationMode === 'third_party_direct' && (
            <div className="space-y-3.5">
              <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-3.5 text-xs text-[var(--text-primary)]">
                <strong className="text-violet-300 block mb-0.5">
                  🛡️ No pasó por tus cuentas personales
                </strong>
                Si ya se había sumado como ingreso en una cuenta tuya por error, al guardar se quitará ese ingreso y quedará marcado como dinero pasado directo a esta persona.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Nombre del amigo / tercero que recibió los{' '}
                  {formatearMonto(credit.requestedAmountUsd, 'USD', locale)} *
                </label>
                <input
                  type="text"
                  required
                  value={thirdPartyRecipientName}
                  onChange={(e) => setThirdPartyRecipientName(e.target.value)}
                  placeholder="Ej: Carlos, Amigo, Cuenta externa..."
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Cuenta de Terceros opcional (en Wallets)
                </label>
                <select
                  value={thirdPartyWalletId}
                  onChange={(e) => setThirdPartyWalletId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
                >
                  <option value="">
                    No asociar a ninguna cuenta en Wallets (Sin historial en cuentas)
                  </option>
                  {passThroughWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      🤝 {w.name} ({w.currency}) — Cuenta de Terceros
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {destinationMode === 'none' && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 text-xs text-[var(--text-secondary)]">
              El préstamo quedará únicamente con su cronograma de cuotas, sin sumar ningún ingreso en tus cuentas personales.
            </div>
          )}

          {destinationMode === 'personal_wallet' && (
            <div className="space-y-3.5">
              {/* 1. Fecha de recepción + Cuenta personal (Antes del monto y tasa) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Fecha de recepción *
                  </label>
                  <input
                    type="date"
                    required
                    value={depositDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setDepositDate(nextDate);
                      const lookup = obtenerTasaPorFecha(
                        nextDate,
                        data.rateHistory,
                        activeRate || data.settings.defaultExchangeRate,
                        data.transactions
                      );
                      if (lookup.rate && lookup.rate > 0) {
                        setRateInput(String(Number(lookup.rate.toFixed(2))));
                      }
                    }}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Cuenta donde recibes *
                  </label>
                  <select
                    value={walletId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setWalletId(nextId);
                      const w = personalWallets.find((item) => item.id === nextId);
                      if (w?.currency) {
                        setDepositCurrency(w.currency);
                      }
                    }}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--pink-primary)]"
                  >
                    {personalWallets.map((w) => {
                      const ws = walletSummaries.billeteras.find(
                        (s) => s.wallet.id === w.id
                      );
                      const balText = ws
                        ? w.currency === 'VES'
                          ? formatearMonto(ws.saldoActualVes, 'VES', locale)
                          : formatearMonto(ws.saldoActualUsd, 'USD', locale)
                        : '';
                      return (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.currency === 'VES' ? 'Bs' : 'USD'})
                          {balText ? ` — ${balText}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* 2. Tarjeta de Tasa, Comisión y Monto Neto a Acreditar */}
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Tasa BCV (Bs/$)
                      </label>
                      {activeRate && activeRate > 0 && (
                        <button
                          type="button"
                          onClick={() => setRateInput(String(activeRate))}
                          className="text-[10px] font-bold text-[var(--pink-primary)] hover:underline"
                        >
                          BCV ({formatearTasa(activeRate, locale)})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-mono-tabular font-bold text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        % Comisión retiro
                      </label>
                      <div className="flex items-center gap-1">
                        {['0', '0.5', '1'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setBankFeePctInput(preset);
                              setNetManualInput('');
                            }}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                              bankFeePctInput === preset && !hasManualNet
                                ? 'bg-[var(--pink-primary)] text-white'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                            }`}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={bankFeePctInput}
                      onChange={(e) => {
                        setBankFeePctInput(e.target.value);
                        setNetManualInput('');
                      }}
                      placeholder="Ej: 0.5"
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-mono-tabular font-bold text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Monto exacto (opc.)
                      </label>
                      {hasManualNet && (
                        <button
                          type="button"
                          onClick={() => setNetManualInput('')}
                          className="text-[10px] font-bold text-[var(--pink-primary)] hover:underline"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={netManualInput}
                      onChange={(e) => setNetManualInput(e.target.value)}
                      placeholder={`Auto: ${autoNetNominal.toFixed(2)}`}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-mono-tabular font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Resumen neto en vivo */}
                <div className="rounded-xl bg-[var(--income-bg)] border border-emerald-500/30 p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--income-color)] block">
                      Monto Neto a sumar en {selectedWallet?.name || 'tu cuenta'}:
                    </span>
                    {feeAmountNominal > 0 && (
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono-tabular">
                        Bruto: {formatearMonto(grossNominal, effectiveCurrency, locale)} − Com. ({effectiveFeePct}%): {formatearMonto(feeAmountNominal, effectiveCurrency, locale)}
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-bold font-mono-tabular text-[var(--income-color)]">
                    + {formatearMonto(nominalToCredit, effectiveCurrency, locale)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-[var(--border-input)] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors shadow-sm"
            >
              {destinationMode === 'third_party_direct'
                ? 'Guardar como Pasado a Tercero'
                : destinationMode === 'none'
                  ? 'Guardar sin abonar'
                  : `Abonar ${formatearMonto(nominalToCredit, effectiveCurrency, locale)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


