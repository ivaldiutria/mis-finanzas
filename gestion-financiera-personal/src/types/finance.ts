export type CurrencyCode = 'USD' | 'VES' | 'USDT';

export type ExchangeRateSource = 'bcv' | 'manual' | 'none';

export type TransactionType = 'income' | 'expense';

export type TransactionStatus = 'completed' | 'pending';

export type ExpenseKind = 'fixed' | 'variable';

export type CategoryType = 'income' | 'expense' | 'savings';

export type SavingsMovementType = 'deposit' | 'withdrawal' | 'adjustment';

export type GoalStatus = 'active' | 'completed' | 'archived';

export type WalletKind =
  | 'digital_usd'
  | 'bank_ves'
  | 'bank_usd'
  | 'cash_usd'
  | 'cash_ves'
  | 'other';

export type NavigationSection =
  | 'dashboard'
  | 'upcoming_payments'
  | 'couples'
  | 'p2p'
  | 'installments'
  | 'app_credits'
  | 'subscriptions'
  | 'market'
  | 'wallets'
  | 'incomes'
  | 'expenses'
  | 'movements'
  | 'budgets'
  | 'savings'
  | 'goals'
  | 'debts'
  | 'wishlist'
  | 'tools'
  | 'categories'
  | 'statistics'
  | 'monthly_report'
  | 'assets'
  | 'romance_fund'
  | 'weekly_menu'
  | 'trophies'
  | 'settings';

export interface WalletAccount {
  id: string;
  name: string; // Ej. "Zelle", "Banco Nacional (Bs)", "Efectivo USD"
  type: WalletKind;
  currency: CurrencyCode; // Moneda principal referencial de la cuenta ('USD' | 'VES' | 'USDT')
  initialBalanceUsd: number; // Saldo inicial en USD de esta billetera
  initialBalanceVes?: number; // Saldo inicial nominal en Bolívares (Bs) cuando la billetera es en VES
  color: string;
  active: boolean;
  isDefault?: boolean;
  notes?: string;
  banco?: string; // Nombre de la entidad bancaria o financiera (ej. "Banco de Venezuela", "Banesco", "Mercantil", "Provincial")
  comisionPagoMovil?: number; // Porcentaje de comisión por Pago Móvil a otro banco (ej. 0.3%)
  comisionTransferencia?: number; // Valor de comisión por Transferencia a otro banco (ej. 54 Bs si es fija, o 1.5% si es porcentaje)
  comisionTransferenciaTipo?: 'fixed_ves' | 'percent'; // Tipo de comisión por transferencia ('fixed_ves' = Bs fijos [default 54], 'percent' = %)
  isBonusCard?: boolean; // Tarjeta de Bonos / Beneficios (ej. Todoticket Integral): permite cargar bono y transferir/vaciar al banco descontando comisión
  isCash?: boolean; // Indica si la billetera es dinero físico en Efectivo ($ o Bs) para discriminar Cuentas vs. Efectivo en el Dashboard
  isThirdPartyExpenseAccount?: boolean; // Cuenta cedida a un familiar/tercero (ej. Mamá): los depósitos cuentan como gasto del mes y no suman al saldo disponible propio
  isPassThroughAccount?: boolean; // Cuenta de terceros / puente externo (ej. Amigo): recibe dinero de apps de crédito o de terceros que NO es tuyo; NO suma a tus ingresos, ni gastos, ni saldo disponible
  hidePassThroughHistory?: boolean; // Permite ocultar el listado de movimientos en esta cuenta de terceros si el usuario prefiere no llevar historial visible
  beneficiaryName?: string; // Nombre de la persona que usa la cuenta (ej. "Mamá" o "Amigo")
  sortOrder?: number; // Posición personalizada definida por el usuario (0 = primera cuenta, 1 = segunda, etc.)
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string;
  active: boolean;
  isDefault?: boolean;
  monthlyLimitUsd?: number; // Límite mensual base definido en la categoría (USD)
}

export interface TransactionPurchasedItem {
  id: string;
  name: string; // Ej. "Protector solar", "Shampoo", "Vitamina C"
  quantity: number; // Ej. 1, 2
  unitPrice?: number | null; // Opcional: precio unitario/subtotal referencial si desea anotarlo
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  status?: TransactionStatus; // 'completed' (afecta saldo real) | 'pending' (afecta saldo proyectado)
  walletId?: string; // ID de la billetera (Zelle, Banco, Efectivo, etc.)
  description: string;
  categoryId: string;
  amount: number; // Original positive amount
  currency: CurrencyCode;
  exchangeRate: number | null; // VES per 1 USD when currency === 'VES'
  amountUsd: number; // Calculated USD equivalent
  exchangeRateSource: ExchangeRateSource;
  source?: string; // Optional for income (e.g., Empresa, Cliente)
  paymentMethod?: string; // Optional (e.g., Transferencia, Pago Móvil, Zelle, Efectivo)
  expenseType?: ExpenseKind; // Optional for expense: fixed | variable
  isRecurring?: boolean;
  notes: string;
  isDemo?: boolean;
  createdAt?: string;
  processedAt?: string; // Fecha y hora exacta de proceso (ISO 8601)
  sharedExpenseId?: string; // ID único de gasto compartido para evitar duplicados al importar o sincronizar
  isInterbankTransfer?: boolean; // Indica si se pagó a otro banco con comisión bancaria
  interbankFeeType?: 'pago_movil' | 'transferencia'; // Tipo de comisión aplicada
  interbankFeeAmount?: number; // Monto de la comisión calculada
  interbankFeeTxnId?: string; // ID del egreso secundario registrado por comisión
  parentTransactionId?: string; // Si este movimiento es una comisión, ID del gasto principal
  isThirdPartyAllowance?: boolean; // Indica que es un depósito/recarga a una cuenta de gasto de familiar/tercero (ej. Mamá)
  isPassThroughThirdParty?: boolean; // Indica que es un traspaso directo a cuenta de tercero/amigo (ej. desde App de Crédito) que NO suma a tus ingresos ni gastos personales
  thirdPartyTargetWalletId?: string; // ID de la cuenta familiar destino cuando el dinero se debita de una billetera propia (ej. Mercantil -> Mamá)
  storeName?: string; // Opcional: Comercio o tienda de la compra (ej. "Farmatodo")
  purchasedItems?: TransactionPurchasedItem[]; // Desglose de productos comprados en un solo pago (Tipo Compras Farmatodo)
}

