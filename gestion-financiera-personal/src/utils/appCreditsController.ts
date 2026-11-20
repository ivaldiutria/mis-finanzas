import {
  AppCredit,
  AppCreditInstallment,
  AppCreditInstallmentPartialPayment,
  AppDataSchema,
  CurrencyCode,
  Debt,
  Transaction,
} from '../types/finance';
import {
  calcularEquivalenteUsd,
  obtenerIdCategoriaComisionBancaria,
} from './calculations';

function redondearMoneda(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// ============================================================================
// MOTOR DE GENERACIÓN DE CUOTAS Y LÓGICA DE SALDOS: CRÉDITOS DE APPS
// (Tipo Ubii App, Avila Pay, Microcréditos por días)
// ============================================================================

export interface CreateAppCreditInput {
  appName: string; // Ej: "Ubii App", "Avila Pay"
  concept?: string;
  categoryId: string;
  requestDate: string; // YYYY-MM-DD (fecha base para sumar los días de cada cuota)
  requestedAmount: number; // Monto solicitado (Capital total, ej. 100)
  currency: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Tasa Bs/USD si currency === 'VES'
  installmentsCount: number; // Cantidad de cuotas (ej. 4)
  frequencyDays: number; // Frecuencia en días (ej. 14 o 15 días)
  feePerInstallment: number; // Comisión fija por cuota (ej. 2)
  alreadyPaidInstallmentNumbers?: number[]; // Cuotas ya pagadas antes de registrar en la app
  depositToWallet?: boolean; // Si el dinero prestado se abona a una cuenta/billetera
  depositDestinationMode?: 'personal_wallet' | 'third_party_direct' | 'none'; // 'personal_wallet' = Mi cuenta | 'third_party_direct' = Pasado directo a Cuenta de Tercero / Amigo (no suma ingreso)
  thirdPartyRecipientName?: string | null; // Nombre del amigo/tercero si se pasó directo desde la app
  depositWalletIsPassThrough?: boolean; // Si la cuenta destino es una Cuenta de Terceros (isPassThroughAccount)
  createReceivableLoanForFriend?: boolean; // Si se desea crear automáticamente un Préstamo por Cobrar a nombre del amigo
  loanAmountMode?: 'principal_only' | 'total_with_fees'; // Si el amigo debe solo el capital ($10) o capital + comisiones de la app
  depositWalletId?: string | null; // Cuenta donde se recibe el préstamo
  depositWalletName?: string;
  depositCurrency?: CurrencyCode; // Moneda en que entra a la cuenta ('VES' a tasa BCV o 'USD')
  depositExchangeRate?: number | null; // Tasa BCV activa usada para convertir los $ a Bs
  depositBankFeePercent?: number | null; // % de comisión que quitan por pasarlo al banco (ej. 0.5)
  depositNetAmountManual?: number | null; // Monto neto final manual que entra a la cuenta (ej. 8817.96)
  customInstallmentAmounts?: Record<number, number>; // Montos personalizados por número de cuota (1..N)
  notes?: string;
}

export interface UpdateAppCreditInstallmentInput {
  appCreditId: string;
  installmentId: string;
  newTotalAmount: number;
  newDueDate?: string;
}

export interface DisburseAppCreditInput {
  appCreditId: string;
  destinationMode?: 'personal_wallet' | 'third_party_direct' | 'none';
  depositDestinationMode?: 'personal_wallet' | 'third_party_direct' | 'none';
  thirdPartyRecipientName?: string | null;
  walletId?: string | null;
  walletIsPassThrough?: boolean;
  depositCurrency: CurrencyCode;
  exchangeRate: number | null;
  bankFeePercent?: number | null; // % comisión al pasar al banco
  netAmountManual?: number | null; // Monto neto exacto que entra a la cuenta (ej. 8817.96)
  depositDate?: string;
}

export interface PayAppCreditInstallmentInput {
  appCreditId: string;
  installmentId: string;
  paidDate: string; // YYYY-MM-DD
  isPartialPayment?: boolean; // true = Abono parcial a la cuota; false = Pagar saldo completo de la cuota
  abonoAmountInCreditCurrency?: number; // Monto que se abona a la cuota en la moneda del crédito (ej. $5.00 de $13.04)
  paymentOriginMode?: 'personal_wallet' | 'third_party_direct' | 'already_paid';
  alreadyPaidExternally?: boolean; // Si el pago o abono se pagó antes sin descontar de billetera
  paidByThirdPartyDirect?: boolean; // Si un amigo/tercero pagó directo a la app sin pasar por mis cuentas personales
  thirdPartyPayerName?: string | null; // Nombre del amigo/tercero que pagó directo a la app
  thirdPartyPassThroughWalletId?: string | null; // Opcional: Cuenta de Terceros (isPassThroughAccount) para reflejar en su historial
  deductFromLinkedLoan?: boolean; // Si desea descontar automáticamente este pago del Préstamo por Cobrar que tiene ese amigo
  linkedLoanIdToDeduct?: string | null; // ID del préstamo (Debt) del amigo a descontar
  walletId?: string | null;
  paymentCurrency: CurrencyCode; // 'USD' | 'VES'
  paymentAmountNominal: number;
  exchangeRate: number | null;
  exchangeRateSource?: 'bcv' | 'manual' | 'none';
  interbankFeeType?: 'none' | 'pago_movil' | 'transferencia';
  interbankFeeAmount?: number;
  notes?: string;
}

export function obtenerEstadoAbonosCuotaCreditoApp(installment: AppCreditInstallment): {
  paidInCreditCurrency: number;
  paidUsd: number;
  remainingInCreditCurrency: number;
  remainingUsd: number;
  partialPayments: AppCreditInstallmentPartialPayment[];
} {
  const partialPayments = installment.partialPayments ?? [];
  if (installment.status === 'paid') {
    return {
      paidInCreditCurrency: installment.totalInstallmentAmount,
      paidUsd: installment.totalInstallmentAmountUsd,
      remainingInCreditCurrency: 0,
      remainingUsd: 0,
      partialPayments,
    };
  }

  const rawPaidCreditCur = redondearMoneda(
    partialPayments.reduce((sum, p) => sum + (Number(p.amountInCreditCurrency) || 0), 0)
  );
  const rawPaidUsd = redondearMoneda(
    partialPayments.reduce((sum, p) => sum + (Number(p.amountUsd) || 0), 0)
  );

  const paidInCreditCurrency = Math.min(installment.totalInstallmentAmount, rawPaidCreditCur);
  const paidUsd = Math.min(installment.totalInstallmentAmountUsd, rawPaidUsd);

  const remainingInCreditCurrency = redondearMoneda(
    Math.max(0, installment.totalInstallmentAmount - paidInCreditCurrency)
  );
  const remainingUsd = redondearMoneda(
    Math.max(0, installment.totalInstallmentAmountUsd - paidUsd)
  );

  return {
    paidInCreditCurrency,
    paidUsd,
    remainingInCreditCurrency,
    remainingUsd,
    partialPayments,
  };
}

/**
 * Suma una cantidad exacta de días calendario a una fecha YYYY-MM-DD
 * evitando desfases de zona horaria.
 */
export function sumarDiasAFecha(fechaBaseStr: string, dias: number): string {
  const parts = fechaBaseStr.split('-').map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;

  const dateObj = new Date(year, month, day, 12, 0, 0);
  dateObj.setDate(dateObj.getDate() + dias);

  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Motor de Generación de Cuotas:
 * Por ejemplo, si se solicitan $100 en 4 cuotas cada 15 días con $2 de comisión por cuota:
 * - Capital por cuota = $100 / 4 = $25.00
 * - Comisión por cuota = $2.00
 * - Total por cuota = $25.00 + $2.00 = $27.00
 * - Fechas de vencimiento = fechaBase + (15 * n) días (15, 30, 35, 60 días).
 * Ajusta cualquier centavo residual de división de capital en la última cuota.
 */
export function generarCronogramaCreditoApp(params: {
  requestedAmount: number;
  currency: CurrencyCode;
  exchangeRate: number | null;
  installmentsCount: number;
  frequencyDays: number;
  feePerInstallment: number;
  requestDate: string;
  alreadyPaidInstallmentNumbers?: number[];
  customInstallmentAmounts?: Record<number, number>;
  idPrefix?: string;
}): AppCreditInstallment[] {
  const {
    requestedAmount,
    currency,
    exchangeRate,
    installmentsCount,
    frequencyDays,
    feePerInstallment,
    requestDate,
    alreadyPaidInstallmentNumbers = [],
    customInstallmentAmounts,
    idPrefix = `appcred_${Date.now()}`,
  } = params;

  const count = Math.max(1, Math.min(48, Math.round(installmentsCount)));
  const stepDays = Math.max(1, Math.min(365, Math.round(frequencyDays)));
  const capitalTotal = redondearMoneda(Math.max(0, requestedAmount));
  const feeFixed = redondearMoneda(Math.max(0, feePerInstallment));

  const baseCapitalPerQuota = redondearMoneda(capitalTotal / count);
  let accumulatedCapital = 0;

  const paidSet = new Set(alreadyPaidInstallmentNumbers);
  const installments: AppCreditInstallment[] = [];

  for (let i = 1; i <= count; i++) {
    const isLast = i === count;
    const autoPrincipalAmount = isLast
      ? redondearMoneda(Math.max(0, capitalTotal - accumulatedCapital))
      : baseCapitalPerQuota;

    accumulatedCapital = redondearMoneda(accumulatedCapital + autoPrincipalAmount);

    const customTotal = customInstallmentAmounts?.[i];
    const hasCustomTotal =
      typeof customTotal === 'number' &&
      Number.isFinite(customTotal) &&
      customTotal > 0;

    const totalInstallmentAmount = hasCustomTotal
      ? redondearMoneda(customTotal)
      : redondearMoneda(autoPrincipalAmount + feeFixed);

    const feeAmount = hasCustomTotal
      ? redondearMoneda(Math.min(feeFixed, totalInstallmentAmount))
      : feeFixed;

    const principalAmount = hasCustomTotal
      ? redondearMoneda(Math.max(0, totalInstallmentAmount - feeAmount))
      : autoPrincipalAmount;

    const principalAmountUsd =
      currency === 'USD'
        ? principalAmount
        : calcularEquivalenteUsd(principalAmount, 'VES', exchangeRate);

    const feeAmountUsd =
      currency === 'USD'
        ? feeAmount
        : calcularEquivalenteUsd(feeAmount, 'VES', exchangeRate);

    const totalInstallmentAmountUsd =
      currency === 'USD'
        ? totalInstallmentAmount
        : redondearMoneda(principalAmountUsd + feeAmountUsd);

    const dueDate = sumarDiasAFecha(requestDate, i * stepDays);
    const isAlreadyPaid = paidSet.has(i);

    installments.push({
      id: `${idPrefix}_inst_${i}`,
      number: i,
      dueDate,
      principalAmount,
      feeAmount,
      totalInstallmentAmount,
      principalAmountUsd,
      feeAmountUsd,
      totalInstallmentAmountUsd,
      status: isAlreadyPaid ? 'paid' : 'pending',
      alreadyPaidExternally: isAlreadyPaid,
      linkedTransactionId: isAlreadyPaid ? '' : `${idPrefix}_txn_inst_${i}`,
      paidAt: isAlreadyPaid ? requestDate : null,
      paidWalletId: null,
      paidCurrency: isAlreadyPaid ? currency : null,
      paidAmountNominal: isAlreadyPaid ? totalInstallmentAmount : null,
      paidExchangeRate: isAlreadyPaid ? exchangeRate : null,
      notes: isAlreadyPaid
        ? 'Cuota marcada como pagada previamente (sin afectar saldo de billeteras)'
        : undefined,
    });
  }

  return installments;
}

/**
 * Crea la entidad AppCredit junto con las transacciones 'pending' para cada cuota pendiente.
 * Si `depositDestinationMode === 'third_party_direct'` (o si la cuenta destino es una Cuenta de Terceros `isPassThroughAccount`),
 * el dinero prestado por la App NO suma ingresos a tus cuentas personales.
 */
export function crearCreditoApp(input: CreateAppCreditInput): {
  appCredit: AppCredit;
  newTransactions: Transaction[];
  newLoan?: Debt;
} {
  const requestedAmount = redondearMoneda(input.requestedAmount);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new Error('El monto solicitado debe ser mayor que cero.');
  }

  const installmentsCount = Math.max(1, Math.min(48, Math.round(input.installmentsCount)));
  const frequencyDays = Math.max(1, Math.min(365, Math.round(input.frequencyDays)));
  const feePerInstallment = redondearMoneda(Math.max(0, input.feePerInstallment));

  if (input.currency === 'VES' && (!input.exchangeRate || input.exchangeRate <= 0)) {
    throw new Error('Debes indicar una tasa de cambio válida para créditos en Bolívares (Bs).');
  }

  const nowTs = Date.now();
  const creditId = `appcred_${nowTs}_${Math.random().toString(36).slice(2, 6)}`;

  const installments = generarCronogramaCreditoApp({
    requestedAmount,
    currency: input.currency,
    exchangeRate: input.currency === 'VES' ? input.exchangeRate : null,
    installmentsCount,
    frequencyDays,
    feePerInstallment,
    requestDate: input.requestDate,
    alreadyPaidInstallmentNumbers: input.alreadyPaidInstallmentNumbers,
    customInstallmentAmounts: input.customInstallmentAmounts,
    idPrefix: creditId,
  });

  const requestedAmountUsd =
    input.currency === 'USD'
      ? requestedAmount
      : calcularEquivalenteUsd(requestedAmount, 'VES', input.exchangeRate);

  const feePerInstallmentUsd =
    input.currency === 'USD'
      ? feePerInstallment
      : calcularEquivalenteUsd(feePerInstallment, 'VES', input.exchangeRate);

  const totalFeeAmount = redondearMoneda(
    installments.reduce((acc, item) => acc + item.feeAmount, 0)
  );
  const totalToPayAmount = redondearMoneda(
    installments.reduce((acc, item) => acc + item.totalInstallmentAmount, 0)
  );
  const totalToPayAmountUsd = redondearMoneda(
    installments.reduce((acc, item) => acc + item.totalInstallmentAmountUsd, 0)
  );

  const newTransactions: Transaction[] = [];

  for (const inst of installments) {
    if (inst.status === 'pending' && inst.linkedTransactionId) {
      newTransactions.push({
        id: inst.linkedTransactionId,
        date: inst.dueDate,
        type: 'expense',
        status: 'pending',
        walletId: undefined,
        description: `[Crédito App · ${input.appName.trim()}] Cuota ${inst.number}/${installmentsCount}${
          input.concept?.trim() ? ` - ${input.concept.trim()}` : ''
        }`,
        categoryId: input.categoryId || 'cat_exp_other',
        amount: inst.totalInstallmentAmount,
        currency: input.currency,
        exchangeRate: input.currency === 'VES' ? input.exchangeRate : null,
        amountUsd: inst.totalInstallmentAmountUsd,
        exchangeRateSource: input.currency === 'VES' ? 'manual' : 'none',
        paymentMethod: `Cuota Pendiente (${input.appName.trim()})`,
        expenseType: 'fixed',
        isRecurring: false,
        notes: `Desglose Cuota #${inst.number}: Capital ${
          input.currency === 'VES' ? 'Bs.' : '$'
        }${inst.principalAmount.toFixed(2)} + Comisión ${
          input.currency === 'VES' ? 'Bs.' : '$'
        }${inst.feeAmount.toFixed(2)} (Cada ${frequencyDays} días)`,
      });
    }
  }

  const allPaid = installments.every((inst) => inst.status === 'paid');

  const destinationMode: 'personal_wallet' | 'third_party_direct' | 'none' =
    input.depositDestinationMode ||
    (input.depositWalletIsPassThrough
      ? 'third_party_direct'
      : input.depositToWallet
        ? 'personal_wallet'
        : 'none');

  const isPassThrough =
    destinationMode === 'third_party_direct' || Boolean(input.depositWalletIsPassThrough);

  let depositTransactionId: string | null = null;
  let depositCurrencyFinal: CurrencyCode | null = null;
  let depositGrossNominalFinal: number | null = null;
  let depositBankFeePercentFinal: number | null = null;
  let depositBankFeeAmountFinal: number | null = null;
  let depositAmountNominalFinal: number | null = null;
  let depositExchangeRateFinal: number | null = null;

  if (
    (destinationMode === 'personal_wallet' || destinationMode === 'third_party_direct') &&
    (input.depositWalletId || destinationMode === 'third_party_direct')
  ) {
    const targetCurrency: CurrencyCode = input.depositCurrency || 'VES';
    const rateToUse =
      input.depositExchangeRate && input.depositExchangeRate > 0
        ? input.depositExchangeRate
        : input.exchangeRate && input.exchangeRate > 0
          ? input.exchangeRate
          : null;

    if (
      destinationMode === 'personal_wallet' &&
      targetCurrency === 'VES' &&
      (!rateToUse || rateToUse <= 0)
    ) {
      throw new Error(
        'Indica una tasa BCV válida para convertir el préstamo a Bolívares en tu cuenta.'
      );
    }

    const grossNominal =
      targetCurrency === 'VES'
        ? input.currency === 'VES'
          ? requestedAmount
          : redondearMoneda(requestedAmountUsd * (rateToUse || 1))
        : requestedAmountUsd;

    const feePct = Math.max(0, Number(input.depositBankFeePercent) || 0);
    const hasManualNet =
      typeof input.depositNetAmountManual === 'number' &&
      Number.isFinite(input.depositNetAmountManual) &&
      input.depositNetAmountManual > 0;

    // Protección contra doble multiplicación: si la cuenta estaba en USD pero el monto manual ingresado
    // supera en más de 10 veces el monto en USD del préstamo (porque fue escrito en Bolívares), no usar ese monto en Bs como USD.
    const safeManualNet =
      hasManualNet &&
      targetCurrency === 'USD' &&
      requestedAmountUsd > 0 &&
      input.depositNetAmountManual! > requestedAmountUsd * 10
        ? input.depositExchangeRate && input.depositExchangeRate > 1
          ? redondearMoneda(input.depositNetAmountManual! / input.depositExchangeRate)
          : redondearMoneda(grossNominal * (1 - feePct / 100))
        : hasManualNet
          ? redondearMoneda(input.depositNetAmountManual!)
          : null;

    const netNominal =
      safeManualNet !== null
        ? safeManualNet
        : redondearMoneda(grossNominal * (1 - feePct / 100));

    const feeAmountNominal = redondearMoneda(Math.max(0, grossNominal - netNominal));
    const effectiveFeePct =
      grossNominal > 0
        ? Math.round(((grossNominal - netNominal) / grossNominal) * 10000) / 100
        : feePct;

    const netAmountUsd =
      targetCurrency === 'USD'
        ? netNominal
        : calcularEquivalenteUsd(netNominal, 'VES', rateToUse);

    depositCurrencyFinal = targetCurrency;
    depositGrossNominalFinal = grossNominal;
    depositBankFeePercentFinal = Math.max(0, effectiveFeePct);
    depositBankFeeAmountFinal = feeAmountNominal;
    depositAmountNominalFinal = netNominal;
    depositExchangeRateFinal = targetCurrency === 'VES' ? rateToUse : null;

    // Si hay una cuenta seleccionada (personal o cuenta de terceros), registramos la transacción:
    // Si es Cuenta de Terceros (isPassThrough), se marca `isPassThroughThirdParty: true` para que NUNCA sume ingreso personal.
    if (input.depositWalletId) {
      depositTransactionId = `${creditId}_txn_deposit`;
      const feeNotePart =
        feeAmountNominal > 0
          ? ` · Bruto: ${targetCurrency === 'VES' ? 'Bs.' : '$'}${grossNominal.toFixed(
              2
            )} - Comisión retiro banco (${depositBankFeePercentFinal}%): ${
              targetCurrency === 'VES' ? 'Bs.' : '$'
            }${feeAmountNominal.toFixed(2)} = Neto recibido: ${
              targetCurrency === 'VES' ? 'Bs.' : '$'
            }${netNominal.toFixed(2)}`
          : '';

      const recipientLabel =
        input.thirdPartyRecipientName?.trim() ||
        input.depositWalletName ||
        'Cuenta de Tercero';

      newTransactions.unshift({
        id: depositTransactionId,
        date: input.requestDate,
        type: 'income',
        status: 'completed',
        walletId: input.depositWalletId,
        isPassThroughThirdParty: isPassThrough,
        description: isPassThrough
          ? `[Préstamo App a Tercero · ${input.appName.trim()}] Pasado directo a ${recipientLabel}${
              input.concept?.trim() ? ` - ${input.concept.trim()}` : ''
            }`
          : `[Préstamo App · ${input.appName.trim()}] Dinero recibido en cuenta${
              input.concept?.trim() ? ` - ${input.concept.trim()}` : ''
            }`,
        categoryId: 'cat_inc_other',
        amount: netNominal,
        currency: targetCurrency,
        exchangeRate: targetCurrency === 'VES' ? rateToUse : null,
        amountUsd: netAmountUsd,
        exchangeRateSource: targetCurrency === 'VES' ? 'bcv' : 'none',
        paymentMethod: input.depositWalletName || input.appName.trim(),
        notes: isPassThrough
          ? `Dinero de ${input.appName.trim()} ($${requestedAmountUsd.toFixed(
              2
            )} USD) enviado directo a cuenta de tercero (${recipientLabel}). No pasó por tus cuentas personales ni suma a tus ingresos.${feeNotePart}`
          : targetCurrency === 'VES' && rateToUse
            ? `Desembolso de crédito ${input.appName.trim()} por $${requestedAmountUsd.toFixed(
                2
              )} USD a tasa BCV (${rateToUse.toFixed(2)} Bs/$)${feeNotePart}`
            : `Desembolso de crédito ${input.appName.trim()} por $${requestedAmountUsd.toFixed(
                2
              )} USD${feeNotePart}`,
      });
    }
  }

  let newLoan: Debt | undefined = undefined;
  let linkedLoanId: string | null = null;

  if (isPassThrough && input.createReceivableLoanForFriend) {
    const friendName =
      input.thirdPartyRecipientName?.trim() ||
      input.depositWalletName ||
      input.concept?.trim() ||
      'Amigo / Tercero';
    const includeFees = input.loanAmountMode === 'total_with_fees';
    const loanAmt = includeFees ? totalToPayAmount : requestedAmount;
    const loanAmtUsd = includeFees ? totalToPayAmountUsd : requestedAmountUsd;
    const lastDueDate =
      installments.length > 0
        ? installments[installments.length - 1].dueDate
        : null;

    linkedLoanId = `loan_appcred_${nowTs}`;
    newLoan = {
      id: linkedLoanId,
      kind: 'receivable',
      creditor: friendName,
      description: `Préstamo vía ${input.appName.trim()}${
        input.concept?.trim() ? ` (${input.concept.trim()})` : ''
      }`,
      totalAmount: loanAmt,
      currency: input.currency,
      exchangeRate: input.currency === 'VES' ? input.exchangeRate : null,
      totalAmountUsd: loanAmtUsd,
      loanDate: input.requestDate,
      dueDate: lastDueDate,
      walletId: undefined,
      initialTransactionId: null, // No salió de mis cuentas personales, salió directo de la App de Crédito
      payments: [],
      notes: `Dinero solicitado en ${input.appName.trim()} y enviado directo a la cuenta de ${friendName} (sin pasar por tus cuentas personales).`,
      status: 'pending',
    };
  }

  const appCredit: AppCredit = {
    id: creditId,
    appName: input.appName.trim(),
    concept: input.concept?.trim() || '',
    categoryId: input.categoryId || 'cat_exp_other',
    requestDate: input.requestDate,
    requestedAmount,
    currency: input.currency,
    exchangeRate: input.currency === 'VES' ? input.exchangeRate : null,
    requestedAmountUsd,
    installmentsCount,
    frequencyDays,
    feePerInstallment,
    feePerInstallmentUsd,
    totalFeeAmount,
    totalToPayAmount,
    totalToPayAmountUsd,
    depositToWallet:
      destinationMode === 'personal_wallet' && Boolean(input.depositWalletId),
    depositDestinationMode: destinationMode,
    thirdPartyRecipientName: isPassThrough
      ? input.thirdPartyRecipientName?.trim() ||
        input.depositWalletName ||
        'Cuenta de Tercero'
      : null,
    linkedLoanId,
    depositWalletId: input.depositWalletId || null,
    depositTransactionId,
    depositCurrency: depositCurrencyFinal,
    depositGrossAmountNominal: depositGrossNominalFinal,
    depositBankFeePercent: depositBankFeePercentFinal,
    depositBankFeeAmountNominal: depositBankFeeAmountFinal,
    depositAmountNominal: depositAmountNominalFinal,
    depositExchangeRate: depositExchangeRateFinal,
    installments,
    status: allPaid ? 'paid' : 'active',
    notes: input.notes?.trim() || '',
    createdAt: new Date().toISOString(),
  };

  return {
    appCredit,
    newTransactions,
    newLoan,
  };
}

/**
 * Permite abonar (o actualizar la cuenta donde se abonó, o marcar que se pasó directo a la cuenta de un tercero/amigo)
 * el dinero prestado de un Crédito de App ya registrado.
 */
export function abonarDesembolsoCreditoAppEnAppData(
  data: AppDataSchema,
  input: DisburseAppCreditInput
): AppDataSchema {
  const currentCredits = data.appCredits ?? [];
  const creditIndex = currentCredits.findIndex((c) => c.id === input.appCreditId);
  if (creditIndex === -1) {
    throw new Error('No se encontró el crédito seleccionado.');
  }

  const credit = currentCredits[creditIndex];
  const wallet = input.walletId
    ? data.wallets.find((w) => w.id === input.walletId)
    : undefined;

  const destinationMode: 'personal_wallet' | 'third_party_direct' | 'none' =
    input.depositDestinationMode ||
    input.destinationMode ||
    (wallet?.isPassThroughAccount ? 'third_party_direct' : 'personal_wallet');

  const isPassThrough =
    destinationMode === 'third_party_direct' ||
    Boolean(input.walletIsPassThrough) ||
    Boolean(wallet?.isPassThroughAccount);

  if (destinationMode === 'personal_wallet' && !wallet) {
    throw new Error('Selecciona una cuenta o billetera válida.');
  }

  const targetCurrency: CurrencyCode =
    input.depositCurrency || wallet?.currency || 'VES';
  const rateToUse =
    targetCurrency === 'VES'
      ? input.exchangeRate && input.exchangeRate > 0
        ? input.exchangeRate
        : credit.exchangeRate && credit.exchangeRate > 0
          ? credit.exchangeRate
          : data.settings.lastOfficialRate || data.settings.defaultExchangeRate
      : null;

  if (
    destinationMode === 'personal_wallet' &&
    targetCurrency === 'VES' &&
    (!rateToUse || rateToUse <= 0)
  ) {
    throw new Error(
      'Debes indicar una tasa BCV válida para convertir los dólares del préstamo a Bolívares.'
    );
  }

  const grossNominal =
    targetCurrency === 'VES'
      ? credit.currency === 'VES'
        ? credit.requestedAmount
        : redondearMoneda(credit.requestedAmountUsd * (rateToUse || 1))
      : credit.requestedAmountUsd;

  const feePct = Math.max(0, Number(input.bankFeePercent) || 0);
  const hasManualNet =
    typeof input.netAmountManual === 'number' &&
    Number.isFinite(input.netAmountManual) &&
    input.netAmountManual > 0;

  const netNominal = hasManualNet
    ? redondearMoneda(input.netAmountManual!)
    : redondearMoneda(grossNominal * (1 - feePct / 100));

  const feeAmountNominal = redondearMoneda(Math.max(0, grossNominal - netNominal));
  const effectiveFeePct =
    grossNominal > 0
      ? Math.round(((grossNominal - netNominal) / grossNominal) * 10000) / 100
      : feePct;

  const netAmountUsd =
    targetCurrency === 'USD'
      ? netNominal
      : calcularEquivalenteUsd(netNominal, 'VES', rateToUse);

  let updatedTransactions = data.transactions;
  let depositTxId: string | null = credit.depositTransactionId || null;

  if (destinationMode === 'none' || (isPassThrough && !wallet)) {
    // Si antes había una transacción de ingreso en una cuenta personal, la eliminamos para que no sume ingreso falso
    if (credit.depositTransactionId) {
      updatedTransactions = data.transactions.filter(
        (tx) => tx.id !== credit.depositTransactionId
      );
    }
    depositTxId = null;
  } else if (wallet) {
    depositTxId =
      credit.depositTransactionId || `${credit.id}_txn_deposit_${Date.now()}`;

    const feeNotePart =
      feeAmountNominal > 0
        ? ` · Bruto: ${targetCurrency === 'VES' ? 'Bs.' : '$'}${grossNominal.toFixed(
            2
          )} - Comisión retiro banco (${effectiveFeePct}%): ${
            targetCurrency === 'VES' ? 'Bs.' : '$'
          }${feeAmountNominal.toFixed(2)} = Neto recibido: ${
            targetCurrency === 'VES' ? 'Bs.' : '$'
          }${netNominal.toFixed(2)}`
        : '';

    const recipientLabel =
      input.thirdPartyRecipientName?.trim() ||
      wallet.beneficiaryName ||
      wallet.name;

    const depositTx: Transaction = {
      id: depositTxId,
      date: input.depositDate || credit.requestDate,
      type: 'income',
      status: 'completed',
      walletId: wallet.id,
      isPassThroughThirdParty: isPassThrough,
      description: isPassThrough
        ? `[Préstamo App a Tercero · ${credit.appName}] Pasado directo a ${recipientLabel}${
            credit.concept ? ` - ${credit.concept}` : ''
          }`
        : `[Préstamo App · ${credit.appName}] Dinero recibido en cuenta${
            credit.concept ? ` - ${credit.concept}` : ''
          }`,
      categoryId: 'cat_inc_other',
      amount: netNominal,
      currency: targetCurrency,
      exchangeRate: targetCurrency === 'VES' ? rateToUse : null,
      amountUsd: netAmountUsd,
      exchangeRateSource: targetCurrency === 'VES' ? 'bcv' : 'none',
      paymentMethod: wallet.name,
      notes: isPassThrough
        ? `Dinero de ${credit.appName} ($${credit.requestedAmountUsd.toFixed(
            2
          )} USD) enviado directo a cuenta de tercero (${recipientLabel}). No pasó por tus cuentas personales ni suma a tus ingresos.${feeNotePart}`
        : targetCurrency === 'VES' && rateToUse
          ? `Desembolso de crédito ${credit.appName} por $${credit.requestedAmountUsd.toFixed(
               2
            )} USD a tasa BCV (${rateToUse.toFixed(2)} Bs/$)${feeNotePart}`
          : `Desembolso de crédito ${credit.appName} por $${credit.requestedAmountUsd.toFixed(
              2
            )} USD${feeNotePart}`,
    };

    const existsTx = data.transactions.some((tx) => tx.id === depositTxId);
    updatedTransactions = existsTx
      ? data.transactions.map((tx) => (tx.id === depositTxId ? depositTx : tx))
      : [depositTx, ...data.transactions];
  }

  const updatedCredit: AppCredit = {
    ...credit,
    depositToWallet: destinationMode === 'personal_wallet' && Boolean(wallet),
    depositDestinationMode: destinationMode,
    thirdPartyRecipientName: isPassThrough
      ? input.thirdPartyRecipientName?.trim() ||
        wallet?.beneficiaryName ||
        wallet?.name ||
        'Cuenta de Tercero'
      : null,
    depositWalletId: wallet ? wallet.id : null,
    depositTransactionId: depositTxId,
    depositCurrency: destinationMode === 'none' ? null : targetCurrency,
    depositGrossAmountNominal: destinationMode === 'none' ? null : grossNominal,
    depositBankFeePercent:
      destinationMode === 'none' ? null : Math.max(0, effectiveFeePct),
    depositBankFeeAmountNominal:
      destinationMode === 'none' ? null : feeAmountNominal,
    depositAmountNominal: destinationMode === 'none' ? null : netNominal,
    depositExchangeRate:
      destinationMode !== 'none' && targetCurrency === 'VES' ? rateToUse : null,
  };

  return {
    ...data,
    appCredits: currentCredits.map((c, idx) =>
      idx === creditIndex ? updatedCredit : c
    ),
    transactions: updatedTransactions,
  };
}

/**
 * Registra el pago total o un abono parcial a una cuota de un Crédito de App:
 * - Permite hacer abonos parciales (`isPartialPayment: true`) o pagar el saldo restante de la cuota.
 * - Soporta 3 orígenes de pago:
 *   1. `personal_wallet`: Se descuenta de una cuenta/billetera personal tuya (afecta Saldo Real).
 *   2. `third_party_direct` (`paidByThirdPartyDirect: true`): Un amigo o tercero pagó directamente a la App
 *      (ej. Avila Pay / Ubii App) sin pasar por tus cuentas personales. NO exige cuenta de origen personal ni
 *      descuenta de tu Saldo Real, pero sí liquida/abona la cuota y opcionalmente descuenta ese monto de la deuda
 *      por cobrar que ese amigo tenía contigo.
 *   3. `already_paid` (`alreadyPaidExternally: true`): Se pagó anteriormente sin tocar saldos actuales.
 */
export function registrarPagoCuotaCreditoAppEnAppData(
  data: AppDataSchema,
  input: PayAppCreditInstallmentInput
): AppDataSchema {
  const currentCredits = data.appCredits ?? [];
  const creditIndex = currentCredits.findIndex((c) => c.id === input.appCreditId);
  if (creditIndex === -1) {
    throw new Error('No se encontró el crédito de app especificado.');
  }

  const credit = currentCredits[creditIndex];
  const instIndex = credit.installments.findIndex((i) => i.id === input.installmentId);
  if (instIndex === -1) {
    throw new Error('No se encontró la cuota seleccionada.');
  }

  const installment = credit.installments[instIndex];
  if (installment.status === 'paid') {
    throw new Error('Esta cuota ya figura como pagada en su totalidad.');
  }

  const {
    paidInCreditCurrency: prevPaidCreditCur,
    paidUsd: prevPaidUsd,
    remainingInCreditCurrency,
    remainingUsd,
    partialPayments: existingPartials,
  } = obtenerEstadoAbonosCuotaCreditoApp(installment);

  const isThirdPartyDirect = Boolean(
    input.paidByThirdPartyDirect || input.paymentOriginMode === 'third_party_direct'
  );
  const isAlreadyPaid = Boolean(
    input.alreadyPaidExternally || input.paymentOriginMode === 'already_paid'
  );
  const isExternalOrThirdParty = isThirdPartyDirect || isAlreadyPaid;

  const thirdPartyWallet =
    isThirdPartyDirect && input.thirdPartyPassThroughWalletId
      ? data.wallets.find((w) => w.id === input.thirdPartyPassThroughWalletId)
      : undefined;

  const thirdPartyPayerLabel = isThirdPartyDirect
    ? input.thirdPartyPayerName?.trim() ||
      thirdPartyWallet?.beneficiaryName ||
      thirdPartyWallet?.name ||
      credit.thirdPartyRecipientName ||
      'Amigo / Tercero'
    : null;

  // Determinar cuánto se está abonando a la cuota (o a múltiples cuotas) en la moneda del crédito
  const pendingInstallmentsFromSelected = credit.installments
    .slice(instIndex)
    .filter((i) => i.status !== 'paid');
  const maxRemainingCreditCurFromSelected = redondearMoneda(
    pendingInstallmentsFromSelected.reduce(
      (sum, i) => sum + obtenerEstadoAbonosCuotaCreditoApp(i).remainingInCreditCurrency,
      0
    )
  );
  const allPendingInstallments = credit.installments.filter((i) => i.status !== 'paid');
  const totalRemainingCreditCurAll = redondearMoneda(
    allPendingInstallments.reduce(
      (sum, i) => sum + obtenerEstadoAbonosCuotaCreditoApp(i).remainingInCreditCurrency,
      0
    )
  );

  let abonoCreditCur = remainingInCreditCurrency;
  if (
    typeof input.abonoAmountInCreditCurrency === 'number' &&
    Number.isFinite(input.abonoAmountInCreditCurrency) &&
    input.abonoAmountInCreditCurrency > 0
  ) {
    abonoCreditCur = redondearMoneda(input.abonoAmountInCreditCurrency);
  }

  if (abonoCreditCur <= 0) {
    throw new Error('El monto a abonar o pagar debe ser mayor que cero.');
  }

  const symbol = credit.currency === 'VES' ? 'Bs.' : '$';

  if (abonoCreditCur > totalRemainingCreditCurAll + 0.05) {
    throw new Error(
      `El monto ingresado (${symbol}${abonoCreditCur.toFixed(
        2
      )}) supera el saldo total pendiente del crédito (${symbol}${totalRemainingCreditCurAll.toFixed(
        2
      )}).`
    );
  }

  // =========================================================================
  // CASO ESPECIAL: PAGO DE MÚLTIPLES CUOTAS O MONTO PERSONALIZADO MAYOR A 1 CUOTA
  // (Liquida 2 cuotas, todas las cuotas o 1+ cuotas en UN SOLO MOVIMIENTO BANCARIO)
  // =========================================================================
  if (abonoCreditCur > remainingInCreditCurrency + 0.009) {
    const orderedTargets = [
      ...credit.installments.slice(instIndex).filter((i) => i.status !== 'paid'),
      ...credit.installments.slice(0, instIndex).filter((i) => i.status !== 'paid'),
    ];

    let remainingCreditCurToDistribute = Math.min(
      abonoCreditCur,
      totalRemainingCreditCurAll
    );

    const totalAppliedCreditCur = remainingCreditCurToDistribute;
    const totalAppliedUsd =
      credit.currency === 'USD'
        ? totalAppliedCreditCur
        : calcularEquivalenteUsd(totalAppliedCreditCur, 'VES', credit.exchangeRate);

    let updatedDebtsMulti = data.debts;
    let createdDebtPaymentIdMulti: string | null = null;

    if (isThirdPartyDirect && input.deductFromLinkedLoan && input.linkedLoanIdToDeduct) {
      const loanIdx = (data.debts || []).findIndex(
        (d) => d.id === input.linkedLoanIdToDeduct
      );
      if (loanIdx !== -1) {
        const targetLoan = data.debts[loanIdx];
        createdDebtPaymentIdMulti = `debt_pay_appcred_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 5)}`;
        const payCur: CurrencyCode = input.paymentCurrency || credit.currency;
        const payRate =
          payCur === 'VES'
            ? input.exchangeRate && input.exchangeRate > 0
              ? input.exchangeRate
              : credit.exchangeRate
            : null;
        const payNom =
          input.paymentAmountNominal && input.paymentAmountNominal > 0
            ? redondearMoneda(input.paymentAmountNominal)
            : payCur === 'USD'
              ? totalAppliedUsd
              : redondearMoneda(totalAppliedUsd * (payRate || 1));

        const newDebtPayment = {
          id: createdDebtPaymentIdMulti,
          date: input.paidDate,
          amount: payNom,
          currency: payCur,
          exchangeRate: payRate,
          amountUsd: totalAppliedUsd,
          walletId: undefined,
          paymentMethod: `Pago directo a ${credit.appName}`,
          linkedTransactionId: null,
          notes: `Pagó directo ${symbol}${totalAppliedCreditCur.toFixed(2)} a ${credit.appName} (sin pasar por tus cuentas personales).`,
        };

        const nextPayments = [...(targetLoan.payments || []), newDebtPayment];
        const totalPaidLoanUsd = redondearMoneda(
          nextPayments.reduce((acc, p) => acc + (Number(p.amountUsd) || 0), 0)
        );
        const isLoanFullyPaid = totalPaidLoanUsd >= targetLoan.totalAmountUsd - 0.01;

        const updatedLoan: Debt = {
          ...targetLoan,
          payments: nextPayments,
          status: isLoanFullyPaid ? 'paid' : 'pending',
        };

        updatedDebtsMulti = data.debts.map((d, idx) =>
          idx === loanIdx ? updatedLoan : d
        );
      }
    }

    let wallet: AppDataSchema['wallets'][number] | undefined;
    let nominalPaidTotal = totalAppliedCreditCur;
    let paymentCur: CurrencyCode = input.paymentCurrency || credit.currency;
    let paymentRate: number | null =
      paymentCur === 'VES' ? input.exchangeRate || credit.exchangeRate : null;

    if (!isExternalOrThirdParty) {
      wallet = data.wallets.find((w) => w.id === input.walletId);
      if (!wallet) {
        throw new Error('Selecciona una billetera válida para debitar el pago.');
      }
      if (input.paymentCurrency === 'VES' && (!input.exchangeRate || input.exchangeRate <= 0)) {
        throw new Error('Debes indicar una tasa de cambio válida para pagos en Bolívares.');
      }
      paymentCur = input.paymentCurrency;
      paymentRate = input.paymentCurrency === 'VES' ? input.exchangeRate : null;
      nominalPaidTotal =
        input.paymentCurrency === 'USD'
          ? redondearMoneda(
              input.paymentAmountNominal > 0
                ? input.paymentAmountNominal
                : totalAppliedUsd
            )
          : redondearMoneda(input.paymentAmountNominal);
    } else if (input.paymentAmountNominal && input.paymentAmountNominal > 0) {
      nominalPaidTotal = redondearMoneda(input.paymentAmountNominal);
    }

    const batchTxId =
      !isAlreadyPaid && (!isThirdPartyDirect || Boolean(thirdPartyWallet))
        ? `${credit.id}_txn_batch_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 5)}`
        : null;

    const coveredLabels: string[] = [];
    const pendingTxIdsToRemove = new Set<string>();
    const pendingTxUpdates = new Map<
      string,
      {
        amount: number;
        amountUsd: number;
        notes: string;
        dueDate: string;
        instNumber: number;
      }
    >();

    const updatedInstallmentsMap = new Map<string, AppCreditInstallment>();

    for (const targetInst of orderedTargets) {
      if (remainingCreditCurToDistribute <= 0.004) break;

      const instState = obtenerEstadoAbonosCuotaCreditoApp(targetInst);
      if (instState.remainingInCreditCurrency <= 0.004) continue;

      const appliedCreditCur = redondearMoneda(
        Math.min(remainingCreditCurToDistribute, instState.remainingInCreditCurrency)
      );
      remainingCreditCurToDistribute = redondearMoneda(
        Math.max(0, remainingCreditCurToDistribute - appliedCreditCur)
      );

      const completesTarget =
        appliedCreditCur >= instState.remainingInCreditCurrency - 0.009;
      const effectiveAppliedCreditCur = completesTarget
        ? instState.remainingInCreditCurrency
        : appliedCreditCur;
      const effectiveAppliedUsd = completesTarget
        ? instState.remainingUsd
        : credit.currency === 'USD'
          ? effectiveAppliedCreditCur
          : calcularEquivalenteUsd(
              effectiveAppliedCreditCur,
              'VES',
              credit.exchangeRate
            );

      const shareRatio =
        totalAppliedCreditCur > 0
          ? effectiveAppliedCreditCur / totalAppliedCreditCur
          : 0;
      const shareNominal = redondearMoneda(nominalPaidTotal * shareRatio);

      const partialRecord: AppCreditInstallmentPartialPayment = {
        id: `${targetInst.id}_abono_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 5)}`,
        date: input.paidDate,
        amountInCreditCurrency: effectiveAppliedCreditCur,
        amountUsd: effectiveAppliedUsd,
        paymentCurrency: paymentCur,
        paymentAmountNominal: shareNominal,
        exchangeRate: paymentRate,
        alreadyPaidExternally: isExternalOrThirdParty,
        paidByThirdPartyDirect: isThirdPartyDirect,
        thirdPartyPayerName: thirdPartyPayerLabel,
        linkedDebtPaymentId: createdDebtPaymentIdMulti,
        walletId: isThirdPartyDirect
          ? thirdPartyWallet?.id || null
          : isAlreadyPaid
            ? null
            : input.walletId || null,
        linkedTransactionId: batchTxId,
        notes:
          input.notes?.trim() ||
          (completesTarget
            ? `Liquidación de Cuota #${targetInst.number} (en pago múltiple)`
            : `Abono parcial a Cuota #${targetInst.number} (en pago múltiple)`),
      };

      const nextPartials = [...instState.partialPayments, partialRecord];
      const basePendingTxId =
        targetInst.linkedTransactionId || `${credit.id}_txn_inst_${targetInst.number}`;

      if (completesTarget) {
        coveredLabels.push(`#${targetInst.number}`);
        if (targetInst.linkedTransactionId) {
          pendingTxIdsToRemove.add(targetInst.linkedTransactionId);
        }
        pendingTxIdsToRemove.add(`${credit.id}_txn_inst_${targetInst.number}`);

        updatedInstallmentsMap.set(targetInst.id, {
          ...targetInst,
          status: 'paid',
          alreadyPaidExternally: isExternalOrThirdParty,
          paidByThirdPartyDirect: isThirdPartyDirect,
          thirdPartyPayerName: thirdPartyPayerLabel,
          linkedDebtPaymentId: createdDebtPaymentIdMulti,
          linkedTransactionId: batchTxId || basePendingTxId,
          paidAt: input.paidDate,
          paidWalletId: isThirdPartyDirect
            ? thirdPartyWallet?.id || null
            : isAlreadyPaid
              ? null
              : input.walletId || null,
          paidCurrency: paymentCur,
          paidAmountNominal: shareNominal,
          paidExchangeRate: paymentRate,
          partialPayments: nextPartials,
          paidProgressAmount: targetInst.totalInstallmentAmount,
          paidProgressAmountUsd: targetInst.totalInstallmentAmountUsd,
          notes: input.notes?.trim() || targetInst.notes,
        });
      } else {
        coveredLabels.push(
          `#${targetInst.number} (Abono ${symbol}${effectiveAppliedCreditCur.toFixed(2)})`
        );
        const newPaidCur = redondearMoneda(
          instState.paidInCreditCurrency + effectiveAppliedCreditCur
        );
        const newPaidU = redondearMoneda(instState.paidUsd + effectiveAppliedUsd);
        const newRemCur = redondearMoneda(
          Math.max(0, targetInst.totalInstallmentAmount - newPaidCur)
        );
        const newRemU = redondearMoneda(
          Math.max(0, targetInst.totalInstallmentAmountUsd - newPaidU)
        );

        updatedInstallmentsMap.set(targetInst.id, {
          ...targetInst,
          status: 'pending',
          linkedTransactionId: basePendingTxId,
          partialPayments: nextPartials,
          paidProgressAmount: newPaidCur,
          paidProgressAmountUsd: newPaidU,
        });

        pendingTxUpdates.set(basePendingTxId, {
          amount: newRemCur,
          amountUsd: newRemU,
          dueDate: targetInst.dueDate,
          instNumber: targetInst.number,
          notes: `Saldo restante Cuota #${targetInst.number}: ${symbol}${newRemCur.toFixed(
            2
          )} (Abonado: ${symbol}${newPaidCur.toFixed(2)} de ${symbol}${targetInst.totalInstallmentAmount.toFixed(
            2
          )})`,
        });
      }
    }

    const updatedInstallments = credit.installments.map(
      (item) => updatedInstallmentsMap.get(item.id) || item
    );
    const allPaid = updatedInstallments.every((item) => item.status === 'paid');

    const updatedCredit: AppCredit = {
      ...credit,
      installments: updatedInstallments,
      status: allPaid ? 'paid' : 'active',
    };

    let updatedTransactions = data.transactions.filter(
      (tx) => !(tx.status === 'pending' && pendingTxIdsToRemove.has(tx.id))
    );

    for (const [pendingId, info] of pendingTxUpdates.entries()) {
      const exists = updatedTransactions.some((tx) => tx.id === pendingId);
      if (exists) {
        updatedTransactions = updatedTransactions.map((tx) =>
          tx.id === pendingId
            ? {
                ...tx,
                status: 'pending' as const,
                amount: info.amount,
                amountUsd: info.amountUsd,
                notes: info.notes,
              }
            : tx
        );
      } else {
        updatedTransactions.unshift({
          id: pendingId,
          date: info.dueDate,
          type: 'expense',
          status: 'pending',
          walletId: undefined,
          description: `[Crédito App · ${credit.appName}] Cuota ${info.instNumber}/${credit.installmentsCount}${
            credit.concept ? ` - ${credit.concept}` : ''
          }`,
          categoryId: credit.categoryId || 'cat_exp_other',
          amount: info.amount,
          currency: credit.currency,
          exchangeRate: credit.currency === 'VES' ? credit.exchangeRate : null,
          amountUsd: info.amountUsd,
          exchangeRateSource: credit.currency === 'VES' ? 'manual' : 'none',
          paymentMethod: `Cuota Pendiente (${credit.appName})`,
          expenseType: 'fixed',
          isRecurring: false,
          notes: info.notes,
        });
      }
    }

    // Registrar UN SOLO MOVIMIENTO BANCARIO por el monto total pagado
    if (batchTxId && (wallet || thirdPartyWallet)) {
      const targetWalletObj = isThirdPartyDirect ? thirdPartyWallet! : wallet!;
      const txAmountUsd =
        paymentCur === 'USD'
          ? nominalPaidTotal
          : calcularEquivalenteUsd(nominalPaidTotal, 'VES', paymentRate);

      const hasFee =
        !isThirdPartyDirect &&
        input.interbankFeeType &&
        input.interbankFeeType !== 'none' &&
        typeof input.interbankFeeAmount === 'number' &&
        input.interbankFeeAmount > 0;
      const feeTxId = hasFee ? `${batchTxId}_fee` : undefined;
      const bankFeesCatId = obtenerIdCategoriaComisionBancaria(data.categories);

      const methodLabel = isThirdPartyDirect
        ? `Pago directo de ${thirdPartyPayerLabel} a ${credit.appName}`
        : input.interbankFeeType === 'pago_movil'
          ? `${targetWalletObj.name} · Pago Móvil`
          : input.interbankFeeType === 'transferencia'
            ? `${targetWalletObj.name} · Transferencia`
            : targetWalletObj.name;

      const summaryLabel = allPaid
        ? `Liquidación Total (${coveredLabels.join(', ')})`
        : `Pago Cuotas ${coveredLabels.join(', ')}`;

      updatedTransactions.unshift({
        id: batchTxId,
        date: input.paidDate,
        type: 'expense',
        status: 'completed',
        walletId: targetWalletObj.id,
        isPassThroughThirdParty: isThirdPartyDirect,
        description: `[Crédito App · ${credit.appName}] ${summaryLabel}${
          credit.concept ? ` - ${credit.concept}` : ''
        }`,
        categoryId: credit.categoryId || 'cat_exp_other',
        amount: nominalPaidTotal,
        currency: paymentCur,
        exchangeRate: paymentRate,
        amountUsd: txAmountUsd,
        exchangeRateSource:
          paymentCur === 'USD'
            ? 'none'
            : input.exchangeRateSource === 'bcv'
              ? 'bcv'
              : 'manual',
        paymentMethod: methodLabel,
        expenseType: 'fixed',
        isRecurring: false,
        isInterbankTransfer: Boolean(hasFee),
        interbankFeeType:
          hasFee && input.interbankFeeType !== 'none'
            ? input.interbankFeeType
            : undefined,
        interbankFeeAmount: hasFee
          ? redondearMoneda(input.interbankFeeAmount!)
          : undefined,
        interbankFeeTxnId: feeTxId,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        notes:
          input.notes?.trim() ||
          `Pago único por ${symbol}${totalAppliedCreditCur.toFixed(
            2
          )} aplicado a cuotas: ${coveredLabels.join(', ')} (${credit.appName}).`,
      });

      if (hasFee && feeTxId) {
        const feeNominal = redondearMoneda(input.interbankFeeAmount!);
        const feeUsd =
          paymentCur === 'USD'
            ? feeNominal
            : calcularEquivalenteUsd(feeNominal, 'VES', paymentRate);
        updatedTransactions.unshift({
          id: feeTxId,
          date: input.paidDate,
          type: 'expense',
          status: 'completed',
          walletId: targetWalletObj.id,
          description: `Comisión bancaria (${input.interbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - ${summaryLabel} ${credit.appName}`,
          categoryId: bankFeesCatId,
          amount: feeNominal,
          currency: paymentCur,
          exchangeRate: paymentRate,
          amountUsd: feeUsd,
          exchangeRateSource:
            paymentCur === 'USD'
              ? 'none'
              : input.exchangeRateSource === 'bcv'
                ? 'bcv'
                : 'manual',
          paymentMethod:
            input.interbankFeeType === 'pago_movil'
              ? 'Pago Móvil'
              : 'Transferencia',
          expenseType: 'variable',
          isRecurring: false,
          parentTransactionId: batchTxId,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          notes: `Comisión bancaria por pago unificado de cuotas (${coveredLabels.join(', ')}) en ${credit.appName}.`,
        });
      }
    }

    return {
      ...data,
      appCredits: currentCredits.map((item, idx) =>
        idx === creditIndex ? updatedCredit : item
      ),
      transactions: updatedTransactions,
      debts: updatedDebtsMulti,
    };
  }

  const completesInstallment = abonoCreditCur >= remainingInCreditCurrency - 0.009;
  const effectiveAbonoCreditCur = completesInstallment
    ? remainingInCreditCurrency
    : abonoCreditCur;

  const effectiveAbonoUsd = completesInstallment
    ? remainingUsd
    : credit.currency === 'USD'
      ? effectiveAbonoCreditCur
      : calcularEquivalenteUsd(effectiveAbonoCreditCur, 'VES', credit.exchangeRate);

  const newPaidCreditCur = completesInstallment
    ? installment.totalInstallmentAmount
    : redondearMoneda(prevPaidCreditCur + effectiveAbonoCreditCur);
  const newPaidUsd = completesInstallment
    ? installment.totalInstallmentAmountUsd
    : redondearMoneda(prevPaidUsd + effectiveAbonoUsd);

  const newRemainingCreditCur = completesInstallment
    ? 0
    : redondearMoneda(Math.max(0, installment.totalInstallmentAmount - newPaidCreditCur));
  const newRemainingUsd = completesInstallment
    ? 0
    : redondearMoneda(Math.max(0, installment.totalInstallmentAmountUsd - newPaidUsd));

  const linkedPendingTxId =
    installment.linkedTransactionId || `${credit.id}_txn_inst_${installment.number}`;

  // Función auxiliar para descontar este pago directo del Préstamo por Cobrar (Debt) del amigo si se activó la opción
  let createdDebtPaymentId: string | null = null;
  let updatedDebts = data.debts;

  if (isThirdPartyDirect && input.deductFromLinkedLoan && input.linkedLoanIdToDeduct) {
    const loanIdx = (data.debts || []).findIndex(
      (d) => d.id === input.linkedLoanIdToDeduct
    );
    if (loanIdx !== -1) {
      const targetLoan = data.debts[loanIdx];
      createdDebtPaymentId = `debt_pay_appcred_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 5)}`;
      const payCur: CurrencyCode = input.paymentCurrency || credit.currency;
      const payRate =
        payCur === 'VES'
          ? input.exchangeRate && input.exchangeRate > 0
            ? input.exchangeRate
            : credit.exchangeRate
          : null;
      const payNom =
        input.paymentAmountNominal && input.paymentAmountNominal > 0
          ? redondearMoneda(input.paymentAmountNominal)
          : payCur === 'USD'
            ? effectiveAbonoUsd
            : redondearMoneda(effectiveAbonoUsd * (payRate || 1));

      const newDebtPayment = {
        id: createdDebtPaymentId,
        date: input.paidDate,
        amount: payNom,
        currency: payCur,
        exchangeRate: payRate,
        amountUsd: effectiveAbonoUsd,
        walletId: undefined,
        paymentMethod: `Pago directo a ${credit.appName}`,
        linkedTransactionId: null, // No entró a mis cuentas personales, fue directo a la App
        notes: `Pagó directo la Cuota #${installment.number}/${credit.installmentsCount} a ${credit.appName} (sin pasar por tus cuentas personales).`,
      };

      const nextPayments = [...(targetLoan.payments || []), newDebtPayment];
      const totalPaidLoanUsd = redondearMoneda(
        nextPayments.reduce((acc, p) => acc + (Number(p.amountUsd) || 0), 0)
      );
      const isLoanFullyPaid = totalPaidLoanUsd >= targetLoan.totalAmountUsd - 0.01;

      const updatedLoan: Debt = {
        ...targetLoan,
        payments: nextPayments,
        status: isLoanFullyPaid ? 'paid' : 'pending',
      };

      updatedDebts = data.debts.map((d, idx) => (idx === loanIdx ? updatedLoan : d));
    }
  }

  // =========================================================================
  // CASO 1: ABONO PARCIAL QUE AÚN DEJA SALDO PENDIENTE EN LA CUOTA
  // =========================================================================
  if (!completesInstallment) {
    const partialId = `${installment.id}_abono_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 5)}`;

    let partialTxId: string | null = null;
    let nominalPaid =
      input.paymentAmountNominal && input.paymentAmountNominal > 0
        ? redondearMoneda(input.paymentAmountNominal)
        : effectiveAbonoCreditCur;
    let paymentCur: CurrencyCode = input.paymentCurrency || credit.currency;
    let paymentRate: number | null =
      paymentCur === 'VES' ? input.exchangeRate || credit.exchangeRate : null;
    let updatedTransactions = [...data.transactions];

    if (isThirdPartyDirect) {
      // Si el amigo pagó directo y opcionalmente se eligió una Cuenta de Terceros (pass-through) para llevar historial
      if (thirdPartyWallet) {
        partialTxId = `${partialId}_tx`;
        const txAmountUsd =
          paymentCur === 'USD'
            ? nominalPaid
            : calcularEquivalenteUsd(nominalPaid, 'VES', paymentRate);

        updatedTransactions.unshift({
          id: partialTxId,
          date: input.paidDate,
          type: 'expense',
          status: 'completed',
          walletId: thirdPartyWallet.id,
          isPassThroughThirdParty: true,
          description: `[Abono Directo de ${thirdPartyPayerLabel} · ${credit.appName}] Cuota ${installment.number}/${credit.installmentsCount}`,
          categoryId: credit.categoryId || 'cat_exp_other',
          amount: nominalPaid,
          currency: paymentCur,
          exchangeRate: paymentRate,
          amountUsd: txAmountUsd,
          exchangeRateSource:
            paymentCur === 'USD'
              ? 'none'
              : input.exchangeRateSource === 'bcv'
                ? 'bcv'
                : 'manual',
          paymentMethod: `Pago directo de ${thirdPartyPayerLabel} a ${credit.appName}`,
          expenseType: 'fixed',
          isRecurring: false,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          notes:
            input.notes?.trim() ||
            `Abono parcial de ${symbol}${effectiveAbonoCreditCur.toFixed(
              2
            )} pagado directamente por ${thirdPartyPayerLabel} a ${
              credit.appName
            } (no pasó por tus cuentas personales).`,
        });
      }
    } else if (!isAlreadyPaid) {
      const wallet = data.wallets.find((w) => w.id === input.walletId);
      if (!wallet) {
        throw new Error('Selecciona una billetera válida para debitar el abono de la cuota.');
      }
      if (input.paymentCurrency === 'VES' && (!input.exchangeRate || input.exchangeRate <= 0)) {
        throw new Error('Debes indicar una tasa de cambio válida para abonos en Bolívares.');
      }

      paymentCur = input.paymentCurrency;
      paymentRate = input.paymentCurrency === 'VES' ? input.exchangeRate : null;
      nominalPaid =
        input.paymentCurrency === 'USD'
          ? redondearMoneda(
              input.paymentAmountNominal > 0 ? input.paymentAmountNominal : effectiveAbonoUsd
            )
          : redondearMoneda(input.paymentAmountNominal);

      const txAmountUsd =
        input.paymentCurrency === 'USD'
          ? nominalPaid
          : calcularEquivalenteUsd(nominalPaid, 'VES', input.exchangeRate);

      partialTxId = `${partialId}_tx`;
      const hasFee =
        input.interbankFeeType &&
        input.interbankFeeType !== 'none' &&
        typeof input.interbankFeeAmount === 'number' &&
        input.interbankFeeAmount > 0;
      const feeTxId = hasFee ? `${partialTxId}_fee` : undefined;
      const bankFeesCatId = obtenerIdCategoriaComisionBancaria(data.categories);

      // Crear egreso completado por este abono parcial (descuenta del Saldo Real)
      updatedTransactions.unshift({
        id: partialTxId,
        date: input.paidDate,
        type: 'expense',
        status: 'completed',
        walletId: wallet.id,
        description: `[Abono Cuota ${installment.number}/${credit.installmentsCount} · ${credit.appName}]${
          credit.concept ? ` - ${credit.concept}` : ''
        }`,
        categoryId: credit.categoryId || 'cat_exp_other',
        amount: nominalPaid,
        currency: paymentCur,
        exchangeRate: paymentRate,
        amountUsd: txAmountUsd,
        exchangeRateSource:
          paymentCur === 'USD'
            ? 'none'
            : input.exchangeRateSource === 'bcv'
              ? 'bcv'
              : 'manual',
        paymentMethod:
          input.interbankFeeType === 'pago_movil'
            ? `${wallet.name} · Pago Móvil`
            : input.interbankFeeType === 'transferencia'
              ? `${wallet.name} · Transferencia`
              : wallet.name,
        expenseType: 'fixed',
        isRecurring: false,
        isInterbankTransfer: Boolean(hasFee),
        interbankFeeType:
          hasFee && input.interbankFeeType !== 'none'
            ? input.interbankFeeType
            : undefined,
        interbankFeeAmount: hasFee
          ? redondearMoneda(input.interbankFeeAmount!)
          : undefined,
        interbankFeeTxnId: feeTxId,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        notes:
          input.notes?.trim() ||
          `Abono parcial de ${symbol}${effectiveAbonoCreditCur.toFixed(2)} a Cuota #${
            installment.number
          } (${credit.appName}). Resta por pagar: ${symbol}${newRemainingCreditCur.toFixed(2)}`,
      });

      if (hasFee && feeTxId) {
        const feeNominal = redondearMoneda(input.interbankFeeAmount!);
        const feeUsd =
          paymentCur === 'USD'
            ? feeNominal
            : calcularEquivalenteUsd(feeNominal, 'VES', paymentRate);
        updatedTransactions.unshift({
          id: feeTxId,
          date: input.paidDate,
          type: 'expense',
          status: 'completed',
          walletId: wallet.id,
          description: `Comisión bancaria (${input.interbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - Abono Cuota #${installment.number} ${credit.appName}`,
          categoryId: bankFeesCatId,
          amount: feeNominal,
          currency: paymentCur,
          exchangeRate: paymentRate,
          amountUsd: feeUsd,
          exchangeRateSource:
            paymentCur === 'USD'
              ? 'none'
              : input.exchangeRateSource === 'bcv'
                ? 'bcv'
                : 'manual',
          paymentMethod:
            input.interbankFeeType === 'pago_movil'
              ? 'Pago Móvil'
              : 'Transferencia',
          expenseType: 'variable',
          isRecurring: false,
          parentTransactionId: partialTxId,
          createdAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          notes: `Comisión bancaria por abono a Cuota #${installment.number}/${credit.installmentsCount} (${credit.appName}).`,
        });
      }
    }

    const newPartialRecord: AppCreditInstallmentPartialPayment = {
      id: partialId,
      date: input.paidDate,
      amountInCreditCurrency: effectiveAbonoCreditCur,
      amountUsd: effectiveAbonoUsd,
      paymentCurrency: paymentCur,
      paymentAmountNominal: nominalPaid,
      exchangeRate: paymentRate,
      alreadyPaidExternally: isExternalOrThirdParty,
      paidByThirdPartyDirect: isThirdPartyDirect,
      thirdPartyPayerName: thirdPartyPayerLabel,
      linkedDebtPaymentId: createdDebtPaymentId,
      walletId: isThirdPartyDirect
        ? thirdPartyWallet?.id || null
        : isAlreadyPaid
          ? null
          : input.walletId || null,
      linkedTransactionId: partialTxId,
      notes:
        input.notes?.trim() ||
        (isThirdPartyDirect
          ? `Abono pagado directo a ${credit.appName} por ${thirdPartyPayerLabel} (sin pasar por tus cuentas)`
          : isAlreadyPaid
            ? 'Abono marcado como pagado previamente (sin afectar saldo de billeteras)'
            : undefined),
    };

    const nextPartials = [...existingPartials, newPartialRecord];

    const updatedInstallment: AppCreditInstallment = {
      ...installment,
      linkedTransactionId: linkedPendingTxId,
      partialPayments: nextPartials,
      paidProgressAmount: newPaidCreditCur,
      paidProgressAmountUsd: newPaidUsd,
    };

    // Actualizar la transacción 'pending' para que solo proyecte el saldo restante de la cuota
    const existsPendingTx = updatedTransactions.some((tx) => tx.id === linkedPendingTxId);
    const pendingNote = `Saldo restante Cuota #${installment.number}: ${symbol}${newRemainingCreditCur.toFixed(
      2
    )} (Abonado: ${symbol}${newPaidCreditCur.toFixed(2)} de ${symbol}${installment.totalInstallmentAmount.toFixed(
      2
    )})`;

    if (existsPendingTx) {
      updatedTransactions = updatedTransactions.map((tx) =>
        tx.id === linkedPendingTxId
          ? {
              ...tx,
              status: 'pending' as const,
              amount: newRemainingCreditCur,
              amountUsd: newRemainingUsd,
              notes: pendingNote,
            }
          : tx
      );
    } else {
      updatedTransactions.unshift({
        id: linkedPendingTxId,
        date: installment.dueDate,
        type: 'expense',
        status: 'pending',
        walletId: undefined,
        description: `[Crédito App · ${credit.appName}] Cuota ${installment.number}/${credit.installmentsCount}${
          credit.concept ? ` - ${credit.concept}` : ''
        }`,
        categoryId: credit.categoryId || 'cat_exp_other',
        amount: newRemainingCreditCur,
        currency: credit.currency,
        exchangeRate: credit.currency === 'VES' ? credit.exchangeRate : null,
        amountUsd: newRemainingUsd,
        exchangeRateSource: credit.currency === 'VES' ? 'manual' : 'none',
        paymentMethod: `Cuota Pendiente (${credit.appName})`,
        expenseType: 'fixed',
        isRecurring: false,
        notes: pendingNote,
      });
    }

    const updatedInstallments = credit.installments.map((item, idx) =>
      idx === instIndex ? updatedInstallment : item
    );

    const updatedCredit: AppCredit = {
      ...credit,
      installments: updatedInstallments,
      status: 'active',
    };

    return {
      ...data,
      appCredits: currentCredits.map((item, idx) =>
        idx === creditIndex ? updatedCredit : item
      ),
      transactions: updatedTransactions,
      debts: updatedDebts,
    };
  }

  // =========================================================================
  // CASO 2: PAGO COMPLETO DE LA CUOTA (O ABONO FINAL QUE LIQUIDA EL SALDO RESTANTE)
  // =========================================================================
  const hadPriorPartials = existingPartials.length > 0;

  if (isExternalOrThirdParty) {
    const payCurFinal: CurrencyCode = input.paymentCurrency || credit.currency;
    const payRateFinal: number | null =
      payCurFinal === 'VES'
        ? input.exchangeRate && input.exchangeRate > 0
          ? input.exchangeRate
          : credit.exchangeRate
        : null;
    const payNominalFinal =
      input.paymentAmountNominal && input.paymentAmountNominal > 0
        ? redondearMoneda(input.paymentAmountNominal)
        : effectiveAbonoCreditCur;

    let thirdPartyCompleteTxId: string | null = null;
    let updatedTransactions = data.transactions.filter(
      (tx) => tx.id !== installment.linkedTransactionId
    );

    if (isThirdPartyDirect && thirdPartyWallet) {
      thirdPartyCompleteTxId = `${installment.id}_tp_tx_${Date.now()}`;
      const txUsd =
        payCurFinal === 'USD'
          ? payNominalFinal
          : calcularEquivalenteUsd(payNominalFinal, 'VES', payRateFinal);

      updatedTransactions.unshift({
        id: thirdPartyCompleteTxId,
        date: input.paidDate,
        type: 'expense',
        status: 'completed',
        walletId: thirdPartyWallet.id,
        isPassThroughThirdParty: true,
        description: `[Pago Directo de ${thirdPartyPayerLabel} · ${credit.appName}] Cuota ${installment.number}/${credit.installmentsCount}`,
        categoryId: credit.categoryId || 'cat_exp_other',
        amount: payNominalFinal,
        currency: payCurFinal,
        exchangeRate: payRateFinal,
        amountUsd: txUsd,
        exchangeRateSource:
          payCurFinal === 'USD'
            ? 'none'
            : input.exchangeRateSource === 'bcv'
              ? 'bcv'
              : 'manual',
        paymentMethod: `Pago directo de ${thirdPartyPayerLabel} a ${credit.appName}`,
        expenseType: 'fixed',
        isRecurring: false,
        createdAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        notes:
          input.notes?.trim() ||
          `Cuota #${installment.number}/${credit.installmentsCount} pagada directamente por ${thirdPartyPayerLabel} a ${credit.appName} (sin pasar por tus cuentas personales).`,
      });
    }

    const finalPartialList: AppCreditInstallmentPartialPayment[] = hadPriorPartials
      ? [
          ...existingPartials,
          {
            id: `${installment.id}_abono_${Date.now()}`,
            date: input.paidDate,
            amountInCreditCurrency: effectiveAbonoCreditCur,
            amountUsd: effectiveAbonoUsd,
            paymentCurrency: payCurFinal,
            paymentAmountNominal: payNominalFinal,
            exchangeRate: payRateFinal,
            alreadyPaidExternally: true,
            paidByThirdPartyDirect: isThirdPartyDirect,
            thirdPartyPayerName: thirdPartyPayerLabel,
            linkedDebtPaymentId: createdDebtPaymentId,
            walletId: thirdPartyWallet?.id || null,
            linkedTransactionId: thirdPartyCompleteTxId,
            notes:
              input.notes?.trim() ||
              (isThirdPartyDirect
                ? `Saldo restante pagado directo a ${credit.appName} por ${thirdPartyPayerLabel}`
                : 'Saldo restante marcado como pagado previamente (sin afectar billeteras)'),
          },
        ]
      : existingPartials;

    const updatedInstallment: AppCreditInstallment = {
      ...installment,
      status: 'paid',
      alreadyPaidExternally: !hadPriorPartials
        ? true
        : finalPartialList.every((p) => p.alreadyPaidExternally),
      paidByThirdPartyDirect: isThirdPartyDirect,
      thirdPartyPayerName: thirdPartyPayerLabel,
      linkedDebtPaymentId: createdDebtPaymentId,
      linkedTransactionId: thirdPartyCompleteTxId || installment.linkedTransactionId,
      paidAt: input.paidDate,
      paidWalletId: thirdPartyWallet?.id || null,
      paidCurrency: payCurFinal,
      paidAmountNominal: payNominalFinal,
      paidExchangeRate: payRateFinal,
      partialPayments: finalPartialList,
      paidProgressAmount: installment.totalInstallmentAmount,
      paidProgressAmountUsd: installment.totalInstallmentAmountUsd,
      notes:
        input.notes?.trim() ||
        (isThirdPartyDirect
          ? `Cuota pagada directamente a ${credit.appName} por ${thirdPartyPayerLabel} (sin pasar por tus cuentas)`
          : 'Cuota marcada como pagada previamente (sin afectar saldo de billeteras)'),
    };

    const updatedInstallments = credit.installments.map((item, idx) =>
      idx === instIndex ? updatedInstallment : item
    );
    const allPaid = updatedInstallments.every((item) => item.status === 'paid');

    const updatedCredit: AppCredit = {
      ...credit,
      installments: updatedInstallments,
      status: allPaid ? 'paid' : 'active',
    };

    const updatedCredits = currentCredits.map((item, idx) =>
      idx === creditIndex ? updatedCredit : item
    );

    return {
      ...data,
      appCredits: updatedCredits,
      transactions: updatedTransactions,
      debts: updatedDebts,
    };
  }

  const wallet = data.wallets.find((w) => w.id === input.walletId);
  if (!wallet) {
    throw new Error('Selecciona una billetera válida para debitar el pago de la cuota.');
  }

  if (input.paymentCurrency === 'VES' && (!input.exchangeRate || input.exchangeRate <= 0)) {
    throw new Error('Debes indicar una tasa de cambio válida para pagos en Bolívares.');
  }

  const nominalAmount =
    input.paymentCurrency === 'USD'
      ? redondearMoneda(
          input.paymentAmountNominal > 0 ? input.paymentAmountNominal : effectiveAbonoUsd
        )
      : redondearMoneda(input.paymentAmountNominal);

  const amountUsd =
    input.paymentCurrency === 'USD'
      ? nominalAmount
      : calcularEquivalenteUsd(nominalAmount, 'VES', input.exchangeRate);

  const finalPartialList: AppCreditInstallmentPartialPayment[] = hadPriorPartials
    ? [
        ...existingPartials,
        {
          id: `${installment.id}_abono_${Date.now()}`,
          date: input.paidDate,
          amountInCreditCurrency: effectiveAbonoCreditCur,
          amountUsd: effectiveAbonoUsd,
          paymentCurrency: input.paymentCurrency,
          paymentAmountNominal: nominalAmount,
          exchangeRate: input.paymentCurrency === 'VES' ? input.exchangeRate : null,
          alreadyPaidExternally: false,
          paidByThirdPartyDirect: false,
          thirdPartyPayerName: null,
          walletId: input.walletId || null,
          linkedTransactionId: linkedPendingTxId,
          notes: input.notes?.trim() || 'Pago del saldo restante de la cuota',
        },
      ]
    : existingPartials;

  const updatedInstallment: AppCreditInstallment = {
    ...installment,
    status: 'paid',
    alreadyPaidExternally: false,
    paidByThirdPartyDirect: false,
    thirdPartyPayerName: null,
    linkedTransactionId: linkedPendingTxId,
    paidAt: input.paidDate,
    paidWalletId: input.walletId || null,
    paidCurrency: input.paymentCurrency,
    paidAmountNominal: nominalAmount,
    paidExchangeRate: input.paymentCurrency === 'VES' ? input.exchangeRate : null,
    partialPayments: finalPartialList,
    paidProgressAmount: installment.totalInstallmentAmount,
    paidProgressAmountUsd: installment.totalInstallmentAmountUsd,
    notes: input.notes?.trim() || installment.notes,
  };

  const updatedInstallments = credit.installments.map((item, idx) =>
    idx === instIndex ? updatedInstallment : item
  );
  const allPaid = updatedInstallments.every((item) => item.status === 'paid');

  const updatedCredit: AppCredit = {
    ...credit,
    installments: updatedInstallments,
    status: allPaid ? 'paid' : 'active',
  };

  const hasFullFee =
    input.interbankFeeType &&
    input.interbankFeeType !== 'none' &&
    typeof input.interbankFeeAmount === 'number' &&
    input.interbankFeeAmount > 0;
  const fullFeeTxId = hasFullFee ? `${linkedPendingTxId}_fee` : undefined;
  const bankFeesCatId = obtenerIdCategoriaComisionBancaria(data.categories);

  const methodLabel =
    input.interbankFeeType === 'pago_movil'
      ? `${wallet.name} · Pago Móvil`
      : input.interbankFeeType === 'transferencia'
        ? `${wallet.name} · Transferencia`
        : wallet.name;

  let foundLinkedTx = false;
  const updatedTransactions = data.transactions.map((tx) => {
    if (tx.id === linkedPendingTxId) {
      foundLinkedTx = true;
      return {
        ...tx,
        date: input.paidDate,
        status: 'completed' as const,
        walletId: input.walletId || undefined,
        amount: nominalAmount,
        currency: input.paymentCurrency,
        exchangeRate: input.paymentCurrency === 'VES' ? input.exchangeRate : null,
        amountUsd,
        exchangeRateSource:
          input.paymentCurrency === 'USD'
            ? ('none' as const)
            : input.exchangeRateSource === 'bcv'
              ? ('bcv' as const)
              : ('manual' as const),
        paymentMethod: methodLabel,
        isInterbankTransfer: Boolean(hasFullFee),
        interbankFeeType:
          hasFullFee && input.interbankFeeType !== 'none'
            ? input.interbankFeeType
            : undefined,
        interbankFeeAmount: hasFullFee
          ? redondearMoneda(input.interbankFeeAmount!)
          : undefined,
        interbankFeeTxnId: fullFeeTxId,
        processedAt: new Date().toISOString(),
        notes:
          input.notes?.trim() ||
          (hadPriorPartials
            ? `Pago de saldo restante (${symbol}${effectiveAbonoCreditCur.toFixed(
                2
              )}) de Cuota ${installment.number}/${credit.installmentsCount} (${credit.appName})`
            : `Pago confirmado de Cuota ${installment.number}/${credit.installmentsCount} (${credit.appName})`),
      };
    }
    return tx;
  });

  if (!foundLinkedTx) {
    updatedTransactions.unshift({
      id: linkedPendingTxId,
      date: input.paidDate,
      type: 'expense',
      status: 'completed',
      walletId: input.walletId || undefined,
      description: `[Crédito App · ${credit.appName}] Cuota ${installment.number}/${credit.installmentsCount}${
        credit.concept ? ` - ${credit.concept}` : ''
      }`,
      categoryId: credit.categoryId || 'cat_exp_other',
      amount: nominalAmount,
      currency: input.paymentCurrency,
      exchangeRate: input.paymentCurrency === 'VES' ? input.exchangeRate : null,
      amountUsd,
      exchangeRateSource:
        input.paymentCurrency === 'USD'
          ? 'none'
          : input.exchangeRateSource === 'bcv'
            ? 'bcv'
            : 'manual',
      paymentMethod: methodLabel,
      expenseType: 'fixed',
      isRecurring: false,
      isInterbankTransfer: Boolean(hasFullFee),
      interbankFeeType:
        hasFullFee && input.interbankFeeType !== 'none'
          ? input.interbankFeeType
          : undefined,
      interbankFeeAmount: hasFullFee
        ? redondearMoneda(input.interbankFeeAmount!)
        : undefined,
      interbankFeeTxnId: fullFeeTxId,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      notes:
        input.notes?.trim() ||
        `Pago confirmado de Cuota ${installment.number}/${credit.installmentsCount} (${credit.appName})`,
    });
  }

  if (hasFullFee && fullFeeTxId) {
    const feeNominal = redondearMoneda(input.interbankFeeAmount!);
    const feeUsd =
      input.paymentCurrency === 'USD'
        ? feeNominal
        : calcularEquivalenteUsd(feeNominal, 'VES', input.exchangeRate);
    updatedTransactions.unshift({
      id: fullFeeTxId,
      date: input.paidDate,
      type: 'expense',
      status: 'completed',
      walletId: input.walletId || undefined,
      description: `Comisión bancaria (${input.interbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}) - Cuota #${installment.number} ${credit.appName}`,
      categoryId: bankFeesCatId,
      amount: feeNominal,
      currency: input.paymentCurrency,
      exchangeRate: input.paymentCurrency === 'VES' ? input.exchangeRate : null,
      amountUsd: feeUsd,
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      exchangeRateSource:
        input.paymentCurrency === 'USD'
          ? 'none'
          : input.exchangeRateSource === 'bcv'
            ? 'bcv'
            : 'manual',
      paymentMethod:
        input.interbankFeeType === 'pago_movil'
          ? 'Pago Móvil'
          : 'Transferencia',
      expenseType: 'variable',
      isRecurring: false,
      parentTransactionId: linkedPendingTxId,
      notes: `Comisión bancaria por pago de Cuota #${installment.number}/${credit.installmentsCount} (${credit.appName}).`,
    });
  }

  const updatedCredits = currentCredits.map((item, idx) =>
    idx === creditIndex ? updatedCredit : item
  );

  return {
    ...data,
    appCredits: updatedCredits,
    transactions: updatedTransactions,
    debts: updatedDebts,
  };
}

/**
 * Elimina/revierte un abono parcial individual de una cuota, restaurando su monto al pasivo pendiente.
 */
export function eliminarAbonoCuotaCreditoAppEnAppData(
  data: AppDataSchema,
  appCreditId: string,
  installmentId: string,
  partialPaymentId: string
): AppDataSchema {
  const currentCredits = data.appCredits ?? [];
  const creditIndex = currentCredits.findIndex((c) => c.id === appCreditId);
  if (creditIndex === -1) return data;

  const credit = currentCredits[creditIndex];
  const instIndex = credit.installments.findIndex((i) => i.id === installmentId);
  if (instIndex === -1) return data;

  const installment = credit.installments[instIndex];
  const existingPartials = installment.partialPayments ?? [];
  const targetPartial = existingPartials.find((p) => p.id === partialPaymentId);
  if (!targetPartial) return data;

  const remainingPartials = existingPartials.filter((p) => p.id !== partialPaymentId);
  const newPaidCreditCur = redondearMoneda(
    remainingPartials.reduce((sum, p) => sum + (Number(p.amountInCreditCurrency) || 0), 0)
  );
  const newPaidUsd = redondearMoneda(
    remainingPartials.reduce((sum, p) => sum + (Number(p.amountUsd) || 0), 0)
  );
  const newRemainingCreditCur = redondearMoneda(
    Math.max(0, installment.totalInstallmentAmount - newPaidCreditCur)
  );
  const newRemainingUsd = redondearMoneda(
    Math.max(0, installment.totalInstallmentAmountUsd - newPaidUsd)
  );

  const linkedPendingTxId = `${credit.id}_txn_inst_${installment.number}`;

  const updatedInstallment: AppCreditInstallment = {
    ...installment,
    status: 'pending',
    alreadyPaidExternally: false,
    paidByThirdPartyDirect: false,
    thirdPartyPayerName: null,
    linkedDebtPaymentId: null,
    linkedTransactionId: linkedPendingTxId,
    paidAt: null,
    paidWalletId: null,
    paidCurrency: null,
    paidAmountNominal: null,
    paidExchangeRate: null,
    partialPayments: remainingPartials,
    paidProgressAmount: newPaidCreditCur,
    paidProgressAmountUsd: newPaidUsd,
  };

  const updatedInstallments = credit.installments.map((item, idx) =>
    idx === instIndex ? updatedInstallment : item
  );

  const updatedCredit: AppCredit = {
    ...credit,
    installments: updatedInstallments,
    status: 'active',
  };

  const symbol = credit.currency === 'VES' ? 'Bs.' : '$';
  const pendingTx: Transaction = {
    id: linkedPendingTxId,
    date: installment.dueDate,
    type: 'expense',
    status: 'pending',
    walletId: undefined,
    description: `[Crédito App · ${credit.appName}] Cuota ${installment.number}/${credit.installmentsCount}${
      credit.concept ? ` - ${credit.concept}` : ''
    }`,
    categoryId: credit.categoryId || 'cat_exp_other',
    amount: newRemainingCreditCur,
    currency: credit.currency,
    exchangeRate: credit.currency === 'VES' ? credit.exchangeRate : null,
    amountUsd: newRemainingUsd,
    exchangeRateSource: credit.currency === 'VES' ? 'manual' : 'none',
    paymentMethod: `Cuota Pendiente (${credit.appName})`,
    expenseType: 'fixed',
    isRecurring: false,
    notes:
      newPaidCreditCur > 0
        ? `Saldo restante Cuota #${installment.number}: ${symbol}${newRemainingCreditCur.toFixed(
            2
          )} (Abonado: ${symbol}${newPaidCreditCur.toFixed(2)})`
        : `Desglose Cuota #${installment.number}: Capital ${installment.principalAmount.toFixed(
            2
          )} + Comisión ${installment.feeAmount.toFixed(2)}`,
  };

  const sharedTxIdsStillUsed = new Set<string>();
  for (const instItem of updatedInstallments) {
    if (instItem.status === 'paid' && instItem.linkedTransactionId) {
      sharedTxIdsStillUsed.add(instItem.linkedTransactionId);
    }
    for (const p of instItem.partialPayments ?? []) {
      if (p.linkedTransactionId) {
        sharedTxIdsStillUsed.add(p.linkedTransactionId);
      }
    }
  }

  const targetTxId = targetPartial.linkedTransactionId;
  const isTargetTxStillShared = Boolean(
    targetTxId && sharedTxIdsStillUsed.has(targetTxId)
  );

  let updatedTransactions = data.transactions
    .filter(
      (tx) =>
        !(
          targetTxId &&
          targetTxId !== linkedPendingTxId &&
          !isTargetTxStillShared &&
          (tx.id === targetTxId ||
            tx.parentTransactionId === targetTxId ||
            tx.id === `${targetTxId}_fee`)
        )
    )
    .map((tx) => {
      if (targetTxId && isTargetTxStillShared && tx.id === targetTxId) {
        const nextUsd = redondearMoneda(
          Math.max(0.01, tx.amountUsd - targetPartial.amountUsd)
        );
        const nextAmount =
          tx.currency === 'USD'
            ? nextUsd
            : redondearMoneda(
                Math.max(0.01, tx.amount - targetPartial.paymentAmountNominal)
              );
        return {
          ...tx,
          amount: nextAmount,
          amountUsd: nextUsd,
        };
      }
      return tx;
    });

  const existsPending = updatedTransactions.some((tx) => tx.id === linkedPendingTxId);
  updatedTransactions = existsPending
    ? updatedTransactions.map((tx) => (tx.id === linkedPendingTxId ? pendingTx : tx))
    : [pendingTx, ...updatedTransactions];

  let updatedDebts = data.debts;
  if (targetPartial.linkedDebtPaymentId && !isTargetTxStillShared) {
    updatedDebts = (data.debts || []).map((d) => {
      if (!(d.payments || []).some((p) => p.id === targetPartial.linkedDebtPaymentId)) {
        return d;
      }
      const nextPays = (d.payments || []).filter(
        (p) => p.id !== targetPartial.linkedDebtPaymentId
      );
      const totalPaidUsd = redondearMoneda(
        nextPays.reduce((acc, p) => acc + (Number(p.amountUsd) || 0), 0)
      );
      return {
        ...d,
        payments: nextPays,
        status: totalPaidUsd >= d.totalAmountUsd - 0.01 ? 'paid' : 'pending',
      };
    });
  }

  return {
    ...data,
    appCredits: currentCredits.map((c, idx) => (idx === creditIndex ? updatedCredit : c)),
    transactions: updatedTransactions,
    debts: updatedDebts,
  };
}

/**
 * Revierte una cuota pagada (y todos sus abonos) a estado 'pending', restaurando su pasivo proyectado completo.
 */
export function revertirPagoCuotaCreditoAppEnAppData(
  data: AppDataSchema,
  appCreditId: string,
  installmentId: string
): AppDataSchema {
  const currentCredits = data.appCredits ?? [];
  const creditIndex = currentCredits.findIndex((c) => c.id === appCreditId);
  if (creditIndex === -1) return data;

  const credit = currentCredits[creditIndex];
  const instIndex = credit.installments.findIndex((i) => i.id === installmentId);
  if (instIndex === -1) return data;

  const installment = credit.installments[instIndex];
  if (installment.status !== 'paid' && !(installment.partialPayments?.length)) return data;

  const basePendingTxId = `${credit.id}_txn_inst_${installment.number}`;
  const linkedTxId = installment.linkedTransactionId || basePendingTxId;

  const partialTxIds = new Set(
    (installment.partialPayments ?? [])
      .map((p) => p.linkedTransactionId)
      .filter((id): id is string => Boolean(id && id !== basePendingTxId))
  );
  if (linkedTxId !== basePendingTxId) {
    partialTxIds.add(linkedTxId);
  }

  const debtPaymentIdsToRemove = new Set<string>();
  if (installment.linkedDebtPaymentId) {
    debtPaymentIdsToRemove.add(installment.linkedDebtPaymentId);
  }
  for (const p of installment.partialPayments ?? []) {
    if (p.linkedDebtPaymentId) {
      debtPaymentIdsToRemove.add(p.linkedDebtPaymentId);
    }
  }

  const revertedInstallment: AppCreditInstallment = {
    ...installment,
    status: 'pending',
    alreadyPaidExternally: false,
    paidByThirdPartyDirect: false,
    thirdPartyPayerName: null,
    linkedDebtPaymentId: null,
    linkedTransactionId: basePendingTxId,
    paidAt: null,
    paidWalletId: null,
    paidCurrency: null,
    paidAmountNominal: null,
    paidExchangeRate: null,
    partialPayments: [],
    paidProgressAmount: 0,
    paidProgressAmountUsd: 0,
  };

  const updatedInstallments = credit.installments.map((item, idx) =>
    idx === instIndex ? revertedInstallment : item
  );

  const updatedCredit: AppCredit = {
    ...credit,
    installments: updatedInstallments,
    status: 'active',
  };

  const sharedTxIdsStillUsed = new Set<string>();
  for (const instItem of updatedInstallments) {
    if (instItem.status === 'paid' && instItem.linkedTransactionId) {
      sharedTxIdsStillUsed.add(instItem.linkedTransactionId);
    }
    for (const p of instItem.partialPayments ?? []) {
      if (p.linkedTransactionId) {
        sharedTxIdsStillUsed.add(p.linkedTransactionId);
      }
    }
  }

  const pendingTx: Transaction = {
    id: basePendingTxId,
    date: installment.dueDate,
    type: 'expense',
    status: 'pending',
    walletId: undefined,
    description: `[Crédito App · ${credit.appName}] Cuota ${installment.number}/${credit.installmentsCount}${
      credit.concept ? ` - ${credit.concept}` : ''
    }`,
    categoryId: credit.categoryId || 'cat_exp_other',
    amount: installment.totalInstallmentAmount,
    currency: credit.currency,
    exchangeRate: credit.currency === 'VES' ? credit.exchangeRate : null,
    amountUsd: installment.totalInstallmentAmountUsd,
    exchangeRateSource: credit.currency === 'VES' ? 'manual' : 'none',
    paymentMethod: `Cuota Pendiente (${credit.appName})`,
    expenseType: 'fixed',
    isRecurring: false,
    notes: `Desglose Cuota #${installment.number}: Capital ${installment.principalAmount.toFixed(
      2
    )} + Comisión ${installment.feeAmount.toFixed(2)}`,
  };

  const filteredTransactions = data.transactions
    .filter((tx) => {
      if (tx.id === `${basePendingTxId}_fee` || tx.parentTransactionId === basePendingTxId) {
        return false;
      }
      if (partialTxIds.has(tx.id)) {
        return sharedTxIdsStillUsed.has(tx.id);
      }
      if (tx.parentTransactionId && partialTxIds.has(tx.parentTransactionId)) {
        return sharedTxIdsStillUsed.has(tx.parentTransactionId);
      }
      return true;
    })
    .map((tx) => {
      if (partialTxIds.has(tx.id) && sharedTxIdsStillUsed.has(tx.id)) {
        const matchingPartials = (installment.partialPayments ?? []).filter(
          (p) => p.linkedTransactionId === tx.id
        );
        const revertedUsd =
          matchingPartials.length > 0
            ? matchingPartials.reduce((s, p) => s + p.amountUsd, 0)
            : installment.totalInstallmentAmountUsd;
        const revertedNominal =
          matchingPartials.length > 0
            ? matchingPartials.reduce((s, p) => s + p.paymentAmountNominal, 0)
            : installment.paidAmountNominal || installment.totalInstallmentAmount;
        const nextUsd = redondearMoneda(Math.max(0.01, tx.amountUsd - revertedUsd));
        const nextAmount =
          tx.currency === 'USD'
            ? nextUsd
            : redondearMoneda(Math.max(0.01, tx.amount - revertedNominal));
        return {
          ...tx,
          amount: nextAmount,
          amountUsd: nextUsd,
        };
      }
      return tx;
    });

  const existsTx = filteredTransactions.some((tx) => tx.id === basePendingTxId);
  const updatedTransactions = existsTx
    ? filteredTransactions.map((tx) => (tx.id === basePendingTxId ? pendingTx : tx))
    : [pendingTx, ...filteredTransactions];

  let updatedDebts = data.debts;
  if (debtPaymentIdsToRemove.size > 0) {
    updatedDebts = (data.debts || []).map((d) => {
      if (!(d.payments || []).some((p) => debtPaymentIdsToRemove.has(p.id))) {
        return d;
      }
      const nextPays = (d.payments || []).filter(
        (p) => !debtPaymentIdsToRemove.has(p.id)
      );
      const totalPaidUsd = redondearMoneda(
        nextPays.reduce((acc, p) => acc + (Number(p.amountUsd) || 0), 0)
      );
      return {
        ...d,
        payments: nextPays,
        status: totalPaidUsd >= d.totalAmountUsd - 0.01 ? 'paid' : 'pending',
      };
    });
  }

  return {
    ...data,
    appCredits: currentCredits.map((c, idx) => (idx === creditIndex ? updatedCredit : c)),
    transactions: updatedTransactions,
    debts: updatedDebts,
  };
}

/**
 * Permite modificar el monto total (y opcionalmente la fecha de vencimiento) de una cuota específica
 * en un crédito de app ya registrado (por ejemplo, para cuadrar centavos exactos con Avila Pay o Ubii App).
 * Sincroniza automáticamente la transacción vinculada (pendiente o pagada) y los totales del crédito.
 */
export function actualizarMontoCuotaCreditoAppEnAppData(
  data: AppDataSchema,
  input: UpdateAppCreditInstallmentInput
): AppDataSchema {
  const currentCredits = data.appCredits ?? [];
  const creditIndex = currentCredits.findIndex((c) => c.id === input.appCreditId);
  if (creditIndex === -1) {
    throw new Error('No se encontró el crédito de app.');
  }

  const credit = currentCredits[creditIndex];
  const instIndex = credit.installments.findIndex((i) => i.id === input.installmentId);
  if (instIndex === -1) {
    throw new Error('No se encontró la cuota seleccionada.');
  }

  const newTotalAmount = redondearMoneda(input.newTotalAmount);
  if (!Number.isFinite(newTotalAmount) || newTotalAmount <= 0) {
    throw new Error('El monto de la cuota debe ser mayor que cero.');
  }

  const installment = credit.installments[instIndex];
  const feeAmount = redondearMoneda(Math.min(credit.feePerInstallment, newTotalAmount));
  const principalAmount = redondearMoneda(Math.max(0, newTotalAmount - feeAmount));

  const principalAmountUsd =
    credit.currency === 'USD'
      ? principalAmount
      : calcularEquivalenteUsd(principalAmount, 'VES', credit.exchangeRate);
  const feeAmountUsd =
    credit.currency === 'USD'
      ? feeAmount
      : calcularEquivalenteUsd(feeAmount, 'VES', credit.exchangeRate);
  const totalInstallmentAmountUsd =
    credit.currency === 'USD'
      ? newTotalAmount
      : redondearMoneda(principalAmountUsd + feeAmountUsd);

  const updatedDueDate =
    input.newDueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.newDueDate)
      ? input.newDueDate
      : installment.dueDate;

  const updatedInstallment: AppCreditInstallment = {
    ...installment,
    dueDate: updatedDueDate,
    principalAmount,
    feeAmount,
    totalInstallmentAmount: newTotalAmount,
    principalAmountUsd,
    feeAmountUsd,
    totalInstallmentAmountUsd,
    paidAmountNominal:
      installment.status === 'paid' &&
      (!installment.paidCurrency || installment.paidCurrency === credit.currency)
        ? newTotalAmount
        : installment.paidAmountNominal,
  };

  const { remainingInCreditCurrency, remainingUsd } =
    obtenerEstadoAbonosCuotaCreditoApp(updatedInstallment);

  const updatedInstallments = credit.installments.map((item, idx) =>
    idx === instIndex ? updatedInstallment : item
  );

  const totalFeeAmount = redondearMoneda(
    updatedInstallments.reduce((acc, item) => acc + item.feeAmount, 0)
  );
  const totalToPayAmount = redondearMoneda(
    updatedInstallments.reduce((acc, item) => acc + item.totalInstallmentAmount, 0)
  );
  const totalToPayAmountUsd = redondearMoneda(
    updatedInstallments.reduce((acc, item) => acc + item.totalInstallmentAmountUsd, 0)
  );

  const updatedCredit: AppCredit = {
    ...credit,
    installments: updatedInstallments,
    totalFeeAmount,
    totalToPayAmount,
    totalToPayAmountUsd,
  };

  const symbol = credit.currency === 'VES' ? 'Bs.' : '$';
  const updatedTransactions = data.transactions.map((tx) => {
    if (installment.linkedTransactionId && tx.id === installment.linkedTransactionId) {
      if (tx.status === 'pending') {
        return {
          ...tx,
          date: updatedDueDate,
          amount: remainingInCreditCurrency,
          amountUsd: remainingUsd,
          notes: `Desglose Cuota #${installment.number}: Capital ${symbol}${principalAmount.toFixed(
            2
          )} + Comisión ${symbol}${feeAmount.toFixed(2)}`,
        };
      }
      if (tx.status === 'completed' && tx.currency === credit.currency) {
        return {
          ...tx,
          amount: newTotalAmount,
          amountUsd: totalInstallmentAmountUsd,
        };
      }
    }
    return tx;
  });

  return {
    ...data,
    appCredits: currentCredits.map((c, idx) => (idx === creditIndex ? updatedCredit : c)),
    transactions: updatedTransactions,
  };
}

