import {
  AppCredit,
  AppCreditInstallment,
  AppDataSchema,
  CreditInstallment,
  CreditPurchase,
  CurrencyCode,
  Debt,
  NavigationSection,
  P2POperation,
  Subscription,
  Transaction,
} from '../types/finance';
import { formatearMonto } from './bcvApi';
import {
  calcularEstadoDeuda,
  esTransaccionCompletada,
  obtenerFechaLocalIso,
} from '../utils/calculations';

export const PUSH_CONFIG_STORAGE_KEY = 'mis_finanzas_push_config_v1';
export const PUSH_SENT_LOG_STORAGE_KEY = 'mis_finanzas_push_sent_log_v1';

export type PushPermissionStatus =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export type PushReminderKind =
  | 'installment'
  | 'app_credit'
  | 'subscription'
  | 'pending_expense'
  | 'debt_payable';

export type PushReminderUrgency = 'overdue' | 'due_today' | 'upcoming';

export interface PushNotificationConfig {
  enabled: boolean;
  /** 1. Cuotas de Cashea / Compras por Cuotas */
  notifyInstallments: boolean;
  installmentDaysBefore: number;
  /** 2. Cuotas de Créditos de Apps (Ubii, Avila Pay, Krece, Wepa) */
  notifyAppCredits: boolean;
  appCreditDaysBefore: number;
  /** 3. Suscripciones Activas */
  notifySubscriptions: boolean;
  respectSubscriptionAlertDays: boolean;
  subscriptionDaysBefore: number;
  /** 4. Gastos Pendientes y Listas de Mercado Abiertas */
  notifyPendingExpenses: boolean;
  pendingExpenseDaysBefore: number;
  /** 5. Deudas por Pagar y Compromisos P2P por Entregar */
  notifyDebtsPayable: boolean;
  debtPayableDaysBefore: number;
  /** Incluir egresos pendientes con fecha ya vencida */
  notifyOverdue: boolean;
  /** Mostrar todos los pagos/egresos pendientes en la cola de notificaciones aunque falten más días */
  showAllPendingInQueue: boolean;
}

export interface PushReminderItem {
  id: string;
  kind: PushReminderKind;
  section: NavigationSection;
  parentId: string;
  title: string;
  body: string;
  shortLabel: string;
  dueDate: string; // YYYY-MM-DD
  daysUntilDue: number; // <0 vencido, 0 hoy, >0 próximos días
  urgency: PushReminderUrgency;
  amount: number;
  currency: CurrencyCode;
  amountUsd: number;
  appNameOrService: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface PushEnvironmentStatus {
  notificationSupported: boolean;
  serviceWorkerSupported: boolean;
  permission: PushPermissionStatus;
  serviceWorkerReady: boolean;
  periodicSyncSupported: boolean;
}

export interface PushDispatchResult {
  delivered: boolean;
  channel: 'service-worker' | 'notification-api' | 'in-app-fallback';
  title: string;
  body: string;
  error?: string;
}

export const DEFAULT_PUSH_CONFIG: PushNotificationConfig = {
  enabled: true,
  notifyInstallments: true,
  installmentDaysBefore: 7,
  notifyAppCredits: true,
  appCreditDaysBefore: 5,
  notifySubscriptions: true,
  respectSubscriptionAlertDays: true,
  subscriptionDaysBefore: 5,
  notifyPendingExpenses: true,
  pendingExpenseDaysBefore: 7,
  notifyDebtsPayable: true,
  debtPayableDaysBefore: 7,
  notifyOverdue: true,
  showAllPendingInQueue: true,
};

function sanitizeDays(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 60) {
    return Math.round(value);
  }
  return fallback;
}

/**
 * Lee la configuración de notificaciones Push desde localStorage
 */
