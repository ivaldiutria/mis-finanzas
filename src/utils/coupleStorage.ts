import {
  Category,
  CurrencyCode,
  ExportedPartnerExpensesPayload,
  SharedCoupleGoal,
  SharedExpense,
  SharedMonthlyContribution,
  SharedPayer,
  SharedSavingContribution,
  Transaction,
} from '../types/finance';
import { calcularEquivalenteUsd, obtenerFechaLocalIso } from './calculations';

// Claves exactas solicitadas en localStorage para el Hub de Pareja
export const COUPLE_STORAGE_KEYS = {
  EXPENSES: 'shared_expenses',
  SAVINGS: 'shared_savings',
  GOALS: 'shared_goals',
  CONTRIBUTIONS: 'shared_contributions',
  PARTNER_NAME: 'shared_partner_name',
} as const;

export function cargarGastosCompartidos(): SharedExpense[] {
  try {
    const raw = localStorage.getItem(COUPLE_STORAGE_KEYS.EXPENSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SharedExpense =>
        Boolean(item && typeof item === 'object' && typeof item.id === 'string' && item.amount > 0)
    );
  } catch (err) {
    console.warn('Error al leer shared_expenses:', err);
    return [];
  }
}

export function guardarGastosCompartidos(items: SharedExpense[]): void {
  try {
    localStorage.setItem(COUPLE_STORAGE_KEYS.EXPENSES, JSON.stringify(items));
  } catch (err) {
    console.error('Error al guardar shared_expenses:', err);
  }
}

export function cargarAhorrosConjuntos(): SharedSavingContribution[] {
  try {
    const raw = localStorage.getItem(COUPLE_STORAGE_KEYS.SAVINGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SharedSavingContribution =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.amountUsd === 'number' &&
            item.amountUsd > 0
        )
    );
  } catch (err) {
    console.warn('Error al leer shared_savings:', err);
    return [];
  }
}

export function guardarAhorrosConjuntos(items: SharedSavingContribution[]): void {
  try {
    localStorage.setItem(COUPLE_STORAGE_KEYS.SAVINGS, JSON.stringify(items));
  } catch (err) {
    console.error('Error al guardar shared_savings:', err);
  }
}

export function cargarMetasEnPareja(): SharedCoupleGoal[] {
  try {
    const raw = localStorage.getItem(COUPLE_STORAGE_KEYS.GOALS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SharedCoupleGoal =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.name === 'string' &&
            typeof item.targetAmountUsd === 'number'
        )
    );
  } catch (err) {
    console.warn('Error al leer shared_goals:', err);
    return [];
  }
}

export function guardarMetasEnPareja(items: SharedCoupleGoal[]): void {
  try {
    localStorage.setItem(COUPLE_STORAGE_KEYS.GOALS, JSON.stringify(items));
  } catch (err) {
    console.error('Error al guardar shared_goals:', err);
  }
}

export function cargarAportesMensualesPareja(): SharedMonthlyContribution[] {
  try {
    const raw = localStorage.getItem(COUPLE_STORAGE_KEYS.CONTRIBUTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SharedMonthlyContribution =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.monthKey === 'string'
        )
    );
  } catch (err) {
    console.warn('Error al leer shared_contributions:', err);
    return [];
  }
}

export function guardarAportesMensualesPareja(items: SharedMonthlyContribution[]): void {
  try {
    localStorage.setItem(COUPLE_STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(items));
  } catch (err) {
    console.error('Error al guardar shared_contributions:', err);
  }
}

export function cargarNombrePareja(): string {
  try {
    return localStorage.getItem(COUPLE_STORAGE_KEYS.PARTNER_NAME) || 'Pareja';
  } catch {
    return 'Pareja';
  }
}

export function guardarNombrePareja(name: string): void {
  try {
    localStorage.setItem(COUPLE_STORAGE_KEYS.PARTNER_NAME, name.trim() || 'Pareja');
  } catch {
    // ignore
  }
}