/**
 * Elimina un crédito de app y opcionalmente sus transacciones asociadas.
 */
export function eliminarCreditoAppEnAppData(
  data: AppDataSchema,
  appCreditId: string,
  eliminarMovimientosPagados = false
): AppDataSchema {
  const currentCredits = data.appCredits ?? [];
  const target = currentCredits.find((c) => c.id === appCreditId);
  if (!target) return data;

  const pendingIds = new Set<string>();
  const allLinkedIds = new Set<string>();

  for (const inst of target.installments) {
    if (inst.linkedTransactionId) {
      allLinkedIds.add(inst.linkedTransactionId);
      if (inst.status === 'pending') {
        pendingIds.add(inst.linkedTransactionId);
      }
    }
    for (const part of inst.partialPayments ?? []) {
      if (part.linkedTransactionId) {
        allLinkedIds.add(part.linkedTransactionId);
      }
    }
  }

  if (target.depositTransactionId) {
    allLinkedIds.add(target.depositTransactionId);
  }

  const updatedTransactions = data.transactions.filter((tx) => {
    if (eliminarMovimientosPagados) {
      return !allLinkedIds.has(tx.id);
    }
    return !pendingIds.has(tx.id);
  });

  return {
    ...data,
    appCredits: currentCredits.filter((c) => c.id !== appCreditId),
    transactions: updatedTransactions,
  };
}

