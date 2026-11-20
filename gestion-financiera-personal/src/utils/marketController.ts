import {
  AppDataSchema,
  CurrencyCode,
  InstallmentFrequency,
  MarketCategoryStop,
  MarketItem,
  MarketList,
  Transaction,
} from '../types/finance';
import {
  calcularEquivalenteUsd,
  obtenerFechaLocalIso,
  obtenerIdCategoriaComisionBancaria,
} from './calculations';
import {
  GeneratedInstallmentPreview,
  crearCompraACuotas,
  eliminarCompraCreditoEnAppData,
} from './installmentsController';

export const MARKET_STOPS: {
  id: MarketCategoryStop;
  label: string;
  shortLabel: string;
  iconName: string;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
}[] = [
  {
    id: 'Feria/Hortalizas',
    label: 'Feria / Hortalizas y Frutas',
    shortLabel: 'Feria / Frutas',
    iconName: 'Apple',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-400',
    accentBorder: 'border-emerald-500/30',
  },
  {
    id: 'Carnicería',
    label: 'Carnicería (Res, Pollo, Cerdo)',
    shortLabel: 'Carnicería',
    iconName: 'Beef',
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-400',
    accentBorder: 'border-rose-500/30',
  },
  {
    id: 'Charcutería',
    label: 'Charcutería (Quesos, Jamón, Lácteos)',
    shortLabel: 'Charcutería',
    iconName: 'Sandwich',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-400',
    accentBorder: 'border-amber-500/30',
  },
  {
    id: 'Supermercado/Víveres',
    label: 'Supermercado / Víveres y Despensa',
    shortLabel: 'Supermercado',
    iconName: 'ShoppingBag',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
    accentBorder: 'border-blue-500/30',
  },
  {
    id: 'Limpieza/Aseo',
    label: 'Limpieza / Aseo del Hogar y Personal',
    shortLabel: 'Limpieza / Aseo',
    iconName: 'Sparkles',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-400',
    accentBorder: 'border-purple-500/30',
  },
  {
    id: 'Otros',
    label: 'Otros / Misceláneos',
    shortLabel: 'Otros',
    iconName: 'Tag',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-400',
    accentBorder: 'border-slate-500/30',
  },
];

export interface CreateMarketListInput {
  nombre: string;
  presupuestoEstimado: number;
  moneda: CurrencyCode;
  exchangeRate?: number | null;
  fecha: string; // YYYY-MM-DD
  initialItems?: {
    nombre: string;
    categoria: MarketCategoryStop;
    cantidad?: number;
    montoUnitario?: number;
  }[];
  notas?: string;
}

export interface UpdateMarketListInput {
  nombre?: string;
  presupuestoEstimado?: number;
  moneda?: CurrencyCode;
  exchangeRate?: number | null;
  fecha?: string;
  notes?: string;
}

export interface UpdateMarketItemInput {
  nombre?: string;
  categoria?: MarketCategoryStop;
  cantidad?: number | null;
  montoUnitario?: number | null;
  comprado?: boolean;
  notes?: string;
}

export interface CloseMarketListInput {
  listId: string;
  totalPagadoReal: number;
  moneda: CurrencyCode;
  exchangeRate?: number | null;
  walletId: string;
  fechaPago?: string; // YYYY-MM-DD
  notas?: string;
  interbankFeeType?: 'none' | 'pago_movil' | 'transferencia';
  interbankFeeAmount?: number;
  paymentMode?: 'contado' | 'cashea';
  paidTodayAmount?: number; // Monto pagado hoy en caja (Inicial + Contado) en `moneda`
  casheaInstallmentsCount?: number; // Cantidad de cuotas pendientes (ej. 1, 2, 3)
  casheaFrequency?: InstallmentFrequency; // 'biweekly' | 'monthly'
  casheaFirstDueDate?: string; // YYYY-MM-DD (fecha de la 1ra cuota)
  casheaStoreOrPlatform?: string; // Ej: "Cashea"
}

export interface DuplicateMarketListInput {
  sourceListId: string;
  nuevoNombre: string;
  presupuestoEstimado: number;
  moneda: CurrencyCode;
  exchangeRate?: number | null;
  fecha: string; // YYYY-MM-DD
}

