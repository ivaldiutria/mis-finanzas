/**
 * ============================================================================
 * CONTROLADOR DE NEGOCIO: MÓDULO DE COMPRAS A CUOTAS (TIPO CASHEA / BNPL)
 * ============================================================================
 *
 * Lógica central de saldos y transacciones:
 * 1. PAGO INICIAL (Initial Payment):
 *    Se registra como un egreso inmediato con `status: 'completed'` en la wallet
 *    seleccionada, restando directamente del SALDO REAL disponible (salvo si se
 *    marcó como `initialAlreadyPaidExternally`).
 *
 * 2. CUOTAS PENDIENTES (Pending Installments):
 *    Son pasivos programados que se registran como transacciones con
 *    `status: 'pending'` en sus respectivas fechas de vencimiento.
 *    Por diseño del motor contable (`calculations.ts`), los egresos `'pending'`
 *    NO restan del Saldo Real, sino exclusivamente del SALDO PROYECTADO.
 *
 * 3. PAGO COMPLETO O ABONO PARCIAL DE UNA CUOTA:
 *    Permite tanto pagar la cuota completa como hacer abonos parciales (`isPartialPayment`).
 *    Además, cada abono o pago completo puede marcarse como "Ya se pagó antes"
 *    (`alreadyPaidExternally: true`) para que reduzca la deuda de la cuota y del
 *    Saldo Proyectado sin descontar dinero de las billeteras actuales.
 */

import {
  AppDataSchema,
  CreditInstallment,
  CreditInstallmentPartialPayment,
  CreditPurchase,
  CurrencyCode,
  ExchangeRateSource,
  InstallmentFrequency,
  Transaction,
} from '../types/finance';
import {
  obtenerFechaLocalIso,
  obtenerIdCategoriaComisionBancaria,
} from './calculations';

export interface GeneratedInstallmentPreview {
  number: number;
  amountUsd: number;
  dueDate: string; // YYYY-MM-DD
  alreadyPaidExternally?: boolean; // Si true, la cuota ya fue pagada antes y no afecta el balance general
}

export interface CreateCreditPurchaseInput {
  concept: string;
  storeOrPlatform: string;
  categoryId: string;
  purchaseDate: string; // YYYY-MM-DD
  totalAmountUsd: number;
  initialPaymentUsd: number;
  initialAlreadyPaidExternally?: boolean; // Si true, la inicial ya se pagó antes y no resta del Saldo Real actual
  initialPaymentWalletId: string;
  initialPaymentCurrency: CurrencyCode;
  initialPaymentExchangeRate: number | null; // Requerido si initialPaymentCurrency === 'VES'
  initialPaymentExchangeRateSource: ExchangeRateSource;
  initialPaymentNominalOverride?: number; // Monto nominal exacto cuando se ingresa directamente en Bs
  initialInterbankFeeType?: 'none' | 'pago_movil' | 'transferencia';
  initialInterbankFeeAmount?: number;
  frequency: InstallmentFrequency; // 'biweekly' | 'monthly'
  installmentsCount: number;
  customSchedule?: GeneratedInstallmentPreview[];
  notes?: string;
}

export interface PayInstallmentInput {
  paidDate: string; // YYYY-MM-DD
  isPartialPayment?: boolean; // Si true, registra un abono parcial a la cuota en vez del pago total
  abonoAmountUsd?: number; // Monto en USD a abonar cuando isPartialPayment === true
  alreadyPaidExternally?: boolean; // Si true, marca la cuota o el abono como pagado antes sin descontar de billeteras ni afectar el balance general
  walletId: string;
  currency: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Tasa Bs/USD si currency === 'VES'
  exchangeRateSource: ExchangeRateSource;
  interbankFeeType?: 'none' | 'pago_movil' | 'transferencia';
  interbankFeeAmount?: number;
  notes?: string;
}

export interface UpcomingInstallmentItem {
  purchaseId: string;
  concept: string;
  storeOrPlatform: string;
  categoryId: string;
  installment: CreditInstallment;
  remainingUsd: number;
  paidUsd: number;
  totalInstallments: number;
  daysUntilDue: number; // Negativo si está vencida, 0 si vence hoy, positivo si vence en el futuro
  urgency: 'overdue' | 'today' | 'soon' | 'upcoming';
}

export interface InstallmentsDashboardSummary {
  activePurchasesCount: number;
  completedPurchasesCount: number;
  totalFinancedPendingUsd: number; // Pasivo total restante en cuotas pendientes (resta al Saldo Proyectado)
  totalInitialAndPaidUsd: number; // Total ya desembolsado o cubierto (incluyendo abonos parciales)
  pendingInstallmentsCount: number;
  paidInstallmentsCount: number;
  upcomingInstallments: UpcomingInstallmentItem[]; // Ordenadas por fecha de vencimiento más próxima
  nextDueInstallment: UpcomingInstallmentItem | null;
}