export interface SavingsMovement {
  id: string;
  date: string; // YYYY-MM-DD
  type: SavingsMovementType; // deposit | withdrawal | adjustment
  walletId?: string; // Billetera de origen/destino opcional
  amountUsd: number; // Always positive number; sign for adjustment is controlled by adjustmentDirection
  adjustmentDirection?: 'add' | 'subtract'; // Only used if type === 'adjustment'
  description: string;
  categoryId: string;
  goalId?: string | null;
  originalCurrency?: CurrencyCode;
  originalAmountVes?: number | null;
  exchangeRateUsed?: number | null;
  exchangeRateSource?: ExchangeRateSource;
  notes: string;
  isDemo?: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  description: string;
  targetAmountUsd: number;
  createdAt: string; // YYYY-MM-DD
  targetDate?: string | null; // YYYY-MM-DD
  status: GoalStatus; // active | completed | archived
  color?: string;
  isDemo?: boolean;
}

export interface CategoryBudgetMap {
  [categoryId: string]: number; // USD limit for that category
}

export interface MonthlyBudget {
  id: string; // e.g. "budget_2026-10"
  monthKey: string; // YYYY-MM
  totalLimitUsd: number;
  categoryLimits: CategoryBudgetMap;
  notes?: string;
  isDemo?: boolean;
}

export type LoanKind = 'receivable' | 'payable'; // 'receivable' = Cuenta por Cobrar (me deben) | 'payable' = Cuenta por Pagar (debo)

export interface DebtPayment {
  id: string;
  date: string;
  amount: number;
  currency: CurrencyCode;
  exchangeRate: number | null;
  amountUsd: number;
  walletId?: string; // Billetera donde ingresó el cobro/pago del préstamo
  paymentMethod?: string; // Cómo lo pagó (ej. Zelle, Pago Móvil, Efectivo, Transferencia)
  linkedTransactionId?: string | null; // ID de la transacción asociada en Ingresos
  notes: string;
}

export interface Debt {
  id: string;
  kind?: LoanKind; // Por defecto 'receivable' (Dinero que yo presté a alguien)
  description: string; // Motivo o concepto del préstamo
  creditor: string; // Persona a quien le presté el dinero
  totalAmount: number;
  currency: CurrencyCode;
  exchangeRate: number | null;
  totalAmountUsd: number;
  loanDate?: string; // Fecha en que presté el dinero
  dueDate?: string | null; // Fecha acordada de pago / vencimiento
  walletId?: string; // Billetera de donde saqué el dinero para prestarlo
  initialTransactionId?: string | null; // Transacción de salida al entregar el préstamo
  payments: DebtPayment[];
  notes: string;
  status: 'pending' | 'paid';
  isDemo?: boolean;
}

export interface RateHistoryEntry {
  id: string;
  rate: number;
  source: 'bcv' | 'manual';
  apiDate: string | null;
  apiTime: string | null;
  fetchedAt: string; // ISO string
}

export type ThemeMode =
  | 'rose'
  | 'lavender'
  | 'emerald'
  | 'peach'
  | 'masculine'
  | 'neobank'
  | 'wealth'
  | 'eco'
  | 'corporate'
  | 'dark-pro'
  | 'dark-rose'
  | 'dark'
  | 'dark-purple'
  | 'dark-emerald'
  | 'dark-gold'
  | 'dark-neobank'
  | 'dark-wealth'
  | 'dark-eco'
  | 'dark-corporate';

export interface AppSettings {
  userName: string;
  baseCurrency: 'USD';
  displayCurrencyPreference: 'both' | 'usd_primary' | 'ves_primary';
  defaultExchangeRate: number | null; // Manual alternative rate
  preferManualRateByDefault: boolean;
  lastOfficialRate: number | null; // Official BCV numeric rate (full precision)
  lastOfficialRateDate: string | null; // e.g. "20/10/2026"
  lastOfficialRateTime: string | null; // e.g. "2:00:24 p. m."
  lastOfficialRateUpdatedAt: string | null; // ISO from API fechaActualizacion
  lastSuccessfulFetchAt: string | null; // Local ISO timestamp of last successful query
  startingBalanceUsd: number;
  trackingStartDate: string; // YYYY-MM-DD
  numberFormatLocale: 'es-VE' | 'en-US';
  themeMode?: ThemeMode;
}

export type WishlistPriority = 'Alta' | 'Media' | 'Baja' | 'Capricho';

export type WishlistStatus = 'Pendiente' | 'Comprado' | 'Descartado';

