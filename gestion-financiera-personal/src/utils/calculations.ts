import {
  AppDataSchema,
  Asset,
  AssetAlertLevel,
  AssetStatusEvaluation,
  Category,
  CurrencyCode,
  Debt,
  MonthlyBudget,
  RomanceRouletteBracket,
  RomanceRouletteSuggestion,
  SavingsGoal,
  SavingsMovement,
  Subscription,
  Transaction,
  WalletAccount,
} from '../types/finance';

/**
 * Determina si una transacción está Completada (afecta el saldo real).
 * Por retrocompatibilidad, si no tiene estado explícito se considera 'completed'.
 */
export function esTransaccionCompletada(txn: Transaction): boolean {
  return (txn.status ?? 'completed') === 'completed';
}

/**
 * Calcula el Saldo Proyectado según la fórmula:
 * Saldo Proyectado = Saldo Actual + Ingresos Pendientes - Gastos Pendientes
 */
export function calcularSaldoProyectado(
  saldoActualUsd: number,
  ingresosPendientesUsd: number,
  gastosPendientesUsd: number
): number {
  const actual = Number.isFinite(saldoActualUsd) ? saldoActualUsd : 0;
  const ingPend = Number.isFinite(ingresosPendientesUsd) ? ingresosPendientesUsd : 0;
  const gasPend = Number.isFinite(gastosPendientesUsd) ? gastosPendientesUsd : 0;
  return Number((actual + ingPend - gasPend).toFixed(6));
}

/**
 * Convierte un monto a su equivalente en USD según las reglas contables.
 * Si la moneda es USD, devuelve el mismo monto sin conversión innecesaria.
 * Si la moneda es VES, aplica montoUSD = montoVES / tasaVESporUSD conservando precisión interna.
 */
export function calcularEquivalenteUsd(
  monto: number,
  moneda: CurrencyCode,
  tasa: number | null | undefined
): number {
  if (!Number.isFinite(monto) || monto <= 0) return 0;
  if (moneda === 'USD' || moneda === 'USDT') {
    return monto;
  }
  if (!tasa || !Number.isFinite(tasa) || tasa <= 0) {
    return 0;
  }
  // Conservamos 6 decimales internamente para evitar errores de coma flotante sin redondear prematuramente
  return Number((monto / tasa).toFixed(6));
}

/**
 * Zona horaria regional predeterminada de la aplicación (Venezuela, UTC-4).
 */
export const DEFAULT_APP_TIMEZONE = 'America/Caracas';

/**
 * Devuelve la fecha en formato YYYY-MM-DD respetando la zona horaria regional
 * (America/Caracas, UTC-4), evitando que .toISOString() (UTC) adelante el día
 * a partir de las 8:00 PM en Venezuela.
 */
export function obtenerFechaLocalIso(
  date: Date = new Date(),
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) {
      return `${y}-${m}-${d}`;
    }
  } catch {
    // Fallback al reloj local del sistema si el entorno no soporta timeZone
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Devuelve el mes actual (o de la fecha provista) en formato YYYY-MM
 * respetando la zona horaria regional (America/Caracas, UTC-4).
 */
export function obtenerMesLocalIso(
  date: Date = new Date(),
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  return obtenerFechaLocalIso(date, timeZone).slice(0, 7);
}

/**
 * Obtiene la fecha efectiva contable (YYYY-MM-DD) de una transacción:
 * - Si el movimiento está Pendiente (`!esTransaccionCompletada(txn)`), su fecha proyectada es `txn.date` (ej. vencimiento 2026-11-11).
 * - Si el movimiento ya está Completado (`esTransaccionCompletada(txn)`), pero tenía una fecha de vencimiento futura o de un mes posterior
 *   (ej. vencía el `2026-11-11` y fue pagado por adelantado el `2026-10-31`), devuelve la fecha real en que se procesó/pagó (`2026-10-31`)
 *   para que en el Estado de Cuenta, Resumen Mensual y Movimientos del Mes pertenezca al mes en que realmente se pagó (Octubre) y no a Noviembre.
 */
export function obtenerFechaEfectivaContableTransaccion(
  txn: Transaction,
  data?: AppDataSchema,
  timeZone: string = DEFAULT_APP_TIMEZONE
): string {
  const nominalDate = (txn.date || '').slice(0, 10);
  if (!esTransaccionCompletada(txn) || !/^\d{4}-\d{2}-\d{2}$/.test(nominalDate)) {
    return nominalDate || obtenerFechaLocalIso(new Date(), timeZone);
  }

  // 1. Verificar si la transacción corresponde a una cuota pagada en creditPurchases o appCredits con paidAt anterior
  if (data) {
    for (const cp of data.creditPurchases || []) {
      for (const inst of cp.installments || []) {
        if (
          inst.linkedTransactionId === txn.id &&
          inst.status === 'paid' &&
          inst.paidAt &&
          /^\d{4}-\d{2}-\d{2}$/.test(inst.paidAt.slice(0, 10))
        ) {
          const paidDay = inst.paidAt.slice(0, 10);
          if (paidDay < nominalDate) {
            return paidDay;
          }
        }
        for (const part of inst.partialPayments || []) {
          if (
            part.linkedTransactionId === txn.id &&
            part.date &&
            /^\d{4}-\d{2}-\d{2}$/.test(part.date.slice(0, 10))
          ) {
            const partDay = part.date.slice(0, 10);
            if (partDay < nominalDate) {
              return partDay;
            }
          }
        }
      }
    }

    for (const ac of data.appCredits || []) {
      for (const inst of ac.installments || []) {
        if (
          inst.linkedTransactionId === txn.id &&
          inst.status === 'paid' &&
          inst.paidAt &&
          /^\d{4}-\d{2}-\d{2}$/.test(inst.paidAt.slice(0, 10))
        ) {
          const paidDay = inst.paidAt.slice(0, 10);
          if (paidDay < nominalDate) {
            return paidDay;
          }
        }
        for (const part of inst.partialPayments || []) {
          if (
            part.linkedTransactionId === txn.id &&
            part.date &&
            /^\d{4}-\d{2}-\d{2}$/.test(part.date.slice(0, 10))
          ) {
            const partDay = part.date.slice(0, 10);
            if (partDay < nominalDate) {
              return partDay;
            }
          }
        }
      }
    }
  }

  // 2. Verificar si `processedAt` tiene una fecha local anterior a `txn.date` (pago adelantado)
  if (typeof txn.processedAt === 'string' && txn.processedAt.trim().length > 0) {
    const raw = txn.processedAt.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      if (raw < nominalDate) return raw;
    } else {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const procLocalIso = obtenerFechaLocalIso(parsed, timeZone);
        if (procLocalIso < nominalDate) {
          return procLocalIso;
        }
      }
    }
  }

  // 3. Verificar si `createdAt` tiene una fecha local de un mes anterior a `txn.date` y ya está completado
  if (typeof txn.createdAt === 'string' && txn.createdAt.trim().length > 0) {
    const raw = txn.createdAt.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      if (raw < nominalDate) return raw;
    } else {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const createdLocalIso = obtenerFechaLocalIso(parsed, timeZone);
        if (createdLocalIso < nominalDate) {
          return createdLocalIso;
        }
      }
    }
  }

  // 4. Si el ID contiene un timestamp Unix de 13 dígitos cuya fecha local es anterior a `txn.date`
  const idCandidates = [txn.id, txn.parentTransactionId].filter(Boolean) as string[];
  for (const candidate of idCandidates) {
    const match = candidate.match(/(\d{13})/);
    if (match) {
      const ms = Number(match[1]);
      if (Number.isFinite(ms) && ms >= 1577836800000 && ms <= 4102444800000) {
        const idDateIso = obtenerFechaLocalIso(new Date(ms), timeZone);
        if (idDateIso < nominalDate) {
          return idDateIso;
        }
      }
    }
  }

  return nominalDate;
}

export function obtenerMesAnterior(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatearNombreMes(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) return monthKey;
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return `${meses[month - 1] ?? ''} ${year}`;
}

export interface ResumenFinanciero {
  monthKey: string;
  // Saldos reales (únicamente movimientos Completados)
  ingresosMesUsd: number;
  ingresosMesSoloUsd: number;
  ingresosMesVesOriginal: number;
  ingresosMesSoloVesEquivUsd: number;
  gastosMesUsd: number;
  gastosMesSoloUsd: number;
  gastosMesVesOriginal: number;
  gastosMesSoloVesEquivUsd: number;
  balanceNetoMensualUsd: number;
  capacidadAhorroMensualUsd: number;
  porcentajeGastosSobreIngresos: number;
  ahorroAportadoMesUsd: number;
  ahorroRetiradoMesUsd: number;
  ahorroNetoMesUsd: number;
  dineroDisponibleEstimadoUsd: number;
  // Desglose separado: Todo lo que es Dólares ($) vs Todo lo que es Bolívares (Bs)
  balanceSoloDolaresUsd: number;
  balanceSoloDolaresEquivVes: number;
  proyectadoSoloDolaresUsd: number;
  enCuentasDolaresUsd: number;
  enEfectivoDolaresUsd: number;
  balanceSoloBolivaresVes: number;
  balanceSoloBolivaresEquivUsd: number;
  proyectadoSoloBolivaresVes: number;
  enCuentasBolivaresVes: number;
  enCuentasBolivaresEquivUsd: number;
  enEfectivoBolivaresVes: number;
  enEfectivoBolivaresEquivUsd: number;
  totalEnCuentasConsolidadoUsd: number;
  totalEnEfectivoConsolidadoUsd: number;
  totalAhorradoUsd: number;
  patrimonioFinancieroUsd: number;
  // Movimientos Pendientes y Saldo Proyectado (Saldo Actual + Ingresos Pendientes - Gastos Pendientes)
  ingresosPendientesMesUsd: number;
  gastosPendientesMesUsd: number;
  ingresosPendientesTotalUsd: number;
  gastosPendientesTotalUsd: number;
  cantidadPendientesMes: number;
  cantidadPendientesTotal: number;
  balanceProyectadoMesUsd: number;
  saldoProyectadoUsd: number;
  patrimonioProyectadoUsd: number;
  // Presupuesto y comparativa mensual
  presupuestoMensualUsd: number;
  presupuestoRestanteUsd: number;
  presupuestoExcedidoUsd: number;
  porcentajePresupuestoUtilizado: number;
  ingresosMesAnteriorUsd: number;
  gastosMesAnteriorUsd: number;
  variacionIngresosPct: number | null;
  variacionGastosPct: number | null;
}

