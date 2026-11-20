import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileJson,
  Filter,
  Heart,
  HeartHandshake,
  Link2,
  PiggyBank,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Category,
  CurrencyCode,
  SharedCoupleGoal,
  SharedExpense,
  SharedMonthlyContribution,
  SharedPayer,
  SharedSavingContribution,
  SharedSplitType,
  Transaction,
  WalletAccount,
} from '../types/finance';
import {
  formatearMonto,
  formatearPorcentaje,
  formatearTasa,
} from '../services/bcvApi';
import {
  calcularEquivalenteUsd,
  formatearNombreMes,
  obtenerFechaLocalIso,
} from '../utils/calculations';
import {
  calcularBalanceGastosCompartidos,
  calcularResumenAhorrosYMetasPareja,
  cargarAhorrosConjuntos,
  cargarAportesMensualesPareja,
  cargarGastosCompartidos,
  cargarMetasEnPareja,
  cargarNombrePareja,
  generarJsonGastosPagadosPorPareja,
  guardarAhorrosConjuntos,
  guardarAportesMensualesPareja,
  guardarGastosCompartidos,
  guardarMetasEnPareja,
  guardarNombrePareja,
} from '../utils/coupleStorage';

interface CoupleFinanceViewProps {
  userName: string;
  categories: Category[];
  wallets: WalletAccount[];
  officialRate: number | null;
  defaultManualRate: number | null;
  preferManualByDefault: boolean;
  locale: 'es-VE' | 'en-US';
  onBridgePersonalExpense: (txn: Transaction, walletName: string) => void;
  onRemoveLinkedPersonalTransaction: (txnId: string) => void;
  onOpenImportSharedModal: () => void;
  showToast: (text: string, kind?: 'success' | 'error' | 'info') => void;
}

type CoupleSubTab = 'all' | 'expenses' | 'savings' | 'goals' | 'contributions';

