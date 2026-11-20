import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Filter,
  HandCoins,
  Layers,
  ListChecks,
  Repeat,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  AppCredit,
  AppCreditInstallment,
  AppDataSchema,
  CreditInstallment,
  CreditPurchase,
  CurrencyCode,
  Debt,
  MarketList,
  NavigationSection,
  P2POperation,
  Subscription,
  Transaction,
} from '../types/finance';
import {
  calcularResumenBilleteras,
  obtenerFechaLocalIso,
} from '../utils/calculations';
import {
  obtenerEstadoAbonosCuotaCompra,
  PayInstallmentInput,
  registrarPagoCuotaEnAppData,
} from '../utils/installmentsController';
import {
  obtenerEstadoAbonosCuotaCreditoApp,
  registrarPagoCuotaCreditoAppEnAppData,
} from '../utils/appCreditsController';
import {
  calcularMontoSuscripcionUsd,
  PaySubscriptionInput,
  registrarPagoSuscripcionEnAppData,
} from '../utils/subscriptionsController';
import { formatearMonto, formatearTasa } from '../services/bcvApi';
import { PayInstallmentModal } from './InstallmentsModuleView';
import { PayAppCreditInstallmentModal } from './AppCreditsModuleView';
import { PaySubscriptionModal } from './SubscriptionsModuleView';

export type UnifiedPaymentSourceType =
  | 'installment' // Cashea / Compras a cuotas
  | 'app_credit' // Ubii / Avila / Créditos de Apps
  | 'subscription' // Suscripciones recurrentes
  | 'pending_expense' // Gastos pendientes / Listas de Mercado
  | 'debt_payable'; // Deudas por pagar / Compromisos P2P

export type UnifiedUrgencyBucket =
  | 'overdue_or_today'
  | 'next_7_days'
  | 'next_15_days'
  | 'later';

export interface UnifiedUpcomingPaymentItem {
  id: string;
  sourceType: UnifiedPaymentSourceType;
  sourceBadgeLabel: string;
  title: string;
  subtitle: string;
  dueDate: string; // YYYY-MM-DD
  daysUntilDue: number;
  urgencyBucket: UnifiedUrgencyBucket;
  amountUsd: number;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  progressText?: string;
  categoryName: string;
  categoryColor: string;
  // Referencias para abrir el modal de pago directo sin cambiar de sección
  creditPurchase?: CreditPurchase;
  creditInstallment?: CreditInstallment;
  appCredit?: AppCredit;
  appCreditInstallment?: AppCreditInstallment;
  subscription?: Subscription;
  pendingTransaction?: Transaction;
  linkedMarketList?: MarketList;
  debtItem?: Debt;
  p2pPayableItem?: P2POperation;
}