export function calcularResumenFinanciero(
  data: AppDataSchema,
  monthKey: string
): ResumenFinanciero {
  const prevMonthKey = obtenerMesAnterior(monthKey);
  const thirdPartyWalletIds = new Set(
    (data.wallets || [])
      .filter((w) => w.isThirdPartyExpenseAccount && !w.isPassThroughAccount)
      .map((w) => w.id)
  );
  const passThroughWalletIds = new Set(
    (data.wallets || [])
      .filter((w) => w.isPassThroughAccount)
      .map((w) => w.id)
  );

  let ingresosMesUsd = 0;
  let ingresosMesSoloUsd = 0;
  let ingresosMesVesOriginal = 0;
  let ingresosMesSoloVesEquivUsd = 0;
  let gastosMesUsd = 0;
  let gastosMesSoloUsd = 0;
  let gastosMesVesOriginal = 0;
  let gastosMesSoloVesEquivUsd = 0;

  let ingresosMesAnteriorUsd = 0;
  let gastosMesAnteriorUsd = 0;

  let ingresosPendientesMesUsd = 0;
  let gastosPendientesMesUsd = 0;
  let ingresosPendientesTotalUsd = 0;
  let gastosPendientesTotalUsd = 0;
  let cantidadPendientesMes = 0;
  let cantidadPendientesTotal = 0;

  for (const txn of data.transactions) {
    // Si es un movimiento de paso hacia una Cuenta de Terceros / Amigo (ej. dinero de una App de Crédito enviado directo a un amigo),
    // nunca pasó por nuestras cuentas personales: NO suma a ingresos ni a gastos personales.
    const isPassThrough =
      Boolean(txn.isPassThroughThirdParty) ||
      Boolean(txn.walletId && passThroughWalletIds.has(txn.walletId));
    if (isPassThrough) {
      continue;
    }

    const valUsd = Number.isFinite(txn.amountUsd) ? txn.amountUsd : 0;
    const completed = esTransaccionCompletada(txn);
    const effectiveDate = completed
      ? obtenerFechaEfectivaContableTransaccion(txn, data)
      : txn.date;
    const txnMonth = effectiveDate.slice(0, 7);
    const isThirdPartyMov =
      Boolean(txn.isThirdPartyAllowance) ||
      Boolean(txn.walletId && thirdPartyWalletIds.has(txn.walletId)) ||
      Boolean(
        txn.thirdPartyTargetWalletId &&
          thirdPartyWalletIds.has(txn.thirdPartyTargetWalletId)
      );
    // Cualquier movimiento hacia una cuenta de gastos de tercero/familiar cuenta como EGRESO personal del mes
    const effectiveType = isThirdPartyMov ? 'expense' : txn.type;

    if (!completed) {
      // Estado Pendiente: no afecta el saldo real, solo el Saldo Proyectado
      cantidadPendientesTotal += 1;
      if (effectiveType === 'income') {
        ingresosPendientesTotalUsd += valUsd;
        if (txnMonth === monthKey) {
          ingresosPendientesMesUsd += valUsd;
          cantidadPendientesMes += 1;
        }
      } else if (effectiveType === 'expense') {
        gastosPendientesTotalUsd += valUsd;
        if (txnMonth === monthKey) {
          gastosPendientesMesUsd += valUsd;
          cantidadPendientesMes += 1;
        }
      }
      continue;
    }

    // Estado Completado: afecta el saldo real
    if (effectiveType === 'income') {
      if (txnMonth === monthKey) {
        ingresosMesUsd += valUsd;
        if (txn.currency === 'VES') {
          ingresosMesVesOriginal += txn.amount;
          ingresosMesSoloVesEquivUsd += valUsd;
        } else {
          ingresosMesSoloUsd += valUsd;
        }
      } else if (txnMonth === prevMonthKey) {
        ingresosMesAnteriorUsd += valUsd;
      }
    } else if (effectiveType === 'expense') {
      if (txnMonth === monthKey) {
        gastosMesUsd += valUsd;
        if (txn.currency === 'VES') {
          gastosMesVesOriginal += txn.amount;
          gastosMesSoloVesEquivUsd += valUsd;
        } else {
          gastosMesSoloUsd += valUsd;
        }
      } else if (txnMonth === prevMonthKey) {
        gastosMesAnteriorUsd += valUsd;
      }
    }
  }

  // Si se hicieron transferencias entre Wallets (data.walletTransfers) desde una cuenta propia hacia una cuenta familiar (Mamá),
  // ese envío también cuenta como egreso personal del mes correspondiente.
  const fallbackRateForTr =
    (data.settings.preferManualRateByDefault && data.settings.defaultExchangeRate) ||
    data.settings.lastOfficialRate ||
    data.settings.defaultExchangeRate ||
    450;
  for (const tr of data.walletTransfers || []) {
    if (
      tr.destinationWalletId &&
      thirdPartyWalletIds.has(tr.destinationWalletId) &&
      (!tr.sourceWalletId || !thirdPartyWalletIds.has(tr.sourceWalletId))
    ) {
      const inAmt = Number(tr.amountIn) || 0;
      const outAmt = Number(tr.amountOut) || 0;
      const rateUsed =
        typeof tr.exchangeRate === 'number' && tr.exchangeRate > 1.05
          ? tr.exchangeRate
          : fallbackRateForTr;
      const isDstVes = tr.destinationCurrency === 'VES';
      const isSrcVes = tr.sourceCurrency === 'VES';
      const trUsd = !isSrcVes && outAmt > 0
        ? outAmt
        : !isDstVes && inAmt > 0
          ? inAmt
          : rateUsed > 0
            ? inAmt / rateUsed
            : 0;
      const trMonth = (tr.date || '').slice(0, 7);
      if (trUsd > 0) {
        if (trMonth === monthKey) {
          gastosMesUsd += trUsd;
          if (isDstVes) {
            gastosMesVesOriginal += inAmt;
            gastosMesSoloVesEquivUsd += trUsd;
          } else {
            gastosMesSoloUsd += trUsd;
          }
        } else if (trMonth === prevMonthKey) {
          gastosMesAnteriorUsd += trUsd;
        }
      }
    }
  }

  // ==========================================================================
  // ENLACE DEL MOTOR DE PROYECCIÓN CON SUSCRIPCIONES ACTIVAS:
  // ==========================================================================
  const activeRateForSubs =
    (data.settings.preferManualRateByDefault && data.settings.defaultExchangeRate) ||
    data.settings.lastOfficialRate ||
    data.settings.defaultExchangeRate ||
    null;

  let subsPendientesUsd = 0;

  for (const sub of data.subscriptions || []) {
    if (sub.status !== 'active') continue;

    const billingMonth = (sub.nextBillingDate || '').slice(0, 7);
    const paidThisMonth =
      Boolean(sub.lastPaidDate) && sub.lastPaidDate!.slice(0, 7) === monthKey;

    const isPendingInCurrentMonth =
      (billingMonth && billingMonth <= monthKey) ||
      (sub.frequency === 'monthly' && !paidThisMonth);

    if (!isPendingInCurrentMonth) continue;

    const subUsd =
      sub.currency === 'USD' || sub.currency === 'USDT'
        ? sub.amount
        : calcularEquivalenteUsd(
            sub.amount,
            'VES',
            activeRateForSubs || sub.exchangeRate
          ) || sub.amountUsd;

    if (Number.isFinite(subUsd) && subUsd > 0) {
      gastosPendientesMesUsd += subUsd;
      gastosPendientesTotalUsd += subUsd;
      subsPendientesUsd += subUsd;
      cantidadPendientesMes += 1;
      cantidadPendientesTotal += 1;
    }
  }

  let totalAportesAhorroUsd = 0;
  let totalRetirosAhorroUsd = 0;
  let totalAjustesAhorroUsd = 0;

  let ahorroAportadoMesUsd = 0;
  let ahorroRetiradoMesUsd = 0;

  for (const sav of data.savings) {
    const valUsd = Number.isFinite(sav.amountUsd) && sav.amountUsd > 0 ? sav.amountUsd : 0;
    const savMonth = sav.date.slice(0, 7);

    if (sav.type === 'deposit') {
      totalAportesAhorroUsd += valUsd;
      if (savMonth === monthKey) {
        ahorroAportadoMesUsd += valUsd;
      }
    } else if (sav.type === 'withdrawal') {
      totalRetirosAhorroUsd += valUsd;
      if (savMonth === monthKey) {
        ahorroRetiradoMesUsd += valUsd;
      }
    } else if (sav.type === 'adjustment') {
      const signed = sav.adjustmentDirection === 'subtract' ? -valUsd : valUsd;
      totalAjustesAhorroUsd += signed;
    }
  }

  const totalAhorradoUsd = Math.max(
    0,
    totalAportesAhorroUsd - totalRetirosAhorroUsd + totalAjustesAhorroUsd
  );

  // Obtenemos el resumen bimonetario de billeteras para garantizar coherencia exacta
  // entre "Todo lo que es Dólares", "Todo lo que es Bolívares" y el Consolidado Total.
  const walletsResumen = calcularResumenBilleteras(data, monthKey);

  const dineroDisponibleEstimadoUsd = walletsResumen.totalSaldoActualUsd;

  // Patrimonio financiero real: dinero disponible real + total ahorrado (sin duplicar aportes)
  const patrimonioFinancieroUsd = dineroDisponibleEstimadoUsd + totalAhorradoUsd;

  // Saldo Proyectado = Saldo Actual + Ingresos Pendientes - Gastos Pendientes
  const saldoProyectadoUsd = Number(
    (walletsResumen.totalSaldoProyectadoUsd - subsPendientesUsd).toFixed(6)
  );
  const patrimonioProyectadoUsd = saldoProyectadoUsd + totalAhorradoUsd;

  const balanceNetoMensualUsd = ingresosMesUsd - gastosMesUsd;
  const balanceProyectadoMesUsd = calcularSaldoProyectado(
    balanceNetoMensualUsd,
    ingresosPendientesMesUsd,
    gastosPendientesMesUsd
  );
  const capacidadAhorroMensualUsd = ingresosMesUsd - gastosMesUsd;
  const porcentajeGastosSobreIngresos =
    ingresosMesUsd > 0 ? (gastosMesUsd / ingresosMesUsd) * 100 : 0;

  // Presupuesto del mes
  const budgetObj: MonthlyBudget | undefined = data.budgets.find(
    (b) => b.monthKey === monthKey
  );
  let presupuestoMensualUsd = 0;
  if (budgetObj) {
    const sumCat = Object.values(budgetObj.categoryLimits || {}).reduce(
      (acc, v) => acc + (Number.isFinite(v) && v > 0 ? v : 0),
      0
    );
    presupuestoMensualUsd =
      budgetObj.totalLimitUsd > 0 ? budgetObj.totalLimitUsd : sumCat;
  }

  const presupuestoRestanteUsd = Math.max(0, presupuestoMensualUsd - gastosMesUsd);
  const presupuestoExcedidoUsd = Math.max(0, gastosMesUsd - presupuestoMensualUsd);
  const porcentajePresupuestoUtilizado =
    presupuestoMensualUsd > 0 ? (gastosMesUsd / presupuestoMensualUsd) * 100 : 0;

  const variacionIngresosPct =
    ingresosMesAnteriorUsd > 0
      ? ((ingresosMesUsd - ingresosMesAnteriorUsd) / ingresosMesAnteriorUsd) * 100
      : null;

  const variacionGastosPct =
    gastosMesAnteriorUsd > 0
      ? ((gastosMesUsd - gastosMesAnteriorUsd) / gastosMesAnteriorUsd) * 100
      : null;

  return {
    monthKey,
    ingresosMesUsd,
    ingresosMesSoloUsd,
    ingresosMesVesOriginal,
    ingresosMesSoloVesEquivUsd,
    gastosMesUsd,
    gastosMesSoloUsd,
    gastosMesVesOriginal,
    gastosMesSoloVesEquivUsd,
    balanceNetoMensualUsd,
    capacidadAhorroMensualUsd,
    porcentajeGastosSobreIngresos,
    ahorroAportadoMesUsd,
    ahorroRetiradoMesUsd,
    ahorroNetoMesUsd: ahorroAportadoMesUsd - ahorroRetiradoMesUsd,
    dineroDisponibleEstimadoUsd,
    balanceSoloDolaresUsd: walletsResumen.resumenSoloUsd.saldoActualUsd,
    balanceSoloDolaresEquivVes: walletsResumen.resumenSoloUsd.equivalenteVes,
    proyectadoSoloDolaresUsd: walletsResumen.resumenSoloUsd.saldoProyectadoUsd,
    enCuentasDolaresUsd: walletsResumen.resumenSoloUsd.enCuentasUsd,
    enEfectivoDolaresUsd: walletsResumen.resumenSoloUsd.enEfectivoUsd,
    balanceSoloBolivaresVes: walletsResumen.resumenSoloVes.saldoActualVes,
    balanceSoloBolivaresEquivUsd: walletsResumen.resumenSoloVes.equivalenteUsd,
    proyectadoSoloBolivaresVes: walletsResumen.resumenSoloVes.saldoProyectadoVes,
    enCuentasBolivaresVes: walletsResumen.resumenSoloVes.enCuentasVes,
    enCuentasBolivaresEquivUsd: walletsResumen.resumenSoloVes.enCuentasEquivUsd,
    enEfectivoBolivaresVes: walletsResumen.resumenSoloVes.enEfectivoVes,
    enEfectivoBolivaresEquivUsd: walletsResumen.resumenSoloVes.enEfectivoEquivUsd,
    totalEnCuentasConsolidadoUsd: walletsResumen.totalEnCuentasUsd,
    totalEnEfectivoConsolidadoUsd: walletsResumen.totalEnEfectivoUsd,
    totalAhorradoUsd,
    patrimonioFinancieroUsd,
    ingresosPendientesMesUsd,
    gastosPendientesMesUsd,
    ingresosPendientesTotalUsd,
    gastosPendientesTotalUsd,
    cantidadPendientesMes,
    cantidadPendientesTotal,
    balanceProyectadoMesUsd,
    saldoProyectadoUsd,
    patrimonioProyectadoUsd,
    presupuestoMensualUsd,
    presupuestoRestanteUsd,
    presupuestoExcedidoUsd,
    porcentajePresupuestoUtilizado,
    ingresosMesAnteriorUsd,
    gastosMesAnteriorUsd,
    variacionIngresosPct,
    variacionGastosPct,
  };
}

export interface ResumenBilleteraItem {
  wallet: WalletAccount;
  initialBalanceNominal: number;
  ingresosCompletadosUsd: number;
  gastosCompletadosUsd: number;
  ingresosCompletadosVes: number;
  gastosCompletadosVes: number;
  aportesAhorroUsd: number;
  retirosAhorroUsd: number;
  transferenciasEnviadasNominal: number;
  transferenciasRecibidasNominal: number;
  transferenciasCount: number;
  saldoActualUsd: number;
  saldoActualVes: number;
  ingresosPendientesUsd: number;
  gastosPendientesUsd: number;
  ingresosPendientesVes: number;
  gastosPendientesVes: number;
  saldoProyectadoUsd: number;
  saldoProyectadoVes: number;
  movimientosCompletadosCount: number;
  movimientosPendientesCount: number;
  // Campos especiales para Cuenta de Gastos / Uso de Otra Persona (Familiar / Tercero)
  pasadoMesNominal: number;
  pasadoMesUsd: number;
  pasadoMesVes: number;
  pasadoMesCount: number;
  acumuladoHistoricoNominal: number;
  acumuladoHistoricoUsd: number;
  acumuladoHistoricoUsdHistorico: number;
  acumuladoHistoricoVes: number;
}

/**
 * Determina si una billetera corresponde a dinero físico en Efectivo ($ o Bs).
 * Respeta el flag explícito `wallet.isCash`, el tipo `'cash_usd' | 'cash_ves'`
 * o nombres que indiquen efectivo ("efectivo", "billetes", "caja chica").
 */
export function esBilleteraEfectivo(wallet: WalletAccount): boolean {
  if (typeof wallet.isCash === 'boolean') {
    return wallet.isCash;
  }
  if (wallet.type === 'cash_usd' || wallet.type === 'cash_ves') {
    return true;
  }
  const lowerName = (wallet.name || '').toLowerCase();
  const lowerBanco = (wallet.banco || '').toLowerCase();
  return (
    lowerName.includes('efectivo') ||
    lowerBanco.includes('efectivo') ||
    lowerName.includes('billete') ||
    lowerName.includes('caja chica')
  );
}