function redondearDosDecimales(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Devuelve el estado de abonos parciales y saldo restante de una cuota de Compra por Cuotas.
 */
export function obtenerEstadoAbonosCuotaCompra(installment: CreditInstallment): {
  paidUsd: number;
  remainingUsd: number;
  partialPayments: CreditInstallmentPartialPayment[];
  hasPartialPayments: boolean;
} {
  if (installment.status === 'paid') {
    return {
      paidUsd: installment.amountUsd,
      remainingUsd: 0,
      partialPayments: installment.partialPayments ?? [],
      hasPartialPayments: (installment.partialPayments?.length ?? 0) > 0,
    };
  }

  const partialPayments = installment.partialPayments ?? [];
  const rawPaidUsd =
    typeof installment.paidProgressAmountUsd === 'number' &&
    installment.paidProgressAmountUsd > 0
      ? installment.paidProgressAmountUsd
      : partialPayments.reduce((acc, p) => acc + (Number(p.amountUsd) || 0), 0);

  const paidUsd = redondearDosDecimales(
    Math.min(installment.amountUsd, Math.max(0, rawPaidUsd))
  );
  const remainingUsd = redondearDosDecimales(
    Math.max(0, installment.amountUsd - paidUsd)
  );

  return {
    paidUsd,
    remainingUsd,
    partialPayments,
    hasPartialPayments: partialPayments.length > 0 || paidUsd > 0,
  };
}

/**
 * Suma días o meses a una fecha YYYY-MM-DD de forma segura en zona local.
 */
function addIntervalToDate(
  baseDateStr: string,
  frequency: InstallmentFrequency,
  stepIndex: number // 1 para primera cuota, 2 para segunda, etc.
): string {
  const parts = baseDateStr.split('-').map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;

  const date = new Date(year, month, day, 12, 0, 0);

  if (frequency === 'biweekly') {
    // Frecuencia quincenal: cada 14 días exactos por cuota
    date.setDate(date.getDate() + stepIndex * 14);
  } else {
    // Frecuencia mensual: +1 mes por cada cuota
    date.setMonth(date.getMonth() + stepIndex);
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * BLOQUE 1: Autogenerador de cronograma de cuotas (Quincenal / Mensual)
 * Divide el monto financiado (Total - Inicial) entre el número de cuotas,
 * ajustando centavos en la última cuota para que la suma sea 100% exacta.
 */
export function generarCronogramaCuotas(
  totalAmountUsd: number,
  initialPaymentUsd: number,
  purchaseDate: string,
  frequency: InstallmentFrequency,
  installmentsCount: number
): GeneratedInstallmentPreview[] {
  const safeTotal = Math.max(0, Number(totalAmountUsd) || 0);
  const safeInitial = Math.min(safeTotal, Math.max(0, Number(initialPaymentUsd) || 0));
  const financedUsd = redondearDosDecimales(safeTotal - safeInitial);
  const count = Math.max(1, Math.min(48, Math.floor(installmentsCount) || 1));

  if (financedUsd <= 0) {
    return [];
  }

  // Monto base por cuota redondeado al centavo más cercano
  const baseInstallmentUsd = redondearDosDecimales(financedUsd / count);
  const schedule: GeneratedInstallmentPreview[] = [];
  let accumulated = 0;

  for (let i = 1; i <= count; i++) {
    const isLast = i === count;
    const amountUsd = isLast
      ? redondearDosDecimales(financedUsd - accumulated)
      : baseInstallmentUsd;

    accumulated = redondearDosDecimales(accumulated + amountUsd);

    schedule.push({
      number: i,
      amountUsd,
      dueDate: addIntervalToDate(purchaseDate, frequency, i),
    });
  }

  return schedule;
}

/**
 * BLOQUE 2: Creación de Compra por Cuota + Movimientos Contables Vinculados
 * - Genera 1 transacción `completed` por el Pago Inicial (salvo si `initialAlreadyPaidExternally === true`).
 * - Genera N transacciones `pending` por cada cuota pendiente (las cuotas marcadas como `alreadyPaidExternally` nacen pagadas sin afectar el balance general).
 */
export function crearCompraACuotas(input: CreateCreditPurchaseInput): {
  purchase: CreditPurchase;
  transactionsToCreate: Transaction[];
} {
  const nowIso = new Date().toISOString();
  const purchaseId = `cuota-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const totalAmountUsd = redondearDosDecimales(input.totalAmountUsd);
  const initialPaymentUsd = redondearDosDecimales(input.initialPaymentUsd);
  const financedAmountUsd = redondearDosDecimales(
    Math.max(0, totalAmountUsd - initialPaymentUsd)
  );
  const isInitialAlreadyPaid = Boolean(input.initialAlreadyPaidExternally);

  const transactionsToCreate: Transaction[] = [];

  // 1. Transacción del Pago Inicial -> Egreso inmediato ('completed') salvo que ya haya sido pagado antes
  const initialTxnId = isInitialAlreadyPaid ? '' : `txn-init-${purchaseId}`;
  const isInitialVes =
    !isInitialAlreadyPaid &&
    input.initialPaymentCurrency === 'VES' &&
    input.initialPaymentExchangeRate &&
    input.initialPaymentExchangeRate > 0;

  const initialNominalAmount = isInitialVes
    ? typeof input.initialPaymentNominalOverride === 'number' &&
      Number.isFinite(input.initialPaymentNominalOverride) &&
      input.initialPaymentNominalOverride > 0
      ? redondearDosDecimales(input.initialPaymentNominalOverride)
      : redondearDosDecimales(
          initialPaymentUsd * (input.initialPaymentExchangeRate as number)
        )
    : initialPaymentUsd;

  if (!isInitialAlreadyPaid && initialPaymentUsd > 0) {
    const hasInitialFee =
      input.initialInterbankFeeType &&
      input.initialInterbankFeeType !== 'none' &&
      typeof input.initialInterbankFeeAmount === 'number' &&
      input.initialInterbankFeeAmount > 0;
    const feeTxnId = hasInitialFee ? `txn-fee-init-${purchaseId}` : undefined;
    const methodLabel =
      input.initialInterbankFeeType === 'pago_movil'
        ? `${input.storeOrPlatform} · Pago Móvil`
        : input.initialInterbankFeeType === 'transferencia'
          ? `${input.storeOrPlatform} · Transferencia`
          : input.storeOrPlatform;

    const initialTransaction: Transaction = {
      id: initialTxnId,
      date: input.purchaseDate,
      type: 'expense',
      status: 'completed', // IMPACTA SALDO REAL
      walletId: input.initialPaymentWalletId,
      description: `[Inicial ${input.storeOrPlatform}] ${input.concept}`,
      categoryId: input.categoryId,
      amount: initialNominalAmount,
      currency: isInitialVes ? 'VES' : 'USD',
      exchangeRate: isInitialVes ? input.initialPaymentExchangeRate : null,
      amountUsd: initialPaymentUsd,
      exchangeRateSource: isInitialVes ? input.initialPaymentExchangeRateSource : 'none',
      paymentMethod: methodLabel,
      expenseType: 'variable',
      isRecurring: false,
      isInterbankTransfer: Boolean(hasInitialFee),
      interbankFeeType: hasInitialFee && input.initialInterbankFeeType !== 'none' ? input.initialInterbankFeeType : undefined,
      interbankFeeAmount: hasInitialFee ? redondearDosDecimales(input.initialInterbankFeeAmount!) : undefined,
      interbankFeeTxnId: feeTxnId,
      notes: `Pago inicial de compra por cuota (${input.storeOrPlatform}). Total compra: $${totalAmountUsd.toFixed(2)} USD.${input.notes ? ` · ${input.notes}` : ''}`,
      createdAt: nowIso,
      processedAt: nowIso,
    };
    transactionsToCreate.push(initialTransaction);

    if (hasInitialFee && feeTxnId) {
      const feeNominal = redondearDosDecimales(input.initialInterbankFeeAmount!);
      const feeUsd =
        isInitialVes && input.initialPaymentExchangeRate && input.initialPaymentExchangeRate > 0
          ? redondearDosDecimales(feeNominal / input.initialPaymentExchangeRate)
          : feeNominal;
      const feeTxn: Transaction = {
        id: feeTxnId,
        date: input.purchaseDate,
        type: 'expense',
        status: 'completed',
        walletId: input.initialPaymentWalletId,
        description: `Comisión bancaria (${input.initialInterbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - Inicial ${input.concept}`,
        categoryId: 'cat_exp_bank_fees',
        amount: feeNominal,
        currency: isInitialVes ? 'VES' : 'USD',
        exchangeRate: isInitialVes ? input.initialPaymentExchangeRate : null,
        amountUsd: feeUsd,
        exchangeRateSource: isInitialVes ? input.initialPaymentExchangeRateSource : 'none',
        paymentMethod: input.initialInterbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia',
        expenseType: 'variable',
        isRecurring: false,
        parentTransactionId: initialTxnId,
        notes: `Comisión bancaria por pago inicial de "${input.concept}" (${input.storeOrPlatform}).`,
        createdAt: nowIso,
        processedAt: nowIso,
      };
      transactionsToCreate.push(feeTxn);
    }
  }

  // 2. Generar cuotas y sus transacciones pasivas ('pending') -> IMPACTAN SOLO SALDO PROYECTADO (salvo las ya pagadas antes)
  const rawSchedule =
    input.customSchedule && input.customSchedule.length > 0
      ? input.customSchedule
      : generarCronogramaCuotas(
          totalAmountUsd,
          initialPaymentUsd,
          input.purchaseDate,
          input.frequency,
          input.installmentsCount
        );

  const installments: CreditInstallment[] = rawSchedule.map((item, idx) => {
    const installmentId = `inst-${purchaseId}-${idx + 1}`;
    const isInstAlreadyPaid = Boolean(item.alreadyPaidExternally);

    if (isInstAlreadyPaid) {
      // Cuota pagada previamente: NO crea transacción para no afectar el balance general ni poner cuentas en negativo
      return {
        id: installmentId,
        number: item.number,
        amountUsd: item.amountUsd,
        dueDate: item.dueDate,
        status: 'paid',
        alreadyPaidExternally: true,
        linkedTransactionId: '',
        paidAt: item.dueDate,
        paidWalletId: null,
        paidCurrency: 'USD',
        paidAmountNominal: item.amountUsd,
        paidExchangeRate: null,
        partialPayments: [],
        paidProgressAmountUsd: item.amountUsd,
        notes: 'Pagada previamente (Sin descuento en balance actual)',
      };
    }

    const linkedTxnId = `txn-inst-${purchaseId}-${idx + 1}`;

    // Transacción en estado 'pending' para que reste únicamente al Saldo Proyectado
    const pendingInstallmentTxn: Transaction = {
      id: linkedTxnId,
      date: item.dueDate,
      type: 'expense',
      status: 'pending', // PASIVO: Resta solo al Saldo Proyectado hasta que se marque como Pagada
      walletId: input.initialPaymentWalletId || 'wallet_zelle',
      description: `[Cuota ${item.number}/${rawSchedule.length} · ${input.storeOrPlatform}] ${input.concept}`,
      categoryId: input.categoryId,
      amount: item.amountUsd,
      currency: 'USD',
      exchangeRate: null,
      amountUsd: item.amountUsd,
      exchangeRateSource: 'none',
      paymentMethod: input.storeOrPlatform,
      expenseType: 'fixed',
      isRecurring: false,
      notes: `Cuota ${item.number} de ${rawSchedule.length} (${input.storeOrPlatform}) con vencimiento el ${item.dueDate}.`,
      createdAt: nowIso,
    };

    transactionsToCreate.push(pendingInstallmentTxn);

    return {
      id: installmentId,
      number: item.number,
      amountUsd: item.amountUsd,
      dueDate: item.dueDate,
      status: 'pending',
      alreadyPaidExternally: false,
      linkedTransactionId: linkedTxnId,
      paidAt: null,
      paidWalletId: null,
      paidCurrency: null,
      paidAmountNominal: null,
      paidExchangeRate: null,
      partialPayments: [],
      paidProgressAmountUsd: 0,
    };
  });

  const allCompleted =
    installments.length === 0 ||
    installments.every((inst) => inst.status === 'paid');

  const purchase: CreditPurchase = {
    id: purchaseId,
    concept: input.concept.trim(),
    storeOrPlatform: input.storeOrPlatform.trim() || 'Compra por Cuota',
    categoryId: input.categoryId,
    purchaseDate: input.purchaseDate,
    baseCurrency: 'USD',
    totalAmountUsd,
    initialPaymentUsd,
    initialAlreadyPaidExternally: isInitialAlreadyPaid,
    initialPaymentWalletId: isInitialAlreadyPaid ? '' : input.initialPaymentWalletId,
    initialPaymentCurrency: isInitialVes ? 'VES' : 'USD',
    initialPaymentAmountNominal: initialNominalAmount,
    initialPaymentExchangeRate: isInitialVes ? input.initialPaymentExchangeRate : null,
    initialTransactionId: initialTxnId,
    financedAmountUsd,
    frequency: input.frequency,
    installmentsCount: installments.length,
    installments,
    status: allCompleted ? 'completed' : 'active',
    notes: input.notes?.trim() || '',
    createdAt: nowIso,
  };

  return { purchase, transactionsToCreate };
}

/**
 * BLOQUE 3: Registrar Pago Total o Abono Parcial de una Cuota
 * - Soporta tanto pagos completos como abonos parciales (`payment.isPartialPayment`).
 * - Tanto el pago completo como cada abono parcial soportan `payment.alreadyPaidExternally`
 *   ("Ya se pagó antes"), descontando de la deuda de la cuota y del Saldo Proyectado sin tocar
 *   el Saldo Real de las billeteras.
 */
export function registrarPagoCuotaEnAppData(
  prevData: AppDataSchema,
  purchaseId: string,
  installmentId: string,
  payment: PayInstallmentInput
): AppDataSchema {
  const purchases = prevData.creditPurchases || [];
  const targetPurchase = purchases.find((p) => p.id === purchaseId);
  if (!targetPurchase) return prevData;

  const targetInst = targetPurchase.installments.find((i) => i.id === installmentId);
  if (!targetInst || targetInst.status === 'paid') return prevData;

  const {
    paidUsd: prevPaidUsd,
    remainingUsd,
    partialPayments: existingPartials,
  } = obtenerEstadoAbonosCuotaCompra(targetInst);

  const isAlreadyPaidExternally = Boolean(payment.alreadyPaidExternally);

  // Determinar el saldo total pendiente de toda la compra (para permitir pagar 2+ cuotas, todas las cuotas o un monto libre en 1 solo movimiento)
  const totalPurchaseRemainingUsd = redondearDosDecimales(
    targetPurchase.installments.reduce((acc, inst) => {
      if (inst.status === 'paid') return acc;
      const st = obtenerEstadoAbonosCuotaCompra(inst);
      return acc + st.remainingUsd;
    }, 0)
  );

  // Determinar cuánto se está abonando/pagando en USD en esta operación
  let abonoUsd = remainingUsd;
  if (
    typeof payment.abonoAmountUsd === 'number' &&
    Number.isFinite(payment.abonoAmountUsd) &&
    payment.abonoAmountUsd > 0
  ) {
    abonoUsd = redondearDosDecimales(payment.abonoAmountUsd);
  }

  if (abonoUsd <= 0) return prevData;
  if (abonoUsd > totalPurchaseRemainingUsd + 0.01) {
    abonoUsd = totalPurchaseRemainingUsd;
  }

  // =========================================================================
  // CASO ESPECIAL CASHEA / MULTI-CUOTA: EL MONTO SUPERA EL SALDO DE ESTA CUOTA
  // (Ej: Pagar 2 cuotas, Pagar todas las cuotas de una vez, o Pagar otro monto
  //  mayor a 1 cuota generando UN SOLO MOVIMIENTO BANCARIO)
  // =========================================================================
  if (abonoUsd > remainingUsd + 0.009) {
    const orderedPendingInstallments = [
      targetInst,
      ...targetPurchase.installments
        .filter((i) => i.status !== 'paid' && i.id !== targetInst.id)
        .sort((a, b) => a.number - b.number),
    ];

    interface InstallmentAllocation {
      inst: CreditInstallment;
      allocatedUsd: number;
      completesInst: boolean;
      prevPaidUsd: number;
      newPaidUsd: number;
      newRemainingUsd: number;
      existingPartials: CreditInstallmentPartialPayment[];
    }

    const allocations: InstallmentAllocation[] = [];
    let poolUsd = abonoUsd;

    for (const inst of orderedPendingInstallments) {
      if (poolUsd <= 0.001) break;
      const st = obtenerEstadoAbonosCuotaCompra(inst);
      if (st.remainingUsd <= 0.001) continue;

      const sliceUsd = redondearDosDecimales(Math.min(st.remainingUsd, poolUsd));
      if (sliceUsd <= 0) continue;

      const completesInst = sliceUsd >= st.remainingUsd - 0.009;
      const effectiveSliceUsd = completesInst ? st.remainingUsd : sliceUsd;
      const newInstPaidUsd = completesInst
        ? inst.amountUsd
        : redondearDosDecimales(st.paidUsd + effectiveSliceUsd);
      const newInstRemainingUsd = completesInst
        ? 0
        : redondearDosDecimales(Math.max(0, inst.amountUsd - newInstPaidUsd));

      allocations.push({
        inst,
        allocatedUsd: effectiveSliceUsd,
        completesInst,
        prevPaidUsd: st.paidUsd,
        newPaidUsd: newInstPaidUsd,
        newRemainingUsd: newInstRemainingUsd,
        existingPartials: st.partialPayments,
      });

      poolUsd = redondearDosDecimales(Math.max(0, poolUsd - effectiveSliceUsd));
    }

    if (allocations.length === 0) return prevData;

    const totalEffectiveUsd = redondearDosDecimales(
      allocations.reduce((acc, a) => acc + a.allocatedUsd, 0)
    );

    const isVesBatch =
      !isAlreadyPaidExternally &&
      payment.currency === 'VES' &&
      payment.exchangeRate !== null &&
      payment.exchangeRate > 0;

    const totalNominalPaid = isVesBatch
      ? redondearDosDecimales(totalEffectiveUsd * (payment.exchangeRate as number))
      : totalEffectiveUsd;

    const batchTimestamp = Date.now();
    const singleBatchTxnId = isAlreadyPaidExternally
      ? null
      : `txn-batch-${purchaseId}-${batchTimestamp}`;

    const allocationMap = new Map<string, InstallmentAllocation>();
    allocations.forEach((a) => allocationMap.set(a.inst.id, a));

    const coveredLabels = allocations.map((a) =>
      a.completesInst ? `#${a.inst.number}` : `#${a.inst.number} (abono)`
    );

    const updatedInstallments: CreditInstallment[] = targetPurchase.installments.map(
      (inst) => {
        const alloc = allocationMap.get(inst.id);
        if (!alloc) return inst;

        const sliceNominal = isVesBatch
          ? redondearDosDecimales(
              alloc.allocatedUsd * (payment.exchangeRate as number)
            )
          : alloc.allocatedUsd;

        const newPartialEntry: CreditInstallmentPartialPayment = {
          id: `abono-${inst.id}-${batchTimestamp}-${inst.number}`,
          date: payment.paidDate,
          amountUsd: alloc.allocatedUsd,
          paymentCurrency: isVesBatch ? 'VES' : 'USD',
          paymentAmountNominal: sliceNominal,
          exchangeRate: isVesBatch ? payment.exchangeRate : null,
          alreadyPaidExternally: isAlreadyPaidExternally,
          walletId: isAlreadyPaidExternally ? null : payment.walletId,
          linkedTransactionId: singleBatchTxnId,
          notes:
            payment.notes ||
            (alloc.completesInst
              ? `Pagado en pago múltiple (${coveredLabels.join(', ')})`
              : `Abono parcial en pago múltiple (${coveredLabels.join(', ')})`),
        };

        const nextPartials = [...alloc.existingPartials, newPartialEntry];
        const canonicalPendingId = `txn-inst-${purchaseId}-${inst.number}`;

        if (alloc.completesInst) {
          return {
            ...inst,
            status: 'paid',
            alreadyPaidExternally: isAlreadyPaidExternally,
            linkedTransactionId: singleBatchTxnId || canonicalPendingId,
            paidAt: payment.paidDate,
            paidWalletId: isAlreadyPaidExternally ? null : payment.walletId,
            paidCurrency: isAlreadyPaidExternally
              ? 'USD'
              : isVesBatch
                ? 'VES'
                : 'USD',
            paidAmountNominal: sliceNominal,
            paidExchangeRate: isVesBatch ? payment.exchangeRate : null,
            partialPayments: nextPartials,
            paidProgressAmountUsd: inst.amountUsd,
            notes: payment.notes || inst.notes,
          };
        }

        return {
          ...inst,
          status: 'pending',
          linkedTransactionId: inst.linkedTransactionId || canonicalPendingId,
          partialPayments: nextPartials,
          paidProgressAmountUsd: alloc.newPaidUsd,
        };
      }
    );

    const allPaid = updatedInstallments.every((inst) => inst.status === 'paid');

    // Actualizar o eliminar las transacciones 'pending' de las cuotas involucradas
    const completedPendingIdsToRemove = new Set<string>();
    allocations.forEach((a) => {
      if (a.completesInst) {
        if (a.inst.linkedTransactionId) {
          completedPendingIdsToRemove.add(a.inst.linkedTransactionId);
        }
        completedPendingIdsToRemove.add(
          `txn-inst-${purchaseId}-${a.inst.number}`
        );
      }
    });

    let updatedTransactions = prevData.transactions.filter(
      (t) => !(t.status === 'pending' && completedPendingIdsToRemove.has(t.id))
    );

    // Si alguna cuota quedó con saldo parcial pendiente, actualizar su transacción 'pending'
    for (const alloc of allocations) {
      if (!alloc.completesInst) {
        const pendingId =
          alloc.inst.linkedTransactionId ||
          `txn-inst-${purchaseId}-${alloc.inst.number}`;
        const pendingNote = `Saldo restante Cuota #${alloc.inst.number}/${targetPurchase.installmentsCount}: $${alloc.newRemainingUsd.toFixed(2)} USD (Abonado: $${alloc.newPaidUsd.toFixed(2)} de $${alloc.inst.amountUsd.toFixed(2)} USD).`;
        const existsPending = updatedTransactions.some(
          (t) => t.id === pendingId
        );
        if (existsPending) {
          updatedTransactions = updatedTransactions.map((t) =>
            t.id === pendingId
              ? {
                  ...t,
                  status: 'pending' as const,
                  amount: alloc.newRemainingUsd,
                  currency: 'USD' as const,
                  exchangeRate: null,
                  amountUsd: alloc.newRemainingUsd,
                  exchangeRateSource: 'none' as const,
                  notes: pendingNote,
                }
              : t
          );
        } else {
          updatedTransactions.unshift({
            id: pendingId,
            date: alloc.inst.dueDate,
            type: 'expense',
            status: 'pending',
            walletId: targetPurchase.initialPaymentWalletId || 'wallet_zelle',
            description: `[Cuota ${alloc.inst.number}/${targetPurchase.installmentsCount} · ${targetPurchase.storeOrPlatform}] ${targetPurchase.concept}`,
            categoryId: targetPurchase.categoryId,
            amount: alloc.newRemainingUsd,
            currency: 'USD',
            exchangeRate: null,
            amountUsd: alloc.newRemainingUsd,
            exchangeRateSource: 'none',
            paymentMethod: targetPurchase.storeOrPlatform,
            expenseType: 'fixed',
            isRecurring: false,
            notes: pendingNote,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Crear UN SOLO MOVIMIENTO BANCARIO ('completed') por el monto total pagado hoy
    if (!isAlreadyPaidExternally && singleBatchTxnId) {
      const hasFee =
        payment.interbankFeeType &&
        payment.interbankFeeType !== 'none' &&
        typeof payment.interbankFeeAmount === 'number' &&
        payment.interbankFeeAmount > 0;
      const feeTxnId = hasFee ? `${singleBatchTxnId}-fee` : undefined;
      const methodLabel =
        payment.interbankFeeType === 'pago_movil'
          ? `${targetPurchase.storeOrPlatform} · Pago Móvil`
          : payment.interbankFeeType === 'transferencia'
            ? `${targetPurchase.storeOrPlatform} · Transferencia`
            : targetPurchase.storeOrPlatform;

      const bankFeesCatId = obtenerIdCategoriaComisionBancaria(
        prevData.categories
      );

      const batchTitlePrefix = allPaid
        ? `[Liquidación Total (${coveredLabels.join(', ')}) · ${targetPurchase.storeOrPlatform}]`
        : `[Pago Cuotas ${coveredLabels.join(', ')} · ${targetPurchase.storeOrPlatform}]`;

      const singleCompletedTxn: Transaction = {
        id: singleBatchTxnId,
        date: payment.paidDate,
        type: 'expense',
        status: 'completed',
        walletId: payment.walletId,
        description: `${batchTitlePrefix} ${targetPurchase.concept}`,
        categoryId: targetPurchase.categoryId,
        amount: totalNominalPaid,
        currency: isVesBatch ? 'VES' : 'USD',
        exchangeRate: isVesBatch ? payment.exchangeRate : null,
        amountUsd: totalEffectiveUsd,
        exchangeRateSource: isVesBatch ? payment.exchangeRateSource : 'none',
        paymentMethod: methodLabel,
        expenseType: 'fixed',
        isRecurring: false,
        isInterbankTransfer: Boolean(hasFee),
        interbankFeeType:
          hasFee && payment.interbankFeeType !== 'none'
            ? payment.interbankFeeType
            : undefined,
        interbankFeeAmount: hasFee
          ? redondearDosDecimales(payment.interbankFeeAmount!)
          : undefined,
        interbankFeeTxnId: feeTxnId,
        notes:
          payment.notes ||
          `Pago único de $${totalEffectiveUsd.toFixed(2)} USD aplicado a cuotas ${coveredLabels.join(', ')} (${targetPurchase.storeOrPlatform}).`,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      };

      if (hasFee && feeTxnId) {
        const feeNominal = redondearDosDecimales(payment.interbankFeeAmount!);
        const feeUsd =
          isVesBatch && payment.exchangeRate && payment.exchangeRate > 0
            ? redondearDosDecimales(feeNominal / payment.exchangeRate)
            : feeNominal;
        const feeTxn: Transaction = {
          id: feeTxnId,
          date: payment.paidDate,
          type: 'expense',
          status: 'completed',
          walletId: payment.walletId,
          description: `Comisión bancaria (${payment.interbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - Cuotas ${coveredLabels.join(', ')} ${targetPurchase.concept}`,
          categoryId: bankFeesCatId,
          amount: feeNominal,
          currency: isVesBatch ? 'VES' : 'USD',
          exchangeRate: isVesBatch ? payment.exchangeRate : null,
          amountUsd: feeUsd,
          exchangeRateSource: isVesBatch ? payment.exchangeRateSource : 'none',
          paymentMethod:
            payment.interbankFeeType === 'pago_movil'
              ? 'Pago Móvil'
              : 'Transferencia',
          expenseType: 'variable',
          isRecurring: false,
          parentTransactionId: singleBatchTxnId,
          notes: `Comisión bancaria por pago de cuotas ${coveredLabels.join(', ')} de "${targetPurchase.concept}".`,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        };
        updatedTransactions = [
          feeTxn,
          singleCompletedTxn,
          ...updatedTransactions,
        ];
      } else {
        updatedTransactions = [singleCompletedTxn, ...updatedTransactions];
      }
    }

    const updatedPurchases: CreditPurchase[] = purchases.map((p) =>
      p.id === purchaseId
        ? {
            ...p,
            installments: updatedInstallments,
            status: allPaid ? 'completed' : 'active',
          }
        : p
    );

    return {
      ...prevData,
      creditPurchases: updatedPurchases,
      transactions: updatedTransactions,
    };
  }

  const completesInstallment = abonoUsd >= remainingUsd - 0.009;
  const effectiveAbonoUsd = completesInstallment ? remainingUsd : abonoUsd;
  const newPaidUsd = completesInstallment
    ? targetInst.amountUsd
    : redondearDosDecimales(prevPaidUsd + effectiveAbonoUsd);
  const newRemainingUsd = completesInstallment
    ? 0
    : redondearDosDecimales(Math.max(0, targetInst.amountUsd - newPaidUsd));

  const linkedPendingTxnId =
    targetInst.linkedTransactionId ||
    `txn-inst-${purchaseId}-${targetInst.number}`;

  const isVes =
    !isAlreadyPaidExternally &&
    payment.currency === 'VES' &&
    payment.exchangeRate !== null &&
    payment.exchangeRate > 0;

  const nominalPaid = isVes
    ? redondearDosDecimales(effectiveAbonoUsd * (payment.exchangeRate as number))
    : effectiveAbonoUsd;

  // =========================================================================
  // CASO 1: ABONO PARCIAL QUE AÚN DEJA SALDO PENDIENTE EN LA CUOTA
  // =========================================================================
  if (!completesInstallment) {
    const partialId = `abono-${installmentId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 5)}`;

    let partialTxnId: string | null = null;
    let updatedTransactions = [...prevData.transactions];

    if (!isAlreadyPaidExternally) {
      partialTxnId = `txn-${partialId}`;
      const hasFee =
        payment.interbankFeeType &&
        payment.interbankFeeType !== 'none' &&
        typeof payment.interbankFeeAmount === 'number' &&
        payment.interbankFeeAmount > 0;
      const feeTxnId = hasFee ? `${partialTxnId}-fee` : undefined;
      const methodLabel =
        payment.interbankFeeType === 'pago_movil'
          ? `${targetPurchase.storeOrPlatform} · Pago Móvil`
          : payment.interbankFeeType === 'transferencia'
            ? `${targetPurchase.storeOrPlatform} · Transferencia`
            : targetPurchase.storeOrPlatform;

      const bankFeesCatId = obtenerIdCategoriaComisionBancaria(
        prevData.categories
      );

      const abonoCompletedTxn: Transaction = {
        id: partialTxnId,
        date: payment.paidDate,
        type: 'expense',
        status: 'completed', // PASA AL SALDO REAL SOLO EL MONTO ABONADO
        walletId: payment.walletId,
        description: `[Abono Cuota ${targetInst.number}/${targetPurchase.installmentsCount} · ${targetPurchase.storeOrPlatform}] ${targetPurchase.concept}`,
        categoryId: targetPurchase.categoryId,
        amount: nominalPaid,
        currency: isVes ? 'VES' : 'USD',
        exchangeRate: isVes ? payment.exchangeRate : null,
        amountUsd: effectiveAbonoUsd,
        exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
        paymentMethod: methodLabel,
        expenseType: 'fixed',
        isRecurring: false,
        isInterbankTransfer: Boolean(hasFee),
        interbankFeeType:
          hasFee && payment.interbankFeeType !== 'none'
            ? payment.interbankFeeType
            : undefined,
        interbankFeeAmount: hasFee
          ? redondearDosDecimales(payment.interbankFeeAmount!)
          : undefined,
        interbankFeeTxnId: feeTxnId,
        notes:
          payment.notes ||
          `Abono parcial de $${effectiveAbonoUsd.toFixed(2)} USD a Cuota #${targetInst.number} (${targetPurchase.storeOrPlatform}). Resta por pagar: $${newRemainingUsd.toFixed(2)} USD.`,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      };

      if (hasFee && feeTxnId) {
        const feeNominal = redondearDosDecimales(payment.interbankFeeAmount!);
        const feeUsd =
          isVes && payment.exchangeRate && payment.exchangeRate > 0
            ? redondearDosDecimales(feeNominal / payment.exchangeRate)
            : feeNominal;
        const feeTxn: Transaction = {
          id: feeTxnId,
          date: payment.paidDate,
          type: 'expense',
          status: 'completed',
          walletId: payment.walletId,
          description: `Comisión bancaria (${payment.interbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - Abono Cuota #${targetInst.number} ${targetPurchase.concept}`,
          categoryId: bankFeesCatId,
          amount: feeNominal,
          currency: isVes ? 'VES' : 'USD',
          exchangeRate: isVes ? payment.exchangeRate : null,
          amountUsd: feeUsd,
          exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
          paymentMethod:
            payment.interbankFeeType === 'pago_movil'
              ? 'Pago Móvil'
              : 'Transferencia',
          expenseType: 'variable',
          isRecurring: false,
          parentTransactionId: partialTxnId,
          notes: `Comisión bancaria por abono a Cuota #${targetInst.number}/${targetPurchase.installmentsCount} de "${targetPurchase.concept}".`,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
        };
        updatedTransactions = [feeTxn, abonoCompletedTxn, ...updatedTransactions];
      } else {
        updatedTransactions = [abonoCompletedTxn, ...updatedTransactions];
      }
    }

    const newPartialRecord: CreditInstallmentPartialPayment = {
      id: partialId,
      date: payment.paidDate,
      amountUsd: effectiveAbonoUsd,
      paymentCurrency: isVes ? 'VES' : 'USD',
      paymentAmountNominal: nominalPaid,
      exchangeRate: isVes ? payment.exchangeRate : null,
      alreadyPaidExternally: isAlreadyPaidExternally,
      walletId: isAlreadyPaidExternally ? null : payment.walletId,
      linkedTransactionId: partialTxnId,
      notes:
        payment.notes ||
        (isAlreadyPaidExternally
          ? 'Abono pagado anteriormente (Sin descuento en billeteras)'
          : undefined),
    };

    const nextPartials = [...existingPartials, newPartialRecord];

    const updatedInstallments: CreditInstallment[] = targetPurchase.installments.map(
      (inst) => {
        if (inst.id !== installmentId) return inst;
        return {
          ...inst,
          linkedTransactionId: linkedPendingTxnId,
          partialPayments: nextPartials,
          paidProgressAmountUsd: newPaidUsd,
        };
      }
    );

    const pendingNote = `Saldo restante Cuota #${targetInst.number}/${targetPurchase.installmentsCount}: $${newRemainingUsd.toFixed(2)} USD (Abonado: $${newPaidUsd.toFixed(2)} de $${targetInst.amountUsd.toFixed(2)} USD).`;
    const existsPending = updatedTransactions.some(
      (t) => t.id === linkedPendingTxnId
    );

    if (existsPending) {
      updatedTransactions = updatedTransactions.map((t) =>
        t.id === linkedPendingTxnId
          ? {
               ...t,
              status: 'pending' as const,
              amount: newRemainingUsd,
              currency: 'USD' as const,
              exchangeRate: null,
              amountUsd: newRemainingUsd,
              exchangeRateSource: 'none' as const,
              notes: pendingNote,
            }
          : t
      );
    } else {
      updatedTransactions.unshift({
        id: linkedPendingTxnId,
        date: targetInst.dueDate,
        type: 'expense',
        status: 'pending',
        walletId: targetPurchase.initialPaymentWalletId || 'wallet_zelle',
        description: `[Cuota ${targetInst.number}/${targetPurchase.installmentsCount} · ${targetPurchase.storeOrPlatform}] ${targetPurchase.concept}`,
        categoryId: targetPurchase.categoryId,
        amount: newRemainingUsd,
        currency: 'USD',
        exchangeRate: null,
        amountUsd: newRemainingUsd,
        exchangeRateSource: 'none',
        paymentMethod: targetPurchase.storeOrPlatform,
        expenseType: 'fixed',
        isRecurring: false,
        notes: pendingNote,
        createdAt: new Date().toISOString(),
      });
    }

    const updatedPurchases: CreditPurchase[] = purchases.map((p) =>
      p.id === purchaseId
        ? {
            ...p,
            installments: updatedInstallments,
            status: 'active',
          }
        : p
    );

    return {
      ...prevData,
      creditPurchases: updatedPurchases,
      transactions: updatedTransactions,
    };
  }

  // =========================================================================
  // CASO 2: PAGO COMPLETO DE LA CUOTA (O LIQUIDACIÓN DEL SALDO RESTANTE)
  // =========================================================================
  const hadPriorPartials = existingPartials.length > 0;

  if (isAlreadyPaidExternally) {
    const finalPartialList: CreditInstallmentPartialPayment[] = hadPriorPartials
      ? [
          ...existingPartials,
          {
            id: `abono-${installmentId}-${Date.now()}`,
            date: payment.paidDate || targetInst.dueDate,
            amountUsd: effectiveAbonoUsd,
            paymentCurrency: 'USD',
            paymentAmountNominal: effectiveAbonoUsd,
            exchangeRate: null,
            alreadyPaidExternally: true,
            walletId: null,
            linkedTransactionId: null,
            notes:
              payment.notes ||
              'Saldo restante pagado anteriormente (Sin descuento en billeteras)',
          },
        ]
      : existingPartials;

    const updatedInstallments: CreditInstallment[] = targetPurchase.installments.map(
      (inst) => {
        if (inst.id !== installmentId) return inst;
        return {
          ...inst,
          status: 'paid',
          alreadyPaidExternally: !hadPriorPartials
            ? true
            : finalPartialList.every((p) => p.alreadyPaidExternally),
          paidAt: payment.paidDate || inst.dueDate,
          paidWalletId: null,
          paidCurrency: 'USD',
          paidAmountNominal: inst.amountUsd,
          paidExchangeRate: null,
          partialPayments: finalPartialList,
          paidProgressAmountUsd: inst.amountUsd,
          notes:
            payment.notes ||
            'Pagada previamente (Sin descuento en balance actual)',
        };
      }
    );

    const allPaid = updatedInstallments.every((inst) => inst.status === 'paid');

    const updatedPurchases: CreditPurchase[] = purchases.map((p) =>
      p.id === purchaseId
        ? {
            ...p,
            installments: updatedInstallments,
            status: allPaid ? 'completed' : 'active',
          }
        : p
    );

    // Eliminar la transacción pendiente para que deje de restar al Saldo Proyectado SIN restar al Saldo Real
    const updatedTransactions = targetInst.linkedTransactionId
      ? prevData.transactions.filter((t) => t.id !== targetInst.linkedTransactionId)
      : prevData.transactions;

    return {
      ...prevData,
      creditPurchases: updatedPurchases,
      transactions: updatedTransactions,
    };
  }

  // Se paga el saldo restante o la cuota completa descontando de una billetera
  const finalPartialId = `abono-${installmentId}-${Date.now()}`;
  const finalPartialTxId = `txn-${finalPartialId}`;
  const finalPartialList: CreditInstallmentPartialPayment[] = hadPriorPartials
    ? [
        ...existingPartials,
        {
          id: finalPartialId,
          date: payment.paidDate,
          amountUsd: effectiveAbonoUsd,
          paymentCurrency: isVes ? 'VES' : 'USD',
          paymentAmountNominal: nominalPaid,
          exchangeRate: isVes ? payment.exchangeRate : null,
          alreadyPaidExternally: false,
          walletId: payment.walletId,
          linkedTransactionId: finalPartialTxId,
          notes: payment.notes || 'Pago final de saldo restante de la cuota',
        },
      ]
    : existingPartials;

  const updatedInstallments: CreditInstallment[] = targetPurchase.installments.map(
    (inst) => {
      if (inst.id !== installmentId) return inst;
      return {
        ...inst,
        status: 'paid',
        alreadyPaidExternally: false,
        paidAt: payment.paidDate,
        paidWalletId: payment.walletId,
        paidCurrency: isVes ? 'VES' : 'USD',
        paidAmountNominal: nominalPaid,
        paidExchangeRate: isVes ? payment.exchangeRate : null,
        partialPayments: finalPartialList,
        paidProgressAmountUsd: inst.amountUsd,
        notes: payment.notes || inst.notes,
      };
    }
  );

  const allPaid = updatedInstallments.every((inst) => inst.status === 'paid');

  const updatedPurchases: CreditPurchase[] = purchases.map((p) =>
    p.id === purchaseId
      ? {
          ...p,
          installments: updatedInstallments,
          status: allPaid ? 'completed' : 'active',
        }
      : p
  );

  let updatedTransactions: Transaction[];
  const hasFullPayFee =
    !isAlreadyPaidExternally &&
    payment.interbankFeeType &&
    payment.interbankFeeType !== 'none' &&
    typeof payment.interbankFeeAmount === 'number' &&
    payment.interbankFeeAmount > 0;

  const bankFeesCatId = obtenerIdCategoriaComisionBancaria(prevData.categories);

  const methodLabelFull =
    payment.interbankFeeType === 'pago_movil'
      ? `${targetPurchase.storeOrPlatform} · Pago Móvil`
      : payment.interbankFeeType === 'transferencia'
        ? `${targetPurchase.storeOrPlatform} · Transferencia`
        : targetPurchase.storeOrPlatform;

  let parentTxnIdForFee: string | null = null;

  if (hadPriorPartials) {
    // Eliminamos la transacción pendiente restante y creamos una completada solo por el saldo final pagado hoy
    const withoutPending = targetInst.linkedTransactionId
      ? prevData.transactions.filter((t) => t.id !== targetInst.linkedTransactionId)
      : [...prevData.transactions];

    parentTxnIdForFee = finalPartialTxId;
    const feeTxnId = hasFullPayFee ? `${finalPartialTxId}-fee` : undefined;

    const finalCompletedTxn: Transaction = {
      id: finalPartialTxId,
      date: payment.paidDate,
      type: 'expense',
      status: 'completed',
      walletId: payment.walletId,
      description: `[Liquidación Cuota ${targetInst.number}/${targetPurchase.installmentsCount} · ${targetPurchase.storeOrPlatform}] ${targetPurchase.concept}`,
      categoryId: targetPurchase.categoryId,
      amount: nominalPaid,
      currency: isVes ? 'VES' : 'USD',
      exchangeRate: isVes ? payment.exchangeRate : null,
      amountUsd: effectiveAbonoUsd,
      exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
      paymentMethod: methodLabelFull,
      expenseType: 'fixed',
      isRecurring: false,
      isInterbankTransfer: Boolean(hasFullPayFee),
      interbankFeeType:
        hasFullPayFee && payment.interbankFeeType !== 'none'
          ? payment.interbankFeeType
          : undefined,
      interbankFeeAmount: hasFullPayFee
        ? redondearDosDecimales(payment.interbankFeeAmount!)
        : undefined,
      interbankFeeTxnId: feeTxnId,
      notes: `Pago de saldo restante ($${effectiveAbonoUsd.toFixed(2)} USD) de Cuota ${targetInst.number}/${targetPurchase.installmentsCount} (${targetPurchase.storeOrPlatform}).${payment.notes ? ` · ${payment.notes}` : ''}`,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };
    updatedTransactions = [finalCompletedTxn, ...withoutPending];
  } else {
    // Pago único del 100% de la cuota sin abonos previos
    const linkedExists =
      Boolean(targetInst.linkedTransactionId) &&
      prevData.transactions.some((t) => t.id === targetInst.linkedTransactionId);

    const newTxnId =
      targetInst.linkedTransactionId ||
      `txn-inst-${purchaseId}-${targetInst.number}`;
    parentTxnIdForFee = newTxnId;
    const feeTxnId = hasFullPayFee ? `${newTxnId}-fee` : undefined;

    if (linkedExists) {
      updatedTransactions = prevData.transactions.map((txn) => {
        if (txn.id !== targetInst.linkedTransactionId) return txn;
        return {
          ...txn,
          date: payment.paidDate,
          status: 'completed', // PASA DE SALDO PROYECTADO A SALDO REAL
          walletId: payment.walletId,
          amount: nominalPaid,
          currency: isVes ? 'VES' : 'USD',
          exchangeRate: isVes ? payment.exchangeRate : null,
          amountUsd: targetInst.amountUsd,
          exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
          paymentMethod: methodLabelFull,
          isInterbankTransfer: Boolean(hasFullPayFee),
          interbankFeeType:
            hasFullPayFee && payment.interbankFeeType !== 'none'
              ? payment.interbankFeeType
              : undefined,
          interbankFeeAmount: hasFullPayFee
            ? redondearDosDecimales(payment.interbankFeeAmount!)
            : undefined,
          interbankFeeTxnId: feeTxnId,
          processedAt: new Date().toISOString(),
          notes: `Cuota ${targetInst.number}/${targetPurchase.installmentsCount} pagada (${targetPurchase.storeOrPlatform}).${payment.notes ? ` · ${payment.notes}` : ''}`,
        };
      });
    } else {
      const newCompletedTxn: Transaction = {
        id: newTxnId,
        date: payment.paidDate,
        type: 'expense',
        status: 'completed',
        walletId: payment.walletId,
        description: `[Cuota ${targetInst.number}/${targetPurchase.installmentsCount} · ${targetPurchase.storeOrPlatform}] ${targetPurchase.concept}`,
        categoryId: targetPurchase.categoryId,
        amount: nominalPaid,
        currency: isVes ? 'VES' : 'USD',
        exchangeRate: isVes ? payment.exchangeRate : null,
        amountUsd: targetInst.amountUsd,
        exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
        paymentMethod: methodLabelFull,
        expenseType: 'fixed',
        isRecurring: false,
        isInterbankTransfer: Boolean(hasFullPayFee),
        interbankFeeType:
          hasFullPayFee && payment.interbankFeeType !== 'none'
            ? payment.interbankFeeType
            : undefined,
        interbankFeeAmount: hasFullPayFee
          ? redondearDosDecimales(payment.interbankFeeAmount!)
          : undefined,
        interbankFeeTxnId: feeTxnId,
        notes: `Cuota ${targetInst.number}/${targetPurchase.installmentsCount} pagada (${targetPurchase.storeOrPlatform}).`,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      };
      updatedTransactions = [newCompletedTxn, ...prevData.transactions];
    }
  }

  if (hasFullPayFee && parentTxnIdForFee) {
    const feeNominal = redondearDosDecimales(payment.interbankFeeAmount!);
    const feeUsd =
      isVes && payment.exchangeRate && payment.exchangeRate > 0
        ? redondearDosDecimales(feeNominal / payment.exchangeRate)
        : feeNominal;
    const feeTxn: Transaction = {
      id: `${parentTxnIdForFee}-fee`,
      date: payment.paidDate,
      type: 'expense',
      status: 'completed',
      walletId: payment.walletId,
      description: `Comisión bancaria (${payment.interbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - Cuota #${targetInst.number} ${targetPurchase.concept}`,
      categoryId: bankFeesCatId,
      amount: feeNominal,
      currency: isVes ? 'VES' : 'USD',
      exchangeRate: isVes ? payment.exchangeRate : null,
      amountUsd: feeUsd,
      exchangeRateSource: isVes ? payment.exchangeRateSource : 'none',
      processedAt: new Date().toISOString(),
      paymentMethod:
        payment.interbankFeeType === 'pago_movil'
          ? 'Pago Móvil'
          : 'Transferencia',
      expenseType: 'variable',
      isRecurring: false,
      parentTransactionId: parentTxnIdForFee,
      notes: `Comisión bancaria por pago de Cuota #${targetInst.number}/${targetPurchase.installmentsCount} de "${targetPurchase.concept}".`,
      createdAt: new Date().toISOString(),
    };
    updatedTransactions = [feeTxn, ...updatedTransactions];
  }

  return {
    ...prevData,
    creditPurchases: updatedPurchases,
    transactions: updatedTransactions,
  };
}

/**
 * Elimina un abono parcial individual de una cuota de Compra por Cuotas y revierte su impacto contable.
 * Si el abono formaba parte de un movimiento bancario en lote (`txn-batch-...`) compartido con otras cuotas,
 * ajusta el monto del movimiento bancario en lugar de borrar las otras cuotas.
 */
export function eliminarAbonoCuotaCompraEnAppData(
  prevData: AppDataSchema,
  purchaseId: string,
  installmentId: string,
  partialPaymentId: string
): AppDataSchema {
  const purchases = prevData.creditPurchases || [];
  const targetPurchase = purchases.find((p) => p.id === purchaseId);
  if (!targetPurchase) return prevData;

  const targetInst = targetPurchase.installments.find((i) => i.id === installmentId);
  if (!targetInst) return prevData;

  const existingPartials = targetInst.partialPayments || [];
  const targetPartial = existingPartials.find((p) => p.id === partialPaymentId);
  if (!targetPartial) return prevData;

  const remainingPartials = existingPartials.filter((p) => p.id !== partialPaymentId);
  const newPaidUsd = redondearDosDecimales(
    remainingPartials.reduce((acc, p) => acc + (Number(p.amountUsd) || 0), 0)
  );
  const newRemainingUsd = redondearDosDecimales(
    Math.max(0, targetInst.amountUsd - newPaidUsd)
  );

  const ensuredPendingTxnId = `txn-inst-${purchaseId}-${targetInst.number}`;

  const updatedInstallments: CreditInstallment[] = targetPurchase.installments.map(
    (inst) => {
      if (inst.id !== installmentId) return inst;
      return {
        ...inst,
        status: 'pending',
        alreadyPaidExternally: false,
        linkedTransactionId: ensuredPendingTxnId,
        paidAt: null,
        paidWalletId: null,
        paidCurrency: null,
        paidAmountNominal: null,
        paidExchangeRate: null,
        partialPayments: remainingPartials,
        paidProgressAmountUsd: newPaidUsd,
      };
    }
  );

  let updatedTransactions = [...prevData.transactions];
  const sharedTxId = targetPartial.linkedTransactionId;

  if (sharedTxId) {
    // Verificar si otra cuota de esta compra sigue usando esa misma transacción bancaria (pago en lote)
    const remainingSharesUsd = updatedInstallments.reduce((acc, inst) => {
      const sumInInst = (inst.partialPayments || [])
        .filter((p) => p.linkedTransactionId === sharedTxId)
        .reduce((s, p) => s + (Number(p.amountUsd) || 0), 0);
      return acc + sumInInst;
    }, 0);

    if (remainingSharesUsd > 0.009) {
      // Ajustar proporcionalmente la transacción bancaria compartida
      updatedTransactions = updatedTransactions.map((t) => {
        if (t.id !== sharedTxId) return t;
        const nextUsd = redondearDosDecimales(remainingSharesUsd);
        const nextNominal =
          t.currency === 'VES' && t.exchangeRate && t.exchangeRate > 0
            ? redondearDosDecimales(nextUsd * t.exchangeRate)
            : nextUsd;
        return {
          ...t,
          amountUsd: nextUsd,
          amount: nextNominal,
        };
      });
    } else {
      updatedTransactions = updatedTransactions.filter(
        (t) =>
          t.id !== sharedTxId &&
          t.parentTransactionId !== sharedTxId &&
          t.id !== `${sharedTxId}-fee`
      );
    }
  }

  const pendingNote =
    newPaidUsd > 0
      ? `Saldo restante Cuota #${targetInst.number}/${targetPurchase.installmentsCount}: $${newRemainingUsd.toFixed(2)} USD (Abonado: $${newPaidUsd.toFixed(2)} de $${targetInst.amountUsd.toFixed(2)} USD).`
      : `Cuota ${targetInst.number} de ${targetPurchase.installmentsCount} (${targetPurchase.storeOrPlatform}) con vencimiento el ${targetInst.dueDate}.`;

  const existsPending = updatedTransactions.some(
    (t) => t.id === ensuredPendingTxnId
  );

  if (existsPending) {
    updatedTransactions = updatedTransactions.map((t) =>
      t.id === ensuredPendingTxnId
        ? {
            ...t,
            date: targetInst.dueDate,
            status: 'pending' as const,
            amount: newRemainingUsd,
            currency: 'USD' as const,
            exchangeRate: null,
            amountUsd: newRemainingUsd,
            exchangeRateSource: 'none' as const,
            notes: pendingNote,
          }
        : t
    );
  } else {
    updatedTransactions.unshift({
      id: ensuredPendingTxnId,
      date: targetInst.dueDate,
      type: 'expense',
      status: 'pending',
      walletId: targetPurchase.initialPaymentWalletId || 'wallet_zelle',
      description: `[Cuota ${targetInst.number}/${targetPurchase.installmentsCount} · ${targetPurchase.storeOrPlatform}] ${targetPurchase.concept}`,
      categoryId: targetPurchase.categoryId,
      amount: newRemainingUsd,
      currency: 'USD',
      exchangeRate: null,
      amountUsd: newRemainingUsd,
      exchangeRateSource: 'none',
      paymentMethod: targetPurchase.storeOrPlatform,
      expenseType: 'fixed',
      isRecurring: false,
      notes: pendingNote,
      createdAt: new Date().toISOString(),
    });
  }

  const updatedPurchases: CreditPurchase[] = purchases.map((p) =>
    p.id === purchaseId
      ? {
          ...p,
          installments: updatedInstallments,
          status: 'active',
        }
      : p
  );

  return {
    ...prevData,
    creditPurchases: updatedPurchases,
    transactions: updatedTransactions,
  };
}

/**
 * Reversión de cuota a estado 'pending' (por si se marcó pagada por error).
 * Limpia también los abonos parciales de esa cuota y devuelve el movimiento a `status: 'pending'`.
 * Si la cuota fue pagada en un movimiento bancario en lote (`txn-batch-...`), ajusta o elimina el movimiento según corresponda.
 */
export function revertirPagoCuotaEnAppData(
  prevData: AppDataSchema,
  purchaseId: string,
  installmentId: string
): AppDataSchema {
  const purchases = prevData.creditPurchases || [];
  const targetPurchase = purchases.find((p) => p.id === purchaseId);
  if (!targetPurchase) return prevData;

  const targetInst = targetPurchase.installments.find((i) => i.id === installmentId);
  if (!targetInst || targetInst.status !== 'paid') return prevData;

  const canonicalPendingTxnId = `txn-inst-${purchaseId}-${targetInst.number}`;

  const candidateTxIds = new Set<string>();
  if (
    targetInst.linkedTransactionId &&
    targetInst.linkedTransactionId !== canonicalPendingTxnId
  ) {
    candidateTxIds.add(targetInst.linkedTransactionId);
  }
  for (const p of targetInst.partialPayments || []) {
    if (p.linkedTransactionId) {
      candidateTxIds.add(p.linkedTransactionId);
    }
  }

  const updatedInstallments: CreditInstallment[] = targetPurchase.installments.map(
    (inst) => {
      if (inst.id !== installmentId) return inst;
      return {
        ...inst,
        status: 'pending',
        alreadyPaidExternally: false,
        linkedTransactionId: canonicalPendingTxnId,
        paidAt: null,
        paidWalletId: null,
        paidCurrency: null,
        paidAmountNominal: null,
        paidExchangeRate: null,
        partialPayments: [],
        paidProgressAmountUsd: 0,
      };
    }
  );

  const updatedPurchases: CreditPurchase[] = purchases.map((p) =>
    p.id === purchaseId
      ? {
          ...p,
          installments: updatedInstallments,
          status: 'active',
        }
      : p
  );

  let baseTransactions = [...prevData.transactions];

  // Para cada transacción de pago o lote asociada a esta cuota, verificar si otra cuota aún la comparte
  for (const txId of candidateTxIds) {
    const remainingSharesUsd = updatedInstallments.reduce((acc, inst) => {
      const fromPartials = (inst.partialPayments || [])
        .filter((p) => p.linkedTransactionId === txId)
        .reduce((s, p) => s + (Number(p.amountUsd) || 0), 0);
      return acc + fromPartials;
    }, 0);

    if (remainingSharesUsd > 0.009) {
      baseTransactions = baseTransactions.map((t) => {
        if (t.id !== txId) return t;
        const nextUsd = redondearDosDecimales(remainingSharesUsd);
        const nextNominal =
          t.currency === 'VES' && t.exchangeRate && t.exchangeRate > 0
            ? redondearDosDecimales(nextUsd * t.exchangeRate)
            : nextUsd;
        return {
          ...t,
          amountUsd: nextUsd,
          amount: nextNominal,
        };
      });
    } else {
      baseTransactions = baseTransactions.filter(
        (t) =>
          t.id !== txId &&
          t.parentTransactionId !== txId &&
          t.id !== `${txId}-fee`
      );
    }
  }

  // También limpiar cualquier comisión directa asociada a canonicalPendingTxnId
  baseTransactions = baseTransactions.filter(
    (t) =>
      t.parentTransactionId !== canonicalPendingTxnId &&
      t.id !== `${canonicalPendingTxnId}-fee`
  );

  const existsInTxns = baseTransactions.some(
    (t) => t.id === canonicalPendingTxnId
  );
  let updatedTransactions: Transaction[];

  if (existsInTxns) {
    updatedTransactions = baseTransactions.map((txn) => {
      if (txn.id !== canonicalPendingTxnId) return txn;
      return {
        ...txn,
        date: targetInst.dueDate,
        status: 'pending' as const,
        amount: targetInst.amountUsd,
        currency: 'USD' as const,
        exchangeRate: null,
        amountUsd: targetInst.amountUsd,
        exchangeRateSource: 'none' as const,
      };
    });
  } else {
    const restoredPendingTxn: Transaction = {
      id: canonicalPendingTxnId,
      date: targetInst.dueDate,
      type: 'expense',
      status: 'pending',
      walletId: targetPurchase.initialPaymentWalletId || 'wallet_zelle',
      description: `[Cuota ${targetInst.number}/${targetPurchase.installmentsCount} · ${targetPurchase.storeOrPlatform}] ${targetPurchase.concept}`,
      categoryId: targetPurchase.categoryId,
      amount: targetInst.amountUsd,
      currency: 'USD',
      exchangeRate: null,
      amountUsd: targetInst.amountUsd,
      exchangeRateSource: 'none',
      paymentMethod: targetPurchase.storeOrPlatform,
      expenseType: 'fixed',
      isRecurring: false,
      notes: `Cuota ${targetInst.number} de ${targetPurchase.installmentsCount} (${targetPurchase.storeOrPlatform}) con vencimiento el ${targetInst.dueDate}.`,
      createdAt: new Date().toISOString(),
    };
    updatedTransactions = [restoredPendingTxn, ...baseTransactions];
  }

  return {
    ...prevData,
    creditPurchases: updatedPurchases,
    transactions: updatedTransactions,
  };
}

/**
 * Elimina una compra a crédito y limpia sus transacciones vinculadas (incluyendo abonos parciales).
 */
export function eliminarCompraCreditoEnAppData(
  prevData: AppDataSchema,
  purchaseId: string,
  removeCompletedTransactionsToo = true
): AppDataSchema {
  const purchases = prevData.creditPurchases || [];
  const target = purchases.find((p) => p.id === purchaseId);
  if (!target) return prevData;

  const linkedIds = new Set<string>();
  if (removeCompletedTransactionsToo && target.initialTransactionId) {
    linkedIds.add(target.initialTransactionId);
  }
  target.installments.forEach((inst) => {
    if (
      inst.linkedTransactionId &&
      (removeCompletedTransactionsToo || inst.status === 'pending')
    ) {
      linkedIds.add(inst.linkedTransactionId);
    }
    if (removeCompletedTransactionsToo && inst.partialPayments) {
      inst.partialPayments.forEach((p) => {
        if (p.linkedTransactionId) {
          linkedIds.add(p.linkedTransactionId);
        }
      });
    }
  });

  return {
    ...prevData,
    creditPurchases: purchases.filter((p) => p.id !== purchaseId),
    transactions: prevData.transactions.filter(
      (t) =>
        !linkedIds.has(t.id) &&
        (!t.parentTransactionId || !linkedIds.has(t.parentTransactionId))
    ),
  };
}

/**
 * BLOQUE 4: Cálculo de Resumen y Próximos Vencimientos para el Dashboard y Vista de Cuotas
 */
export function calcularResumenComprasACuotas(
  creditPurchases: CreditPurchase[] = []
): InstallmentsDashboardSummary {
  const todayStr = obtenerFechaLocalIso();
  const todayParts = todayStr.split('-').map(Number);
  const todayMs = new Date(
    todayParts[0],
    todayParts[1] - 1,
    todayParts[2],
    12,
    0,
    0
  ).getTime();

  let activePurchasesCount = 0;
  let completedPurchasesCount = 0;
  let totalFinancedPendingUsd = 0;
  let totalInitialAndPaidUsd = 0;
  let pendingInstallmentsCount = 0;
  let paidInstallmentsCount = 0;

  const upcomingInstallments: UpcomingInstallmentItem[] = [];

  creditPurchases.forEach((purchase) => {
    totalInitialAndPaidUsd += purchase.initialPaymentUsd;

    const hasPending = purchase.installments.some((i) => i.status === 'pending');
    if (hasPending && purchase.status === 'active') {
      activePurchasesCount += 1;
    } else {
      completedPurchasesCount += 1;
    }

    purchase.installments.forEach((inst) => {
      if (inst.status === 'paid') {
        paidInstallmentsCount += 1;
        totalInitialAndPaidUsd += inst.amountUsd;
      } else {
        const { paidUsd, remainingUsd } = obtenerEstadoAbonosCuotaCompra(inst);
        pendingInstallmentsCount += 1;
        totalInitialAndPaidUsd += paidUsd;
        totalFinancedPendingUsd += remainingUsd;

        const dueParts = inst.dueDate.split('-').map(Number);
        const dueMs = new Date(
          dueParts[0] || todayParts[0],
          (dueParts[1] || 1) - 1,
          dueParts[2] || 1,
          12,
          0,
          0
        ).getTime();

        const diffDays = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));
        const urgency: UpcomingInstallmentItem['urgency'] =
          diffDays < 0
            ? 'overdue'
            : diffDays === 0
              ? 'today'
              : diffDays <= 5
                ? 'soon'
                : 'upcoming';

        upcomingInstallments.push({
          purchaseId: purchase.id,
          concept: purchase.concept,
          storeOrPlatform: purchase.storeOrPlatform,
          categoryId: purchase.categoryId,
          installment: inst,
          remainingUsd,
          paidUsd,
          totalInstallments: purchase.installmentsCount,
          daysUntilDue: diffDays,
          urgency,
        });
      }
    });
  });

  // Ordenar próximos vencimientos por fecha más cercana primero
  upcomingInstallments.sort((a, b) =>
    a.installment.dueDate.localeCompare(b.installment.dueDate)
  );

  return {
    activePurchasesCount,
    completedPurchasesCount,
    totalFinancedPendingUsd: redondearDosDecimales(totalFinancedPendingUsd),
    totalInitialAndPaidUsd: redondearDosDecimales(totalInitialAndPaidUsd),
    pendingInstallmentsCount,
    paidInstallmentsCount,
    upcomingInstallments,
    nextDueInstallment:
      upcomingInstallments.length > 0 ? upcomingInstallments[0] : null,
  };
}
