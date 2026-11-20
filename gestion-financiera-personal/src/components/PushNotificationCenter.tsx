import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  HandCoins,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { AppDataSchema, NavigationSection } from '../types/finance';
import { formatearMonto } from '../services/bcvApi';
import {
  clearTodayPushSentLog,
  dispatchPushNotification,
  getPushEnvironmentStatus,
  getPushReminderKindLabel,
  loadPushNotificationConfig,
  PushEnvironmentStatus,
  PushNotificationConfig,
  PushReminderItem,
  PushReminderKind,
  requestPushNotificationPermission,
  savePushNotificationConfig,
  scanPushReminders,
  syncAndDispatchDueReminders,
} from '../services/pushNotifications';

interface PushNotificationBellButtonProps {
  reminders: PushReminderItem[];
  config: PushNotificationConfig;
  permission: string;
  onClick: () => void;
}

/**
 * Botón de campana para la barra superior (Header) con contador de TODOS los pagos
 * y egresos pendientes (Cashea/Cuotas, Créditos de Apps, Suscripciones, Gastos Pendientes y Deudas por Pagar).
 */
export const PushNotificationBellButton: React.FC<
  PushNotificationBellButtonProps
> = ({ reminders, config, permission, onClick }) => {
  const urgentCount = useMemo(
    () =>
      reminders.filter(
        (r) => r.urgency === 'overdue' || r.urgency === 'due_today'
      ).length,
    [reminders]
  );
  const totalCount = reminders.length;
  const isPushActive = config.enabled && permission === 'granted';

  return (
    <button
      type="button"
      onClick={onClick}
      title="Centro de Notificaciones Push (Todos tus pagos y egresos pendientes)"
      aria-label="Abrir centro de recordatorios y notificaciones Push de pagos pendientes"
      className="relative p-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:bg-[var(--pink-light)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
    >
      {isPushActive ? (
        <BellRing className="w-4 h-4 text-[var(--pink-primary)]" />
      ) : (
        <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
      )}
      <span className="hidden sm:inline text-xs font-medium">Alertas Push</span>

      {totalCount > 0 && (
        <span
          className={`px-1.5 py-0.5 text-[10px] font-bold font-mono-tabular rounded-full leading-none ${
            urgentCount > 0
              ? 'bg-[var(--expense-color)] text-white'
              : 'bg-[var(--pink-primary)] text-white'
          }`}
        >
          {totalCount}
        </span>
      )}

      {isPushActive && totalCount === 0 && (
        <span
          className="w-2 h-2 rounded-full bg-[var(--income-color)]"
          title="Service Worker Push activo"
        />
      )}
    </button>
  );
};

interface PushModuleInlineBarProps {
  kind: PushReminderKind;
  appData: AppDataSchema;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenPushCenter?: () => void;
}

/**
 * Barra compacta para incrustar dentro de cualquier módulo (Cuotas, Créditos de Apps,
 * Suscripciones, Movimientos o Deudas), permitiendo activar permisos Push del Service Worker,
 * ajustar los días de anticipación y probar una notificación real al instante.
 */