/**
 * Resumen ejecutivo de Créditos de Apps para el Dashboard y la vista del módulo.
 */
export function calcularResumenCreditosApp(appCredits: AppCredit[] = []): {
  activeCreditsCount: number;
  completedCreditsCount: number;
  totalDebtPendingUsd: number;
  totalPrincipalPendingUsd: number;
  totalFeesPendingUsd: number;
  totalPaidUsd: number;
  pendingInstallmentsCount: number;
  nextUpcomingInstallment: {
    credit: AppCredit;
    installment: AppCreditInstallment;
  } | null;
} {
  let activeCreditsCount = 0;
  let completedCreditsCount = 0;
  let totalDebtPendingUsd = 0;
  let totalPrincipalPendingUsd = 0;
  let totalFeesPendingUsd = 0;
  let totalPaidUsd = 0;
  let pendingInstallmentsCount = 0;

  let nextUpcomingInstallment: {
    credit: AppCredit;
    installment: AppCreditInstallment;
  } | null = null;

  for (const credit of appCredits) {
    if (credit.status === 'active') activeCreditsCount++;
    else completedCreditsCount++;

    for (const inst of credit.installments) {
      if (inst.status === 'pending') {
        const { paidUsd, remainingUsd } = obtenerEstadoAbonosCuotaCreditoApp(inst);
        const ratioRemaining =
          inst.totalInstallmentAmountUsd > 0
            ? remainingUsd / inst.totalInstallmentAmountUsd
            : 1;

        pendingInstallmentsCount++;
        totalDebtPendingUsd += remainingUsd;
        totalPrincipalPendingUsd += inst.principalAmountUsd * ratioRemaining;
        totalFeesPendingUsd += inst.feeAmountUsd * ratioRemaining;
        totalPaidUsd += paidUsd;

        if (
          !nextUpcomingInstallment ||
          inst.dueDate < nextUpcomingInstallment.installment.dueDate
        ) {
          nextUpcomingInstallment = { credit, installment: inst };
        }
      } else {
        totalPaidUsd += inst.totalInstallmentAmountUsd;
      }
    }
  }

  return {
    activeCreditsCount,
    completedCreditsCount,
    totalDebtPendingUsd: redondearMoneda(totalDebtPendingUsd),
    totalPrincipalPendingUsd: redondearMoneda(totalPrincipalPendingUsd),
    totalFeesPendingUsd: redondearMoneda(totalFeesPendingUsd),
    totalPaidUsd: redondearMoneda(totalPaidUsd),
    pendingInstallmentsCount,
    nextUpcomingInstallment,
  };
}
