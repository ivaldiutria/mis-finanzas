/**
 * ============================================================================
 * CONTROLADOR DE NEGOCIO: MÓDULO DE CAMBIOS P2P Y CUENTAS POR COBRAR
 * ============================================================================
 *
 * Arquitectura de Protección de Saldos (Zero-Descuadre):
 *
 * 1. SALIDA INMEDIATA (Monto Entregado):
 *    Al registrar una operación de cambio P2P o préstamo, el dinero entregado
 *    abandona inmediatamente tu custodia. Por tanto, se registra una transacción
 *    con `type: 'expense'` y `status: 'completed'` en la Billetera Origen (`sourceWalletId`).
 *    -> Resta directamente del SALDO REAL disponible de esa billetera.
 *
 * 2. EN TRÁNSITO / CUENTA POR COBRAR (Monto Esperado):
 *    Mientras la contraparte no entregue los fondos pactados (ej. efectivo USD mañana
 *    o USDT en Binance), ese monto es un derecho de cobro futuro.
 *    Se registra una transacción con `type: 'income'` y `status: 'pending'`
 *    asociada a la Billetera Destino (`destinationWalletId`).
 *    -> REGLA ESTRICTA: Al ser 'pending', el motor contable (`calculations.ts`)
 *       NUNCA suma este monto al Saldo Real de la Billetera Destino.
 *       En cambio, suma únicamente al SALDO PROYECTADO y al Patrimonio Neto en tránsito.
 *
 * 3. LIQUIDACIÓN Y CIERRE DEL CICLO:
 *    Cuando marcas la operación como 'Liquidada', la transacción receptora vinculada
 *    se actualiza de `status: 'pending'` a `status: 'completed'`.
 *    -> En ese momento exacto, el dinero ingresa al SALDO REAL de la Billetera Destino,
 *       cerrando el ciclo de intercambio sin desfases ni dobles contabilizaciones.
 */

import {
  AppDataSchema,
  Category,
  CurrencyCode,
  P2PDirection,
  P2POperation,
  P2POperationStatus,
  P2POperationType,
  Transaction,
  WalletAccount,
} from '../types/finance';
import {
  calcularEquivalenteUsd,
  obtenerFechaLocalIso,
  obtenerIdCategoriaComisionBancaria,
} from './calculations';

export interface CreateP2POperationInput {
  contactName: string;
  operationType: P2POperationType; // 'currency_exchange' | 'loan'
  direction?: P2PDirection; // 'receivable' (Me deben) | 'payable' (Yo debo entregar en otra fecha)
  concept?: string;
  // Si direction === 'receivable': ya pagué mi parte antes (no resta de mi Wallet Origen hoy)
  // Si direction === 'payable': ya recibí el dinero antes (no vuelve a sumar a mi Wallet Destino hoy)
  alreadyPaidExternally?: boolean;
  deliveredAmount: number;
  deliveredCurrency: CurrencyCode;
  sourceWalletId: string;
  expectedAmount: number;
  expectedCurrency: CurrencyCode;
  destinationWalletId: string;
  agreedRate?: number | null;
  rateDescription?: string;
  operationDate: string; // YYYY-MM-DD
  estimatedSettlementDate?: string | null;
  notes?: string;
  // Tasas de referencia para cálculo homogéneo en USD
  deliveredRateUsed?: number | null;
  expectedRateUsed?: number | null;
  // Comisión bancaria opcional cuando se entrega en Bolívares (VES)
  hasBankFee?: boolean;
  bankFeeType?: 'none' | 'pago_movil' | 'transferencia' | 'custom';
  bankFeeAmount?: number;
  categories?: Category[];
}

export interface SettleP2POperationInput {
  settledAt: string; // YYYY-MM-DD
  settledWalletId?: string; // Billetera donde se recibió (receivable) o de donde se entregó (payable)
  settledAmount?: number; // Monto efectivamente recibido o entregado
  settledRateUsed?: number | null; // Si es en Bs y varió la tasa
  notes?: string;
  // Comisión bancaria opcional si al liquidar una operación 'payable' se entrega en Bolívares (VES)
  hasBankFee?: boolean;
  bankFeeType?: 'none' | 'pago_movil' | 'transferencia' | 'custom';
  bankFeeAmount?: number;
}

export interface ContactP2PGroup {
  contactName: string;
  operations: P2POperation[];
  inTransitCount: number;
  receivableInTransitCount: number;
  payableInTransitCount: number;
  settledCount: number;
  totalInTransitUsd: number; // Lo que me deben en USD
  totalPayableInTransitUsd: number; // Lo que yo debo entregar en USD
  inTransitBreakdown: {
    USD: number;
    VES: number;
    USDT: number;
  };
  payableBreakdown: {
    USD: number;
    VES: number;
    USDT: number;
  };
  hasOverdue: boolean;
  lastDate: string;
}