/**
 * Calcula el balance dinámico de gastos compartidos (quién le debe a quién):
 * - Cuando 'me' (Yo) paga un gasto compartido, la pareja me debe su porcentaje (partnerSharePct% de amountUsd).
 * - Cuando 'partner' (Pareja) paga un gasto compartido, yo le debo mi porcentaje (mySharePct% de amountUsd).
 * Solo evalúa gastos no marcados como saldados (settled !== true).
 */
export interface BalanceParejaResumen {
  totalGastadoConjuntoUsd: number;
  pagadoPorMiTotalUsd: number;
  pagadoPorParejaTotalUsd: number;
  parejaMeDebeBrutoUsd: number; // Lo que mi pareja me debe por gastos pagados por mí
  yoDeboAParejaBrutoUsd: number; // Lo que yo le debo a mi pareja por gastos pagados por ella/él
  netoAFavorMioUsd: number; // Positivo = Pareja me debe; Negativo = Yo le debo a Pareja; 0 = Al día
  deudor: 'partner_owes_me' | 'i_owe_partner' | 'settled';
  montoNetoDeudaUsd: number; // Valor absoluto en USD
  gastosActivosCount: number;
  gastosSaldadosCount: number;
  gastosPagadosPorParejaCount: number;
}

export function calcularBalanceGastosCompartidos(
  expenses: SharedExpense[]
): BalanceParejaResumen {
  let totalGastadoConjuntoUsd = 0;
  let pagadoPorMiTotalUsd = 0;
  let pagadoPorParejaTotalUsd = 0;
  let parejaMeDebeBrutoUsd = 0;
  let yoDeboAParejaBrutoUsd = 0;
  let gastosActivosCount = 0;
  let gastosSaldadosCount = 0;
  let gastosPagadosPorParejaCount = 0;

  for (const exp of expenses) {
    const valUsd = Number.isFinite(exp.amountUsd) ? exp.amountUsd : 0;
    totalGastadoConjuntoUsd += valUsd;

    if (exp.payer === 'me') {
      pagadoPorMiTotalUsd += valUsd;
    } else {
      pagadoPorParejaTotalUsd += valUsd;
      gastosPagadosPorParejaCount += 1;
    }

    if (exp.settled) {
      gastosSaldadosCount += 1;
      continue;
    }

    gastosActivosCount += 1;
    const myPct = typeof exp.mySharePct === 'number' ? exp.mySharePct : 50;
    const partnerPct =
      typeof exp.partnerSharePct === 'number' ? exp.partnerSharePct : 100 - myPct;

    if (exp.payer === 'me') {
      // Yo pagué el 100% de este gasto, por tanto mi pareja me debe su parte (partnerPct%)
      parejaMeDebeBrutoUsd += (valUsd * partnerPct) / 100;
    } else {
      // Mi pareja pagó el 100% de este gasto, por tanto yo le debo mi parte (myPct%)
      yoDeboAParejaBrutoUsd += (valUsd * myPct) / 100;
    }
  }

  const netoAFavorMioUsd = Number(
    (parejaMeDebeBrutoUsd - yoDeboAParejaBrutoUsd).toFixed(6)
  );
  const absNeto = Math.abs(netoAFavorMioUsd);

  let deudor: BalanceParejaResumen['deudor'] = 'settled';
  if (absNeto >= 0.01) {
    deudor = netoAFavorMioUsd > 0 ? 'partner_owes_me' : 'i_owe_partner';
  }

  return {
    totalGastadoConjuntoUsd,
    pagadoPorMiTotalUsd,
    pagadoPorParejaTotalUsd,
    parejaMeDebeBrutoUsd,
    yoDeboAParejaBrutoUsd,
    netoAFavorMioUsd,
    deudor,
    montoNetoDeudaUsd: absNeto < 0.01 ? 0 : absNeto,
    gastosActivosCount,
    gastosSaldadosCount,
    gastosPagadosPorParejaCount,
  };
}

/**
 * Calcula el resumen del Fondo Acumulador en USD (Ahorros Conjuntos) y el progreso de las Metas en Pareja.
 */
