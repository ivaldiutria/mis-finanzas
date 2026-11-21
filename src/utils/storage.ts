import {
  CURRENT_SCHEMA_VERSION,
  INITIAL_CATEGORIES,
  INITIAL_SETTINGS,
  INITIAL_WALLETS,
  createInitialAppData,
} from '../data/defaultData';
import {
  AppCredit,
  AppCreditInstallment,
  AppDataSchema,
  Category,
  CreditInstallment,
  CreditPurchase,
  Debt,
  MarketCategoryStop,
  MarketItem,
  MarketList,
  MonthlyBudget,
  P2POperation,
  SavingsGoal,
  SavingsMovement,
  Subscription,
  SubscriptionPaymentRecord,
  ThemeMode,
  AppSettings,
  Transaction,
  TransactionPurchasedItem,
  WalletAccount,
  WalletKind,
  WalletTransfer,
  CurrencyCode,
  Asset,
  AssetMaintenanceRecord,
  AssetStatusEvaluation,
  RomanceFundMovement,
  RomanceFundState,
  RomanceRouletteSuggestion,
  YearlyWrappedReport,
  TrophyDefinition,
  TrophyEvaluationItem,
  TrophyCheckResult,
  DayOfWeekKey,
  MealItem,
  MealType,
  MenuSemanal,
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from '../types/finance';
import {
  calcularDistribucionPorCategoria,
  calcularEquivalenteUsd,
  calcularEstadoAsset,
  calcularResumenBilleteras,
  calcularResumenFinanciero,
  compararRegistrosConHoraRecientesPrimero,
  compararTransaccionesPorFechaYHoraProceso,
  compararTransaccionesRecientesPrimero,
  esTransaccionCompletada,
  evaluarRuletaDeCitas,
  formatearNombreMes,
  normalizarCategoriaGastoComision,
  obtenerFechaEfectivaContableTransaccion,
  obtenerFechaLocalIso,
  obtenerIdCategoriaComisionBancaria,
} from './calculations';
import {
  UpdateMarketItemInput,
  UpdateMarketListInput,
  actualizarItemMercadoEnAppData,
  actualizarListaMercadoEnAppData,
  agregarItemAListaEnAppData,
  crearListaMercado,
} from './marketController';

export const STORAGE_KEY = 'mis_finanzas_personal_app_v1';

export const DAYS_OF_WEEK: DayOfWeekKey[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export const MEAL_TYPES_ORDER: Record<MealType, number> = {
  Desayuno: 1,
  Almuerzo: 2,
  Cena: 3,
};

export function createEmptyWeeklyMenu(): MenuSemanal {
  return {
    id: 'weekly_menu_default',
    nombreSemana: 'Menú Semanal del Hogar',
    dias: {
      Lunes: [],
      Martes: [],
      Miércoles: [],
      Jueves: [],
      Viernes: [],
      Sábado: [],
      Domingo: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Valida y normaliza un objeto de respaldo JSON antes de restaurarlo o guardarlo.
 * Lanza un Error descriptivo si el archivo es inválido o corrupto.
 */
export function validarYNormalizarRespaldo(raw: unknown): AppDataSchema {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El archivo seleccionado no contiene un objeto JSON válido.');
  }

  const obj = raw as Record<string, unknown>;

  if (
    typeof obj.schemaVersion !== 'number' ||
    !Number.isInteger(obj.schemaVersion) ||
    obj.schemaVersion < 1 ||
    obj.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    throw new Error(
      `Versión de esquema incompatible o inexistente (se esperaba schemaVersion: ${CURRENT_SCHEMA_VERSION}).`
    );
  }

  if (!obj.settings || typeof obj.settings !== 'object') {
    throw new Error('El respaldo no incluye el bloque obligatorio "settings".');
  }

  if (!Array.isArray(obj.categories) || !Array.isArray(obj.transactions)) {
    throw new Error('El respaldo no incluye las listas de "categories" o "transactions".');
  }

  const rawSettings = obj.settings as Record<string, unknown>;

  // Validar tasa oficial: nunca guardar un valor ficticio, 0 o NaN; siempre con 2 decimales
  const lastOfficialRate =
    typeof rawSettings.lastOfficialRate === 'number' &&
    Number.isFinite(rawSettings.lastOfficialRate) &&
    rawSettings.lastOfficialRate > 0
      ? Number(rawSettings.lastOfficialRate.toFixed(2))
      : null;

  const defaultExchangeRate =
    typeof rawSettings.defaultExchangeRate === 'number' &&
    Number.isFinite(rawSettings.defaultExchangeRate) &&
    rawSettings.defaultExchangeRate > 0
      ? Number(rawSettings.defaultExchangeRate.toFixed(2))
      : null;

  const startingBalanceUsd =
    typeof rawSettings.startingBalanceUsd === 'number' &&
    Number.isFinite(rawSettings.startingBalanceUsd)
      ? rawSettings.startingBalanceUsd
      : 0;

  const settings: AppSettings = {
    ...INITIAL_SETTINGS,
    userName:
      typeof rawSettings.userName === 'string' && rawSettings.userName.trim().length > 0
        ? rawSettings.userName.trim().slice(0, 60)
        : INITIAL_SETTINGS.userName,
    baseCurrency: 'USD' as const,
    displayCurrencyPreference:
      rawSettings.displayCurrencyPreference === 'usd_primary' ||
      rawSettings.displayCurrencyPreference === 'ves_primary' ||
      rawSettings.displayCurrencyPreference === 'both'
        ? (rawSettings.displayCurrencyPreference as 'both' | 'usd_primary' | 'ves_primary')
        : ('both' as const),
    defaultExchangeRate,
    preferManualRateByDefault: Boolean(rawSettings.preferManualRateByDefault),
    lastOfficialRate,
    lastOfficialRateDate:
      typeof rawSettings.lastOfficialRateDate === 'string'
        ? rawSettings.lastOfficialRateDate
        : null,
    lastOfficialRateTime:
      typeof rawSettings.lastOfficialRateTime === 'string'
        ? rawSettings.lastOfficialRateTime
        : null,
    lastOfficialRateUpdatedAt:
      typeof rawSettings.lastOfficialRateUpdatedAt === 'string'
        ? rawSettings.lastOfficialRateUpdatedAt
        : null,
    lastSuccessfulFetchAt:
      typeof rawSettings.lastSuccessfulFetchAt === 'string'
        ? rawSettings.lastSuccessfulFetchAt
        : null,
    startingBalanceUsd,
    trackingStartDate:
      typeof rawSettings.trackingStartDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(rawSettings.trackingStartDate)
        ? rawSettings.trackingStartDate
        : INITIAL_SETTINGS.trackingStartDate,
    numberFormatLocale:
      rawSettings.numberFormatLocale === 'en-US' ? ('en-US' as const) : ('es-VE' as const),
    themeMode:
      rawSettings.themeMode === 'rose' ||
      rawSettings.themeMode === 'lavender' ||
      rawSettings.themeMode === 'emerald' ||
      rawSettings.themeMode === 'peach' ||
      rawSettings.themeMode === 'masculine' ||
      rawSettings.themeMode === 'neobank' ||
      rawSettings.themeMode === 'wealth' ||
      rawSettings.themeMode === 'eco' ||
      rawSettings.themeMode === 'corporate' ||
      rawSettings.themeMode === 'dark-pro' ||
      rawSettings.themeMode === 'dark-rose' ||
      rawSettings.themeMode === 'dark' ||
      rawSettings.themeMode === 'dark-purple' ||
      rawSettings.themeMode === 'dark-emerald' ||
      rawSettings.themeMode === 'dark-gold' ||
      rawSettings.themeMode === 'dark-neobank' ||
      rawSettings.themeMode === 'dark-wealth' ||
      rawSettings.themeMode === 'dark-eco' ||
      rawSettings.themeMode === 'dark-corporate'
        ? (rawSettings.themeMode as ThemeMode)
        : ('rose' as const),
  };

  // Validar categorías
  const seenCatIds = new Set<string>();
  const categories: Category[] = [];

  for (const item of obj.categories) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id.trim()) continue;
    if (seenCatIds.has(c.id)) continue;
    if (c.type !== 'income' && c.type !== 'expense' && c.type !== 'savings') continue;
    if (typeof c.name !== 'string' || !c.name.trim()) continue;

    seenCatIds.add(c.id);
    categories.push({
      id: c.id.trim(),
      name: c.name.trim(),
      type: c.type,
      color: typeof c.color === 'string' && c.color.trim() ? c.color.trim() : '#C86D85',
      icon: typeof c.icon === 'string' && c.icon.trim() ? c.icon.trim() : 'Tag',
      active: c.active !== false,
      isDefault: Boolean(c.isDefault),
      monthlyLimitUsd:
        typeof c.monthlyLimitUsd === 'number' &&
        Number.isFinite(c.monthlyLimitUsd) &&
        c.monthlyLimitUsd >= 0
          ? c.monthlyLimitUsd
          : undefined,
    });
  }

  // Asegurar que existan las categorías iniciales mínimas para no romper referencias
  for (const defCat of INITIAL_CATEGORIES) {
    if (!seenCatIds.has(defCat.id)) {
      categories.push({ ...defCat });
      seenCatIds.add(defCat.id);
    }
  }

  // Validar billeteras (wallets)
  const seenWalletIds = new Set<string>();
  const wallets: WalletAccount[] = [];
  const validWalletTypes: WalletKind[] = [
    'digital_usd',
    'bank_ves',
    'bank_usd',
    'cash_usd',
    'cash_ves',
    'other',
  ];

  if (Array.isArray(obj.wallets)) {
    for (const item of obj.wallets) {
      if (!item || typeof item !== 'object') continue;
      const w = item as Record<string, unknown>;
      if (typeof w.id !== 'string' || !w.id.trim() || seenWalletIds.has(w.id)) continue;
      if (typeof w.name !== 'string' || !w.name.trim()) continue;
      const wType: WalletKind = validWalletTypes.includes(w.type as WalletKind)
        ? (w.type as WalletKind)
        : 'other';

      seenWalletIds.add(w.id);
      wallets.push({
        id: w.id.trim(),
        name: w.name.trim(),
        type: wType,
        currency: w.currency === 'VES' ? 'VES' : w.currency === 'USDT' ? 'USDT' : 'USD',
        initialBalanceUsd:
          typeof w.initialBalanceUsd === 'number' && Number.isFinite(w.initialBalanceUsd)
            ? w.initialBalanceUsd
            : 0,
        initialBalanceVes:
          typeof w.initialBalanceVes === 'number' && Number.isFinite(w.initialBalanceVes)
            ? w.initialBalanceVes
            : undefined,
        color: typeof w.color === 'string' && w.color.trim() ? w.color.trim() : '#6D28D9',
        active: w.active !== false,
        isDefault: Boolean(w.isDefault),
        notes: typeof w.notes === 'string' ? w.notes : undefined,
        banco: typeof w.banco === 'string' && w.banco.trim() ? w.banco.trim() : undefined,
        comisionPagoMovil:
          typeof w.comisionPagoMovil === 'number' &&
          Number.isFinite(w.comisionPagoMovil) &&
          w.comisionPagoMovil >= 0
            ? w.comisionPagoMovil
            : undefined,
        comisionTransferencia:
          typeof w.comisionTransferencia === 'number' &&
          Number.isFinite(w.comisionTransferencia) &&
          w.comisionTransferencia >= 0
            ? w.comisionTransferencia
            : undefined,
        comisionTransferenciaTipo:
          w.comisionTransferenciaTipo === 'percent' ||
          w.comisionTransferenciaTipo === 'fixed_ves'
            ? w.comisionTransferenciaTipo
            : undefined,
        isBonusCard: Boolean(w.isBonusCard),
        isCash: typeof w.isCash === 'boolean' ? w.isCash : undefined,
        isThirdPartyExpenseAccount: Boolean(w.isThirdPartyExpenseAccount),
        isPassThroughAccount: Boolean(w.isPassThroughAccount),
        hidePassThroughHistory: Boolean(w.hidePassThroughHistory),
        beneficiaryName:
          typeof w.beneficiaryName === 'string' && w.beneficiaryName.trim()
            ? w.beneficiaryName.trim()
            : undefined,
        sortOrder:
          typeof w.sortOrder === 'number' && Number.isFinite(w.sortOrder)
            ? w.sortOrder
            : undefined,
      });
    }
  }

  // Si alguna billetera tiene sortOrder definido, ordenar respetando la posición elegida por el usuario
  if (wallets.some((w) => typeof w.sortOrder === 'number')) {
    wallets.sort((a, b) => {
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
  }

  // Si no había billeteras en el respaldo, inicializar con las billeteras predeterminadas
  if (wallets.length === 0) {
    for (const defW of INITIAL_WALLETS) {
      wallets.push({ ...defW });
      seenWalletIds.add(defW.id);
    }
  }

  // Validar movimientos (transactions)
  const seenTxnIds = new Set<string>();
  const transactions: Transaction[] = [];

  for (const item of obj.transactions) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    if (typeof t.id !== 'string' || !t.id.trim() || seenTxnIds.has(t.id)) {
      throw new Error('Se detectó un movimiento sin identificador único válido o duplicado.');
    }
    if (t.type !== 'income' && t.type !== 'expense') {
      throw new Error(`Tipo de movimiento inválido en el registro "${t.id}".`);
    }
    if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) {
      throw new Error(`Fecha inválida en el movimiento "${t.id}".`);
    }
    if (typeof t.amount !== 'number' || !Number.isFinite(t.amount) || t.amount <= 0) {
      throw new Error(`Importe inválido en el movimiento "${t.id}". Debe ser positivo.`);
    }
    const currency = t.currency === 'VES' ? 'VES' : t.currency === 'USDT' ? 'USDT' : 'USD';
    let exchangeRate: number | null = null;
    if (currency === 'VES') {
      if (
        typeof t.exchangeRate !== 'number' ||
        !Number.isFinite(t.exchangeRate) ||
        t.exchangeRate <= 0
      ) {
        throw new Error(
          `El movimiento en VES "${t.id}" no posee una tasa de cambio válida mayor que cero.`
        );
      }
      exchangeRate = Number(t.exchangeRate.toFixed(2));
    }

    const amountUsd =
      typeof t.amountUsd === 'number' && Number.isFinite(t.amountUsd) && t.amountUsd > 0
        ? t.amountUsd
        : calcularEquivalenteUsd(t.amount, currency, exchangeRate);

    const rawCatId =
      typeof t.categoryId === 'string' && seenCatIds.has(t.categoryId)
        ? t.categoryId
        : t.type === 'income'
          ? 'cat_inc_other'
          : 'cat_exp_other';

    const catId =
      t.type === 'expense'
        ? normalizarCategoriaGastoComision(rawCatId, categories, {
            description: typeof t.description === 'string' ? t.description : '',
            parentTransactionId:
              typeof t.parentTransactionId === 'string' ? t.parentTransactionId : undefined,
          })
        : rawCatId;

    seenTxnIds.add(t.id);
    transactions.push({
      id: t.id,
      date: t.date,
      type: t.type,
      status: t.status === 'pending' ? 'pending' : 'completed',
      walletId:
        typeof t.walletId === 'string' && t.walletId.trim()
          ? t.walletId.trim()
          : undefined,
      description:
        typeof t.description === 'string' && t.description.trim()
          ? t.description.trim()
          : 'Movimiento financiero',
      categoryId: catId,
      amount: t.amount,
      currency,
      exchangeRate,
      amountUsd,
      exchangeRateSource:
        t.exchangeRateSource === 'bcv' || t.exchangeRateSource === 'manual'
          ? t.exchangeRateSource
          : currency === 'USD'
            ? 'none'
            : 'manual',
      source: typeof t.source === 'string' ? t.source : undefined,
      paymentMethod: typeof t.paymentMethod === 'string' ? t.paymentMethod : undefined,
      expenseType:
        t.expenseType === 'fixed' || t.expenseType === 'variable'
          ? t.expenseType
          : undefined,
      isRecurring: Boolean(t.isRecurring),
      notes: typeof t.notes === 'string' ? t.notes : '',
      isDemo: Boolean(t.isDemo),
      createdAt:
        typeof t.createdAt === 'string' && t.createdAt.trim()
          ? t.createdAt.trim()
          : undefined,
      processedAt:
        typeof t.processedAt === 'string' && t.processedAt.trim()
          ? t.processedAt.trim()
          : undefined,
      sharedExpenseId:
        typeof t.sharedExpenseId === 'string' && t.sharedExpenseId.trim()
          ? t.sharedExpenseId.trim()
          : undefined,
      isInterbankTransfer: Boolean(t.isInterbankTransfer),
      interbankFeeType:
        t.interbankFeeType === 'pago_movil' || t.interbankFeeType === 'transferencia'
          ? t.interbankFeeType
          : undefined,
      interbankFeeAmount:
        typeof t.interbankFeeAmount === 'number' &&
        Number.isFinite(t.interbankFeeAmount) &&
        t.interbankFeeAmount > 0
          ? t.interbankFeeAmount
          : undefined,
      interbankFeeTxnId:
        typeof t.interbankFeeTxnId === 'string' && t.interbankFeeTxnId.trim()
          ? t.interbankFeeTxnId.trim()
          : undefined,
      parentTransactionId:
        typeof t.parentTransactionId === 'string' && t.parentTransactionId.trim()
          ? t.parentTransactionId.trim()
          : undefined,
      isThirdPartyAllowance: Boolean(t.isThirdPartyAllowance),
      isPassThroughThirdParty: Boolean(t.isPassThroughThirdParty),
      thirdPartyTargetWalletId:
        typeof t.thirdPartyTargetWalletId === 'string' && t.thirdPartyTargetWalletId.trim()
          ? t.thirdPartyTargetWalletId.trim()
          : undefined,
      storeName:
        typeof t.storeName === 'string' && t.storeName.trim()
          ? t.storeName.trim()
          : undefined,
      purchasedItems: Array.isArray(t.purchasedItems)
        ? t.purchasedItems
            .map((rawItem, idx): TransactionPurchasedItem | null => {
              if (!rawItem || typeof rawItem !== 'object') return null;
              const it = rawItem as Record<string, unknown>;
              if (typeof it.name !== 'string' || !it.name.trim()) return null;
              const qty =
                typeof it.quantity === 'number' && Number.isFinite(it.quantity) && it.quantity > 0
                  ? it.quantity
                  : 1;
              const uPrice =
                typeof it.unitPrice === 'number' && Number.isFinite(it.unitPrice) && it.unitPrice >= 0
                  ? Number(it.unitPrice.toFixed(2))
                  : null;
              return {
                id:
                  typeof it.id === 'string' && it.id.trim()
                    ? it.id.trim()
                    : `pitem_${idx}_${Date.now()}`,
                name: it.name.trim(),
                quantity: qty,
                unitPrice: uPrice,
              };
            })
            .filter((x): x is TransactionPurchasedItem => x !== null)
        : undefined,
    });
  }

  // Validar metas de ahorro
  const seenGoalIds = new Set<string>();
  const savingsGoals: SavingsGoal[] = [];
  if (Array.isArray(obj.savingsGoals)) {
    for (const item of obj.savingsGoals) {
      if (!item || typeof item !== 'object') continue;
      const g = item as Record<string, unknown>;
      if (typeof g.id !== 'string' || !g.id.trim() || seenGoalIds.has(g.id)) continue;
      if (typeof g.name !== 'string' || !g.name.trim()) continue;
      if (
        typeof g.targetAmountUsd !== 'number' ||
        !Number.isFinite(g.targetAmountUsd) ||
        g.targetAmountUsd <= 0
      ) {
        continue;
      }
      seenGoalIds.add(g.id);
      savingsGoals.push({
        id: g.id,
        name: g.name.trim(),
        description: typeof g.description === 'string' ? g.description : '',
        targetAmountUsd: g.targetAmountUsd,
        createdAt:
          typeof g.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.createdAt)
            ? g.createdAt
            : obtenerFechaLocalIso(),
        targetDate:
          typeof g.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.targetDate)
            ? g.targetDate
            : null,
        status:
          g.status === 'completed' || g.status === 'archived' ? g.status : 'active',
        color: typeof g.color === 'string' ? g.color : '#C86D85',
        isDemo: Boolean(g.isDemo),
      });
    }
  }

  // Validar movimientos de ahorro
  const seenSavIds = new Set<string>();
  const savings: SavingsMovement[] = [];
  if (Array.isArray(obj.savings)) {
    for (const item of obj.savings) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      if (typeof s.id !== 'string' || !s.id.trim() || seenSavIds.has(s.id)) continue;
      if (s.type !== 'deposit' && s.type !== 'withdrawal' && s.type !== 'adjustment') {
        continue;
      }
      if (typeof s.amountUsd !== 'number' || !Number.isFinite(s.amountUsd) || s.amountUsd <= 0) {
        continue;
      }
      if (typeof s.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) continue;

      seenSavIds.add(s.id);
      savings.push({
        id: s.id,
        date: s.date,
        type: s.type,
        walletId:
          typeof s.walletId === 'string' && s.walletId.trim()
            ? s.walletId.trim()
            : undefined,
        amountUsd: s.amountUsd,
        adjustmentDirection:
          s.adjustmentDirection === 'subtract' ? 'subtract' : 'add',
        description:
          typeof s.description === 'string' && s.description.trim()
            ? s.description.trim()
            : 'Movimiento de ahorro',
        categoryId:
          typeof s.categoryId === 'string' && seenCatIds.has(s.categoryId)
            ? s.categoryId
            : 'cat_sav_other',
        goalId:
          typeof s.goalId === 'string' && seenGoalIds.has(s.goalId) ? s.goalId : null,
        originalCurrency: s.originalCurrency === 'VES' ? 'VES' : 'USD',
        originalAmountVes:
          typeof s.originalAmountVes === 'number' && Number.isFinite(s.originalAmountVes)
            ? s.originalAmountVes
            : null,
        exchangeRateUsed:
          typeof s.exchangeRateUsed === 'number' && Number.isFinite(s.exchangeRateUsed)
            ? s.exchangeRateUsed
            : null,
        exchangeRateSource:
          s.exchangeRateSource === 'bcv' || s.exchangeRateSource === 'manual'
            ? s.exchangeRateSource
            : 'none',
        notes: typeof s.notes === 'string' ? s.notes : '',
        isDemo: Boolean(s.isDemo),
      });
    }
  }

  // Validar presupuestos
  const budgets: MonthlyBudget[] = [];
  if (Array.isArray(obj.budgets)) {
    for (const item of obj.budgets) {
      if (!item || typeof item !== 'object') continue;
      const b = item as Record<string, unknown>;
      if (typeof b.monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(b.monthKey)) continue;
      const totalLimitUsd =
        typeof b.totalLimitUsd === 'number' &&
        Number.isFinite(b.totalLimitUsd) &&
        b.totalLimitUsd >= 0
          ? b.totalLimitUsd
          : 0;
      const categoryLimits: Record<string, number> = {};
      if (b.categoryLimits && typeof b.categoryLimits === 'object') {
        for (const [k, v] of Object.entries(b.categoryLimits as Record<string, unknown>)) {
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            categoryLimits[k] = v;
          }
        }
      }
      budgets.push({
        id: typeof b.id === 'string' ? b.id : `budget_${b.monthKey}`,
        monthKey: b.monthKey,
        totalLimitUsd,
        categoryLimits,
        notes: typeof b.notes === 'string' ? b.notes : '',
        isDemo: Boolean(b.isDemo),
      });
    }
  }

  // Validar préstamos / cuentas por cobrar y pagar
  const debts: Debt[] = [];
  if (Array.isArray(obj.debts)) {
    for (const item of obj.debts) {
      if (!item || typeof item !== 'object') continue;
      const d = item as Record<string, unknown>;
      if (typeof d.id !== 'string' || !d.id.trim()) continue;
      if (typeof d.description !== 'string' || !d.description.trim()) continue;
      if (typeof d.totalAmountUsd !== 'number' || !Number.isFinite(d.totalAmountUsd) || d.totalAmountUsd <= 0) {
        continue;
      }
      debts.push({
        id: d.id,
        kind: d.kind === 'payable' ? 'payable' : 'receivable',
        description: d.description.trim(),
        creditor: typeof d.creditor === 'string' ? d.creditor.trim() : 'Persona',
        totalAmount:
          typeof d.totalAmount === 'number' && Number.isFinite(d.totalAmount)
            ? d.totalAmount
            : d.totalAmountUsd,
        currency: d.currency === 'VES' ? 'VES' : 'USD',
        exchangeRate:
          typeof d.exchangeRate === 'number' && Number.isFinite(d.exchangeRate)
            ? d.exchangeRate
            : null,
        totalAmountUsd: d.totalAmountUsd,
        loanDate: typeof d.loanDate === 'string' ? d.loanDate : undefined,
        dueDate: typeof d.dueDate === 'string' ? d.dueDate : null,
        walletId:
          typeof d.walletId === 'string' && d.walletId.trim()
            ? d.walletId.trim()
            : undefined,
        initialTransactionId:
          typeof d.initialTransactionId === 'string' && d.initialTransactionId.trim()
            ? d.initialTransactionId.trim()
            : null,
        payments: Array.isArray(d.payments) ? (d.payments as Debt['payments']) : [],
        notes: typeof d.notes === 'string' ? d.notes : '',
        status: d.status === 'paid' ? 'paid' : 'pending',
        isDemo: Boolean(d.isDemo),
      });
    }
  }

  // Validar lista de deseos (wishlist) - con fallback seguro si no existe en el respaldo
  const wishlist: WishlistItem[] = [];
  const validPriorities: WishlistPriority[] = ['Alta', 'Media', 'Baja', 'Capricho'];
  const validStatuses: WishlistStatus[] = ['Pendiente', 'Comprado', 'Descartado'];

  if (Array.isArray(obj.wishlist)) {
    for (const item of obj.wishlist) {
      if (!item || typeof item !== 'object') continue;
      const w = item as Record<string, unknown>;
      if (typeof w.id !== 'string' || !w.id.trim()) continue;
      if (typeof w.nombre !== 'string' || !w.nombre.trim()) continue;
      if (typeof w.costoEstimado !== 'number' || !Number.isFinite(w.costoEstimado) || w.costoEstimado <= 0) {
        continue;
      }
      const moneda = w.moneda === 'VES' ? 'VES' : 'USD';
      const prioridad: WishlistPriority = validPriorities.includes(w.prioridad as WishlistPriority)
        ? (w.prioridad as WishlistPriority)
        : 'Media';
      const estado: WishlistStatus = validStatuses.includes(w.estado as WishlistStatus)
        ? (w.estado as WishlistStatus)
        : 'Pendiente';
      const categoriaId =
        typeof w.categoriaId === 'string' && seenCatIds.has(w.categoriaId)
          ? w.categoriaId
          : 'cat_exp_personal';

      wishlist.push({
        id: w.id.trim(),
        nombre: w.nombre.trim(),
        costoEstimado: w.costoEstimado,
        moneda,
        categoriaId,
        prioridad,
        url: typeof w.url === 'string' ? w.url.trim() : '',
        notas: typeof w.notas === 'string' ? w.notas.trim() : '',
        fechaMeta:
          typeof w.fechaMeta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.fechaMeta)
            ? w.fechaMeta
            : null,
        estado,
        compradoTransactionId:
          typeof w.compradoTransactionId === 'string' ? w.compradoTransactionId : null,
        createdAt:
          typeof w.createdAt === 'string'
            ? w.createdAt
            : obtenerFechaLocalIso(),
        isDemo: Boolean(w.isDemo),
      });
    }
  }

  // Validar compras a cuotas (creditPurchases) - con fallback seguro si no existe en el respaldo
  const creditPurchases: CreditPurchase[] = [];
  if (Array.isArray(obj.creditPurchases)) {
    for (const item of obj.creditPurchases) {
      if (!item || typeof item !== 'object') continue;
      const cp = item as Record<string, unknown>;
      if (typeof cp.id !== 'string' || !cp.id.trim()) continue;
      if (typeof cp.concept !== 'string' || !cp.concept.trim()) continue;
      if (
        typeof cp.totalAmountUsd !== 'number' ||
        !Number.isFinite(cp.totalAmountUsd) ||
        cp.totalAmountUsd <= 0
      ) {
        continue;
      }

      const rawInstallments = Array.isArray(cp.installments) ? cp.installments : [];
      const installments: CreditInstallment[] = [];
      for (const instItem of rawInstallments) {
        if (!instItem || typeof instItem !== 'object') continue;
        const inst = instItem as Record<string, unknown>;
        if (typeof inst.id !== 'string' || !inst.id.trim()) continue;
        if (typeof inst.amountUsd !== 'number' || !Number.isFinite(inst.amountUsd)) continue;
        installments.push({
          id: inst.id,
          number: typeof inst.number === 'number' ? inst.number : installments.length + 1,
          amountUsd: inst.amountUsd,
          dueDate:
            typeof inst.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inst.dueDate)
              ? inst.dueDate
              : obtenerFechaLocalIso(),
          status: inst.status === 'paid' ? 'paid' : 'pending',
          alreadyPaidExternally: Boolean(inst.alreadyPaidExternally),
          linkedTransactionId:
            typeof inst.linkedTransactionId === 'string' ? inst.linkedTransactionId : '',
          paidAt: typeof inst.paidAt === 'string' ? inst.paidAt : null,
          paidWalletId: typeof inst.paidWalletId === 'string' ? inst.paidWalletId : null,
          paidCurrency:
            inst.paidCurrency === 'VES' || inst.paidCurrency === 'USD' || inst.paidCurrency === 'USDT'
              ? inst.paidCurrency
              : null,
          paidAmountNominal:
            typeof inst.paidAmountNominal === 'number' && Number.isFinite(inst.paidAmountNominal)
              ? inst.paidAmountNominal
              : null,
          paidExchangeRate:
            typeof inst.paidExchangeRate === 'number' && Number.isFinite(inst.paidExchangeRate)
              ? inst.paidExchangeRate
              : null,
          partialPayments: Array.isArray(inst.partialPayments)
            ? (inst.partialPayments as CreditInstallment['partialPayments'])
            : undefined,
          paidProgressAmountUsd:
            typeof inst.paidProgressAmountUsd === 'number' &&
            Number.isFinite(inst.paidProgressAmountUsd)
              ? inst.paidProgressAmountUsd
              : undefined,
          notes: typeof inst.notes === 'string' ? inst.notes : undefined,
        });
      }

      creditPurchases.push({
        id: cp.id.trim(),
        concept: cp.concept.trim(),
        storeOrPlatform:
          typeof cp.storeOrPlatform === 'string' && cp.storeOrPlatform.trim()
            ? cp.storeOrPlatform.trim()
            : 'Compra por Cuota',
        categoryId:
          typeof cp.categoryId === 'string' && seenCatIds.has(cp.categoryId)
            ? cp.categoryId
            : 'cat_exp_personal',
        purchaseDate:
          typeof cp.purchaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cp.purchaseDate)
            ? cp.purchaseDate
            : obtenerFechaLocalIso(),
        baseCurrency: 'USD',
        totalAmountUsd: cp.totalAmountUsd,
        initialPaymentUsd:
          typeof cp.initialPaymentUsd === 'number' && Number.isFinite(cp.initialPaymentUsd)
            ? cp.initialPaymentUsd
            : 0,
        initialAlreadyPaidExternally: Boolean(cp.initialAlreadyPaidExternally),
        initialPaymentWalletId:
          typeof cp.initialPaymentWalletId === 'string'
            ? cp.initialPaymentWalletId
            : Boolean(cp.initialAlreadyPaidExternally)
              ? ''
              : 'wallet_zelle',
        initialPaymentCurrency: cp.initialPaymentCurrency === 'VES' ? 'VES' : 'USD',
        initialPaymentAmountNominal:
          typeof cp.initialPaymentAmountNominal === 'number' &&
          Number.isFinite(cp.initialPaymentAmountNominal)
            ? cp.initialPaymentAmountNominal
            : typeof cp.initialPaymentUsd === 'number'
              ? cp.initialPaymentUsd
              : 0,
        initialPaymentExchangeRate:
          typeof cp.initialPaymentExchangeRate === 'number' &&
          Number.isFinite(cp.initialPaymentExchangeRate)
            ? cp.initialPaymentExchangeRate
            : null,
        initialTransactionId:
          typeof cp.initialTransactionId === 'string' ? cp.initialTransactionId : '',
        financedAmountUsd:
          typeof cp.financedAmountUsd === 'number' && Number.isFinite(cp.financedAmountUsd)
            ? cp.financedAmountUsd
            : Math.max(0, cp.totalAmountUsd - (Number(cp.initialPaymentUsd) || 0)),
        frequency: cp.frequency === 'monthly' ? 'monthly' : 'biweekly',
        installmentsCount:
          typeof cp.installmentsCount === 'number' && cp.installmentsCount > 0
            ? cp.installmentsCount
            : installments.length || 3,
        installments,
        status: cp.status === 'completed' ? 'completed' : 'active',
        notes: typeof cp.notes === 'string' ? cp.notes : '',
        createdAt:
          typeof cp.createdAt === 'string' ? cp.createdAt : new Date().toISOString(),
        isDemo: Boolean(cp.isDemo),
      });
    }
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings,
    wallets,
    categories,
    transactions,
    savings,
    savingsGoals,
    budgets,
    debts,
    rateHistory: Array.isArray(obj.rateHistory)
      ? obj.rateHistory.map((rh) =>
          rh && typeof rh === 'object' && typeof (rh as { rate?: unknown }).rate === 'number'
            ? { ...rh, rate: Number(Number((rh as { rate: number }).rate).toFixed(2)) }
            : rh
        )
      : [],
    wishlist,
    creditPurchases,
    p2pOperations: (() => {
      const ops: P2POperation[] = [];
      if (Array.isArray(obj.p2pOperations)) {
        for (const item of obj.p2pOperations) {
          if (!item || typeof item !== 'object') continue;
          const op = item as Record<string, unknown>;
          if (typeof op.id !== 'string' || !op.id.trim()) continue;
          if (typeof op.contactName !== 'string' || !op.contactName.trim()) continue;
          const deliveredAmount = Number(op.deliveredAmount) || 0;
          const expectedAmount = Number(op.expectedAmount) || 0;
          const alreadyPaidExternally = Boolean(op.alreadyPaidExternally);
          ops.push({
            id: op.id.trim(),
            contactName: op.contactName.trim().slice(0, 80),
            operationType: op.operationType === 'loan' ? 'loan' : 'currency_exchange',
            direction: op.direction === 'payable' ? 'payable' : 'receivable',
            concept: typeof op.concept === 'string' ? op.concept.trim() : undefined,
            alreadyPaidExternally,
            deliveredAmount,
            deliveredCurrency:
              op.deliveredCurrency === 'VES'
                ? 'VES'
                : op.deliveredCurrency === 'USDT'
                  ? 'USDT'
                  : 'USD',
            deliveredAmountUsd:
              typeof op.deliveredAmountUsd === 'number' && Number.isFinite(op.deliveredAmountUsd)
                ? op.deliveredAmountUsd
                : deliveredAmount,
            sourceWalletId:
              typeof op.sourceWalletId === 'string'
                ? op.sourceWalletId
                : alreadyPaidExternally
                  ? ''
                  : 'wallet_bank_ves',
            expectedAmount,
            expectedCurrency:
              op.expectedCurrency === 'VES'
                ? 'VES'
                : op.expectedCurrency === 'USDT'
                  ? 'USDT'
                  : 'USD',
            expectedAmountUsd:
              typeof op.expectedAmountUsd === 'number' && Number.isFinite(op.expectedAmountUsd)
                ? op.expectedAmountUsd
                : expectedAmount,
            destinationWalletId:
              typeof op.destinationWalletId === 'string'
                ? op.destinationWalletId
                : 'wallet_zelle',
            agreedRate:
              typeof op.agreedRate === 'number' && Number.isFinite(op.agreedRate)
                ? op.agreedRate
                : null,
            rateDescription:
              typeof op.rateDescription === 'string' ? op.rateDescription : undefined,
            operationDate:
              typeof op.operationDate === 'string'
                ? op.operationDate
                : obtenerFechaLocalIso(),
            estimatedSettlementDate:
              typeof op.estimatedSettlementDate === 'string'
                ? op.estimatedSettlementDate
                : null,
            status: op.status === 'settled' ? 'settled' : 'in_transit',
            settledAt: typeof op.settledAt === 'string' ? op.settledAt : null,
            settledWalletId:
              typeof op.settledWalletId === 'string' ? op.settledWalletId : null,
            settledAmount:
              typeof op.settledAmount === 'number' ? op.settledAmount : null,
            hasBankFee: Boolean(op.hasBankFee),
            bankFeeType:
              op.bankFeeType === 'pago_movil' ||
              op.bankFeeType === 'transferencia' ||
              op.bankFeeType === 'custom'
                ? op.bankFeeType
                : undefined,
            bankFeeAmount:
              typeof op.bankFeeAmount === 'number' && Number.isFinite(op.bankFeeAmount)
                ? op.bankFeeAmount
                : undefined,
            bankFeeAmountUsd:
              typeof op.bankFeeAmountUsd === 'number' &&
              Number.isFinite(op.bankFeeAmountUsd)
                ? op.bankFeeAmountUsd
                : undefined,
            outflowTransactionId:
              typeof op.outflowTransactionId === 'string'
                ? op.outflowTransactionId
                : '',
            inflowTransactionId:
              typeof op.inflowTransactionId === 'string'
                ? op.inflowTransactionId
                : '',
            feeTransactionId:
              typeof op.feeTransactionId === 'string'
                ? op.feeTransactionId
                : undefined,
            notes: typeof op.notes === 'string' ? op.notes : undefined,
            createdAt:
              typeof op.createdAt === 'string'
                ? op.createdAt
                : new Date().toISOString(),
            isDemo: Boolean(op.isDemo),
          });
        }
      }
      return ops;
    })(),
    subscriptions: (() => {
      const subs: Subscription[] = [];
      if (Array.isArray(obj.subscriptions)) {
        for (const item of obj.subscriptions) {
          if (!item || typeof item !== 'object') continue;
          const s = item as Record<string, unknown>;
          if (typeof s.id !== 'string' || !s.id.trim()) continue;
          if (typeof s.name !== 'string' || !s.name.trim()) continue;
          const amount = Number(s.amount) || 0;
          if (amount <= 0) continue;
          const currency = s.currency === 'VES' ? 'VES' : 'USD';
          const exchangeRate =
            typeof s.exchangeRate === 'number' && Number.isFinite(s.exchangeRate) && s.exchangeRate > 0
              ? s.exchangeRate
              : null;
          const amountUsd =
            typeof s.amountUsd === 'number' && Number.isFinite(s.amountUsd) && s.amountUsd > 0
              ? s.amountUsd
              : currency === 'USD'
                ? amount
                : calcularEquivalenteUsd(amount, 'VES', exchangeRate);

          const rawHistory = Array.isArray(s.paymentHistory) ? s.paymentHistory : [];
          const paymentHistory: SubscriptionPaymentRecord[] = [];
          for (const h of rawHistory) {
            if (!h || typeof h !== 'object') continue;
            const rec = h as Record<string, unknown>;
            if (typeof rec.id !== 'string' || !rec.id.trim()) continue;
            paymentHistory.push({
              id: rec.id,
              paidDate:
                typeof rec.paidDate === 'string'
                  ? rec.paidDate
                  : obtenerFechaLocalIso(),
              previousBillingDate:
                typeof rec.previousBillingDate === 'string' ? rec.previousBillingDate : '',
              nextBillingDateAfterPay:
                typeof rec.nextBillingDateAfterPay === 'string' ? rec.nextBillingDateAfterPay : '',
              walletId: typeof rec.walletId === 'string' ? rec.walletId : 'wallet_zelle',
              amount: Number(rec.amount) || 0,
              currency: rec.currency === 'VES' ? 'VES' : 'USD',
              exchangeRate:
                typeof rec.exchangeRate === 'number' && Number.isFinite(rec.exchangeRate)
                  ? rec.exchangeRate
                  : null,
              amountUsd: Number(rec.amountUsd) || 0,
              linkedTransactionId:
                typeof rec.linkedTransactionId === 'string' ? rec.linkedTransactionId : '',
              notes: typeof rec.notes === 'string' ? rec.notes : undefined,
            });
          }

          subs.push({
            id: s.id.trim(),
            name: s.name.trim().slice(0, 80),
            categoryId:
              typeof s.categoryId === 'string' && seenCatIds.has(s.categoryId)
                ? s.categoryId
                : 'cat_exp_subscriptions',
            amount,
            currency,
            exchangeRate,
            amountUsd,
            frequency: s.frequency === 'annual' ? 'annual' : 'monthly',
            nextBillingDate:
              typeof s.nextBillingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.nextBillingDate)
                ? s.nextBillingDate
                : obtenerFechaLocalIso(),
            alertDaysBefore:
              typeof s.alertDaysBefore === 'number' && Number.isFinite(s.alertDaysBefore)
                ? Math.max(0, Math.min(60, Math.round(s.alertDaysBefore)))
                : 3,
            status: s.status === 'paused' ? 'paused' : 'active',
            defaultWalletId:
              typeof s.defaultWalletId === 'string' ? s.defaultWalletId : undefined,
            lastPaidDate: typeof s.lastPaidDate === 'string' ? s.lastPaidDate : null,
            paymentHistory,
            notes: typeof s.notes === 'string' ? s.notes : '',
            createdAt:
              typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
            isDemo: Boolean(s.isDemo),
          });
        }
      }
      return subs;
    })(),
    appCredits: (() => {
      const credits: AppCredit[] = [];
      if (Array.isArray(obj.appCredits)) {
        for (const item of obj.appCredits) {
          if (!item || typeof item !== 'object') continue;
          const ac = item as Record<string, unknown>;
          if (typeof ac.id !== 'string' || !ac.id.trim()) continue;
          if (typeof ac.appName !== 'string' || !ac.appName.trim()) continue;
          const requestedAmount = Number(ac.requestedAmount) || 0;
          if (requestedAmount <= 0) continue;

          const currency = ac.currency === 'VES' ? 'VES' : 'USD';
          const exchangeRate =
            typeof ac.exchangeRate === 'number' &&
            Number.isFinite(ac.exchangeRate) &&
            ac.exchangeRate > 0
              ? ac.exchangeRate
              : null;

          const installmentsCount =
            typeof ac.installmentsCount === 'number' && ac.installmentsCount > 0
              ? Math.round(ac.installmentsCount)
              : 4;
          const frequencyDays =
            typeof ac.frequencyDays === 'number' && ac.frequencyDays > 0
              ? Math.round(ac.frequencyDays)
              : 15;
          const feePerInstallment =
            typeof ac.feePerInstallment === 'number' &&
            Number.isFinite(ac.feePerInstallment) &&
            ac.feePerInstallment >= 0
              ? ac.feePerInstallment
              : 0;

          const rawInst = Array.isArray(ac.installments) ? ac.installments : [];
          const installments: AppCreditInstallment[] = [];
          for (const instItem of rawInst) {
            if (!instItem || typeof instItem !== 'object') continue;
            const inst = instItem as Record<string, unknown>;
            if (typeof inst.id !== 'string' || !inst.id.trim()) continue;
            const principalAmount = Number(inst.principalAmount) || 0;
            const feeAmount = Number(inst.feeAmount) || 0;
            const totalInstallmentAmount =
              Number(inst.totalInstallmentAmount) || principalAmount + feeAmount;
            const principalAmountUsd =
              typeof inst.principalAmountUsd === 'number' && Number.isFinite(inst.principalAmountUsd)
                ? inst.principalAmountUsd
                : currency === 'USD'
                  ? principalAmount
                  : calcularEquivalenteUsd(principalAmount, 'VES', exchangeRate);
            const feeAmountUsd =
              typeof inst.feeAmountUsd === 'number' && Number.isFinite(inst.feeAmountUsd)
                ? inst.feeAmountUsd
                : currency === 'USD'
                  ? feeAmount
                  : calcularEquivalenteUsd(feeAmount, 'VES', exchangeRate);
            const totalInstallmentAmountUsd =
              typeof inst.totalInstallmentAmountUsd === 'number' &&
              Number.isFinite(inst.totalInstallmentAmountUsd)
                ? inst.totalInstallmentAmountUsd
                : principalAmountUsd + feeAmountUsd;

            installments.push({
              id: inst.id,
              number: typeof inst.number === 'number' ? inst.number : installments.length + 1,
              dueDate:
                typeof inst.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inst.dueDate)
                  ? inst.dueDate
                  : obtenerFechaLocalIso(),
              principalAmount,
              feeAmount,
              totalInstallmentAmount,
              principalAmountUsd,
              feeAmountUsd,
              totalInstallmentAmountUsd,
              status: inst.status === 'paid' ? 'paid' : 'pending',
              alreadyPaidExternally: Boolean(inst.alreadyPaidExternally),
              paidByThirdPartyDirect: Boolean(inst.paidByThirdPartyDirect),
              thirdPartyPayerName:
                typeof inst.thirdPartyPayerName === 'string' && inst.thirdPartyPayerName.trim()
                  ? inst.thirdPartyPayerName.trim()
                  : null,
              linkedDebtPaymentId:
                typeof inst.linkedDebtPaymentId === 'string' && inst.linkedDebtPaymentId.trim()
                  ? inst.linkedDebtPaymentId.trim()
                  : null,
              linkedTransactionId:
                typeof inst.linkedTransactionId === 'string' ? inst.linkedTransactionId : '',
              paidAt: typeof inst.paidAt === 'string' ? inst.paidAt : null,
              paidWalletId: typeof inst.paidWalletId === 'string' ? inst.paidWalletId : null,
              paidCurrency:
                inst.paidCurrency === 'VES' || inst.paidCurrency === 'USD'
                  ? inst.paidCurrency
                  : null,
              paidAmountNominal:
                typeof inst.paidAmountNominal === 'number' &&
                Number.isFinite(inst.paidAmountNominal)
                  ? inst.paidAmountNominal
                  : null,
              paidExchangeRate:
                typeof inst.paidExchangeRate === 'number' && Number.isFinite(inst.paidExchangeRate)
                  ? inst.paidExchangeRate
                  : null,
              partialPayments: Array.isArray(inst.partialPayments)
                ? (inst.partialPayments as AppCreditInstallment['partialPayments'])
                : undefined,
              paidProgressAmount:
                typeof inst.paidProgressAmount === 'number' &&
                Number.isFinite(inst.paidProgressAmount)
                  ? inst.paidProgressAmount
                  : undefined,
              paidProgressAmountUsd:
                typeof inst.paidProgressAmountUsd === 'number' &&
                Number.isFinite(inst.paidProgressAmountUsd)
                  ? inst.paidProgressAmountUsd
                  : undefined,
              notes: typeof inst.notes === 'string' ? inst.notes : undefined,
            });
          }

          const requestedAmountUsd =
            typeof ac.requestedAmountUsd === 'number' && Number.isFinite(ac.requestedAmountUsd)
              ? ac.requestedAmountUsd
              : currency === 'USD'
                ? requestedAmount
                : calcularEquivalenteUsd(requestedAmount, 'VES', exchangeRate);

          const feePerInstallmentUsd =
            typeof ac.feePerInstallmentUsd === 'number' && Number.isFinite(ac.feePerInstallmentUsd)
              ? ac.feePerInstallmentUsd
              : currency === 'USD'
                ? feePerInstallment
                : calcularEquivalenteUsd(feePerInstallment, 'VES', exchangeRate);

          const totalFeeAmount =
            typeof ac.totalFeeAmount === 'number' && Number.isFinite(ac.totalFeeAmount)
              ? ac.totalFeeAmount
              : feePerInstallment * installmentsCount;

          const totalToPayAmount =
            typeof ac.totalToPayAmount === 'number' && Number.isFinite(ac.totalToPayAmount)
              ? ac.totalToPayAmount
              : requestedAmount + totalFeeAmount;

          const totalToPayAmountUsd =
            typeof ac.totalToPayAmountUsd === 'number' && Number.isFinite(ac.totalToPayAmountUsd)
              ? ac.totalToPayAmountUsd
              : installments.reduce((sum, item) => sum + item.totalInstallmentAmountUsd, 0);

          credits.push({
            id: ac.id.trim(),
            appName: ac.appName.trim().slice(0, 60),
            concept: typeof ac.concept === 'string' ? ac.concept.trim() : '',
            categoryId:
              typeof ac.categoryId === 'string' && seenCatIds.has(ac.categoryId)
                ? ac.categoryId
                : 'cat_exp_other',
            requestDate:
              typeof ac.requestDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ac.requestDate)
                ? ac.requestDate
                : obtenerFechaLocalIso(),
            requestedAmount,
            currency,
            exchangeRate,
            requestedAmountUsd,
            installmentsCount,
            frequencyDays,
            feePerInstallment,
            feePerInstallmentUsd,
            totalFeeAmount,
            totalToPayAmount,
            totalToPayAmountUsd,
            depositToWallet: Boolean(ac.depositToWallet),
            depositDestinationMode:
              ac.depositDestinationMode === 'personal_wallet' ||
              ac.depositDestinationMode === 'third_party_direct' ||
              ac.depositDestinationMode === 'none'
                ? ac.depositDestinationMode
                : undefined,
            thirdPartyRecipientName:
              typeof ac.thirdPartyRecipientName === 'string' && ac.thirdPartyRecipientName.trim()
                ? ac.thirdPartyRecipientName.trim()
                : null,
            linkedLoanId:
              typeof ac.linkedLoanId === 'string' && ac.linkedLoanId.trim()
                ? ac.linkedLoanId.trim()
                : null,
            depositWalletId:
              typeof ac.depositWalletId === 'string' && ac.depositWalletId.trim()
                ? ac.depositWalletId.trim()
                : null,
            depositTransactionId:
              typeof ac.depositTransactionId === 'string' && ac.depositTransactionId.trim()
                ? ac.depositTransactionId.trim()
                : null,
            depositCurrency:
              ac.depositCurrency === 'VES' || ac.depositCurrency === 'USD'
                ? ac.depositCurrency
                : null,
            depositGrossAmountNominal:
              typeof ac.depositGrossAmountNominal === 'number' &&
              Number.isFinite(ac.depositGrossAmountNominal)
                ? ac.depositGrossAmountNominal
                : null,
            depositBankFeePercent:
              typeof ac.depositBankFeePercent === 'number' &&
              Number.isFinite(ac.depositBankFeePercent)
                ? ac.depositBankFeePercent
                : null,
            depositBankFeeAmountNominal:
              typeof ac.depositBankFeeAmountNominal === 'number' &&
              Number.isFinite(ac.depositBankFeeAmountNominal)
                ? ac.depositBankFeeAmountNominal
                : null,
            depositAmountNominal:
              typeof ac.depositAmountNominal === 'number' &&
              Number.isFinite(ac.depositAmountNominal)
                ? ac.depositAmountNominal
                : null,
            depositExchangeRate:
              typeof ac.depositExchangeRate === 'number' &&
              Number.isFinite(ac.depositExchangeRate)
                ? ac.depositExchangeRate
                : null,
            installments,
            status: ac.status === 'paid' ? 'paid' : 'active',
            notes: typeof ac.notes === 'string' ? ac.notes : '',
            createdAt:
              typeof ac.createdAt === 'string' ? ac.createdAt : new Date().toISOString(),
            isDemo: Boolean(ac.isDemo),
          });
        }
      }
      return credits;
    })(),
    marketLists: (() => {
      const lists: MarketList[] = [];
      const validStops: MarketCategoryStop[] = [
        'Feria/Hortalizas',
        'Carnicería',
        'Charcutería',
        'Supermercado/Víveres',
        'Limpieza/Aseo',
        'Otros',
      ];

      if (Array.isArray(obj.marketLists)) {
        for (const item of obj.marketLists) {
          if (!item || typeof item !== 'object') continue;
          const ml = item as Record<string, unknown>;
          if (typeof ml.id !== 'string' || !ml.id.trim()) continue;
          if (typeof ml.nombre !== 'string' || !ml.nombre.trim()) continue;

          const presupuesto =
            typeof ml.presupuestoEstimado === 'number' && Number.isFinite(ml.presupuestoEstimado)
              ? Math.max(0, ml.presupuestoEstimado)
              : 0;

          const moneda = ml.moneda === 'VES' ? 'VES' : 'USD';
          const exchangeRate =
            typeof ml.exchangeRate === 'number' && Number.isFinite(ml.exchangeRate) && ml.exchangeRate > 0
              ? ml.exchangeRate
              : null;

          const presupuestoEstimadoUsd =
            typeof ml.presupuestoEstimadoUsd === 'number' && Number.isFinite(ml.presupuestoEstimadoUsd)
              ? ml.presupuestoEstimadoUsd
              : moneda === 'USD'
                ? presupuesto
                : calcularEquivalenteUsd(presupuesto, 'VES', exchangeRate);

          const rawItems = Array.isArray(ml.items) ? ml.items : [];
          const items: MarketItem[] = [];
          for (const rawIt of rawItems) {
            if (!rawIt || typeof rawIt !== 'object') continue;
            const it = rawIt as Record<string, unknown>;
            if (typeof it.id !== 'string' || !it.id.trim()) continue;
            if (typeof it.nombre !== 'string' || !it.nombre.trim()) continue;
            const cat = validStops.includes(it.categoria as MarketCategoryStop)
              ? (it.categoria as MarketCategoryStop)
              : 'Supermercado/Víveres';

            const cantidad =
              typeof it.cantidad === 'number' &&
              Number.isFinite(it.cantidad) &&
              it.cantidad > 0
                ? it.cantidad
                : undefined;
            const montoUnitario =
              typeof it.montoUnitario === 'number' &&
              Number.isFinite(it.montoUnitario) &&
              it.montoUnitario > 0
                ? it.montoUnitario
                : undefined;
            const precioEstimadoUnitario =
              typeof it.precioEstimadoUnitario === 'number' &&
              Number.isFinite(it.precioEstimadoUnitario) &&
              it.precioEstimadoUnitario > 0
                ? it.precioEstimadoUnitario
                : undefined;
            const precioRealTotal =
              typeof it.precioRealTotal === 'number' &&
              Number.isFinite(it.precioRealTotal) &&
              it.precioRealTotal > 0
                ? it.precioRealTotal
                : undefined;

            items.push({
              id: it.id.trim(),
              nombre: it.nombre.trim().slice(0, 100),
              categoria: cat,
              comprado: Boolean(it.comprado),
              ...(cantidad !== undefined ? { cantidad } : {}),
              ...(montoUnitario !== undefined ? { montoUnitario } : {}),
              ...(precioEstimadoUnitario !== undefined
                ? { precioEstimadoUnitario }
                : {}),
              ...(precioRealTotal !== undefined ? { precioRealTotal } : {}),
              notes: typeof it.notes === 'string' ? it.notes.trim() : undefined,
            });
          }

          const totalPagadoReal =
            typeof ml.totalPagadoReal === 'number' && Number.isFinite(ml.totalPagadoReal)
              ? ml.totalPagadoReal
              : null;

          const totalPagadoRealUsd =
            typeof ml.totalPagadoRealUsd === 'number' && Number.isFinite(ml.totalPagadoRealUsd)
              ? ml.totalPagadoRealUsd
              : totalPagadoReal !== null && moneda === 'USD'
                ? totalPagadoReal
                : null;

          lists.push({
            id: ml.id.trim(),
            nombre: ml.nombre.trim().slice(0, 80),
            presupuestoEstimado: presupuesto,
            moneda,
            exchangeRate,
            presupuestoEstimadoUsd,
            totalPagadoReal,
            totalPagadoRealUsd,
            fecha:
              typeof ml.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ml.fecha)
                ? ml.fecha
                : obtenerFechaLocalIso(),
            estado: ml.estado === 'cerrada' ? 'cerrada' : 'abierta',
            items,
            walletId: typeof ml.walletId === 'string' && ml.walletId.trim() ? ml.walletId.trim() : null,
            linkedPendingTransactionId:
              typeof ml.linkedPendingTransactionId === 'string'
                ? ml.linkedPendingTransactionId
                : undefined,
            linkedCompletedTransactionId:
              typeof ml.linkedCompletedTransactionId === 'string'
                ? ml.linkedCompletedTransactionId
                : null,
            closedAt: typeof ml.closedAt === 'string' ? ml.closedAt : null,
            paymentCurrency:
              ml.paymentCurrency === 'VES' || ml.paymentCurrency === 'USD'
                ? ml.paymentCurrency
                : null,
            paymentExchangeRate:
              typeof ml.paymentExchangeRate === 'number' && Number.isFinite(ml.paymentExchangeRate)
                ? ml.paymentExchangeRate
                : null,
            paymentMode:
              ml.paymentMode === 'cashea' || ml.paymentMode === 'contado'
                ? ml.paymentMode
                : undefined,
            paidTodayAmount:
              typeof ml.paidTodayAmount === 'number' && Number.isFinite(ml.paidTodayAmount)
                ? ml.paidTodayAmount
                : null,
            paidTodayAmountUsd:
              typeof ml.paidTodayAmountUsd === 'number' && Number.isFinite(ml.paidTodayAmountUsd)
                ? ml.paidTodayAmountUsd
                : null,
            casheaFinancedUsd:
              typeof ml.casheaFinancedUsd === 'number' && Number.isFinite(ml.casheaFinancedUsd)
                ? ml.casheaFinancedUsd
                : null,
            casheaInstallmentsCount:
              typeof ml.casheaInstallmentsCount === 'number' &&
              Number.isFinite(ml.casheaInstallmentsCount) &&
              ml.casheaInstallmentsCount > 0
                ? Math.round(ml.casheaInstallmentsCount)
                : null,
            casheaStoreOrPlatform:
              typeof ml.casheaStoreOrPlatform === 'string' && ml.casheaStoreOrPlatform.trim()
                ? ml.casheaStoreOrPlatform.trim()
                : null,
            linkedCreditPurchaseId:
              typeof ml.linkedCreditPurchaseId === 'string' && ml.linkedCreditPurchaseId.trim()
                ? ml.linkedCreditPurchaseId.trim()
                : null,
            notes: typeof ml.notes === 'string' ? ml.notes : '',
            createdAt:
              typeof ml.createdAt === 'string' ? ml.createdAt : new Date().toISOString(),
            isDemo: Boolean(ml.isDemo),
          });
        }
      }
      return lists;
    })(),
    walletTransfers: (() => {
      const transfers: WalletTransfer[] = [];
      const seenTransferIds = new Set<string>();
      if (Array.isArray(obj.walletTransfers)) {
        for (const item of obj.walletTransfers) {
          if (!item || typeof item !== 'object') continue;
          const tr = item as Record<string, unknown>;
          if (typeof tr.id !== 'string' || !tr.id.trim() || seenTransferIds.has(tr.id)) continue;
          if (typeof tr.sourceWalletId !== 'string' || !tr.sourceWalletId.trim()) continue;
          if (typeof tr.destinationWalletId !== 'string' || !tr.destinationWalletId.trim()) continue;

          const amountOut =
            typeof tr.amountOut === 'number' && Number.isFinite(tr.amountOut) && tr.amountOut > 0
              ? tr.amountOut
              : 0;
          const amountIn =
            typeof tr.amountIn === 'number' && Number.isFinite(tr.amountIn) && tr.amountIn > 0
              ? tr.amountIn
              : 0;
          if (amountOut <= 0 || amountIn <= 0) continue;

          const exchangeRate =
            typeof tr.exchangeRate === 'number' && Number.isFinite(tr.exchangeRate) && tr.exchangeRate > 0
              ? tr.exchangeRate
              : 1;

          const sourceCurrency: CurrencyCode =
            tr.sourceCurrency === 'VES' ? 'VES' : tr.sourceCurrency === 'USDT' ? 'USDT' : 'USD';
          const destinationCurrency: CurrencyCode =
            tr.destinationCurrency === 'VES'
              ? 'VES'
              : tr.destinationCurrency === 'USDT'
                ? 'USDT'
                : 'USD';

          seenTransferIds.add(tr.id.trim());
          transfers.push({
            id: tr.id.trim(),
            date:
              typeof tr.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(tr.date)
                ? tr.date
                : obtenerFechaLocalIso(),
            sourceWalletId: tr.sourceWalletId.trim(),
            sourceCurrency,
            amountOut,
            destinationWalletId: tr.destinationWalletId.trim(),
            destinationCurrency,
            amountIn,
            exchangeRate,
            feeAmount:
              typeof tr.feeAmount === 'number' &&
              Number.isFinite(tr.feeAmount) &&
              tr.feeAmount > 0
                ? tr.feeAmount
                : undefined,
            feeTransactionId:
              typeof tr.feeTransactionId === 'string' && tr.feeTransactionId.trim()
                ? tr.feeTransactionId.trim()
                : undefined,
            notes: typeof tr.notes === 'string' ? tr.notes.trim() : '',
            createdAt:
              typeof tr.createdAt === 'string' ? tr.createdAt : new Date().toISOString(),
            isDemo: Boolean(tr.isDemo),
          });
        }
      }
      return transfers;
    })(),
    assets: (() => {
      const assetsList: Asset[] = [];
      const seenAssetIds = new Set<string>();
      if (Array.isArray(obj.assets)) {
        for (const item of obj.assets) {
          if (!item || typeof item !== 'object') continue;
          const a = item as Record<string, unknown>;
          if (typeof a.id !== 'string' || !a.id.trim() || seenAssetIds.has(a.id)) continue;
          if (typeof a.nombre !== 'string' || !a.nombre.trim()) continue;

          const costo =
            typeof a.costo === 'number' && Number.isFinite(a.costo) && a.costo >= 0
              ? a.costo
              : 0;
          const moneda: CurrencyCode = a.moneda === 'VES' ? 'VES' : 'USD';
          const exchangeRate =
            typeof a.exchangeRate === 'number' &&
            Number.isFinite(a.exchangeRate) &&
            a.exchangeRate > 0
              ? a.exchangeRate
              : null;
          const costoUsd =
            typeof a.costoUsd === 'number' && Number.isFinite(a.costoUsd) && a.costoUsd >= 0
              ? a.costoUsd
              : moneda === 'USD'
                ? costo
                : calcularEquivalenteUsd(costo, 'VES', exchangeRate);

          const rawHist = Array.isArray(a.historialMantenimiento)
            ? a.historialMantenimiento
            : [];
          const historialMantenimiento: AssetMaintenanceRecord[] = [];
          for (const rawM of rawHist) {
            if (!rawM || typeof rawM !== 'object') continue;
            const m = rawM as Record<string, unknown>;
            if (typeof m.id !== 'string' || !m.id.trim()) continue;
            const mCosto =
              typeof m.costo === 'number' && Number.isFinite(m.costo) && m.costo > 0
                ? m.costo
                : 0;
            if (mCosto <= 0) continue;
            const mMoneda: CurrencyCode = m.moneda === 'VES' ? 'VES' : 'USD';
            const mRate =
              typeof m.exchangeRate === 'number' &&
              Number.isFinite(m.exchangeRate) &&
              m.exchangeRate > 0
                ? m.exchangeRate
                : null;
            const mCostoUsd =
              typeof m.costoUsd === 'number' &&
              Number.isFinite(m.costoUsd) &&
              m.costoUsd > 0
                ? m.costoUsd
                : mMoneda === 'USD'
                  ? mCosto
                  : calcularEquivalenteUsd(mCosto, 'VES', mRate);

            historialMantenimiento.push({
              id: m.id.trim(),
              fecha:
                typeof m.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.fecha)
                  ? m.fecha
                  : obtenerFechaLocalIso(),
              costo: mCosto,
              moneda: mMoneda,
              exchangeRate: mRate,
              costoUsd: mCostoUsd,
              walletId: typeof m.walletId === 'string' ? m.walletId : '',
              linkedTransactionId:
                typeof m.linkedTransactionId === 'string' ? m.linkedTransactionId : '',
              notas: typeof m.notas === 'string' ? m.notas : '',
              createdAt:
                typeof m.createdAt === 'string' ? m.createdAt : new Date().toISOString(),
            });
          }

          seenAssetIds.add(a.id.trim());
          assetsList.push({
            id: a.id.trim(),
            nombre: a.nombre.trim().slice(0, 90),
            costo,
            moneda,
            exchangeRate,
            costoUsd,
            fechaCompra:
              typeof a.fechaCompra === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.fechaCompra)
                ? a.fechaCompra
                : obtenerFechaLocalIso(),
            mesesGarantia:
              typeof a.mesesGarantia === 'number' &&
              Number.isFinite(a.mesesGarantia) &&
              a.mesesGarantia >= 0
                ? Math.round(a.mesesGarantia)
                : 12,
            frecuenciaMantenimientoMeses:
              typeof a.frecuenciaMantenimientoMeses === 'number' &&
              Number.isFinite(a.frecuenciaMantenimientoMeses) &&
              a.frecuenciaMantenimientoMeses >= 0
                ? Math.round(a.frecuenciaMantenimientoMeses)
                : 6,
            historialMantenimiento,
            notas: typeof a.notas === 'string' ? a.notas : '',
            createdAt:
              typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
            isDemo: Boolean(a.isDemo),
          });
        }
      }
      return assetsList;
    })(),
    romanceFund: (() => {
      const rawRf =
        obj.romanceFund && typeof obj.romanceFund === 'object'
          ? (obj.romanceFund as Record<string, unknown>)
          : null;
      const movements: RomanceFundMovement[] = [];
      const seenMovIds = new Set<string>();
      if (rawRf && Array.isArray(rawRf.movements)) {
        for (const item of rawRf.movements) {
          if (!item || typeof item !== 'object') continue;
          const mv = item as Record<string, unknown>;
          if (typeof mv.id !== 'string' || !mv.id.trim() || seenMovIds.has(mv.id)) continue;
          const type =
            mv.type === 'spend'
              ? 'spend'
              : mv.type === 'return'
                ? 'return'
                : 'allocate';
          const amount =
            typeof mv.amount === 'number' && Number.isFinite(mv.amount) && mv.amount > 0
              ? mv.amount
              : 0;
          const amountUsd =
            typeof mv.amountUsd === 'number' &&
            Number.isFinite(mv.amountUsd) &&
            mv.amountUsd > 0
              ? mv.amountUsd
              : 0;
          if (amount <= 0 || amountUsd <= 0) continue;

          seenMovIds.add(mv.id.trim());
          movements.push({
            id: mv.id.trim(),
            type,
            date:
              typeof mv.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(mv.date)
                ? mv.date
                : obtenerFechaLocalIso(),
            amount,
            currency: mv.currency === 'VES' ? 'VES' : 'USD',
            exchangeRate:
              typeof mv.exchangeRate === 'number' &&
              Number.isFinite(mv.exchangeRate) &&
              mv.exchangeRate > 0
                ? mv.exchangeRate
                : null,
            amountUsd,
            walletId:
              typeof mv.walletId === 'string' && mv.walletId.trim()
                ? mv.walletId.trim()
                : undefined,
            linkedTransactionId:
              typeof mv.linkedTransactionId === 'string'
                ? mv.linkedTransactionId
                : null,
            planName: typeof mv.planName === 'string' ? mv.planName : '',
            notes: typeof mv.notes === 'string' ? mv.notes : '',
            createdAt:
              typeof mv.createdAt === 'string'
                ? mv.createdAt
                : new Date().toISOString(),
          });
        }
      }
      // Recalcular el saldo exacto en USD a partir de los movimientos
      const computedBal = movements.reduce((acc, m) => {
        if (m.type === 'allocate') return acc + m.amountUsd;
        return acc - m.amountUsd;
      }, 0);
      return {
        balanceUsd: Number(Math.max(0, computedBal).toFixed(2)),
        movements,
      };
    })(),
    weeklyMenu: (() => {
      const baseMenu = createEmptyWeeklyMenu();
      const rawWm =
        obj.weeklyMenu && typeof obj.weeklyMenu === 'object'
          ? (obj.weeklyMenu as Record<string, unknown>)
          : null;
      if (!rawWm) return baseMenu;

      const rawDias =
        rawWm.dias && typeof rawWm.dias === 'object'
          ? (rawWm.dias as Record<string, unknown>)
          : {};

      const dias: Record<DayOfWeekKey, MealItem[]> = {
        Lunes: [],
        Martes: [],
        Miércoles: [],
        Jueves: [],
        Viernes: [],
        Sábado: [],
        Domingo: [],
      };

      for (const dayKey of DAYS_OF_WEEK) {
        const arr = Array.isArray(rawDias[dayKey]) ? rawDias[dayKey] : [];
        const normalizedMeals: MealItem[] = [];
        for (const item of arr) {
          if (!item || typeof item !== 'object') continue;
          const m = item as Record<string, unknown>;
          const nombre =
            typeof m.nombre === 'string' ? m.nombre.trim().slice(0, 120) : '';
          if (!nombre) continue;

          const tipo: MealType =
            m.tipo === 'Desayuno' || m.tipo === 'Almuerzo' || m.tipo === 'Cena'
              ? m.tipo
              : 'Almuerzo';

          const rawIngs = Array.isArray(m.ingredientes) ? m.ingredientes : [];
          const ingredientes = rawIngs
            .map((ing) => (typeof ing === 'string' ? ing.trim() : ''))
            .filter(Boolean);

          normalizedMeals.push({
            id:
              typeof m.id === 'string' && m.id.trim()
                ? m.id.trim()
                : `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            nombre,
            tipo,
            ingredientes,
            notas: typeof m.notas === 'string' ? m.notas.trim() : '',
            createdAt:
              typeof m.createdAt === 'string'
                ? m.createdAt
                : new Date().toISOString(),
          });
        }

        normalizedMeals.sort(
          (a, b) => MEAL_TYPES_ORDER[a.tipo] - MEAL_TYPES_ORDER[b.tipo]
        );
        dias[dayKey] = normalizedMeals;
      }

      return {
        id:
          typeof rawWm.id === 'string' && rawWm.id.trim()
            ? rawWm.id.trim()
            : 'weekly_menu_default',
        nombreSemana:
          typeof rawWm.nombreSemana === 'string' && rawWm.nombreSemana.trim()
            ? rawWm.nombreSemana.trim()
            : 'Menú Semanal del Hogar',
        dias,
        updatedAt:
          typeof rawWm.updatedAt === 'string'
            ? rawWm.updatedAt
            : new Date().toISOString(),
      };
    })(),
  };
}

export function cargarDatosLocalStorage(): AppDataSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialAppData();
    }
    const parsed = JSON.parse(raw);
    return validarYNormalizarRespaldo(parsed);
  } catch (err) {
    console.warn('No se pudo restaurar el estado previo desde localStorage; iniciando esquema limpio.', err);
    return createInitialAppData();
  }
}

export function guardarDatosLocalStorage(data: AppDataSchema): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error al guardar en localStorage:', err);
  }
}

export function generarArchivoRespaldoJson(data: AppDataSchema): string {
  const payload: AppDataSchema = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      ...data.settings,
      lastOfficialRate:
        data.settings.lastOfficialRate &&
        Number.isFinite(data.settings.lastOfficialRate) &&
        data.settings.lastOfficialRate > 0
          ? data.settings.lastOfficialRate
          : null,
    },
    wallets: data.wallets ?? [],
    categories: data.categories,
    transactions: data.transactions,
    savings: data.savings,
    savingsGoals: data.savingsGoals,
    budgets: data.budgets,
    debts: data.debts,
    rateHistory: data.rateHistory ?? [],
    wishlist: data.wishlist ?? [],
    creditPurchases: data.creditPurchases ?? [],
    p2pOperations: data.p2pOperations ?? [],
    subscriptions: data.subscriptions ?? [],
    appCredits: data.appCredits ?? [],
    marketLists: data.marketLists ?? [],
    walletTransfers: data.walletTransfers ?? [],
    assets: data.assets ?? [],
    romanceFund: data.romanceFund ?? { balanceUsd: 0, movements: [] },
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Fusiona un respaldo validado con los datos actuales evitando duplicar registros con el mismo ID.
 */
export function fusionarRespaldos(
  actual: AppDataSchema,
  importado: AppDataSchema
): AppDataSchema {
  const mapById = <T extends { id: string }>(arrA: T[], arrB: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of arrA) map.set(item.id, item);
    for (const item of arrB) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: {
      ...actual.settings,
      lastOfficialRate:
        actual.settings.lastOfficialRate ?? importado.settings.lastOfficialRate,
      lastOfficialRateDate:
        actual.settings.lastOfficialRateDate ?? importado.settings.lastOfficialRateDate,
    },
    wallets: mapById(actual.wallets || [], importado.wallets || []),
    categories: mapById(actual.categories, importado.categories),
    transactions: mapById(actual.transactions, importado.transactions),
    savings: mapById(actual.savings, importado.savings),
    savingsGoals: mapById(actual.savingsGoals, importado.savingsGoals),
    budgets: mapById(actual.budgets, importado.budgets),
    debts: mapById(actual.debts, importado.debts),
    rateHistory: mapById(actual.rateHistory || [], importado.rateHistory || []),
    wishlist: mapById(actual.wishlist || [], importado.wishlist || []),
    creditPurchases: mapById(
      actual.creditPurchases || [],
      importado.creditPurchases || []
    ),
    p2pOperations: mapById(
      actual.p2pOperations || [],
      importado.p2pOperations || []
    ),
    subscriptions: mapById(
      actual.subscriptions || [],
      importado.subscriptions || []
    ),
    appCredits: mapById(
      actual.appCredits || [],
      importado.appCredits || []
    ),
    marketLists: mapById(
      actual.marketLists || [],
      importado.marketLists || []
    ),
    walletTransfers: mapById(
      actual.walletTransfers || [],
      importado.walletTransfers || []
    ),
    assets: mapById(actual.assets || [], importado.assets || []),
    romanceFund: (() => {
      const mergedMovements = mapById(
        actual.romanceFund?.movements || [],
        importado.romanceFund?.movements || []
      );
      const bal = mergedMovements.reduce(
        (acc, m) => (m.type === 'allocate' ? acc + m.amountUsd : acc - m.amountUsd),
        0
      );
      return {
        balanceUsd: Number(Math.max(0, bal).toFixed(2)),
        movements: mergedMovements,
      };
    })(),
  };
}

/**
 * Clase StorageService compatible con la arquitectura de localStorage multimoneda.
 * Provee métodos directos para gestionar el estado global, créditos de apps y listas de mercado.
 */
export class StorageService {
  static getData(): AppDataSchema {
    return cargarDatosLocalStorage();
  }

  static saveData(data: AppDataSchema): void {
    guardarDatosLocalStorage(data);
  }

  static getAppCredits(): AppCredit[] {
    const data = cargarDatosLocalStorage();
    return data.appCredits ?? [];
  }

  static saveAppCredits(appCredits: AppCredit[], transactions?: Transaction[]): AppDataSchema {
    const current = cargarDatosLocalStorage();
    const updated: AppDataSchema = {
      ...current,
      appCredits,
      transactions: transactions ?? current.transactions,
    };
    guardarDatosLocalStorage(updated);
    return updated;
  }

  static getMarketLists(): MarketList[] {
    const data = cargarDatosLocalStorage();
    return data.marketLists ?? [];
  }

  static saveMarketLists(marketLists: MarketList[], transactions?: Transaction[]): AppDataSchema {
    const current = cargarDatosLocalStorage();
    const updated: AppDataSchema = {
      ...current,
      marketLists,
      transactions: transactions ?? current.transactions,
    };
    guardarDatosLocalStorage(updated);
    return updated;
  }

  /**
   * Edita los datos de la Lista Maestra (Nombre y Monto Global Estimado, además de moneda/tasa)
   * y actualiza tanto localStorage como la proyección general al instante.
   */
  static updateMarketList(
    listId: string,
    nuevosDatos: UpdateMarketListInput,
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const updatedData = actualizarListaMercadoEnAppData(baseData, listId, nuevosDatos);
    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  /**
   * Añade un ítem a una Lista de Mercado con cantidad y montoUnitario opcionales.
   */
  static addMarketItem(
    listId: string,
    item: {
      nombre: string;
      categoria: MarketCategoryStop;
      cantidad?: number | null;
      montoUnitario?: number | null;
    },
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const updatedData = agregarItemAListaEnAppData(baseData, listId, item);
    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  /**
   * Edita un ítem individual de una Lista de Mercado (nombre, cantidad, montoUnitario, categoría).
   */
  static updateMarketItem(
    listId: string,
    itemId: string,
    datosActualizados: UpdateMarketItemInput,
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const updatedData = actualizarItemMercadoEnAppData(
      baseData,
      listId,
      itemId,
      datosActualizados
    );
    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  static getWallets(): WalletAccount[] {
    const data = cargarDatosLocalStorage();
    return data.wallets ?? [];
  }

  static saveWallets(wallets: WalletAccount[]): AppDataSchema {
    const current = cargarDatosLocalStorage();
    const updated: AppDataSchema = {
      ...current,
      wallets,
    };
    guardarDatosLocalStorage(updated);
    return updated;
  }

  static getWalletById(walletId: string): WalletAccount | undefined {
    const data = cargarDatosLocalStorage();
    return (data.wallets ?? []).find((w) => w.id === walletId);
  }

  /**
   * Calcula la comisión bancaria de un pago a otro banco según la tasa configurada en la wallet origen.
   */
  static calculateInterbankFee(
    wallet: WalletAccount | undefined,
    amount: number,
    feeType: 'pago_movil' | 'transferencia',
    isOtherBank: boolean = true
  ): {
    feePercentage: number;
    feeAmount: number;
    totalAmount: number;
    bankName: string;
    appliedMinimum?: boolean;
    minimumAmount?: number;
    isFixedFee?: boolean;
  } {
    if (!wallet || amount <= 0) {
      return {
        feePercentage: 0,
        feeAmount: 0,
        totalAmount: Math.max(0, amount),
        bankName: wallet?.banco || wallet?.name || 'Banco',
      };
    }

    let defaultPct = 0;
    let feeAmount = 0;
    let appliedMinimum = false;
    let isFixedFee = false;

    // Reglas bancarias en Bolívares (VES):
    // 1. Pago Móvil: SIEMPRE cobra comisión (sin importar si es del mismo banco o no).
    //    Tasa: 0.30% con mínimo de 14 Bs (si el % da menos de 14 Bs, se cobra 14 Bs).
    // 2. Transferencia: monto FIJO de 54 Bs para todas sin % (al mismo banco es 0 Bs).
    if (feeType === 'pago_movil') {
      defaultPct =
        wallet.comisionPagoMovil != null && Number.isFinite(wallet.comisionPagoMovil)
          ? wallet.comisionPagoMovil
          : 0.3;
      const percentageFee = (amount * defaultPct) / 100;
      if (percentageFee < 14) {
        feeAmount = 14;
        appliedMinimum = true;
      } else {
        feeAmount = percentageFee;
      }
    } else {
      // Transferencia Bancaria
      defaultPct = 0;
      if (isOtherBank) {
        feeAmount = 54; // Tarifa fija para todas las transferencias interbancarias, sin %
        isFixedFee = true;
        appliedMinimum = true;
      } else {
        feeAmount = 0; // Mismo banco no cobra nada
      }
    }

    return {
      feePercentage: defaultPct,
      feeAmount: Number(feeAmount.toFixed(4)),
      totalAmount: Number((amount + feeAmount).toFixed(4)),
      bankName: wallet.banco || wallet.name,
      appliedMinimum,
      minimumAmount: feeType === 'pago_movil' ? 14 : 54,
      isFixedFee,
    };
  }

  /**
   * Registra un egreso y, si aplica comisión interbancaria, crea un egreso separado
   * bajo la categoría 'Comisiones Bancarias' debitando el total (Monto + Comisión) de la wallet.
   */
  static recordExpenseWithCommission(
    primaryExpense: Transaction,
    feeExpense?: Transaction
  ): {
    updatedData: AppDataSchema;
    primaryExpense: Transaction;
    feeExpense?: Transaction;
  } {
    const current = cargarDatosLocalStorage();
    const existsPrimary = current.transactions.some((t) => t.id === primaryExpense.id);
    let nextTxns = existsPrimary
      ? current.transactions.map((t) => (t.id === primaryExpense.id ? primaryExpense : t))
      : [primaryExpense, ...current.transactions];

    if (feeExpense) {
      const existsFee = nextTxns.some((t) => t.id === feeExpense.id);
      nextTxns = existsFee
        ? nextTxns.map((t) => (t.id === feeExpense.id ? feeExpense : t))
        : [feeExpense, ...nextTxns];
    }

    const updatedData: AppDataSchema = {
      ...current,
      transactions: nextTxns,
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      primaryExpense,
      feeExpense,
    };
  }

  // ==========================================================================
  // MÓDULO 1: TRANSFERENCIAS ENTRE WALLETS CON TASA PERSONALIZADA (CONVERSOR P2P)
  // ==========================================================================

  static getWalletTransfers(): WalletTransfer[] {
    const data = cargarDatosLocalStorage();
    return data.walletTransfers ?? [];
  }

  static saveWalletTransfers(walletTransfers: WalletTransfer[]): AppDataSchema {
    const current = cargarDatosLocalStorage();
    const updated: AppDataSchema = {
      ...current,
      walletTransfers,
    };
    guardarDatosLocalStorage(updated);
    return updated;
  }

  /**
   * Calcula automáticamente el Monto a acreditar en la Wallet Destino
   * según las monedas de las Wallets Origen y Destino y la Tasa de Cambio de la operación.
   */
  static calculateWalletTransferCreditAmount(
    amountOut: number,
    sourceCurrency: CurrencyCode,
    destinationCurrency: CurrencyCode,
    exchangeRate: number
  ): number {
    if (!Number.isFinite(amountOut) || amountOut <= 0) return 0;
    const rate = Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : 1;

    const isSourceVes = sourceCurrency === 'VES';
    const isDestVes = destinationCurrency === 'VES';

    // USD / USDT -> VES: Multiplicar monto origen por la tasa (Bs/USD)
    if (!isSourceVes && isDestVes) {
      return Number((amountOut * rate).toFixed(2));
    }

    // VES -> USD / USDT: Dividir monto en Bs entre la tasa (Bs/USD)
    if (isSourceVes && !isDestVes) {
      return Number((amountOut / rate).toFixed(4));
    }

    // Misma naturaleza de moneda (USD <-> USDT, USD <-> USD, VES <-> VES):
    // Por defecto la tasa es 1, pero si hay comisión/prima P2P (ej. 0.99 o 1.01) se multiplica por la tasa
    return Number((amountOut * rate).toFixed(isDestVes ? 2 : 4));
  }

  /**
   * Registra una transferencia interna entre dos Wallets (Conversor P2P).
   * - Descuenta 'amountOut' del Saldo Real de la Wallet Origen.
   * - Suma 'amountIn' al Saldo Real de la Wallet Destino.
   * - NO crea ningún Ingreso ni Gasto regular en data.transactions para no ensuciar estadísticas mensuales.
   */
  static registerWalletTransfer(
    input: {
      date: string;
      sourceWalletId: string;
      destinationWalletId: string;
      amountOut: number;
      exchangeRate: number;
      amountIn?: number;
      feeAmount?: number;
      feeExchangeRateUsd?: number;
      notes?: string;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    transfer: WalletTransfer;
    feeTransaction?: Transaction;
  } {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const wallets = baseData.wallets || [];
    const sourceWallet = wallets.find((w) => w.id === input.sourceWalletId);
    const destWallet = wallets.find((w) => w.id === input.destinationWalletId);

    if (!sourceWallet) {
      throw new Error('Debes seleccionar una Wallet Origen válida.');
    }
    if (!destWallet) {
      throw new Error('Debes seleccionar una Wallet Destino válida.');
    }
    if (sourceWallet.id === destWallet.id) {
      throw new Error('La Wallet Origen y la Wallet Destino deben ser distintas.');
    }
    if (!Number.isFinite(input.amountOut) || input.amountOut <= 0) {
      throw new Error('El monto a debitar debe ser mayor que cero.');
    }
    if (!Number.isFinite(input.exchangeRate) || input.exchangeRate <= 0) {
      throw new Error('La tasa de cambio de la operación debe ser mayor que cero.');
    }

    const computedIn =
      input.amountIn != null && Number.isFinite(input.amountIn) && input.amountIn > 0
        ? Number(input.amountIn.toFixed(destWallet.currency === 'VES' ? 2 : 4))
        : StorageService.calculateWalletTransferCreditAmount(
            input.amountOut,
            sourceWallet.currency,
            destWallet.currency,
            input.exchangeRate
          );

    const dateStr =
      typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
        ? input.date
        : obtenerFechaLocalIso();

    let feeTransaction: Transaction | undefined;
    const validFee =
      typeof input.feeAmount === 'number' &&
      Number.isFinite(input.feeAmount) &&
      input.feeAmount > 0
        ? Number(input.feeAmount.toFixed(2))
        : 0;

    if (validFee > 0) {
      const activeUsdRate =
        input.feeExchangeRateUsd && input.feeExchangeRateUsd > 0
          ? input.feeExchangeRateUsd
          : baseData.settings.lastOfficialRate ||
            baseData.settings.defaultExchangeRate ||
            450;

      const feeCategoryId = obtenerIdCategoriaComisionBancaria(
        baseData.categories
      );

      const isVesSrc = sourceWallet.currency === 'VES';
      const feeUsd = isVesSrc
        ? activeUsdRate > 0
          ? Number((validFee / activeUsdRate).toFixed(6))
          : 0
        : Number(validFee.toFixed(6));

      const nowIso = new Date().toISOString();

      feeTransaction = {
        id: `txn_trfee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: dateStr,
        type: 'expense',
        status: 'completed',
        walletId: sourceWallet.id,
        description: `Comisión transferencia: ${sourceWallet.name} → ${destWallet.name}`,
        categoryId: feeCategoryId,
        amount: validFee,
        currency: sourceWallet.currency,
        exchangeRate: isVesSrc ? activeUsdRate : null,
        amountUsd: feeUsd,
        exchangeRateSource: isVesSrc ? 'bcv' : 'none',
        paymentMethod: 'Transferencia',
        expenseType: 'variable',
        isRecurring: false,
        notes: input.notes?.trim()
          ? `Comisión bancaria por transferencia (${input.notes.trim()})`
          : `Comisión bancaria descontada al pasar fondos de ${sourceWallet.name} a ${destWallet.name}`,
        createdAt: nowIso,
        processedAt: nowIso,
      };
    }

    const transfer: WalletTransfer = {
      id: `wtr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      date: dateStr,
      sourceWalletId: sourceWallet.id,
      sourceCurrency: sourceWallet.currency,
      amountOut: Number(
        input.amountOut.toFixed(sourceWallet.currency === 'VES' ? 2 : 4)
      ),
      destinationWalletId: destWallet.id,
      destinationCurrency: destWallet.currency,
      amountIn: computedIn,
      exchangeRate: Number(input.exchangeRate.toFixed(2)),
      feeAmount: validFee > 0 ? validFee : undefined,
      feeTransactionId: feeTransaction?.id,
      notes: input.notes?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    const updatedData: AppDataSchema = {
      ...baseData,
      walletTransfers: [transfer, ...(baseData.walletTransfers || [])],
      transactions: feeTransaction
        ? [feeTransaction, ...(baseData.transactions || [])]
        : baseData.transactions,
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      transfer,
      feeTransaction,
    };
  }

  /**
   * Elimina / revierte una transferencia entre Wallets restableciendo los saldos reales de ambas cuentas
   * (y eliminando también el gasto de comisión bancaria asociado si existía).
   */
  static deleteWalletTransfer(
    transferId: string,
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const target = (baseData.walletTransfers || []).find(
      (t) => t.id === transferId
    );
    const updatedData: AppDataSchema = {
      ...baseData,
      walletTransfers: (baseData.walletTransfers || []).filter(
        (t) => t.id !== transferId
      ),
      transactions: target?.feeTransactionId
        ? (baseData.transactions || []).filter(
            (tx) => tx.id !== target.feeTransactionId
          )
        : baseData.transactions,
    };
    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  // ==========================================================================
  // MÓDULO 2: GENERADOR DE REPORTE MENSUAL EN PDF (ESTADO DE CUENTA)
  // ==========================================================================

  /**
   * Construye el resumen estructurado del Estado de Cuenta para un mes dado (ej. '2026-10'):
   * - Total Ingresos, Total Egresos y Balance Neto del mes
   * - Gastos desglosados por Categoría
   * - Saldo Real actual de todas las Wallets
   * - Transferencias internas entre Wallets realizadas en el mes
   * - Movimientos completados del mes
   */
  static getMonthlyStatementReport(
    monthKey: string,
    currentData?: AppDataSchema
  ) {
    const data = currentData ?? cargarDatosLocalStorage();
    const resumenMes = calcularResumenFinanciero(data, monthKey);
    const resumenBilleteras = calcularResumenBilleteras(data, monthKey);

    const activeRate =
      (data.settings.preferManualRateByDefault &&
        data.settings.defaultExchangeRate) ||
      data.settings.lastOfficialRate ||
      data.settings.defaultExchangeRate ||
      450;

    const monthTransactions = data.transactions
      .filter(
        (t) =>
          esTransaccionCompletada(t) &&
          obtenerFechaEfectivaContableTransaccion(t, data).startsWith(monthKey)
      )
      .map((t) => {
        const effectiveDate = obtenerFechaEfectivaContableTransaccion(t, data);
        if (effectiveDate !== t.date) {
          const origLabel = `(Pagado el ${effectiveDate} · Vencimiento original: ${t.date})`;
          return {
            ...t,
            date: effectiveDate,
            description: t.description.includes('Vencimiento original')
              ? t.description
              : `${t.description} ${origLabel}`,
          };
        }
        return t;
      })
      .sort((a, b) => compararTransaccionesRecientesPrimero(a, b));

    const gastosPorCategoria = calcularDistribucionPorCategoria(
      monthTransactions,
      data.categories,
      'expense'
    );

    const ingresosPorCategoria = calcularDistribucionPorCategoria(
      monthTransactions,
      data.categories,
      'income'
    );

    const monthWalletTransfers = (data.walletTransfers || [])
      .filter((tr) => tr.date.startsWith(monthKey))
      .sort((a, b) => compararRegistrosConHoraRecientesPrimero(a, b));

    return {
      monthKey,
      monthLabel: formatearNombreMes(monthKey),
      generatedAtIso: new Date().toISOString(),
      userName: data.settings.userName || 'Mis Finanzas',
      activeRate,
      resumenMes,
      gastosPorCategoria,
      ingresosPorCategoria,
      billeterasActivas: resumenBilleteras.billeteras.filter(
        (wb) =>
          wb.wallet.active &&
          !(wb.wallet.isPassThroughAccount && wb.wallet.hidePassThroughHistory)
      ),
      resumenSoloUsd: resumenBilleteras.resumenSoloUsd,
      resumenSoloVes: resumenBilleteras.resumenSoloVes,
      totalConsolidadoUsd: resumenBilleteras.totalSaldoActualUsd,
      totalConsolidadoVesEquiv: resumenBilleteras.totalSaldoActualVesEquiv,
      monthWalletTransfers,
      monthTransactions,
    };
  }

  // ==========================================================================
  // MÓDULO 1 (NUEVO): BÓVEDA DE GARANTÍAS Y MANTENIMIENTO (ASSET TRACKER)
  // ==========================================================================

  static getAssets(currentData?: AppDataSchema): Asset[] {
    const data = currentData ?? cargarDatosLocalStorage();
    return data.assets ?? [];
  }

  static evaluateAssetStatus(
    asset: Asset,
    referenceDateIso?: string
  ): AssetStatusEvaluation {
    return calcularEstadoAsset(asset, referenceDateIso);
  }

  static saveAsset(
    input: {
      id?: string;
      nombre: string;
      costo: number;
      moneda: CurrencyCode;
      exchangeRate?: number | null;
      fechaCompra: string;
      mesesGarantia: number;
      frecuenciaMantenimientoMeses: number;
      notas?: string;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    asset: Asset;
  } {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const trimmedName = input.nombre.trim();
    if (!trimmedName) {
      throw new Error('Debes indicar el nombre del bien o equipo.');
    }
    if (!Number.isFinite(input.costo) || input.costo < 0) {
      throw new Error('El costo del bien debe ser un número válido.');
    }

    const activeRate =
      input.exchangeRate && input.exchangeRate > 0
        ? input.exchangeRate
        : baseData.settings.lastOfficialRate ||
          baseData.settings.defaultExchangeRate ||
          450;

    const costoUsd =
      input.moneda === 'VES'
        ? Number((input.costo / activeRate).toFixed(2))
        : Number(input.costo.toFixed(2));

    const existingList = baseData.assets || [];
    const existing = input.id
      ? existingList.find((a) => a.id === input.id)
      : undefined;

    const savedAsset: Asset = {
      id:
        existing?.id ||
        `asset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nombre: trimmedName,
      costo: Number(input.costo.toFixed(2)),
      moneda: input.moneda === 'VES' ? 'VES' : 'USD',
      exchangeRate: input.moneda === 'VES' ? activeRate : null,
      costoUsd,
      fechaCompra: input.fechaCompra || obtenerFechaLocalIso(),
      mesesGarantia: Math.max(0, Math.round(input.mesesGarantia || 0)),
      frecuenciaMantenimientoMeses: Math.max(
        0,
        Math.round(input.frecuenciaMantenimientoMeses || 0)
      ),
      historialMantenimiento: existing?.historialMantenimiento || [],
      notas: input.notas?.trim() || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    const nextAssets = existing
      ? existingList.map((a) => (a.id === savedAsset.id ? savedAsset : a))
      : [savedAsset, ...existingList];

    const updatedData: AppDataSchema = {
      ...baseData,
      assets: nextAssets,
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      asset: savedAsset,
    };
  }

  static deleteAsset(
    assetId: string,
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const updatedData: AppDataSchema = {
      ...baseData,
      assets: (baseData.assets || []).filter((a) => a.id !== assetId),
    };
    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  /**
   * Registra un mantenimiento para un Bien (Asset) y crea un egreso regular ('completed')
   * en data.transactions afectando el Saldo Real.
   */
  static registerAssetMaintenance(
    input: {
      assetId: string;
      fecha: string;
      costo: number;
      moneda: CurrencyCode;
      exchangeRate?: number | null;
      walletId: string;
      categoryId?: string;
      notas?: string;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    maintenanceRecord: AssetMaintenanceRecord;
    expenseTransaction: Transaction;
  } {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const asset = (baseData.assets || []).find((a) => a.id === input.assetId);
    if (!asset) {
      throw new Error('No se encontró el bien seleccionado.');
    }
    if (!Number.isFinite(input.costo) || input.costo <= 0) {
      throw new Error('El costo del mantenimiento debe ser mayor que cero.');
    }

    const activeRate =
      input.exchangeRate && input.exchangeRate > 0
        ? input.exchangeRate
        : baseData.settings.lastOfficialRate ||
          baseData.settings.defaultExchangeRate ||
          450;

    const costoUsd =
      input.moneda === 'VES'
        ? Number((input.costo / activeRate).toFixed(4))
        : Number(input.costo.toFixed(4));

    const defaultCategory =
      input.categoryId ||
      baseData.categories.find(
        (c) =>
          c.type === 'expense' &&
          (c.id === 'cat_exp_housing' || c.id === 'cat_exp_utilities')
      )?.id ||
      baseData.categories.find((c) => c.type === 'expense')?.id ||
      'cat_exp_other';

    const txnId = `txn_maint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fecha =
      typeof input.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.fecha)
        ? input.fecha
        : obtenerFechaLocalIso();

    const expenseTransaction: Transaction = {
      id: txnId,
      type: 'expense',
      status: 'completed',
      expenseType: 'variable',
      amount: Number(input.costo.toFixed(2)),
      currency: input.moneda === 'VES' ? 'VES' : 'USD',
      exchangeRate: input.moneda === 'VES' ? activeRate : null,
      exchangeRateSource: input.moneda === 'VES' ? 'bcv' : 'none',
      amountUsd: costoUsd,
      categoryId: defaultCategory,
      walletId: input.walletId || baseData.wallets?.[0]?.id,
      date: fecha,
      description: `Mantenimiento: ${asset.nombre}${
        input.notas?.trim() ? ` (${input.notas.trim()})` : ''
      }`,
      notes: input.notas?.trim() || `Mantenimiento preventivo/correctivo de ${asset.nombre}`,
      createdAt: new Date().toISOString(),
    };

    const maintenanceRecord: AssetMaintenanceRecord = {
      id: `maint_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fecha,
      costo: Number(input.costo.toFixed(2)),
      moneda: input.moneda === 'VES' ? 'VES' : 'USD',
      exchangeRate: input.moneda === 'VES' ? activeRate : null,
      costoUsd: Number(costoUsd.toFixed(2)),
      walletId: expenseTransaction.walletId || '',
      linkedTransactionId: txnId,
      notas: input.notas?.trim() || '',
      createdAt: new Date().toISOString(),
    };

    const updatedAsset: Asset = {
      ...asset,
      historialMantenimiento: [
        maintenanceRecord,
        ...(asset.historialMantenimiento || []),
      ],
    };

    const updatedData: AppDataSchema = {
      ...baseData,
      assets: (baseData.assets || []).map((a) =>
        a.id === asset.id ? updatedAsset : a
      ),
      transactions: [expenseTransaction, ...baseData.transactions],
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      maintenanceRecord,
      expenseTransaction,
    };
  }

  // ==========================================================================
  // MÓDULO 2 (NUEVO): FONDO DE CITAS Y 'RULETA DE CITAS' (ROMANCE BUDGET)
  // ==========================================================================

  static getRomanceFund(currentData?: AppDataSchema): RomanceFundState {
    const data = currentData ?? cargarDatosLocalStorage();
    return data.romanceFund ?? { balanceUsd: 0, movements: [] };
  }

  /**
   * Evalúa el monto disponible en el Fondo de Citas y sugiere un plan aleatorio por tramos:
   * <$10: 'Helados/Caminar', $10-$30: 'Cine/Hamburguesas', >$30: 'Cena/Especial'.
   */
  static spinRomanceRoulette(
    availableBalanceUsd: number,
    excludePlanTitle?: string
  ): RomanceRouletteSuggestion {
    return evaluarRuletaDeCitas(availableBalanceUsd, excludePlanTitle);
  }

  /**
   * Asigna dinero manualmente al Fondo Virtual de Citas.
   * Este dinero deja de verse como disponible en el Saldo General y en la Wallet elegida.
   */
  static allocateToRomanceFund(
    input: {
      date: string;
      amount: number;
      currency: CurrencyCode;
      exchangeRate?: number | null;
      walletId?: string;
      notes?: string;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    movement: RomanceFundMovement;
  } {
    const baseData = currentData ?? cargarDatosLocalStorage();
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Ingresa un monto mayor que cero para asignar al Fondo de Citas.');
    }

    const activeRate =
      input.exchangeRate && input.exchangeRate > 0
        ? input.exchangeRate
        : baseData.settings.lastOfficialRate ||
          baseData.settings.defaultExchangeRate ||
          450;

    const amountUsd =
      input.currency === 'VES'
        ? Number((input.amount / activeRate).toFixed(4))
        : Number(input.amount.toFixed(4));

    const movement: RomanceFundMovement = {
      id: `rf_alloc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'allocate',
      date:
        typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
          ? input.date
          : obtenerFechaLocalIso(),
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency === 'VES' ? 'VES' : 'USD',
      exchangeRate: input.currency === 'VES' ? activeRate : null,
      amountUsd: Number(amountUsd.toFixed(2)),
      walletId: input.walletId || baseData.wallets?.[0]?.id,
      linkedTransactionId: null,
      notes: input.notes?.trim() || 'Asignación al Fondo de Citas',
      createdAt: new Date().toISOString(),
    };

    const prevMovements = baseData.romanceFund?.movements || [];
    const nextMovements = [movement, ...prevMovements];
    const nextBalance = nextMovements.reduce(
      (acc, m) => (m.type === 'allocate' ? acc + m.amountUsd : acc - m.amountUsd),
      0
    );

    const updatedData: AppDataSchema = {
      ...baseData,
      romanceFund: {
        balanceUsd: Number(Math.max(0, nextBalance).toFixed(2)),
        movements: nextMovements,
      },
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      movement,
    };
  }

  /**
   * Gasta dinero del Fondo de Citas:
   * 1. Resta el monto del Fondo Virtual de Citas.
   * 2. Registra el egreso general ('completed') en data.transactions.
   * 3. Guarda la nota/recuerdo opcional (ej. 'Cita mensual') y el plan realizado.
   */
  static spendFromRomanceFund(
    input: {
      date: string;
      amount: number;
      currency: CurrencyCode;
      exchangeRate?: number | null;
      walletId: string;
      categoryId?: string;
      planName?: string;
      notes?: string;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    movement: RomanceFundMovement;
    expenseTransaction: Transaction;
  } {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const currentFund = baseData.romanceFund || { balanceUsd: 0, movements: [] };

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('Ingresa un monto mayor que cero para gastar del fondo.');
    }

    const activeRate =
      input.exchangeRate && input.exchangeRate > 0
        ? input.exchangeRate
        : baseData.settings.lastOfficialRate ||
          baseData.settings.defaultExchangeRate ||
          450;

    const amountUsd =
      input.currency === 'VES'
        ? Number((input.amount / activeRate).toFixed(4))
        : Number(input.amount.toFixed(4));

    if (amountUsd > currentFund.balanceUsd + 0.05) {
      throw new Error(
        `El monto supera el saldo disponible en tu Fondo de Citas ($${currentFund.balanceUsd.toFixed(2)} USD).`
      );
    }

    const defaultCategory =
      input.categoryId ||
      baseData.categories.find(
        (c) =>
          c.type === 'expense' &&
          (c.id === 'cat_exp_restaurants' || c.id === 'cat_exp_entertainment')
      )?.id ||
      baseData.categories.find((c) => c.type === 'expense')?.id ||
      'cat_exp_other';

    const txnId = `txn_romance_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const dateStr =
      typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
        ? input.date
        : obtenerFechaLocalIso();

    const planText = input.planName?.trim() || 'Cita Romántica';
    const memoryText = input.notes?.trim() || '';

    const expenseTransaction: Transaction = {
      id: txnId,
      type: 'expense',
      status: 'completed',
      expenseType: 'variable',
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency === 'VES' ? 'VES' : 'USD',
      exchangeRate: input.currency === 'VES' ? activeRate : null,
      exchangeRateSource: input.currency === 'VES' ? 'bcv' : 'none',
      amountUsd: Number(amountUsd.toFixed(2)),
      categoryId: defaultCategory,
      walletId: input.walletId || baseData.wallets?.[0]?.id,
      date: dateStr,
      description: `Fondo de Citas: ${planText}${
        memoryText ? ` — ${memoryText}` : ''
      }`,
      notes: memoryText || `Cita realizada con el Fondo de Citas (${planText})`,
      createdAt: new Date().toISOString(),
    };

    const movement: RomanceFundMovement = {
      id: `rf_spend_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'spend',
      date: dateStr,
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency === 'VES' ? 'VES' : 'USD',
      exchangeRate: input.currency === 'VES' ? activeRate : null,
      amountUsd: Number(amountUsd.toFixed(2)),
      walletId: expenseTransaction.walletId,
      linkedTransactionId: txnId,
      planName: planText,
      notes: memoryText,
      createdAt: new Date().toISOString(),
    };

    const nextMovements = [movement, ...currentFund.movements];
    const nextBalance = nextMovements.reduce(
      (acc, m) => (m.type === 'allocate' ? acc + m.amountUsd : acc - m.amountUsd),
      0
    );

    const updatedData: AppDataSchema = {
      ...baseData,
      romanceFund: {
        balanceUsd: Number(Math.max(0, nextBalance).toFixed(2)),
        movements: nextMovements,
      },
      transactions: [expenseTransaction, ...baseData.transactions],
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      movement,
      expenseTransaction,
    };
  }

  /**
   * Elimina un movimiento del Fondo de Citas (y si era un gasto de cita, elimina el egreso asociado).
   */
  static deleteRomanceFundMovement(
    movementId: string,
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const currentFund = baseData.romanceFund || { balanceUsd: 0, movements: [] };
    const target = currentFund.movements.find((m) => m.id === movementId);
    if (!target) return baseData;

    const nextMovements = currentFund.movements.filter((m) => m.id !== movementId);
    const nextBalance = nextMovements.reduce(
      (acc, m) => (m.type === 'allocate' ? acc + m.amountUsd : acc - m.amountUsd),
      0
    );

    const nextTransactions = target.linkedTransactionId
      ? baseData.transactions.filter((t) => t.id !== target.linkedTransactionId)
      : baseData.transactions;

    const updatedData: AppDataSchema = {
      ...baseData,
      romanceFund: {
        balanceUsd: Number(Math.max(0, nextBalance).toFixed(2)),
        movements: nextMovements,
      },
      transactions: nextTransactions,
    };

    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  // ==========================================================================
  // CÁPSULA DEL TIEMPO FINANCIERA (ESTILO SPOTIFY WRAPPED)
  // ==========================================================================

  /**
   * Extrae y calcula las métricas anuales para la Cápsula del Tiempo Financiera (Wrapped):
   * - Total gastado en el año (USD y equivalente Bs)
   * - Categoría donde más se gastó
   * - Total de cuotas de créditos pagadas (Compras por Cuota + Créditos de Apps)
   * - El artículo más caro comprado en la 'Lista de Mercado/Hogar' (Assets, Lista de Mercado, Wishlist comprada o gastos Hogar/Mercado)
   * - Total gastado en el 'Fondo de Citas'
   */
  static generateYearlyWrapped(
    year: number | string,
    currentData?: AppDataSchema
  ): YearlyWrappedReport {
    const baseData = currentData ?? cargarDatosLocalStorage();
    const numericYear =
      typeof year === 'number' && Number.isFinite(year)
        ? year
        : Number(String(year).slice(0, 4)) || new Date().getFullYear();
    const yearPrefix = String(numericYear);

    const activeRate =
      baseData.settings.lastOfficialRate ||
      baseData.settings.defaultExchangeRate ||
      450;

    // 1. Filtrar todos los gastos completados del año
    const yearExpenses = (baseData.transactions || []).filter(
      (t) =>
        t.type === 'expense' &&
        t.date.startsWith(yearPrefix) &&
        esTransaccionCompletada(t)
    );

    const totalSpentYearUsd = Number(
      yearExpenses.reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0).toFixed(2)
    );
    const totalSpentYearVesEquiv = Number(
      (totalSpentYearUsd * activeRate).toFixed(2)
    );

    // 2. Categoría donde más se gastó en el año
    const categoryDist = calcularDistribucionPorCategoria(
      yearExpenses,
      baseData.categories || [],
      'expense'
    );
    const topCatItem = categoryDist.length > 0 ? categoryDist[0] : null;
    const topCategory = topCatItem
      ? {
          categoryId: topCatItem.categoryId,
          categoryName: topCatItem.categoryName,
          color: topCatItem.color,
          totalUsd: Number(topCatItem.amountUsd.toFixed(2)),
          percentage: Number(topCatItem.percentage.toFixed(1)),
          count: topCatItem.count,
        }
      : null;

    // 3. Total de cuotas de créditos pagadas en el año (Compras por Cuota + Créditos de Apps)
    let totalCreditInstallmentsPaid = 0;
    let totalCreditInstallmentsPaidUsd = 0;

    for (const purchase of baseData.creditPurchases || []) {
      for (const inst of purchase.installments || []) {
        const refDate = inst.paidAt || inst.dueDate || purchase.purchaseDate || '';
        const isYearMatch = refDate.startsWith(yearPrefix) || !refDate;
        if (inst.status === 'paid' && isYearMatch) {
          totalCreditInstallmentsPaid += 1;
          totalCreditInstallmentsPaidUsd += Number(inst.amountUsd) || 0;
        }
      }
    }

    for (const appCred of baseData.appCredits || []) {
      for (const inst of appCred.installments || []) {
        const refDate = inst.paidAt || inst.dueDate || appCred.requestDate || '';
        const isYearMatch = refDate.startsWith(yearPrefix) || !refDate;
        if (inst.status === 'paid' && isYearMatch) {
          totalCreditInstallmentsPaid += 1;
          totalCreditInstallmentsPaidUsd +=
            Number(inst.totalInstallmentAmountUsd) || 0;
        }
      }
    }

    // Si no hubo cuotas marcadas con fecha exacta del año pero existen pagos de cuotas en transacciones del año, respaldar conteo
    if (totalCreditInstallmentsPaid === 0) {
      const installmentTxns = yearExpenses.filter((t) => {
        const desc = t.description.toLowerCase();
        return (
          desc.includes('cuota #') ||
          desc.includes('abono cuota') ||
          desc.includes('cuota ')
        );
      });
      if (installmentTxns.length > 0) {
        totalCreditInstallmentsPaid = installmentTxns.length;
        totalCreditInstallmentsPaidUsd = installmentTxns.reduce(
          (acc, t) => acc + (Number(t.amountUsd) || 0),
          0
        );
      }
    }

    totalCreditInstallmentsPaidUsd = Number(
      totalCreditInstallmentsPaidUsd.toFixed(2)
    );

    // 4. El artículo más caro comprado en la 'Lista de Mercado/Hogar'
    const homeCandidates: {
      name: string;
      amountUsd: number;
      sourceLabel: string;
      date: string;
    }[] = [];

    // 4a. Bienes del hogar en Bóveda de Garantías (Assets)
    for (const asset of baseData.assets || []) {
      const refDate = asset.fechaCompra || '';
      if (
        (refDate.startsWith(yearPrefix) || (baseData.assets || []).length > 0) &&
        asset.costoUsd > 0
      ) {
        homeCandidates.push({
          name: asset.nombre,
          amountUsd: Number(asset.costoUsd.toFixed(2)),
          sourceLabel: 'Bóveda del Hogar / Garantías',
          date: asset.fechaCompra || `${yearPrefix}-01-01`,
        });
      }
    }

    // 4b. Listas de Mercado cerradas o abiertas
    for (const mList of baseData.marketLists || []) {
      const refDate = mList.fecha || '';
      const paidRealUsd = Number(mList.totalPagadoRealUsd) || 0;
      const estimatedUsd = Number(mList.presupuestoEstimadoUsd) || 0;
      const totalListUsd = paidRealUsd > 0 ? paidRealUsd : estimatedUsd;
      if (totalListUsd > 0 && (refDate.startsWith(yearPrefix) || !refDate)) {
        const boughtItemsCount = (mList.items || []).filter((it) => it.comprado).length;
        homeCandidates.push({
          name:
            boughtItemsCount > 0
              ? `${mList.nombre} (${boughtItemsCount} artículos)`
              : mList.nombre || 'Compra de Mercado',
          amountUsd: Number(totalListUsd.toFixed(2)),
          sourceLabel: 'Lista de Mercado',
          date: mList.fecha || `${yearPrefix}-01-01`,
        });
      }
    }

    // 4c. Artículos comprados en Wishlist
    for (const wish of baseData.wishlist || []) {
      if (wish.estado === 'Comprado' && wish.costoEstimado > 0) {
        const refDate = wish.createdAt || '';
        const wishUsd =
          wish.moneda === 'VES'
            ? wish.costoEstimado / activeRate
            : wish.costoEstimado;
        if (refDate.startsWith(yearPrefix) || !refDate) {
          homeCandidates.push({
            name: wish.nombre,
            amountUsd: Number(wishUsd.toFixed(2)),
            sourceLabel: 'Meta de Compra / Hogar',
            date: refDate.slice(0, 10) || `${yearPrefix}-01-01`,
          });
        }
      }
    }

    // 4d. Transacciones de gasto en categorías de Hogar, Vivienda o Alimentación/Mercado
    const homeCategoryIds = new Set(
      (baseData.categories || [])
        .filter((c) => {
          const lower = c.name.toLowerCase();
          return (
            c.id === 'cat_exp_food' ||
            c.id === 'cat_exp_housing' ||
            lower.includes('hogar') ||
            lower.includes('mercado') ||
            lower.includes('alimenta') ||
            lower.includes('vivienda') ||
            lower.includes('electro')
          );
        })
        .map((c) => c.id)
    );

    for (const txn of yearExpenses) {
      if (homeCategoryIds.has(txn.categoryId) && txn.amountUsd > 0) {
        homeCandidates.push({
          name: txn.description,
          amountUsd: Number(txn.amountUsd.toFixed(2)),
          sourceLabel: 'Mercado / Hogar',
          date: txn.date,
        });
      }
    }

    // Ordenar de mayor a menor precio para elegir el artículo más caro comprado en Mercado/Hogar
    homeCandidates.sort((a, b) => b.amountUsd - a.amountUsd);
    const mostExpensiveHomeItem =
      homeCandidates.length > 0 ? homeCandidates[0] : null;

    // 5. Total gastado en el 'Fondo de Citas'
    const romanceMovements = (baseData.romanceFund?.movements || []).filter(
      (m) =>
        m.type === 'spend' &&
        (m.date.startsWith(yearPrefix) || !m.date)
    );

    let totalRomanceSpentUsd = romanceMovements.reduce(
      (acc, m) => acc + (Number(m.amountUsd) || 0),
      0
    );
    let romanceDatesCount = romanceMovements.length;
    let lastRomanceMemory: string | null =
      romanceMovements.length > 0
        ? romanceMovements[0].notes ||
          romanceMovements[0].planName ||
          'Cita especial en pareja'
        : null;

    // También considerar gastos directos cuya descripción o categoría sea de citas/pareja si aún no hay movimientos en romanceFund
    if (totalRomanceSpentUsd === 0) {
      const coupleExpenses = yearExpenses.filter((t) => {
        const desc = t.description.toLowerCase();
        return (
          Boolean(t.sharedExpenseId) ||
          desc.includes('cita') ||
          desc.includes('romántic') ||
          desc.includes('aniversario')
        );
      });
      if (coupleExpenses.length > 0) {
        totalRomanceSpentUsd = coupleExpenses.reduce(
          (acc, t) => acc + (Number(t.amountUsd) || 0),
          0
        );
        romanceDatesCount = coupleExpenses.length;
        lastRomanceMemory = coupleExpenses[0].description;
      }
    }

    totalRomanceSpentUsd = Number(totalRomanceSpentUsd.toFixed(2));

    return {
      year: numericYear,
      totalSpentYearUsd,
      totalSpentYearVesEquiv,
      totalExpensesCount: yearExpenses.length,
      topCategory,
      totalCreditInstallmentsPaid,
      totalCreditInstallmentsPaidUsd,
      mostExpensiveHomeItem,
      totalRomanceSpentUsd,
      romanceDatesCount,
      lastRomanceMemory,
    };
  }

  // ==========================================================================
  // MÓDULO DE GAMIFICACIÓN: SALA DE TROFEOS Y LOGROS (ACHIEVEMENTS ENGINE)
  // ==========================================================================

  /**
   * Evalúa todos los trofeos definidos en TROPHIES contra los datos actuales
   * del localStorage, guarda el arreglo con los IDs de los trofeos desbloqueados
   * y retorna el detalle completo para renderizar la Sala de Trofeos y Logros.
   */
  static checkAchievements(currentData?: AppDataSchema): TrophyCheckResult {
    const data = currentData ?? this.getData();

    let previousUnlockedIds: string[] = [];
    try {
      const rawPrev = localStorage.getItem(UNLOCKED_ACHIEVEMENTS_STORAGE_KEY);
      if (rawPrev) {
        const parsed = JSON.parse(rawPrev);
        if (Array.isArray(parsed)) {
          previousUnlockedIds = parsed.filter((id) => typeof id === 'string');
        }
      } else if (Array.isArray(data.unlockedAchievements)) {
        previousUnlockedIds = data.unlockedAchievements;
      }
    } catch {
      previousUnlockedIds = [];
    }

    const evaluatedTrophies: TrophyEvaluationItem[] = TROPHIES.map((trophy) => {
      let unlocked = false;
      try {
        unlocked = Boolean(trophy.evaluator(data));
      } catch {
        unlocked = false;
      }

      const progress = trophy.getProgress
        ? trophy.getProgress(data)
        : {
            current: unlocked ? 1 : 0,
            target: 1,
            unitLabel: 'meta',
            detailText: unlocked ? 'Meta completada' : 'Pendiente por desbloquear',
          };

      return {
        ...trophy,
        unlocked,
        progress,
      };
    });

    const unlockedIds = evaluatedTrophies
      .filter((t) => t.unlocked)
      .map((t) => t.id);

    const newlyUnlockedIds = unlockedIds.filter(
      (id) => !previousUnlockedIds.includes(id)
    );

    try {
      localStorage.setItem(
        UNLOCKED_ACHIEVEMENTS_STORAGE_KEY,
        JSON.stringify(unlockedIds)
      );
    } catch {
      // Ignore storage quota errors
    }

    return {
      unlockedIds,
      newlyUnlockedIds,
      trophies: evaluatedTrophies,
      totalCount: evaluatedTrophies.length,
      unlockedCount: unlockedIds.length,
    };
  }

  // ==========================================================================
  // MÓDULO: PLANIFICADOR DE MENÚ SEMANAL Y CONEXIÓN CON LISTA DE MERCADO
  // ==========================================================================

  /**
   * Obtiene la entidad MenuSemanal actual (Lunes a Domingo).
   */
  static getWeeklyMenu(currentData?: AppDataSchema): MenuSemanal {
    const data = currentData ?? this.getData();
    return data.weeklyMenu ?? createEmptyWeeklyMenu();
  }

  /**
   * Agrega o edita una Comida (Nombre del plato, Tipo: Desayuno/Almuerzo/Cena,
   * y arreglo de Ingredientes en texto plano) dentro de un día de la semana.
   */
  static saveMealToDay(
    day: DayOfWeekKey,
    mealInput: {
      id?: string;
      nombre: string;
      tipo: MealType;
      ingredientes: string[];
      notas?: string;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    meal: MealItem;
  } {
    const baseData = currentData ?? this.getData();
    const currentMenu = baseData.weeklyMenu ?? createEmptyWeeklyMenu();
    const cleanName = (mealInput.nombre || '').trim();
    if (!cleanName) {
      throw new Error('Ingresa el nombre del plato o comida.');
    }

    const cleanIngredients = (mealInput.ingredientes || [])
      .map((i) => i.trim())
      .filter(Boolean);

    const existingMeals = [...(currentMenu.dias[day] || [])];
    let savedMeal: MealItem;

    if (mealInput.id) {
      const idx = existingMeals.findIndex((m) => m.id === mealInput.id);
      savedMeal = {
        id: mealInput.id,
        nombre: cleanName,
        tipo: mealInput.tipo,
        ingredientes: cleanIngredients,
        notas: mealInput.notas?.trim() || '',
        createdAt:
          idx >= 0
            ? existingMeals[idx].createdAt
            : new Date().toISOString(),
      };
      if (idx >= 0) {
        existingMeals[idx] = savedMeal;
      } else {
        existingMeals.push(savedMeal);
      }
    } else {
      savedMeal = {
        id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        nombre: cleanName,
        tipo: mealInput.tipo,
        ingredientes: cleanIngredients,
        notas: mealInput.notas?.trim() || '',
        createdAt: new Date().toISOString(),
      };
      existingMeals.push(savedMeal);
    }

    existingMeals.sort(
      (a, b) => MEAL_TYPES_ORDER[a.tipo] - MEAL_TYPES_ORDER[b.tipo]
    );

    const updatedMenu: MenuSemanal = {
      ...currentMenu,
      dias: {
        ...currentMenu.dias,
        [day]: existingMeals,
      },
      updatedAt: new Date().toISOString(),
    };

    const updatedData: AppDataSchema = {
      ...baseData,
      weeklyMenu: updatedMenu,
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      meal: savedMeal,
    };
  }

  /**
   * Elimina una comida de cualquier día de la semana.
   */
  static deleteMealFromDay(
    day: DayOfWeekKey,
    mealId: string,
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? this.getData();
    const currentMenu = baseData.weeklyMenu ?? createEmptyWeeklyMenu();
    const nextMeals = (currentMenu.dias[day] || []).filter(
      (m) => m.id !== mealId
    );

    const updatedData: AppDataSchema = {
      ...baseData,
      weeklyMenu: {
        ...currentMenu,
        dias: {
          ...currentMenu.dias,
          [day]: nextMeals,
        },
        updatedAt: new Date().toISOString(),
      },
    };

    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  /**
   * Vacía todas las comidas de un día específico.
   */
  static clearDayMenu(
    day: DayOfWeekKey,
    currentData?: AppDataSchema
  ): AppDataSchema {
    const baseData = currentData ?? this.getData();
    const currentMenu = baseData.weeklyMenu ?? createEmptyWeeklyMenu();

    const updatedData: AppDataSchema = {
      ...baseData,
      weeklyMenu: {
        ...currentMenu,
        dias: {
          ...currentMenu.dias,
          [day]: [],
        },
        updatedAt: new Date().toISOString(),
      },
    };

    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  /**
   * Itera sobre los ingredientes de un día específico (o de varios días) y los crea
   * automáticamente como nuevos ItemsMercado (categoría 'Supermercado/Víveres' por defecto
   * y estado Pendiente -> comprado: false) dentro del módulo 'Lista de Mercado'.
   */
  static sendDayIngredientsToMarket(
    day: DayOfWeekKey,
    options?: {
      targetListId?: string;
      category?: MarketCategoryStop;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    targetList: MarketList;
    addedItemsCount: number;
    skippedDuplicatesCount: number;
    createdNewList: boolean;
  } {
    const baseData = currentData ?? this.getData();
    const currentMenu = baseData.weeklyMenu ?? createEmptyWeeklyMenu();
    const mealsOfDay = currentMenu.dias[day] || [];

    const rawIngredients: { nombre: string; platoOrigen: string }[] = [];
    for (const meal of mealsOfDay) {
      for (const ing of meal.ingredientes || []) {
        const clean = ing.trim();
        if (clean) {
          rawIngredients.push({
            nombre: clean,
            platoOrigen: `${day} · ${meal.tipo}: ${meal.nombre}`,
          });
        }
      }
    }

    if (rawIngredients.length === 0) {
      throw new Error(
        `El día ${day} no tiene ingredientes registrados para enviar al mercado.`
      );
    }

    return this.transferIngredientsListToMarket(
      rawIngredients,
      `Mercado Semanal (${day})`,
      options,
      baseData
    );
  }

  /**
   * Envía todos los ingredientes de toda la semana (Lunes a Domingo) a la Lista de Mercado.
   */
  static sendAllWeekIngredientsToMarket(
    options?: {
      targetListId?: string;
      category?: MarketCategoryStop;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    targetList: MarketList;
    addedItemsCount: number;
    skippedDuplicatesCount: number;
    createdNewList: boolean;
  } {
    const baseData = currentData ?? this.getData();
    const currentMenu = baseData.weeklyMenu ?? createEmptyWeeklyMenu();

    const rawIngredients: { nombre: string; platoOrigen: string }[] = [];
    for (const day of DAYS_OF_WEEK) {
      for (const meal of currentMenu.dias[day] || []) {
        for (const ing of meal.ingredientes || []) {
          const clean = ing.trim();
          if (clean) {
            rawIngredients.push({
              nombre: clean,
              platoOrigen: `${day} · ${meal.tipo}: ${meal.nombre}`,
            });
          }
        }
      }
    }

    if (rawIngredients.length === 0) {
      throw new Error(
        'No hay ingredientes registrados en la semana para enviar a la Lista de Mercado.'
      );
    }

    return this.transferIngredientsListToMarket(
      rawIngredients,
      'Mercado del Menú Semanal',
      options,
      baseData
    );
  }

  private static transferIngredientsListToMarket(
    rawIngredients: { nombre: string; platoOrigen: string }[],
    fallbackListName: string,
    options?: {
      targetListId?: string;
      category?: MarketCategoryStop;
    },
    currentData?: AppDataSchema
  ): {
    updatedData: AppDataSchema;
    targetList: MarketList;
    addedItemsCount: number;
    skippedDuplicatesCount: number;
    createdNewList: boolean;
  } {
    const baseData = currentData ?? this.getData();
    const defaultCategory: MarketCategoryStop =
      options?.category || 'Supermercado/Víveres';
    const existingLists = [...(baseData.marketLists || [])];
    let existingTxns = [...(baseData.transactions || [])];

    let targetList = options?.targetListId
      ? existingLists.find(
          (l) => l.id === options.targetListId && l.estado === 'abierta'
        )
      : existingLists.find((l) => l.estado === 'abierta');

    let createdNewList = false;

    if (!targetList) {
      const created = crearListaMercado({
        nombre: fallbackListName,
        presupuestoEstimado: 60,
        moneda: 'USD',
        exchangeRate: baseData.settings.lastOfficialRate || 450,
        fecha: obtenerFechaLocalIso(),
        initialItems: [],
        notas: 'Lista abierta automáticamente desde el Planificador de Menú Semanal',
      });
      targetList = created.marketList;
      existingLists.unshift(targetList);
      existingTxns = [created.pendingTransaction, ...existingTxns];
      createdNewList = true;
    }

    const existingNamesNormalized = new Set(
      (targetList.items || [])
        .filter((it) => !it.comprado)
        .map((it) => it.nombre.trim().toLowerCase())
    );

    const newMarketItems: MarketItem[] = [];
    let skippedDuplicatesCount = 0;
    const nowTs = Date.now();

    rawIngredients.forEach((entry, idx) => {
      const key = entry.nombre.toLowerCase();
      if (existingNamesNormalized.has(key)) {
        skippedDuplicatesCount += 1;
        return;
      }
      existingNamesNormalized.add(key);
      newMarketItems.push({
        id: `item_menu_${nowTs}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        nombre: entry.nombre,
        categoria: defaultCategory,
        comprado: false, // Estado 'Pendiente'
        notes: entry.platoOrigen,
      });
    });

    const updatedTargetList: MarketList = {
      ...targetList,
      items: [...(targetList.items || []), ...newMarketItems],
    };

    const nextLists = existingLists.map((l) =>
      l.id === updatedTargetList.id ? updatedTargetList : l
    );

    const updatedData: AppDataSchema = {
      ...baseData,
      marketLists: nextLists,
      transactions: existingTxns,
    };

    guardarDatosLocalStorage(updatedData);
    return {
      updatedData,
      targetList: updatedTargetList,
      addedItemsCount: newMarketItems.length,
      skippedDuplicatesCount,
      createdNewList,
    };
  }

  /**
   * Carga un menú semanal balanceado de ejemplo para probar la vista y el envío al mercado.
   */
  static loadSampleWeeklyMenu(currentData?: AppDataSchema): AppDataSchema {
    const baseData = currentData ?? this.getData();
    const nowIso = new Date().toISOString();
    const sampleMenu: MenuSemanal = {
      id: 'weekly_menu_default',
      nombreSemana: 'Menú Semanal del Hogar',
      updatedAt: nowIso,
      dias: {
        Lunes: [
          {
            id: 'sample_mon_1',
            nombre: 'Arepas con huevos revueltos y queso blanco',
            tipo: 'Desayuno',
            ingredientes: ['Harina PAN', 'Huevos', 'Queso blanco duro', 'Tomate', 'Cebolla'],
            createdAt: nowIso,
          },
          {
            id: 'sample_mon_2',
            nombre: 'Pechuga de pollo a la plancha con arroz y ensalada',
            tipo: 'Almuerzo',
            ingredientes: ['Pechuga de pollo', 'Arroz blanco', 'Lechuga', 'Aguacate'],
            createdAt: nowIso,
          },
          {
            id: 'sample_mon_3',
            nombre: 'Crema de auyama con tostadas',
            tipo: 'Cena',
            ingredientes: ['Auyama', 'Queso crema', 'Pan de sándwich'],
            createdAt: nowIso,
          },
        ],
        Martes: [
          {
            id: 'sample_tue_1',
            nombre: 'Panquecas de avena con cambur',
            tipo: 'Desayuno',
            ingredientes: ['Avena en hojuelas', 'Cambur', 'Leche líquida', 'Miel'],
            createdAt: nowIso,
          },
          {
            id: 'sample_tue_2',
            nombre: 'Carne molida guisada con pasta corta',
            tipo: 'Almuerzo',
            ingredientes: ['Carne molida de res', 'Pasta corta', 'Salsa de tomate', 'Pimentón'],
            createdAt: nowIso,
          },
        ],
        Miércoles: [
          {
            id: 'sample_wed_1',
            nombre: 'Sándwich de jamón de pavo y queso amarillo',
            tipo: 'Desayuno',
            ingredientes: ['Pan integral', 'Jamón de pavo', 'Queso amarillo'],
            createdAt: nowIso,
          },
          {
            id: 'sample_wed_2',
            nombre: 'Pabellón casero ligero (Caraotas, arroz y tajadas)',
            tipo: 'Almuerzo',
            ingredientes: ['Caraotas negras', 'Plátano maduro', 'Carne para mechar'],
            createdAt: nowIso,
          },
        ],
        Jueves: [
          {
            id: 'sample_thu_1',
            nombre: 'Omelette de espinaca y champiñones',
            tipo: 'Desayuno',
            ingredientes: ['Huevos', 'Espinaca fresca', 'Champiñones'],
            createdAt: nowIso,
          },
          {
            id: 'sample_thu_2',
            nombre: 'Filete de pescado al horno con puré de papas',
            tipo: 'Almuerzo',
            ingredientes: ['Filete de merluza', 'Papas', 'Mantequilla', 'Limón'],
            createdAt: nowIso,
          },
        ],
        Viernes: [
          {
            id: 'sample_fri_1',
            nombre: 'Empanadas horneadas de queso',
            tipo: 'Desayuno',
            ingredientes: ['Harina de maíz', 'Queso rallado'],
            createdAt: nowIso,
          },
          {
            id: 'sample_fri_2',
            nombre: 'Fajitas de pollo salteadas con vegetales',
            tipo: 'Cena',
            ingredientes: ['Tortillas de trigo', 'Pechuga de pollo', 'Pimentón rojo', 'Queso mozzarella'],
            createdAt: nowIso,
          },
        ],
        Sábado: [
          {
            id: 'sample_sat_1',
            nombre: 'Cachapas caseras con queso de mano',
            tipo: 'Desayuno',
            ingredientes: ['Maíz tierno', 'Queso de mano', 'Mantequilla'],
            createdAt: nowIso,
          },
          {
            id: 'sample_sat_2',
            nombre: 'Hamburguesas caseras al grill',
            tipo: 'Cena',
            ingredientes: ['Pan de hamburguesa', 'Carne de res', 'Queso cheddar', 'Tocineta'],
            createdAt: nowIso,
          },
        ],
        Domingo: [
          {
            id: 'sample_sun_1',
            nombre: 'Pasticho familiar dominical',
            tipo: 'Almuerzo',
            ingredientes: ['Láminas de pasticho', 'Carne molida', 'Leche para bechamel', 'Queso parmesano'],
            createdAt: nowIso,
          },
        ],
      },
    };

    const updatedData: AppDataSchema = {
      ...baseData,
      weeklyMenu: sampleMenu,
    };

    guardarDatosLocalStorage(updatedData);
    return updatedData;
  }

  // ==========================================================================
  // CONTROL DE ESTADO DEL TOUR GUIADO / ONBOARDING INTERACTIVO
  // ==========================================================================

  /**
   * Indica si el usuario ya completó u omitió el Tour Guiado interactivo.
   */
  static getHasSeenTutorial(): boolean {
    try {
      const raw = localStorage.getItem(HAS_SEEN_TUTORIAL_STORAGE_KEY);
      return raw === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Actualiza en localStorage el estado de visualización del Tour Guiado.
   */
  static setHasSeenTutorial(seen: boolean): void {
    try {
      localStorage.setItem(
        HAS_SEEN_TUTORIAL_STORAGE_KEY,
        seen ? 'true' : 'false'
      );
    } catch (error) {
      console.error('Error guardando estado del tutorial en localStorage:', error);
    }
  }
}

export const HAS_SEEN_TUTORIAL_STORAGE_KEY =
  'mis_finanzas_has_seen_tutorial_v1';

export const UNLOCKED_ACHIEVEMENTS_STORAGE_KEY =
  'mis_finanzas_unlocked_achievements_v1';

/**
 * Helpers internos para calcular el progreso y evaluación de cada trofeo
 */
function countCompletedHomeItems(storageData: AppDataSchema): number {
  let count = 0;
  for (const list of storageData.marketLists || []) {
    for (const item of list.items || []) {
      if (item.comprado || list.estado === 'cerrada') {
        count += 1;
      }
    }
  }
  // También contabiliza artículos del hogar comprados en Wishlist si pertenecen a categoría hogar/mercado
  for (const wish of storageData.wishlist || []) {
    if (wish.estado === 'Comprado') {
      count += 1;
    }
  }
  return count;
}

function countRomanceExpenses(storageData: AppDataSchema): number {
  const spendMovements = (storageData.romanceFund?.movements || []).filter(
    (m) => m.type === 'spend'
  );
  const linkedTxnIds = new Set(
    spendMovements
      .map((m) => m.linkedTransactionId)
      .filter((id): id is string => Boolean(id))
  );

  const extraRomanceTxns = (storageData.transactions || []).filter((t) => {
    if (t.type !== 'expense' || !esTransaccionCompletada(t)) return false;
    if (linkedTxnIds.has(t.id)) return false;
    const cat = (storageData.categories || []).find(
      (c) => c.id === t.categoryId
    );
    const catName = (cat?.name || '').toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    return (
      t.categoryId === 'cat_exp_couple' ||
      catName.includes('pareja') ||
      catName.includes('cita') ||
      catName.includes('romántic') ||
      catName.includes('romance') ||
      desc.includes('cita') ||
      desc.includes('romance budget') ||
      notes.includes('fondo de citas')
    );
  });

  return spendMovements.length + extraRomanceTxns.length;
}

function countExactPriceMatches(storageData: AppDataSchema): {
  count: number;
  matchedLabel: string | null;
} {
  let count = 0;
  let matchedLabel: string | null = null;

  // 1. Evaluar artículos individuales con precioEstimadoUnitario === precioRealTotal
  for (const list of storageData.marketLists || []) {
    for (const item of list.items || []) {
      const est = Number(item.precioEstimadoUnitario);
      const real = Number(item.precioRealTotal);
      if (
        item.comprado &&
        Number.isFinite(est) &&
        Number.isFinite(real) &&
        est > 0 &&
        Math.abs(est - real) < 0.001
      ) {
        count += 1;
        if (!matchedLabel) matchedLabel = item.nombre;
      }
    }

    // 2. Evaluar listas de mercado cerradas donde el presupuestoEstimado === totalPagadoReal
    if (list.estado === 'cerrada') {
      const estNominal = Number(list.presupuestoEstimado);
      const realNominal = Number(list.totalPagadoReal);
      const estUsd = Number(list.presupuestoEstimadoUsd);
      const realUsd = Number(list.totalPagadoRealUsd);

      const exactNominal =
        Number.isFinite(estNominal) &&
        Number.isFinite(realNominal) &&
        estNominal > 0 &&
        Math.abs(estNominal - realNominal) < 0.001;
      const exactUsd =
        Number.isFinite(estUsd) &&
        Number.isFinite(realUsd) &&
        estUsd > 0 &&
        Math.abs(estUsd - realUsd) < 0.001;

      if (exactNominal || exactUsd) {
        count += 1;
        if (!matchedLabel) matchedLabel = list.nombre;
      }
    }
  }

  // 3. Evaluar artículos comprados en Wishlist donde precioEstimadoUnitario === precioRealTotal o costoEstimado === monto real pagado
  for (const wish of storageData.wishlist || []) {
    if (wish.estado !== 'Comprado') continue;
    const estUnit = Number(wish.precioEstimadoUnitario);
    const realTotal = Number(wish.precioRealTotal);
    if (
      Number.isFinite(estUnit) &&
      Number.isFinite(realTotal) &&
      estUnit > 0 &&
      Math.abs(estUnit - realTotal) < 0.001
    ) {
      count += 1;
      if (!matchedLabel) matchedLabel = wish.nombre;
      continue;
    }

    if (wish.compradoTransactionId) {
      const txn = (storageData.transactions || []).find(
        (t) => t.id === wish.compradoTransactionId
      );
      if (txn) {
        const est = Number(wish.costoEstimado);
        const realAmt =
          wish.moneda === txn.currency
            ? Number(txn.amount)
            : Number(txn.amountUsd);
        if (
          Number.isFinite(est) &&
          Number.isFinite(realAmt) &&
          est > 0 &&
          Math.abs(est - realAmt) < 0.001
        ) {
          count += 1;
          if (!matchedLabel) matchedLabel = wish.nombre;
        }
      }
    }
  }

  return { count, matchedLabel };
}

function countSettledSharedBudgetsOrDebts(storageData: AppDataSchema): number {
  let count = 0;

  // 1. Deudas / préstamos marcados como liquidados ('paid')
  for (const debt of storageData.debts || []) {
    if (debt.status === 'paid') {
      count += 1;
    } else if (debt.totalAmountUsd > 0) {
      const paidSum = (debt.payments || []).reduce(
        (acc, p) => acc + (Number(p.amountUsd) || 0),
        0
      );
      if (paidSum >= debt.totalAmountUsd - 0.005) {
        count += 1;
      }
    }
  }

  // 2. Operaciones P2P / Cuentas por cobrar liquidadas
  for (const op of storageData.p2pOperations || []) {
    if (op.status === 'settled') {
      count += 1;
    }
  }

  // 3. Presupuestos / gastos compartidos en pareja liquidados en localStorage
  try {
    const rawExpenses = localStorage.getItem('shared_expenses');
    if (rawExpenses) {
      const parsedExp = JSON.parse(rawExpenses);
      if (Array.isArray(parsedExp)) {
        for (const exp of parsedExp) {
          if (exp && typeof exp === 'object' && exp.settled === true) {
            count += 1;
          }
        }
      }
    }
    const rawContribs = localStorage.getItem('shared_contributions');
    if (rawContribs) {
      const parsedContribs = JSON.parse(rawContribs);
      if (Array.isArray(parsedContribs)) {
        for (const contrib of parsedContribs) {
          if (
            contrib &&
            typeof contrib === 'object' &&
            contrib.myCompleted === true &&
            contrib.partnerCompleted === true
          ) {
            count += 1;
          }
        }
      }
    }
  } catch {
    // Ignore localStorage read errors
  }

  return count;
}

function countPaidAppOrInstallmentCredits(storageData: AppDataSchema): {
  count: number;
  creditNames: string[];
} {
  let count = 0;
  const creditNames: string[] = [];

  // 1. Compras por cuotas (ej. Cashea, Krece) totalmente pagadas
  for (const cp of storageData.creditPurchases || []) {
    const allInstallmentsPaid =
      Array.isArray(cp.installments) &&
      cp.installments.length > 0 &&
      cp.installments.every((inst) => inst.status === 'paid');

    if (cp.status === 'completed' || allInstallmentsPaid) {
      count += 1;
      creditNames.push(`${cp.storeOrPlatform || 'Cashea'}: ${cp.concept}`);
    }
  }

  // 2. Créditos de Apps (ej. Ubii App, Avila Pay, Cashea) totalmente pagados
  for (const ac of storageData.appCredits || []) {
    const allInstallmentsPaid =
      Array.isArray(ac.installments) &&
      ac.installments.length > 0 &&
      ac.installments.every((inst) => inst.status === 'paid');

    if (ac.status === 'paid' || allInstallmentsPaid) {
      count += 1;
      creditNames.push(
        `${ac.appName}${ac.concept ? ` (${ac.concept})` : ''}`
      );
    }
  }

  return { count, creditNames };
}

/**
 * Arreglo constante de objetos TROPHIES con id, titulo, descripcion, icono y evaluator(storageData)
 */
export const TROPHIES: TrophyDefinition[] = [
  {
    id: 'arquitecto_hogar',
    titulo: 'Arquitecto del Hogar',
    descripcion:
      'Haber completado al menos 10 artículos en la lista de compras del hogar.',
    icono: '🏠',
    categoriaLabel: 'Mercado y Hogar',
    evaluator: (storageData: AppDataSchema): boolean => {
      return countCompletedHomeItems(storageData) >= 10;
    },
    getProgress: (storageData: AppDataSchema) => {
      const current = countCompletedHomeItems(storageData);
      return {
        current,
        target: 10,
        unitLabel: 'artículos',
        detailText: `${Math.min(current, 10)} de 10 artículos comprados en listas del hogar`,
      };
    },
  },
  {
    id: 'romantico_empedernido',
    titulo: 'Romántico Empedernido',
    descripcion:
      "Haber registrado al menos 3 egresos en la categoría de citas o 'Romance Budget'.",
    icono: '💘',
    categoriaLabel: 'Romance Budget',
    evaluator: (storageData: AppDataSchema): boolean => {
      return countRomanceExpenses(storageData) >= 3;
    },
    getProgress: (storageData: AppDataSchema) => {
      const current = countRomanceExpenses(storageData);
      return {
        current,
        target: 3,
        unitLabel: 'citas',
        detailText: `${Math.min(current, 3)} de 3 salidas o gastos románticos registrados`,
      };
    },
  },
  {
    id: 'francotirador_financiero',
    titulo: 'Francotirador Financiero',
    descripcion:
      'Que un artículo comprado tenga el precioEstimadoUnitario exactamente igual al precioRealTotal.',
    icono: '🎯',
    categoriaLabel: 'Precisión Quirúrgica',
    evaluator: (storageData: AppDataSchema): boolean => {
      return countExactPriceMatches(storageData).count >= 1;
    },
    getProgress: (storageData: AppDataSchema) => {
      const { count, matchedLabel } = countExactPriceMatches(storageData);
      return {
        current: count > 0 ? 1 : 0,
        target: 1,
        unitLabel: 'acierto exacto',
        detailText:
          count > 0
            ? `¡Logrado en "${matchedLabel || 'Compra exacta'}"! (Estimado === Real)`
            : '0 de 1 compra donde el precio estimado sea idéntico al pago real',
      };
    },
  },
  {
    id: 'cuentas_claras',
    titulo: 'Cuentas Claras',
    descripcion:
      'Tener al menos 1 presupuesto compartido o deuda liquidada.',
    icono: '🤝',
    categoriaLabel: 'Deudas y Pareja',
    evaluator: (storageData: AppDataSchema): boolean => {
      return countSettledSharedBudgetsOrDebts(storageData) >= 1;
    },
    getProgress: (storageData: AppDataSchema) => {
      const current = countSettledSharedBudgetsOrDebts(storageData);
      return {
        current,
        target: 1,
        unitLabel: 'liquidación',
        detailText: `${Math.min(current, 1)} de 1 presupuesto compartido o préstamo liquidado`,
      };
    },
  },
  {
    id: 'rey_del_credito',
    titulo: 'Rey del Crédito',
    descripcion:
      'Tener al menos 1 crédito de app (ej. Cashea) marcado como totalmente pagado.',
    icono: '👑',
    categoriaLabel: 'Créditos de Apps',
    evaluator: (storageData: AppDataSchema): boolean => {
      return countPaidAppOrInstallmentCredits(storageData).count >= 1;
    },
    getProgress: (storageData: AppDataSchema) => {
      const { count, creditNames } =
        countPaidAppOrInstallmentCredits(storageData);
      return {
        current: count,
        target: 1,
        unitLabel: 'crédito pagado',
        detailText:
          count > 0
            ? `Completado: ${creditNames[0]} (${count} en total)`
            : '0 de 1 crédito de app (Cashea, Ubii, Avila Pay) pagado al 100%',
      };
    },
  },
];