export function loadPushNotificationConfig(): PushNotificationConfig {
  try {
    const raw = localStorage.getItem(PUSH_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PUSH_CONFIG };
    const parsed = JSON.parse(raw) as Partial<PushNotificationConfig>;
    return {
      enabled:
        typeof parsed.enabled === 'boolean'
          ? parsed.enabled
          : DEFAULT_PUSH_CONFIG.enabled,
      notifyInstallments:
        typeof parsed.notifyInstallments === 'boolean'
          ? parsed.notifyInstallments
          : DEFAULT_PUSH_CONFIG.notifyInstallments,
      installmentDaysBefore: sanitizeDays(
        parsed.installmentDaysBefore,
        DEFAULT_PUSH_CONFIG.installmentDaysBefore
      ),
      notifyAppCredits:
        typeof parsed.notifyAppCredits === 'boolean'
          ? parsed.notifyAppCredits
          : DEFAULT_PUSH_CONFIG.notifyAppCredits,
      appCreditDaysBefore: sanitizeDays(
        parsed.appCreditDaysBefore,
        DEFAULT_PUSH_CONFIG.appCreditDaysBefore
      ),
      notifySubscriptions:
        typeof parsed.notifySubscriptions === 'boolean'
          ? parsed.notifySubscriptions
          : DEFAULT_PUSH_CONFIG.notifySubscriptions,
      respectSubscriptionAlertDays:
        typeof parsed.respectSubscriptionAlertDays === 'boolean'
          ? parsed.respectSubscriptionAlertDays
          : DEFAULT_PUSH_CONFIG.respectSubscriptionAlertDays,
      subscriptionDaysBefore: sanitizeDays(
        parsed.subscriptionDaysBefore,
        DEFAULT_PUSH_CONFIG.subscriptionDaysBefore
      ),
      notifyPendingExpenses:
        typeof parsed.notifyPendingExpenses === 'boolean'
          ? parsed.notifyPendingExpenses
          : DEFAULT_PUSH_CONFIG.notifyPendingExpenses,
      pendingExpenseDaysBefore: sanitizeDays(
        parsed.pendingExpenseDaysBefore,
        DEFAULT_PUSH_CONFIG.pendingExpenseDaysBefore
      ),
      notifyDebtsPayable:
        typeof parsed.notifyDebtsPayable === 'boolean'
          ? parsed.notifyDebtsPayable
          : DEFAULT_PUSH_CONFIG.notifyDebtsPayable,
      debtPayableDaysBefore: sanitizeDays(
        parsed.debtPayableDaysBefore,
        DEFAULT_PUSH_CONFIG.debtPayableDaysBefore
      ),
      notifyOverdue:
        typeof parsed.notifyOverdue === 'boolean'
          ? parsed.notifyOverdue
          : DEFAULT_PUSH_CONFIG.notifyOverdue,
      showAllPendingInQueue:
        typeof parsed.showAllPendingInQueue === 'boolean'
          ? parsed.showAllPendingInQueue
          : DEFAULT_PUSH_CONFIG.showAllPendingInQueue,
    };
  } catch {
    return { ...DEFAULT_PUSH_CONFIG };
  }
}

/**
 * Guarda la configuración de notificaciones Push en localStorage
 */