/**
 * Calcula los saldos reales y proyectados segmentados por cada Billetera (Wallet),
 * así como los balances separados para cuentas en Dólares (USD/USDT) y cuentas en Bolívares (VES),
 * discriminando cuánto está en Cuentas Bancarias/Digitales vs. en Efectivo.
 * Las billeteras marcadas con `isThirdPartyExpenseAccount: true` no suman al saldo disponible
 * personal ni al patrimonio, sino que acumulan lo pasado en el mes y su histórico total con equivalente en USD.
 */
export function calcularResumenBilleteras(
  data: AppDataSchema,
  monthKey: string = obtenerMesLocalIso()
): {
  billeteras: ResumenBilleteraItem[];
  sinBilletera: {
    ingresosCompletadosUsd: number;
    gastosCompletadosUsd: number;
    aportesAhorroUsd: number;
    retirosAhorroUsd: number;
    saldoActualUsd: number;
    ingresosPendientesUsd: number;
    gastosPendientesUsd: number;
    saldoProyectadoUsd: number;
    count: number;
  };
  resumenSoloUsd: {
    saldoActualUsd: number;
    equivalenteVes: number;
    saldoProyectadoUsd: number;
    proyectadoEquivalenteVes: number;
    ingresosPendientesUsd: number;
    gastosPendientesUsd: number;
    cuentasCount: number;
    enCuentasUsd: number;
    enCuentasEquivVes: number;
    enEfectivoUsd: number;
    enEfectivoEquivVes: number;
    cuentasBancariasCount: number;
    cuentasEfectivoCount: number;
  };
  resumenSoloVes: {
    saldoActualVes: number;
    equivalenteUsd: number;
    saldoProyectadoVes: number;
    proyectadoEquivalenteUsd: number;
    ingresosPendientesVes: number;
    gastosPendientesVes: number;
    cuentasCount: number;
    enCuentasVes: number;
    enCuentasEquivUsd: number;
    enEfectivoVes: number;
    enEfectivoEquivUsd: number;
    cuentasBancariasCount: number;
    cuentasEfectivoCount: number;
  };
  totalSaldoActualUsd: number;
  totalSaldoActualVesEquiv: number;
  totalSaldoProyectadoUsd: number;
  totalSaldoProyectadoVesEquiv: number;
  totalEnCuentasUsd: number;
  totalEnEfectivoUsd: number;
} {
  const activeRate =
    (data.settings.preferManualRateByDefault && data.settings.defaultExchangeRate) ||
    data.settings.lastOfficialRate ||
    data.settings.defaultExchangeRate ||
    450;

  const walletMap = new Map((data.wallets || []).map((w) => [w.id, w]));
  const walletIds = new Set((data.wallets || []).map((w) => w.id));

  const statsMap = new Map<
    string,
    {
      ingComp: number;
      gasComp: number;
      ingCompVes: number;
      gasCompVes: number;
      apSav: number;
      retSav: number;
      apSavVes: number;
      retSavVes: number;
      transferOutUsd: number;
      transferInUsd: number;
      transferOutVes: number;
      transferInVes: number;
      transferCount: number;
      ingPend: number;
      gasPend: number;
      ingPendVes: number;
      gasPendVes: number;
      compCount: number;
      pendCount: number;
      passedMonthUsd: number;
      passedMonthVes: number;
      passedMonthCount: number;
      passedTotalUsd: number;
      passedTotalVes: number;
    }
  >();

  for (const w of data.wallets || []) {
    statsMap.set(w.id, {
      ingComp: 0,
      gasComp: 0,
      ingCompVes: 0,
      gasCompVes: 0,
      apSav: 0,
      retSav: 0,
      apSavVes: 0,
      retSavVes: 0,
      transferOutUsd: 0,
      transferInUsd: 0,
      transferOutVes: 0,
      transferInVes: 0,
      transferCount: 0,
      ingPend: 0,
      gasPend: 0,
      ingPendVes: 0,
      gasPendVes: 0,
      compCount: 0,
      pendCount: 0,
      passedMonthUsd: 0,
      passedMonthVes: 0,
      passedMonthCount: 0,
      passedTotalUsd: 0,
      passedTotalVes: 0,
    });
  }

  const unassigned = {
    ingComp: 0,
    gasComp: 0,
    apSav: 0,
    retSav: 0,
    ingPend: 0,
    gasPend: 0,
    count: 0,
  };

  for (const txn of data.transactions) {
    const valUsd = Number.isFinite(txn.amountUsd) ? txn.amountUsd : 0;
    const rateUsed =
      txn.exchangeRate && Number.isFinite(txn.exchangeRate) && txn.exchangeRate > 0
        ? txn.exchangeRate
        : activeRate;
    const valVes =
      txn.currency === 'VES'
        ? Number.isFinite(txn.amount)
          ? txn.amount
          : valUsd * rateUsed
        : valUsd * rateUsed;

    const completed = esTransaccionCompletada(txn);
    const targetWallet =
      txn.walletId && walletIds.has(txn.walletId)
        ? walletMap.get(txn.walletId)!
        : null;
    const targetStats =
      txn.walletId && walletIds.has(txn.walletId)
        ? statsMap.get(txn.walletId)!
        : null;

    if (targetStats && targetWallet) {
      if (targetWallet.isThirdPartyExpenseAccount || targetWallet.isPassThroughAccount) {
        // En una cuenta de gastos de tercero/familiar o cuenta de paso de terceros, todo movimiento completado hacia esa cuenta
        // representa dinero pasado a esa persona (acumula en el mes y en el histórico de esa ficha).
        if (completed) {
          targetStats.compCount += 1;
          targetStats.passedTotalUsd += valUsd;
          targetStats.passedTotalVes += valVes;
          targetStats.ingComp += valUsd;
          targetStats.ingCompVes += valVes;
          if (
            obtenerFechaEfectivaContableTransaccion(txn, data).slice(0, 7) ===
            monthKey
          ) {
            targetStats.passedMonthUsd += valUsd;
            targetStats.passedMonthVes += valVes;
            targetStats.passedMonthCount += 1;
          }
        } else {
          targetStats.pendCount += 1;
          targetStats.ingPend += valUsd;
          targetStats.ingPendVes += valVes;
        }
      } else {
        if (completed) {
          targetStats.compCount += 1;
          if (txn.type === 'income') {
            targetStats.ingComp += valUsd;
            targetStats.ingCompVes += valVes;
          } else {
            targetStats.gasComp += valUsd;
            targetStats.gasCompVes += valVes;
          }
        } else {
          targetStats.pendCount += 1;
          if (txn.type === 'income') {
            targetStats.ingPend += valUsd;
            targetStats.ingPendVes += valVes;
          } else {
            targetStats.gasPend += valUsd;
            targetStats.gasPendVes += valVes;
          }
        }
      }
    } else {
      unassigned.count += 1;
      if (completed) {
        if (txn.type === 'income') unassigned.ingComp += valUsd;
        else unassigned.gasComp += valUsd;
      } else {
        if (txn.type === 'income') unassigned.ingPend += valUsd;
        else unassigned.gasPend += valUsd;
      }
    }

    // Si el movimiento salió de una billetera propia (ej. Mercantil: txn.walletId) hacia una cuenta familiar (Mamá: txn.thirdPartyTargetWalletId),
    // además de debitarse arriba de la cuenta propia (targetStats.gasComp / gasCompVes), acreditamos el monto en el acumulado de la cuenta familiar destino:
    if (
      txn.thirdPartyTargetWalletId &&
      txn.thirdPartyTargetWalletId !== txn.walletId &&
      walletIds.has(txn.thirdPartyTargetWalletId)
    ) {
      const tpWallet = walletMap.get(txn.thirdPartyTargetWalletId)!;
      const tpStats = statsMap.get(txn.thirdPartyTargetWalletId)!;
      if (tpWallet.isThirdPartyExpenseAccount || tpWallet.isPassThroughAccount) {
        if (completed) {
          tpStats.compCount += 1;
          tpStats.passedTotalUsd += valUsd;
          tpStats.passedTotalVes += valVes;
          tpStats.ingComp += valUsd;
          tpStats.ingCompVes += valVes;
          if (
            obtenerFechaEfectivaContableTransaccion(txn, data).slice(0, 7) ===
            monthKey
          ) {
            tpStats.passedMonthUsd += valUsd;
            tpStats.passedMonthVes += valVes;
            tpStats.passedMonthCount += 1;
          }
        } else {
          tpStats.pendCount += 1;
          tpStats.ingPend += valUsd;
          tpStats.ingPendVes += valVes;
        }
      }
    }
  }

  for (const sav of data.savings) {
    const valUsd =
      Number.isFinite(sav.amountUsd) && sav.amountUsd > 0 ? sav.amountUsd : 0;
    const rateUsed =
      sav.exchangeRateUsed &&
      Number.isFinite(sav.exchangeRateUsed) &&
      sav.exchangeRateUsed > 0
        ? sav.exchangeRateUsed
        : activeRate;
    const valVes =
      sav.originalCurrency === 'VES' &&
      sav.originalAmountVes != null &&
      Number.isFinite(sav.originalAmountVes) &&
      sav.originalAmountVes > 0
        ? sav.originalAmountVes
        : valUsd * rateUsed;

    const targetStats =
      sav.walletId && walletIds.has(sav.walletId)
        ? statsMap.get(sav.walletId)!
        : null;

    if (targetStats) {
      if (sav.type === 'deposit') {
        targetStats.apSav += valUsd;
        targetStats.apSavVes += valVes;
      } else if (sav.type === 'withdrawal') {
        targetStats.retSav += valUsd;
        targetStats.retSavVes += valVes;
      }
    } else {
      if (sav.type === 'deposit') unassigned.apSav += valUsd;
      else if (sav.type === 'withdrawal') unassigned.retSav += valUsd;
    }
  }

  // Impacto del Fondo Virtual de Citas (Romance Budget):
  // - Cuando se asigna dinero ('allocate'), deja de verse como disponible en el Saldo General y en la Wallet.
  // - Cuando se gasta ('spend') o se devuelve ('return'), se libera la reserva virtual (y si es 'spend', el egreso real en data.transactions descuenta el gasto sin duplicar).
  for (const mov of data.romanceFund?.movements || []) {
    const valUsd =
      Number.isFinite(mov.amountUsd) && mov.amountUsd > 0 ? mov.amountUsd : 0;
    const rateUsed =
      mov.exchangeRate &&
      Number.isFinite(mov.exchangeRate) &&
      mov.exchangeRate > 0
        ? mov.exchangeRate
        : activeRate;
    const valVes =
      mov.currency === 'VES' &&
      Number.isFinite(mov.amount) &&
      mov.amount > 0
        ? mov.amount
        : valUsd * rateUsed;

    const targetStats =
      mov.walletId && walletIds.has(mov.walletId)
        ? statsMap.get(mov.walletId)!
        : null;

    if (targetStats) {
      if (mov.type === 'allocate') {
        targetStats.apSav += valUsd;
        targetStats.apSavVes += valVes;
      } else if (mov.type === 'spend' || mov.type === 'return') {
        targetStats.retSav += valUsd;
        targetStats.retSavVes += valVes;
      }
    } else {
      if (mov.type === 'allocate') {
        unassigned.apSav += valUsd;
      } else if (mov.type === 'spend' || mov.type === 'return') {
        unassigned.retSav += valUsd;
      }
    }
  }

  // Impacto de Transferencias entre Wallets con Tasa Personalizada (Conversor P2P)
  // Descuenta amountOut del Saldo Real de Wallet Origen y suma amountIn al Saldo Real de Wallet Destino
  // sin afectar las estadísticas mensuales de Ingresos o Egresos regulares.
  for (const tr of data.walletTransfers || []) {
    const outAmt =
      typeof tr.amountOut === 'number' && Number.isFinite(tr.amountOut) && tr.amountOut > 0
        ? tr.amountOut
        : 0;
    const inAmt =
      typeof tr.amountIn === 'number' && Number.isFinite(tr.amountIn) && tr.amountIn > 0
        ? tr.amountIn
        : 0;
    const rateUsed =
      typeof tr.exchangeRate === 'number' &&
      Number.isFinite(tr.exchangeRate) &&
      tr.exchangeRate > 0
        ? tr.exchangeRate
        : activeRate;

    const srcWallet = tr.sourceWalletId ? walletMap.get(tr.sourceWalletId) : undefined;
    const dstWallet = tr.destinationWalletId ? walletMap.get(tr.destinationWalletId) : undefined;
    const isSrcVes = (srcWallet?.currency || tr.sourceCurrency) === 'VES';
    const isDstVes = (dstWallet?.currency || tr.destinationCurrency) === 'VES';
    const effectiveUsdRate =
      isSrcVes && isDstVes && rateUsed <= 1.05 ? activeRate : rateUsed;

    if (tr.sourceWalletId && walletIds.has(tr.sourceWalletId)) {
      const srcStats = statsMap.get(tr.sourceWalletId)!;
      srcStats.transferCount += 1;
      if (isSrcVes) {
        srcStats.transferOutVes += outAmt;
        srcStats.transferOutUsd +=
          effectiveUsdRate > 0 ? outAmt / effectiveUsdRate : 0;
      } else {
        srcStats.transferOutUsd += outAmt;
        srcStats.transferOutVes +=
          !isSrcVes && !isDstVes && rateUsed <= 1.05
            ? outAmt * activeRate
            : outAmt * rateUsed;
      }
    }

    if (tr.destinationWalletId && walletIds.has(tr.destinationWalletId)) {
      const dstStats = statsMap.get(tr.destinationWalletId)!;
      dstStats.transferCount += 1;
      const inUsdEquiv = isDstVes
        ? effectiveUsdRate > 0
          ? inAmt / effectiveUsdRate
          : 0
        : inAmt;
      const inVesEquiv = isDstVes
        ? inAmt
        : !isSrcVes && !isDstVes && rateUsed <= 1.05
          ? inAmt * activeRate
          : inAmt * rateUsed;

      dstStats.transferInVes += inVesEquiv;
      dstStats.transferInUsd += inUsdEquiv;

      if (
        (dstWallet?.isThirdPartyExpenseAccount || dstWallet?.isPassThroughAccount) &&
        (tr.date || '').slice(0, 7) === monthKey
      ) {
        dstStats.passedMonthVes += inVesEquiv;
        dstStats.passedMonthUsd += inUsdEquiv;
        dstStats.passedMonthCount += 1;
      }
    }
  }

  const orderedWallets = [...(data.wallets || [])].sort((a, b) => {
    const oa =
      typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder)
        ? a.sortOrder
        : Number.MAX_SAFE_INTEGER;
    const ob =
      typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder)
        ? b.sortOrder
        : Number.MAX_SAFE_INTEGER;
    return oa - ob;
  });

  const billeteras: ResumenBilleteraItem[] = orderedWallets.map((w) => {
    const st = statsMap.get(w.id)!;
    const isVesWallet = w.currency === 'VES';

    let initialBalanceNominal = 0;
    let saldoActualUsd = 0;
    let saldoActualVes = 0;
    let saldoProyectadoUsd = 0;
    let saldoProyectadoVes = 0;

    const initVes =
      w.initialBalanceVes != null && Number.isFinite(w.initialBalanceVes)
        ? w.initialBalanceVes
        : (Number.isFinite(w.initialBalanceUsd) ? w.initialBalanceUsd : 0) *
          activeRate;
    const initUsd = Number.isFinite(w.initialBalanceUsd)
      ? w.initialBalanceUsd
      : activeRate > 0
        ? initVes / activeRate
        : 0;

    const acumuladoHistoricoVes = Number(
      (initVes + st.passedTotalVes + st.transferInVes).toFixed(2)
    );
    const acumuladoHistoricoUsdHistorico = Number(
      (initUsd + st.passedTotalUsd + st.transferInUsd).toFixed(6)
    );
    const acumuladoHistoricoUsd = isVesWallet
      ? activeRate > 0
        ? Number((acumuladoHistoricoVes / activeRate).toFixed(6))
        : acumuladoHistoricoUsdHistorico
      : acumuladoHistoricoUsdHistorico;

    if (w.isThirdPartyExpenseAccount || w.isPassThroughAccount) {
      initialBalanceNominal = isVesWallet ? initVes : initUsd;
      saldoActualVes = acumuladoHistoricoVes;
      saldoActualUsd = acumuladoHistoricoUsd;
      saldoProyectadoVes = Number((acumuladoHistoricoVes + st.ingPendVes).toFixed(2));
      saldoProyectadoUsd = Number((acumuladoHistoricoUsd + st.ingPend).toFixed(6));
    } else if (isVesWallet) {
      // Para billeteras en Bolívares (VES), el saldo nominal en Bs es exacto y no fluctúa con la tasa;
      // lo que se recalcula según la tasa activa es su equivalente en USD.
      initialBalanceNominal = initVes;
      saldoActualVes = Number(
        (
          initVes +
          st.ingCompVes -
          st.gasCompVes -
          st.apSavVes +
          st.retSavVes -
          st.transferOutVes +
          st.transferInVes
        ).toFixed(2)
      );
      saldoProyectadoVes = Number(
        (saldoActualVes + st.ingPendVes - st.gasPendVes).toFixed(2)
      );
      saldoActualUsd =
        activeRate > 0 ? Number((saldoActualVes / activeRate).toFixed(6)) : 0;
      saldoProyectadoUsd =
        activeRate > 0
          ? Number((saldoProyectadoVes / activeRate).toFixed(6))
          : 0;
    } else {
      // Para billeteras en Dólares (USD / USDT), el saldo nominal en USD es exacto;
      // su equivalente en Bolívares se calcula con la tasa activa.
      initialBalanceNominal = initUsd;
      saldoActualUsd = Number(
        (
          initUsd +
          st.ingComp -
          st.gasComp -
          st.apSav +
          st.retSav -
          st.transferOutUsd +
          st.transferInUsd
        ).toFixed(6)
      );
      saldoProyectadoUsd = calcularSaldoProyectado(
        saldoActualUsd,
        st.ingPend,
        st.gasPend
      );
      saldoActualVes = Number((saldoActualUsd * activeRate).toFixed(2));
      saldoProyectadoVes = Number((saldoProyectadoUsd * activeRate).toFixed(2));
    }

    return {
      wallet: w,
      initialBalanceNominal,
      ingresosCompletadosUsd: st.ingComp,
      gastosCompletadosUsd: st.gasComp,
      ingresosCompletadosVes: st.ingCompVes,
      gastosCompletadosVes: st.gasCompVes,
      aportesAhorroUsd: st.apSav,
      retirosAhorroUsd: st.retSav,
      transferenciasEnviadasNominal: isVesWallet
        ? st.transferOutVes
        : st.transferOutUsd,
      transferenciasRecibidasNominal: isVesWallet
        ? st.transferInVes
        : st.transferInUsd,
      transferenciasCount: st.transferCount,
      saldoActualUsd,
      saldoActualVes,
      ingresosPendientesUsd: st.ingPend,
      gastosPendientesUsd: st.gasPend,
      ingresosPendientesVes: st.ingPendVes,
      gastosPendientesVes: st.gasPendVes,
      saldoProyectadoUsd,
      saldoProyectadoVes,
      movimientosCompletadosCount: st.compCount,
      movimientosPendientesCount: st.pendCount,
      pasadoMesNominal: isVesWallet ? st.passedMonthVes : st.passedMonthUsd,
      pasadoMesUsd: isVesWallet
        ? st.passedMonthUsd > 0
          ? st.passedMonthUsd
          : activeRate > 0
            ? st.passedMonthVes / activeRate
            : 0
        : st.passedMonthUsd,
      pasadoMesVes: st.passedMonthVes,
      pasadoMesCount: st.passedMonthCount,
      acumuladoHistoricoNominal: isVesWallet
        ? acumuladoHistoricoVes
        : acumuladoHistoricoUsdHistorico,
      acumuladoHistoricoUsd,
      acumuladoHistoricoUsdHistorico,
      acumuladoHistoricoVes,
    };
  });

  const generalStartBal = Number.isFinite(data.settings.startingBalanceUsd)
    ? data.settings.startingBalanceUsd
    : 0;
  const sinBilleteraActualUsd =
    generalStartBal +
    unassigned.ingComp -
    unassigned.gasComp -
    unassigned.apSav +
    unassigned.retSav;
  const sinBilleteraProyectadoUsd = calcularSaldoProyectado(
    sinBilleteraActualUsd,
    unassigned.ingPend,
    unassigned.gasPend
  );

  // Separación estricta: Todo lo que es Dólares (USD / USDT) vs Todo lo que es Bolívares (VES)
  // Excluimos las cuentas de gastos de terceros/familiares (`isThirdPartyExpenseAccount`) y las cuentas de paso de terceros (`isPassThroughAccount`) para que NO sumen a tu disponible personal
  const personalWallets = billeteras.filter(
    (b) => !b.wallet.isThirdPartyExpenseAccount && !b.wallet.isPassThroughAccount
  );
  const usdWallets = personalWallets.filter((b) => b.wallet.currency !== 'VES');
  const vesWallets = personalWallets.filter((b) => b.wallet.currency === 'VES');

  const soloUsdActual =
    usdWallets.reduce((acc, b) => acc + b.saldoActualUsd, 0) +
    sinBilleteraActualUsd;
  const soloUsdProyectado =
    usdWallets.reduce((acc, b) => acc + b.saldoProyectadoUsd, 0) +
    sinBilleteraProyectadoUsd;
  const soloUsdIngPend =
    usdWallets.reduce((acc, b) => acc + b.ingresosPendientesUsd, 0) +
    unassigned.ingPend;
  const soloUsdGasPend =
    usdWallets.reduce((acc, b) => acc + b.gastosPendientesUsd, 0) +
    unassigned.gasPend;

  const soloVesActual = vesWallets.reduce((acc, b) => acc + b.saldoActualVes, 0);
  const soloVesProyectado = vesWallets.reduce(
    (acc, b) => acc + b.saldoProyectadoVes,
    0
  );
  const soloVesIngPend = vesWallets.reduce(
    (acc, b) => acc + b.ingresosPendientesVes,
    0
  );
  const soloVesGasPend = vesWallets.reduce(
    (acc, b) => acc + b.gastosPendientesVes,
    0
  );

  const usdCashWallets = usdWallets.filter((b) => esBilleteraEfectivo(b.wallet));
  const usdBankWallets = usdWallets.filter((b) => !esBilleteraEfectivo(b.wallet));
  const vesCashWallets = vesWallets.filter((b) => esBilleteraEfectivo(b.wallet));
  const vesBankWallets = vesWallets.filter((b) => !esBilleteraEfectivo(b.wallet));

  const enEfectivoUsd = Number(
    usdCashWallets.reduce((acc, b) => acc + b.saldoActualUsd, 0).toFixed(6)
  );
  const enCuentasUsd = Number(
    (
      usdBankWallets.reduce((acc, b) => acc + b.saldoActualUsd, 0) +
      sinBilleteraActualUsd
    ).toFixed(6)
  );

  const enEfectivoVes = Number(
    vesCashWallets.reduce((acc, b) => acc + b.saldoActualVes, 0).toFixed(2)
  );
  const enCuentasVes = Number(
    vesBankWallets.reduce((acc, b) => acc + b.saldoActualVes, 0).toFixed(2)
  );
  const enEfectivoVesEquivUsd =
    activeRate > 0 ? Number((enEfectivoVes / activeRate).toFixed(6)) : 0;
  const enCuentasVesEquivUsd =
    activeRate > 0 ? Number((enCuentasVes / activeRate).toFixed(6)) : 0;

  const resumenSoloUsd = {
    saldoActualUsd: soloUsdActual,
    equivalenteVes: soloUsdActual * activeRate,
    saldoProyectadoUsd: soloUsdProyectado,
    proyectadoEquivalenteVes: soloUsdProyectado * activeRate,
    ingresosPendientesUsd: soloUsdIngPend,
    gastosPendientesUsd: soloUsdGasPend,
    cuentasCount: usdWallets.filter((w) => w.wallet.active).length,
    enCuentasUsd,
    enCuentasEquivVes: enCuentasUsd * activeRate,
    enEfectivoUsd,
    enEfectivoEquivVes: enEfectivoUsd * activeRate,
    cuentasBancariasCount: usdBankWallets.filter((w) => w.wallet.active).length,
    cuentasEfectivoCount: usdCashWallets.filter((w) => w.wallet.active).length,
  };

  const resumenSoloVes = {
    saldoActualVes: soloVesActual,
    equivalenteUsd: activeRate > 0 ? soloVesActual / activeRate : 0,
    saldoProyectadoVes: soloVesProyectado,
    proyectadoEquivalenteUsd:
      activeRate > 0 ? soloVesProyectado / activeRate : 0,
    ingresosPendientesVes: soloVesIngPend,
    gastosPendientesVes: soloVesGasPend,
    cuentasCount: vesWallets.filter((w) => w.wallet.active).length,
    enCuentasVes,
    enCuentasEquivUsd: enCuentasVesEquivUsd,
    enEfectivoVes,
    enEfectivoEquivUsd: enEfectivoVesEquivUsd,
    cuentasBancariasCount: vesBankWallets.filter((w) => w.wallet.active).length,
    cuentasEfectivoCount: vesCashWallets.filter((w) => w.wallet.active).length,
  };

  const totalSaldoActualUsd =
    resumenSoloUsd.saldoActualUsd + resumenSoloVes.equivalenteUsd;
  const totalSaldoProyectadoUsd =
    resumenSoloUsd.saldoProyectadoUsd + resumenSoloVes.proyectadoEquivalenteUsd;
  const totalEnCuentasUsd = Number(
    (enCuentasUsd + enCuentasVesEquivUsd).toFixed(6)
  );
  const totalEnEfectivoUsd = Number(
    (enEfectivoUsd + enEfectivoVesEquivUsd).toFixed(6)
  );

  return {
    billeteras,
    sinBilletera: {
      ingresosCompletadosUsd: unassigned.ingComp,
      gastosCompletadosUsd: unassigned.gasComp,
      aportesAhorroUsd: unassigned.apSav,
      retirosAhorroUsd: unassigned.retSav,
      saldoActualUsd: sinBilleteraActualUsd,
      ingresosPendientesUsd: unassigned.ingPend,
      gastosPendientesUsd: unassigned.gasPend,
      saldoProyectadoUsd: sinBilleteraProyectadoUsd,
      count: unassigned.count,
    },
    resumenSoloUsd,
    resumenSoloVes,
    totalSaldoActualUsd,
    totalSaldoActualVesEquiv: totalSaldoActualUsd * activeRate,
    totalSaldoProyectadoUsd,
    totalSaldoProyectadoVesEquiv: totalSaldoProyectadoUsd * activeRate,
    totalEnCuentasUsd,
    totalEnEfectivoUsd,
  };
}