export const CoupleFinanceView: React.FC<CoupleFinanceViewProps> = ({
  userName,
  categories,
  wallets,
  officialRate,
  defaultManualRate,
  preferManualByDefault,
  locale,
  onBridgePersonalExpense,
  onRemoveLinkedPersonalTransaction,
  onOpenImportSharedModal,
  showToast,
}) => {
  // ==========================================================================
  // 1. ESTADOS PERSISTENTES EN LOCALSTORAGE (Claves independientes del Hub)
  // shared_expenses, shared_savings, shared_goals, shared_contributions
  // ==========================================================================
  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>(() =>
    cargarGastosCompartidos()
  );
  const [sharedSavings, setSharedSavings] = useState<
    SharedSavingContribution[]
  >(() => cargarAhorrosConjuntos());
  const [sharedGoals, setSharedGoals] = useState<SharedCoupleGoal[]>(() =>
    cargarMetasEnPareja()
  );
  const [sharedContributions, setSharedContributions] = useState<
    SharedMonthlyContribution[]
  >(() => cargarAportesMensualesPareja());
  const [partnerName, setPartnerName] = useState<string>(() =>
    cargarNombrePareja()
  );
  const [editingPartnerName, setEditingPartnerName] = useState(false);

  // Sincronización automática con las 4 claves de localStorage solicitadas
  useEffect(() => {
    guardarGastosCompartidos(sharedExpenses);
  }, [sharedExpenses]);

  useEffect(() => {
    guardarAhorrosConjuntos(sharedSavings);
  }, [sharedSavings]);

  useEffect(() => {
    guardarMetasEnPareja(sharedGoals);
  }, [sharedGoals]);

  useEffect(() => {
    guardarAportesMensualesPareja(sharedContributions);
  }, [sharedContributions]);

  const activeRate =
    (preferManualByDefault && defaultManualRate) ||
    officialRate ||
    defaultManualRate ||
    null;

  const activeWallets = useMemo(
    () => wallets.filter((w) => w.active),
    [wallets]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' && c.active),
    [categories]
  );

  const todayIso = obtenerFechaLocalIso();
  const currentMonthKey = todayIso.slice(0, 7);

  // Sub-navegación del Hub de Pareja
  const [activeTab, setActiveTab] = useState<CoupleSubTab>('all');

  // ==========================================================================
  // 2. CÁLCULOS DINÁMICOS DEL HUB DE PAREJA
  // ==========================================================================
  const balanceResumen = useMemo(
    () => calcularBalanceGastosCompartidos(sharedExpenses),
    [sharedExpenses]
  );

  const ahorrosYMetasResumen = useMemo(
    () => calcularResumenAhorrosYMetasPareja(sharedSavings, sharedGoals),
    [sharedSavings, sharedGoals]
  );

  // ==========================================================================
  // 3. ESTADO DEL FORMULARIO: GASTOS COMPARTIDOS (Con El Puente Personal)
  // ==========================================================================
  const [expConcept, setExpConcept] = useState('');
  const [expAmountStr, setExpAmountStr] = useState('');
  const [expCurrency, setExpCurrency] = useState<CurrencyCode>('USD');
  const [expRateStr, setExpRateStr] = useState<string>(() =>
    activeRate ? String(activeRate) : ''
  );
  const [expDate, setExpDate] = useState(todayIso);
  const [expCategoryId, setExpCategoryId] = useState<string>(
    expenseCategories[0]?.id || 'cat_exp_food'
  );
  const [expPayer, setExpPayer] = useState<SharedPayer>('me');
  const [expWalletId, setExpWalletId] = useState<string>(
    activeWallets[0]?.id || wallets[0]?.id || 'wallet_zelle'
  );
  const [expSplitType, setExpSplitType] = useState<SharedSplitType>('50_50');
  const [expCustomMyPct, setExpCustomMyPct] = useState<string>('50');
  const [expNotes, setExpNotes] = useState('');

  // Filtros de tabla de gastos compartidos
  const [expFilterPayer, setExpFilterPayer] = useState<'all' | SharedPayer>(
    'all'
  );
  const [expFilterSettled, setExpFilterSettled] = useState<
    'all' | 'pending' | 'settled'
  >('all');
  const [expSearch, setExpSearch] = useState('');

  useEffect(() => {
    if (!expRateStr && activeRate) {
      setExpRateStr(String(activeRate));
    }
  }, [activeRate, expRateStr]);

  // ==========================================================================
  // 4. ESTADO DEL FORMULARIO: AHORROS CONJUNTOS (Exclusivamente en USD)
  // ==========================================================================
  const [savContributor, setSavContributor] = useState<SharedPayer>('me');
  const [savAmountUsdStr, setSavAmountUsdStr] = useState('');
  const [savDate, setSavDate] = useState(todayIso);
  const [savDescription, setSavDescription] = useState('');
  const [savGoalId, setSavGoalId] = useState<string>('');
  const [savDeductPersonalWallet, setSavDeductPersonalWallet] =
    useState<boolean>(false);
  const [savWalletId, setSavWalletId] = useState<string>(
    activeWallets[0]?.id || wallets[0]?.id || 'wallet_zelle'
  );

  // ==========================================================================
  // 5. ESTADO DEL FORMULARIO: METAS EN PAREJA
  // ==========================================================================
  const [goalName, setGoalName] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalTargetUsdStr, setGoalTargetUsdStr] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalColor, setGoalColor] = useState('#8A79A6');
  const [goalIsPrimary, setGoalIsPrimary] = useState(true);

  // ==========================================================================
  // 6. ESTADO DEL FORMULARIO: APORTES MENSUALES (Fondo Común)
  // ==========================================================================
  const [contribMonthKey, setContribMonthKey] =
    useState<string>(currentMonthKey);
  const [contribTitle, setContribTitle] = useState<string>(
    `Fondo Común ${formatearNombreMes(currentMonthKey)}`
  );
  const [contribMyQuotaStr, setContribMyQuotaStr] = useState<string>('150');
  const [contribPartnerQuotaStr, setContribPartnerQuotaStr] =
    useState<string>('150');
  const [contribAutoAddToSavings, setContribAutoAddToSavings] =
    useState<boolean>(true);

  // Actualizar título sugerido cuando cambia el mes de aporte
  const handleMonthKeyChange = (nextMonth: string) => {
    setContribMonthKey(nextMonth);
    setContribTitle(`Fondo Común ${formatearNombreMes(nextMonth)}`);
  };

  // ==========================================================================
  // HANDLERS: GASTOS COMPARTIDOS + EL PUENTE CON FINANZAS PERSONALES
  // ==========================================================================
  const handleAddSharedExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = Number(expAmountStr.replace(',', '.'));
    if (!expConcept.trim() || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      showToast(
        'Ingresa un concepto y un monto válido mayor que cero.',
        'error'
      );
      return;
    }

    const parsedRate =
      Number(expRateStr.replace(',', '.')) || activeRate || 0;
    const rate = expCurrency === 'VES' ? parsedRate : null;

    if (expCurrency === 'VES' && (!rate || rate <= 0)) {
      showToast(
        'Indica una tasa de cambio válida para convertir Bolívares a USD.',
        'error'
      );
      return;
    }

    const amountUsd =
      expCurrency === 'USD'
        ? rawAmount
        : calcularEquivalenteUsd(rawAmount, 'VES', rate);

    let mySharePct = 50;
    let partnerSharePct = 50;
    if (expSplitType === '50_50') {
      mySharePct = 50;
      partnerSharePct = 50;
    } else if (expSplitType === '100_other') {
      // El 100% le corresponde asumirlo al otro
      mySharePct = expPayer === 'me' ? 0 : 100;
      partnerSharePct = expPayer === 'me' ? 100 : 0;
    } else {
      const custom = Math.min(
        100,
        Math.max(0, Number(expCustomMyPct.replace(',', '.')) || 50)
      );
      mySharePct = custom;
      partnerSharePct = Number((100 - custom).toFixed(2));
    }

    const selectedCat = expenseCategories.find((c) => c.id === expCategoryId);
    const selectedWallet = wallets.find((w) => w.id === expWalletId);

    const uniqueSharedId = `sh_exp_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const linkedPersonalTxnId =
      expPayer === 'me' ? `txn_bridge_${uniqueSharedId}` : null;

    const newSharedExpense: SharedExpense = {
      id: uniqueSharedExpenseId(uniqueSharedId),
      date: expDate || todayIso,
      concept: expConcept.trim(),
      categoryId: selectedCat ? selectedCat.id : 'cat_exp_other',
      categoryName: selectedCat ? selectedCat.name : 'Gasto Compartido',
      amount: rawAmount,
      currency: expCurrency,
      exchangeRate: rate,
      amountUsd,
      exchangeRateSource:
        expCurrency === 'USD'
          ? 'none'
          : officialRate && Math.abs((rate || 0) - officialRate) < 0.01
            ? 'bcv'
            : 'manual',
      payer: expPayer,
      splitType: expSplitType,
      mySharePct,
      partnerSharePct,
      walletId: expPayer === 'me' ? expWalletId : undefined,
      linkedPersonalTransactionId: linkedPersonalTxnId,
      settled: false,
      notes: expNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    setSharedExpenses((prev) => [newSharedExpense, ...prev]);

    // EL PUENTE CON EL BALANCE PERSONAL:
    // Si el pagador fue 'Yo' ('me'), creamos automáticamente el egreso en Finanzas Personales
    // restando de la billetera seleccionada y afectando el Balance General.
    // Si el pagador fue 'Pareja' ('partner'), NO afecta el saldo personal.
    if (expPayer === 'me' && linkedPersonalTxnId) {
      const personalExpense: Transaction = {
        id: linkedPersonalTxnId,
        sharedExpenseId: newSharedExpense.id,
        date: newSharedExpense.date,
        type: 'expense',
        status: 'completed',
        walletId: expWalletId,
        description: `[En Pareja] ${newSharedExpense.concept}`,
        categoryId: newSharedExpense.categoryId,
        amount: newSharedExpense.amount,
        currency: newSharedExpense.currency,
        exchangeRate: newSharedExpense.exchangeRate,
        amountUsd: newSharedExpense.amountUsd,
        exchangeRateSource: newSharedExpense.exchangeRateSource,
        paymentMethod: selectedWallet?.name || 'Billetera personal',
        expenseType: 'variable',
        notes: `Puente automático desde Finanzas en Pareja (Pagado por mí · ${partnerName} asume ${partnerSharePct}%)${
          expNotes.trim() ? ` · ${expNotes.trim()}` : ''
        }`,
        createdAt: new Date().toISOString(),
      };
      onBridgePersonalExpense(
        personalExpense,
        selectedWallet?.name || 'tu billetera'
      );
    } else {
      showToast(
        `Gasto pagado por ${partnerName} registrado en el Hub de Pareja (Sin afectar tu saldo personal).`,
        'info'
      );
    }

    setExpConcept('');
    setExpAmountStr('');
    setExpNotes('');
  };

  function uniqueSharedExpenseId(val: string) {
    return val;
  }

  const handleToggleSettledExpense = (id: string) => {
    setSharedExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, settled: !e.settled } : e))
    );
  };

  const handleSettleAllExpenses = () => {
    if (balanceResumen.gastosActivosCount === 0) return;
    setSharedExpenses((prev) => prev.map((e) => ({ ...e, settled: true })));
    showToast(
      '¡Cuentas saldadas! Todos los gastos compartidos pendientes se marcaron como liquidados.',
      'success'
    );
  };

  const handleDeleteSharedExpense = (exp: SharedExpense) => {
    setSharedExpenses((prev) => prev.filter((e) => e.id !== exp.id));
    if (exp.linkedPersonalTransactionId) {
      onRemoveLinkedPersonalTransaction(exp.linkedPersonalTransactionId);
    }
    showToast(
      exp.linkedPersonalTransactionId
        ? 'Gasto compartido eliminado y egreso revertido de tu billetera personal.'
        : 'Gasto compartido eliminado del Hub de Pareja.',
      'info'
    );
  };

  // ==========================================================================
  // HANDLER: EXPORTACIÓN JSON DE GASTOS PAGADOS POR LA PAREJA (Admin)
  // ==========================================================================
  const handleExportPartnerExpensesJson = () => {
    const partnerExpenses = sharedExpenses.filter((e) => e.payer === 'partner');
    if (partnerExpenses.length === 0) {
      showToast(
        `Aún no hay gastos registrados con "${partnerName}" como pagador para exportar.`,
        'error'
      );
      return;
    }

    try {
      const jsonStr = generarJsonGastosPagadosPorPareja(
        sharedExpenses,
        userName || 'Mis Finanzas'
      );
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gastos-compartidos-${partnerName
        .toLowerCase()
        .replace(/\s+/g, '-')}-${todayIso}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        `Archivo JSON exportado con ${partnerExpenses.length} gasto(s) pagados por ${partnerName}. Listo para importar en su cuenta.`,
        'success'
      );
    } catch {
      showToast('No se pudo generar el archivo JSON de exportación.', 'error');
    }
  };

  // ==========================================================================
  // HANDLERS: AHORROS CONJUNTOS (Exclusivamente en USD)
  // ==========================================================================
  const handleAddSharedSaving = (e: React.FormEvent) => {
    e.preventDefault();
    const amountUsd = Number(savAmountUsdStr.replace(',', '.'));
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      showToast(
        'Ingresa un monto en USD mayor que cero para el Fondo Conjunto.',
        'error'
      );
      return;
    }

    const savId = `sh_sav_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const shouldDeduct = savContributor === 'me' && savDeductPersonalWallet;
    const linkedTxnId = shouldDeduct ? `txn_sav_bridge_${savId}` : null;
    const selectedGoal = sharedGoals.find((g) => g.id === savGoalId);
    const selectedWallet = wallets.find((w) => w.id === savWalletId);

    const newContribution: SharedSavingContribution = {
      id: savId,
      date: savDate || todayIso,
      contributor: savContributor,
      amountUsd,
      description:
        savDescription.trim() ||
        (selectedGoal
          ? `Aporte para meta: ${selectedGoal.name}`
          : 'Aporte al Fondo de Ahorro Conjunto'),
      goalId: savGoalId || null,
      walletId: shouldDeduct ? savWalletId : undefined,
      linkedPersonalTransactionId: linkedTxnId,
      createdAt: new Date().toISOString(),
    };

    setSharedSavings((prev) => [newContribution, ...prev]);

    if (shouldDeduct && linkedTxnId) {
      const personalExpense: Transaction = {
        id: linkedTxnId,
        sharedExpenseId: savId,
        date: newContribution.date,
        type: 'expense',
        status: 'completed',
        walletId: savWalletId,
        description: `[Ahorro en Pareja] ${newContribution.description}`,
        categoryId: 'cat_exp_other',
        amount: amountUsd,
        currency: 'USD',
        exchangeRate: null,
        amountUsd,
        exchangeRateSource: 'none',
        paymentMethod: selectedWallet?.name || 'Billetera personal',
        expenseType: 'fixed',
        notes: 'Traslado de fondos desde mi billetera al Fondo de Ahorros Conjuntos en USD',
        createdAt: new Date().toISOString(),
      };
      onBridgePersonalExpense(
        personalExpense,
        selectedWallet?.name || 'tu billetera'
      );
    } else {
      showToast(
        `Aporte de ${formatearMonto(amountUsd, 'USD', locale)} (${
          savContributor === 'me' ? 'Yo' : partnerName
        }) sumado a Ahorros Conjuntos.`,
        'success'
      );
    }

    setSavAmountUsdStr('');
    setSavDescription('');
  };

  const handleDeleteSharedSaving = (sav: SharedSavingContribution) => {
    setSharedSavings((prev) => prev.filter((s) => s.id !== sav.id));
    if (sav.linkedPersonalTransactionId) {
      onRemoveLinkedPersonalTransaction(sav.linkedPersonalTransactionId);
    }
    showToast('Aporte eliminado del Fondo de Ahorros Conjuntos.', 'info');
  };

  // ==========================================================================
  // HANDLERS: METAS EN PAREJA
  // ==========================================================================
  const handleAddSharedGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const targetUsd = Number(goalTargetUsdStr.replace(',', '.'));
    if (!goalName.trim() || !Number.isFinite(targetUsd) || targetUsd <= 0) {
      showToast(
        'Indica el nombre de la meta en pareja y un monto objetivo en USD mayor que cero.',
        'error'
      );
      return;
    }

    const newGoal: SharedCoupleGoal = {
      id: `sh_goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: goalName.trim(),
      description: goalDescription.trim(),
      targetAmountUsd: targetUsd,
      targetDate: goalTargetDate || null,
      isPrimary: goalIsPrimary || sharedGoals.length === 0,
      color: goalColor,
      status: 'active',
      createdAt: todayIso,
    };

    setSharedGoals((prev) => {
      const updated = newGoal.isPrimary
        ? prev.map((g) => ({ ...g, isPrimary: false }))
        : prev;
      return [newGoal, ...updated];
    });

    setGoalName('');
    setGoalDescription('');
    setGoalTargetUsdStr('');
    setGoalTargetDate('');
    showToast(`Meta en pareja "${newGoal.name}" creada con éxito.`, 'success');
  };

  const handleSetPrimaryGoal = (goalId: string) => {
    setSharedGoals((prev) =>
      prev.map((g) => ({
        ...g,
        isPrimary: g.id === goalId,
      }))
    );
    showToast('Meta principal actualizada en el Resumen Rápido.', 'info');
  };

  const handleDeleteGoal = (goalId: string) => {
    setSharedGoals((prev) => prev.filter((g) => g.id !== goalId));
    showToast('Meta en pareja eliminada.', 'info');
  };

  // ==========================================================================
  // HANDLERS: APORTES MENSUALES (Control de Cuotas + Marca de Completado)
  // ==========================================================================
  const handleAddMonthlyContribution = (e: React.FormEvent) => {
    e.preventDefault();
    const myQuota = Number(contribMyQuotaStr.replace(',', '.'));
    const partnerQuota = Number(contribPartnerQuotaStr.replace(',', '.'));

    if (
      !contribTitle.trim() ||
      !Number.isFinite(myQuota) ||
      myQuota < 0 ||
      !Number.isFinite(partnerQuota) ||
      partnerQuota < 0 ||
      myQuota + partnerQuota <= 0
    ) {
      showToast(
        'Ingresa un título y montos de cuota mensual válidos en USD.',
        'error'
      );
      return;
    }

    const newContrib: SharedMonthlyContribution = {
      id: `sh_contrib_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      monthKey: contribMonthKey || currentMonthKey,
      title: contribTitle.trim(),
      myQuotaUsd: myQuota,
      partnerQuotaUsd: partnerQuota,
      myCompleted: false,
      partnerCompleted: false,
      myCompletedAt: null,
      partnerCompletedAt: null,
      linkedMySavingId: null,
      linkedPartnerSavingId: null,
    };

    setSharedContributions((prev) => [newContrib, ...prev]);
    showToast(
      `Control de cuota mensual "${newContrib.title}" creado.`,
      'success'
    );
  };

  const handleToggleQuotaCompleted = (
    contrib: SharedMonthlyContribution,
    who: SharedPayer
  ) => {
    const isMe = who === 'me';
    const currentlyCompleted = isMe
      ? contrib.myCompleted
      : contrib.partnerCompleted;
    const nextCompleted = !currentlyCompleted;
    const quotaUsd = isMe ? contrib.myQuotaUsd : contrib.partnerQuotaUsd;

    if (nextCompleted && contribAutoAddToSavings && quotaUsd > 0) {
      // Crear aporte automático en Ahorros Conjuntos (USD)
      const linkedSavingId = `sh_sav_quota_${contrib.id}_${who}_${Date.now()}`;
      const primaryGoal = ahorrosYMetasResumen.metaPrincipal;
      const newSav: SharedSavingContribution = {
        id: linkedSavingId,
        date: todayIso,
        contributor: who,
        amountUsd: quotaUsd,
        description: `Cuota mensual completada: ${contrib.title} (${
          isMe ? 'Mi aporte' : `Aporte de ${partnerName}`
        })`,
        goalId: primaryGoal ? primaryGoal.id : null,
        createdAt: new Date().toISOString(),
      };
      setSharedSavings((prev) => [newSav, ...prev]);
      setSharedContributions((prev) =>
        prev.map((c) =>
          c.id === contrib.id
            ? isMe
              ? {
                  ...c,
                  myCompleted: true,
                  myCompletedAt: todayIso,
                  linkedMySavingId: linkedSavingId,
                }
              : {
                  ...c,
                  partnerCompleted: true,
                  partnerCompletedAt: todayIso,
                  linkedPartnerSavingId: linkedSavingId,
                }
            : c
        )
      );
      showToast(
        `¡Cuota de ${
          isMe ? 'Yo' : partnerName
        } marcada como Completada y sumada al Fondo de Ahorros Conjuntos (+${formatearMonto(
          quotaUsd,
          'USD',
          locale
        )})!`,
        'success'
      );
    } else {
      // Si se desmarca y tenía un ahorro vinculado, lo removemos para mantener consistencia
      const linkedIdToRemove = isMe
        ? contrib.linkedMySavingId
        : contrib.linkedPartnerSavingId;
      if (!nextCompleted && linkedIdToRemove) {
        setSharedSavings((prev) =>
          prev.filter((s) => s.id !== linkedIdToRemove)
        );
      }
      setSharedContributions((prev) =>
        prev.map((c) =>
          c.id === contrib.id
            ? isMe
              ? {
                  ...c,
                  myCompleted: nextCompleted,
                  myCompletedAt: nextCompleted ? todayIso : null,
                  linkedMySavingId: null,
                }
              : {
                  ...c,
                  partnerCompleted: nextCompleted,
                  partnerCompletedAt: nextCompleted ? todayIso : null,
                  linkedPartnerSavingId: null,
                }
            : c
        )
      );
      showToast(
        nextCompleted
          ? `Cuota de ${isMe ? 'Yo' : partnerName} marcada como Completada.`
          : `Cuota de ${isMe ? 'Yo' : partnerName} marcada como Pendiente.`,
        'info'
      );
    }
  };

  const handleDeleteContribution = (id: string) => {
    setSharedContributions((prev) => prev.filter((c) => c.id !== id));
    showToast('Registro de cuota mensual eliminado.', 'info');
  };

  // ==========================================================================
  // DATOS DEMOSTRATIVOS DEL HUB DE PAREJA
  // ==========================================================================
  const handleLoadCoupleDemo = () => {
    const rate = activeRate || 450;
    const goal1Id = 'sh_goal_demo_1';
    const goal2Id = 'sh_goal_demo_2';

    const demoGoals: SharedCoupleGoal[] = [
      {
        id: goal1Id,
        name: 'Viaje de Aniversario a Margarita / Caribe',
        description:
          'Boletos, hospedaje frente al mar y fondo de experiencias juntos.',
        targetAmountUsd: 1200,
        targetDate: `${new Date().getFullYear()}-12-20`,
        isPrimary: true,
        color: '#8A79A6',
        status: 'active',
        createdAt: todayIso,
      },
      {
        id: goal2Id,
        name: 'Fondo de Emergencia del Hogar',
        description:
          'Respaldo en dólares para imprevistos médicos o del apartamento.',
        targetAmountUsd: 2500,
        targetDate: `${new Date().getFullYear() + 1}-06-30`,
        isPrimary: false,
        color: '#C86D85',
        status: 'active',
        createdAt: todayIso,
      },
    ];

    const demoSavings: SharedSavingContribution[] = [
      {
        id: 'sh_sav_demo_1',
        date: todayIso,
        contributor: 'me',
        amountUsd: 350,
        description: 'Mi aporte inicial al fondo común',
        goalId: goal1Id,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sh_sav_demo_2',
        date: todayIso,
        contributor: 'partner',
        amountUsd: 300,
        description: `Aporte de ${partnerName} para el viaje`,
        goalId: goal1Id,
        createdAt: new Date().toISOString(),
      },
    ];

    const demoExpenses: SharedExpense[] = [
      {
        id: 'sh_exp_demo_1',
        date: todayIso,
        concept: 'Compra quincenal de supermercado y hogar',
        categoryId: 'cat_exp_food',
        categoryName: 'Alimentación y mercado',
        amount: 140,
        currency: 'USD',
        exchangeRate: null,
        amountUsd: 140,
        exchangeRateSource: 'none',
        payer: 'me',
        splitType: '50_50',
        mySharePct: 50,
        partnerSharePct: 50,
        settled: false,
        notes: 'Pagado con Zelle en el supermercado',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sh_exp_demo_2',
        date: todayIso,
        concept: 'Cena especial de fin de semana',
        categoryId: 'cat_exp_entertainment',
        categoryName: 'Entretenimiento y salidas',
        amount: Number((55 * rate).toFixed(2)),
        currency: 'VES',
        exchangeRate: rate,
        amountUsd: 55,
        exchangeRateSource: 'bcv',
        payer: 'partner',
        splitType: '50_50',
        mySharePct: 50,
        partnerSharePct: 50,
        settled: false,
        notes: `Pagado por ${partnerName} con Pago Móvil`,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sh_exp_demo_3',
        date: todayIso,
        concept: 'Servicio de Internet Fibra Óptica mensual',
        categoryId: 'cat_exp_services',
        categoryName: 'Servicios y facturas',
        amount: 40,
        currency: 'USD',
        exchangeRate: null,
        amountUsd: 40,
        exchangeRateSource: 'none',
        payer: 'partner',
        splitType: '50_50',
        mySharePct: 50,
        partnerSharePct: 50,
        settled: false,
        notes: 'Mensualidad fibra hogar',
        createdAt: new Date().toISOString(),
      },
    ];

    const demoContributions: SharedMonthlyContribution[] = [
      {
        id: 'sh_contrib_demo_1',
        monthKey: currentMonthKey,
        title: `Fondo Común ${formatearNombreMes(currentMonthKey)}`,
        myQuotaUsd: 150,
        partnerQuotaUsd: 150,
        myCompleted: true,
        partnerCompleted: false,
        myCompletedAt: todayIso,
        partnerCompletedAt: null,
      },
    ];

    setSharedGoals(demoGoals);
    setSharedSavings(demoSavings);
    setSharedExpenses(demoExpenses);
    setSharedContributions(demoContributions);
    showToast(
      'Datos demostrativos de Finanzas en Pareja cargados correctamente.',
      'success'
    );
  };

  // Filtrado de Gastos Compartidos
  const filteredExpenses = useMemo(() => {
    const q = expSearch.trim().toLowerCase();
    return sharedExpenses.filter((e) => {
      if (expFilterPayer !== 'all' && e.payer !== expFilterPayer) return false;
      if (expFilterSettled === 'pending' && e.settled) return false;
      if (expFilterSettled === 'settled' && !e.settled) return false;
      if (q) {
        const matchConcept = e.concept.toLowerCase().includes(q);
        const matchCat = e.categoryName.toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchConcept && !matchCat && !matchNotes) return false;
      }
      return true;
    });
  }, [sharedExpenses, expFilterPayer, expFilterSettled, expSearch]);

  const previewAmountNum = Number(expAmountStr.replace(',', '.')) || 0;
  const previewRateNum =
    Number(expRateStr.replace(',', '.')) || activeRate || 0;
  const previewUsdEquivalent =
    expCurrency === 'USD'
      ? previewAmountNum
      : previewRateNum > 0
        ? previewAmountNum / previewRateNum
        : 0;

  return (
    <div className="space-y-8">
      {/* =================================================================== */}
      {/* CABECERA CON IDENTIDAD VISUAL DISTINTIVA (HUB DE PAREJA)            */}
      {/* =================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--lavender-accent)]/35 bg-gradient-to-br from-[var(--lavender-soft)]/80 via-[var(--surface)] to-[var(--pink-light)]/70 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[var(--lavender-accent)] text-white shadow-xs">
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Hub de Finanzas en Pareja</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--surface)]/90 text-[var(--lavender-text)] border border-[var(--border-hairline)]">
                <Link2 className="w-3 h-3 text-[var(--pink-primary)]" />
                <span>Puente Contable Activo</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-[var(--text-primary)]">
                Finanzas en Pareja: Yo &amp; {partnerName}
              </h1>
              {!editingPartnerName ? (
                <button
                  type="button"
                  onClick={() => setEditingPartnerName(true)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[var(--surface)]/90 hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] inline-flex items-center gap-1"
                  title="Personalizar el nombre de tu pareja"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Cambiar nombre</span>
                </button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    guardarNombrePareja(partnerName);
                    setEditingPartnerName(false);
                    showToast(
                      `Nombre de pareja actualizado a "${partnerName}".`,
                      'success'
                    );
                  }}
                  className="inline-flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    placeholder="Nombre de tu pareja"
                    className="px-2.5 py-1 text-xs rounded-lg bg-[var(--surface)] border border-[var(--lavender-accent)] text-[var(--text-primary)] focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[var(--lavender-accent)] text-white"
                  >
                    Guardar
                  </button>
                </form>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl">
              Gestiona gastos compartidos con cálculo dinámico de quién le debe a quién, fondo común de ahorros en USD, metas conjuntas y sincronización manual JSON sin servidor.
            </p>
          </div>

          {/* Botones de Sincronización Manual JSON y Datos de Ejemplo */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportPartnerExpensesJson}
              className="px-3.5 py-2.5 text-xs font-semibold text-white bg-[var(--lavender-accent)] hover:bg-[var(--lavender-dark)] rounded-xl transition-colors flex items-center gap-2 shadow-xs"
              title={`Filtrar todos los gastos pagados por ${partnerName} y descargar archivo .json`}
            >
              <Download className="w-4 h-4" />
              <span>
                Exportar gastos de {partnerName} (
                {balanceResumen.gastosPagadosPorParejaCount})
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenImportSharedModal}
              className="px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-input)] rounded-xl transition-colors flex items-center gap-2"
              title="Importar archivo .json de gastos compartidos en mis Finanzas Personales"
            >
              <Upload className="w-4 h-4 text-[var(--pink-primary)]" />
              <span>Importar JSON</span>
            </button>

            {sharedExpenses.length === 0 &&
              sharedSavings.length === 0 &&
              sharedGoals.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadCoupleDemo}
                  className="px-3 py-2.5 text-xs font-medium text-[var(--pink-primary)] bg-[var(--pink-light)] hover:opacity-90 rounded-xl transition-opacity flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cargar ejemplo</span>
                </button>
              )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* RESUMEN RÁPIDO AL ENTRAR A LA SECCIÓN (3 Tarjetas Protagonistas)    */}
      {/* 1. Balance de deuda  |  2. Total Ahorrado  |  3. Meta Principal     */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* TARJETA 1: BALANCE DE DEUDA DINÁMICO (¿Quién le debe a quién?) */}
        <div className="bg-[var(--surface)] p-6 rounded-2xl border-2 border-[var(--lavender-accent)]/30 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--lavender-text)] flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-[var(--lavender-accent)]" />
                <span>1. Balance de Deuda</span>
              </span>
              {balanceResumen.deudor === 'settled' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--income-bg)] text-[var(--income-color)]">
                  Al día
                </span>
              ) : balanceResumen.deudor === 'partner_owes_me' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--income-bg)] text-[var(--income-color)]">
                  A tu favor
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--expense-bg)] text-[var(--expense-color)]">
                  Por pagar a {partnerName}
                </span>
              )}
            </div>

            <div>
              {balanceResumen.deudor === 'settled' ? (
                <>
                  <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--income-color)]">
                    {formatearMonto(0, 'USD', locale)}
                  </div>
                  <p className="text-xs font-medium text-[var(--text-secondary)] mt-1">
                    Nadie le debe a nadie · Cuentas equilibradas
                  </p>
                </>
              ) : balanceResumen.deudor === 'partner_owes_me' ? (
                <>
                  <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--income-color)]">
                    +{formatearMonto(balanceResumen.montoNetoDeudaUsd, 'USD', locale)}
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">
                    <span className="text-[var(--income-color)]">
                      {partnerName} te debe a ti
                    </span>
                    {activeRate && activeRate > 0
                      ? ` · ≈ ${formatearMonto(
                          balanceResumen.montoNetoDeudaUsd * activeRate,
                          'VES',
                          locale
                        )}`
                      : ''}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--expense-color)]">
                    -{formatearMonto(balanceResumen.montoNetoDeudaUsd, 'USD', locale)}
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">
                    <span className="text-[var(--expense-color)]">
                      Tú le debes a {partnerName}
                    </span>
                    {activeRate && activeRate > 0
                      ? ` · ≈ ${formatearMonto(
                          balanceResumen.montoNetoDeudaUsd * activeRate,
                          'VES',
                          locale
                        )}`
                      : ''}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <div className="font-mono-tabular">
              Pagado Yo:{' '}
              <strong className="text-[var(--text-primary)]">
                {formatearMonto(balanceResumen.pagadoPorMiTotalUsd, 'USD', locale)}
              </strong>{' '}
              · {partnerName}:{' '}
              <strong className="text-[var(--text-primary)]">
                {formatearMonto(
                  balanceResumen.pagadoPorParejaTotalUsd,
                  'USD',
                  locale
                )}
              </strong>
            </div>
            {balanceResumen.deudor !== 'settled' && (
              <button
                type="button"
                onClick={handleSettleAllExpenses}
                className="text-[11px] font-semibold text-[var(--lavender-accent)] hover:underline shrink-0 ml-2"
              >
                Saldar cuentas
              </button>
            )}
          </div>
        </div>

        {/* TARJETA 2: TOTAL AHORRADO (Fondo Acumulador en USD) */}
        <div className="bg-[var(--surface)] p-6 rounded-2xl border-2 border-[var(--pink-primary)]/30 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pink-primary)] flex items-center gap-1.5">
                <PiggyBank className="w-4 h-4 text-[var(--pink-primary)]" />
                <span>2. Total Ahorrado (USD)</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--pink-light)] text-[var(--pink-primary)]">
                Fondo Común USD
              </span>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--text-primary)]">
                {formatearMonto(
                  ahorrosYMetasResumen.totalAhorradoUsd,
                  'USD',
                  locale
                )}
              </div>
              {activeRate && activeRate > 0 && (
                <p className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-1">
                  Equivalente ref.:{' '}
                  {formatearMonto(
                    ahorrosYMetasResumen.totalAhorradoUsd * activeRate,
                    'VES',
                    locale
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono-tabular">
            <span>
              Mis aportes:{' '}
              <strong className="text-[var(--text-primary)]">
                {formatearMonto(
                  ahorrosYMetasResumen.aportadoPorMiUsd,
                  'USD',
                  locale
                )}
              </strong>
            </span>
            <span>
              Aportes {partnerName}:{' '}
              <strong className="text-[var(--text-primary)]">
                {formatearMonto(
                  ahorrosYMetasResumen.aportadoPorParejaUsd,
                  'USD',
                  locale
                )}
              </strong>
            </span>
          </div>
        </div>

        {/* TARJETA 3: PROGRESO DE LA META PRINCIPAL */}
        <div className="bg-[var(--surface)] p-6 rounded-2xl border-2 border-[var(--income-color)]/30 space-y-3 flex flex-col justify-between">
          {ahorrosYMetasResumen.progresoMetaPrincipal ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--income-color)] flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-[var(--income-color)]" />
                    <span>3. Meta Principal</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--income-bg)] text-[var(--income-color)] font-mono-tabular">
                    {formatearPorcentaje(
                      ahorrosYMetasResumen.progresoMetaPrincipal.porcentaje,
                      1,
                      locale
                    )}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                    {ahorrosYMetasResumen.progresoMetaPrincipal.goal.name}
                  </h3>
                  <div className="flex items-baseline justify-between gap-2 mt-1 font-mono-tabular">
                    <span className="text-lg font-bold text-[var(--income-color)]">
                      {formatearMonto(
                        ahorrosYMetasResumen.progresoMetaPrincipal
                          .montoVinculadoUsd,
                        'USD',
                        locale
                      )}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      meta:{' '}
                      {formatearMonto(
                        ahorrosYMetasResumen.progresoMetaPrincipal.goal
                          .targetAmountUsd,
                        'USD',
                        locale
                      )}
                    </span>
                  </div>
                </div>

                {/* Barra de progreso vinculada a Ahorros Conjuntos */}
                <div className="w-full h-2.5 bg-[var(--surface-subtle)] rounded-full overflow-hidden border border-[var(--border-hairline)]">
                  <div
                    style={{
                      width: `${Math.max(
                        4,
                        ahorrosYMetasResumen.progresoMetaPrincipal.porcentaje
                      )}%`,
                      backgroundColor:
                        ahorrosYMetasResumen.progresoMetaPrincipal.goal.color ||
                        'var(--income-color)',
                    }}
                    className="h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>
                  Faltan:{' '}
                  <strong className="font-mono-tabular text-[var(--text-primary)]">
                    {formatearMonto(
                      ahorrosYMetasResumen.progresoMetaPrincipal.restanteUsd,
                      'USD',
                      locale
                    )}
                  </strong>
                </span>
                {ahorrosYMetasResumen.progresoMetaPrincipal.goal.targetDate && (
                  <span className="font-mono-tabular">
                    Fecha:{' '}
                    {ahorrosYMetasResumen.progresoMetaPrincipal.goal.targetDate}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col justify-between h-full space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--income-color)] flex items-center gap-1.5">
                  <Target className="w-4 h-4" />
                  <span>3. Meta Principal</span>
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Aún no han definido una meta principal en pareja. Crea tu primer objetivo conjunto para medir el progreso de sus ahorros.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('goals')}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--income-bg)] text-[var(--income-color)] w-fit"
              >
                + Definir meta en pareja
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* PESTAÑAS DEL HUB DE PAREJA                                          */}
      {/* =================================================================== */}
      <div className="flex flex-wrap items-center gap-2 bg-[var(--surface)] p-2 rounded-2xl border border-[var(--border-hairline)]">
        {(
          [
            { id: 'all', label: 'Vista Integral del Hub', icon: HeartHandshake },
            {
              id: 'expenses',
              label: `Gastos Compartidos (${sharedExpenses.length})`,
              icon: Scale,
            },
            {
              id: 'savings',
              label: `Ahorros Conjuntos USD (${sharedSavings.length})`,
              icon: PiggyBank,
            },
            {
              id: 'goals',
              label: `Metas en Pareja (${sharedGoals.length})`,
              icon: Target,
            },
            {
              id: 'contributions',
              label: `Aportes Mensuales (${sharedContributions.length})`,
              icon: Calendar,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-[var(--lavender-accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* SECCIÓN 1: GASTOS COMPARTIDOS + EL PUENTE PERSONAL                  */}
      {/* =================================================================== */}
      {(activeTab === 'all' || activeTab === 'expenses') && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Formulario para registrar Gasto Compartido */}
            <form
              onSubmit={handleAddSharedExpense}
              className="lg:col-span-5 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Scale className="w-4 h-4 text-[var(--lavender-accent)]" />
                    <span>Registrar Gasto Compartido</span>
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Clave: <code className="font-mono-tabular">shared_expenses</code>
                  </p>
                </div>
              </div>

              {/* Selector de Pagador (Yo / Pareja) con Puente Contable */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  ¿Quién pagó este gasto? (Selector de Pagador) *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExpPayer('me')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      expPayer === 'me'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] shadow-xs'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-input)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>Pagado por Mí (Yo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExpPayer('partner')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      expPayer === 'partner'
                        ? 'bg-[var(--lavender-accent)] text-white border-[var(--lavender-accent)] shadow-xs'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-input)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                    <span>Pagado por {partnerName}</span>
                  </button>
                </div>

                {/* Explicación en vivo de El Puente */}
                {expPayer === 'me' ? (
                  <div className="p-3 rounded-xl bg-[var(--pink-light)]/70 border border-[var(--pink-primary)]/30 text-[11px] text-[var(--text-primary)] space-y-2">
                    <div className="flex items-center gap-1.5 font-semibold text-[var(--pink-primary)]">
                      <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                      <span>Puente con Balance Personal Activo:</span>
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      Al guardar, se creará automáticamente un <strong>egreso en tus Finanzas Personales</strong> descontando el monto de la billetera que elijas abajo.
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                        Billetera personal de donde salió el pago:
                      </label>
                      <select
                        value={expWalletId}
                        onChange={(e) => setExpWalletId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                      >
                        {activeWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--lavender-soft)]/70 border border-[var(--lavender-accent)]/30 text-[11px] text-[var(--text-secondary)]">
                    <strong className="text-[var(--lavender-text)] block mb-0.5">
                      Excepción Contable (Pagado por {partnerName}):
                    </strong>
                    Se registrará en el Hub de Pareja y actualizará el balance de deuda, pero <strong>NO afectará tu saldo personal</strong>. Podrás exportarlo en JSON para que {partnerName} lo importe.
                  </div>
                )}
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Concepto o descripción del gasto *
                </label>
                <input
                  type="text"
                  value={expConcept}
                  onChange={(e) => setExpConcept(e.target.value)}
                  placeholder="Ej. Mercado semanal, Cena, Alquiler, Farmacia..."
                  required
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--lavender-accent)]"
                />
              </div>

              {/* Moneda y Monto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Moneda
                  </label>
                  <select
                    value={expCurrency}
                    onChange={(e) =>
                      setExpCurrency(e.target.value as CurrencyCode)
                    }
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Monto ({expCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={expAmountStr}
                    onChange={(e) => setExpAmountStr(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
              </div>

              {/* Tasa si es VES */}
              {expCurrency === 'VES' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[var(--text-primary)]">
                      Tasa de cambio (Bs/USD) *
                    </label>
                    {officialRate && (
                      <button
                        type="button"
                        onClick={() => setExpRateStr(String(officialRate))}
                        className="text-[10px] font-semibold text-[var(--pink-primary)] hover:underline"
                      >
                        Usar BCV ({formatearTasa(officialRate, locale)})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={expRateStr}
                    onChange={(e) => setExpRateStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                  {previewUsdEquivalent > 0 && (
                    <div className="mt-1 text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                      Equivalente: ≈{' '}
                      <strong className="text-[var(--text-primary)]">
                        {formatearMonto(previewUsdEquivalent, 'USD', locale)}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {/* Fecha y Categoría */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Categoría
                  </label>
                  <select
                    value={expCategoryId}
                    onChange={(e) => setExpCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  >
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* División del gasto */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Acuerdo de división del gasto
                </label>
                <select
                  value={expSplitType}
                  onChange={(e) =>
                    setExpSplitType(e.target.value as SharedSplitType)
                  }
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                >
                  <option value="50_50">
                    Mitad y mitad (50% Yo / 50% {partnerName})
                  </option>
                  <option value="custom_me_pct">
                    Porcentaje personalizado
                  </option>
                  <option value="100_other">
                    100% le corresponde a{' '}
                    {expPayer === 'me' ? partnerName : 'Mí (Yo)'}
                  </option>
                </select>

                {expSplitType === 'custom_me_pct' && (
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <span className="text-[var(--text-secondary)]">
                      % que asumo Yo:
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={expCustomMyPct}
                      onChange={(e) => setExpCustomMyPct(e.target.value)}
                      className="w-20 px-2.5 py-1 text-xs font-mono-tabular bg-[var(--surface-subtle)] border border-[var(--border-input)] rounded-lg"
                    />
                    <span className="text-[var(--text-secondary)]">
                      ({partnerName} asume{' '}
                      {Math.max(
                        0,
                        100 - (Number(expCustomMyPct.replace(',', '.')) || 0)
                      )}
                      %)
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[var(--lavender-accent)] hover:bg-[var(--lavender-dark)] rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {expPayer === 'me'
                    ? 'Guardar en Pareja + Descontar de mi Billetera'
                    : `Guardar Gasto Pagado por ${partnerName}`}
                </span>
              </button>
            </form>

            {/* Tabla e Historial de Gastos Compartidos */}
            <div className="lg:col-span-7 bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
              <div className="p-5 border-b border-[var(--border-hairline)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      Historial de Gastos Compartidos
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Total histórico conjunto:{' '}
                      <strong className="font-mono-tabular text-[var(--text-primary)]">
                        {formatearMonto(
                          balanceResumen.totalGastadoConjuntoUsd,
                          'USD',
                          locale
                        )}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportPartnerExpensesJson}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--lavender-soft)] text-[var(--lavender-text)] hover:opacity-90 flex items-center gap-1.5"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>
                      Exportar JSON de {partnerName} (
                      {balanceResumen.gastosPagadosPorParejaCount})
                    </span>
                  </button>
                </div>

                {/* Filtros rápidos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={expSearch}
                      onChange={(e) => setExpSearch(e.target.value)}
                      placeholder="Buscar concepto..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-input)] text-[var(--text-primary)]"
                    />
                  </div>

                  <select
                    value={expFilterPayer}
                    onChange={(e) =>
                      setExpFilterPayer(e.target.value as 'all' | SharedPayer)
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-input)] text-[var(--text-primary)]"
                  >
                    <option value="all">Pagador: Todos</option>
                    <option value="me">Pagados por Mí (Yo)</option>
                    <option value="partner">Pagados por {partnerName}</option>
                  </select>

                  <select
                    value={expFilterSettled}
                    onChange={(e) =>
                      setExpFilterSettled(
                        e.target.value as 'all' | 'pending' | 'settled'
                      )
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-input)] text-[var(--text-primary)]"
                  >
                    <option value="all">Estado: Todos</option>
                    <option value="pending">Activos en balance</option>
                    <option value="settled">Saldados</option>
                  </select>
                </div>
              </div>

              {filteredExpenses.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    No hay gastos compartidos registrados con este filtro.
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Usa el formulario de la izquierda para registrar quién pagó y calcular automáticamente el balance.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)]">
                        <th className="py-3 px-4">Fecha · Concepto</th>
                        <th className="py-3 px-4">Pagador · Puente</th>
                        <th className="py-3 px-4 text-right">Monto</th>
                        <th className="py-3 px-4 text-right">Efecto Deuda</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-divider)]">
                      {filteredExpenses.map((exp) => {
                        const owedUsd =
                          exp.payer === 'me'
                            ? (exp.amountUsd * exp.partnerSharePct) / 100
                            : (exp.amountUsd * exp.mySharePct) / 100;

                        return (
                          <tr
                            key={exp.id}
                            className={`hover:bg-[var(--surface-subtle)]/60 transition-colors ${
                              exp.settled ? 'opacity-60' : ''
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[var(--text-primary)]">
                                {exp.concept}
                              </div>
                              <div className="text-[11px] text-[var(--text-secondary)] font-mono-tabular">
                                {exp.date} · {exp.categoryName}
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                    exp.payer === 'me'
                                      ? 'bg-[var(--pink-light)] text-[var(--pink-primary)]'
                                      : 'bg-[var(--lavender-soft)] text-[var(--lavender-text)]'
                                  }`}
                                >
                                  {exp.payer === 'me'
                                    ? 'Pagó: Yo'
                                    : `Pagó: ${partnerName}`}
                                </span>
                                {exp.linkedPersonalTransactionId && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--income-bg)] text-[var(--income-color)] font-medium"
                                    title="Sincronizado automáticamente con tus Finanzas Personales"
                                  >
                                    Puente Personal
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right font-mono-tabular">
                              <div className="font-semibold text-[var(--text-primary)]">
                                {formatearMonto(
                                  exp.amount,
                                  exp.currency,
                                  locale
                                )}
                              </div>
                              {exp.currency === 'VES' && (
                                <div className="text-[10px] text-[var(--text-secondary)]">
                                  ≈{' '}
                                  {formatearMonto(exp.amountUsd, 'USD', locale)}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right font-mono-tabular">
                              {exp.settled ? (
                                <span className="text-[11px] text-[var(--text-secondary)]">
                                  Saldado
                                </span>
                              ) : exp.payer === 'me' ? (
                                <span className="text-[var(--income-color)] font-semibold">
                                  +{formatearMonto(owedUsd, 'USD', locale)} me
                                  debe
                                </span>
                              ) : (
                                <span className="text-[var(--expense-color)] font-semibold">
                                  -{formatearMonto(owedUsd, 'USD', locale)} debo
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSettledExpense(exp.id)
                                  }
                                  className="px-2 py-1 text-[10px] font-medium rounded-lg border border-[var(--border-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                  title={
                                    exp.settled
                                      ? 'Reactivar en el balance'
                                      : 'Marcar como saldado'
                                  }
                                >
                                  {exp.settled ? 'Reactivar' : 'Saldar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSharedExpense(exp)}
                                  className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)] rounded-lg"
                                  title="Eliminar gasto compartido"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
        </div>
      )}

      {/* =================================================================== */}
      {/* SECCIÓN 2 Y 3: AHORROS CONJUNTOS (USD) Y METAS EN PAREJA            */}
      {/* =================================================================== */}
      {(activeTab === 'all' ||
        activeTab === 'savings' ||
        activeTab === 'goals') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* AHORROS CONJUNTOS (Fondo Acumulador exclusivamente en USD) */}
          {(activeTab === 'all' || activeTab === 'savings') && (
            <div
              className={`${
                activeTab === 'savings' ? 'lg:col-span-12' : 'lg:col-span-6'
              } bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5`}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <PiggyBank className="w-4 h-4 text-[var(--pink-primary)]" />
                    <span>Ahorros Conjuntos (Fondo Acumulador en USD)</span>
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Clave: <code className="font-mono-tabular">shared_savings</code> · Exclusivamente en USD
                  </p>
                </div>
                <span className="text-sm font-bold font-mono-tabular text-[var(--pink-primary)]">
                  {formatearMonto(
                    ahorrosYMetasResumen.totalAhorradoUsd,
                    'USD',
                    locale
                  )}
                </span>
              </div>

              <form onSubmit={handleAddSharedSaving} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      ¿Quién aporta?
                    </label>
                    <select
                      value={savContributor}
                      onChange={(e) =>
                        setSavContributor(e.target.value as SharedPayer)
                      }
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    >
                      <option value="me">Yo ({userName || 'Mi aporte'})</option>
                      <option value="partner">{partnerName}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Monto a aportar (USD $) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={savAmountUsdStr}
                      onChange={(e) => setSavAmountUsdStr(e.target.value)}
                      placeholder="Ej. 100.00"
                      required
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={savDate}
                      onChange={(e) => setSavDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Nota o motivo del aporte
                    </label>
                    <input
                      type="text"
                      value={savDescription}
                      onChange={(e) => setSavDescription(e.target.value)}
                      placeholder="Ej. Aporte quincenal en dólares..."
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Vincular a Meta en Pareja
                    </label>
                    <select
                      value={savGoalId}
                      onChange={(e) => setSavGoalId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    >
                      <option value="">Fondo común general (Todas las metas)</option>
                      {sharedGoals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {savContributor === 'me' && (
                  <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer text-[var(--text-primary)] font-medium">
                      <input
                        type="checkbox"
                        checked={savDeductPersonalWallet}
                        onChange={(e) =>
                          setSavDeductPersonalWallet(e.target.checked)
                        }
                      />
                      <span>
                        Descontar este aporte de mi billetera personal (Puente Contable)
                      </span>
                    </label>
                    {savDeductPersonalWallet && (
                      <select
                        value={savWalletId}
                        onChange={(e) => setSavWalletId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg"
                      >
                        {activeWallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.currency})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Sumar aporte en USD al Fondo Conjunto</span>
                </button>
              </form>

              {/* Historial de Aportes */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Historial de aportes al fondo ({sharedSavings.length})
                </h3>
                {sharedSavings.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-4 text-center bg-[var(--surface-subtle)] rounded-xl">
                    Aún no hay aportes registrados en el fondo acumulador USD.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-divider)] border border-[var(--border-hairline)] rounded-xl">
                    {sharedSavings.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-[var(--surface-subtle)]/60"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--text-primary)] truncate">
                            {s.description}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-2 mt-0.5">
                            <span className="font-mono-tabular">{s.date}</span>
                            <span>·</span>
                            <span
                              className={`font-semibold ${
                                s.contributor === 'me'
                                  ? 'text-[var(--pink-primary)]'
                                  : 'text-[var(--lavender-accent)]'
                              }`}
                            >
                              Aportó:{' '}
                              {s.contributor === 'me' ? 'Yo' : partnerName}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-tabular font-bold text-[var(--income-color)]">
                            +{formatearMonto(s.amountUsd, 'USD', locale)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSharedSaving(s)}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                            title="Eliminar aporte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* METAS EN PAREJA (Vinculadas a Ahorros Conjuntos) */}
          {(activeTab === 'all' || activeTab === 'goals') && (
            <div
              className={`${
                activeTab === 'goals' ? 'lg:col-span-12' : 'lg:col-span-6'
              } bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5`}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Target className="w-4 h-4 text-[var(--income-color)]" />
                    <span>Metas en Pareja</span>
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Clave: <code className="font-mono-tabular">shared_goals</code> · Barra vinculada a Ahorros Conjuntos
                  </p>
                </div>
              </div>

              <form onSubmit={handleAddSharedGoal} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Objetivo o sueño en pareja *
                    </label>
                    <input
                      type="text"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      placeholder="Ej. Inicial de apartamento, Viaje, Boda..."
                      required
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Monto meta (USD $) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={goalTargetUsdStr}
                      onChange={(e) => setGoalTargetUsdStr(e.target.value)}
                      placeholder="Ej. 1500.00"
                      required
                      className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Fecha estimada
                    </label>
                    <input
                      type="date"
                      value={goalTargetDate}
                      onChange={(e) => setGoalTargetDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Descripción corta
                    </label>
                    <input
                      type="text"
                      value={goalDescription}
                      onChange={(e) => setGoalDescription(e.target.value)}
                      placeholder="Detalles de nuestra meta..."
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={goalIsPrimary}
                      onChange={(e) => setGoalIsPrimary(e.target.checked)}
                    />
                    <span>Destacar como Meta Principal en el Resumen Rápido</span>
                  </label>

                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-[var(--income-color)] hover:opacity-90 rounded-xl transition-opacity flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Crear Meta</span>
                  </button>
                </div>
              </form>

              {/* Tarjetas de Metas en Pareja */}
              <div className="space-y-3 pt-2">
                {ahorrosYMetasResumen.progresoPorMeta.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-4 text-center bg-[var(--surface-subtle)] rounded-xl">
                    Todavía no hay metas en pareja creadas.
                  </p>
                ) : (
                  ahorrosYMetasResumen.progresoPorMeta.map((item) => (
                    <div
                      key={item.goal.id}
                      className={`p-4 rounded-2xl border space-y-2.5 ${
                        item.goal.isPrimary
                          ? 'bg-[var(--surface-subtle)] border-[var(--lavender-accent)]'
                          : 'bg-[var(--surface)] border-[var(--border-hairline)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">
                              {item.goal.name}
                            </h3>
                            {item.goal.isPrimary && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--lavender-soft)] text-[var(--lavender-text)] inline-flex items-center gap-1">
                                <Star className="w-2.5 h-2.5" />
                                <span>Principal</span>
                              </span>
                            )}
                          </div>
                          {item.goal.description && (
                            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                              {item.goal.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {!item.goal.isPrimary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryGoal(item.goal.id)}
                              className="px-2 py-1 text-[10px] font-medium rounded-lg border border-[var(--border-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              Hacer principal
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteGoal(item.goal.id)}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                            title="Eliminar meta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between font-mono-tabular text-xs">
                        <span className="font-bold text-[var(--income-color)]">
                          {formatearMonto(item.montoVinculadoUsd, 'USD', locale)}{' '}
                          ahorrado
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          Meta:{' '}
                          {formatearMonto(
                            item.goal.targetAmountUsd,
                            'USD',
                            locale
                          )}{' '}
                          ({formatearPorcentaje(item.porcentaje, 1, locale)})
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border-hairline)]">
                        <div
                          style={{
                            width: `${Math.max(3, item.porcentaje)}%`,
                            backgroundColor:
                              item.goal.color || 'var(--income-color)',
                          }}
                          className="h-full rounded-full transition-all duration-300"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                        <span>
                          Restante:{' '}
                          <strong className="font-mono-tabular text-[var(--text-primary)]">
                            {formatearMonto(item.restanteUsd, 'USD', locale)}
                          </strong>
                        </span>
                        {item.goal.targetDate && (
                          <span className="font-mono-tabular">
                            Fecha meta: {item.goal.targetDate}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECCIÓN 4: APORTES MENSUALES (Control de Cuotas al Fondo Común)     */}
      {/* =================================================================== */}
      {(activeTab === 'all' || activeTab === 'contributions') && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--lavender-accent)]" />
                <span>
                  Aportes Mensuales al Fondo Común (Control de Cuotas)
                </span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Clave: <code className="font-mono-tabular">shared_contributions</code> · Controla la cuota mensual que cada uno debe aportar y márcala como «Completado».
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Formulario para crear cuota mensual */}
            <form
              onSubmit={handleAddMonthlyContribution}
              className="lg:col-span-5 p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Programar cuota mensual en pareja
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Mes (YYYY-MM)
                  </label>
                  <input
                    type="month"
                    value={contribMonthKey}
                    onChange={(e) => handleMonthKeyChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Concepto de la cuota *
                  </label>
                  <input
                    type="text"
                    value={contribTitle}
                    onChange={(e) => setContribTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Mi cuota mensual (USD $)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={contribMyQuotaStr}
                    onChange={(e) => setContribMyQuotaStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Cuota de {partnerName} (USD $)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={contribPartnerQuotaStr}
                    onChange={(e) => setContribPartnerQuotaStr(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={contribAutoAddToSavings}
                  onChange={(e) => setContribAutoAddToSavings(e.target.checked)}
                />
                <span>
                  Al marcar «Completado», sumar automáticamente la cuota a Ahorros Conjuntos
                </span>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[var(--lavender-accent)] hover:bg-[var(--lavender-dark)] rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar cuota mensual</span>
              </button>
            </form>

            {/* Listado de Cuotas Mensuales con check de Completado para Yo y Pareja */}
            <div className="lg:col-span-7 space-y-3">
              {sharedContributions.length === 0 ? (
                <div className="p-8 text-center bg-[var(--surface-subtle)] rounded-2xl border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                  No hay cuotas mensuales programadas todavía. Crea la cuota del mes para llevar el control de aportes de ambos.
                </div>
              ) : (
                sharedContributions.map((c) => {
                  const totalMonthQuota = c.myQuotaUsd + c.partnerQuotaUsd;
                  const completedAmount =
                    (c.myCompleted ? c.myQuotaUsd : 0) +
                    (c.partnerCompleted ? c.partnerQuotaUsd : 0);
                  const bothCompleted = c.myCompleted && c.partnerCompleted;

                  return (
                    <div
                      key={c.id}
                      className={`p-4 rounded-2xl border space-y-3 ${
                        bothCompleted
                          ? 'bg-[var(--income-bg)]/40 border-[var(--income-color)]/40'
                          : 'bg-[var(--surface)] border-[var(--border-hairline)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono-tabular font-semibold bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                              {formatearNombreMes(c.monthKey)}
                            </span>
                            <h4 className="text-sm font-bold text-[var(--text-primary)]">
                              {c.title}
                            </h4>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] font-mono-tabular mt-0.5">
                            Recaudado del mes:{' '}
                            <strong className="text-[var(--text-primary)]">
                              {formatearMonto(completedAmount, 'USD', locale)}
                            </strong>{' '}
                            de {formatearMonto(totalMonthQuota, 'USD', locale)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {bothCompleted && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[var(--income-bg)] text-[var(--income-color)] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Mes 100% completado</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteContribution(c.id)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)] rounded-lg"
                            title="Eliminar control mensual"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Mi cuota */}
                        <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] text-[var(--text-secondary)] block">
                              Mi cuota (Yo)
                            </span>
                            <span className="text-sm font-bold font-mono-tabular text-[var(--text-primary)]">
                              {formatearMonto(c.myQuotaUsd, 'USD', locale)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleQuotaCompleted(c, 'me')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                              c.myCompleted
                                ? 'bg-[var(--income-color)] text-white'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-input)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {c.myCompleted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completado</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>Marcar completado</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Cuota Pareja */}
                        <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] text-[var(--text-secondary)] block">
                              Cuota de {partnerName}
                            </span>
                            <span className="text-sm font-bold font-mono-tabular text-[var(--text-primary)]">
                              {formatearMonto(c.partnerQuotaUsd, 'USD', locale)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleQuotaCompleted(c, 'partner')
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                              c.partnerCompleted
                                ? 'bg-[var(--income-color)] text-white'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-input)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {c.partnerCompleted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completado</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>Marcar completado</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