export interface WishlistItem {
  id: string;
  nombre: string;
  costoEstimado: number;
  moneda: CurrencyCode;
  categoriaId: string;
  prioridad: WishlistPriority;
  url?: string;
  notas?: string;
  fechaMeta?: string | null;
  estado: WishlistStatus;
  compradoTransactionId?: string | null;
  precioEstimadoUnitario?: number;
  precioRealTotal?: number;
  createdAt?: string;
  isDemo?: boolean;
}

export interface AppDataSchema {
  schemaVersion: number;
  exportedAt?: string;
  settings: AppSettings;
  wallets: WalletAccount[];
  categories: Category[];
  transactions: Transaction[];
  savings: SavingsMovement[];
  savingsGoals: SavingsGoal[];
  budgets: MonthlyBudget[];
  debts: Debt[];
  rateHistory?: RateHistoryEntry[];
  wishlist?: WishlistItem[];
  creditPurchases?: CreditPurchase[];
  p2pOperations?: P2POperation[];
  subscriptions?: Subscription[];
  appCredits?: AppCredit[];
  marketLists?: MarketList[];
  walletTransfers?: WalletTransfer[];
  assets?: Asset[];
  romanceFund?: RomanceFundState;
  weeklyMenu?: MenuSemanal;
  unlockedAchievements?: string[];
}

export interface BcvRateResponse {
  tasa: number;
  fecha: string | null;
  hora: string | null;
  fechaActualizacion: string | null;
  fuente: string;
}

// ============================================================================
// TIPOS PARA "COMPRAS A CUOTAS" (Tipo Cashea / BNPL - Buy Now Pay Later)
// ============================================================================

export type InstallmentFrequency = 'biweekly' | 'monthly';

export type InstallmentStatus = 'pending' | 'paid';

export interface CreditInstallmentPartialPayment {
  id: string;
  date: string; // YYYY-MM-DD
  amountUsd: number; // Monto abonado a la cuota en USD
  paymentCurrency: CurrencyCode; // 'USD' | 'VES'
  paymentAmountNominal: number; // Monto nominal pagado (USD o Bs)
  exchangeRate: number | null; // Tasa Bs/USD si se pagó en VES
  alreadyPaidExternally?: boolean; // Si true, se pagó antes y no descuenta de billeteras
  walletId?: string | null; // Billetera de donde salió el abono (null si fue externo)
  linkedTransactionId?: string | null; // Transacción 'completed' asociada a este abono
  notes?: string;
}

export interface CreditInstallment {
  id: string;
  number: number; // Número de cuota (1, 2, 3...)
  amountUsd: number; // Monto de la cuota en Moneda Base (USD)
  dueDate: string; // YYYY-MM-DD (Fecha de vencimiento autogenerada o editada)
  status: InstallmentStatus; // 'pending' (Pasivo -> resta al Saldo Proyectado) | 'paid' (Pagada)
  alreadyPaidExternally?: boolean; // Si true, se pagó en el pasado y no resta ni afecta al balance general ni a ninguna billetera
  linkedTransactionId: string; // ID del movimiento asociado en data.transactions ('' si alreadyPaidExternally)
  paidAt?: string | null; // YYYY-MM-DD en que se pagó
  paidWalletId?: string | null; // Billetera de donde se debitó al pagar
  paidCurrency?: CurrencyCode | null; // Moneda en que se ejecutó el pago ('USD' | 'VES')
  paidAmountNominal?: number | null; // Monto pagado en la moneda elegida (ej. Bs a tasa vigente)
  paidExchangeRate?: number | null; // Tasa Bs/USD aplicada si se pagó en VES
  partialPayments?: CreditInstallmentPartialPayment[]; // Historial de abonos parciales a la cuota
  paidProgressAmountUsd?: number; // Total abonado hasta ahora en USD
  notes?: string;
}