/**
 * Calcula el saldo acumulado de una meta de ahorro a partir de los movimientos de ahorro asociados.
 * Evita duplicar dinero al derivarse directamente de data.savings.
 */
export function calcularProgresoMeta(
  goal: SavingsGoal,
  savings: SavingsMovement[]
): {
  ahorradoUsd: number;
  restanteUsd: number;
  porcentaje: number;
  movimientosAsociados: SavingsMovement[];
} {
  const movimientosAsociados = savings.filter((s) => s.goalId === goal.id);
  let ahorradoUsd = 0;

  for (const mov of movimientosAsociados) {
    const val = Number.isFinite(mov.amountUsd) && mov.amountUsd > 0 ? mov.amountUsd : 0;
    if (mov.type === 'deposit') {
      ahorradoUsd += val;
    } else if (mov.type === 'withdrawal') {
      ahorradoUsd -= val;
    } else if (mov.type === 'adjustment') {
      ahorradoUsd += mov.adjustmentDirection === 'subtract' ? -val : val;
    }
  }

  ahorradoUsd = Math.max(0, ahorradoUsd);
  const target = goal.targetAmountUsd > 0 ? goal.targetAmountUsd : 0;
  const restanteUsd = Math.max(0, target - ahorradoUsd);
  const porcentaje = target > 0 ? Math.min(100, (ahorradoUsd / target) * 100) : 0;

  return {
    ahorradoUsd,
    restanteUsd,
    porcentaje,
    movimientosAsociados,
  };
}