export const PushModuleInlineBar: React.FC<PushModuleInlineBarProps> = ({
  kind,
  appData,
  showToast,
  onOpenPushCenter,
}) => {
  const [config, setConfig] = useState<PushNotificationConfig>(() =>
    loadPushNotificationConfig()
  );
  const [envStatus, setEnvStatus] = useState<PushEnvironmentStatus>({
    notificationSupported: true,
    serviceWorkerSupported: true,
    permission: 'default',
    serviceWorkerReady: false,
    periodicSyncSupported: false,
  });
  const [sendingTest, setSendingTest] = useState(false);

  const refreshStatus = async () => {
    const status = await getPushEnvironmentStatus();
    setEnvStatus(status);
    setConfig(loadPushNotificationConfig());
  };

  useEffect(() => {
    refreshStatus();
    const handleStorage = () => {
      setConfig(loadPushNotificationConfig());
    };
    window.addEventListener('push-config-updated', handleStorage);
    return () =>
      window.removeEventListener('push-config-updated', handleStorage);
  }, []);

  const moduleReminders = useMemo(() => {
    const all = scanPushReminders(appData, config);
    return all.filter((r) => r.kind === kind);
  }, [appData, config, kind]);

  const isModuleEnabled =
    config.enabled &&
    (kind === 'installment'
      ? config.notifyInstallments
      : kind === 'app_credit'
        ? config.notifyAppCredits
        : kind === 'subscription'
          ? config.notifySubscriptions
          : kind === 'pending_expense'
            ? config.notifyPendingExpenses
            : config.notifyDebtsPayable);

  const kindDisplayName = getPushReminderKindLabel(kind);

  const handleToggleModulePush = async () => {
    const nextEnabled = !isModuleEnabled;
    const nextConfig: PushNotificationConfig = {
      ...config,
      enabled: nextEnabled ? true : config.enabled,
      notifyInstallments:
        kind === 'installment' ? nextEnabled : config.notifyInstallments,
      notifyAppCredits:
        kind === 'app_credit' ? nextEnabled : config.notifyAppCredits,
      notifySubscriptions:
        kind === 'subscription' ? nextEnabled : config.notifySubscriptions,
      notifyPendingExpenses:
        kind === 'pending_expense' ? nextEnabled : config.notifyPendingExpenses,
      notifyDebtsPayable:
        kind === 'debt_payable' ? nextEnabled : config.notifyDebtsPayable,
    };

    savePushNotificationConfig(nextConfig);
    setConfig(nextConfig);
    window.dispatchEvent(new Event('push-config-updated'));

    if (nextEnabled && envStatus.permission !== 'granted') {
      const res = await requestPushNotificationPermission();
      await refreshStatus();
      showToast(
        res.message,
        res.permission === 'granted' ? 'success' : 'info'
      );
    } else {
      showToast(
        nextEnabled
          ? `Recordatorios Push activados para ${kindDisplayName}.`
          : `Recordatorios Push silenciados para ${kindDisplayName}.`,
        'info'
      );
    }
  };

  const handleDaysChange = (days: number) => {
    const nextConfig: PushNotificationConfig =
      kind === 'installment'
        ? { ...config, installmentDaysBefore: days }
        : kind === 'app_credit'
          ? { ...config, appCreditDaysBefore: days }
          : kind === 'subscription'
            ? {
                ...config,
                respectSubscriptionAlertDays: false,
                subscriptionDaysBefore: days,
              }
            : kind === 'pending_expense'
              ? { ...config, pendingExpenseDaysBefore: days }
              : { ...config, debtPayableDaysBefore: days };

    savePushNotificationConfig(nextConfig);
    setConfig(nextConfig);
    window.dispatchEvent(new Event('push-config-updated'));
    showToast(
      `Anticipación de alerta Push actualizada a ${days} día(s) antes del vencimiento.`,
      'success'
    );
  };

  const handleTriggerModuleNotification = async () => {
    setSendingTest(true);
    try {
      if (envStatus.permission !== 'granted') {
        await requestPushNotificationPermission();
        await refreshStatus();
      }

      if (moduleReminders.length > 0) {
        const first = moduleReminders[0];
        const res = await dispatchPushNotification({
          title: first.title,
          body: first.body,
          section: first.section,
          itemId: first.parentId,
          kind: first.kind,
          dueDate: first.dueDate,
          tag: `manual-${first.id}-${Date.now()}`,
        });

        showToast(
          res.channel === 'service-worker'
            ? `Notificación enviada vía Service Worker: "${first.title}"`
            : `${first.title} — ${first.body}`,
          'success'
        );
      } else {
        const demoTitle = `🔔 Recordatorio Push · ${kindDisplayName}`;
        const demoBody =
          'El Service Worker de la PWA supervisa todos tus egresos pendientes, cuotas de Cashea, créditos de apps, suscripciones y deudas por pagar.';

        const res = await dispatchPushNotification({
          title: demoTitle,
          body: demoBody,
          section:
            kind === 'installment'
              ? 'installments'
              : kind === 'app_credit'
                ? 'app_credits'
                : kind === 'subscription'
                  ? 'subscriptions'
                  : kind === 'pending_expense'
                    ? 'movements'
                    : 'debts',
          kind: 'test',
          tag: `test-${kind}-${Date.now()}`,
        });

        showToast(
          res.channel === 'service-worker'
            ? 'Notificación Push de prueba disparada por el Service Worker de la PWA.'
            : `${demoTitle}: ${demoBody}`,
          'success'
        );
      }
    } finally {
      setSendingTest(false);
    }
  };

  const currentDays =
    kind === 'installment'
      ? config.installmentDaysBefore
      : kind === 'app_credit'
        ? config.appCreditDaysBefore
        : kind === 'subscription'
          ? config.subscriptionDaysBefore
          : kind === 'pending_expense'
            ? config.pendingExpenseDaysBefore
            : config.debtPayableDaysBefore;

  return (
    <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-start sm:items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isModuleEnabled
              ? 'bg-[var(--pink-light)] text-[var(--pink-primary)]'
              : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
          }`}
        >
          {isModuleEnabled ? (
            <BellRing className="w-4 h-4" />
          ) : (
            <BellOff className="w-4 h-4" />
          )}
        </div>
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              Notificaciones Push · {kindDisplayName} (Todo Egreso Pendiente)
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                envStatus.serviceWorkerReady
                  ? 'bg-[var(--income-bg)] text-[var(--income-color)]'
                  : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {envStatus.serviceWorkerReady ? 'SW Activo' : 'SW Inicializando'}
            </span>
            {moduleReminders.length > 0 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--pink-light)] text-[var(--pink-primary)] font-mono-tabular">
                {moduleReminders.length}{' '}
                {moduleReminders.length === 1
                  ? 'pendiente activo'
                  : 'pendientes activos'}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Supervisa automáticamente este módulo y el resto de tus egresos pendientes (Cashea, Créditos de Apps, Suscripciones, Gastos Pendientes y Deudas).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[var(--surface-subtle)] px-2.5 py-1.5 rounded-xl border border-[var(--border-hairline)] text-xs">
          <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
            Avisar antes:
          </span>
          <select
            value={currentDays}
            onChange={(e) => handleDaysChange(Number(e.target.value))}
            aria-label="Días de anticipación para notificación Push"
            className="bg-transparent font-mono-tabular font-semibold text-xs text-[var(--text-primary)] focus:outline-none"
          >
            <option value={0}>Mismo día</option>
            <option value={1}>1 día</option>
            <option value={2}>2 días</option>
            <option value={3}>3 días</option>
            <option value={5}>5 días</option>
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleToggleModulePush}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            isModuleEnabled
              ? 'bg-[var(--income-bg)] text-[var(--income-color)]'
              : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
          }`}
        >
          {isModuleEnabled ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Alertas Activas</span>
            </>
          ) : (
            <>
              <BellOff className="w-3.5 h-3.5" />
              <span>Activar Alertas</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleTriggerModuleNotification}
          disabled={sendingTest}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>
            {sendingTest
              ? 'Enviando...'
              : moduleReminders.length > 0
                ? 'Notificar ahora'
                : 'Probar Push SW'}
          </span>
        </button>

        {onOpenPushCenter && (
          <button
            type="button"
            onClick={onOpenPushCenter}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] transition-colors"
          >
            Centro Push (Todos)
          </button>
        )}
      </div>
    </div>
  );
};