export function savePushNotificationConfig(
  config: PushNotificationConfig
): void {
  try {
    localStorage.setItem(PUSH_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignorar errores de cuota
  }
}

/**
 * Obtiene la fecha local actual en formato YYYY-MM-DD
 */
export function getLocalTodayIso(): string {
  return obtenerFechaLocalIso();
}

/**
 * Calcula los días enteros entre hoy (YYYY-MM-DD) y una fecha objetivo (YYYY-MM-DD)
 */
export function calculateDaysUntilDue(
  dueDateIso: string,
  todayIso: string = getLocalTodayIso()
): number {
  if (!dueDateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dueDateIso)) return 0;
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [dy, dm, dd] = dueDateIso.split('-').map(Number);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const dueUtc = Date.UTC(dy, dm - 1, dd);
  return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

function formatDateReadable(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || 'Sin fecha';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function buildDueTimingPhrase(daysUntilDue: number, dueDate: string): string {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return 'Pendiente por pagar';
  }
  const formattedDate = formatDateReadable(dueDate);
  if (daysUntilDue < 0) {
    const absDays = Math.abs(daysUntilDue);
    return absDays === 1
      ? `Venció ayer (${formattedDate})`
      : `Vencido hace ${absDays} días (${formattedDate})`;
  }
  if (daysUntilDue === 0) {
    return `Vence HOY (${formattedDate})`;
  }
  if (daysUntilDue === 1) {
    return `Vence MAÑANA (${formattedDate})`;
  }
  return `Vence en ${daysUntilDue} días (${formattedDate})`;
}

export function getPushReminderKindLabel(kind: PushReminderKind): string {
  switch (kind) {
    case 'installment':
      return 'Cuota Cashea / Compra';
    case 'app_credit':
      return 'Crédito de App';
    case 'subscription':
      return 'Suscripción';
    case 'pending_expense':
      return 'Egreso Pendiente';
    case 'debt_payable':
      return 'Deuda por Pagar';
  }
}

/**
 * Escanea TODOS los egresos y pagos pendientes de la aplicación:
 * 1. Cuotas pendientes de Compras por Cuotas / Cashea (`creditPurchases`)
 * 2. Cuotas pendientes de Créditos de Apps (`appCredits`)
 * 3. Suscripciones activas (`subscriptions`)
 * 4. Movimientos de Gasto / Egreso en estado Pendiente y Listas de Mercado abiertas (`transactions`)
 * 5. Cuentas / Deudas por Pagar pendientes (`debts` payable y `p2pOperations` payable en tránsito)
 */
export function scanPushReminders(
  appData: AppDataSchema,
  config: PushNotificationConfig = loadPushNotificationConfig(),
  todayIso: string = getLocalTodayIso()
): PushReminderItem[] {
  const locale = appData.settings?.numberFormatLocale || 'es-VE';
  const items: PushReminderItem[] = [];

  // Set de IDs de transacciones que ya están vinculadas a cuotas de Cashea o Créditos de Apps
  // para no duplicar el mismo aviso como "Cuota" y como "Gasto Pendiente"
  const linkedInstallmentTxnIds = new Set<string>();
  for (const cp of appData.creditPurchases ?? []) {
    for (const inst of cp.installments ?? []) {
      if (inst.linkedTransactionId) {
        linkedInstallmentTxnIds.add(inst.linkedTransactionId);
      }
    }
  }
  for (const ac of appData.appCredits ?? []) {
    for (const inst of ac.installments ?? []) {
      if (inst.linkedTransactionId) {
        linkedInstallmentTxnIds.add(inst.linkedTransactionId);
      }
    }
  }

  // 1. Escanear Compras por Cuotas / Cashea (`creditPurchases`)
  if (config.notifyInstallments) {
    const purchases: CreditPurchase[] = appData.creditPurchases ?? [];
    for (const purchase of purchases) {
      if (purchase.status !== 'active') continue;
      const installments: CreditInstallment[] = purchase.installments ?? [];

      for (const inst of installments) {
        if (inst.status !== 'pending') continue;
        const paidProgress =
          typeof inst.paidProgressAmountUsd === 'number' &&
          Number.isFinite(inst.paidProgressAmountUsd)
            ? inst.paidProgressAmountUsd
            : (inst.partialPayments || []).reduce(
                (acc, p) => acc + (Number.isFinite(p.amountUsd) ? p.amountUsd : 0),
                0
              );
        const remainingUsd = Math.max(0, Number((inst.amountUsd - paidProgress).toFixed(2)));
        if (remainingUsd <= 0.005) continue;

        const daysUntilDue = calculateDaysUntilDue(inst.dueDate, todayIso);
        if (daysUntilDue < 0 && !config.notifyOverdue) continue;
        if (!config.showAllPendingInQueue && daysUntilDue > config.installmentDaysBefore) {
          continue;
        }

        const urgency: PushReminderUrgency =
          daysUntilDue < 0
            ? 'overdue'
            : daysUntilDue === 0
              ? 'due_today'
              : 'upcoming';

        const amountFormatted = formatearMonto(remainingUsd, 'USD', locale);
        const timingPhrase = buildDueTimingPhrase(daysUntilDue, inst.dueDate);

        const titlePrefix =
          urgency === 'overdue'
            ? '⚠️ Cuota Cashea vencida'
            : urgency === 'due_today'
              ? '🔔 Cuota Cashea vence HOY'
              : '🛍️ Cuota pendiente por pagar';

        const storeLabel = purchase.storeOrPlatform || 'Cashea';
        const title = `${titlePrefix}: ${storeLabel} (Cuota #${inst.number}/${purchase.installmentsCount})`;
        const body = `${purchase.concept} · Saldo cuota: ${amountFormatted} · ${timingPhrase}.`;
        const shortLabel = `${storeLabel} #${inst.number} (${amountFormatted}) — ${timingPhrase}`;

        items.push({
          id: `installment::${purchase.id}::${inst.id}`,
          kind: 'installment',
          section: 'installments',
          parentId: purchase.id,
          title,
          body,
          shortLabel,
          dueDate: inst.dueDate,
          daysUntilDue,
          urgency,
          amount: remainingUsd,
          currency: 'USD',
          amountUsd: remainingUsd,
          appNameOrService: `${storeLabel} · ${purchase.concept}`,
          installmentNumber: inst.number,
          totalInstallments: purchase.installmentsCount,
        });
      }
    }
  }

  // 2. Escanear Créditos de Apps (Ubii App, Avila Pay, Krece, Wepa, etc.)
  if (config.notifyAppCredits) {
    const appCredits: AppCredit[] = appData.appCredits ?? [];
    for (const credit of appCredits) {
      if (credit.status !== 'active') continue;
      const installments: AppCreditInstallment[] = credit.installments ?? [];

      for (const inst of installments) {
        if (inst.status !== 'pending') continue;
        const paidProgressCur =
          typeof inst.paidProgressAmount === 'number' &&
          Number.isFinite(inst.paidProgressAmount)
            ? inst.paidProgressAmount
            : 0;
        const paidProgressUsd =
          typeof inst.paidProgressAmountUsd === 'number' &&
          Number.isFinite(inst.paidProgressAmountUsd)
            ? inst.paidProgressAmountUsd
            : 0;
        const remainingNominal = Math.max(
          0,
          Number((inst.totalInstallmentAmount - paidProgressCur).toFixed(2))
        );
        const remainingUsd = Math.max(
          0,
          Number((inst.totalInstallmentAmountUsd - paidProgressUsd).toFixed(2))
        );
        if (remainingNominal <= 0.005) continue;

        const daysUntilDue = calculateDaysUntilDue(inst.dueDate, todayIso);
        if (daysUntilDue < 0 && !config.notifyOverdue) continue;
        if (!config.showAllPendingInQueue && daysUntilDue > config.appCreditDaysBefore) {
          continue;
        }

        const urgency: PushReminderUrgency =
          daysUntilDue < 0
            ? 'overdue'
            : daysUntilDue === 0
              ? 'due_today'
              : 'upcoming';

        const amountFormatted = formatearMonto(
          remainingNominal,
          credit.currency,
          locale
        );
        const timingPhrase = buildDueTimingPhrase(daysUntilDue, inst.dueDate);

        const titlePrefix =
          urgency === 'overdue'
            ? '⚠️ Cuota vencida'
            : urgency === 'due_today'
              ? '🔔 Cuota vence HOY'
              : '📱 Próxima cuota de App';

        const title = `${titlePrefix}: ${credit.appName} (Cuota #${inst.number}/${credit.installmentsCount})`;
        const body = `${credit.concept || credit.appName} · Monto: ${amountFormatted} · ${timingPhrase}.`;
        const shortLabel = `${credit.appName} #${inst.number} (${amountFormatted}) — ${timingPhrase}`;

        items.push({
          id: `app_credit::${credit.id}::${inst.id}`,
          kind: 'app_credit',
          section: 'app_credits',
          parentId: credit.id,
          title,
          body,
          shortLabel,
          dueDate: inst.dueDate,
          daysUntilDue,
          urgency,
          amount: remainingNominal,
          currency: credit.currency,
          amountUsd: remainingUsd,
          appNameOrService: credit.concept
            ? `${credit.appName} · ${credit.concept}`
            : credit.appName,
          installmentNumber: inst.number,
          totalInstallments: credit.installmentsCount,
        });
      }
    }
  }

  // 3. Escanear Suscripciones Activas
  if (config.notifySubscriptions) {
    const subscriptions: Subscription[] = appData.subscriptions ?? [];
    for (const sub of subscriptions) {
      if (sub.status !== 'active') continue;
      const daysUntilDue = calculateDaysUntilDue(sub.nextBillingDate, todayIso);
      const maxDays = config.respectSubscriptionAlertDays
        ? Math.max(0, sub.alertDaysBefore ?? config.subscriptionDaysBefore)
        : config.subscriptionDaysBefore;

      if (daysUntilDue < 0 && !config.notifyOverdue) continue;
      if (!config.showAllPendingInQueue && daysUntilDue > maxDays) continue;

      const urgency: PushReminderUrgency =
        daysUntilDue < 0
          ? 'overdue'
          : daysUntilDue === 0
            ? 'due_today'
            : 'upcoming';

      const amountFormatted = formatearMonto(sub.amount, sub.currency, locale);
      const timingPhrase = buildDueTimingPhrase(
        daysUntilDue,
        sub.nextBillingDate
      );

      const titlePrefix =
        urgency === 'overdue'
          ? '⚠️ Suscripción vencida'
          : urgency === 'due_today'
            ? '🔔 Cobro de suscripción HOY'
            : '📅 Próximo pago de suscripción';

      const title = `${titlePrefix}: ${sub.name}`;
      const body = `Renovación por ${amountFormatted} · ${timingPhrase}.`;
      const shortLabel = `Suscripción ${sub.name} (${amountFormatted}) — ${timingPhrase}`;

      items.push({
        id: `subscription::${sub.id}::${sub.nextBillingDate}`,
        kind: 'subscription',
        section: 'subscriptions',
        parentId: sub.id,
        title,
        body,
        shortLabel,
        dueDate: sub.nextBillingDate,
        daysUntilDue,
        urgency,
        amount: sub.amount,
        currency: sub.currency,
        amountUsd: sub.amountUsd,
        appNameOrService: sub.name,
      });
    }
  }

  // 4. Escanear todos los Gastos / Egresos Pendientes (`data.transactions` con status === 'pending')
  if (config.notifyPendingExpenses) {
    const thirdPartyWalletIds = new Set(
      (appData.wallets ?? [])
        .filter((w) => w.isThirdPartyExpenseAccount)
        .map((w) => w.id)
    );

    const transactions: Transaction[] = appData.transactions ?? [];
    for (const txn of transactions) {
      if (esTransaccionCompletada(txn)) continue;
      if (linkedInstallmentTxnIds.has(txn.id)) continue;

      const isThirdPartyMov =
        Boolean(txn.isThirdPartyAllowance) ||
        Boolean(txn.walletId && thirdPartyWalletIds.has(txn.walletId)) ||
        Boolean(
          txn.thirdPartyTargetWalletId &&
            thirdPartyWalletIds.has(txn.thirdPartyTargetWalletId)
        );
      const effectiveType = isThirdPartyMov ? 'expense' : txn.type;
      if (effectiveType !== 'expense') continue;

      const valUsd = Number.isFinite(txn.amountUsd) ? txn.amountUsd : 0;
      const valNominal = Number.isFinite(txn.amount) ? txn.amount : valUsd;
      if (valUsd <= 0.001 && valNominal <= 0.001) continue;

      const dueDate = txn.date || todayIso;
      const daysUntilDue = calculateDaysUntilDue(dueDate, todayIso);
      if (daysUntilDue < 0 && !config.notifyOverdue) continue;
      if (!config.showAllPendingInQueue && daysUntilDue > config.pendingExpenseDaysBefore) {
        continue;
      }

      const urgency: PushReminderUrgency =
        daysUntilDue < 0
          ? 'overdue'
          : daysUntilDue === 0
            ? 'due_today'
            : 'upcoming';

      const amountFormatted = formatearMonto(valNominal, txn.currency, locale);
      const timingPhrase = buildDueTimingPhrase(daysUntilDue, dueDate);
      const isMarketListPending = (txn.description || '').includes('[Lista de Mercado]');
      const targetSection: NavigationSection = isMarketListPending
        ? 'market'
        : 'movements';

      const titlePrefix =
        urgency === 'overdue'
          ? '⚠️ Egreso pendiente vencido'
          : urgency === 'due_today'
            ? '🔔 Pago pendiente para HOY'
            : '💸 Pago / Egreso pendiente';

      const cleanDesc = (txn.description || 'Gasto pendiente').trim();
      const title = `${titlePrefix}: ${cleanDesc}`;
      const body = `Monto pendiente: ${amountFormatted}${
        txn.paymentMethod ? ` (${txn.paymentMethod})` : ''
      } · ${timingPhrase}.`;
      const shortLabel = `${cleanDesc} (${amountFormatted}) — ${timingPhrase}`;

      items.push({
        id: `pending_expense::${txn.id}`,
        kind: 'pending_expense',
        section: targetSection,
        parentId: txn.id,
        title,
        body,
        shortLabel,
        dueDate,
        daysUntilDue,
        urgency,
        amount: valNominal,
        currency: txn.currency,
        amountUsd: valUsd,
        appNameOrService: cleanDesc,
      });
    }
  }

  // 5. Escanear Deudas por Pagar (`debts` con kind === 'payable') y Compromisos P2P por Entregar
  if (config.notifyDebtsPayable) {
    const debts: Debt[] = appData.debts ?? [];
    for (const debt of debts) {
      if (debt.kind !== 'payable') continue;
      const st = calcularEstadoDeuda(debt);
      if (debt.status === 'paid' || st.pendienteUsd <= 0.005) continue;

      const dueDate = debt.dueDate || debt.loanDate || todayIso;
      const daysUntilDue = debt.dueDate
        ? calculateDaysUntilDue(debt.dueDate, todayIso)
        : 0;

      if (debt.dueDate && daysUntilDue < 0 && !config.notifyOverdue) continue;
      if (
        debt.dueDate &&
        !config.showAllPendingInQueue &&
        daysUntilDue > config.debtPayableDaysBefore
      ) {
        continue;
      }

      const urgency: PushReminderUrgency = !debt.dueDate
        ? 'upcoming'
        : daysUntilDue < 0
          ? 'overdue'
          : daysUntilDue === 0
            ? 'due_today'
            : 'upcoming';

      const remainingNominal =
        debt.currency === 'VES' && debt.exchangeRate && debt.exchangeRate > 0
          ? Number((st.pendienteUsd * debt.exchangeRate).toFixed(2))
          : Number(st.pendienteUsd.toFixed(2));

      const amountFormatted = formatearMonto(
        remainingNominal,
        debt.currency,
        locale
      );
      const timingPhrase = debt.dueDate
        ? buildDueTimingPhrase(daysUntilDue, debt.dueDate)
        : 'Sin fecha límite fija (Deuda activa por pagar)';

      const titlePrefix =
        urgency === 'overdue'
          ? '⚠️ Deuda por pagar vencida'
          : urgency === 'due_today'
            ? '🔔 Deuda por pagar vence HOY'
            : '🤝 Cuenta por pagar pendiente';

      const labelName = `${debt.creditor} · ${debt.description}`;
      const title = `${titlePrefix}: ${debt.creditor}`;
      const body = `${debt.description} · Saldo pendiente: ${amountFormatted} · ${timingPhrase}.`;
      const shortLabel = `Debo a ${debt.creditor} (${amountFormatted}) — ${timingPhrase}`;

      items.push({
        id: `debt_payable::${debt.id}`,
        kind: 'debt_payable',
        section: 'debts',
        parentId: debt.id,
        title,
        body,
        shortLabel,
        dueDate,
        daysUntilDue,
        urgency,
        amount: remainingNominal,
        currency: debt.currency,
        amountUsd: st.pendienteUsd,
        appNameOrService: labelName,
      });
    }

    const p2pOps: P2POperation[] = appData.p2pOperations ?? [];
    for (const op of p2pOps) {
      if (op.status !== 'in_transit' || op.direction !== 'payable') continue;
      const dueDate = op.estimatedSettlementDate || op.operationDate || todayIso;
      const daysUntilDue = calculateDaysUntilDue(dueDate, todayIso);
      const urgency: PushReminderUrgency =
        daysUntilDue < 0
          ? 'overdue'
          : daysUntilDue === 0
            ? 'due_today'
            : 'upcoming';

      const amountFormatted = formatearMonto(
        op.expectedAmount,
        op.expectedCurrency,
        locale
      );
      const labelName = `Compromiso P2P · ${op.contactName}`;
      const title = `🔄 Compromiso P2P por pagar: ${op.contactName}`;
      const body = `${op.concept} · Pendiente por entregar: ${amountFormatted}.`;
      const shortLabel = `P2P ${op.contactName} (${amountFormatted})`;

      items.push({
        id: `p2p_payable::${op.id}`,
        kind: 'debt_payable',
        section: 'debts',
        parentId: op.id,
        title,
        body,
        shortLabel,
        dueDate,
        daysUntilDue,
        urgency,
        amount: op.expectedAmount,
        currency: op.expectedCurrency,
        amountUsd: op.deliveredAmountUsd || op.expectedAmount,
        appNameOrService: labelName,
      });
    }
  }

  // Ordenar por urgencia (más vencidos/próximos primero) y luego por monto USD descendente
  items.sort((a, b) => {
    if (a.daysUntilDue !== b.daysUntilDue) {
      return a.daysUntilDue - b.daysUntilDue;
    }
    return b.amountUsd - a.amountUsd;
  });

  return items;
}

/**
 * Obtiene el estado actual del soporte de Notificaciones y del Service Worker de la PWA
 */
export async function getPushEnvironmentStatus(): Promise<PushEnvironmentStatus> {
  const notificationSupported =
    typeof window !== 'undefined' && 'Notification' in window;
  const serviceWorkerSupported =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  const permission: PushPermissionStatus = notificationSupported
    ? (Notification.permission as PushPermissionStatus)
    : 'unsupported';

  let serviceWorkerReady = false;
  let periodicSyncSupported = false;

  if (serviceWorkerSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && (reg.active || reg.waiting || reg.installing)) {
        serviceWorkerReady = true;
        periodicSyncSupported = 'periodicSync' in reg;
      }
    } catch {
      serviceWorkerReady = false;
    }
  }

  return {
    notificationSupported,
    serviceWorkerSupported,
    permission,
    serviceWorkerReady,
    periodicSyncSupported,
  };
}