export interface CreditPurchase {
  id: string;
  concept: string; // Concepto o producto adquirido
  storeOrPlatform: string; // Ej. "Cashea", "Krece", "Crédito Directo"
  categoryId: string;
  purchaseDate: string; // YYYY-MM-DD
  baseCurrency: 'USD'; // Moneda Base de la compra a crédito
  totalAmountUsd: number; // Monto Total de la compra en USD
  initialPaymentUsd: number; // Pago Inicial en USD
  initialAlreadyPaidExternally?: boolean; // Si true, la inicial ya se había pagado antes y no descuenta del balance actual
  initialPaymentWalletId: string; // Billetera donde se debitó la inicial (o '' si ya fue pagada antes)
  initialPaymentCurrency: CurrencyCode; // 'USD' | 'VES'
  initialPaymentAmountNominal: number; // Monto nominal pagado en la inicial
  initialPaymentExchangeRate: number | null; // Tasa Bs/USD si la inicial fue pagada en VES
  initialTransactionId: string; // ID del egreso inmediato ('completed') en data.transactions ('' si initialAlreadyPaidExternally)
  financedAmountUsd: number; // Monto financiado en cuotas (totalAmountUsd - initialPaymentUsd)
  frequency: InstallmentFrequency; // 'biweekly' (Quincenal cada 14 días) | 'monthly' (Mensual)
  installmentsCount: number; // Cantidad de cuotas
  installments: CreditInstallment[];
  status: 'active' | 'completed';
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

// ============================================================================
// TIPOS PARA "FINANZAS EN PAREJA" (Hub de Pareja con claves independientes)
// Claves en localStorage: shared_expenses, shared_savings, shared_goals, shared_contributions
// ============================================================================

export type SharedPayer = 'me' | 'partner';

export type SharedSplitType = '50_50' | 'custom_me_pct' | '100_other';

export interface SharedExpense {
  id: string; // ID único para validación de exportación/importación sin duplicados
  date: string; // YYYY-MM-DD
  concept: string; // Concepto o descripción del gasto
  categoryId: string;
  categoryName: string;
  amount: number; // Monto original positivo
  currency: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Bs/USD cuando currency === 'VES'
  amountUsd: number; // Equivalente calculado en USD
  exchangeRateSource: ExchangeRateSource;
  payer: SharedPayer; // 'me' (Yo) | 'partner' (Pareja)
  splitType: SharedSplitType; // Por defecto '50_50' (50% cada uno)
  mySharePct: number; // Porcentaje que me corresponde asumir (ej. 50)
  partnerSharePct: number; // Porcentaje que le corresponde asumir a mi pareja (ej. 50)
  walletId?: string; // Billetera personal de donde salió si payer === 'me'
  linkedPersonalTransactionId?: string | null; // ID del egreso creado en Finanzas Personales cuando payer === 'me'
  settled?: boolean; // Si la deuda de este gasto ya fue saldada
  notes?: string;
  createdAt: string;
}

export interface SharedSavingContribution {
  id: string;
  date: string; // YYYY-MM-DD
  contributor: SharedPayer; // 'me' | 'partner'
  amountUsd: number; // Exclusivamente en USD para el fondo acumulador
  description: string;
  goalId?: string | null; // Meta en pareja vinculada (opcional)
  walletId?: string; // Si contributor === 'me' y se descontó de billetera personal
  linkedPersonalTransactionId?: string | null;
  notes?: string;
  createdAt: string;
}

export interface SharedCoupleGoal {
  id: string;
  name: string;
  description: string;
  targetAmountUsd: number; // Monto meta en USD
  targetDate: string | null; // YYYY-MM-DD
  isPrimary?: boolean; // Meta principal destacada en el Resumen Rápido
  color: string;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface SharedMonthlyContribution {
  id: string;
  monthKey: string; // YYYY-MM
  title: string; // Ej. "Cuota Fondo Común Octubre"
  myQuotaUsd: number;
  partnerQuotaUsd: number;
  myCompleted: boolean;
  partnerCompleted: boolean;
  myCompletedAt?: string | null;
  partnerCompletedAt?: string | null;
  linkedMySavingId?: string | null; // Si al marcar completado se sumó a shared_savings
  linkedPartnerSavingId?: string | null;
  notes?: string;
}

export interface ExportedPartnerExpensesPayload {
  exportFormat: 'mis_finanzas_shared_partner_expenses_v1';
  exportedAt: string;
  exportedBy: string;
  count: number;
  totalUsd: number;
  expenses: {
    id: string;
    concept: string;
    amount: number;
    currency: CurrencyCode;
    exchangeRate: number | null;
    amountUsd: number;
    date: string;
    categoryId: string;
    categoryName: string;
    payer: SharedPayer;
    notes?: string;
  }[];
}

// ============================================================================
// TIPOS PARA "CAMBIOS P2P Y CUENTAS POR COBRAR" (Deudores / Exchange P2P)
// Entorno multimoneda: Bs, USD, USDT
// ============================================================================

export type P2POperationType = 'currency_exchange' | 'loan';

export type P2POperationStatus = 'in_transit' | 'settled';

export type P2PDirection = 'receivable' | 'payable'; // 'receivable' = Me deben (Por Cobrar) | 'payable' = Yo debo entregar (Por Entregar)

export interface P2POperation {
  id: string;
  contactName: string; // Persona o contacto (ej. "Carlos Gómez", "Binance P2P", "Familiar")
  operationType: P2POperationType; // 'currency_exchange' (Cambio) | 'loan' (Préstamo)
  direction?: P2PDirection; // 'receivable' (Me deben entregar) | 'payable' (Yo debo entregar en otra fecha, ya recibí su parte)
  concept?: string; // Concepto o detalle breve (ej. "Cambio Bs por Efectivo USD")
  
  // Si direction === 'receivable': indica que yo ya pagué mi parte antes (no descuenta de mi Wallet Origen hoy)
  // Si direction === 'payable': indica que yo ya recibí el dinero antes (no vuelve a sumar a mi Wallet Destino hoy)
  alreadyPaidExternally?: boolean;

  // Monto que YO entrego / sale de mí (en 'receivable' sale hoy o se pagó antes; en 'payable' es lo que YO DEBO entregar en otra fecha)
  deliveredAmount: number; // Monto entregado o por entregar en moneda de origen
  deliveredCurrency: CurrencyCode; // 'VES' | 'USD' | 'USDT'
  deliveredAmountUsd: number; // Equivalente calculado en USD
  sourceWalletId: string; // Wallet de origen de donde sale el dinero (o donde se debitará cuando entregue los $)
  
  // Monto que YO recibo de la contraparte (en 'receivable' es Cuenta por Cobrar pendiente; en 'payable' es lo que ya me pasaron en Bs/divisas)
  expectedAmount: number; // Monto pactado recibido o por recibir
  expectedCurrency: CurrencyCode; // 'USD' | 'VES' | 'USDT'
  expectedAmountUsd: number; // Equivalente calculado en USD
  destinationWalletId: string; // Wallet destino donde entra o entró el dinero
  
  // Tasa de cambio pactada entre las partes
  agreedRate: number | null; // Tasa pactada (ej. 65.50 Bs/USD o 1.00 si USDT/USD)
  rateDescription?: string; // Ej: "1 USD = 65,50 Bs" o "1:1 Paridad"
  