export interface P2PSummaryData {
  totalInTransitUsd: number; // Total que ME DEBEN (Por Cobrar)
  totalPayableInTransitUsd: number; // Total que YO DEBO ENTREGAR (Por Entregar)
  totalDeliveredInTransitUsd: number;
  totalSettledUsd: number;
  inTransitCount: number;
  receivableInTransitCount: number;
  payableInTransitCount: number;
  settledCount: number;
  activeContactsCount: number;
  breakdownInTransit: {
    USD: number;
    VES: number;
    USDT: number;
  };
  breakdownPayableInTransit: {
    USD: number;
    VES: number;
    USDT: number;
  };
  contactGroups: ContactP2PGroup[];
  recentOperations: P2POperation[];
}

/**
 * Registra una nueva operación P2P o Préstamo aplicando la estricta protección de saldos.
 * Soporta dos sentidos:
 * - 'receivable' (Por Cobrar / Me deben): Yo entregué o pagué antes, y espero recibir en otra fecha.
 * - 'payable' (Por Entregar / Yo debo): Ya recibí el dinero (hoy o antes), y yo debo entregar las divisas/efectivo en otra fecha.
 */
export function crearOperacionP2P(
  input: CreateP2POperationInput,
  officialRate: number | null
): {
  operation: P2POperation;
  transactionsToCreate: Transaction[];
} {
  const nowIso = new Date().toISOString();
  const opId = `p2p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const direction: P2PDirection =
    input.direction === 'payable' ? 'payable' : 'receivable';
  const isAlreadyPaid = Boolean(input.alreadyPaidExternally);

  const delAmount = Math.max(0, Number(input.deliveredAmount) || 0);
  const expAmount = Math.max(0, Number(input.expectedAmount) || 0);

  // Equivalentes en USD para homogeneidad contable
  const delRate =
    input.deliveredCurrency === 'VES'
      ? input.deliveredRateUsed && input.deliveredRateUsed > 0
        ? input.deliveredRateUsed
        : officialRate
      : null;

  const expRate =
    input.expectedCurrency === 'VES'
      ? input.expectedRateUsed && input.expectedRateUsed > 0
        ? input.expectedRateUsed
        : officialRate
      : null;

  const deliveredAmountUsd = Number(
    calcularEquivalenteUsd(delAmount, input.deliveredCurrency, delRate).toFixed(2)
  );
  const expectedAmountUsd = Number(
    calcularEquivalenteUsd(expAmount, input.expectedCurrency, expRate).toFixed(2)
  );

  const isExchange = input.operationType === 'currency_exchange';
  const typeLabel = isExchange ? 'Cambio P2P' : 'Préstamo';
  const cleanContact = input.contactName.trim();
  const conceptText = input.concept?.trim()
    ? input.concept.trim()
    : isExchange
      ? direction === 'payable'
        ? `Venta ${input.deliveredCurrency} por ${input.expectedCurrency} (Por entregar)`
        : `Cambio ${input.deliveredCurrency} por ${input.expectedCurrency}`
      : direction === 'payable'
        ? `Compromiso por entregar a ${cleanContact}`
        : `Préstamo a ${cleanContact}`;

  const transactionsToCreate: Transaction[] = [];
  let outflowTxnId = '';
  let inflowTxnId = '';
  let feeTxnId = '';
  let validFeeAmount = 0;
  let validFeeAmountUsd = 0;
  const resolvedFeeType = input.bankFeeType || 'none';

  if (direction === 'receivable') {
    // =========================================================================
    // MODO 1: ME DEBEN (POR COBRAR)
    // Ej: Compré $20, pasé los Bs (hoy o antes) y me darán el efectivo luego.
    // =========================================================================
    outflowTxnId = isAlreadyPaid ? '' : `txn-out-${opId}`;
    inflowTxnId = `txn-in-${opId}`;

    // Evaluar comisión bancaria opcional cuando se entrega en Bolívares hoy
    if (
      !isAlreadyPaid &&
      delAmount > 0 &&
      input.deliveredCurrency === 'VES' &&
      input.hasBankFee &&
      resolvedFeeType !== 'none' &&
      typeof input.bankFeeAmount === 'number' &&
      Number.isFinite(input.bankFeeAmount) &&
      input.bankFeeAmount > 0
    ) {
      validFeeAmount = Number(input.bankFeeAmount.toFixed(2));
      validFeeAmountUsd = Number(
        calcularEquivalenteUsd(validFeeAmount, 'VES', delRate).toFixed(4)
      );
      feeTxnId = `txn-fee-${opId}`;
    }

    // 1. TRANSACCIÓN DE SALIDA (SOLO SI NO FUE PAGADO PREVIAMENTE FUERA DEL BALANCE ACTUAL)
    if (!isAlreadyPaid && delAmount > 0) {
      const outflowTxn: Transaction = {
        id: outflowTxnId,
        date: input.operationDate,
        type: 'expense',
        status: 'completed', // RESTA INMEDIATA DEL SALDO REAL
        walletId: input.sourceWalletId,
        description: `[${typeLabel} · Salida] ${conceptText} (${cleanContact})`,
        categoryId: 'cat_exp_other',
        amount: delAmount,
        currency: input.deliveredCurrency,
        exchangeRate: delRate,
        amountUsd: deliveredAmountUsd,
        exchangeRateSource: delRate ? 'manual' : 'none',
        paymentMethod: isExchange ? 'P2P Exchange' : 'Préstamo',
        expenseType: 'variable',
        isRecurring: false,
        isInterbankTransfer: validFeeAmount > 0 ? true : undefined,
        interbankFeeType:
          validFeeAmount > 0
            ? resolvedFeeType === 'transferencia'
              ? 'transferencia'
              : 'pago_movil'
            : undefined,
        interbankFeeAmount: validFeeAmount > 0 ? validFeeAmount : undefined,
        interbankFeeTxnId: feeTxnId || undefined,
        notes: `Entrega de fondos a ${cleanContact}. Esperando retorno de ${expAmount} ${input.expectedCurrency}.${validFeeAmount > 0 ? ` (+ Comisión bancaria: ${validFeeAmount} Bs)` : ''}${input.notes ? ` Nota: ${input.notes}` : ''}`,
        createdAt: nowIso,
        processedAt: nowIso,
      };
      transactionsToCreate.push(outflowTxn);

      // 1b. TRANSACCIÓN DE COMISIÓN BANCARIA SEPARADA (SI APLICA)
      if (validFeeAmount > 0 && feeTxnId) {
        const feeCategoryId = obtenerIdCategoriaComisionBancaria(
          input.categories || []
        );
        const feeTypeLabel =
          resolvedFeeType === 'pago_movil'
            ? 'Pago Móvil'
            : resolvedFeeType === 'transferencia'
              ? 'Transferencia'
              : 'Bancaria';

        const feeTxn: Transaction = {
          id: feeTxnId,
          date: input.operationDate,
          type: 'expense',
          status: 'completed',
          walletId: input.sourceWalletId,
          parentTransactionId: outflowTxnId,
          description: `Comisión ${feeTypeLabel}: [${typeLabel}] ${conceptText} (${cleanContact})`,
          categoryId: feeCategoryId,
          amount: validFeeAmount,
          currency: 'VES',
          exchangeRate: delRate,
          amountUsd: validFeeAmountUsd,
          exchangeRateSource: delRate ? 'manual' : 'none',
          paymentMethod:
            resolvedFeeType === 'transferencia' ? 'Transferencia' : 'Pago Móvil',
          expenseType: 'variable',
          isRecurring: false,
          notes: `Comisión bancaria descontada al pagar operación P2P a ${cleanContact}.`,
          createdAt: nowIso,
          processedAt: nowIso,
        };
        transactionsToCreate.push(feeTxn);
      }
    }

    // 2. TRANSACCIÓN DE ENTRADA PENDIENTE (CUENTA POR COBRAR -> AFECTA SOLO SALDO PROYECTADO)
    const inflowTxn: Transaction = {
      id: inflowTxnId,
      date: input.estimatedSettlementDate || input.operationDate,
      type: 'income',
      status: 'pending', // PROTECCIÓN CONTABLE: NO SUMA AL SALDO REAL HASTA LIQUIDAR
      walletId: input.destinationWalletId,
      description: `[${typeLabel} · Por Cobrar] Retorno de ${cleanContact}`,
      categoryId: 'cat_inc_other',
      amount: expAmount,
      currency: input.expectedCurrency,
      exchangeRate: expRate,
      amountUsd: expectedAmountUsd,
      exchangeRateSource: expRate ? 'manual' : 'none',
      source: cleanContact,
      paymentMethod: isExchange ? 'P2P Exchange' : 'Préstamo',
      isRecurring: false,
      notes: `${isAlreadyPaid ? '[Pagado previamente · Sin descuento de saldo actual] ' : ''}Cuenta por cobrar en tránsito pactada con ${cleanContact}.${input.rateDescription ? ` Tasa: ${input.rateDescription}.` : ''}`,
      createdAt: nowIso,
      processedAt: nowIso,
    };
    transactionsToCreate.push(inflowTxn);
  } else {
    // =========================================================================
    // MODO 2: YO DEBO ENTREGAR (POR ENTREGAR / INVERSO)
    // Ej: Vendí $20, ya me pasaron los Bs (antes o hoy) y yo debo entregar los $20 en otra fecha.
    // =========================================================================
    inflowTxnId = isAlreadyPaid ? '' : `txn-in-${opId}`;
    outflowTxnId = `txn-out-${opId}`;

    // 1. TRANSACCIÓN DE ENTRADA (SOLO SI LO RECIBIÓ HOY Y DESEA SUMARLO A SU WALLET)
    if (!isAlreadyPaid && expAmount > 0) {
      const inflowTxn: Transaction = {
        id: inflowTxnId,
        date: input.operationDate,
        type: 'income',
        status: 'completed', // SUMA INMEDIATA AL SALDO REAL DE LA WALLET RECEPTORA
        walletId: input.destinationWalletId,
        description: `[${typeLabel} · Recibido] ${conceptText} (${cleanContact})`,
        categoryId: 'cat_inc_other',
        amount: expAmount,
        currency: input.expectedCurrency,
        exchangeRate: expRate,
        amountUsd: expectedAmountUsd,
        exchangeRateSource: expRate ? 'manual' : 'none',
        source: cleanContact,
        paymentMethod: isExchange ? 'P2P Exchange' : 'Préstamo',
        isRecurring: false,
        notes: `Fondos recibidos de ${cleanContact}. Queda pendiente entregar ${delAmount} ${input.deliveredCurrency}.${input.notes ? ` Nota: ${input.notes}` : ''}`,
        createdAt: nowIso,
        processedAt: nowIso,
      };
      transactionsToCreate.push(inflowTxn);
    }

    // 2. TRANSACCIÓN DE SALIDA PENDIENTE (COMPROMISO POR ENTREGAR -> RESTA SOLO AL SALDO PROYECTADO HASTA ENTREGAR)
    const outflowTxn: Transaction = {
      id: outflowTxnId,
      date: input.estimatedSettlementDate || input.operationDate,
      type: 'expense',
      status: 'pending', // PROTECCIÓN CONTABLE: RESTA AL SALDO PROYECTADO HASTA QUE ENTREGUES EL EFECTIVO/DIVISAS
      walletId: input.sourceWalletId,
      description: `[${typeLabel} · Por Entregar] Debo entregar a ${cleanContact}`,
      categoryId: 'cat_exp_other',
      amount: delAmount,
      currency: input.deliveredCurrency,
      exchangeRate: delRate,
      amountUsd: deliveredAmountUsd,
      exchangeRateSource: delRate ? 'manual' : 'none',
      paymentMethod: isExchange ? 'P2P Exchange' : 'Préstamo',
      expenseType: 'variable',
      isRecurring: false,
      notes: `${isAlreadyPaid ? '[Dinero recibido previamente · Sin duplicar ingreso actual] ' : ''}Compromiso pendiente de entregar a ${cleanContact}.${input.rateDescription ? ` Tasa: ${input.rateDescription}.` : ''}${input.notes ? ` Nota: ${input.notes}` : ''}`,
      createdAt: nowIso,
      processedAt: nowIso,
    };
    transactionsToCreate.push(outflowTxn);
  }

  const operation: P2POperation = {
    id: opId,
    contactName: cleanContact,
    operationType: input.operationType,
    direction,
    concept: conceptText,
    alreadyPaidExternally: isAlreadyPaid,
    deliveredAmount: delAmount,
    deliveredCurrency: input.deliveredCurrency,
    deliveredAmountUsd,
    sourceWalletId:
      direction === 'receivable' && isAlreadyPaid ? '' : input.sourceWalletId,
    expectedAmount: expAmount,
    expectedCurrency: input.expectedCurrency,
    expectedAmountUsd,
    destinationWalletId:
      direction === 'payable' && isAlreadyPaid ? '' : input.destinationWalletId,
    agreedRate: input.agreedRate ?? null,
    rateDescription: input.rateDescription,
    operationDate: input.operationDate,
    estimatedSettlementDate: input.estimatedSettlementDate || null,
    status: 'in_transit',
    settledAt: null,
    settledWalletId: null,
    settledAmount: null,
    hasBankFee: validFeeAmount > 0 ? true : undefined,
    bankFeeType: validFeeAmount > 0 ? resolvedFeeType : undefined,
    bankFeeAmount: validFeeAmount > 0 ? validFeeAmount : undefined,
    bankFeeAmountUsd: validFeeAmount > 0 ? validFeeAmountUsd : undefined,
    outflowTransactionId: outflowTxnId,
    inflowTransactionId: inflowTxnId,
    feeTransactionId: feeTxnId || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: nowIso,
  };

  return {
    operation,
    transactionsToCreate,
  };
}

/**
 * Liquida la operación P2P:
 * - Si direction === 'receivable': Transfiere el ingreso vinculado de 'pending' a 'completed' en la Billetera Destino (suma al Saldo Real).
 * - Si direction === 'payable': Transfiere el egreso vinculado de 'pending' a 'completed' en la Billetera Origen (resta del Saldo Real cuando entregas los $).
 */
export function liquidarOperacionP2P(
  prevData: AppDataSchema,
  operationId: string,
  settleInput: SettleP2POperationInput,
  officialRate: number | null
): AppDataSchema {
  const operations = prevData.p2pOperations || [];
  const targetOp = operations.find((op) => op.id === operationId);
  if (!targetOp || targetOp.status === 'settled') return prevData;

  const isPayable = targetOp.direction === 'payable';

  if (isPayable) {
    const settledWalletId =
      settleInput.settledWalletId || targetOp.sourceWalletId;
    const settledAmount =
      typeof settleInput.settledAmount === 'number' &&
      settleInput.settledAmount > 0
        ? settleInput.settledAmount
        : targetOp.deliveredAmount;

    const rateUsed =
      targetOp.deliveredCurrency === 'VES'
        ? settleInput.settledRateUsed && settleInput.settledRateUsed > 0
          ? settleInput.settledRateUsed
          : targetOp.agreedRate || officialRate
        : null;

    const settledAmountUsd = Number(
      calcularEquivalenteUsd(
        settledAmount,
        targetOp.deliveredCurrency,
        rateUsed
      ).toFixed(2)
    );

    let settleFeeAmount = 0;
    let settleFeeAmountUsd = 0;
    let settleFeeTxn: Transaction | null = null;
    const settleFeeType = settleInput.bankFeeType || 'none';

    if (
      targetOp.deliveredCurrency === 'VES' &&
      settleInput.hasBankFee &&
      settleFeeType !== 'none' &&
      typeof settleInput.bankFeeAmount === 'number' &&
      Number.isFinite(settleInput.bankFeeAmount) &&
      settleInput.bankFeeAmount > 0
    ) {
      settleFeeAmount = Number(settleInput.bankFeeAmount.toFixed(2));
      settleFeeAmountUsd = Number(
        calcularEquivalenteUsd(settleFeeAmount, 'VES', rateUsed).toFixed(4)
      );
      const feeCategoryId = obtenerIdCategoriaComisionBancaria(
        prevData.categories || []
      );
      const feeTypeLabel =
        settleFeeType === 'pago_movil'
          ? 'Pago Móvil'
          : settleFeeType === 'transferencia'
            ? 'Transferencia'
            : 'Bancaria';
      const nowIso = new Date().toISOString();
      settleFeeTxn = {
        id: `txn-fee-${targetOp.id}`,
        date: settleInput.settledAt,
        type: 'expense',
        status: 'completed',
        walletId: settledWalletId,
        parentTransactionId: targetOp.outflowTransactionId,
        description: `Comisión ${feeTypeLabel}: Entrega P2P a ${targetOp.contactName}`,
        categoryId: feeCategoryId,
        amount: settleFeeAmount,
        currency: 'VES',
        exchangeRate: rateUsed,
        amountUsd: settleFeeAmountUsd,
        exchangeRateSource: rateUsed ? 'manual' : 'none',
        paymentMethod:
          settleFeeType === 'transferencia' ? 'Transferencia' : 'Pago Móvil',
        expenseType: 'variable',
        isRecurring: false,
        notes: `Comisión bancaria descontada al entregar Bolívares a ${targetOp.contactName}.`,
        createdAt: nowIso,
        processedAt: nowIso,
      };
    }

    const updatedOperations = operations.map((op) => {
      if (op.id !== operationId) return op;
      return {
        ...op,
        status: 'settled' as const,
        settledAt: settleInput.settledAt,
        settledWalletId,
        settledAmount,
        deliveredAmountUsd: settledAmountUsd,
        hasBankFee: settleFeeAmount > 0 ? true : op.hasBankFee,
        bankFeeType: settleFeeAmount > 0 ? settleFeeType : op.bankFeeType,
        bankFeeAmount: settleFeeAmount > 0 ? settleFeeAmount : op.bankFeeAmount,
        bankFeeAmountUsd:
          settleFeeAmount > 0 ? settleFeeAmountUsd : op.bankFeeAmountUsd,
        feeTransactionId: settleFeeTxn ? settleFeeTxn.id : op.feeTransactionId,
        notes: settleInput.notes
          ? `${op.notes ? `${op.notes} · ` : ''}Entrega completada: ${settleInput.notes}`
          : op.notes,
      };
    });

    const nowIsoSettle = new Date().toISOString();
    let updatedTransactions = prevData.transactions.map((txn) => {
      if (txn.id !== targetOp.outflowTransactionId) return txn;
      return {
        ...txn,
        date: settleInput.settledAt,
        processedAt: nowIsoSettle,
        status: 'completed' as const, // AHORA SÍ RESTA DEL SALDO REAL AL ENTREGAR
        walletId: settledWalletId,
        amount: settledAmount,
        amountUsd: settledAmountUsd,
        exchangeRate: rateUsed,
        isInterbankTransfer: settleFeeAmount > 0 ? true : txn.isInterbankTransfer,
        interbankFeeType:
          settleFeeAmount > 0
            ? settleFeeType === 'transferencia'
              ? 'transferencia'
              : 'pago_movil'
            : txn.interbankFeeType,
        interbankFeeAmount:
          settleFeeAmount > 0 ? settleFeeAmount : txn.interbankFeeAmount,
        interbankFeeTxnId: settleFeeTxn ? settleFeeTxn.id : txn.interbankFeeTxnId,
        notes: `[Entregado el ${settleInput.settledAt}] Entregado a ${targetOp.contactName}.${settleFeeAmount > 0 ? ` (+ Comisión: ${settleFeeAmount} Bs)` : ''}${settleInput.notes ? ` Detalle: ${settleInput.notes}` : ''}`,
      };
    });

    if (settleFeeTxn) {
      updatedTransactions = [
        settleFeeTxn,
        ...updatedTransactions.filter((t) => t.id !== settleFeeTxn!.id),
      ];
    }

    return {
      ...prevData,
      p2pOperations: updatedOperations,
      transactions: updatedTransactions,
    };
  }

  // Modo clásico: 'receivable' (Me debían y ya recibí)
  const settledWalletId =
    settleInput.settledWalletId || targetOp.destinationWalletId;
  const settledAmount =
    typeof settleInput.settledAmount === 'number' &&
    settleInput.settledAmount > 0
      ? settleInput.settledAmount
      : targetOp.expectedAmount;

  const rateUsed =
    targetOp.expectedCurrency === 'VES'
      ? settleInput.settledRateUsed && settleInput.settledRateUsed > 0
        ? settleInput.settledRateUsed
        : officialRate
      : null;

  const settledAmountUsd = Number(
    calcularEquivalenteUsd(
      settledAmount,
      targetOp.expectedCurrency,
      rateUsed
    ).toFixed(2)
  );

  const updatedOperations = operations.map((op) => {
    if (op.id !== operationId) return op;
    return {
      ...op,
      status: 'settled' as const,
      settledAt: settleInput.settledAt,
      settledWalletId,
      settledAmount,
      expectedAmountUsd: settledAmountUsd,
      notes: settleInput.notes
        ? `${op.notes ? `${op.notes} · ` : ''}Liquidación: ${settleInput.notes}`
        : op.notes,
    };
  });

  // Actualizar la transacción vinculada de ingreso a 'completed' para impactar Saldo Real
  const nowIsoRec = new Date().toISOString();
  const updatedTransactions = prevData.transactions.map((txn) => {
    if (txn.id !== targetOp.inflowTransactionId) return txn;
    return {
      ...txn,
      date: settleInput.settledAt,
      processedAt: nowIsoRec,
      status: 'completed' as const, // PASA A SALDO REAL
      walletId: settledWalletId,
      amount: settledAmount,
      amountUsd: settledAmountUsd,
      exchangeRate: rateUsed,
      notes: `[Liquidado el ${settleInput.settledAt}] Recibido de ${targetOp.contactName}.${settleInput.notes ? ` Detalle: ${settleInput.notes}` : ''}`,
    };
  });

  return {
    ...prevData,
    p2pOperations: updatedOperations,
    transactions: updatedTransactions,
  };
}

/**
 * Revierte una operación liquidada de vuelta a estado 'En Tránsito'.
 * La transacción vinculada vuelve a 'pending' (abandona el Saldo Real).
 */
export function revertirOperacionP2P(
  prevData: AppDataSchema,
  operationId: string
): AppDataSchema {
  const operations = prevData.p2pOperations || [];
  const targetOp = operations.find((op) => op.id === operationId);
  if (!targetOp || targetOp.status !== 'settled') return prevData;

  const isPayable = targetOp.direction === 'payable';
  const targetTxnId = isPayable
    ? targetOp.outflowTransactionId
    : targetOp.inflowTransactionId;

  const updatedOperations = operations.map((op) => {
    if (op.id !== operationId) return op;
    return {
      ...op,
      status: 'in_transit' as const,
      settledAt: null,
      settledWalletId: null,
      settledAmount: null,
      ...(isPayable
        ? {
            hasBankFee: undefined,
            bankFeeType: undefined,
            bankFeeAmount: undefined,
            bankFeeAmountUsd: undefined,
            feeTransactionId: undefined,
          }
        : {}),
    };
  });

  let updatedTransactions = prevData.transactions.map((txn) => {
    if (txn.id !== targetTxnId) return txn;
    return {
      ...txn,
      status: 'pending' as const, // REGRESA AL SALDO PROYECTADO
      date: targetOp.estimatedSettlementDate || targetOp.operationDate,
    };
  });

  // Si era 'payable' y al liquidar había creado comisión, retirarla al revertir
  if (isPayable && targetOp.feeTransactionId) {
    updatedTransactions = updatedTransactions.filter(
      (txn) => txn.id !== targetOp.feeTransactionId
    );
  }

  return {
    ...prevData,
    p2pOperations: updatedOperations,
    transactions: updatedTransactions,
  };
}

/**
 * Elimina una operación P2P y sus transacciones contables vinculadas
 * para dejar los balances exactamente como estaban antes.
 */
export function eliminarOperacionP2P(
  prevData: AppDataSchema,
  operationId: string
): AppDataSchema {
  const operations = prevData.p2pOperations || [];
  const targetOp = operations.find((op) => op.id === operationId);
  if (!targetOp) return prevData;

  const idsToRemove = new Set(
    [
      targetOp.outflowTransactionId,
      targetOp.inflowTransactionId,
      targetOp.feeTransactionId,
    ].filter(Boolean)
  );

  return {
    ...prevData,
    p2pOperations: operations.filter((op) => op.id !== operationId),
    transactions: prevData.transactions.filter(
      (txn) => !idsToRemove.has(txn.id)
    ),
  };
}

export interface UpdateP2POperationInput extends CreateP2POperationInput {
  settledAt?: string | null;
}

/**
 * Actualiza una operación P2P existente (tanto pendiente como liquidada)
 * y reconstruye/sincroniza sus transacciones vinculadas para que las fechas,
 * montos, billeteras, tasas y comisiones queden reflejadas con exactitud.
 */
export function actualizarOperacionP2P(
  prevData: AppDataSchema,
  operationId: string,
  input: UpdateP2POperationInput,
  officialRate: number | null
): AppDataSchema {
  const operations = prevData.p2pOperations || [];
  const targetOp = operations.find((op) => op.id === operationId);
  if (!targetOp) return prevData;

  const wasSettled = targetOp.status === 'settled';
  const resolvedSettledAt =
    input.settledAt || targetOp.settledAt || input.operationDate;

  // 1. Retirar transacciones anteriores vinculadas a esta operación
  const oldTxnIds = new Set(
    [
      targetOp.outflowTransactionId,
      targetOp.inflowTransactionId,
      targetOp.feeTransactionId,
    ].filter(Boolean)
  );

  const remainingTransactions = prevData.transactions.filter(
    (txn) => !oldTxnIds.has(txn.id)
  );

  // 2. Generar la operación actualizada y sus transacciones base
  const { operation: rawNewOp, transactionsToCreate } = crearOperacionP2P(
    {
      ...input,
      categories: input.categories || prevData.categories,
    },
    officialRate
  );

  // Conservar el ID original y fecha de creación original de la operación
  const preservedOp: P2POperation = {
    ...rawNewOp,
    id: targetOp.id,
    createdAt: targetOp.createdAt,
  };

  let nextState: AppDataSchema = {
    ...prevData,
    p2pOperations: operations.map((op) =>
      op.id === operationId ? preservedOp : op
    ),
    transactions: [...transactionsToCreate, ...remainingTransactions],
  };

  // 3. Si la operación ya estaba liquidada, reaplicar el estado liquidado con las nuevas fechas y montos
  if (wasSettled) {
    const isPayable = (input.direction || 'receivable') === 'payable';
    nextState = liquidarOperacionP2P(
      nextState,
      targetOp.id,
      {
        settledAt: resolvedSettledAt,
        settledWalletId: isPayable
          ? input.sourceWalletId || targetOp.settledWalletId || ''
          : input.destinationWalletId || targetOp.settledWalletId || '',
        settledAmount: isPayable ? input.deliveredAmount : input.expectedAmount,
        settledRateUsed: input.agreedRate || officialRate,
        hasBankFee: input.hasBankFee,
        bankFeeType: input.bankFeeType,
        bankFeeAmount: input.bankFeeAmount,
      },
      officialRate
    );
  }

  return nextState;
}


/**
 * Calcula el resumen analítico y la agrupación por contacto para la vista de Deudores / Exchange.
 */
export function calcularResumenP2P(
  operations: P2POperation[] = []
): P2PSummaryData {
  const todayStr = obtenerFechaLocalIso();

  let totalInTransitUsd = 0;
  let totalPayableInTransitUsd = 0;
  let totalDeliveredInTransitUsd = 0;
  let totalSettledUsd = 0;
  let inTransitCount = 0;
  let receivableInTransitCount = 0;
  let payableInTransitCount = 0;
  let settledCount = 0;

  const breakdownInTransit = {
    USD: 0,
    VES: 0,
    USDT: 0,
  };

  const breakdownPayableInTransit = {
    USD: 0,
    VES: 0,
    USDT: 0,
  };

  const groupMap = new Map<string, ContactP2PGroup>();

  for (const op of operations) {
    const contactKey = op.contactName.trim();
    if (!groupMap.has(contactKey)) {
      groupMap.set(contactKey, {
        contactName: contactKey,
        operations: [],
        inTransitCount: 0,
        receivableInTransitCount: 0,
        payableInTransitCount: 0,
        settledCount: 0,
        totalInTransitUsd: 0,
        totalPayableInTransitUsd: 0,
        inTransitBreakdown: { USD: 0, VES: 0, USDT: 0 },
        payableBreakdown: { USD: 0, VES: 0, USDT: 0 },
        hasOverdue: false,
        lastDate: op.operationDate,
      });
    }

    const group = groupMap.get(contactKey)!;
    group.operations.push(op);

    if (op.operationDate > group.lastDate) {
      group.lastDate = op.operationDate;
    }

    const isPayable = op.direction === 'payable';

    if (op.status === 'in_transit') {
      inTransitCount += 1;
      group.inTransitCount += 1;

      if (isPayable) {
        payableInTransitCount += 1;
        group.payableInTransitCount += 1;
        totalPayableInTransitUsd += op.deliveredAmountUsd;
        group.totalPayableInTransitUsd += op.deliveredAmountUsd;

        if (op.deliveredCurrency === 'USD') {
          breakdownPayableInTransit.USD += op.deliveredAmount;
          group.payableBreakdown.USD += op.deliveredAmount;
        } else if (op.deliveredCurrency === 'VES') {
          breakdownPayableInTransit.VES += op.deliveredAmount;
          group.payableBreakdown.VES += op.deliveredAmount;
        } else if (op.deliveredCurrency === 'USDT') {
          breakdownPayableInTransit.USDT += op.deliveredAmount;
          group.payableBreakdown.USDT += op.deliveredAmount;
        }
      } else {
        receivableInTransitCount += 1;
        group.receivableInTransitCount += 1;
        totalInTransitUsd += op.expectedAmountUsd;
        totalDeliveredInTransitUsd += op.deliveredAmountUsd;
        group.totalInTransitUsd += op.expectedAmountUsd;

        // Desglose por moneda esperada
        if (op.expectedCurrency === 'USD') {
          breakdownInTransit.USD += op.expectedAmount;
          group.inTransitBreakdown.USD += op.expectedAmount;
        } else if (op.expectedCurrency === 'VES') {
          breakdownInTransit.VES += op.expectedAmount;
          group.inTransitBreakdown.VES += op.expectedAmount;
        } else if (op.expectedCurrency === 'USDT') {
          breakdownInTransit.USDT += op.expectedAmount;
          group.inTransitBreakdown.USDT += op.expectedAmount;
        }
      }

      // Comprobar si está vencida respecto a la fecha estimada
      if (op.estimatedSettlementDate && op.estimatedSettlementDate < todayStr) {
        group.hasOverdue = true;
      }
    } else {
      settledCount += 1;
      group.settledCount += 1;
      totalSettledUsd += isPayable ? op.deliveredAmountUsd : op.expectedAmountUsd;
    }
  }

  // Ordenar grupos por mayor saldo activo (por cobrar + por entregar) primero
  const contactGroups = Array.from(groupMap.values()).sort(
    (a, b) =>
      b.totalInTransitUsd +
      b.totalPayableInTransitUsd -
      (a.totalInTransitUsd + a.totalPayableInTransitUsd)
  );

  // Ordenar operaciones recientes
  const recentOperations = [...operations].sort(
    (a, b) => b.operationDate.localeCompare(a.operationDate)
  );

  const activeContactsCount = contactGroups.filter(
    (g) => g.inTransitCount > 0
  ).length;

  return {
    totalInTransitUsd: Number(totalInTransitUsd.toFixed(2)),
    totalPayableInTransitUsd: Number(totalPayableInTransitUsd.toFixed(2)),
    totalDeliveredInTransitUsd: Number(totalDeliveredInTransitUsd.toFixed(2)),
    totalSettledUsd: Number(totalSettledUsd.toFixed(2)),
    inTransitCount,
    receivableInTransitCount,
    payableInTransitCount,
    settledCount,
    activeContactsCount,
    breakdownInTransit: {
      USD: Number(breakdownInTransit.USD.toFixed(2)),
      VES: Number(breakdownInTransit.VES.toFixed(2)),
      USDT: Number(breakdownInTransit.USDT.toFixed(2)),
    },
    breakdownPayableInTransit: {
      USD: Number(breakdownPayableInTransit.USD.toFixed(2)),
      VES: Number(breakdownPayableInTransit.VES.toFixed(2)),
      USDT: Number(breakdownPayableInTransit.USDT.toFixed(2)),
    },
    contactGroups,
    recentOperations,
  };
}