/**
 * Calcula el saldo pendiente de una deuda en USD y en su moneda original.
 */
export function calcularEstadoDeuda(debt: Debt): {
  pagadoUsd: number;
  pendienteUsd: number;
  porcentajePagado: number;
} {
  const pagadoUsd = (debt.payments || []).reduce(
    (acc, p) => acc + (Number.isFinite(p.amountUsd) ? p.amountUsd : 0),
    0
  );
  const totalUsd = Number.isFinite(debt.totalAmountUsd) ? debt.totalAmountUsd : 0;
  const pendienteUsd = Math.max(0, totalUsd - pagadoUsd);
  const porcentajePagado =
    totalUsd > 0 ? Math.min(100, (pagadoUsd / totalUsd) * 100) : 0;

  return {
    pagadoUsd,
    pendienteUsd,
    porcentajePagado,
  };
}

export interface SerieMensualItem {
  monthKey: string;
  label: string;
  ingresosUsd: number;
  gastosUsd: number;
  balanceUsd: number;
  ahorroNetoMesUsd: number;
  ahorroAcumuladoUsd: number;
  disponibleAcumuladoUsd: number;
  patrimonioAcumuladoUsd: number;
}

/**
 * Genera la serie temporal de los últimos N meses hasta el mes seleccionado (inclusive)
 * para alimentar las gráficas de evolución mensual (solo transacciones Completadas).
 */
export function obtenerSerieMensual(
  data: AppDataSchema,
  endMonthKey: string,
  monthsCount = 6
): SerieMensualItem[] {
  const [yStr, mStr] = endMonthKey.split('-');
  const endYear = Number(yStr) || new Date().getFullYear();
  const endMonth = Number(mStr) || new Date().getMonth() + 1;

  const monthKeys: string[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(endYear, endMonth - 1 - i, 1);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthKeys.push(mk);
  }

  const mesesCortos = [
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

  const thirdPartyWalletIds = new Set(
    (data.wallets || [])
      .filter((w) => w.isThirdPartyExpenseAccount && !w.isPassThroughAccount)
      .map((w) => w.id)
  );
  const passThroughWalletIds = new Set(
    (data.wallets || [])
      .filter((w) => w.isPassThroughAccount)
      .map((w) => w.id)
  );

  const walletsInitialSum = (data.wallets || [])
    .filter((w) => !w.isThirdPartyExpenseAccount && !w.isPassThroughAccount)
    .reduce(
      (acc, w) =>
        acc + (Number.isFinite(w.initialBalanceUsd) ? w.initialBalanceUsd : 0),
      0
    );

  return monthKeys.map((mk) => {
    const [, mPart] = mk.split('-');
    const mIdx = (Number(mPart) || 1) - 1;
    const label = `${mesesCortos[mIdx]} ${mk.slice(2, 4)}`;

    let ingresosUsd = 0;
    let gastosUsd = 0;
    let ingAcum = 0;
    let gasAcum = 0;

    for (const t of data.transactions) {
      if (!esTransaccionCompletada(t)) continue;
      if (
        Boolean(t.isPassThroughThirdParty) ||
        Boolean(t.walletId && passThroughWalletIds.has(t.walletId))
      ) {
        continue;
      }
      const tMonth = obtenerFechaEfectivaContableTransaccion(t, data).slice(
        0,
        7
      );
      const val = Number.isFinite(t.amountUsd) ? t.amountUsd : 0;
      const isThirdParty =
        Boolean(t.isThirdPartyAllowance) ||
        Boolean(t.walletId && thirdPartyWalletIds.has(t.walletId));
      const effectiveType = isThirdParty ? 'expense' : t.type;

      if (tMonth <= mk) {
        if (effectiveType === 'income') ingAcum += val;
        if (effectiveType === 'expense') gasAcum += val;
      }
      if (tMonth === mk) {
        if (effectiveType === 'income') ingresosUsd += val;
        if (effectiveType === 'expense') gastosUsd += val;
      }
    }

    let ahorroNetoMesUsd = 0;
    let apAcum = 0;
    let retAcum = 0;
    let ajAcum = 0;

    for (const s of data.savings) {
      const sMonth = s.date.slice(0, 7);
      const val = Number.isFinite(s.amountUsd) ? s.amountUsd : 0;
      if (sMonth <= mk) {
        if (s.type === 'deposit') apAcum += val;
        else if (s.type === 'withdrawal') retAcum += val;
        else if (s.type === 'adjustment') {
          ajAcum += s.adjustmentDirection === 'subtract' ? -val : val;
        }
      }
      if (sMonth === mk) {
        if (s.type === 'deposit') ahorroNetoMesUsd += val;
        else if (s.type === 'withdrawal') ahorroNetoMesUsd -= val;
      }
    }

    const ahorroAcumuladoUsd = Math.max(0, apAcum - retAcum + ajAcum);
    const startBal =
      (Number.isFinite(data.settings.startingBalanceUsd)
        ? data.settings.startingBalanceUsd
        : 0) + walletsInitialSum;
    const disponibleAcumuladoUsd = startBal + ingAcum - gasAcum - apAcum + retAcum;
    const patrimonioAcumuladoUsd = disponibleAcumuladoUsd + ahorroAcumuladoUsd;

    return {
      monthKey: mk,
      label,
      ingresosUsd,
      gastosUsd,
      balanceUsd: ingresosUsd - gastosUsd,
      ahorroNetoMesUsd,
      ahorroAcumuladoUsd,
      disponibleAcumuladoUsd,
      patrimonioAcumuladoUsd,
    };
  });
}

export interface DistribucionCategoriaItem {
  categoryId: string;
  categoryName: string;
  color: string;
  amountUsd: number;
  percentage: number;
  count: number;
}

/**
 * Determina si el nombre de una categoría corresponde a una categoría de comisiones.
 */
export function esNombreCategoriaComision(name?: string | null): boolean {
  if (!name) return false;
  const clean = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    clean === 'comision' ||
    clean === 'comisiones' ||
    clean === 'comision bancaria' ||
    clean === 'comisiones bancarias' ||
    clean.includes('comision bancaria') ||
    clean.includes('comisiones bancarias')
  );
}

/**
 * Obtiene siempre el ID canónico de la categoría de GASTO para Comisiones Bancarias,
 * evitando tomar por error la categoría de ingreso `cat_inc_commissions` ("Comisiones")
 * o duplicar categorías de comisiones en el reporte PDF.
 */
export function obtenerIdCategoriaComisionBancaria(categories: Category[]): string {
  const exactExpense = categories.find(
    (c) => c.id === 'cat_exp_bank_fees' && c.type === 'expense'
  );
  if (exactExpense) return exactExpense.id;

  const anyById = categories.find((c) => c.id === 'cat_exp_bank_fees');
  if (anyById) return anyById.id;

  const expenseByName = categories.find(
    (c) => c.type === 'expense' && esNombreCategoriaComision(c.name)
  );
  if (expenseByName) return expenseByName.id;

  const fallbackExpenseComision = categories.find(
    (c) =>
      c.type === 'expense' &&
      c.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .includes('comision')
  );
  if (fallbackExpenseComision) return fallbackExpenseComision.id;

  return 'cat_exp_bank_fees';
}

/**
 * Normaliza el `categoryId` de un movimiento de gasto para que cualquier comisión
 * (automática o manual, o asignada accidentalmente a `cat_inc_commissions` o a otra
 * categoría duplicada llamada "Comisiones") se unifique en una sola categoría de gasto.
 */
export function normalizarCategoriaGastoComision(
  categoryId: string,
  categories: Category[],
  txn?: Partial<Transaction>
): string {
  const canonicalFeeCatId = obtenerIdCategoriaComisionBancaria(categories);
  if (categoryId === canonicalFeeCatId) return canonicalFeeCatId;

  // Si un gasto tiene por error la categoría de ingresos de comisiones o es un movimiento hijo de comisión bancaria
  if (categoryId === 'cat_inc_commissions' || Boolean(txn?.parentTransactionId)) {
    return canonicalFeeCatId;
  }

  const cat = categories.find((c) => c.id === categoryId);
  if (cat && esNombreCategoriaComision(cat.name)) {
    return canonicalFeeCatId;
  }

  const descClean = (txn?.description || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    descClean.startsWith('comision bancaria') ||
    descClean.startsWith('comision pago movil') ||
    descClean.startsWith('comision por transferencia') ||
    descClean.startsWith('[comision')
  ) {
    return canonicalFeeCatId;
  }

  return categoryId;
}

/**
 * Extrae la marca de tiempo de proceso (fecha + hora) de una transacción a partir de:
 * 1) `txn.processedAt` o `txn.createdAt` (si incluyen hora)
 * 2) El timestamp Unix en milisegundos (13 dígitos) embebido en `txn.id` o `txn.parentTransactionId`
 * 3) Fallback a la fecha nominal `txn.date`
 */
export function obtenerInfoHoraProcesoTransaccion(
  txn: {
    date: string;
    processedAt?: string;
    createdAt?: string;
    id?: string;
    parentTransactionId?: string;
  },
  locale: string = 'es-VE'
): {
  timestampMs: number;
  timeFormatted: string;
  dateTimeFormatted: string;
  hasExplicitTime: boolean;
} {
  let extractedDate: Date | null = null;
  let hasExplicitTime = false;

  const isoCandidate = txn.processedAt || txn.createdAt;
  if (typeof isoCandidate === 'string' && isoCandidate.trim().length > 0) {
    const raw = isoCandidate.trim();
    if (raw.includes('T') || raw.includes(':')) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        extractedDate = parsed;
        hasExplicitTime = true;
      }
    }
  }

  if (!extractedDate) {
    const idCandidates = [txn.id, txn.parentTransactionId].filter(Boolean) as string[];
    for (const candidate of idCandidates) {
      const match = candidate.match(/(\d{13})/);
      if (match) {
        const ms = Number(match[1]);
        if (Number.isFinite(ms) && ms >= 1577836800000 && ms <= 4102444800000) {
          extractedDate = new Date(ms);
          hasExplicitTime = true;
          break;
        }
      }
    }
  }

  // Construimos timestamp combinando la fecha contable (txn.date) con la hora real de proceso
  // para que el ordenamiento respete primero el día del movimiento y luego la hora exacta de ejecución.
  const baseDateParts = (txn.date || '').split('-').map(Number);
  const year = baseDateParts[0] || 2026;
  const month = (baseDateParts[1] || 1) - 1;
  const day = baseDateParts[2] || 1;

  if (extractedDate && hasExplicitTime) {
    const hours = extractedDate.getHours();
    const minutes = extractedDate.getMinutes();
    const seconds = extractedDate.getSeconds();
    const millis = extractedDate.getMilliseconds();
    const combinedDate = new Date(year, month, day, hours, minutes, seconds, millis);
    const timeFormatted = extractedDate.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return {
      timestampMs: combinedDate.getTime(),
      timeFormatted,
      dateTimeFormatted: `${txn.date} · ${timeFormatted}`,
      hasExplicitTime: true,
    };
  }

  const fallbackDate = new Date(year, month, day, 0, 0, 0, 0);
  return {
    timestampMs: fallbackDate.getTime(),
    timeFormatted: '--:--',
    dateTimeFormatted: txn.date,
    hasExplicitTime: false,
  };
}

/**
 * Compara dos transacciones cronológicamente (del más antiguo al más reciente) tomando en cuenta tanto la fecha (`date`)
 * como la hora exacta de proceso (`processedAt` / `createdAt` / ID timestamp).
 * Si una transacción es la comisión bancaria hija de otra, se mantiene justo después de su transacción padre.
 */