interface PushNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  appData: AppDataSchema;
  locale: string;
  onNavigateSection: (section: NavigationSection) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Modal completo del Centro de Notificaciones Push integrado con el Service Worker de la PWA.
 * Cubre TODOS los egresos pendientes de la app.
 */
export const PushNotificationModal: React.FC<PushNotificationModalProps> = ({
  isOpen,
  onClose,
  appData,
  locale,
  onNavigateSection,
}) => {
  const [config, setConfig] = useState<PushNotificationConfig>(() =>
    loadPushNotificationConfig()
  );
  const [filterKind, setFilterKind] = useState<PushReminderKind | 'all'>('all');

  useEffect(() => {
    if (isOpen) {
      setConfig(loadPushNotificationConfig());
    }
  }, [isOpen]);

  const reminders = useMemo(
    () => scanPushReminders(appData, config),
    [appData, config]
  );

  const installmentReminders = useMemo(
    () => reminders.filter((r) => r.kind === 'installment'),
    [reminders]
  );
  const appCreditReminders = useMemo(
    () => reminders.filter((r) => r.kind === 'app_credit'),
    [reminders]
  );
  const subscriptionReminders = useMemo(
    () => reminders.filter((r) => r.kind === 'subscription'),
    [reminders]
  );
  const pendingExpenseReminders = useMemo(
    () => reminders.filter((r) => r.kind === 'pending_expense'),
    [reminders]
  );
  const debtPayableReminders = useMemo(
    () => reminders.filter((r) => r.kind === 'debt_payable'),
    [reminders]
  );

  const visibleReminders = useMemo(
    () =>
      filterKind === 'all'
        ? reminders
        : reminders.filter((r) => r.kind === filterKind),
    [reminders, filterKind]
  );

  const totalPendingUsd = useMemo(
    () => reminders.reduce((acc, r) => acc + (r.amountUsd || 0), 0),
    [reminders]
  );

  if (!isOpen) return null;

  const getBadgeStyle = (kind: PushReminderKind) => {
    switch (kind) {
      case 'installment':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30';
      case 'app_credit':
        return 'bg-[var(--pink-light)] text-[var(--pink-primary)]';
      case 'subscription':
        return 'bg-[var(--lavender-soft)] text-[var(--lavender-text)]';
      case 'pending_expense':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30';
      case 'debt_payable':
        return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabecera limpia de Notificaciones */}
        <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3 bg-[var(--surface-subtle)]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center shrink-0 border border-[var(--pink-primary)]/20">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  Notificaciones de Pagos Pendientes
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-[var(--expense-bg)] text-[var(--expense-color)] font-mono-tabular text-[11px] font-bold">
                  {reminders.length} {reminders.length === 1 ? 'alerta' : 'alertas'} ·{' '}
                  {formatearMonto(totalPendingUsd, 'USD', locale)}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Tus próximos vencimientos de Cashea, Créditos de Apps, Suscripciones, Gastos Pendientes y Deudas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onNavigateSection('settings');
                onClose();
              }}
              title="Configurar qué notificaciones quieres recibir en Configuración"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
            >
              ⚙️ Configurar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo desplazable: SOLO filtros y lista de notificaciones */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Filtros por tipo */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterKind('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterKind === 'all'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Todas ({reminders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('installment')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterKind === 'installment'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Cashea / Cuotas ({installmentReminders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('app_credit')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterKind === 'app_credit'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Créditos Apps ({appCreditReminders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('subscription')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterKind === 'subscription'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Suscripciones ({subscriptionReminders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('pending_expense')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterKind === 'pending_expense'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Gastos Pendientes ({pendingExpenseReminders.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('debt_payable')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filterKind === 'debt_payable'
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Deudas ({debtPayableReminders.length})
              </button>
            </div>
          </div>

          {/* Lista de Notificaciones Detectadas */}
          <div className="space-y-2.5">
            {visibleReminders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[var(--income-color)] mx-auto" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  No tienes notificaciones pendientes en esta categoría
                </p>
                <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                  Cuando tengas una cuota de Cashea, crédito de app, suscripción, gasto pendiente o deuda próxima a vencer, aparecerá aquí automáticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleReminders.map((item) => {
                  const isOverdue = item.urgency === 'overdue';
                  const isToday = item.urgency === 'due_today';

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[var(--pink-primary)]/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isOverdue
                              ? 'bg-[var(--expense-bg)] text-[var(--expense-color)]'
                              : isToday
                                ? 'bg-[var(--pink-light)] text-[var(--pink-primary)]'
                                : 'bg-[var(--lavender-soft)] text-[var(--lavender-accent)]'
                          }`}
                        >
                          {isOverdue ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : isToday ? (
                            <BellRing className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getBadgeStyle(
                                item.kind
                              )}`}
                            >
                              {getPushReminderKindLabel(item.kind)}
                            </span>
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {item.appNameOrService}
                            </span>
                            {item.installmentNumber && (
                              <span className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                                (Cuota #{item.installmentNumber}/
                                {item.totalInstallments})
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[var(--text-secondary)]">
                            {item.body}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <div className="text-right mr-1">
                          <div className="text-xs font-bold font-mono-tabular text-[var(--text-primary)]">
                            {formatearMonto(item.amount, item.currency, locale)}
                          </div>
                          {item.currency === 'VES' && (
                            <div className="text-[10px] font-mono-tabular text-[var(--text-secondary)]">
                              ≈ {formatearMonto(item.amountUsd, 'USD', locale)}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onNavigateSection(item.section);
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[var(--pink-primary)] text-white text-xs font-semibold hover:bg-[var(--pink-dark)] transition-colors flex items-center gap-1"
                        >
                          <span>Ir a pagar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PushNotificationSettingsPanelProps {
  appData: AppDataSchema;
  locale: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Panel de Configuración de Notificaciones y Alertas Push ubicado en la sección "Configuración".
 */
export const PushNotificationSettingsPanel: React.FC<
  PushNotificationSettingsPanelProps
> = ({ appData, locale, showToast }) => {
  const [config, setConfig] = useState<PushNotificationConfig>(() =>
    loadPushNotificationConfig()
  );
  const [envStatus, setEnvStatus] = useState<PushEnvironmentStatus>({
    notificationSupported: true,
    serviceWorkerSupported: true,
    permission: 'default',
    serviceWorkerReady: false,
    periodicSyncSupported: false,
  });
  const [dispatching, setDispatching] = useState(false);

  const refreshEnv = async () => {
    const status = await getPushEnvironmentStatus();
    setEnvStatus(status);
    setConfig(loadPushNotificationConfig());
  };

  useEffect(() => {
    refreshEnv();
    const handleUpdated = () => {
      setConfig(loadPushNotificationConfig());
    };
    window.addEventListener('push-config-updated', handleUpdated);
    return () =>
      window.removeEventListener('push-config-updated', handleUpdated);
  }, []);

  const reminders = useMemo(
    () => scanPushReminders(appData, config),
    [appData, config]
  );

  const totalPendingUsd = useMemo(
    () => reminders.reduce((acc, r) => acc + (r.amountUsd || 0), 0),
    [reminders]
  );

  const updateConfig = (patch: Partial<PushNotificationConfig>) => {
    const next = { ...config, ...patch };
    savePushNotificationConfig(next);
    setConfig(next);
    window.dispatchEvent(new Event('push-config-updated'));
  };

  const handleRequestPermission = async () => {
    const res = await requestPushNotificationPermission();
    await refreshEnv();
    showToast(
      res.message,
      res.permission === 'granted' ? 'success' : 'info'
    );
  };

  const handleSendTestPush = async () => {
    setDispatching(true);
    try {
      if (envStatus.permission !== 'granted') {
        await requestPushNotificationPermission();
        await refreshEnv();
      }

      const res = await dispatchPushNotification({
        title: '🔔 Notificaciones Activas · Todos tus Pagos Pendientes',
        body: `Tienes ${reminders.length} pago(s) pendiente(s) por un total de ${formatearMonto(
          totalPendingUsd,
          'USD',
          locale
        )}.`,
        section: reminders[0]?.section || 'dashboard',
        kind: 'test',
        tag: `sw-test-push-${Date.now()}`,
      });

      showToast(
        res.channel === 'service-worker'
          ? 'Notificación de prueba enviada correctamente.'
          : res.channel === 'notification-api'
            ? 'Notificación enviada mediante el navegador.'
            : `${res.title} — ${res.body}`,
        'success'
      );
    } finally {
      setDispatching(false);
    }
  };

  const handleForceDispatchAll = async () => {
    setDispatching(true);
    try {
      clearTodayPushSentLog();
      const result = await syncAndDispatchDueReminders(appData, {
        forceAll: true,
        config,
      });

      if (result.dispatchedCount > 0) {
        showToast(
          `Se enviaron ${result.dispatchedCount} recordatorio(s) Push de pagos pendientes.`,
          'success'
        );
      } else {
        showToast(
          'No hay pagos pendientes para notificar en este momento.',
          'info'
        );
      }
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
      {/* Cabecera de la sección en Configuración */}
      <div className="px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <BellRing className="w-4 h-4 text-[var(--pink-primary)] shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Notificaciones y Alertas Push
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Elige qué pagos pendientes quieres que te notifiquen y con cuántos días de anticipación
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {envStatus.permission !== 'granted' && (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--lavender-accent)] text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Autorizar Permiso Push</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSendTestPush}
            disabled={dispatching}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Probar Notificación</span>
          </button>

          {reminders.length > 0 && (
            <button
              type="button"
              onClick={handleForceDispatchAll}
              disabled={dispatching}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--pink-primary)] bg-[var(--pink-light)] hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${dispatching ? 'animate-spin' : ''}`}
              />
              <span>Enviar alertas ahora ({reminders.length})</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Estado del permiso */}
        <div className="px-4 py-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[var(--pink-primary)]" />
            <span className="text-[var(--text-secondary)]">
              Estado de alertas en este dispositivo:{' '}
              <strong
                className={
                  envStatus.permission === 'granted'
                    ? 'text-[var(--income-color)]'
                    : envStatus.permission === 'denied'
                      ? 'text-[var(--expense-color)]'
                      : 'text-[var(--lavender-accent)]'
                }
              >
                {envStatus.permission === 'granted'
                  ? 'Autorizado (Activo)'
                  : envStatus.permission === 'denied'
                    ? 'Restringido en navegador / Alertas en-app activas'
                    : 'Pendiente de autorización'}
              </strong>
            </span>
          </div>
          <label className="inline-flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateConfig({ enabled: e.target.checked })}
              className="rounded accent-[var(--pink-primary)]"
            />
            <span>Activar alertas Push generales</span>
          </label>
        </div>

        {/* Configuración de las 5 Categorías de Egresos Pendientes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Cuotas Cashea / Compras por Cuotas */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  1. Cashea y Compras a Cuotas
                </h3>
              </div>
              <input
                type="checkbox"
                checked={config.enabled && config.notifyInstallments}
                onChange={(e) =>
                  updateConfig({
                    enabled: e.target.checked ? true : config.enabled,
                    notifyInstallments: e.target.checked,
                  })
                }
                className="rounded accent-[var(--pink-primary)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Cuotas pendientes de Cashea y compras fraccionadas.
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-divider)]">
              <span className="text-[11px] text-[var(--text-secondary)]">Avisar antes:</span>
              <select
                value={config.installmentDaysBefore}
                onChange={(e) =>
                  updateConfig({ installmentDaysBefore: Number(e.target.value) })
                }
                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-input)] text-xs font-mono-tabular font-semibold text-[var(--text-primary)]"
              >
                <option value={0}>Mismo día</option>
                <option value={1}>1 día antes</option>
                <option value={3}>3 días antes</option>
                <option value={5}>5 días antes</option>
                <option value={7}>7 días antes</option>
                <option value={15}>15 días antes</option>
              </select>
            </div>
          </div>

          {/* 2. Créditos de Apps */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[var(--pink-primary)]" />
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  2. Créditos de Apps
                </h3>
              </div>
              <input
                type="checkbox"
                checked={config.enabled && config.notifyAppCredits}
                onChange={(e) =>
                  updateConfig({
                    enabled: e.target.checked ? true : config.enabled,
                    notifyAppCredits: e.target.checked,
                  })
                }
                className="rounded accent-[var(--pink-primary)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Cuotas pendientes de Ubii App, Avila Pay y microcréditos.
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-divider)]">
              <span className="text-[11px] text-[var(--text-secondary)]">Avisar antes:</span>
              <select
                value={config.appCreditDaysBefore}
                onChange={(e) =>
                  updateConfig({ appCreditDaysBefore: Number(e.target.value) })
                }
                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-input)] text-xs font-mono-tabular font-semibold text-[var(--text-primary)]"
              >
                <option value={0}>Mismo día</option>
                <option value={1}>1 día antes</option>
                <option value={3}>3 días antes</option>
                <option value={5}>5 días antes</option>
                <option value={7}>7 días antes</option>
                <option value={15}>15 días antes</option>
              </select>
            </div>
          </div>

          {/* 3. Suscripciones */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[var(--lavender-accent)]" />
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  3. Suscripciones Activas
                </h3>
              </div>
              <input
                type="checkbox"
                checked={config.enabled && config.notifySubscriptions}
                onChange={(e) =>
                  updateConfig({
                    enabled: e.target.checked ? true : config.enabled,
                    notifySubscriptions: e.target.checked,
                  })
                }
                className="rounded accent-[var(--pink-primary)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Próximos cobros de servicios mensuales, semanales o anuales.
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-divider)]">
              <span className="text-[11px] text-[var(--text-secondary)]">Avisar antes:</span>
              <select
                value={config.subscriptionDaysBefore}
                onChange={(e) =>
                  updateConfig({
                    respectSubscriptionAlertDays: false,
                    subscriptionDaysBefore: Number(e.target.value),
                  })
                }
                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-input)] text-xs font-mono-tabular font-semibold text-[var(--text-primary)]"
              >
                <option value={0}>Mismo día</option>
                <option value={1}>1 día antes</option>
                <option value={3}>3 días antes</option>
                <option value={5}>5 días antes</option>
                <option value={7}>7 días antes</option>
              </select>
            </div>
          </div>

          {/* 4. Gastos / Movimientos Pendientes y Mercado */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  4. Gastos y Listas Pendientes
                </h3>
              </div>
              <input
                type="checkbox"
                checked={config.enabled && config.notifyPendingExpenses}
                onChange={(e) =>
                  updateConfig({
                    enabled: e.target.checked ? true : config.enabled,
                    notifyPendingExpenses: e.target.checked,
                  })
                }
                className="rounded accent-[var(--pink-primary)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Gastos marcados como «Pendiente por pagar» y listas de mercado abiertas.
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-divider)]">
              <span className="text-[11px] text-[var(--text-secondary)]">Avisar antes:</span>
              <select
                value={config.pendingExpenseDaysBefore}
                onChange={(e) =>
                  updateConfig({ pendingExpenseDaysBefore: Number(e.target.value) })
                }
                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-input)] text-xs font-mono-tabular font-semibold text-[var(--text-primary)]"
              >
                <option value={0}>Mismo día</option>
                <option value={1}>1 día antes</option>
                <option value={3}>3 días antes</option>
                <option value={7}>7 días antes</option>
                <option value={15}>15 días antes</option>
                <option value={30}>30 días antes</option>
              </select>
            </div>
          </div>

          {/* 5. Deudas por Pagar y P2P */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  5. Deudas por Pagar y P2P
                </h3>
              </div>
              <input
                type="checkbox"
                checked={config.enabled && config.notifyDebtsPayable}
                onChange={(e) =>
                  updateConfig({
                    enabled: e.target.checked ? true : config.enabled,
                    notifyDebtsPayable: e.target.checked,
                  })
                }
                className="rounded accent-[var(--pink-primary)]"
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Préstamos recibidos («Yo debo») pendientes de liquidar.
            </p>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-divider)]">
              <span className="text-[11px] text-[var(--text-secondary)]">Avisar antes:</span>
              <select
                value={config.debtPayableDaysBefore}
                onChange={(e) =>
                  updateConfig({ debtPayableDaysBefore: Number(e.target.value) })
                }
                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-input)] text-xs font-mono-tabular font-semibold text-[var(--text-primary)]"
              >
                <option value={0}>Mismo día</option>
                <option value={3}>3 días antes</option>
                <option value={7}>7 días antes</option>
                <option value={15}>15 días antes</option>
                <option value={30}>30 días antes</option>
              </select>
            </div>
          </div>

          {/* 6. Opciones Globales de Cola */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col justify-between space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[var(--pink-primary)]" />
              <h3 className="text-xs font-bold text-[var(--text-primary)]">
                Visibilidad en la campana
              </h3>
            </div>
            <label className="inline-flex items-start gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={config.showAllPendingInQueue}
                onChange={(e) =>
                  updateConfig({ showAllPendingInQueue: e.target.checked })
                }
                className="rounded accent-[var(--pink-primary)] mt-0.5"
              />
              <span>
                Mostrar <strong>todos los pagos pendientes</strong> en la lista (aunque falten más días)
              </span>
            </label>
            <label className="inline-flex items-start gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={config.notifyOverdue}
                onChange={(e) =>
                  updateConfig({ notifyOverdue: e.target.checked })
                }
                className="rounded accent-[var(--pink-primary)] mt-0.5"
              />
              <span>Incluir pagos con fecha ya vencida</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
