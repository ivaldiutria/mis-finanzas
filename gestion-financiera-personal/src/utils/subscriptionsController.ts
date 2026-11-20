import {
  AppDataSchema,
  CurrencyCode,
  ExchangeRateSource,
  Subscription,
  SubscriptionFrequency,
  SubscriptionPaymentRecord,
  SubscriptionStatus,
  Transaction,
} from '../types/finance';
import {
  calcularEquivalenteUsd,
  obtenerFechaLocalIso,
  obtenerIdCategoriaComisionBancaria,
} from './calculations';

/**
 * ============================================================================
 * CONTROLADOR DEL GESTOR DE SUSCRIPCIONES (PROYECCIÓN Y CICLOS AUTOMÁTICOS)
 * ============================================================================
 *
 * ARQUITECTURA DE SALDOS (REAL VS. PROYECTADO):
 * 1. Suscripciones Activas (`status === 'active'`):
 *    - NUNCA restan del Saldo Real (`dineroDisponibleEstimadoUsd`) mientras no se
 *      confirme su pago.
 *    - Restan automáticamente su equivalente en USD del `Saldo Proyectado` del mes
 *      en curso a través de `esSuscripcionPendienteEnMes()` en `calculations.ts`.
 * 2. Suscripciones Pausadas (`status === 'paused'`):
 *    - No restan ni del Saldo Real ni del Saldo Proyectado.
 * 3. Confirmación de Pago (`registrarPagoSuscripcionEnAppData`):
 *    - Genera un egreso estándar `'completed'` en `data.transactions` asociado a la
 *      billetera seleccionada (aplicando la tasa oficial BCV o tasa manual si se
 *      ejecuta en Bolívares). Esto descuenta inmediatamente del Saldo Real.
 *    - Avanza automáticamente `nextBillingDate` al siguiente ciclo (+1 mes para
 *      mensuales, +1 año para anuales) y actualiza `lastPaidDate`, liberando la
 *      reserva pendiente del mes en curso para evitar doble descuento.
 */

export interface CreateSubscriptionInput {
  name: string;
  categoryId: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRate?: number | null;
  frequency: SubscriptionFrequency;
  nextBillingDate: string; // YYYY-MM-DD
  alertDaysBefore: number;
  status: SubscriptionStatus;
  defaultWalletId?: string;
  notes?: string;
}

export interface PaySubscriptionInput {
  paidDate: string; // YYYY-MM-DD
  walletId: string;
  currency: CurrencyCode; // Moneda en que se ejecuta el pago ('USD' | 'VES')
  amountNominal: number; // Monto pagado en esa moneda
  exchangeRate: number | null; // Tasa Bs/USD si se paga en VES
  exchangeRateSource: ExchangeRateSource;
  notes?: string;
  paymentMethod?: string;
  isInterbankTransfer?: boolean;
  interbankFeeType?: 'pago_movil' | 'transferencia';
  interbankFeeAmount?: number;
}

export type SubscriptionAlertState =
  | 'overdue'
  | 'due_today'
  | 'within_alert_window'
  | 'upcoming'
  | 'paused';

export interface EnrichedSubscriptionItem {
  subscription: Subscription;
  effectiveAmountUsd: number;
  effectiveAmountVes: number | null;
  daysUntilBilling: number;
  alertState: SubscriptionAlertState;
  isWithinAlertWindow: boolean;
  isPendingThisMonth: boolean;
}

/**
 * Avanza una fecha YYYY-MM-DD exactamente al siguiente ciclo según la frecuencia
 * ('monthly' -> +1 mes calendario, 'annual' -> +1 año calendario), ajustando
 * de forma segura los fines de mes (ej. 31 de enero -> 28/29 de febrero).
 */