export function compararTransaccionesPorFechaYHoraProceso(
  a: Transaction,
  b: Transaction
): number {
  const dateCmp = (a.date || '').localeCompare(b.date || '');
  if (dateCmp !== 0) return dateCmp;

  if (a.parentTransactionId && a.parentTransactionId === b.id) return 1;
  if (b.parentTransactionId && b.parentTransactionId === a.id) return -1;

  const infoA = obtenerInfoHoraProcesoTransaccion(a);
  const infoB = obtenerInfoHoraProcesoTransaccion(b);
  if (infoA.timestampMs !== infoB.timestampMs) {
    return infoA.timestampMs - infoB.timestampMs;
  }

  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Compara dos transacciones del MÁS RECIENTE al MÁS VIEJO tomando en cuenta tanto la fecha (`date`)
 * como la hora exacta de proceso (`processedAt` / `createdAt` / ID timestamp).
 * Si una transacción es la comisión bancaria hija de otra, se mantiene inmediatamente debajo de su movimiento padre.
 */
export function compararTransaccionesRecientesPrimero(
  a: Transaction,
  b: Transaction
): number {
  const dateCmp = (b.date || '').localeCompare(a.date || '');
  if (dateCmp !== 0) return dateCmp;

  if (a.parentTransactionId && a.parentTransactionId === b.id) return 1;
  if (b.parentTransactionId && b.parentTransactionId === a.id) return -1;

  const infoA = obtenerInfoHoraProcesoTransaccion(a);
  const infoB = obtenerInfoHoraProcesoTransaccion(b);
  if (infoB.timestampMs !== infoA.timestampMs) {
    return infoB.timestampMs - infoA.timestampMs;
  }

  return (b.id || '').localeCompare(a.id || '');
}

/**
 * Compara dos registros genéricos con fecha/hora (transferencias entre billeteras, ahorros, fondo de citas)
 * ordenando del MÁS RECIENTE al MÁS VIEJO.
 */
export function compararRegistrosConHoraRecientesPrimero<
  T extends {
    date: string;
    processedAt?: string;
    createdAt?: string;
    id?: string;
  },
>(a: T, b: T): number {
  const dateCmp = (b.date || '').localeCompare(a.date || '');
  if (dateCmp !== 0) return dateCmp;

  const infoA = obtenerInfoHoraProcesoTransaccion(a);
  const infoB = obtenerInfoHoraProcesoTransaccion(b);
  if (infoB.timestampMs !== infoA.timestampMs) {
    return infoB.timestampMs - infoA.timestampMs;
  }

  return (b.id || '').localeCompare(a.id || '');
}

export function calcularDistribucionPorCategoria(
  transactions: Transaction[],
  categories: Category[],
  type: 'income' | 'expense' = 'expense'
): DistribucionCategoriaItem[] {
  const filtered = transactions.filter((t) => {
    if (t.isPassThroughThirdParty) return false;
    const effectiveType = t.isThirdPartyAllowance ? 'expense' : t.type;
    return effectiveType === type && esTransaccionCompletada(t);
  });
  const totalUsd = filtered.reduce(
    (acc, t) => acc + (Number.isFinite(t.amountUsd) ? t.amountUsd : 0),
    0
  );

  const map = new Map<string, { amountUsd: number; count: number }>();
  for (const t of filtered) {
    const normalizedCatId =
      type === 'expense'
        ? normalizarCategoriaGastoComision(t.categoryId, categories, t)
        : t.categoryId;
    const prev = map.get(normalizedCatId) || { amountUsd: 0, count: 0 };
    prev.amountUsd += Number.isFinite(t.amountUsd) ? t.amountUsd : 0;
    prev.count += 1;
    map.set(normalizedCatId, prev);
  }

  const items: DistribucionCategoriaItem[] = [];
  for (const [categoryId, stats] of map.entries()) {
    const cat = categories.find((c) => c.id === categoryId);
    items.push({
      categoryId,
      categoryName:
        cat
          ? cat.id === 'cat_exp_bank_fees'
            ? cat.name
            : cat.name
          : categoryId === 'cat_exp_bank_fees'
            ? 'Comisiones Bancarias'
            : 'Sin categoría',
      color: cat ? cat.color : '#C86D85',
      amountUsd: stats.amountUsd,
      percentage: totalUsd > 0 ? (stats.amountUsd / totalUsd) * 100 : 0,
      count: stats.count,
    });
  }

  return items.sort((a, b) => b.amountUsd - a.amountUsd);
}

export type BudgetAlertLevel = 'none' | 'ok' | 'warning' | 'exceeded';

export interface EstadoPresupuestoCategoriaItem {
  category: Category;
  limitUsd: number;
  spentCompletedUsd: number;
  spentPendingUsd: number;
  spentTotalProjectedUsd: number;
  remainingUsd: number;
  exceededUsd: number;
  consumptionPct: number; // Porcentaje de consumo real (spentCompletedUsd / limitUsd * 100)
  projectedConsumptionPct: number; // Porcentaje proyectado incluyendo pendientes
  alertLevel: BudgetAlertLevel;
  txCountCompleted: number;
  txCountPending: number;
}

/**
 * Evalúa el presupuesto mensual por categoría comparando el gasto real (Completado)
 * y proyectado (Pendiente) frente al límite mensual definido para cada categoría.
 * Si el mes tiene un límite en `budgets[monthKey].categoryLimits[catId]`, usa ese valor;
 * de lo contrario usa `cat.monthlyLimitUsd` si fue definido en la categoría.
 */
export function calcularEstadoPresupuestoPorCategoria(
  data: AppDataSchema,
  monthKey: string
): {
  items: EstadoPresupuestoCategoriaItem[];
  conLimite: EstadoPresupuestoCategoriaItem[];
  enAlerta: EstadoPresupuestoCategoriaItem[]; // warning (>= 80%) o exceeded (> 100%)
  excedidas: EstadoPresupuestoCategoriaItem[]; // exceeded (> 100%)
  preventivas: EstadoPresupuestoCategoriaItem[]; // warning (>= 80% y <= 100%)
  totalPresupuestadoPorCategoriasUsd: number;
  totalGastadoEnCategoriasConLimiteUsd: number;
} {
  const budgetObj = data.budgets.find((b) => b.monthKey === monthKey);
  const expCategories = data.categories.filter((c) => c.type === 'expense' && c.active);
  const thirdPartyWalletIds = new Set(
    (data.wallets || [])
      .filter((w) => w.isThirdPartyExpenseAccount && !w.isPassThroughAccount)
      .map((w) => w.id)
  );
  const passThroughWalletIds = new Set(
    (data.wallets || [])
      .filter((w) => w.isPassThroughAccount)
      .map((w) => w.id)
  );

  const statsMap = new Map<
    string,
    { completedUsd: number; pendingUsd: number; countCompleted: number; countPending: number }
  >();

  for (const txn of data.transactions) {
    if (
      Boolean(txn.isPassThroughThirdParty) ||
      Boolean(txn.walletId && passThroughWalletIds.has(txn.walletId))
    ) {
      continue;
    }
    const isThirdParty =
      Boolean(txn.isThirdPartyAllowance) ||
      Boolean(txn.walletId && thirdPartyWalletIds.has(txn.walletId));
    const effectiveType = isThirdParty ? 'expense' : txn.type;
    const completed = esTransaccionCompletada(txn);
    const effectiveDate = completed
      ? obtenerFechaEfectivaContableTransaccion(txn, data)
      : txn.date;
    if (effectiveType !== 'expense' || !effectiveDate.startsWith(monthKey)) continue;
    const val = Number.isFinite(txn.amountUsd) ? txn.amountUsd : 0;
    const normalizedCatId = normalizarCategoriaGastoComision(
      txn.categoryId,
      data.categories,
      txn
    );
    const cur = statsMap.get(normalizedCatId) || {
      completedUsd: 0,
      pendingUsd: 0,
      countCompleted: 0,
      countPending: 0,
    };
    if (esTransaccionCompletada(txn)) {
      cur.completedUsd += val;
      cur.countCompleted += 1;
    } else {
      cur.pendingUsd += val;
      cur.countPending += 1;
    }
    statsMap.set(normalizedCatId, cur);
  }

  const items: EstadoPresupuestoCategoriaItem[] = expCategories.map((cat) => {
    const monthOverride = budgetObj?.categoryLimits?.[cat.id];
    const limitUsd =
      typeof monthOverride === 'number' && Number.isFinite(monthOverride) && monthOverride > 0
        ? monthOverride
        : typeof cat.monthlyLimitUsd === 'number' &&
            Number.isFinite(cat.monthlyLimitUsd) &&
            cat.monthlyLimitUsd > 0
          ? cat.monthlyLimitUsd
          : 0;

    const st = statsMap.get(cat.id) || {
      completedUsd: 0,
      pendingUsd: 0,
      countCompleted: 0,
      countPending: 0,
    };

    const spentCompletedUsd = st.completedUsd;
    const spentPendingUsd = st.pendingUsd;
    const spentTotalProjectedUsd = spentCompletedUsd + spentPendingUsd;

    const remainingUsd = limitUsd > 0 ? Math.max(0, limitUsd - spentCompletedUsd) : 0;
    const exceededUsd = limitUsd > 0 ? Math.max(0, spentCompletedUsd - limitUsd) : 0;
    const consumptionPct = limitUsd > 0 ? (spentCompletedUsd / limitUsd) * 100 : 0;
    const projectedConsumptionPct =
      limitUsd > 0 ? (spentTotalProjectedUsd / limitUsd) * 100 : 0;

    let alertLevel: BudgetAlertLevel = 'none';
    if (limitUsd > 0) {
      if (spentCompletedUsd > limitUsd + 0.001) {
        alertLevel = 'exceeded';
      } else if (consumptionPct >= 80) {
        alertLevel = 'warning';
      } else {
        alertLevel = 'ok';
      }
    }

    return {
      category: cat,
      limitUsd,
      spentCompletedUsd,
      spentPendingUsd,
      spentTotalProjectedUsd,
      remainingUsd,
      exceededUsd,
      consumptionPct,
      projectedConsumptionPct,
      alertLevel,
      txCountCompleted: st.countCompleted,
      txCountPending: st.countPending,
    };
  });

  // Ordenar: primero las excedidas, luego en alerta, luego con límite por mayor % de consumo, luego por mayor gasto
  items.sort((a, b) => {
    const score = (lvl: BudgetAlertLevel) =>
      lvl === 'exceeded' ? 3 : lvl === 'warning' ? 2 : lvl === 'ok' ? 1 : 0;
    const diffScore = score(b.alertLevel) - score(a.alertLevel);
    if (diffScore !== 0) return diffScore;
    if (b.consumptionPct !== a.consumptionPct) return b.consumptionPct - a.consumptionPct;
    return b.spentCompletedUsd - a.spentCompletedUsd;
  });

  const conLimite = items.filter((i) => i.limitUsd > 0);
  const excedidas = conLimite.filter((i) => i.alertLevel === 'exceeded');
  const preventivas = conLimite.filter((i) => i.alertLevel === 'warning');
  const enAlerta = conLimite.filter(
    (i) => i.alertLevel === 'exceeded' || i.alertLevel === 'warning'
  );

  const totalPresupuestadoPorCategoriasUsd = conLimite.reduce(
    (acc, i) => acc + i.limitUsd,
    0
  );
  const totalGastadoEnCategoriasConLimiteUsd = conLimite.reduce(
    (acc, i) => acc + i.spentCompletedUsd,
    0
  );

  return {
    items,
    conLimite,
    enAlerta,
    excedidas,
    preventivas,
    totalPresupuestadoPorCategoriasUsd,
    totalGastadoEnCategoriasConLimiteUsd,
  };
}

export interface ResumenPrestamos {
  // Cuentas por Cobrar (Me deben -> generan Ingresos al cobrarse)
  porCobrarTotalUsd: number;
  porCobrarCobradoUsd: number;
  porCobrarPendienteUsd: number;
  porCobrarActivosCount: number;
  porCobrarPagadosCount: number;
  // Cuentas por Pagar (Debo -> generan Gastos al pagarse)
  porPagarTotalUsd: number;
  porPagarPagadoUsd: number;
  porPagarPendienteUsd: number;
  porPagarActivosCount: number;
  porPagarPagadosCount: number;
  // Balance neto de préstamos pendientes (Por Cobrar Pendiente - Por Pagar Pendiente)
  posicionNetaPrestamosUsd: number;
  vencidosCount: number;
}

/**
 * Calcula los totales de Cuentas por Cobrar y Cuentas por Pagar.
 */
export function calcularResumenPrestamos(debts: Debt[]): ResumenPrestamos {
  let porCobrarTotalUsd = 0;
  let porCobrarCobradoUsd = 0;
  let porCobrarPendienteUsd = 0;
  let porCobrarActivosCount = 0;
  let porCobrarPagadosCount = 0;

  let porPagarTotalUsd = 0;
  let porPagarPagadoUsd = 0;
  let porPagarPendienteUsd = 0;
  let porPagarActivosCount = 0;
  let porPagarPagadosCount = 0;

  let vencidosCount = 0;
  const todayIso = obtenerFechaLocalIso();

  for (const d of debts) {
    // Todos los préstamos registrados en el módulo son préstamos otorgados (por cobrar)
    const st = calcularEstadoDeuda(d);
    const isPaid = d.status === 'paid' || st.pendienteUsd <= 0.005;

    if (!isPaid && d.dueDate && d.dueDate < todayIso) {
      vencidosCount += 1;
    }

    porCobrarTotalUsd += d.totalAmountUsd;
    porCobrarCobradoUsd += isPaid ? d.totalAmountUsd : st.pagadoUsd;
    porCobrarPendienteUsd += isPaid ? 0 : st.pendienteUsd;
    if (isPaid) porCobrarPagadosCount += 1;
    else porCobrarActivosCount += 1;
  }

  return {
    porCobrarTotalUsd,
    porCobrarCobradoUsd,
    porCobrarPendienteUsd,
    porCobrarActivosCount,
    porCobrarPagadosCount,
    porPagarTotalUsd,
    porPagarPagadoUsd,
    porPagarPendienteUsd,
    porPagarActivosCount,
    porPagarPagadosCount,
    posicionNetaPrestamosUsd: porCobrarPendienteUsd,
    vencidosCount,
  };
}

export interface TasaPromedioMensualItem {
  monthKey: string; // YYYY-MM
  averageRate: number;
  minRate: number;
  maxRate: number;
  sampleCount: number;
}

export interface BilleteraSaldoVesItem {
  wallet: WalletAccount;
  saldoActualUsd: number;
  saldoNominalVes: number;
}

export interface AnalisisPoderAdquisitivoResult {
  // Sumas de Bolívares disponibles
  sumaBilleterasVesBs: number; // Suma en Bs de las billeteras cuya moneda es VES (o movimientos en Bs)
  sumaTodasBilleterasBs: number; // Suma en Bs de todas las billeteras (USD + VES)
  sumaBsEvaluada: number; // Monto en Bs usado para el cálculo principal
  origenMontoBs: 'billeteras_ves' | 'todas_billeteras' | 'personalizado';
  billeterasVesDetalle: BilleteraSaldoVesItem[];

  // Tasas comparadas
  tasaActual: number;
  tasaPromedioHace30Dias: number;
  tasaExactaHace30Dias: number | null;
  fechaExactaHace30Dias: string | null;
  mesAnteriorKey: string;
  mesActualKey: string;
  fuenteTasaMesAnterior: 'promedio_mes_anterior' | 'historial_tasas' | 'estimacion_referencial';
  tasasPromedioPorMes: TasaPromedioMensualItem[];

  // Resultados de Poder Adquisitivo:
  // "Tus [Suma de Bs] hoy equivalen a [X] USD, pero hace un mes equivalían a [Y] USD. Tu dinero ha perdido un [Z]% de su valor"
  equivalenteHoyUsd: number; // [X] USD = SumaBs / tasaActual
  equivalenteHaceUnMesUsd: number; // [Y] USD = SumaBs / tasaPromedioHace30Dias
  diferenciaUsd: number; // [Y] - [X] (positivo = pérdida de poder adquisitivo en USD)
  porcentajePerdidaValor: number; // [Z]% = ((Y - X) / Y) * 100
  porcentajeIncrementoTasa: number; // % que subió el dólar en 30 días
}

function normalizarFechaIsoCorta(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const dd = String(Number(dmyMatch[1])).padStart(2, '0');
    const mm = String(Number(dmyMatch[2])).padStart(2, '0');
    return `${dmyMatch[3]}-${mm}-${dd}`;
  }
  return null;
}