/**
 * Obtiene el Service Worker Registration activo (con timeout de seguridad para evitar bloqueos)
 */
async function getActiveServiceWorkerRegistration(
  timeoutMs = 2500
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing && existing.active) {
      return existing;
    }

    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );
    const reg = await Promise.race([readyPromise, timeoutPromise]);
    return reg;
  } catch {
    return null;
  }
}

/**
 * Solicita permiso de notificaciones al navegador y registra Periodic Sync si está disponible
 */
export async function requestPushNotificationPermission(): Promise<{
  permission: PushPermissionStatus;
  serviceWorkerReady: boolean;
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      permission: 'unsupported',
      serviceWorkerReady: false,
      message:
        'Este navegador no soporta la API nativa de Notificaciones Push. Se mostrarán alertas integradas en pantalla.',
    };
  }

  let permission: PushPermissionStatus =
    Notification.permission as PushPermissionStatus;

  try {
    if (permission !== 'granted') {
      const result = await Notification.requestPermission();
      permission = result as PushPermissionStatus;
    }
  } catch {
    permission = Notification.permission as PushPermissionStatus;
  }

  const reg = await getActiveServiceWorkerRegistration();

  if (reg && 'periodicSync' in reg && permission === 'granted') {
    try {
      const periodicSyncManager = (
        reg as ServiceWorkerRegistration & {
          periodicSync?: {
            register: (
              tag: string,
              options: { minInterval: number }
            ) => Promise<void>;
          };
        }
      ).periodicSync;
      if (periodicSyncManager) {
        await periodicSyncManager.register('mis-finanzas-reminders-sync', {
          minInterval: 12 * 60 * 60 * 1000,
        });
      }
    } catch {
      // Periodic sync es opcional según navegador/instalación PWA
    }
  }

  if (permission === 'granted') {
    return {
      permission: 'granted',
      serviceWorkerReady: Boolean(reg),
      message: reg
        ? 'Notificaciones Push activadas para todos tus pagos y egresos pendientes.'
        : 'Permiso de notificaciones concedido en el navegador.',
    };
  }

  if (permission === 'denied') {
    return {
      permission: 'denied',
      serviceWorkerReady: Boolean(reg),
      message:
        'El permiso nativo fue bloqueado por el navegador o vista previa. Tus recordatorios seguirán activos mediante el Centro Push integrado.',
    };
  }

  return {
    permission,
    serviceWorkerReady: Boolean(reg),
    message:
      'En vistas previas embebidas el navegador puede restringir el diálogo nativo; el Service Worker y los avisos en la app están listos.',
  };
}