export function avanzarFechaSiguienteCiclo(
  fechaStr: string,
  frequency: SubscriptionFrequency
): string {
  const parts = fechaStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    const fallback = new Date();
    if (frequency === 'annual') {
      fallback.setFullYear(fallback.getFullYear() + 1);
    } else {
      fallback.setMonth(fallback.getMonth() + 1);
    }
    return obtenerFechaLocalIso(fallback);
  }

  const [year, month, day] = parts;
  const targetYear = frequency === 'annual' ? year + 1 : year;
  const targetMonthIndex = frequency === 'annual' ? month - 1 : month; // 0-indexed + 1 mes si monthly

  // Calcular año y mes normalizados
  const normalizedDate = new Date(targetYear, targetMonthIndex, 1);
  const finalYear = normalizedDate.getFullYear();
  const finalMonth = normalizedDate.getMonth(); // 0..11

  // Último día válido del mes destino (protege 31 -> 28/29/30)
  const maxDayInTargetMonth = new Date(finalYear, finalMonth + 1, 0).getDate();
  const finalDay = Math.min(day, maxDayInTargetMonth);

  const yStr = String(finalYear);
  const mStr = String(finalMonth + 1).padStart(2, '0');
  const dStr = String(finalDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Calcula el equivalente en USD de una suscripción respetando el entorno multimoneda.
 * Si la suscripción está fijada en Bolívares (VES), utiliza la tasa oficial BCV vigente
 * (o la tasa guardada en la suscripción como respaldo) para proyectar su impacto real en USD.
 */
export function calcularMontoSuscripcionUsd(
  sub: Subscription,
  officialRate?: number | null,
  fallbackRate?: number | null
): number {
  if (!Number.isFinite(sub.amount) || sub.amount <= 0) return 0;
  if (sub.currency === 'USD' || sub.currency === 'USDT') {
    return Number(sub.amount.toFixed(6));
  }
  const activeRate =
    officialRate && officialRate > 0
      ? officialRate
      : sub.exchangeRate && sub.exchangeRate > 0
        ? sub.exchangeRate
        : fallbackRate && fallbackRate > 0
          ? fallbackRate
          : null;

  if (activeRate && activeRate > 0) {
    return calcularEquivalenteUsd(sub.amount, 'VES', activeRate);
  }
  return Number.isFinite(sub.amountUsd) && sub.amountUsd > 0 ? sub.amountUsd : 0;
}

/**
 * Determina si una suscripción activa debe restar del Saldo Proyectado en el mes consultado (`monthKey`).
 *
 * Regla de negocio:
 * - Solo las suscripciones con `status === 'active'` restan del Saldo Proyectado.
 * - NUNCA restan del Saldo Real (`dineroDisponibleEstimadoUsd`).
 * - Si la suscripción ya fue pagada durante `monthKey` (`lastPaidDate` pertenece a `monthKey`)
 *   y su `nextBillingDate` ya avanzó a un mes posterior (`> monthKey`), NO vuelve a restar
 *   en `monthKey` porque el egreso real ya fue descontado de la billetera al confirmar el pago.
 * - Para suscripciones mensuales activas no pagadas en el mes en curso, o suscripciones cuya
 *   `nextBillingDate` cae en o antes de `monthKey`, su monto se descuenta del Saldo Proyectado.
 */
export function esSuscripcionPendienteEnMes(
  sub: Subscription,
  monthKey: string
): boolean {
  if (sub.status !== 'active') return false;

  const billingMonth = (sub.nextBillingDate || '').slice(0, 7);
  const paidThisMonth =
    Boolean(sub.lastPaidDate) && sub.lastPaidDate!.slice(0, 7) === monthKey;

  // Si su fecha de próximo cobro es en este mes o está vencida de un mes anterior
  if (billingMonth && billingMonth <= monthKey) {
    return true;
  }

  // Si es mensual, está activa y aún no se ha pagado en el mes en curso,
  // reserva su cupo en el Saldo Proyectado del mes actual
  if (sub.frequency === 'monthly' && !paidThisMonth) {
    return true;
  }

  return false;
}

/**
 * Calcula los días restantes hasta `nextBillingDate` y determina si la tarjeta debe
 * resaltarse en color por estar dentro de la ventana de `alertDaysBefore` (Días de Aviso).
 */
export function calcularEstadoAlertaSuscripcion(
  sub: Subscription,
  referenceDate?: Date
): {
  daysUntilBilling: number;
  alertState: SubscriptionAlertState;
  isWithinAlertWindow: boolean;
} {
  const now = referenceDate ? new Date(referenceDate) : new Date();
  const todayIso = obtenerFechaLocalIso(now);
  const [ty, tm, td] = todayIso.split('-').map((v) => Number(v));
  const todayMidnight = Date.UTC(ty || 2026, (tm || 1) - 1, td || 1);

  const [y, m, d] = (sub.nextBillingDate || '')
    .split('-')
    .map((v) => Number(v));
  const dueMidnight =
    y && m && d ? Date.UTC(y, m - 1, d) : todayMidnight;

  const diffMs = dueMidnight - todayMidnight;
  const daysUntilBilling = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const alertDays = Math.max(0, Number(sub.alertDaysBefore) || 0);

  if (sub.status === 'paused') {
    return {
      daysUntilBilling,
      alertState: 'paused',
      isWithinAlertWindow: false,
    };
  }

  if (daysUntilBilling < 0) {
    return {
      daysUntilBilling,
      alertState: 'overdue',
      isWithinAlertWindow: true,
    };
  }

  if (daysUntilBilling === 0) {
    return {
      daysUntilBilling: 0,
      alertState: 'due_today',
      isWithinAlertWindow: true,
    };
  }

  if (daysUntilBilling <= alertDays) {
    return {
      daysUntilBilling,
      alertState: 'within_alert_window',
      isWithinAlertWindow: true,
    };
  }

  return {
    daysUntilBilling,
    alertState: 'upcoming',
    isWithinAlertWindow: false,
  };
}

/**
 * Crea una nueva entidad `Subscription` normalizada.
 */
export function crearSuscripcion(
  input: CreateSubscriptionInput,
  officialRate?: number | null
): Subscription {
  const cleanAmount = Math.max(0.01, Number(input.amount.toFixed(2)));
  const effectiveRate =
    input.currency === 'VES'
      ? input.exchangeRate && input.exchangeRate > 0
        ? input.exchangeRate
        : officialRate && officialRate > 0
          ? officialRate
          : 1
      : null;

  const amountUsd =
    input.currency === 'USD' || input.currency === 'USDT'
      ? cleanAmount
      : calcularEquivalenteUsd(cleanAmount, 'VES', effectiveRate);

  return {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    categoryId: input.categoryId || 'cat_exp_subscriptions',
    amount: cleanAmount,
    currency: input.currency,
    exchangeRate: effectiveRate,
    amountUsd,
    frequency: input.frequency,
    nextBillingDate: input.nextBillingDate,
    alertDaysBefore: Math.max(0, Math.min(60, Math.round(input.alertDaysBefore))),
    status: input.status,
    defaultWalletId: input.defaultWalletId || undefined,
    lastPaidDate: null,
    paymentHistory: [],
    notes: input.notes?.trim() || '',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Actualiza los datos de una suscripción existente dentro de `AppDataSchema`.
 */
export function actualizarSuscripcionEnAppData(
  data: AppDataSchema,
  subId: string,
  changes: Partial<CreateSubscriptionInput>,
  officialRate?: number | null
): AppDataSchema {
  const updated = (data.subscriptions || []).map((sub) => {
    if (sub.id !== subId) return sub;

    const nextCurrency = changes.currency ?? sub.currency;
    const nextAmount =
      changes.amount !== undefined
        ? Math.max(0.01, Number(changes.amount.toFixed(2)))
        : sub.amount;
    const nextRate =
      nextCurrency === 'VES'
        ? changes.exchangeRate !== undefined
          ? changes.exchangeRate
          : sub.exchangeRate || officialRate || 1
        : null;
    const nextAmountUsd =
      nextCurrency === 'USD' || nextCurrency === 'USDT'
        ? nextAmount
        : calcularEquivalenteUsd(nextAmount, 'VES', nextRate);

    return {
      ...sub,
      name: changes.name !== undefined ? changes.name.trim() : sub.name,
      categoryId: changes.categoryId ?? sub.categoryId,
      amount: nextAmount,
      currency: nextCurrency,
      exchangeRate: nextRate,
      amountUsd: nextAmountUsd,
      frequency: changes.frequency ?? sub.frequency,
      nextBillingDate: changes.nextBillingDate ?? sub.nextBillingDate,
      alertDaysBefore:
        changes.alertDaysBefore !== undefined
          ? Math.max(0, Math.min(60, Math.round(changes.alertDaysBefore)))
          : sub.alertDaysBefore,
      status: changes.status ?? sub.status,
      defaultWalletId:
        changes.defaultWalletId !== undefined
          ? changes.defaultWalletId
          : sub.defaultWalletId,
      notes: changes.notes !== undefined ? changes.notes.trim() : sub.notes,
    };
  });

  return {
    ...data,
    subscriptions: updated,
  };
}

/**
 * Alterna el estado de una suscripción entre 'active' (resta al Saldo Proyectado)
 * y 'paused' (pausada, no resta al Saldo Proyectado).
 */
export function alternarEstadoSuscripcionEnAppData(
  data: AppDataSchema,
  subId: string
): AppDataSchema {
  return {
    ...data,
    subscriptions: (data.subscriptions || []).map((sub) =>
      sub.id === subId
        ? { ...sub, status: sub.status === 'active' ? 'paused' : 'active' }
        : sub
    ),
  };
}

/**
 * Elimina una suscripción de `AppDataSchema` (conservando en el historial los pagos reales ya ejecutados).
 */
export function eliminarSuscripcionEnAppData(
  data: AppDataSchema,
  subId: string
): AppDataSchema {
  return {
    ...data,
    subscriptions: (data.subscriptions || []).filter((s) => s.id !== subId),
  };
}

/**
 * CONFIRMACIÓN DE PAGO DE SUSCRIPCIÓN:
 * 1. Genera un egreso estándar (`status: 'completed'`) en la Wallet seleccionada,
 *    afectando el Saldo Real y aplicando la tasa oficial BCV (o manual) si se paga en Bs.
 * 2. Avanza automáticamente `nextBillingDate` al siguiente ciclo (Mensual o Anual).
 * 3. Registra la trazabilidad en `paymentHistory` de la suscripción.
 */
export function registrarPagoSuscripcionEnAppData(
  data: AppDataSchema,
  subId: string,
  payment: PaySubscriptionInput,
  officialRate?: number | null
): AppDataSchema {
  const targetSub = (data.subscriptions || []).find((s) => s.id === subId);
  if (!targetSub) return data;

  const isVes = payment.currency === 'VES';
  const appliedRate = isVes
    ? payment.exchangeRate && payment.exchangeRate > 0
      ? payment.exchangeRate
      : officialRate && officialRate > 0
        ? officialRate
        : targetSub.exchangeRate || 1
    : null;

  const cleanNominal = Math.max(0.01, Number(payment.amountNominal.toFixed(2)));
  const paidAmountUsd = isVes
    ? calcularEquivalenteUsd(cleanNominal, 'VES', appliedRate)
    : cleanNominal;

  const newTransactionId = `txn_sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nextCycleDate = avanzarFechaSiguienteCiclo(
    targetSub.nextBillingDate,
    targetSub.frequency
  );

  const hasBankFee = Boolean(
    payment.isInterbankTransfer &&
      payment.interbankFeeAmount !== undefined &&
      payment.interbankFeeAmount > 0
  );
  const cleanFeeNominal = hasBankFee
    ? Number((payment.interbankFeeAmount || 0).toFixed(2))
    : 0;
  const feeTransactionId = hasBankFee
    ? `txn_sub_fee_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    : undefined;

  // 1. Egreso real en la Wallet seleccionada (afecta el Saldo Real)
  const expenseTransaction: Transaction = {
    id: newTransactionId,
    date: payment.paidDate,
    type: 'expense',
    status: 'completed',
    walletId: payment.walletId,
    description: `Suscripción: ${targetSub.name} (Corte ${targetSub.nextBillingDate})`,
    categoryId: targetSub.categoryId || 'cat_exp_subscriptions',
    amount: cleanNominal,
    currency: payment.currency,
    exchangeRate: isVes ? appliedRate : null,
    amountUsd: paidAmountUsd,
    exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
    expenseType: 'fixed',
    isRecurring: true,
    paymentMethod: payment.paymentMethod || undefined,
    isInterbankTransfer: hasBankFee ? true : undefined,
    interbankFeeType: hasBankFee ? payment.interbankFeeType : undefined,
    interbankFeeAmount: hasBankFee ? cleanFeeNominal : undefined,
    interbankFeeTxnId: feeTransactionId,
    notes:
      payment.notes?.trim() ||
      `Pago confirmado de suscripción ${targetSub.frequency === 'annual' ? 'anual' : 'mensual'}. Próximo cobro: ${nextCycleDate}.`,
    createdAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
  };

  const newTransactionsList: Transaction[] = [expenseTransaction];

  if (hasBankFee && feeTransactionId && cleanFeeNominal > 0) {
    const feeCategoryId = obtenerIdCategoriaComisionBancaria(data.categories || []);
    const feeAmountUsd = isVes
      ? calcularEquivalenteUsd(cleanFeeNominal, 'VES', appliedRate)
      : cleanFeeNominal;
    const feeLabel =
      payment.interbankFeeType === 'transferencia'
        ? 'Transferencia'
        : 'Pago Móvil';

    const feeTransaction: Transaction = {
      id: feeTransactionId,
      date: payment.paidDate,
      type: 'expense',
      status: 'completed',
      walletId: payment.walletId,
      description: `Comisión bancaria (${feeLabel}) - Suscripción: ${targetSub.name}`,
      categoryId: feeCategoryId,
      amount: cleanFeeNominal,
      currency: payment.currency,
      exchangeRate: isVes ? appliedRate : null,
      amountUsd: feeAmountUsd,
      exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
      expenseType: 'fixed',
      paymentMethod: payment.paymentMethod || feeLabel,
      parentTransactionId: newTransactionId,
      notes: `Comisión generada automáticamente al pagar suscripción (${targetSub.name})`,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };
    newTransactionsList.unshift(feeTransaction);
  }

  // 2. Registro histórico del cobro y avance automático al siguiente ciclo
  const paymentRecord: SubscriptionPaymentRecord = {
    id: `subpay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    paidDate: payment.paidDate,
    previousBillingDate: targetSub.nextBillingDate,
    nextBillingDateAfterPay: nextCycleDate,
    walletId: payment.walletId,
    amount: cleanNominal,
    currency: payment.currency,
    exchangeRate: isVes ? appliedRate : null,
    amountUsd: paidAmountUsd,
    linkedTransactionId: newTransactionId,
    notes: payment.notes?.trim() || undefined,
  };

  const updatedSubscriptions = (data.subscriptions || []).map((sub) => {
    if (sub.id !== subId) return sub;
    return {
      ...sub,
      nextBillingDate: nextCycleDate,
      lastPaidDate: payment.paidDate,
      defaultWalletId: payment.walletId,
      paymentHistory: [paymentRecord, ...(sub.paymentHistory || [])],
    };
  });

  return {
    ...data,
    subscriptions: updatedSubscriptions,
    transactions: [...newTransactionsList, ...data.transactions],
  };
}

/**
 * Calcula métricas consolidadas y enriquece las suscripciones con su estado de alerta
 * y proyección para la interfaz de tarjetas.
 */
export function calcularResumenSuscripciones(
  data: AppDataSchema,
  monthKey: string,
  officialRate?: number | null
): {
  items: EnrichedSubscriptionItem[];
  activasCount: number;
  pausadasCount: number;
  enAlertaCount: number;
  impactoProyectadoMesUsd: number;
  gastoMensualEquivalenteUsd: number;
  costoAnualEstimadoUsd: number;
  pagadoEsteMesUsd: number;
} {
  const subs = data.subscriptions || [];
  const fallbackRate =
    officialRate ||
    data.settings.lastOfficialRate ||
    data.settings.defaultExchangeRate ||
    null;

  let activasCount = 0;
  let pausadasCount = 0;
  let enAlertaCount = 0;
  let impactoProyectadoMesUsd = 0;
  let gastoMensualEquivalenteUsd = 0;
  let costoAnualEstimadoUsd = 0;
  let pagadoEsteMesUsd = 0;

  const items: EnrichedSubscriptionItem[] = subs.map((sub) => {
    const effectiveAmountUsd = calcularMontoSuscripcionUsd(
      sub,
      officialRate,
      fallbackRate
    );
    const effectiveAmountVes =
      sub.currency === 'VES'
        ? sub.amount
        : fallbackRate && fallbackRate > 0
          ? Number((effectiveAmountUsd * fallbackRate).toFixed(2))
          : null;

    const { daysUntilBilling, alertState, isWithinAlertWindow } =
      calcularEstadoAlertaSuscripcion(sub);
    const isPendingThisMonth = esSuscripcionPendienteEnMes(sub, monthKey);

    if (sub.status === 'active') {
      activasCount += 1;
      if (isWithinAlertWindow) {
        enAlertaCount += 1;
      }
      if (isPendingThisMonth) {
        impactoProyectadoMesUsd += effectiveAmountUsd;
      }
      const monthlyEq =
        sub.frequency === 'annual'
          ? effectiveAmountUsd / 12
          : effectiveAmountUsd;
      gastoMensualEquivalenteUsd += monthlyEq;
      costoAnualEstimadoUsd +=
        sub.frequency === 'annual'
          ? effectiveAmountUsd
          : effectiveAmountUsd * 12;
    } else {
      pausadasCount += 1;
    }

    // Sumar pagos confirmados en el mes consultado
    for (const rec of sub.paymentHistory || []) {
      if (rec.paidDate.slice(0, 7) === monthKey) {
        pagadoEsteMesUsd += rec.amountUsd;
      }
    }

    return {
      subscription: sub,
      effectiveAmountUsd,
      effectiveAmountVes,
      daysUntilBilling,
      alertState,
      isWithinAlertWindow,
      isPendingThisMonth,
    };
  });

  // Ordenar tarjetas: 1) Activas en alerta/vencidas, 2) Activas próximas por fecha, 3) Pausadas
  items.sort((a, b) => {
    if (a.subscription.status !== b.subscription.status) {
      return a.subscription.status === 'active' ? -1 : 1;
    }
    if (a.isWithinAlertWindow !== b.isWithinAlertWindow) {
      return a.isWithinAlertWindow ? -1 : 1;
    }
    return a.daysUntilBilling - b.daysUntilBilling;
  });

  return {
    items,
    activasCount,
    pausadasCount,
    enAlertaCount,
    impactoProyectadoMesUsd: Number(impactoProyectadoMesUsd.toFixed(2)),
    gastoMensualEquivalenteUsd: Number(gastoMensualEquivalenteUsd.toFixed(2)),
    costoAnualEstimadoUsd: Number(costoAnualEstimadoUsd.toFixed(2)),
    pagadoEsteMesUsd: Number(pagadoEsteMesUsd.toFixed(2)),
  };
}