/**
 * Calcula la tasa promedio por mes para no distorsionar la realidad con picos aislados
 * y evalúa la pérdida de poder adquisitivo del saldo en Bolívares frente a hace 30 días.
 */
export function calcularAnalisisPoderAdquisitivo(
  data: AppDataSchema,
  options?: {
    customAmountBs?: number | null;
    customPrevMonthRate?: number | null;
    customCurrentRate?: number | null;
    scope?: 'ves_wallets_only' | 'all_wallets';
  }
): AnalisisPoderAdquisitivoResult {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const mesActualKey = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const prevDate = new Date(currentYear, now.getMonth() - 1, 1);
  const mesAnteriorKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  // 1. Recolectar todas las muestras de tasas de cambio agrupadas por mes (YYYY-MM)
  // y también un mapa diario (YYYY-MM-DD -> rate) para consultas de fecha exacta
  const monthRatesMap = new Map<string, number[]>();
  const dailyOfficialRatesMap = new Map<string, number>();

  const addRateSample = (dateStr: string | undefined | null, rate: number | undefined | null) => {
    if (!dateStr || typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return;
    const normalizedIso = normalizarFechaIsoCorta(dateStr);
    const mKey = normalizedIso ? normalizedIso.slice(0, 7) : dateStr.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mKey)) return;
    const list = monthRatesMap.get(mKey) || [];
    list.push(rate);
    monthRatesMap.set(mKey, list);
  };

  // Primero procesamos el historial de tasas oficiales / importadas deduplicando por día (YYYY-MM-DD)
  for (const rh of data.rateHistory || []) {
    if (rh.rate > 0) {
      const isoDay =
        normalizarFechaIsoCorta(rh.fetchedAt) ||
        normalizarFechaIsoCorta(rh.apiDate);
      if (isoDay) {
        dailyOfficialRatesMap.set(isoDay, rh.rate);
      } else if (rh.fetchedAt) {
        addRateSample(rh.fetchedAt, rh.rate);
      }
    }
  }

  for (const [isoDay, rateVal] of dailyOfficialRatesMap.entries()) {
    addRateSample(isoDay, rateVal);
  }

  // Además agregamos muestras de transacciones, ahorros y préstamos en aquellos meses que no tengan ya tasas diarias importadas
  for (const txn of data.transactions) {
    if (txn.currency === 'VES' && txn.exchangeRate && txn.exchangeRate > 0) {
      const isoDay = normalizarFechaIsoCorta(txn.date);
      if (!isoDay || !dailyOfficialRatesMap.has(isoDay)) {
        addRateSample(txn.date, txn.exchangeRate);
      }
    }
  }
  for (const sav of data.savings) {
    if (sav.originalCurrency === 'VES' && sav.exchangeRateUsed && sav.exchangeRateUsed > 0) {
      const isoDay = normalizarFechaIsoCorta(sav.date);
      if (!isoDay || !dailyOfficialRatesMap.has(isoDay)) {
        addRateSample(sav.date, sav.exchangeRateUsed);
      }
    }
  }
  for (const debt of data.debts) {
    if (debt.currency === 'VES' && debt.exchangeRate && debt.exchangeRate > 0) {
      const dStr = debt.loanDate || debt.dueDate || mesActualKey + '-01';
      const isoDay = normalizarFechaIsoCorta(dStr);
      if (!isoDay || !dailyOfficialRatesMap.has(isoDay)) {
        addRateSample(dStr, debt.exchangeRate);
      }
    }
    for (const pay of debt.payments || []) {
      if (pay.currency === 'VES' && pay.exchangeRate && pay.exchangeRate > 0) {
        const isoDay = normalizarFechaIsoCorta(pay.date);
        if (!isoDay || !dailyOfficialRatesMap.has(isoDay)) {
          addRateSample(pay.date, pay.exchangeRate);
        }
      }
    }
  }

  const tasasPromedioPorMes: TasaPromedioMensualItem[] = Array.from(
    monthRatesMap.entries()
  )
    .map(([monthKey, rates]) => {
      const sum = rates.reduce((a, b) => a + b, 0);
      const avg = sum / rates.length;
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);
      return {
        monthKey,
        averageRate: Number(avg.toFixed(4)),
        minRate: Number(minRate.toFixed(4)),
        maxRate: Number(maxRate.toFixed(4)),
        sampleCount: rates.length,
      };
    })
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  // Buscar la tasa exacta más cercana a hace 30 días en dailyOfficialRatesMap
  const target30DaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const target30Iso = `${target30DaysAgo.getFullYear()}-${String(
    target30DaysAgo.getMonth() + 1
  ).padStart(2, '0')}-${String(target30DaysAgo.getDate()).padStart(2, '0')}`;

  let tasaExactaHace30Dias: number | null = null;
  let fechaExactaHace30Dias: string | null = null;
  if (dailyOfficialRatesMap.size > 0) {
    let bestDiffDays = Infinity;
    for (const [dayIso, rVal] of dailyOfficialRatesMap.entries()) {
      const dObj = new Date(`${dayIso}T12:00:00Z`);
      const tObj = new Date(`${target30Iso}T12:00:00Z`);
      const diffDays = Math.abs(
        Math.round((dObj.getTime() - tObj.getTime()) / 86400000)
      );
      if (diffDays <= 10 && diffDays < bestDiffDays) {
        bestDiffDays = diffDays;
        tasaExactaHace30Dias = rVal;
        fechaExactaHace30Dias = dayIso;
      }
    }
  }

  // 2. Determinar la Tasa Actual hoy
  const currentMonthAvgObj = tasasPromedioPorMes.find(
    (m) => m.monthKey === mesActualKey
  );
  const tasaActual =
    (options?.customCurrentRate &&
    Number.isFinite(options.customCurrentRate) &&
    options.customCurrentRate > 0
      ? options.customCurrentRate
      : null) ||
    (data.settings.lastOfficialRate && data.settings.lastOfficialRate > 0
      ? data.settings.lastOfficialRate
      : null) ||
    (data.settings.defaultExchangeRate && data.settings.defaultExchangeRate > 0
      ? data.settings.defaultExchangeRate
      : null) ||
    (currentMonthAvgObj ? currentMonthAvgObj.averageRate : 450);

  // 3. Determinar la Tasa Promedio de hace 30 días (Mes Anterior)
  let tasaPromedioHace30Dias = tasaActual;
  let fuenteTasaMesAnterior: AnalisisPoderAdquisitivoResult['fuenteTasaMesAnterior'] =
    'estimacion_referencial';

  if (
    options?.customPrevMonthRate &&
    Number.isFinite(options.customPrevMonthRate) &&
    options.customPrevMonthRate > 0
  ) {
    tasaPromedioHace30Dias = options.customPrevMonthRate;
    fuenteTasaMesAnterior = 'promedio_mes_anterior';
  } else {
    const prevMonthObj = tasasPromedioPorMes.find(
      (m) => m.monthKey === mesAnteriorKey
    );
    if (prevMonthObj && prevMonthObj.averageRate > 0) {
      tasaPromedioHace30Dias = prevMonthObj.averageRate;
      fuenteTasaMesAnterior = 'promedio_mes_anterior';
    } else if (tasaExactaHace30Dias && tasaExactaHace30Dias > 0) {
      tasaPromedioHace30Dias = tasaExactaHace30Dias;
      fuenteTasaMesAnterior = 'historial_tasas';
    } else {
      // Buscar cualquier mes anterior disponible en el historial
      const olderMonthObj = tasasPromedioPorMes.find(
        (m) => m.monthKey < mesActualKey
      );
      if (olderMonthObj && olderMonthObj.averageRate > 0) {
        tasaPromedioHace30Dias = olderMonthObj.averageRate;
        fuenteTasaMesAnterior = 'historial_tasas';
      } else {
        // Si aún no hay registros del mes pasado, usamos una tasa promedio referencial de hace 30 días (~4% menor a la actual)
        tasaPromedioHace30Dias = Number((tasaActual * 0.96).toFixed(4));
        fuenteTasaMesAnterior = 'estimacion_referencial';
      }
    }
  }

  // 4. Calcular el saldo actual en Bolívares de las billeteras
  const resumenBilleteras = calcularResumenBilleteras(data);

  // Para cada billetera en VES, usamos su saldoActualVes real calculado en calcularResumenBilleteras
  const billeterasVesDetalle: BilleteraSaldoVesItem[] = [];
  let sumaBilleterasVesBs = 0;

  for (const item of resumenBilleteras.billeteras) {
    const w = item.wallet;
    if (!w.active) continue;
    // Excluir cuentas de gastos familiares/terceros (ej. Tarjeta de Mamá) y cuentas de paso/préstamos a amigos
    if (w.isThirdPartyExpenseAccount || w.isPassThroughAccount) continue;

    if (w.currency === 'VES') {
      const saldoBsEfectivo = Math.max(0, item.saldoActualVes);
      billeterasVesDetalle.push({
        wallet: w,
        saldoActualUsd: Math.max(0, item.saldoActualUsd),
        saldoNominalVes: saldoBsEfectivo,
      });
      sumaBilleterasVesBs += saldoBsEfectivo;
    }
  }

  const totalGlobalUsdPositivo = Math.max(
    0,
    resumenBilleteras.totalSaldoActualUsd
  );
  const sumaTodasBilleterasBs = totalGlobalUsdPositivo * tasaActual;

  // Determinar qué suma en Bs evaluar
  let sumaBsEvaluada = 0;
  let origenMontoBs: AnalisisPoderAdquisitivoResult['origenMontoBs'] =
    'billeteras_ves';

  if (
    options?.customAmountBs !== undefined &&
    options?.customAmountBs !== null &&
    Number.isFinite(options.customAmountBs) &&
    options.customAmountBs > 0
  ) {
    sumaBsEvaluada = options.customAmountBs;
    origenMontoBs = 'personalizado';
  } else if (options?.scope === 'all_wallets') {
    sumaBsEvaluada = sumaTodasBilleterasBs;
    origenMontoBs = 'todas_billeteras';
  } else if (sumaBilleterasVesBs > 0) {
    sumaBsEvaluada = sumaBilleterasVesBs;
    origenMontoBs = 'billeteras_ves';
  } else {
    // Si las billeteras exclusivas en VES están en 0 Bs, tomamos el saldo total de todas las billeteras en Bs para que el widget sea útil de inmediato
    sumaBsEvaluada = sumaTodasBilleterasBs;
    origenMontoBs = 'todas_billeteras';
  }

  // 5. Calcular equivalentes en USD hoy [X] vs hace 30 días [Y] y % de pérdida [Z]
  const equivalenteHoyUsd =
    tasaActual > 0 ? sumaBsEvaluada / tasaActual : 0;
  const equivalenteHaceUnMesUsd =
    tasaPromedioHace30Dias > 0 ? sumaBsEvaluada / tasaPromedioHace30Dias : 0;

  const diferenciaUsd = equivalenteHaceUnMesUsd - equivalenteHoyUsd;
  const porcentajePerdidaValor =
    equivalenteHaceUnMesUsd > 0
      ? ((equivalenteHaceUnMesUsd - equivalenteHoyUsd) /
          equivalenteHaceUnMesUsd) *
        100
      : 0;

  const porcentajeIncrementoTasa =
    tasaPromedioHace30Dias > 0
      ? ((tasaActual - tasaPromedioHace30Dias) / tasaPromedioHace30Dias) * 100
      : 0;

  return {
    sumaBilleterasVesBs,
    sumaTodasBilleterasBs,
    sumaBsEvaluada,
    origenMontoBs,
    billeterasVesDetalle,
    tasaActual,
    tasaPromedioHace30Dias,
    tasaExactaHace30Dias,
    fechaExactaHace30Dias,
    mesAnteriorKey,
    mesActualKey,
    fuenteTasaMesAnterior,
    tasasPromedioPorMes,
    equivalenteHoyUsd,
    equivalenteHaceUnMesUsd,
    diferenciaUsd,
    porcentajePerdidaValor,
    porcentajeIncrementoTasa,
  };
}