function roundTwoDecimals(num: number): number {
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el subtotal (cantidad * montoUnitario) de un ítem de la lista de mercado
 * si cuenta con datos de precio/cantidad válidos. Si no los tiene, retorna null.
 */
export function calcularSubtotalItemMercado(item: MarketItem): number | null {
  const hasMonto =
    typeof item.montoUnitario === 'number' &&
    Number.isFinite(item.montoUnitario) &&
    item.montoUnitario > 0;

  if (!hasMonto) return null;

  const cant =
    typeof item.cantidad === 'number' &&
    Number.isFinite(item.cantidad) &&
    item.cantidad > 0
      ? item.cantidad
      : 1;

  return roundTwoDecimals(cant * (item.montoUnitario as number));
}

/**
 * Calcula el desglose comparativo entre el Monto Global Estimado de la lista
 * y la Suma de los ítems detallados (aquellos que tienen cantidad y monto),
 * incluyendo también sus equivalentes en USD ($).
 */
export function calcularComparativaPresupuestoLista(
  list: MarketList,
  fallbackRate?: number | null
): {
  montoGlobalLista: number;
  montoGlobalListaUsd: number;
  sumaItemsDetallados: number;
  sumaItemsDetalladosUsd: number;
  sumaItemsCompradosDetallados: number;
  sumaItemsCompradosDetalladosUsd: number;
  diferenciaDisponible: number;
  diferenciaDisponibleUsd: number;
  excesoSobreGlobal: number;
  excesoSobreGlobalUsd: number;
  tasaReferencial: number | null;
  porcentajeCubiertoPorItems: number;
  itemsConPrecioCount: number;
  itemsSinPrecioCount: number;
} {
  const montoGlobalLista = roundTwoDecimals(Math.max(0, list.presupuestoEstimado || 0));
  let sumaItemsDetallados = 0;
  let sumaItemsCompradosDetallados = 0;
  let itemsConPrecioCount = 0;
  let itemsSinPrecioCount = 0;

  for (const item of list.items || []) {
    const subtotal = calcularSubtotalItemMercado(item);
    if (subtotal !== null && subtotal > 0) {
      sumaItemsDetallados += subtotal;
      if (item.comprado) {
        sumaItemsCompradosDetallados += subtotal;
      }
      itemsConPrecioCount += 1;
    } else {
      itemsSinPrecioCount += 1;
    }
  }

  sumaItemsDetallados = roundTwoDecimals(sumaItemsDetallados);
  sumaItemsCompradosDetallados = roundTwoDecimals(sumaItemsCompradosDetallados);

  const diferenciaDisponible = roundTwoDecimals(
    Math.max(0, montoGlobalLista - sumaItemsDetallados)
  );
  const excesoSobreGlobal = roundTwoDecimals(
    Math.max(0, sumaItemsDetallados - montoGlobalLista)
  );
  const porcentajeCubiertoPorItems =
    montoGlobalLista > 0
      ? Math.round((sumaItemsDetallados / montoGlobalLista) * 100)
      : sumaItemsDetallados > 0
        ? 100
        : 0;

  const isVes = list.moneda === 'VES';
  const tasaReferencial = isVes
    ? list.exchangeRate && list.exchangeRate > 0
      ? list.exchangeRate
      : fallbackRate && fallbackRate > 0
        ? fallbackRate
        : 450
    : null;

  const toUsd = (amt: number): number => {
    if (!isVes) return roundTwoDecimals(amt);
    return roundTwoDecimals(calcularEquivalenteUsd(amt, 'VES', tasaReferencial));
  };

  return {
    montoGlobalLista,
    montoGlobalListaUsd: toUsd(montoGlobalLista),
    sumaItemsDetallados,
    sumaItemsDetalladosUsd: toUsd(sumaItemsDetallados),
    sumaItemsCompradosDetallados,
    sumaItemsCompradosDetalladosUsd: toUsd(sumaItemsCompradosDetallados),
    diferenciaDisponible,
    diferenciaDisponibleUsd: toUsd(diferenciaDisponible),
    excesoSobreGlobal,
    excesoSobreGlobalUsd: toUsd(excesoSobreGlobal),
    tasaReferencial,
    porcentajeCubiertoPorItems,
    itemsConPrecioCount,
    itemsSinPrecioCount,
  };
}

/**
 * Crea una nueva lista de mercado y genera su correspondiente transacción 'pending'
 * que resta automáticamente del Saldo Proyectado sin alterar el Saldo Real.
 */
export function crearListaMercado(input: CreateMarketListInput): {
  marketList: MarketList;
  pendingTransaction: Transaction;
} {
  const nowTs = Date.now();
  const listId = `market_${nowTs}_${Math.random().toString(36).slice(2, 6)}`;
  const pendingTxnId = `txn_market_pending_${nowTs}`;

  const presupuesto = roundTwoDecimals(Math.max(0, input.presupuestoEstimado));
  const rate =
    input.moneda === 'VES' && input.exchangeRate && input.exchangeRate > 0
      ? input.exchangeRate
      : null;

  const presupuestoEstimadoUsd =
    input.moneda === 'USD' || input.moneda === 'USDT'
      ? presupuesto
      : calcularEquivalenteUsd(presupuesto, 'VES', rate);

  const items: MarketItem[] = (input.initialItems || []).map((it, idx) => {
    const cleanCant =
      typeof it.cantidad === 'number' && Number.isFinite(it.cantidad) && it.cantidad > 0
        ? Number(it.cantidad)
        : undefined;
    const cleanMonto =
      typeof it.montoUnitario === 'number' &&
      Number.isFinite(it.montoUnitario) &&
      it.montoUnitario > 0
        ? roundTwoDecimals(it.montoUnitario)
        : undefined;

    return {
      id: `item_${nowTs}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
      nombre: it.nombre.trim(),
      categoria: it.categoria || 'Supermercado/Víveres',
      comprado: false,
      ...(cleanCant !== undefined
        ? { cantidad: cleanCant }
        : cleanMonto !== undefined
          ? { cantidad: 1 }
          : {}),
      ...(cleanMonto !== undefined ? { montoUnitario: cleanMonto } : {}),
    };
  });

  const marketList: MarketList = {
    id: listId,
    nombre: input.nombre.trim() || 'Mercado Quincenal',
    presupuestoEstimado: presupuesto,
    moneda: input.moneda,
    exchangeRate: rate,
    presupuestoEstimadoUsd: roundTwoDecimals(presupuestoEstimadoUsd),
    totalPagadoReal: null,
    totalPagadoRealUsd: null,
    fecha: input.fecha || obtenerFechaLocalIso(),
    estado: 'abierta',
    items,
    walletId: null,
    linkedPendingTransactionId: pendingTxnId,
    linkedCompletedTransactionId: null,
    closedAt: null,
    notes: input.notas?.trim() || '',
    createdAt: new Date().toISOString(),
  };

  const pendingTransaction: Transaction = {
    id: pendingTxnId,
    date: marketList.fecha,
    type: 'expense',
    status: 'pending',
    walletId: undefined,
    description: `[Lista de Mercado] ${marketList.nombre}`,
    categoryId: 'cat_exp_groceries',
    amount: presupuesto,
    currency: input.moneda,
    exchangeRate: rate,
    amountUsd: roundTwoDecimals(presupuestoEstimadoUsd),
    exchangeRateSource: input.moneda === 'VES' ? 'manual' : 'none',
    paymentMethod: 'Presupuesto de Mercado (Pendiente)',
    expenseType: 'variable',
    isRecurring: false,
    notes: `Presupuesto global estimado para "${marketList.nombre}" (${items.length} artículos). Resta al Saldo Proyectado.`,
  };

  return { marketList, pendingTransaction };
}

/**
 * Actualiza los datos maestros de una Lista de Mercado (Nombre y Monto Global Estimado,
 * además de moneda/tasa opcional) y sincroniza la transacción 'pending' asociada
 * para actualizar la vista del presupuesto general al instante.
 */
export function actualizarListaMercadoEnAppData(
  data: AppDataSchema,
  listId: string,
  nuevosDatos: UpdateMarketListInput
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const listIndex = currentLists.findIndex((l) => l.id === listId);
  if (listIndex === -1) {
    throw new Error('No se encontró la lista de mercado a actualizar.');
  }

  const currentList = currentLists[listIndex];
  const nextNombre =
    typeof nuevosDatos.nombre === 'string' && nuevosDatos.nombre.trim().length > 0
      ? nuevosDatos.nombre.trim()
      : currentList.nombre;

  const nextMoneda: CurrencyCode =
    nuevosDatos.moneda === 'VES' || nuevosDatos.moneda === 'USD'
      ? nuevosDatos.moneda
      : currentList.moneda;

  const nextPresupuesto =
    typeof nuevosDatos.presupuestoEstimado === 'number' &&
    Number.isFinite(nuevosDatos.presupuestoEstimado) &&
    nuevosDatos.presupuestoEstimado >= 0
      ? roundTwoDecimals(nuevosDatos.presupuestoEstimado)
      : currentList.presupuestoEstimado;

  const fallbackRate =
    data.settings?.lastOfficialRate ||
    data.settings?.defaultExchangeRate ||
    currentList.exchangeRate ||
    450;

  const nextExchangeRate =
    nextMoneda === 'VES'
      ? typeof nuevosDatos.exchangeRate === 'number' &&
        Number.isFinite(nuevosDatos.exchangeRate) &&
        nuevosDatos.exchangeRate > 0
        ? nuevosDatos.exchangeRate
        : currentList.exchangeRate && currentList.exchangeRate > 0
          ? currentList.exchangeRate
          : fallbackRate
      : null;

  const nextPresupuestoUsd =
    nextMoneda === 'USD' || nextMoneda === 'USDT'
      ? nextPresupuesto
      : roundTwoDecimals(
          calcularEquivalenteUsd(nextPresupuesto, 'VES', nextExchangeRate)
        );

  const nextFecha =
    typeof nuevosDatos.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nuevosDatos.fecha)
      ? nuevosDatos.fecha
      : currentList.fecha;

  const updatedList: MarketList = {
    ...currentList,
    nombre: nextNombre,
    presupuestoEstimado: nextPresupuesto,
    moneda: nextMoneda,
    exchangeRate: nextExchangeRate,
    presupuestoEstimadoUsd: nextPresupuestoUsd,
    fecha: nextFecha,
    notes:
      typeof nuevosDatos.notes === 'string'
        ? nuevosDatos.notes.trim()
        : currentList.notes,
  };

  const updatedLists = currentLists.map((l, idx) =>
    idx === listIndex ? updatedList : l
  );

  // Sincronizar la fecha y el nombre en las transacciones vinculadas (tanto abiertas como cerradas)
  // y en la compra a cuotas (Cashea) para que Estadísticas, Movimientos y la Tabla Mensual coincidan.
  let updatedTransactions = data.transactions;
  let updatedCreditPurchases = data.creditPurchases || [];

  if (updatedList.estado === 'abierta' && updatedList.linkedPendingTransactionId) {
    const hasPending = updatedTransactions.some(
      (tx) => tx.id === updatedList.linkedPendingTransactionId
    );
    if (hasPending) {
      updatedTransactions = updatedTransactions.map((tx) => {
        if (tx.id !== updatedList.linkedPendingTransactionId) return tx;
        return {
          ...tx,
          date: updatedList.fecha,
          description: `[Lista de Mercado] ${updatedList.nombre}`,
          amount: updatedList.presupuestoEstimado,
          currency: updatedList.moneda,
          exchangeRate: updatedList.exchangeRate ?? null,
          amountUsd: updatedList.presupuestoEstimadoUsd,
          exchangeRateSource: updatedList.moneda === 'VES' ? 'manual' : 'none',
          notes: `Presupuesto global estimado para "${updatedList.nombre}" (${updatedList.items.length} artículos). Resta al Saldo Proyectado.`,
        };
      });
    }
  } else if (updatedList.estado === 'cerrada') {
    if (updatedList.linkedCompletedTransactionId) {
      const mainTxId = updatedList.linkedCompletedTransactionId;
      const feeTxId = `${mainTxId}_fee`;
      updatedTransactions = updatedTransactions.map((tx) => {
        if (tx.id === mainTxId) {
          const nextDesc =
            updatedList.paymentMode === 'cashea'
              ? `[Inicial ${updatedList.casheaStoreOrPlatform || 'Cashea'}] [Mercado] ${updatedList.nombre}`
              : `[Mercado] ${updatedList.nombre}`;
          return {
            ...tx,
            date: updatedList.fecha,
            description: nextDesc,
          };
        }
        if (tx.id === feeTxId || tx.parentTransactionId === mainTxId) {
          return {
            ...tx,
            date: updatedList.fecha,
          };
        }
        return tx;
      });
    }

    if (updatedList.linkedCreditPurchaseId) {
      updatedCreditPurchases = updatedCreditPurchases.map((cp) => {
        if (cp.id !== updatedList.linkedCreditPurchaseId) return cp;
        return {
          ...cp,
          purchaseDate: updatedList.fecha,
          concept: `[Mercado] ${updatedList.nombre}`,
        };
      });
    }
  }

  return {
    ...data,
    marketLists: updatedLists,
    transactions: updatedTransactions,
    creditPurchases: updatedCreditPurchases,
  };
}

/**
 * Cierra la lista de mercado:
 * - Pregunta "¿Cuánto gastaste en total en este mercado?" y de qué Wallet salió.
 * - Elimina la transacción 'pending' (liberando el saldo proyectado).
 * - En modo 'contado': Crea la transacción 'completed' con el monto total debitado de la Wallet seleccionada.
 * - En modo 'cashea': Descuenta de la Wallet únicamente el Monto Pagado Hoy (Inicial + Contado)
 *   y crea automáticamente el registro en Compras por Cuota (Cashea) con sus cuotas pendientes
 *   bajo la categoría de Alimentación / Mercado.
 */
export function cerrarListaMercadoEnAppData(
  data: AppDataSchema,
  input: CloseMarketListInput
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const listIndex = currentLists.findIndex((l) => l.id === input.listId);
  if (listIndex === -1) {
    throw new Error('No se encontró la lista de mercado seleccionada.');
  }

  const list = currentLists[listIndex];
  if (list.estado === 'cerrada') {
    throw new Error('Esta lista de mercado ya se encuentra cerrada.');
  }

  const wallet = data.wallets.find((w) => w.id === input.walletId);
  if (!wallet) {
    throw new Error('Selecciona una billetera válida de donde salió el pago.');
  }

  const totalReal = roundTwoDecimals(Math.max(0, input.totalPagadoReal));
  if (totalReal <= 0) {
    throw new Error('Ingresa el monto total del mercado mayor a cero.');
  }

  const rate =
    input.moneda === 'VES' && input.exchangeRate && input.exchangeRate > 0
      ? input.exchangeRate
      : null;

  const totalRealUsd = roundTwoDecimals(
    input.moneda === 'USD' || input.moneda === 'USDT'
      ? totalReal
      : calcularEquivalenteUsd(totalReal, 'VES', rate)
  );

  const nowIso = new Date().toISOString();
  const fechaCierre = input.fechaPago || list.fecha || obtenerFechaLocalIso();
  const isCasheaMode = input.paymentMode === 'cashea';

  if (isCasheaMode) {
    const paidTodayNominal = roundTwoDecimals(
      Math.max(0, input.paidTodayAmount ?? 0)
    );
    const paidTodayUsd = roundTwoDecimals(
      input.moneda === 'USD' || input.moneda === 'USDT'
        ? paidTodayNominal
        : calcularEquivalenteUsd(paidTodayNominal, 'VES', rate)
    );

    if (paidTodayUsd >= totalRealUsd - 0.009) {
      throw new Error(
        'En pago con Cashea, el monto pagado hoy debe ser menor al total del mercado para dejar saldo financiado en cuotas.'
      );
    }

    const financedUsd = roundTwoDecimals(Math.max(0, totalRealUsd - paidTodayUsd));
    const installmentsCount = Math.max(
      1,
      Math.min(48, Math.round(input.casheaInstallmentsCount || 1))
    );
    const frequency: InstallmentFrequency =
      input.casheaFrequency === 'monthly' ? 'monthly' : 'biweekly';
    const storeOrPlatform = input.casheaStoreOrPlatform?.trim() || 'Cashea';

    // Si el usuario especificó la fecha de la 1ra cuota, construimos el cronograma a partir de esa fecha
    let customSchedule: GeneratedInstallmentPreview[] | undefined;
    if (
      input.casheaFirstDueDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.casheaFirstDueDate)
    ) {
      const baseParts = input.casheaFirstDueDate.split('-').map(Number);
      const baseInstallmentUsd = roundTwoDecimals(financedUsd / installmentsCount);
      let accumulated = 0;
      customSchedule = [];

      for (let i = 1; i <= installmentsCount; i++) {
        const isLast = i === installmentsCount;
        const amountUsd = isLast
          ? roundTwoDecimals(financedUsd - accumulated)
          : baseInstallmentUsd;
        accumulated = roundTwoDecimals(accumulated + amountUsd);

        const dObj = new Date(
          baseParts[0] || new Date().getFullYear(),
          (baseParts[1] || 1) - 1,
          baseParts[2] || 1,
          12,
          0,
          0
        );
        if (i > 1) {
          if (frequency === 'biweekly') {
            dObj.setDate(dObj.getDate() + (i - 1) * 14);
          } else {
            dObj.setMonth(dObj.getMonth() + (i - 1));
          }
        }
        const dueDate = `${dObj.getFullYear()}-${String(
          dObj.getMonth() + 1
        ).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;

        customSchedule.push({
          number: i,
          amountUsd,
          dueDate,
        });
      }
    }

    const { purchase, transactionsToCreate } = crearCompraACuotas({
      concept: `[Mercado] ${list.nombre}`,
      storeOrPlatform,
      categoryId: 'cat_exp_groceries',
      purchaseDate: fechaCierre,
      totalAmountUsd: totalRealUsd,
      initialPaymentUsd: paidTodayUsd,
      initialAlreadyPaidExternally: paidTodayUsd <= 0,
      initialPaymentWalletId: wallet.id,
      initialPaymentCurrency: input.moneda,
      initialPaymentExchangeRate: rate,
      initialPaymentExchangeRateSource: input.moneda === 'VES' ? 'manual' : 'none',
      initialPaymentNominalOverride:
        input.moneda === 'VES' ? paidTodayNominal : undefined,
      initialInterbankFeeType: input.interbankFeeType,
      initialInterbankFeeAmount: input.interbankFeeAmount,
      frequency,
      installmentsCount,
      customSchedule,
      notes:
        input.notas?.trim() ||
        `Mercado "${list.nombre}" pagado con ${storeOrPlatform} (Total: $${totalRealUsd.toFixed(
          2
        )} · Pagado hoy: $${paidTodayUsd.toFixed(
          2
        )} · Financiado: $${financedUsd.toFixed(2)} en ${installmentsCount} cuota${
          installmentsCount === 1 ? '' : 's'
        }).`,
    });

    const updatedList: MarketList = {
      ...list,
      fecha: fechaCierre,
      estado: 'cerrada',
      totalPagadoReal: totalReal,
      totalPagadoRealUsd: totalRealUsd,
      walletId: wallet.id,
      closedAt: nowIso,
      linkedCompletedTransactionId: purchase.initialTransactionId || null,
      paymentCurrency: input.moneda,
      paymentExchangeRate: rate,
      paymentMode: 'cashea',
      paidTodayAmount: paidTodayNominal,
      paidTodayAmountUsd: paidTodayUsd,
      casheaFinancedUsd: financedUsd,
      casheaInstallmentsCount: installmentsCount,
      casheaStoreOrPlatform: storeOrPlatform,
      linkedCreditPurchaseId: purchase.id,
    };

    const updatedTransactions = data.transactions
      .filter((tx) => tx.id !== list.linkedPendingTransactionId)
      .concat(transactionsToCreate);

    const updatedLists = currentLists.map((l, idx) =>
      idx === listIndex ? updatedList : l
    );

    return {
      ...data,
      marketLists: updatedLists,
      creditPurchases: [purchase, ...(data.creditPurchases || [])],
      transactions: updatedTransactions,
    };
  }

  const completedTxnId = `txn_market_completed_${Date.now()}`;
  const hasBankFee =
    input.interbankFeeType &&
    input.interbankFeeType !== 'none' &&
    typeof input.interbankFeeAmount === 'number' &&
    input.interbankFeeAmount > 0;
  const feeTxnId = hasBankFee ? `${completedTxnId}_fee` : undefined;
  const cleanFeeNominal = hasBankFee
    ? roundTwoDecimals(input.interbankFeeAmount!)
    : 0;

  const completedTransaction: Transaction = {
    id: completedTxnId,
    date: fechaCierre,
    type: 'expense',
    status: 'completed',
    walletId: wallet.id,
    description: `[Mercado] ${list.nombre}`,
    categoryId: 'cat_exp_groceries',
    amount: totalReal,
    currency: input.moneda,
    exchangeRate: rate,
    amountUsd: totalRealUsd,
    exchangeRateSource: input.moneda === 'VES' ? 'manual' : 'none',
    paymentMethod:
      input.interbankFeeType === 'pago_movil'
        ? `${wallet.name} · Pago Móvil`
        : input.interbankFeeType === 'transferencia'
          ? `${wallet.name} · Transferencia`
          : wallet.name,
    expenseType: 'variable',
    isRecurring: false,
    isInterbankTransfer: Boolean(hasBankFee),
    interbankFeeType:
      hasBankFee && input.interbankFeeType !== 'none'
        ? input.interbankFeeType
        : undefined,
    interbankFeeAmount: hasBankFee ? cleanFeeNominal : undefined,
    interbankFeeTxnId: feeTxnId,
    createdAt: nowIso,
    processedAt: nowIso,
    notes:
      input.notas?.trim() ||
      `Compra de mercado total cerrada. Presupuesto estimado inicial: ${list.moneda} ${list.presupuestoEstimado.toFixed(
        2
      )}.`,
  };

  const extraTxns: Transaction[] = [completedTransaction];

  if (hasBankFee && feeTxnId && cleanFeeNominal > 0) {
    const feeUsd =
      input.moneda === 'USD' || input.moneda === 'USDT'
        ? cleanFeeNominal
        : roundTwoDecimals(calcularEquivalenteUsd(cleanFeeNominal, 'VES', rate));
    const feeLabel =
      input.interbankFeeType === 'pago_movil' ? 'Pago Móvil' : 'Transferencia';
    extraTxns.push({
      id: feeTxnId,
      date: fechaCierre,
      type: 'expense',
      status: 'completed',
      walletId: wallet.id,
      description: `Comisión bancaria (${feeLabel}) - [Mercado] ${list.nombre}`,
      categoryId: obtenerIdCategoriaComisionBancaria(data.categories || []),
      amount: cleanFeeNominal,
      currency: input.moneda,
      exchangeRate: rate,
      amountUsd: feeUsd,
      exchangeRateSource: input.moneda === 'VES' ? 'manual' : 'none',
      paymentMethod: feeLabel,
      expenseType: 'variable',
      isRecurring: false,
      parentTransactionId: completedTxnId,
      createdAt: nowIso,
      processedAt: nowIso,
      notes: `Comisión bancaria por cierre de lista de mercado "${list.nombre}".`,
    });
  }

  // Actualizamos la lista de mercado
  const updatedList: MarketList = {
    ...list,
    fecha: fechaCierre,
    estado: 'cerrada',
    totalPagadoReal: totalReal,
    totalPagadoRealUsd: totalRealUsd,
    walletId: wallet.id,
    closedAt: nowIso,
    linkedCompletedTransactionId: completedTxnId,
    paymentCurrency: input.moneda,
    paymentExchangeRate: rate,
    paymentMode: 'contado',
    paidTodayAmount: totalReal,
    paidTodayAmountUsd: totalRealUsd,
    casheaFinancedUsd: 0,
    casheaInstallmentsCount: null,
    casheaStoreOrPlatform: null,
    linkedCreditPurchaseId: null,
  };

  // Filtramos la transacción pendiente previa y agregamos el egreso completado
  const updatedTransactions = data.transactions
    .filter((tx) => tx.id !== list.linkedPendingTransactionId)
    .concat(extraTxns);

  const updatedLists = currentLists.map((l, idx) =>
    idx === listIndex ? updatedList : l
  );

  return {
    ...data,
    marketLists: updatedLists,
    transactions: updatedTransactions,
  };
}

/**
 * Reabre una lista de mercado cerrada:
 * - Si fue cerrada con Cashea, elimina también la compra a cuotas vinculada y sus cuotas pendientes.
 * - Elimina el egreso 'completed' y su comisión bancaria (restaurando el Saldo Real de la Wallet).
 * - Restaura la transacción 'pending' para que vuelva a restar en el Saldo Proyectado.
 */
export function reabrirListaMercadoEnAppData(
  data: AppDataSchema,
  listId: string
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const listIndex = currentLists.findIndex((l) => l.id === listId);
  if (listIndex === -1) return data;

  const list = currentLists[listIndex];
  if (list.estado === 'abierta') return data;

  let baseData = data;
  if (list.linkedCreditPurchaseId) {
    baseData = eliminarCompraCreditoEnAppData(
      baseData,
      list.linkedCreditPurchaseId,
      true
    );
  }

  const pendingTxnId =
    list.linkedPendingTransactionId || `txn_market_pending_${Date.now()}`;

  const pendingTransaction: Transaction = {
    id: pendingTxnId,
    date: list.fecha,
    type: 'expense',
    status: 'pending',
    walletId: undefined,
    description: `[Lista de Mercado] ${list.nombre}`,
    categoryId: 'cat_exp_groceries',
    amount: list.presupuestoEstimado,
    currency: list.moneda,
    exchangeRate: list.exchangeRate ?? null,
    amountUsd: list.presupuestoEstimadoUsd,
    exchangeRateSource: list.moneda === 'VES' ? 'manual' : 'none',
    paymentMethod: 'Presupuesto de Mercado (Pendiente)',
    expenseType: 'variable',
    isRecurring: false,
    notes: `Lista de mercado reabierta. Resta al Saldo Proyectado.`,
  };

  const updatedList: MarketList = {
    ...list,
    estado: 'abierta',
    totalPagadoReal: null,
    totalPagadoRealUsd: null,
    walletId: null,
    closedAt: null,
    linkedPendingTransactionId: pendingTxnId,
    linkedCompletedTransactionId: null,
    paymentMode: undefined,
    paidTodayAmount: null,
    paidTodayAmountUsd: null,
    casheaFinancedUsd: null,
    casheaInstallmentsCount: null,
    casheaStoreOrPlatform: null,
    linkedCreditPurchaseId: null,
  };

  const completedId = list.linkedCompletedTransactionId;
  const updatedTransactions = baseData.transactions
    .filter(
      (tx) =>
        tx.id !== completedId &&
        (!completedId || tx.parentTransactionId !== completedId) &&
        (!completedId || tx.id !== `${completedId}_fee`)
    )
    .concat(pendingTransaction);

  const updatedLists = (baseData.marketLists || []).map((l, idx) =>
    idx === listIndex ? updatedList : l
  );

  return {
    ...baseData,
    marketLists: updatedLists,
    transactions: updatedTransactions,
  };
}

/**
 * Duplicar Lista:
 * Clona todos los ítems de una lista anterior, poniéndolos todos como no comprados (comprado: false),
 * conservando cantidad y montoUnitario si existían, y crea la nueva lista abierta con su debida proyección.
 */
export function duplicarListaMercadoEnAppData(
  data: AppDataSchema,
  input: DuplicateMarketListInput
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const source = currentLists.find((l) => l.id === input.sourceListId);
  if (!source) {
    throw new Error('No se encontró la lista original para duplicar.');
  }

  const initialItems = source.items.map((it) => ({
    nombre: it.nombre,
    categoria: it.categoria,
    cantidad: it.cantidad,
    montoUnitario: it.montoUnitario,
  }));

  const { marketList, pendingTransaction } = crearListaMercado({
    nombre: input.nuevoNombre.trim() || `${source.nombre} (Copia)`,
    presupuestoEstimado: input.presupuestoEstimado,
    moneda: input.moneda,
    exchangeRate: input.exchangeRate,
    fecha: input.fecha,
    initialItems,
  });

  return {
    ...data,
    marketLists: [marketList, ...currentLists],
    transactions: [pendingTransaction, ...data.transactions],
  };
}

/**
 * Tilda o destilda un ítem (comprado = !comprado)
 */
export function alternarItemMercadoEnAppData(
  data: AppDataSchema,
  listId: string,
  itemId: string
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const updatedLists = currentLists.map((list) => {
    if (list.id !== listId) return list;
    const updatedItems = list.items.map((it) => {
      if (it.id !== itemId) return it;
      return { ...it, comprado: !it.comprado };
    });
    return { ...list, items: updatedItems };
  });

  return { ...data, marketLists: updatedLists };
}

/**
 * Añade un ítem a la lista (con cantidad y montoUnitario estrictamente opcionales).
 * Si el usuario los deja en blanco, se guarda solo con el nombre y categoría como funcionaba antes.
 */
export function agregarItemAListaEnAppData(
  data: AppDataSchema,
  listId: string,
  item: {
    nombre: string;
    categoria: MarketCategoryStop;
    cantidad?: number | null;
    montoUnitario?: number | null;
  }
): AppDataSchema {
  if (!item.nombre.trim()) return data;

  const hasValidCantidad =
    typeof item.cantidad === 'number' &&
    Number.isFinite(item.cantidad) &&
    item.cantidad > 0;
  const hasValidMonto =
    typeof item.montoUnitario === 'number' &&
    Number.isFinite(item.montoUnitario) &&
    item.montoUnitario > 0;

  const cleanCantidad = hasValidCantidad
    ? Number(item.cantidad)
    : hasValidMonto
      ? 1
      : undefined;
  const cleanMontoUnitario = hasValidMonto
    ? roundTwoDecimals(item.montoUnitario as number)
    : undefined;

  const currentLists = data.marketLists || [];
  const newItem: MarketItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nombre: item.nombre.trim(),
    categoria: item.categoria,
    comprado: false,
    ...(cleanCantidad !== undefined ? { cantidad: cleanCantidad } : {}),
    ...(cleanMontoUnitario !== undefined ? { montoUnitario: cleanMontoUnitario } : {}),
  };

  const updatedLists = currentLists.map((list) => {
    if (list.id !== listId) return list;
    return { ...list, items: [...list.items, newItem] };
  });

  return { ...data, marketLists: updatedLists };
}

/**
 * Actualiza un ítem individual de una Lista de Mercado (nombre, cantidad, montoUnitario, categoría).
 */
export function actualizarItemMercadoEnAppData(
  data: AppDataSchema,
  listId: string,
  itemId: string,
  datosActualizados: UpdateMarketItemInput
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const listIndex = currentLists.findIndex((l) => l.id === listId);
  if (listIndex === -1) {
    throw new Error('No se encontró la lista de mercado.');
  }

  const targetList = currentLists[listIndex];
  const itemExists = targetList.items.some((it) => it.id === itemId);
  if (!itemExists) {
    throw new Error('No se encontró el artículo a editar.');
  }

  const updatedItems = targetList.items.map((it) => {
    if (it.id !== itemId) return it;

    const nextNombre =
      typeof datosActualizados.nombre === 'string' &&
      datosActualizados.nombre.trim().length > 0
        ? datosActualizados.nombre.trim()
        : it.nombre;

    const nextCategoria = datosActualizados.categoria || it.categoria;

    // Determinar cantidad y montoUnitario (permitiendo limpiar/dejar en blanco si pasan null o <= 0)
    const rawCant =
      'cantidad' in datosActualizados ? datosActualizados.cantidad : it.cantidad;
    const rawMonto =
      'montoUnitario' in datosActualizados
        ? datosActualizados.montoUnitario
        : it.montoUnitario;

    const hasValidMonto =
      typeof rawMonto === 'number' && Number.isFinite(rawMonto) && rawMonto > 0;
    const hasValidCant =
      typeof rawCant === 'number' && Number.isFinite(rawCant) && rawCant > 0;

    const nextCantidad = hasValidCant
      ? Number(rawCant)
      : hasValidMonto
        ? 1
        : undefined;
    const nextMontoUnitario = hasValidMonto
      ? roundTwoDecimals(rawMonto as number)
      : undefined;

    const updatedItem: MarketItem = {
      ...it,
      nombre: nextNombre,
      categoria: nextCategoria,
      comprado:
        typeof datosActualizados.comprado === 'boolean'
          ? datosActualizados.comprado
          : it.comprado,
      notes:
        typeof datosActualizados.notes === 'string'
          ? datosActualizados.notes.trim()
          : it.notes,
    };

    if (nextCantidad !== undefined) {
      updatedItem.cantidad = nextCantidad;
    } else {
      delete updatedItem.cantidad;
    }

    if (nextMontoUnitario !== undefined) {
      updatedItem.montoUnitario = nextMontoUnitario;
    } else {
      delete updatedItem.montoUnitario;
    }

    return updatedItem;
  });

  const updatedLists = currentLists.map((l, idx) =>
    idx === listIndex ? { ...l, items: updatedItems } : l
  );

  return {
    ...data,
    marketLists: updatedLists,
  };
}

/**
 * Elimina un ítem de la lista
 */
export function eliminarItemDeListaEnAppData(
  data: AppDataSchema,
  listId: string,
  itemId: string
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const updatedLists = currentLists.map((list) => {
    if (list.id !== listId) return list;
    return { ...list, items: list.items.filter((it) => it.id !== itemId) };
  });

  return { ...data, marketLists: updatedLists };
}

/**
 * Marca todos los ítems como comprados o no comprados
 */
export function alternarTodosLosItemsEnAppData(
  data: AppDataSchema,
  listId: string,
  marcarComoComprados: boolean
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const updatedLists = currentLists.map((list) => {
    if (list.id !== listId) return list;
    return {
      ...list,
      items: list.items.map((it) => ({ ...it, comprado: marcarComoComprados })),
    };
  });

  return { ...data, marketLists: updatedLists };
}

/**
 * Elimina una lista de mercado y sus transacciones asociadas
 */
export function eliminarListaMercadoEnAppData(
  data: AppDataSchema,
  listId: string
): AppDataSchema {
  const currentLists = data.marketLists || [];
  const target = currentLists.find((l) => l.id === listId);
  if (!target) return data;

  let baseData = data;
  if (target.linkedCreditPurchaseId) {
    baseData = eliminarCompraCreditoEnAppData(
      baseData,
      target.linkedCreditPurchaseId,
      true
    );
  }

  const linkedIds = new Set<string>();
  if (target.linkedPendingTransactionId) linkedIds.add(target.linkedPendingTransactionId);
  if (target.linkedCompletedTransactionId) linkedIds.add(target.linkedCompletedTransactionId);

  return {
    ...baseData,
    marketLists: (baseData.marketLists || []).filter((l) => l.id !== listId),
    transactions: baseData.transactions.filter(
      (tx) =>
        !linkedIds.has(tx.id) &&
        (!tx.parentTransactionId || !linkedIds.has(tx.parentTransactionId))
    ),
  };
}

/**
 * Resumen de listas de mercado
 */
export function calcularResumenMercado(lists: MarketList[] = []): {
  totalListas: number;
  listasAbiertas: number;
  listasCerradas: number;
  presupuestoProyectadoTotalUsd: number;
  totalGastadoHistoricoUsd: number;
  itemsPendientesEnAbiertas: number;
} {
  let listasAbiertas = 0;
  let listasCerradas = 0;
  let presupuestoProyectadoTotalUsd = 0;
  let totalGastadoHistoricoUsd = 0;
  let itemsPendientesEnAbiertas = 0;

  for (const list of lists) {
    if (list.estado === 'abierta') {
      listasAbiertas++;
      presupuestoProyectadoTotalUsd += list.presupuestoEstimadoUsd;
      itemsPendientesEnAbiertas += list.items.filter((it) => !it.comprado).length;
    } else {
      listasCerradas++;
      totalGastadoHistoricoUsd += list.totalPagadoRealUsd || 0;
    }
  }

  return {
    totalListas: lists.length,
    listasAbiertas,
    listasCerradas,
    presupuestoProyectadoTotalUsd: roundTwoDecimals(presupuestoProyectadoTotalUsd),
    totalGastadoHistoricoUsd: roundTwoDecimals(totalGastadoHistoricoUsd),
    itemsPendientesEnAbiertas,
  };
}

export const MONTH_NAMES_ES = [
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
] as const;

export const MONTH_SHORT_NAMES_ES = [
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
] as const;

export interface MarketMonthlyColumn {
  monthKey: string; // Formato 'YYYY-MM' (ej. '2026-10')
  year: number;
  month: number; // 1..12
  monthName: string; // 'Octubre'
  label: string; // 'Octubre 2026'
  shortLabel: string; // 'Oct 2026'
  totalCerradoUsd: number; // Suma de totalPagadoRealUsd en listas cerradas (incluye factura completa Cashea)
  totalAbiertoProyectadoUsd: number; // Suma de presupuestoEstimadoUsd en listas abiertas del mes
  totalConsolidadoUsd: number; // Total del mes (cerrado + proyectado abierto)
  paidImmediateUsd: number; // Parte pagada de contado / inicial en el mes
  financedCasheaUsd: number; // Parte financiada en cuotas Cashea en el mes
  closedListsCount: number;
  openListsCount: number;
  totalListsCount: number;
  averagePerListUsd: number;
  stopBreakdownUsd: Record<MarketCategoryStop, number>;
  lists: MarketList[];
  diffVsPrevUsd: number | null;
  diffVsPrevPercent: number | null;
}

export interface MarketMonthComparisonResult {
  baseMonth: MarketMonthlyColumn;
  targetMonth: MarketMonthlyColumn;
  differenceUsd: number; // target - base
  absDifferenceUsd: number;
  percentageChange: number | null;
  differenceCerradoUsd: number;
  differenceListsCount: number;
  trend: 'increase' | 'decrease' | 'equal';
  summaryText: string;
  stopDifferences: {
    stopId: MarketCategoryStop;
    label: string;
    baseUsd: number;
    targetUsd: number;
    diffUsd: number;
  }[];
}

function extractMonthKeyFromList(list: MarketList): string {
  const rawDate = (list.fecha || list.closedAt || list.createdAt || '').trim();
  const match = rawDate.match(/^(\d{4})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function createEmptyStopBreakdown(): Record<MarketCategoryStop, number> {
  return {
    'Feria/Hortalizas': 0,
    Carnicería: 0,
    Charcutería: 0,
    'Supermercado/Víveres': 0,
    'Limpieza/Aseo': 0,
    Otros: 0,
  };
}

function resolveRateForCurrency(
  currency: CurrencyCode,
  exchangeRate?: number | null
): number {
  if (currency === 'USD') return 1;
  if (typeof exchangeRate === 'number' && Number.isFinite(exchangeRate) && exchangeRate > 0) {
    return exchangeRate;
  }
  return 450;
}

/**
 * Agrupa todas las listas de mercado por mes ('YYYY-MM') en formato de columnas tipo Excel,
 * ordenadas cronológicamente (Enero -> Octubre -> Noviembre -> Diciembre) y calcula
 * automáticamente la diferencia ($ y %) de cada columna respecto al mes anterior.
 */
export function calcularColumnasMensualesMercado(
  lists: MarketList[] = [],
  fallbackExchangeRate?: number | null
): MarketMonthlyColumn[] {
  const groups = new Map<string, MarketList[]>();

  for (const list of lists) {
    const key = extractMonthKeyFromList(list);
    const existing = groups.get(key) || [];
    existing.push(list);
    groups.set(key, existing);
  }

  // Ordenar claves cronológicamente de más antiguo a más reciente (como columnas de Excel: Octubre -> Noviembre -> Diciembre)
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  const columns: MarketMonthlyColumn[] = sortedKeys.map((monthKey) => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr) || new Date().getFullYear();
    const month = Math.min(12, Math.max(1, Number(monthStr) || 1));
    const monthName = MONTH_NAMES_ES[month - 1] || 'Mes';
    const shortMonth = MONTH_SHORT_NAMES_ES[month - 1] || 'Mes';

    const monthLists = (groups.get(monthKey) || []).slice().sort((a, b) =>
      (a.fecha || '').localeCompare(b.fecha || '')
    );

    let totalCerradoUsd = 0;
    let totalAbiertoProyectadoUsd = 0;
    let paidImmediateUsd = 0;
    let financedCasheaUsd = 0;
    let closedListsCount = 0;
    let openListsCount = 0;
    const stopBreakdownUsd = createEmptyStopBreakdown();

    for (const list of monthLists) {
      const listRate = resolveRateForCurrency(
        list.moneda,
        list.exchangeRate ?? fallbackExchangeRate ?? null
      );

      if (list.estado === 'cerrada') {
        closedListsCount++;
        const realUsd = roundTwoDecimals(list.totalPagadoRealUsd || 0);
        totalCerradoUsd += realUsd;

        if (
          list.paymentMode === 'cashea' &&
          typeof list.casheaFinancedUsd === 'number' &&
          list.casheaFinancedUsd > 0
        ) {
          const finUsd = roundTwoDecimals(list.casheaFinancedUsd);
          const initUsd =
            typeof list.paidTodayAmountUsd === 'number'
              ? roundTwoDecimals(list.paidTodayAmountUsd)
              : roundTwoDecimals(Math.max(0, realUsd - finUsd));
          paidImmediateUsd += initUsd;
          financedCasheaUsd += finUsd;
        } else {
          paidImmediateUsd += realUsd;
        }
      } else {
        openListsCount++;
        totalAbiertoProyectadoUsd += roundTwoDecimals(list.presupuestoEstimadoUsd || 0);
      }

      // Desglose por paradas (usando subtotales de ítems con precio en USD)
      for (const item of list.items || []) {
        const sub = calcularSubtotalItemMercado(item);
        if (sub !== null && sub > 0) {
          const subUsd =
            list.moneda === 'USD'
              ? sub
              : listRate > 0
                ? sub / listRate
                : 0;
          const stopKey = item.categoria || 'Otros';
          stopBreakdownUsd[stopKey] = roundTwoDecimals(
            (stopBreakdownUsd[stopKey] || 0) + subUsd
          );
        }
      }
    }

    totalCerradoUsd = roundTwoDecimals(totalCerradoUsd);
    totalAbiertoProyectadoUsd = roundTwoDecimals(totalAbiertoProyectadoUsd);
    const totalConsolidadoUsd = roundTwoDecimals(
      totalCerradoUsd + totalAbiertoProyectadoUsd
    );
    const totalListsCount = monthLists.length;
    const averagePerListUsd =
      totalListsCount > 0 ? roundTwoDecimals(totalConsolidadoUsd / totalListsCount) : 0;

    return {
      monthKey,
      year,
      month,
      monthName,
      label: `${monthName} ${year}`,
      shortLabel: `${shortMonth} ${year}`,
      totalCerradoUsd,
      totalAbiertoProyectadoUsd,
      totalConsolidadoUsd,
      paidImmediateUsd: roundTwoDecimals(paidImmediateUsd),
      financedCasheaUsd: roundTwoDecimals(financedCasheaUsd),
      closedListsCount,
      openListsCount,
      totalListsCount,
      averagePerListUsd,
      stopBreakdownUsd,
      lists: monthLists,
      diffVsPrevUsd: null,
      diffVsPrevPercent: null,
    };
  });

  // Calcular variación secuencial mes a mes (ej. Noviembre vs Octubre)
  for (let i = 1; i < columns.length; i++) {
    const prev = columns[i - 1];
    const curr = columns[i];
    const diff = roundTwoDecimals(curr.totalConsolidadoUsd - prev.totalConsolidadoUsd);
    curr.diffVsPrevUsd = diff;
    curr.diffVsPrevPercent =
      prev.totalConsolidadoUsd > 0
        ? roundTwoDecimals((diff / prev.totalConsolidadoUsd) * 100)
        : null;
  }

  return columns;
}

/**
 * Compara directamente dos columnas mensuales (ej. Mes Base = Octubre $170 vs Mes Comparado = Noviembre $200)
 * devolviendo la diferencia exacta en dólares, porcentaje y por categoría/parada.
 */
export function compararMesesMercado(
  baseMonth: MarketMonthlyColumn,
  targetMonth: MarketMonthlyColumn
): MarketMonthComparisonResult {
  const differenceUsd = roundTwoDecimals(
    targetMonth.totalConsolidadoUsd - baseMonth.totalConsolidadoUsd
  );
  const absDifferenceUsd = roundTwoDecimals(Math.abs(differenceUsd));
  const percentageChange =
    baseMonth.totalConsolidadoUsd > 0
      ? roundTwoDecimals((differenceUsd / baseMonth.totalConsolidadoUsd) * 100)
      : null;

  const differenceCerradoUsd = roundTwoDecimals(
    targetMonth.totalCerradoUsd - baseMonth.totalCerradoUsd
  );
  const differenceListsCount = targetMonth.totalListsCount - baseMonth.totalListsCount;

  const trend: 'increase' | 'decrease' | 'equal' =
    differenceUsd > 0.009 ? 'increase' : differenceUsd < -0.009 ? 'decrease' : 'equal';

  const pctStr =
    percentageChange !== null
      ? ` (${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(1)}%)`
      : '';

  let summaryText = '';
  if (trend === 'increase') {
    summaryText = `En ${targetMonth.label} el gasto de mercado subió +$${absDifferenceUsd.toFixed(2)}${pctStr} en comparación con ${baseMonth.label} ($${baseMonth.totalConsolidadoUsd.toFixed(2)} → $${targetMonth.totalConsolidadoUsd.toFixed(2)}).`;
  } else if (trend === 'decrease') {
    summaryText = `En ${targetMonth.label} ahorraste -$${absDifferenceUsd.toFixed(2)}${pctStr} en comparación con ${baseMonth.label} ($${baseMonth.totalConsolidadoUsd.toFixed(2)} → $${targetMonth.totalConsolidadoUsd.toFixed(2)}).`;
  } else {
    summaryText = `${targetMonth.label} y ${baseMonth.label} mantienen el mismo gasto total de $${targetMonth.totalConsolidadoUsd.toFixed(2)}.`;
  }

  const stopDifferences = MARKET_STOPS.map((st) => {
    const baseUsd = roundTwoDecimals(baseMonth.stopBreakdownUsd[st.id] || 0);
    const targetUsd = roundTwoDecimals(targetMonth.stopBreakdownUsd[st.id] || 0);
    return {
      stopId: st.id,
      label: st.shortLabel,
      baseUsd,
      targetUsd,
      diffUsd: roundTwoDecimals(targetUsd - baseUsd),
    };
  });

  return {
    baseMonth,
    targetMonth,
    differenceUsd,
    absDifferenceUsd,
    percentageChange,
    differenceCerradoUsd,
    differenceListsCount,
    trend,
    summaryText,
    stopDifferences,
  };
}

/**
 * Permite registrar rápidamente el gasto de mercado de un mes (ej. Octubre = $170, Noviembre = $200)
 * como registro histórico para la tabla Excel mensual sin afectar los saldos de billeteras actuales.
 */
export function registrarMesHistoricoMercadoEnAppData(
  data: AppDataSchema,
  input: {
    monthKey: string; // 'YYYY-MM'
    nombre?: string;
    montoTotalUsd: number;
    notas?: string;
  }
): AppDataSchema {
  const monto = roundTwoDecimals(Number(input.montoTotalUsd) || 0);
  if (monto <= 0) {
    throw new Error('Ingresa un monto en dólares mayor a 0 para registrar el mes.');
  }

  const cleanMonthKey = /^\d{4}-\d{2}$/.test(input.monthKey)
    ? input.monthKey
    : obtenerFechaLocalIso().slice(0, 7);
  const [yStr, mStr] = cleanMonthKey.split('-');
  const mIndex = Math.min(12, Math.max(1, Number(mStr) || 1)) - 1;
  const monthName = MONTH_NAMES_ES[mIndex] || 'Mes';
  const fechaIso = `${yStr}-${mStr}-15`;
  const nowIso = new Date().toISOString();

  const newList: MarketList = {
    id: `mlist_hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nombre: (input.nombre || '').trim() || `Mercado ${monthName} ${yStr}`,
    fecha: fechaIso,
    presupuestoEstimado: monto,
    moneda: 'USD',
    presupuestoEstimadoUsd: monto,
    estado: 'cerrada',
    totalPagadoReal: monto,
    totalPagadoRealUsd: monto,
    paymentCurrency: 'USD',
    paymentMode: 'contado',
    paidTodayAmount: monto,
    paidTodayAmountUsd: monto,
    items: [],
    createdAt: nowIso,
    closedAt: nowIso,
    notes:
      (input.notas || '').trim() ||
      `Registro mensual histórico (${monthName} ${yStr}) para comparativa Excel.`,
  };

  return {
    ...data,
    marketLists: [newList, ...(data.marketLists || [])],
  };
}

export interface MarketListComparisonItemDiff {
  normalizedKey: string;
  nombre: string;
  categoria: MarketCategoryStop;
  status: 'both' | 'only_target' | 'only_base';
  baseQuantity: number;
  targetQuantity: number;
  diffQuantity: number;
  baseSubtotalUsd: number;
  targetSubtotalUsd: number;
  diffSubtotalUsd: number;
  hasPriceData: boolean;
}

export interface MarketListComparisonResult {
  baseList: MarketList;
  targetList: MarketList;
  baseMonthLabel: string;
  targetMonthLabel: string;
  baseTotalUsd: number;
  targetTotalUsd: number;
  differenceUsd: number;
  absDifferenceUsd: number;
  percentageChange: number | null;
  trend: 'increase' | 'decrease' | 'equal';
  baseItemsCount: number;
  targetItemsCount: number;
  differenceItemsCount: number;
  summaryText: string;
  stopComparisons: Array<{
    stopId: MarketCategoryStop;
    label: string;
    emoji: string;
    baseItemsCount: number;
    targetItemsCount: number;
    diffItemsCount: number;
    baseUsd: number;
    targetUsd: number;
    diffUsd: number;
  }>;
  commonItems: MarketListComparisonItemDiff[];
  onlyInTargetItems: MarketListComparisonItemDiff[];
  onlyInBaseItems: MarketListComparisonItemDiff[];
}

function normalizeMarketItemNameKey(rawName: string): string {
  return (rawName || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function formatListMonthLabel(fechaIso: string): string {
  const mk = (fechaIso || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(mk)) return fechaIso || 'Sin fecha';
  const [yStr, mStr] = mk.split('-');
  const mIdx = Math.min(12, Math.max(1, Number(mStr) || 1)) - 1;
  return `${MONTH_NAMES_ES[mIdx]} ${yStr}`;
}

const STOP_EMOJI_MAP: Record<MarketCategoryStop, string> = {
  'Feria/Hortalizas': '🥦',
  Carnicería: '🥩',
  Charcutería: '🧀',
  'Supermercado/Víveres': '🛒',
  'Limpieza/Aseo': '🧼',
  Otros: '🏷️',
};

/**
 * Compara en detalle dos listas de mercado individuales (ej. "Mercado Quincena Octubre" vs "Mercado Quincena Noviembre"),
 * calculando diferencias en monto total USD, cantidad de artículos, desglose por paradas y qué artículos se repitieron,
 * subieron de cantidad/precio, o fueron agregados/omitidos entre una lista y otra.
 */
export function compararListasMercadoEntreSi(
  baseList: MarketList,
  targetList: MarketList,
  fallbackExchangeRate: number = 450
): MarketListComparisonResult {
  const baseEval = calcularComparativaPresupuestoLista(baseList, fallbackExchangeRate);
  const targetEval = calcularComparativaPresupuestoLista(targetList, fallbackExchangeRate);

  const baseTotalUsd =
    baseList.estado === 'cerrada' &&
    typeof baseList.totalPagadoRealUsd === 'number' &&
    baseList.totalPagadoRealUsd > 0
      ? roundTwoDecimals(baseList.totalPagadoRealUsd)
      : baseEval.sumaItemsCompradosDetalladosUsd > 0
        ? roundTwoDecimals(baseEval.sumaItemsCompradosDetalladosUsd)
        : baseEval.sumaItemsDetalladosUsd > 0
          ? roundTwoDecimals(baseEval.sumaItemsDetalladosUsd)
          : roundTwoDecimals(baseList.presupuestoEstimadoUsd || 0);

  const targetTotalUsd =
    targetList.estado === 'cerrada' &&
    typeof targetList.totalPagadoRealUsd === 'number' &&
    targetList.totalPagadoRealUsd > 0
      ? roundTwoDecimals(targetList.totalPagadoRealUsd)
      : targetEval.sumaItemsCompradosDetalladosUsd > 0
        ? roundTwoDecimals(targetEval.sumaItemsCompradosDetalladosUsd)
        : targetEval.sumaItemsDetalladosUsd > 0
          ? roundTwoDecimals(targetEval.sumaItemsDetalladosUsd)
          : roundTwoDecimals(targetList.presupuestoEstimadoUsd || 0);

  const differenceUsd = roundTwoDecimals(targetTotalUsd - baseTotalUsd);
  const absDifferenceUsd = roundTwoDecimals(Math.abs(differenceUsd));
  const percentageChange =
    baseTotalUsd > 0
      ? roundTwoDecimals((differenceUsd / baseTotalUsd) * 100)
      : null;

  const trend: 'increase' | 'decrease' | 'equal' =
    differenceUsd > 0.009
      ? 'increase'
      : differenceUsd < -0.009
        ? 'decrease'
        : 'equal';

  const baseItemsCount = (baseList.items || []).length;
  const targetItemsCount = (targetList.items || []).length;
  const differenceItemsCount = targetItemsCount - baseItemsCount;

  const baseMonthLabel = formatListMonthLabel(baseList.fecha);
  const targetMonthLabel = formatListMonthLabel(targetList.fecha);

  const baseRate = resolveRateForCurrency(
    baseList.moneda,
    baseList.exchangeRate ?? fallbackExchangeRate
  );
  const targetRate = resolveRateForCurrency(
    targetList.moneda,
    targetList.exchangeRate ?? fallbackExchangeRate
  );

  const stopComparisons = MARKET_STOPS.map((st) => {
    const baseStopItems = (baseList.items || []).filter((it) => it.categoria === st.id);
    const targetStopItems = (targetList.items || []).filter((it) => it.categoria === st.id);

    const bCount = baseStopItems.length;
    const tCount = targetStopItems.length;

    const bUsd = roundTwoDecimals(
      baseStopItems.reduce((acc, it) => {
        const sub = calcularSubtotalItemMercado(it) || 0;
        if (sub <= 0) return acc;
        return (
          acc +
          (baseList.moneda === 'USD' || baseList.moneda === 'USDT'
            ? sub
            : calcularEquivalenteUsd(sub, 'VES', baseRate))
        );
      }, 0)
    );

    const tUsd = roundTwoDecimals(
      targetStopItems.reduce((acc, it) => {
        const sub = calcularSubtotalItemMercado(it) || 0;
        if (sub <= 0) return acc;
        return (
          acc +
          (targetList.moneda === 'USD' || targetList.moneda === 'USDT'
            ? sub
            : calcularEquivalenteUsd(sub, 'VES', targetRate))
        );
      }, 0)
    );

    return {
      stopId: st.id,
      label: st.shortLabel,
      emoji: STOP_EMOJI_MAP[st.id] || '🛒',
      baseItemsCount: bCount,
      targetItemsCount: tCount,
      diffItemsCount: tCount - bCount,
      baseUsd: bUsd,
      targetUsd: tUsd,
      diffUsd: roundTwoDecimals(tUsd - bUsd),
    };
  });

  const baseMap = new Map<
    string,
    {
      nombre: string;
      categoria: MarketCategoryStop;
      qty: number;
      usd: number;
    }
  >();

  for (const item of baseList.items || []) {
    const key = normalizeMarketItemNameKey(item.nombre);
    if (!key) continue;
    const qty = Math.max(0.01, Number(item.cantidad) || 1);
    const subNominal = calcularSubtotalItemMercado(item) || 0;
    const subUsd =
      baseList.moneda === 'USD' || baseList.moneda === 'USDT'
        ? subNominal
        : roundTwoDecimals(calcularEquivalenteUsd(subNominal, 'VES', baseRate));
    const prev = baseMap.get(key);
    if (prev) {
      prev.qty = roundTwoDecimals(prev.qty + qty);
      prev.usd = roundTwoDecimals(prev.usd + subUsd);
    } else {
      baseMap.set(key, {
        nombre: item.nombre.trim(),
        categoria: item.categoria || 'Supermercado/Víveres',
        qty,
        usd: subUsd,
      });
    }
  }

  const targetMap = new Map<
    string,
    {
      nombre: string;
      categoria: MarketCategoryStop;
      qty: number;
      usd: number;
    }
  >();

  for (const item of targetList.items || []) {
    const key = normalizeMarketItemNameKey(item.nombre);
    if (!key) continue;
    const qty = Math.max(0.01, Number(item.cantidad) || 1);
    const subNominal = calcularSubtotalItemMercado(item) || 0;
    const subUsd =
      targetList.moneda === 'USD' || targetList.moneda === 'USDT'
        ? subNominal
        : roundTwoDecimals(calcularEquivalenteUsd(subNominal, 'VES', targetRate));
    const prev = targetMap.get(key);
    if (prev) {
      prev.qty = roundTwoDecimals(prev.qty + qty);
      prev.usd = roundTwoDecimals(prev.usd + subUsd);
    } else {
      targetMap.set(key, {
        nombre: item.nombre.trim(),
        categoria: item.categoria || 'Supermercado/Víveres',
        qty,
        usd: subUsd,
      });
    }
  }

  const commonItems: MarketListComparisonItemDiff[] = [];
  const onlyInTargetItems: MarketListComparisonItemDiff[] = [];
  const onlyInBaseItems: MarketListComparisonItemDiff[] = [];

  const allKeys = new Set<string>([...baseMap.keys(), ...targetMap.keys()]);
  for (const key of allKeys) {
    const bItem = baseMap.get(key);
    const tItem = targetMap.get(key);
    if (bItem && tItem) {
      commonItems.push({
        normalizedKey: key,
        nombre: tItem.nombre || bItem.nombre,
        categoria: tItem.categoria || bItem.categoria,
        status: 'both',
        baseQuantity: bItem.qty,
        targetQuantity: tItem.qty,
        diffQuantity: roundTwoDecimals(tItem.qty - bItem.qty),
        baseSubtotalUsd: bItem.usd,
        targetSubtotalUsd: tItem.usd,
        diffSubtotalUsd: roundTwoDecimals(tItem.usd - bItem.usd),
        hasPriceData: bItem.usd > 0 || tItem.usd > 0,
      });
    } else if (tItem && !bItem) {
      onlyInTargetItems.push({
        normalizedKey: key,
        nombre: tItem.nombre,
        categoria: tItem.categoria,
        status: 'only_target',
        baseQuantity: 0,
        targetQuantity: tItem.qty,
        diffQuantity: tItem.qty,
        baseSubtotalUsd: 0,
        targetSubtotalUsd: tItem.usd,
        diffSubtotalUsd: tItem.usd,
        hasPriceData: tItem.usd > 0,
      });
    } else if (bItem && !tItem) {
      onlyInBaseItems.push({
        normalizedKey: key,
        nombre: bItem.nombre,
        categoria: bItem.categoria,
        status: 'only_base',
        baseQuantity: bItem.qty,
        targetQuantity: 0,
        diffQuantity: -bItem.qty,
        baseSubtotalUsd: bItem.usd,
        targetSubtotalUsd: 0,
        diffSubtotalUsd: -bItem.usd,
        hasPriceData: bItem.usd > 0,
      });
    }
  }

  const pctStr =
    percentageChange !== null
      ? ` (${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(1)}%)`
      : '';

  let summaryText = '';
  if (trend === 'increase') {
    summaryText = `"${targetList.nombre}" (${targetMonthLabel}) costó +$${absDifferenceUsd.toFixed(2)}${pctStr} más que "${baseList.nombre}" (${baseMonthLabel}). Comparten ${commonItems.length} producto(s) en común, con ${onlyInTargetItems.length} producto(s) nuevo(s) en ${targetList.nombre}.`;
  } else if (trend === 'decrease') {
    summaryText = `"${targetList.nombre}" (${targetMonthLabel}) costó -$${absDifferenceUsd.toFixed(2)}${pctStr} menos que "${baseList.nombre}" (${baseMonthLabel}). Comparten ${commonItems.length} producto(s) en común y dejaste de incluir ${onlyInBaseItems.length} producto(s) de la lista anterior.`;
  } else {
    summaryText = `"${targetList.nombre}" (${targetMonthLabel}) y "${baseList.nombre}" (${baseMonthLabel}) tienen el mismo costo total ($${targetTotalUsd.toFixed(2)}) y comparten ${commonItems.length} producto(s) en común.`;
  }

  return {
    baseList,
    targetList,
    baseMonthLabel,
    targetMonthLabel,
    baseTotalUsd,
    targetTotalUsd,
    differenceUsd,
    absDifferenceUsd,
    percentageChange,
    trend,
    baseItemsCount,
    targetItemsCount,
    differenceItemsCount,
    summaryText,
    stopComparisons,
    commonItems,
    onlyInTargetItems,
    onlyInBaseItems,
  };
}