  // Fechas y Estado
  operationDate: string; // YYYY-MM-DD (Fecha en que se entregó el dinero o se pactó)
  estimatedSettlementDate?: string | null; // YYYY-MM-DD (Fecha estimada de cobro)
  status: P2POperationStatus; // 'in_transit' (En Tránsito) | 'settled' (Liquidado)
  settledAt?: string | null; // YYYY-MM-DD (Fecha real de cobro)
  settledWalletId?: string | null; // Billetera en la que se recibió efectivamente
  settledAmount?: number | null; // Monto efectivamente recibido al liquidar
  
  // Comisión bancaria opcional cuando se entrega/paga en Bolívares (VES)
  hasBankFee?: boolean;
  bankFeeType?: 'none' | 'pago_movil' | 'transferencia' | 'custom';
  bankFeeAmount?: number; // Monto de la comisión en VES
  bankFeeAmountUsd?: number; // Equivalente en USD de la comisión

  // Trazabilidad contable estricta
  outflowTransactionId: string; // ID del egreso completado ('completed') en sourceWalletId ('' si alreadyPaidExternally)
  inflowTransactionId: string; // ID del ingreso vinculado ('pending' en tránsito -> 'completed' al liquidar)
  feeTransactionId?: string; // ID del egreso por comisión bancaria vinculado ('completed' en sourceWalletId)
  
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

export interface MonthlyFinancialSummary {
  monthKey: string;
  ingresosMesUsd: number;
  ingresosMesVesOriginal: number;
  gastosMesUsd: number;
  gastosMesVesOriginal: number;
  balanceNetoMensualUsd: number;
  capacidadAhorroMensualUsd: number;
  porcentajeGastosSobreIngresos: number;
  ahorroAportadoMesUsd: number;
  ahorroRetiradoMesUsd: number;
  ahorroNetoMesUsd: number;
  dineroDisponibleEstimadoUsd: number;
  totalAhorradoUsd: number;
  patrimonioFinancieroUsd: number;
  ingresosPendientesMesUsd: number;
  gastosPendientesMesUsd: number;
  ingresosPendientesTotalUsd: number;
  gastosPendientesTotalUsd: number;
  cantidadPendientesMes: number;
  cantidadPendientesTotal: number;
  balanceProyectadoMesUsd: number;
  saldoProyectadoUsd: number;
  patrimonioProyectadoUsd: number;
  presupuestoMensualUsd: number;
  presupuestoRestanteUsd: number;
  presupuestoExcedidoUsd: number;
  porcentajePresupuestoUtilizado: number;
  ingresosMesAnteriorUsd: number;
  gastosMesAnteriorUsd: number;
  variacionIngresosPct: number | null;
  variacionGastosPct: number | null;
}

// ============================================================================
// TIPOS PARA "GESTOR DE SUSCRIPCIONES" (Recurrentes Multimoneda + Proyección)
// ============================================================================

export type SubscriptionFrequency = 'monthly' | 'annual';

export type SubscriptionStatus = 'active' | 'paused';

export interface SubscriptionPaymentRecord {
  id: string;
  paidDate: string; // YYYY-MM-DD en que se ejecutó el pago
  previousBillingDate: string; // YYYY-MM-DD de corte que se cubrió
  nextBillingDateAfterPay: string; // YYYY-MM-DD al que avanzó el ciclo
  walletId: string; // Billetera de donde se debitó el egreso real
  amount: number; // Monto nominal pagado en la moneda elegida
  currency: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Tasa oficial BCV o manual aplicada si se pagó en Bs
  amountUsd: number; // Equivalente en USD descontado del Saldo Real
  linkedTransactionId: string; // ID del movimiento 'completed' generado en data.transactions
  notes?: string;
}

export interface Subscription {
  id: string;
  name: string; // Nombre del servicio (ej. "Netflix", "Spotify", "Internet Fibra")
  categoryId: string; // Categoría asociada (por defecto 'cat_exp_subscriptions')
  amount: number; // Monto nominal en la moneda de la suscripción
  currency: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Tasa referencial Bs/USD cuando currency === 'VES'
  amountUsd: number; // Equivalente base en USD para proyección
  frequency: SubscriptionFrequency; // 'monthly' (Mensual) | 'annual' (Anual)
  nextBillingDate: string; // YYYY-MM-DD (Fecha de Próximo Cobro)
  alertDaysBefore: number; // Días de Aviso previos al corte para resaltar alerta (ej. 3, 5, 7)
  status: SubscriptionStatus; // 'active' (Resta al Saldo Proyectado) | 'paused' (No resta)
  defaultWalletId?: string; // Billetera sugerida por defecto al registrar el pago
  lastPaidDate?: string | null; // YYYY-MM-DD del último pago confirmado
  paymentHistory?: SubscriptionPaymentRecord[]; // Historial de cobros confirmados
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

// ============================================================================
// TIPOS PARA "CRÉDITOS DE APPS" (Tipo Ubii App, Avila Pay, Microcréditos)
// ============================================================================

export type AppCreditStatus = 'active' | 'paid';

export type AppCreditInstallmentStatus = 'pending' | 'paid';

export interface AppCreditInstallmentPartialPayment {
  id: string;
  date: string; // YYYY-MM-DD
  amountInCreditCurrency: number; // Monto abonado a la cuota en la moneda del crédito (ej. $5.00)
  amountUsd: number; // Equivalente en USD abonado a la cuota
  paymentCurrency: CurrencyCode; // Moneda usada en el pago ('USD' | 'VES')
  paymentAmountNominal: number; // Monto nominal pagado (ej. Bs o $)
  exchangeRate: number | null; // Tasa aplicada si se pagó en Bs
  alreadyPaidExternally?: boolean; // Si este abono se pagó antes (no afecta Saldo Real de billeteras)
  paidByThirdPartyDirect?: boolean; // Si un amigo/tercero pagó directo a la app sin pasar por tus cuentas personales
  thirdPartyPayerName?: string | null; // Nombre del amigo/tercero que pagó directo a la app
  linkedDebtPaymentId?: string | null; // ID del abono registrado en el préstamo por cobrar (Debt) si se descontó de su deuda
  walletId?: string | null; // Billetera de donde salió el abono (null si fue externo o directo de tercero sin cuenta)
  linkedTransactionId?: string | null; // Transacción 'completed' asociada a este abono
  notes?: string;
}

export interface AppCreditInstallment {
  id: string;
  number: number; // 1, 2, 3...
  dueDate: string; // YYYY-MM-DD (calculada sumando i * frequencyDays a la fecha de solicitud)
  principalAmount: number; // Capital por cuota en la moneda del crédito (ej. $25)
  feeAmount: number; // Comisión fija por cuota en la moneda del crédito (ej. $2)
  totalInstallmentAmount: number; // Capital + Comisión (ej. $27)
  principalAmountUsd: number; // Equivalente en USD del capital
  feeAmountUsd: number; // Equivalente en USD de la comisión
  totalInstallmentAmountUsd: number; // Equivalente en USD total que resta al Saldo Proyectado
  status: AppCreditInstallmentStatus; // 'pending' | 'paid'
  alreadyPaidExternally?: boolean; // Si fue pagada antes de usar la app (no afecta Saldo Real)
  paidByThirdPartyDirect?: boolean; // Si un amigo/tercero pagó directo a la app sin pasar por tus cuentas personales
  thirdPartyPayerName?: string | null; // Nombre del amigo/tercero que pagó directo a la app
  linkedDebtPaymentId?: string | null; // ID del pago registrado en el préstamo por cobrar (Debt) si se descontó de su deuda
  linkedTransactionId: string; // ID de la transacción en data.transactions ('pending' -> 'completed')
  paidAt?: string | null; // YYYY-MM-DD de confirmación de pago
  paidWalletId?: string | null; // Billetera de donde se debitó el pago real
  paidCurrency?: CurrencyCode | null; // 'USD' | 'VES'
  paidAmountNominal?: number | null; // Monto nominal pagado
  paidExchangeRate?: number | null; // Tasa BCV o manual aplicada si se pagó en Bs
  partialPayments?: AppCreditInstallmentPartialPayment[]; // Historial de abonos parciales a la cuota
  paidProgressAmount?: number; // Total abonado hasta ahora en la moneda del crédito
  paidProgressAmountUsd?: number; // Total abonado hasta ahora en USD
  notes?: string;
}

export interface AppCredit {
  id: string;
  appName: string; // Ej. "Ubii App", "Avila Pay", "Krece", etc.
  concept?: string; // Descripción opcional del crédito o destino de fondos
  categoryId: string; // Categoría asociada para las cuotas
  requestDate: string; // YYYY-MM-DD (Fecha de solicitud / inicio del crédito)
  requestedAmount: number; // Monto Solicitado (Capital total, ej. $100)
  currency: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Tasa referencial Bs/USD si currency === 'VES'
  requestedAmountUsd: number; // Capital solicitado en USD
  installmentsCount: number; // Cantidad de Cuotas (ej. 4)
  frequencyDays: number; // Frecuencia en días entre cuotas (ej. 14 o 15 días)
  feePerInstallment: number; // Comisión fija por cada cuota en la moneda del crédito (ej. $2)
  feePerInstallmentUsd: number; // Comisión por cuota en USD
  totalFeeAmount: number; // Comisión total (feePerInstallment * installmentsCount)
  totalToPayAmount: number; // Capital + Comisión total (requestedAmount + totalFeeAmount)
  totalToPayAmountUsd: number; // Total a pagar en USD
  depositToWallet?: boolean; // Si el monto solicitado ingresó a una billetera al aprobarse
  depositDestinationMode?: 'personal_wallet' | 'third_party_direct' | 'none'; // 'personal_wallet' = Mi cuenta | 'third_party_direct' = Pasado directo a cuenta de tercero/amigo (no suma ingreso) | 'none' = Sin abonar
  thirdPartyRecipientName?: string | null; // Nombre del amigo/tercero al que se le pasó directo el dinero desde la app
  linkedLoanId?: string | null; // ID del préstamo por cobrar (Debt) creado si el crédito se pidió para prestárselo a un amigo
  depositWalletId?: string | null;
  depositTransactionId?: string | null;
  depositCurrency?: CurrencyCode | null; // Moneda en la que se acreditó en la billetera ('VES' | 'USD')
  depositGrossAmountNominal?: number | null; // Monto bruto convertido a tasa BCV antes de comisión de retiro (ej. 8862.27)
  depositBankFeePercent?: number | null; // % de comisión cobrada por pasar el dinero al banco (ej. 0.5%)
  depositBankFeeAmountNominal?: number | null; // Comisión descontada al pasar al banco (ej. 44.31)
  depositAmountNominal?: number | null; // Monto neto final abonado a la cuenta (ej. 8817.96)
  depositExchangeRate?: number | null; // Tasa BCV aplicada al convertir los $ del préstamo a Bs
  installments: AppCreditInstallment[]; // Arreglo autogenerado de objetos 'Cuota'
  status: AppCreditStatus; // 'active' (Activo) | 'paid' (Pagado)
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

// ============================================================================
// TIPOS PARA "LISTA DE MERCADO SIMPLE" (Checklist táctil, Paradas, Proyección)
// ============================================================================

export type MarketCategoryStop =
  | 'Feria/Hortalizas'
  | 'Carnicería'
  | 'Charcutería'
  | 'Supermercado/Víveres'
  | 'Limpieza/Aseo'
  | 'Otros';

export type MarketListStatus = 'abierta' | 'cerrada';

export interface MarketItem {
  id: string;
  nombre: string;
  categoria: MarketCategoryStop;
  comprado: boolean;
  cantidad?: number;
  montoUnitario?: number;
  precioEstimadoUnitario?: number;
  precioRealTotal?: number;
  notes?: string;
}

export interface MarketList {
  id: string;
  nombre: string; // Ej: "Mercado Quincenal", "Compras del Sábado"
  presupuestoEstimado: number; // Presupuesto Global Estimado
  moneda: CurrencyCode; // 'USD' | 'VES'
  exchangeRate?: number | null; // Tasa referencial si moneda === 'VES'
  presupuestoEstimadoUsd: number; // Monto que resta del Saldo Proyectado mientras esté abierta
  totalPagadoReal: number | null; // Monto real pagado al cerrar la lista
  totalPagadoRealUsd: number | null; // Equivalente en USD del pago real
  fecha: string; // YYYY-MM-DD
  estado: MarketListStatus; // 'abierta' | 'cerrada'
  items: MarketItem[]; // Ítems individuales (con cantidad y montoUnitario opcionales)
  walletId?: string | null; // Billetera de donde se debitó al cerrar
  linkedPendingTransactionId?: string; // ID de transacción 'pending' que resta del Saldo Proyectado
  linkedCompletedTransactionId?: string | null; // ID de transacción 'completed' que descuenta del Saldo Real
  closedAt?: string | null; // Fecha / timestamp en que se cerró la lista
  paymentCurrency?: CurrencyCode | null; // Moneda en la que se ejecutó el pago al cerrar
  paymentExchangeRate?: number | null; // Tasa aplicada si se pagó en Bs
  paymentMode?: 'contado' | 'cashea'; // Modalidad de cierre: 100% contado hoy o financiado con Cashea / Cuotas
  paidTodayAmount?: number | null; // Monto pagado el día del cierre (Inicial + Contado) en paymentCurrency
  paidTodayAmountUsd?: number | null; // Equivalente en USD de lo pagado el día del cierre
  casheaFinancedUsd?: number | null; // Saldo restante en USD que quedó financiado en cuotas de Cashea
  casheaInstallmentsCount?: number | null; // Número de cuotas generadas en Cashea
  casheaStoreOrPlatform?: string | null; // Plataforma o comercio (ej. "Cashea")
  linkedCreditPurchaseId?: string | null; // ID del registro CreditPurchase creado automáticamente
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

// ============================================================================
// TIPOS PARA "TRANSFERENCIAS ENTRE WALLETS CON TASA PERSONALIZADA" (Conversor P2P)
// No se registra como Gasto ni como Ingreso regular para no ensuciar estadísticas
// ============================================================================

export interface WalletTransfer {
  id: string;
  date: string; // YYYY-MM-DD
  sourceWalletId: string; // Wallet Origen
  sourceCurrency: CurrencyCode; // Moneda de la Wallet Origen ('USD' | 'USDT' | 'VES')
  amountOut: number; // Monto a debitar en la moneda origen
  destinationWalletId: string; // Wallet Destino
  destinationCurrency: CurrencyCode; // Moneda de la Wallet Destino ('USD' | 'USDT' | 'VES')
  amountIn: number; // Monto a acreditar en la moneda destino
  exchangeRate: number; // Tasa de cambio aplicada en esta operación
  feeAmount?: number; // Comisión bancaria descontada (si aplica)
  feeTransactionId?: string; // ID del egreso de comisión asociado en data.transactions
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
}

// ============================================================================
// MÓDULO 1: BÓVEDA DE GARANTÍAS Y MANTENIMIENTO (ASSET TRACKER)
// ============================================================================

export interface AssetMaintenanceRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  costo: number; // Monto nominal pagado
  moneda: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Tasa Bs/USD si se pagó en VES
  costoUsd: number; // Equivalente en USD del mantenimiento
  walletId: string; // Billetera de donde salió el egreso real
  linkedTransactionId: string; // ID del egreso regular creado en data.transactions
  notas?: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  nombre: string; // Ej: "Aire Acondicionado", "Nevera Inverter", "Laptop MacBook"
  costo: number; // Costo de adquisición en moneda origen
  moneda: CurrencyCode; // 'USD' | 'VES'
  exchangeRate?: number | null;
  costoUsd: number; // Costo equivalente en USD
  fechaCompra: string; // YYYY-MM-DD
  mesesGarantia: number; // Duración de la garantía en meses (ej. 12, 24)
  frecuenciaMantenimientoMeses: number; // Cada cuántos meses requiere mantenimiento (ej. 6)
  historialMantenimiento: AssetMaintenanceRecord[];
  notas?: string;
  createdAt: string;
  isDemo?: boolean;
}

export type AssetAlertLevel = 'ok' | 'warning' | 'urgent';

export interface AssetStatusEvaluation {
  asset: Asset;
  warrantyExpirationDate: string; // YYYY-MM-DD
  daysUntilWarrantyExpires: number; // Negativo si ya expiró
  isWarrantyExpired: boolean;
  isWarrantyExpiringSoon: boolean; // <= 30 días y >= 0
  lastMaintenanceDate: string | null; // YYYY-MM-DD del último mantenimiento
  nextMaintenanceDate: string | null; // YYYY-MM-DD del próximo mantenimiento
  daysUntilNextMaintenance: number | null; // Negativo si está vencido
  isMaintenanceDueSoon: boolean; // <= 30 días
  isMaintenanceOverdue: boolean; // < 0 días
  alertLevel: AssetAlertLevel; // 'ok' | 'warning' | 'urgent'
  totalMaintenanceSpentUsd: number;
}

// ============================================================================
// MÓDULO 2: FONDO DE CITAS Y 'RULETA DE CITAS' (ROMANCE BUDGET)
// ============================================================================

export type RomanceFundMovementType = 'allocate' | 'spend' | 'return';

export interface RomanceFundMovement {
  id: string;
  type: RomanceFundMovementType; // 'allocate' (Asignar al fondo) | 'spend' (Gastar en cita) | 'return' (Devolver al saldo disponible)
  date: string; // YYYY-MM-DD
  amount: number; // Monto nominal en la moneda elegida
  currency: CurrencyCode; // 'USD' | 'VES'
  exchangeRate: number | null; // Tasa aplicada si es VES
  amountUsd: number; // Equivalente en USD que suma o resta al fondo
  walletId?: string; // Billetera de donde se apartó o gastó
  linkedTransactionId?: string | null; // ID del egreso general en data.transactions cuando type === 'spend'
  planName?: string; // Plan sugerido o elegido (ej. 'Cine/Hamburguesas')
  notes?: string; // Notas o recuerdos de la cita (ej. 'Cita mensual')
  createdAt: string;
}

export interface RomanceFundState {
  balanceUsd: number; // Saldo disponible acumulado actualmente en el Fondo Virtual de Citas
  movements: RomanceFundMovement[]; // Historial de asignaciones y gastos de citas
}

export type RomanceRouletteBracket = 'low' | 'mid' | 'high';

export interface RomanceRouletteSuggestion {
  bracket: RomanceRouletteBracket; // 'low' (<$10) | 'mid' ($10-$30) | 'high' (>$30)
  bracketLabel: string; // Ej: "< $10 USD", "$10 – $30 USD", "> $30 USD"
  planTitle: string; // Ej: "Helados y Caminata al Atardecer"
  planCategory: string; // Ej: "Helados/Caminar", "Cine/Hamburguesas", "Cena/Especial"
  description: string;
  estimatedCostRange: string;
  availableBalanceUsd: number;
}

// ============================================================================
// CÁPSULA DEL TIEMPO FINANCIERA (SPOTIFY WRAPPED STYLE)
// ============================================================================

export interface YearlyWrappedReport {
  year: number;
  totalSpentYearUsd: number;
  totalSpentYearVesEquiv: number;
  totalExpensesCount: number;
  topCategory: {
    categoryId: string;
    categoryName: string;
    color: string;
    totalUsd: number;
    percentage: number;
    count: number;
  } | null;
  totalCreditInstallmentsPaid: number;
  totalCreditInstallmentsPaidUsd: number;
  mostExpensiveHomeItem: {
    name: string;
    amountUsd: number;
    sourceLabel: string; // Ej: "Bóveda de Garantías", "Lista de Mercado", "Hogar / Mercado"
    date: string;
  } | null;
  totalRomanceSpentUsd: number;
  romanceDatesCount: number;
  lastRomanceMemory: string | null;
}

// ============================================================================
// SALA DE TROFEOS Y LOGROS (GAMIFICACIÓN FINANCIERA)
// ============================================================================

export interface TrophyProgressInfo {
  current: number;
  target: number;
  unitLabel: string;
  detailText: string;
}

export interface TrophyDefinition {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  categoriaLabel: string;
  evaluator: (storageData: AppDataSchema) => boolean;
  getProgress?: (storageData: AppDataSchema) => TrophyProgressInfo;
}

export interface TrophyEvaluationItem extends TrophyDefinition {
  unlocked: boolean;
  progress: TrophyProgressInfo;
}

export interface TrophyCheckResult {
  unlockedIds: string[];
  newlyUnlockedIds: string[];
  trophies: TrophyEvaluationItem[];
  totalCount: number;
  unlockedCount: number;
}

// ============================================================================
// PLANIFICADOR DE MENÚ SEMANAL (CONEXIÓN CON LISTA DE MERCADO)
// ============================================================================

export type DayOfWeekKey =
  | 'Lunes'
  | 'Martes'
  | 'Miércoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sábado'
  | 'Domingo';

export type MealType = 'Desayuno' | 'Almuerzo' | 'Cena';

export interface MealItem {
  id: string;
  nombre: string; // Nombre del plato (ej. "Arepas con perico", "Pollo a la plancha con arroz")
  tipo: MealType; // 'Desayuno' | 'Almuerzo' | 'Cena'
  ingredientes: string[]; // Arreglo de ingredientes en texto plano
  notas?: string;
  createdAt?: string;
}

export interface MenuSemanal {
  id: string;
  nombreSemana: string;
  dias: Record<DayOfWeekKey, MealItem[]>;
  updatedAt: string;
}