// ============================================================================
// MÓDULO 1: BÓVEDA DE GARANTÍAS Y MANTENIMIENTO (ASSET TRACKER)
// ============================================================================

/**
 * Suma un número exacto de meses a una fecha YYYY-MM-DD respetando finales de mes.
 */
export function sumarMesesExactos(fechaIso: string, meses: number): string {
  const parts = fechaIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return obtenerFechaLocalIso();
  }
  const [year, month, day] = parts;
  const targetMonthIndex = month - 1 + Math.max(0, Math.round(meses));
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Último día del mes destino para evitar desbordes (ej. 31 de enero + 1 mes -> 28/29 feb)
  const maxDayInTargetMonth = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0)
  ).getUTCDate();
  const safeDay = Math.min(day, maxDayInTargetMonth);

  const yyyy = String(targetYear).padStart(4, '0');
  const mm = String(normalizedMonth + 1).padStart(2, '0');
  const dd = String(safeDay).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calcula la diferencia en días enteros entre dos fechas YYYY-MM-DD (target - base).
 */
export function calcularDiasEntreFechas(
  baseIso: string,
  targetIso: string
): number {
  const [y1, m1, d1] = baseIso.split('-').map(Number);
  const [y2, m2, d2] = targetIso.split('-').map(Number);
  const utcBase = Date.UTC(y1, (m1 || 1) - 1, d1 || 1);
  const utcTarget = Date.UTC(y2, (m2 || 1) - 1, d2 || 1);
  return Math.round((utcTarget - utcBase) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula la fecha exacta de expiración de la garantía, la próxima fecha de mantenimiento
 * y el nivel de alerta ('ok', 'warning' ámbar, 'urgent' rojo) si falta menos de 1 mes (<= 30 días).
 */
export function calcularEstadoAsset(
  asset: Asset,
  referenceDateIso?: string
): AssetStatusEvaluation {
  const todayIso = referenceDateIso || obtenerFechaLocalIso();

  // 1. Expiración exacta de garantía
  const warrantyExpirationDate = sumarMesesExactos(
    asset.fechaCompra,
    Math.max(0, asset.mesesGarantia)
  );
  const daysUntilWarrantyExpires = calcularDiasEntreFechas(
    todayIso,
    warrantyExpirationDate
  );
  const isWarrantyExpired =
    asset.mesesGarantia > 0 && daysUntilWarrantyExpires < 0;
  const isWarrantyExpiringSoon =
    asset.mesesGarantia > 0 &&
    daysUntilWarrantyExpires >= 0 &&
    daysUntilWarrantyExpires <= 30;

  // 2. Próxima fecha de mantenimiento (a partir del último mantenimiento o de la fecha de compra)
  const sortedHistory = [...(asset.historialMantenimiento || [])].sort((a, b) =>
    b.fecha.localeCompare(a.fecha)
  );
  const lastMaintenanceDate =
    sortedHistory.length > 0 ? sortedHistory[0].fecha : null;

  let nextMaintenanceDate: string | null = null;
  let daysUntilNextMaintenance: number | null = null;
  let isMaintenanceDueSoon = false;
  let isMaintenanceOverdue = false;

  if (asset.frecuenciaMantenimientoMeses > 0) {
    const baseDate = lastMaintenanceDate || asset.fechaCompra;
    nextMaintenanceDate = sumarMesesExactos(
      baseDate,
      asset.frecuenciaMantenimientoMeses
    );
    daysUntilNextMaintenance = calcularDiasEntreFechas(
      todayIso,
      nextMaintenanceDate
    );
    isMaintenanceOverdue = daysUntilNextMaintenance < 0;
    isMaintenanceDueSoon =
      daysUntilNextMaintenance >= 0 && daysUntilNextMaintenance <= 30;
  }

  // 3. Nivel de alerta visual para resaltar la tarjeta en ámbar o rojo cuando falta <= 30 días (menos de 1 mes) o está vencido
  let alertLevel: AssetAlertLevel = 'ok';
  if (
    isMaintenanceOverdue ||
    (daysUntilNextMaintenance !== null &&
      daysUntilNextMaintenance >= 0 &&
      daysUntilNextMaintenance <= 7) ||
    (asset.mesesGarantia > 0 &&
      daysUntilWarrantyExpires >= 0 &&
      daysUntilWarrantyExpires <= 7)
  ) {
    alertLevel = 'urgent';
  } else if (isWarrantyExpiringSoon || isMaintenanceDueSoon) {
    alertLevel = 'warning';
  }

  const totalMaintenanceSpentUsd = (asset.historialMantenimiento || []).reduce(
    (sum, item) => sum + (Number.isFinite(item.costoUsd) ? item.costoUsd : 0),
    0
  );

  return {
    asset,
    warrantyExpirationDate,
    daysUntilWarrantyExpires,
    isWarrantyExpired,
    isWarrantyExpiringSoon,
    lastMaintenanceDate,
    nextMaintenanceDate,
    daysUntilNextMaintenance,
    isMaintenanceDueSoon,
    isMaintenanceOverdue,
    alertLevel,
    totalMaintenanceSpentUsd: Number(totalMaintenanceSpentUsd.toFixed(2)),
  };
}

// ============================================================================
// MÓDULO 2: LÓGICA DE 'RULETA DE CITAS' (ROMANCE BUDGET)
// ============================================================================

export const ROMANCE_PLANS_BY_BRACKET: Record<
  RomanceRouletteBracket,
  {
    planTitle: string;
    planCategory: string;
    description: string;
    estimatedCostRange: string;
  }[]
> = {
  low: [
    {
      planTitle: 'Helados artesanales y caminata al atardecer',
      planCategory: 'Helados/Caminar',
      description:
        'Un paseo tranquilo conversando sin pantallas mientras disfrutan su sabor de helado favorito.',
      estimatedCostRange: '$3 – $9 USD',
    },
    {
      planTitle: 'Café de especialidad y postre compartido en el parque',
      planCategory: 'Helados/Caminar',
      description:
        'Dos cafés calientes o frapuccinos con una porción dulce para compartir al aire libre.',
      estimatedCostRange: '$5 – $9.50 USD',
    },
    {
      planTitle: 'Noche de cine en casa con cotufas y chucherías',
      planCategory: 'Helados/Caminar',
      description:
        'Maratón de su película o serie pendiente con snacks dulces, bebidas y ambiente acogedor.',
      estimatedCostRange: '$4 – $9 USD',
    },
    {
      planTitle: 'Picnic de atardecer con bocadillos caseros',
      planCategory: 'Helados/Caminar',
      description:
        'Manta, música suave, limonada o té frío y sándwiches preparados juntos.',
      estimatedCostRange: '$5 – $9.50 USD',
    },
    {
      planTitle: 'Paseo por mirador con churros y chocolate caliente',
      planCategory: 'Helados/Caminar',
      description:
        'Vista bonita de la ciudad acompañada de churros recién hechos o barquillas.',
      estimatedCostRange: '$4 – $9 USD',
    },
  ],
  mid: [
    {
      planTitle: 'Ida al cine + Combo de hamburguesas smash',
      planCategory: 'Cine/Hamburguesas',
      description:
        'Estreno en pantalla grande con cotufas o cena casual de hamburguesas con papas.',
      estimatedCostRange: '$12 – $28 USD',
    },
    {
      planTitle: 'Pizzas a la leña y merengadas para compartir',
      planCategory: 'Cine/Hamburguesas',
      description:
        'Una pizza artesanal recién horneada con bebidas y postre en una terraza casual.',
      estimatedCostRange: '$14 – $26 USD',
    },
    {
      planTitle: 'Brunch romántico de fin de semana',
      planCategory: 'Cine/Hamburguesas',
      description:
        'Waffles, panquecas o huevos benedictinos con jugo natural y café recién molido.',
      estimatedCostRange: '$15 – $29 USD',
    },
    {
      planTitle: 'Tarde de Sushi Rolls o Tacos + Paseo nocturno',
      planCategory: 'Cine/Hamburguesas',
      description:
        'Combo de rolls o tacos mexicanos para compartir y caminata relajada.',
      estimatedCostRange: '$15 – $30 USD',
    },
    {
      planTitle: 'Tarde de juegos (Boliche / Arcade) y snacks',
      planCategory: 'Cine/Hamburguesas',
      description:
        'Competencia divertida en pareja acompañada de nachos, perros calientes o alitas.',
      estimatedCostRange: '$14 – $28 USD',
    },
  ],
  high: [
    {
      planTitle: 'Cena romántica especial a la luz de las velas',
      planCategory: 'Cena/Especial',
      description:
        'Velada en un restaurante especial con plato fuerte, copas de vino o cócteles de autor y postre.',
      estimatedCostRange: '$35 – $70+ USD',
    },
    {
      planTitle: 'Experiencia gastronómica de carnes o mariscos',
      planCategory: 'Cena/Especial',
      description:
        'Cena de celebración con entradas para compartir, cortes premium o paella y brindis.',
      estimatedCostRange: '$40 – $80+ USD',
    },
    {
      planTitle: 'Escapada Full Day de playa o montaña en pareja',
      planCategory: 'Cena/Especial',
      description:
        'Día completo fuera de la rutina con almuerzo frente al mar o clima frío de montaña.',
      estimatedCostRange: '$35 – $75+ USD',
    },
    {
      planTitle: 'Noche de teatro, concierto en vivo y cena especial',
      planCategory: 'Cena/Especial',
      description:
        'Entradas a un show cultural, stand-up o música en vivo seguido de una cena íntima.',
      estimatedCostRange: '$35 – $85+ USD',
    },
    {
      planTitle: 'Menú degustación y coctelería de autor',
      planCategory: 'Cena/Especial',
      description:
        'Tres tiempos gastronómicos pensados para celebrar su cita mensual por todo lo alto.',
      estimatedCostRange: '$32 – $65+ USD',
    },
  ],
};

/**
 * Evalúa el monto disponible en el Fondo de Citas y sugiere un plan aleatorio basado en tramos:
 * - < $10: 'Helados/Caminar'
 * - $10 - $30: 'Cine/Hamburguesas'
 * - > $30: 'Cena/Especial'
 */
export function evaluarRuletaDeCitas(
  availableBalanceUsd: number,
  excludePlanTitle?: string
): RomanceRouletteSuggestion {
  const safeBalance =
    Number.isFinite(availableBalanceUsd) && availableBalanceUsd > 0
      ? availableBalanceUsd
      : 0;

  let bracket: RomanceRouletteBracket = 'low';
  let bracketLabel = 'Tramo < $10 USD · Helados / Caminar';

  if (safeBalance > 30) {
    bracket = 'high';
    bracketLabel = 'Tramo > $30 USD · Cena / Especial';
  } else if (safeBalance >= 10) {
    bracket = 'mid';
    bracketLabel = 'Tramo $10 – $30 USD · Cine / Hamburguesas';
  }

  const options = ROMANCE_PLANS_BY_BRACKET[bracket];
  const filtered =
    excludePlanTitle && options.length > 1
      ? options.filter((o) => o.planTitle !== excludePlanTitle)
      : options;

  const chosen =
    filtered[Math.floor(Math.random() * filtered.length)] || options[0];

  return {
    bracket,
    bracketLabel,
    planTitle: chosen.planTitle,
    planCategory: chosen.planCategory,
    description: chosen.description,
    estimatedCostRange: chosen.estimatedCostRange,
    availableBalanceUsd: Number(safeBalance.toFixed(2)),
  };
}