/**
 * Envía una notificación Push real a través del Service Worker de la PWA
 * (con respaldo a Notification API o alerta en aplicación si el contenedor bloquea permisos nativos)
 */
export async function dispatchPushNotification(payload: {
  title: string;
  body: string;
  tag?: string;
  section?: NavigationSection;
  itemId?: string;
  kind?: PushReminderKind | 'test' | 'summary';
  dueDate?: string;
  requireInteraction?: boolean;
}): Promise<PushDispatchResult> {
  const canUseNative =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted';

  if (canUseNative) {
    const reg = await getActiveServiceWorkerRegistration();

    if (reg) {
      try {
        if (reg.active) {
          reg.active.postMessage({
            type: 'SHOW_PUSH_NOTIFICATION',
            payload,
          });
          return {
            delivered: true,
            channel: 'service-worker',
            title: payload.title,
            body: payload.body,
          };
        }

        await reg.showNotification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: payload.tag || `mis-finanzas-${Date.now()}`,
          data: {
            section: payload.section || 'dashboard',
            itemId: payload.itemId || null,
            kind: payload.kind || 'summary',
            dueDate: payload.dueDate || null,
          },
        });

        return {
          delivered: true,
          channel: 'service-worker',
          title: payload.title,
          body: payload.body,
        };
      } catch {
        // Fallback a Notification API
      }
    }

    try {
      new Notification(payload.title, {
        body: payload.body,
        icon: '/pwa-192x192.png',
        tag: payload.tag || `mis-finanzas-${Date.now()}`,
      });
      return {
        delivered: true,
        channel: 'notification-api',
        title: payload.title,
        body: payload.body,
      };
    } catch (err) {
      return {
        delivered: true,
        channel: 'in-app-fallback',
        title: payload.title,
        body: payload.body,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    delivered: true,
    channel: 'in-app-fallback',
    title: payload.title,
    body: payload.body,
  };
}