export function calcularResumenAhorrosYMetasPareja(
  savings: SharedSavingContribution[],
  goals: SharedCoupleGoal[]
) {
  let totalAhorradoUsd = 0;
  let aportadoPorMiUsd = 0;
  let aportadoPorParejaUsd = 0;

  for (const s of savings) {
    const val = Number.isFinite(s.amountUsd) && s.amountUsd > 0 ? s.amountUsd : 0;
    totalAhorradoUsd += val;
    if (s.contributor === 'me') aportadoPorMiUsd += val;
    else aportadoPorParejaUsd += val;
  }

  // Meta principal: la marcada como isPrimary, o la primera activa, o la primera disponible
  const metaPrincipal =
    goals.find((g) => g.isPrimary && g.status === 'active') ||
    goals.find((g) => g.status === 'active') ||
    goals[0] ||
    null;

  // Para cada meta, calculamos tanto los aportes vinculados específicamente a esa meta
  // como el progreso general respaldado por el Fondo Acumulador Conjunto en USD
  const progresoPorMeta = goals.map((goal) => {
    const aportesDirectosUsd = savings
      .filter((s) => s.goalId === goal.id)
      .reduce((acc, s) => acc + s.amountUsd, 0);

    // Si tiene aportes directos o si se evalúa contra el fondo común total:
    // Según requerimiento: "barra de progreso vinculada a los Ahorros Conjuntos"
    const montoVinculadoUsd =
      aportesDirectosUsd > 0 ? aportesDirectosUsd : totalAhorradoUsd;
    const target = goal.targetAmountUsd > 0 ? goal.targetAmountUsd : 1;
    const porcentaje = Math.min(100, (montoVinculadoUsd / target) * 100);
    const restanteUsd = Math.max(0, goal.targetAmountUsd - montoVinculadoUsd);

    return {
      goal,
      aportesDirectosUsd,
      montoVinculadoUsd,
      porcentaje,
      restanteUsd,
    };
  });

  const progresoMetaPrincipal = metaPrincipal
    ? progresoPorMeta.find((p) => p.goal.id === metaPrincipal.id) || null
    : null;

  return {
    totalAhorradoUsd,
    aportadoPorMiUsd,
    aportadoPorParejaUsd,
    metaPrincipal,
    progresoMetaPrincipal,
    progresoPorMeta,
  };
}

/**
 * Genera el JSON descargable con todos los gastos de pareja pagados por la 'Pareja'
 * para sincronización manual.
 */