interface UpcomingPaymentsViewProps {
  data: AppDataSchema;
  officialRate: number | null;
  defaultManualRate: number | null;
  preferManualByDefault: boolean;
  locale: 'es-VE' | 'en-US';
  onUpdateData: (updater: (prev: AppDataSchema) => AppDataSchema) => void;
  onPayPendingTransaction: (txn: Transaction) => void;
  onNavigate: (section: NavigationSection) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

function diffDaysFromToday(dueDateStr: string, todayStr: string): number {
  const [y1, m1, d1] = (todayStr || '').split('-').map(Number);
  const [y2, m2, d2] = (dueDateStr || '').split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function getUrgencyBucket(days: number): UnifiedUrgencyBucket {
  if (days <= 0) return 'overdue_or_today';
  if (days <= 7) return 'next_7_days';
  if (days <= 15) return 'next_15_days';
  return 'later';
}

function formatShortDateEs(dateStr: string): { dayNum: string; monthShort: string } {
  const parts = (dateStr || '').split('-');
  if (parts.length !== 3) return { dayNum: '--', monthShort: '---' };
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  const mIdx = Math.max(0, Math.min(11, Number(parts[1]) - 1));
  return {
    dayNum: parts[2],
    monthShort: months[mIdx],
  };
}

export const UpcomingPaymentsView: React.FC<UpcomingPaymentsViewProps> = ({
  data,
  officialRate,
  defaultManualRate,
  preferManualByDefault,
  locale,
  onUpdateData,
  onPayPendingTransaction,
  onNavigate,
  showToast,
}) => {
  const todayStr = useMemo(() => obtenerFechaLocalIso(), []);
  const currentMonthKey = todayStr.slice(0, 7);

  const activeRate = useMemo(() => {
    if (preferManualByDefault && defaultManualRate && defaultManualRate > 0) {
      return defaultManualRate;
    }
    if (officialRate && officialRate > 0) return officialRate;
    if (defaultManualRate && defaultManualRate > 0) return defaultManualRate;
    return 450;
  }, [preferManualByDefault, defaultManualRate, officialRate]);

  const walletSummaries = useMemo(
    () => calcularResumenBilleteras(data),
    [data]
  );

  // Filtros interactivos
  const [horizonFilter, setHorizonFilter] = useState<
    'all' | 'overdue_today' | 'next_7' | 'next_15' | 'this_month'
  >('all');
  const [sourceFilter, setSourceFilter] = useState<
    'all' | UnifiedPaymentSourceType
  >('all');
  const [viewLayout, setViewLayout] = useState<'chronological' | 'grouped'>(
    'chronological'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Estados de modales de pago directo en sitio
  const [payingInstallmentTarget, setPayingInstallmentTarget] = useState<{
    purchase: CreditPurchase;
    installment: CreditInstallment;
  } | null>(null);

  const [payingAppCreditTarget, setPayingAppCreditTarget] = useState<{
    credit: AppCredit;
    installment: AppCreditInstallment;
  } | null>(null);

  const [payingSubscriptionTarget, setPayingSubscriptionTarget] =
    useState<Subscription | null>(null);

  // Construir lista unificada y desduplicada de todos los próximos pagos
  const allUnifiedItems = useMemo<UnifiedUpcomingPaymentItem[]>(() => {
    const items: UnifiedUpcomingPaymentItem[] = [];
    const linkedPendingTxnIds = new Set<string>();

    const getCatInfo = (catId?: string, fallbackName = 'Compromiso') => {
      const found = data.categories.find((c) => c.id === catId);
      return {
        name: found?.name || fallbackName,
        color: found?.color || '#EC4899',
      };
    };

    // 1. CUOTAS DE COMPRAS A CRÉDITO (CASHEA / KRECE / BNPL)
    for (const purchase of data.creditPurchases || []) {
      for (const inst of purchase.installments || []) {
        if (inst.linkedTransactionId) {
          linkedPendingTxnIds.add(inst.linkedTransactionId);
        }
        if (inst.status !== 'pending') continue;
        const { paidUsd, remainingUsd } = obtenerEstadoAbonosCuotaCompra(inst);
        if (remainingUsd <= 0.005) continue;

        const days = diffDaysFromToday(inst.dueDate, todayStr);
        const catInfo = getCatInfo(purchase.categoryId, 'Compras por Cuota');

        items.push({
          id: `inst_${purchase.id}_${inst.id}`,
          sourceType: 'installment',
          sourceBadgeLabel: `${purchase.storeOrPlatform || 'Cashea'} · Cuota #${inst.number}/${purchase.installmentsCount}`,
          title: purchase.concept,
          subtitle: `Cuota ${inst.number} de ${purchase.installmentsCount} (${purchase.storeOrPlatform})`,
          dueDate: inst.dueDate,
          daysUntilDue: days,
          urgencyBucket: getUrgencyBucket(days),
          amountUsd: remainingUsd,
          originalAmount: remainingUsd,
          originalCurrency: 'USD',
          progressText:
            paidUsd > 0
              ? `Abonado: $${paidUsd.toFixed(2)} de $${inst.amountUsd.toFixed(2)}`
              : undefined,
          categoryName: catInfo.name,
          categoryColor: catInfo.color,
          creditPurchase: purchase,
          creditInstallment: inst,
        });
      }
    }

    // 2. CUOTAS DE CRÉDITOS DE APPS (UBII APP / AVILA PAY / MICROCRÉDITOS)
    for (const credit of data.appCredits || []) {
      for (const inst of credit.installments || []) {
        if (inst.linkedTransactionId) {
          linkedPendingTxnIds.add(inst.linkedTransactionId);
        }
        if (inst.status !== 'pending') continue;
        const {
          paidInCreditCurrency,
          remainingInCreditCurrency,
          remainingUsd,
        } = obtenerEstadoAbonosCuotaCreditoApp(inst);
        if (remainingUsd <= 0.005) continue;

        const days = diffDaysFromToday(inst.dueDate, todayStr);
        const catInfo = getCatInfo(credit.categoryId, 'Créditos de Apps');
        const sym = credit.currency === 'VES' ? 'Bs.' : '$';

        items.push({
          id: `appcred_${credit.id}_${inst.id}`,
          sourceType: 'app_credit',
          sourceBadgeLabel: `${credit.appName} · Cuota #${inst.number}/${credit.installmentsCount}`,
          title: credit.concept
            ? `${credit.appName} — ${credit.concept}`
            : `Crédito ${credit.appName}`,
          subtitle: `Cuota ${inst.number} de ${credit.installmentsCount} (Capital + Comisión)`,
          dueDate: inst.dueDate,
          daysUntilDue: days,
          urgencyBucket: getUrgencyBucket(days),
          amountUsd: remainingUsd,
          originalAmount: remainingInCreditCurrency,
          originalCurrency: credit.currency,
          progressText:
            paidInCreditCurrency > 0
              ? `Abonado: ${sym}${paidInCreditCurrency.toFixed(2)} de ${sym}${inst.totalInstallmentAmount.toFixed(2)}`
              : undefined,
          categoryName: catInfo.name,
          categoryColor: catInfo.color,
          appCredit: credit,
          appCreditInstallment: inst,
        });
      }
    }

    // 3. SUSCRIPCIONES ACTIVAS (NETFLIX, SPOTIFY, INTERNET, ETC.)
    for (const sub of data.subscriptions || []) {
      if (sub.status !== 'active') continue;
      const subUsd = calcularMontoSuscripcionUsd(
        sub,
        officialRate,
        defaultManualRate
      );
      if (subUsd <= 0) continue;

      const days = diffDaysFromToday(sub.nextBillingDate, todayStr);
      const catInfo = getCatInfo(sub.categoryId, 'Suscripciones');

      items.push({
        id: `sub_${sub.id}`,
        sourceType: 'subscription',
        sourceBadgeLabel: `Suscripción ${sub.frequency === 'annual' ? 'Anual' : 'Mensual'}`,
        title: sub.name,
        subtitle: `Próximo corte: ${sub.nextBillingDate} · Aviso ${sub.alertDaysBefore} días antes`,
        dueDate: sub.nextBillingDate,
        daysUntilDue: days,
        urgencyBucket: getUrgencyBucket(days),
        amountUsd: subUsd,
        originalAmount: sub.amount,
        originalCurrency: sub.currency,
        categoryName: catInfo.name,
        categoryColor: catInfo.color,
        subscription: sub,
      });
    }

    // Mapear listas de mercado abiertas vinculadas a transacciones pendientes
    const marketByPendingTxId = new Map<string, MarketList>();
    for (const ml of data.marketLists || []) {
      if (ml.estado === 'abierta' && ml.linkedPendingTransactionId) {
        marketByPendingTxId.set(ml.linkedPendingTransactionId, ml);
      }
    }

    // 4. GASTOS PENDIENTES Y LISTAS DE MERCADO ABIERTAS (SIN DUPLICAR CUOTAS)
    for (const txn of data.transactions || []) {
      if (txn.status !== 'pending') continue;
      const isExpense = txn.type === 'expense' || Boolean(txn.isThirdPartyAllowance);
      if (!isExpense) continue;
      if (linkedPendingTxnIds.has(txn.id)) continue;

      const days = diffDaysFromToday(txn.date, todayStr);
      const linkedMarket = marketByPendingTxId.get(txn.id);
      const catInfo = getCatInfo(
        txn.categoryId,
        linkedMarket ? 'Lista de Mercado' : 'Gasto Pendiente'
      );

      items.push({
        id: `pendtxn_${txn.id}`,
        sourceType: 'pending_expense',
        sourceBadgeLabel: linkedMarket
          ? '🛒 Lista de Mercado Abierta'
          : '🧾 Gasto Pendiente',
        title: linkedMarket ? linkedMarket.nombre : txn.description,
        subtitle: linkedMarket
          ? `Presupuesto estimado de mercado (${linkedMarket.items.length} artículos)`
          : txn.notes || `Categoría: ${catInfo.name}`,
        dueDate: txn.date,
        daysUntilDue: days,
        urgencyBucket: getUrgencyBucket(days),
        amountUsd: txn.amountUsd,
        originalAmount: txn.amount,
        originalCurrency: txn.currency,
        categoryName: catInfo.name,
        categoryColor: catInfo.color,
        pendingTransaction: txn,
        linkedMarketList: linkedMarket,
      });
    }

    // 5. DEUDAS POR PAGAR (PRÉSTAMOS RECIBIDOS) Y COMPROMISOS P2P POR ENTREGAR
    for (const debt of data.debts || []) {
      const kind = debt.kind || 'payable';
      if (debt.status === 'paid' || kind !== 'payable') continue;
      const paidUsd = (debt.payments || []).reduce(
        (acc, p) => acc + (Number.isFinite(p.amountUsd) ? p.amountUsd : 0),
        0
      );
      const remUsd = Math.max(0, Number((debt.totalAmountUsd - paidUsd).toFixed(2)));
      if (remUsd <= 0.005) continue;

      const effectiveDueDate = debt.dueDate || todayStr;
      const days = diffDaysFromToday(effectiveDueDate, todayStr);

      items.push({
        id: `debt_${debt.id}`,
        sourceType: 'debt_payable',
        sourceBadgeLabel: '🤝 Deuda por Pagar',
        title: `${debt.creditor} — ${debt.description}`,
        subtitle: debt.dueDate
          ? `Vencimiento acordado: ${debt.dueDate}`
          : 'Sin fecha límite fija (Activa)',
        dueDate: effectiveDueDate,
        daysUntilDue: days,
        urgencyBucket: getUrgencyBucket(days),
        amountUsd: remUsd,
        originalAmount: remUsd,
        originalCurrency: 'USD',
        progressText:
          paidUsd > 0
            ? `Abonado: $${paidUsd.toFixed(2)} de $${debt.totalAmountUsd.toFixed(2)}`
            : undefined,
        categoryName: 'Deudas y Préstamos',
        categoryColor: '#F59E0B',
        debtItem: debt,
      });
    }

    for (const op of data.p2pOperations || []) {
      if (op.status !== 'in_transit' || op.direction !== 'payable') continue;
      const effectiveDueDate = op.estimatedSettlementDate || op.operationDate || todayStr;
      const days = diffDaysFromToday(effectiveDueDate, todayStr);

      items.push({
        id: `p2p_${op.id}`,
        sourceType: 'debt_payable',
        sourceBadgeLabel: '🔄 Compromiso P2P por Entregar',
        title: `Entregar a ${op.contactName}${op.concept ? ` · ${op.concept}` : ''}`,
        subtitle: `Pactado el ${op.operationDate} · Entregar ${op.deliveredCurrency} ${op.deliveredAmount.toFixed(2)}`,
        dueDate: effectiveDueDate,
        daysUntilDue: days,
        urgencyBucket: getUrgencyBucket(days),
        amountUsd: op.deliveredAmountUsd,
        originalAmount: op.deliveredAmount,
        originalCurrency: op.deliveredCurrency,
        categoryName: 'Compromiso P2P',
        categoryColor: '#8B5CF6',
        p2pPayableItem: op,
      });
    }

    // Ordenar estrictamente por fecha de vencimiento (más próximos primero) y luego por mayor monto
    return items.sort((a, b) => {
      const cmpDate = a.dueDate.localeCompare(b.dueDate);
      if (cmpDate !== 0) return cmpDate;
      return b.amountUsd - a.amountUsd;
    });
  }, [
    data.creditPurchases,
    data.appCredits,
    data.subscriptions,
    data.transactions,
    data.marketLists,
    data.debts,
    data.p2pOperations,
    data.categories,
    todayStr,
    officialRate,
    defaultManualRate,
  ]);

  // Métricas resumen por horizonte temporal
  const summaryStats = useMemo(() => {
    let overdueOrTodayUsd = 0;
    let overdueOrTodayCount = 0;
    let next7DaysUsd = 0;
    let next7DaysCount = 0;
    let next15DaysUsd = 0;
    let next15DaysCount = 0;
    let thisMonthUsd = 0;
    let thisMonthCount = 0;
    let totalAllUsd = 0;

    for (const item of allUnifiedItems) {
      totalAllUsd += item.amountUsd;
      if (item.daysUntilDue <= 0) {
        overdueOrTodayUsd += item.amountUsd;
        overdueOrTodayCount += 1;
      }
      if (item.daysUntilDue <= 7) {
        next7DaysUsd += item.amountUsd;
        next7DaysCount += 1;
      }
      if (item.daysUntilDue <= 15) {
        next15DaysUsd += item.amountUsd;
        next15DaysCount += 1;
      }
      if (item.dueDate.startsWith(currentMonthKey) || item.daysUntilDue <= 0) {
        thisMonthUsd += item.amountUsd;
        thisMonthCount += 1;
      }
    }

    return {
      overdueOrTodayUsd,
      overdueOrTodayCount,
      next7DaysUsd,
      next7DaysCount,
      next15DaysUsd,
      next15DaysCount,
      thisMonthUsd,
      thisMonthCount,
      totalAllUsd,
      totalAllCount: allUnifiedItems.length,
    };
  }, [allUnifiedItems, currentMonthKey]);

  // Filtrar lista según controles activos
  const filteredItems = useMemo(() => {
    return allUnifiedItems.filter((item) => {
      if (sourceFilter !== 'all' && item.sourceType !== sourceFilter) {
        return false;
      }
      if (horizonFilter === 'overdue_today' && item.daysUntilDue > 0) {
        return false;
      }
      if (horizonFilter === 'next_7' && item.daysUntilDue > 7) {
        return false;
      }
      if (horizonFilter === 'next_15' && item.daysUntilDue > 15) {
        return false;
      }
      if (
        horizonFilter === 'this_month' &&
        !item.dueDate.startsWith(currentMonthKey) &&
        item.daysUntilDue > 0
      ) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${item.title} ${item.subtitle} ${item.sourceBadgeLabel} ${item.categoryName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allUnifiedItems, sourceFilter, horizonFilter, currentMonthKey, searchQuery]);

  // Agrupación opcional por urgencia
  const groupedSections = useMemo(() => {
    const groups: {
      key: UnifiedUrgencyBucket;
      title: string;
      subtitle: string;
      badgeClass: string;
      items: UnifiedUpcomingPaymentItem[];
      totalUsd: number;
    }[] = [
      {
        key: 'overdue_or_today',
        title: '🔴 Vencidos y Para Pagar Hoy',
        subtitle: 'Compromisos que requieren atención inmediata',
        badgeClass:
          'bg-rose-500/15 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-500/40',
        items: [],
        totalUsd: 0,
      },
      {
        key: 'next_7_days',
        title: '🟠 Próximos 7 Días (Esta Semana)',
        subtitle: 'Vencen entre mañana y los próximos 7 días',
        badgeClass:
          'bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-500/40',
        items: [],
        totalUsd: 0,
      },
      {
        key: 'next_15_days',
        title: '🔵 Próximos 8 a 15 Días (Quincena)',
        subtitle: 'Compromisos de la quincena en curso',
        badgeClass:
          'bg-sky-500/15 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border-sky-500/40',
        items: [],
        totalUsd: 0,
      },
      {
        key: 'later',
        title: '📅 Más Adelante (+15 Días)',
        subtitle: 'Cuotas y suscripciones programadas a futuro',
        badgeClass:
          'bg-slate-500/15 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/40',
        items: [],
        totalUsd: 0,
      },
    ];

    const map = new Map<UnifiedUrgencyBucket, (typeof groups)[0]>();
    for (const g of groups) map.set(g.key, g);

    for (const item of filteredItems) {
      const target = map.get(item.urgencyBucket);
      if (target) {
        target.items.push(item);
        target.totalUsd += item.amountUsd;
      }
    }

    return groups.filter((g) => g.items.length > 0);
  }, [filteredItems]);

  // Handlers de confirmación de pago para cada tipo
  const handleConfirmInstallmentPay = (
    purchaseId: string,
    installmentId: string,
    payment: PayInstallmentInput
  ) => {
    try {
      onUpdateData((prev) =>
        registrarPagoCuotaEnAppData(prev, purchaseId, installmentId, payment)
      );
      setPayingInstallmentTarget(null);
      showToast('Pago de cuota registrado exitosamente.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al registrar el pago de la cuota.',
        'error'
      );
    }
  };

  const handleConfirmSubscriptionPay = (
    subId: string,
    payment: PaySubscriptionInput
  ) => {
    try {
      onUpdateData((prev) =>
        registrarPagoSuscripcionEnAppData(
          prev,
          subId,
          payment,
          officialRate || defaultManualRate
        )
      );
      setPayingSubscriptionTarget(null);
      showToast(
        'Suscripción pagada y avanzada automáticamente al próximo ciclo.',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al pagar la suscripción.',
        'error'
      );
    }
  };

  const renderSourceBadge = (item: UnifiedUpcomingPaymentItem) => {
    switch (item.sourceType) {
      case 'installment':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-fuchsia-500/15 dark:bg-fuchsia-500/20 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-500/35">
            <ShoppingBag className="w-3 h-3" />
            {item.sourceBadgeLabel}
          </span>
        );
      case 'app_credit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-500/35">
            <Smartphone className="w-3 h-3" />
            {item.sourceBadgeLabel}
          </span>
        );
      case 'subscription':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35">
            <Repeat className="w-3 h-3" />
            {item.sourceBadgeLabel}
          </span>
        );
      case 'pending_expense':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/35">
            <Clock className="w-3 h-3" />
            {item.sourceBadgeLabel}
          </span>
        );
      case 'debt_payable':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/35">
            <HandCoins className="w-3 h-3" />
            {item.sourceBadgeLabel}
          </span>
        );
    }
  };

  const renderDaysBadge = (days: number) => {
    if (days < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 dark:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/40">
          Vencido ({Math.abs(days)}d)
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 dark:bg-amber-500/25 text-amber-900 dark:text-amber-200 border border-amber-500/50">
          ¡Vence Hoy!
        </span>
      );
    }
    if (days === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/35">
          Mañana (1d)
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-500/15 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 border border-orange-500/35">
          En {days} días
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)] dark:text-[var(--text-secondary)] border border-[var(--border-hairline)]">
        En {days} días
      </span>
    );
  };

  const renderPaymentRow = (item: UnifiedUpcomingPaymentItem) => {
    const { dayNum, monthShort } = formatShortDateEs(item.dueDate);
    const vesEquiv = item.amountUsd * activeRate;
    const isUrgent = item.daysUntilDue <= 0;
    const isSoon = item.daysUntilDue > 0 && item.daysUntilDue <= 5;

    return (
      <div
        key={item.id}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
          isUrgent
            ? 'bg-rose-500/[0.06] border-rose-500/40 hover:border-rose-500/60'
            : isSoon
              ? 'bg-amber-500/[0.05] border-amber-500/35 hover:border-amber-500/55'
              : 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/40'
        }`}
      >
        {/* Bloque Izquierdo: Fecha Compacta + Información del Compromiso */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          {/* Calendario compacto */}
          <div
            className={`w-13 h-13 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
              isUrgent
                ? 'bg-rose-500/15 dark:bg-rose-500/20 border-rose-500/45 text-rose-800 dark:text-rose-200'
                : isSoon
                  ? 'bg-amber-500/15 dark:bg-amber-500/20 border-amber-500/45 text-amber-900 dark:text-amber-200'
                  : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)] text-[var(--text-primary)]'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90 leading-none">
              {monthShort}
            </span>
            <span className="text-base font-extrabold font-mono-tabular leading-tight mt-0.5">
              {dayNum}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {renderSourceBadge(item)}
              {renderDaysBadge(item.daysUntilDue)}
              <span className="text-[11px] font-semibold font-mono-tabular text-[var(--text-primary)] dark:text-[var(--text-secondary)]">
                ({item.dueDate})
              </span>
            </div>

            <div className="font-bold text-sm text-[var(--text-primary)] truncate">
              {item.title}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
              <span className="truncate">{item.subtitle}</span>
              {item.progressText && (
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  · {item.progressText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bloque Derecho: Monto en USD + Equivalente en Bs + Botón de Acción Directa */}
        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border-hairline)] shrink-0">
          <div className="text-left sm:text-right">
            <div className="text-base font-extrabold font-mono-tabular text-[var(--text-primary)]">
              {formatearMonto(item.amountUsd, 'USD', locale)}
            </div>
            <div className="text-[11px] font-mono-tabular font-semibold text-[var(--text-secondary)]">
              ≈ {formatearMonto(vesEquiv, 'VES', locale)}
            </div>
          </div>

          {/* Botones de Acción Directa según el origen */}
          {item.sourceType === 'installment' &&
            item.creditPurchase &&
            item.creditInstallment && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setPayingInstallmentTarget({
                      purchase: item.creditPurchase!,
                      installment: item.creditInstallment!,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--pink-primary)] text-white hover:opacity-95 shadow-xs cursor-pointer transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pagar / Abonar
                </button>
              </div>
            )}

          {item.sourceType === 'app_credit' &&
            item.appCredit &&
            item.appCreditInstallment && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setPayingAppCreditTarget({
                      credit: item.appCredit!,
                      installment: item.appCreditInstallment!,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 shadow-xs cursor-pointer transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pagar / Abonar
                </button>
              </div>
            )}

          {item.sourceType === 'subscription' && item.subscription && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPayingSubscriptionTarget(item.subscription!)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs cursor-pointer transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Pagar Ciclo
              </button>
            </div>
          )}

          {item.sourceType === 'pending_expense' && item.pendingTransaction && (
            <div className="flex items-center gap-1.5">
              {item.linkedMarketList ? (
                <button
                  type="button"
                  onClick={() => onNavigate('market')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-500 shadow-xs cursor-pointer transition"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Cerrar Mercado
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPayPendingTransaction(item.pendingTransaction!)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--pink-primary)] text-white hover:opacity-95 shadow-xs cursor-pointer transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pagar Gasto
                </button>
              )}
            </div>
          )}

          {item.sourceType === 'debt_payable' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onNavigate(item.p2pPayableItem ? 'p2p' : 'debts')
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-500 shadow-xs cursor-pointer transition"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Gestionar Pago
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const saldoRealDisponibleUsd = walletSummaries.totalSaldoActualUsd;
  const saldoCubiertoNext7 =
    saldoRealDisponibleUsd >= summaryStats.next7DaysUsd;

  return (
    <div className="space-y-5">
      {/* Encabezado Principal */}
      <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--pink-light)] text-[var(--pink-primary)] text-xs font-bold">
            <CalendarClock className="w-4 h-4" />
            Centro Unificado de Vencimientos
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Agenda de Pagos y Próximos Compromisos
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl">
            Todos tus gastos pendientes, cuotas de{' '}
            <strong className="text-[var(--text-primary)]">Cashea</strong>,{' '}
            <strong className="text-[var(--text-primary)]">Créditos de Apps (Ubii / Avila)</strong>,{' '}
            <strong className="text-[var(--text-primary)]">Suscripciones</strong> y{' '}
            <strong className="text-[var(--text-primary)]">Deudas</strong> juntos en una sola lista
            ordenada por fecha para que veas qué toca pagar pronto y lo proceses sin saltar de
            sección en sección.
          </p>
        </div>

        {/* Tarjeta comparativa rápida: Saldo Real vs. Próximos 7 días */}
        <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] min-w-[260px] space-y-1.5 shrink-0">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-semibold flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
              Tu Saldo Real Disponible:
            </span>
            <span className="font-mono-tabular font-bold text-[var(--text-primary)]">
              {formatearMonto(saldoRealDisponibleUsd, 'USD', locale)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Por pagar en 7 días:</span>
            <span className="font-mono-tabular font-bold text-amber-700 dark:text-amber-400">
              {formatearMonto(summaryStats.next7DaysUsd, 'USD', locale)}
            </span>
          </div>
          <div className="pt-1.5 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px]">
            <span className="font-semibold text-[var(--text-secondary)]">
              Cobertura 7 días:
            </span>
            <span
              className={`font-bold ${
                saldoCubiertoNext7
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {saldoCubiertoNext7
                ? `Cubierto (+${formatearMonto(
                    saldoRealDisponibleUsd - summaryStats.next7DaysUsd,
                    'USD',
                    locale
                  )} libre)`
                : `Faltan ${formatearMonto(
                    summaryStats.next7DaysUsd - saldoRealDisponibleUsd,
                    'USD',
                    locale
                  )}`}
            </span>
          </div>
        </div>
      </div>

      {/* KPIs por Horizonte de Tiempo (Clickables para filtrar al instante) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() =>
            setHorizonFilter((prev) =>
              prev === 'overdue_today' ? 'all' : 'overdue_today'
            )
          }
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            horizonFilter === 'overdue_today'
              ? 'bg-rose-500/15 border-rose-500 shadow-sm'
              : 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-rose-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Vencidos / Para Hoy
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/15 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300">
              {summaryStats.overdueOrTodayCount} pagos
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(summaryStats.overdueOrTodayUsd, 'USD', locale)}
          </div>
          <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
            ≈ {formatearMonto(summaryStats.overdueOrTodayUsd * activeRate, 'VES', locale)}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setHorizonFilter((prev) => (prev === 'next_7' ? 'all' : 'next_7'))
          }
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            horizonFilter === 'next_7'
              ? 'bg-amber-500/15 border-amber-500 shadow-sm'
              : 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-amber-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
              Próximos 7 Días
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/15 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300">
              {summaryStats.next7DaysCount} pagos
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(summaryStats.next7DaysUsd, 'USD', locale)}
          </div>
          <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
            ≈ {formatearMonto(summaryStats.next7DaysUsd * activeRate, 'VES', locale)}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setHorizonFilter((prev) => (prev === 'next_15' ? 'all' : 'next_15'))
          }
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            horizonFilter === 'next_15'
              ? 'bg-sky-500/15 border-sky-500 shadow-sm'
              : 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-sky-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Próximos 15 Días
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-sky-500/15 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300">
              {summaryStats.next15DaysCount} pagos
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(summaryStats.next15DaysUsd, 'USD', locale)}
          </div>
          <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
            ≈ {formatearMonto(summaryStats.next15DaysUsd * activeRate, 'VES', locale)}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setHorizonFilter((prev) =>
              prev === 'this_month' ? 'all' : 'this_month'
            )
          }
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            horizonFilter === 'this_month'
              ? 'bg-[var(--pink-light)] border-[var(--pink-primary)] shadow-sm'
              : 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--pink-primary)]">
              Total Este Mes
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[var(--pink-light)] text-[var(--pink-primary)]">
              {summaryStats.thisMonthCount} pagos
            </span>
          </div>
          <div className="text-xl font-extrabold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(summaryStats.thisMonthUsd, 'USD', locale)}
          </div>
          <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
            ≈ {formatearMonto(summaryStats.thisMonthUsd * activeRate, 'VES', locale)}
          </div>
        </button>
      </div>

      {/* Barra de Filtros Rápidos y Buscador */}
      <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Filtro por Tipo de Compromiso */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `Todos (${allUnifiedItems.length})` },
                { id: 'installment', label: '🛍️ Cashea / Cuotas' },
                { id: 'app_credit', label: '📱 Créditos Apps' },
                { id: 'subscription', label: '🔄 Suscripciones' },
                { id: 'pending_expense', label: '🧾 Gastos / Mercado' },
                { id: 'debt_payable', label: '🤝 Deudas / P2P' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  sourceFilter === tab.id
                    ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Buscador + Selector de Vista (Cronológica continua vs. Agrupada) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar pago, cuota, app..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            <div className="inline-flex rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewLayout('chronological')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  viewLayout === 'chronological'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Por Fecha
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('grouped')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  viewLayout === 'grouped'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Por Urgencia
              </button>
            </div>
          </div>
        </div>

        {/* Píldoras de horizonte de tiempo */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)] text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] mr-1">
              Horizonte:
            </span>
            {(
              [
                { id: 'all', label: 'Todas las fechas' },
                { id: 'overdue_today', label: 'Vencidos / Hoy' },
                { id: 'next_7', label: 'Próximos 7 días' },
                { id: 'next_15', label: 'Próximos 15 días' },
                { id: 'this_month', label: 'Este mes' },
              ] as const
            ).map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHorizonFilter(h.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                  horizonFilter === h.id
                    ? 'bg-[var(--text-primary)] text-[var(--surface)] font-bold'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            Mostrando <strong className="text-[var(--text-primary)]">{filteredItems.length}</strong>{' '}
            compromisos · Total filtrado:{' '}
            <strong className="text-[var(--pink-primary)]">
              {formatearMonto(
                filteredItems.reduce((acc, i) => acc + i.amountUsd, 0),
                'USD',
                locale
              )}
            </strong>{' '}
            (≈{' '}
            {formatearMonto(
              filteredItems.reduce((acc, i) => acc + i.amountUsd, 0) * activeRate,
              'VES',
              locale
            )}
            )
          </div>
        </div>
      </div>

      {/* Lista Unificada de Pagos */}
      {filteredItems.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            ¡No tienes pagos pendientes en este filtro!
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            Todos tus compromisos de cuotas, créditos de apps, suscripciones y gastos pendientes
            están al día para el criterio seleccionado.
          </p>
        </div>
      ) : viewLayout === 'chronological' ? (
        <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Orden Cronológico (Del más próximo al más lejano)
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              Tasa activa: {formatearTasa(activeRate, locale)} Bs/$
            </span>
          </div>
          <div className="space-y-2.5">
            {filteredItems.map((item) => renderPaymentRow(item))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSections.map((group) => (
            <div
              key={group.key}
              className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-hairline)]">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {group.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {group.subtitle}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${group.badgeClass}`}
                  >
                    {group.items.length} pagos ·{' '}
                    {formatearMonto(group.totalUsd, 'USD', locale)}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                {group.items.map((item) => renderPaymentRow(item))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Directo 1: Pagar / Abonar Cuota de Cashea / Compra a Cuotas */}
      {payingInstallmentTarget && (
        <PayInstallmentModal
          isOpen={true}
          onClose={() => setPayingInstallmentTarget(null)}
          purchase={payingInstallmentTarget.purchase}
          installment={payingInstallmentTarget.installment}
          wallets={data.wallets}
          officialRate={officialRate}
          defaultManualRate={defaultManualRate}
          preferManualByDefault={preferManualByDefault}
          rateHistory={data.rateHistory}
          existingTransactions={data.transactions}
          locale={locale}
          onConfirmPay={handleConfirmInstallmentPay}
        />
      )}

      {/* Modal Directo 2: Pagar / Abonar Cuota de Crédito de App (Ubii / Avila) */}
      {payingAppCreditTarget && (
        <PayAppCreditInstallmentModal
          credit={payingAppCreditTarget.credit}
          installment={payingAppCreditTarget.installment}
          data={data}
          activeRate={activeRate}
          walletSummaries={walletSummaries}
          onClose={() => setPayingAppCreditTarget(null)}
          onConfirm={(input) => {
            try {
              onUpdateData((prev) =>
                registrarPagoCuotaCreditoAppEnAppData(prev, input)
              );
              setPayingAppCreditTarget(null);
              showToast('Pago de cuota de app registrado en tu Saldo Real.', 'success');
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : 'Error al pagar cuota.',
                'error'
              );
            }
          }}
        />
      )}

      {/* Modal Directo 3: Registrar Pago de Suscripción */}
      {payingSubscriptionTarget && (
        <PaySubscriptionModal
          isOpen={true}
          onClose={() => setPayingSubscriptionTarget(null)}
          subscription={payingSubscriptionTarget}
          wallets={data.wallets}
          officialRate={officialRate}
          defaultManualRate={defaultManualRate}
          preferManualByDefault={preferManualByDefault}
          locale={locale}
          onConfirmPay={handleConfirmSubscriptionPay}
        />
      )}
    </div>
  );
};