function loadSentLog(): Record<string, string> {
  try {
    const raw = localStorage.getItem(PUSH_SENT_LOG_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveSentLog(log: Record<string, string>, todayIso: string): void {
  try {
    const cleaned: Record<string, string> = {};
    for (const [key, dateVal] of Object.entries(log)) {
      if (dateVal === todayIso) {
        cleaned[key] = dateVal;
      }
    }
    localStorage.setItem(PUSH_SENT_LOG_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export function clearTodayPushSentLog(): void {
  try {
    localStorage.removeItem(PUSH_SENT_LOG_STORAGE_KEY);
  } catch {
    // Ignorar
  }
}

/**
 * Sincroniza la cola de recordatorios de TODOS los egresos pendientes con el Service Worker de la PWA y dispara
 * automáticamente notificaciones Push para los vencimientos que aún no se han notificado hoy.
 */
export async function syncAndDispatchDueReminders(
  appData: AppDataSchema,
  options?: {
    forceAll?: boolean;
    config?: PushNotificationConfig;
  }
): Promise<{
  reminders: PushReminderItem[];
  dispatchedCount: number;
  lastResult: PushDispatchResult | null;
}> {
  const config = options?.config ?? loadPushNotificationConfig();
  const todayIso = getLocalTodayIso();
  const reminders = scanPushReminders(appData, config, todayIso);

  try {
    const reg = await getActiveServiceWorkerRegistration(1500);
    if (reg?.active) {
      reg.active.postMessage({
        type: 'SYNC_PUSH_REMINDERS',
        reminders: reminders.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          shortLabel: r.shortLabel,
          section: r.section,
          itemId: r.parentId,
          urgency: r.urgency,
          dueDate: r.dueDate,
        })),
      });
    }
  } catch {
    // Continuar si el SW aún se está instalando
  }

  if (!config.enabled || reminders.length === 0) {
    return {
      reminders,
      dispatchedCount: 0,
      lastResult: null,
    };
  }

  const sentLog = loadSentLog();
  // Si no es forceAll, al iniciar la app notificamos los que están dentro de la ventana de alerta o vencidos/hoy
  // (o todos si el usuario pulsa enviar ahora)
  const candidates = options?.forceAll
    ? reminders
    : reminders.filter((r) => {
        if (sentLog[r.id] === todayIso) return false;
        if (r.urgency === 'overdue' || r.urgency === 'due_today') return true;
        if (r.kind === 'installment') return r.daysUntilDue <= config.installmentDaysBefore;
        if (r.kind === 'app_credit') return r.daysUntilDue <= config.appCreditDaysBefore;
        if (r.kind === 'subscription') return r.daysUntilDue <= config.subscriptionDaysBefore;
        if (r.kind === 'pending_expense') return r.daysUntilDue <= config.pendingExpenseDaysBefore;
        if (r.kind === 'debt_payable') return r.daysUntilDue <= config.debtPayableDaysBefore;
        return true;
      });

  if (candidates.length === 0) {
    return {
      reminders,
      dispatchedCount: 0,
      lastResult: null,
    };
  }

  let lastResult: PushDispatchResult | null = null;
  let dispatchedCount = 0;

  if (candidates.length <= 2) {
    for (const item of candidates) {
      lastResult = await dispatchPushNotification({
        title: item.title,
        body: item.body,
        tag: `reminder-${item.id}`,
        section: item.section,
        itemId: item.parentId,
        kind: item.kind,
        dueDate: item.dueDate,
        requireInteraction: item.urgency !== 'upcoming',
      });
      sentLog[item.id] = todayIso;
      dispatchedCount++;
    }
  } else {
    const mostUrgent = candidates[0];
    await dispatchPushNotification({
      title: mostUrgent.title,
      body: mostUrgent.body,
      tag: `reminder-${mostUrgent.id}`,
      section: mostUrgent.section,
      itemId: mostUrgent.parentId,
      kind: mostUrgent.kind,
      dueDate: mostUrgent.dueDate,
      requireInteraction: mostUrgent.urgency !== 'upcoming',
    });

    const installmentsCount = candidates.filter((r) => r.kind === 'installment').length;
    const appCreditsCount = candidates.filter((r) => r.kind === 'app_credit').length;
    const subsCount = candidates.filter((r) => r.kind === 'subscription').length;
    const pendingExpCount = candidates.filter((r) => r.kind === 'pending_expense').length;
    const debtsCount = candidates.filter((r) => r.kind === 'debt_payable').length;

    const parts: string[] = [];
    if (installmentsCount > 0) parts.push(`${installmentsCount} cuota(s) Cashea/Compras`);
    if (appCreditsCount > 0) parts.push(`${appCreditsCount} cuota(s) de Apps`);
    if (subsCount > 0) parts.push(`${subsCount} suscripción(es)`);
    if (pendingExpCount > 0) parts.push(`${pendingExpCount} egreso(s) pendiente(s)`);
    if (debtsCount > 0) parts.push(`${debtsCount} deuda(s) por pagar`);

    lastResult = await dispatchPushNotification({
      title: `🔔 ${candidates.length} pagos pendientes en Mis Finanzas`,
      body: `Tienes ${parts.join(', ')} por atender. Pulsa para revisar tus compromisos.`,
      tag: `reminder-summary-${todayIso}`,
      section: mostUrgent.section,
      itemId: mostUrgent.parentId,
      kind: 'summary',
    });

    for (const item of candidates) {
      sentLog[item.id] = todayIso;
    }
    dispatchedCount = candidates.length;
  }

  saveSentLog(sentLog, todayIso);

  return {
    reminders,
    dispatchedCount,
    lastResult,
  };
}