export function generarJsonGastosPagadosPorPareja(
  expenses: SharedExpense[],
  exportedBy: string
): string {
  const partnerExpenses = expenses.filter((e) => e.payer === 'partner');
  const totalUsd = partnerExpenses.reduce(
    (acc, e) => acc + (Number.isFinite(e.amountUsd) ? e.amountUsd : 0),
    0
  );

  const payload: ExportedPartnerExpensesPayload = {
    exportFormat: 'mis_finanzas_shared_partner_expenses_v1',
    exportedAt: new Date().toISOString(),
    exportedBy: exportedBy || 'Mis Finanzas',
    count: partnerExpenses.length,
    totalUsd: Number(totalUsd.toFixed(2)),
    expenses: partnerExpenses.map((e) => ({
      id: e.id,
      concept: e.concept,
      amount: e.amount,
      currency: e.currency,
      exchangeRate: e.exchangeRate,
      amountUsd: e.amountUsd,
      date: e.date,
      categoryId: e.categoryId,
      categoryName: e.categoryName,
      payer: e.payer,
      notes: e.notes,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Valida un archivo JSON de Gastos Compartidos e identifica cuáles son nuevos y cuáles ya existen
 * en las transacciones personales (verificación por ID único para evitar doble importación).
 */
export function validarEImportarGastosCompartidosJson(
  rawJson: unknown,
  existingPersonalTransactions: Transaction[],
  categories: Category[],
  targetWalletId: string,
  fallbackRate: number | null
): {
  nuevasTransacciones: Transaction[];
  omitidasPorDuplicado: number;
  totalImportadoUsd: number;
} {
  if (!rawJson || typeof rawJson !== 'object') {
    throw new Error('El archivo seleccionado no es un objeto JSON válido.');
  }

  const obj = rawJson as Record<string, unknown>;
  const rawList = Array.isArray(obj.expenses)
    ? obj.expenses
    : Array.isArray(rawJson)
      ? (rawJson as unknown[])
      : null;

  if (!rawList) {
    throw new Error(
      'El archivo JSON no contiene una lista válida de gastos compartidos ("expenses").'
    );
  }

  // Conjunto de IDs únicos ya registrados en Finanzas Personales (tanto por id directo como por sharedExpenseId)
  const existingSharedIds = new Set<string>();
  for (const t of existingPersonalTransactions) {
    existingSharedIds.add(t.id);
    if (t.sharedExpenseId) {
      existingSharedIds.add(t.sharedExpenseId);
    }
  }

  const validCategoryIds = new Set(categories.map((c) => c.id));
  const nuevasTransacciones: Transaction[] = [];
  let omitidasPorDuplicado = 0;
  let totalImportadoUsd = 0;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const exp = item as Record<string, unknown>;

    const id = typeof exp.id === 'string' && exp.id.trim() ? exp.id.trim() : '';
    if (!id) {
      throw new Error('Se encontró un gasto compartido sin ID único válido.');
    }

    // Validación anti-duplicados por ID único
    if (existingSharedIds.has(id) || existingSharedIds.has(`imported_${id}`)) {
      omitidasPorDuplicado += 1;
      continue;
    }

    const concept =
      typeof exp.concept === 'string' && exp.concept.trim()
        ? exp.concept.trim()
        : typeof exp.description === 'string' && exp.description.trim()
          ? exp.description.trim()
          : 'Gasto compartido en pareja';

    const amount = Number(exp.amount ?? exp.monto);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`El gasto "${concept}" tiene un monto inválido.`);
    }

    const currency: CurrencyCode =
      exp.currency === 'VES' || exp.moneda === 'VES' ? 'VES' : 'USD';
    const rawRate = Number(exp.exchangeRate ?? exp.tasa);
    const exchangeRate =
      currency === 'VES'
        ? Number.isFinite(rawRate) && rawRate > 0
          ? rawRate
          : fallbackRate && fallbackRate > 0
            ? fallbackRate
            : 450
        : null;

    const rawAmountUsd = Number(exp.amountUsd);
    const amountUsd =
      Number.isFinite(rawAmountUsd) && rawAmountUsd > 0
        ? rawAmountUsd
        : calcularEquivalenteUsd(amount, currency, exchangeRate);

    const date =
      typeof exp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(exp.date)
        ? exp.date
        : typeof exp.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(exp.fecha)
          ? exp.fecha
          : obtenerFechaLocalIso();

    // Buscar categoría por ID o por nombre
    let categoryId = 'cat_exp_other';
    if (typeof exp.categoryId === 'string' && validCategoryIds.has(exp.categoryId)) {
      categoryId = exp.categoryId;
    } else if (typeof exp.categoryName === 'string') {
      const byName = categories.find(
        (c) =>
          c.type === 'expense' &&
          c.name.toLowerCase() === String(exp.categoryName).trim().toLowerCase()
      );
      if (byName) categoryId = byName.id;
    }

    existingSharedIds.add(id);
    totalImportadoUsd += amountUsd;

    nuevasTransacciones.push({
      id: `imported_${id}`,
      sharedExpenseId: id,
      date,
      type: 'expense',
      status: 'completed',
      walletId: targetWalletId || undefined,
      description: `[Pareja] ${concept}`,
      categoryId,
      amount,
      currency,
      exchangeRate,
      amountUsd,
      exchangeRateSource: currency === 'USD' ? 'none' : 'bcv',
      expenseType: 'variable',
      notes:
        typeof exp.notes === 'string' && exp.notes.trim()
          ? `Importado de Finanzas en Pareja · ${exp.notes.trim()}`
          : `Importado de Finanzas en Pareja (ID: ${id})`,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    nuevasTransacciones,
    omitidasPorDuplicado,
    totalImportadoUsd,
  };
}
