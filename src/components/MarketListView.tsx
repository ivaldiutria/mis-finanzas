import React, { useMemo, useState } from 'react';
import {
  Apple,
  Beef,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Circle,
  Copy,
  DollarSign,
  Download,
  Edit2,
  FileText,
  FolderOpen,
  Layers,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Sandwich,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Unlock,
  Wallet,
  X,
} from 'lucide-react';
import {
  AppDataSchema,
  CurrencyCode,
  InstallmentFrequency,
  MarketCategoryStop,
  MarketItem,
  MarketList,
} from '../types/finance';
import {
  CloseMarketListInput,
  CreateMarketListInput,
  DuplicateMarketListInput,
  MARKET_STOPS,
  MONTH_NAMES_ES,
  alternarItemMercadoEnAppData,
  alternarTodosLosItemsEnAppData,
  calcularColumnasMensualesMercado,
  calcularComparativaPresupuestoLista,
  calcularResumenMercado,
  calcularSubtotalItemMercado,
  cerrarListaMercadoEnAppData,
  compararListasMercadoEntreSi,
  compararMesesMercado,
  crearListaMercado,
  duplicarListaMercadoEnAppData,
  eliminarItemDeListaEnAppData,
  eliminarListaMercadoEnAppData,
  reabrirListaMercadoEnAppData,
  registrarMesHistoricoMercadoEnAppData,
} from '../utils/marketController';
import { StorageService } from '../utils/storage';
import { formatearMonto } from '../services/bcvApi';
import { calcularResumenBilleteras, obtenerFechaLocalIso } from '../utils/calculations';

interface MarketListViewProps {
  data: AppDataSchema;
  activeRate: number | null;
  onUpdateData: (updater: (prev: AppDataSchema) => AppDataSchema) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function addDaysToIsoDate(dateStr: string, daysToAdd: number): string {
  const parts = (dateStr || '').split('-').map(Number);
  const dObj = new Date(
    parts[0] || new Date().getFullYear(),
    (parts[1] || 1) - 1,
    parts[2] || 1,
    12,
    0,
    0
  );
  dObj.setDate(dObj.getDate() + daysToAdd);
  return `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(
    dObj.getDate()
  ).padStart(2, '0')}`;
}

export const MarketListView: React.FC<MarketListViewProps> = ({
  data,
  activeRate,
  onUpdateData,
  showToast,
}) => {
  const locale = data.settings.numberFormatLocale || 'es-VE';
  const todayStr = obtenerFechaLocalIso();

  const marketLists = data.marketLists || [];
  const activeWallets = data.wallets.filter(
    (w) => w.active !== false && !w.isThirdPartyExpenseAccount
  );

  const walletSummaries = useMemo(
    () => calcularResumenBilleteras(data),
    [data]
  );

  const summary = useMemo(
    () => calcularResumenMercado(marketLists),
    [marketLists]
  );

  // Lista seleccionada actualmente para visualización o edición
  const [selectedListId, setSelectedListId] = useState<string>(() => {
    const openFirst = marketLists.find((l) => l.estado === 'abierta');
    return openFirst ? openFirst.id : marketLists[0]?.id || '';
  });

  const selectedList = useMemo(
    () => marketLists.find((l) => l.id === selectedListId) || marketLists[0] || null,
    [marketLists, selectedListId]
  );

  // Filtro de ítems dentro de la lista (Todos, Por comprar, Comprados)
  const [itemFilter, setItemFilter] = useState<'all' | 'pending' | 'bought'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Estado de categorías contraídas/ocultas (persiste en localStorage)
  const [collapsedStops, setCollapsedStops] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('finanzas_market_collapsed_stops');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleStopCollapse = (stopId: MarketCategoryStop) => {
    setCollapsedStops((prev) => {
      const next = { ...prev, [stopId]: !prev[stopId] };
      try {
        localStorage.setItem('finanzas_market_collapsed_stops', JSON.stringify(next));
      } catch {
        // Ignorar errores de almacenamiento
      }
      return next;
    });
  };

  const handleToggleAllStopsCollapse = (collapseAll: boolean) => {
    const next: Record<string, boolean> = {};
    if (collapseAll) {
      for (const st of MARKET_STOPS) {
        next[st.id] = true;
      }
    }
    setCollapsedStops(next);
    try {
      localStorage.setItem('finanzas_market_collapsed_stops', JSON.stringify(next));
    } catch {
      // Ignorar errores de almacenamiento
    }
  };

  // Formulario rápido para añadir ítem (con cantidad y montoUnitario opcionales)
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemStop, setQuickItemStop] = useState<MarketCategoryStop>('Supermercado/Víveres');
  const [quickItemQuantity, setQuickItemQuantity] = useState('');
  const [quickItemUnitPrice, setQuickItemUnitPrice] = useState('');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingList, setEditingList] = useState<MarketList | null>(null);
  const [editingItem, setEditingItem] = useState<MarketItem | null>(null);
  const [showCloseModal, setShowCloseModal] = useState<MarketList | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<MarketList | null>(null);
  const [deletingList, setDeletingList] = useState<MarketList | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDocMode, setPrintDocMode] = useState<'invoice' | 'checklist'>('checklist');
  const [invoiceItemsFilter, setInvoiceItemsFilter] = useState<'all' | 'bought'>('all');
  const [printFilterMode, setPrintFilterMode] = useState<'all' | 'pending'>('all');
  const [printIncludePrices, setPrintIncludePrices] = useState(true);

  // Formulario de Crear Lista
  const [newListName, setNewListName] = useState('Mercado Quincenal');
  const [newListBudget, setNewListBudget] = useState('80');
  const [newListCurrency, setNewListCurrency] = useState<CurrencyCode>('USD');
  const [newListRate, setNewListRate] = useState(
    activeRate && activeRate > 0 ? String(activeRate) : '450'
  );
  const [newListDate, setNewListDate] = useState(todayStr);
  const [newListNotes, setNewListNotes] = useState('');

  // Formulario de Editar Lista Maestra
  const [editListName, setEditListName] = useState('');
  const [editListBudget, setEditListBudget] = useState('');
  const [editListCurrency, setEditListCurrency] = useState<CurrencyCode>('USD');
  const [editListRate, setEditListRate] = useState(
    activeRate && activeRate > 0 ? String(activeRate) : '450'
  );
  const [editListDate, setEditListDate] = useState(todayStr);

  // Formulario de Editar Ítem Individual
  const [editItemName, setEditItemName] = useState('');
  const [editItemStop, setEditItemStop] = useState<MarketCategoryStop>('Supermercado/Víveres');
  const [editItemQuantity, setEditItemQuantity] = useState('');
  const [editItemUnitPrice, setEditItemUnitPrice] = useState('');

  // Formulario de Cerrar Lista
  const [closePaymentMode, setClosePaymentMode] = useState<'contado' | 'cashea'>('contado');
  const [closeAmount, setCloseAmount] = useState('');
  const [closePaidTodayAmount, setClosePaidTodayAmount] = useState('');
  const [closeCasheaInstallments, setCloseCasheaInstallments] = useState<number>(1);
  const [closeCasheaFrequency, setCloseCasheaFrequency] = useState<InstallmentFrequency>('biweekly');
  const [closeCasheaFirstDueDate, setCloseCasheaFirstDueDate] = useState<string>(() =>
    addDaysToIsoDate(todayStr, 14)
  );
  const [closeCasheaPlatform, setCloseCasheaPlatform] = useState<string>('Cashea');
  const [closeUsdHelperTotal, setCloseUsdHelperTotal] = useState<string>('');
  const [closeUsdHelperPaid, setCloseUsdHelperPaid] = useState<string>('');
  const [closeCurrency, setCloseCurrency] = useState<CurrencyCode>('USD');
  const [closeWalletId, setCloseWalletId] = useState(
    activeWallets[0]?.id || 'wallet_bank_ves'
  );
  const [closeRate, setCloseRate] = useState(
    activeRate && activeRate > 0 ? String(activeRate) : '450'
  );
  const [closeDate, setCloseDate] = useState(todayStr);
  const [closeNotes, setCloseNotes] = useState('');
  const [closeFeeType, setCloseFeeType] = useState<'none' | 'pago_movil' | 'transferencia'>('none');
  const [closeTransferFeeMode, setCloseTransferFeeMode] = useState<'fixed_ves' | 'percent'>('fixed_ves');
  const [closeFeeValueStr, setCloseFeeValueStr] = useState<string>('0.3');

  // Formulario de Duplicar Lista
  const [dupName, setDupName] = useState('');
  const [dupBudget, setDupBudget] = useState('80');
  const [dupCurrency, setDupCurrency] = useState<CurrencyCode>('USD');
  const [dupRate, setDupRate] = useState(
    activeRate && activeRate > 0 ? String(activeRate) : '450'
  );
  const [dupDate, setDupDate] = useState(todayStr);

  // Registro Mensual Tipo Excel y Comparador de Meses
  const monthlyColumns = useMemo(
    () => calcularColumnasMensualesMercado(marketLists, activeRate),
    [marketLists, activeRate]
  );

  const [showExcelStopRows, setShowExcelStopRows] = useState(false);
  const [showQuickMonthForm, setShowQuickMonthForm] = useState(false);
  const [quickMonthYear, setQuickMonthYear] = useState<string>(() =>
    String(new Date().getFullYear())
  );
  const [quickMonthNum, setQuickMonthNum] = useState<string>(() =>
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [quickMonthAmountUsd, setQuickMonthAmountUsd] = useState<string>('');
  const [quickMonthLabel, setQuickMonthLabel] = useState<string>('');

  // Selección de Mes Base (Columna A) y Mes a Comparar (Columna B)
  const [compareBaseKey, setCompareBaseKey] = useState<string>('');
  const [compareTargetKey, setCompareTargetKey] = useState<string>('');

  const effectiveBaseKey = useMemo(() => {
    if (compareBaseKey && monthlyColumns.some((c) => c.monthKey === compareBaseKey)) {
      return compareBaseKey;
    }
    if (monthlyColumns.length >= 2) {
      return monthlyColumns[monthlyColumns.length - 2].monthKey;
    }
    return monthlyColumns[0]?.monthKey || '';
  }, [compareBaseKey, monthlyColumns]);

  const effectiveTargetKey = useMemo(() => {
    if (compareTargetKey && monthlyColumns.some((c) => c.monthKey === compareTargetKey)) {
      return compareTargetKey;
    }
    if (monthlyColumns.length >= 1) {
      return monthlyColumns[monthlyColumns.length - 1].monthKey;
    }
    return '';
  }, [compareTargetKey, monthlyColumns]);

  const activeMonthComparison = useMemo(() => {
    const baseCol = monthlyColumns.find((c) => c.monthKey === effectiveBaseKey);
    const targetCol = monthlyColumns.find((c) => c.monthKey === effectiveTargetKey);
    if (!baseCol || !targetCol) return null;
    return compararMesesMercado(baseCol, targetCol);
  }, [monthlyColumns, effectiveBaseKey, effectiveTargetKey]);

  // Comparador individual de Listas entre diferentes meses (Lista A vs. Lista B)
  const [showListComparator, setShowListComparator] = useState<boolean>(true);
  const [compareListBaseId, setCompareListBaseId] = useState<string>('');
  const [compareListTargetId, setCompareListTargetId] = useState<string>('');
  const [listCompareItemTab, setListCompareItemTab] = useState<
    'common' | 'only_target' | 'only_base'
  >('common');

  const sortedListsChronological = useMemo(
    () =>
      [...marketLists].sort((a, b) =>
        (a.fecha || '').localeCompare(b.fecha || '')
      ),
    [marketLists]
  );

  const effectiveListBaseId = useMemo(() => {
    if (
      compareListBaseId &&
      sortedListsChronological.some((l) => l.id === compareListBaseId)
    ) {
      return compareListBaseId;
    }
    if (sortedListsChronological.length >= 2) {
      return sortedListsChronological[sortedListsChronological.length - 2].id;
    }
    return sortedListsChronological[0]?.id || '';
  }, [compareListBaseId, sortedListsChronological]);

  const effectiveListTargetId = useMemo(() => {
    if (
      compareListTargetId &&
      sortedListsChronological.some((l) => l.id === compareListTargetId)
    ) {
      return compareListTargetId;
    }
    if (sortedListsChronological.length >= 1) {
      return sortedListsChronological[sortedListsChronological.length - 1].id;
    }
    return '';
  }, [compareListTargetId, sortedListsChronological]);

  const activeListComparison = useMemo(() => {
    const baseL = marketLists.find((l) => l.id === effectiveListBaseId);
    const targetL = marketLists.find((l) => l.id === effectiveListTargetId);
    if (!baseL || !targetL) return null;
    return compararListasMercadoEntreSi(baseL, targetL, activeRate || 450);
  }, [marketLists, effectiveListBaseId, effectiveListTargetId, activeRate]);

  const handleQuickRegisterHistoricalMonth = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = Number(quickMonthAmountUsd);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast('Ingresa un monto en dólares mayor a 0 (ej. 170 o 200).', 'error');
        return;
      }
      const monthKey = `${quickMonthYear}-${quickMonthNum.padStart(2, '0')}`;
      const mIdx = Math.min(12, Math.max(1, Number(quickMonthNum) || 1)) - 1;
      const monthName = MONTH_NAMES_ES[mIdx] || 'Mes';

      onUpdateData((prev) =>
        registrarMesHistoricoMercadoEnAppData(prev, {
          monthKey,
          nombre: quickMonthLabel.trim() || `Mercado ${monthName} ${quickMonthYear}`,
          montoTotalUsd: amount,
        })
      );

      setQuickMonthAmountUsd('');
      setQuickMonthLabel('');
      setShowQuickMonthForm(false);
      showToast(
        `Columna de ${monthName} ${quickMonthYear} ($${amount.toFixed(2)}) añadida al registro mensual.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al registrar el mes en la tabla.',
        'error'
      );
    }
  };

  // Handlers
  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const budgetNum = Number(newListBudget) || 0;
      const rateNum =
        newListCurrency === 'VES' ? Number(newListRate) || activeRate : null;

      const input: CreateMarketListInput = {
        nombre: newListName.trim() || 'Lista de Mercado',
        presupuestoEstimado: budgetNum,
        moneda: newListCurrency,
        exchangeRate: rateNum,
        fecha: newListDate,
        notas: newListNotes,
        initialItems: [
          { nombre: 'Tomates, cebollas y papas', categoria: 'Feria/Hortalizas' },
          { nombre: 'Pechuga de pollo o carne molida', categoria: 'Carnicería' },
          { nombre: 'Queso blanco duro / paisa', categoria: 'Charcutería' },
          { nombre: 'Arroz, pasta, café y harina PAN', categoria: 'Supermercado/Víveres' },
          { nombre: 'Jabón lavaplatos y papel higiénico', categoria: 'Limpieza/Aseo' },
        ],
      };

      const { marketList, pendingTransaction } = crearListaMercado(input);

      onUpdateData((prev) => ({
        ...prev,
        marketLists: [marketList, ...(prev.marketLists || [])],
        transactions: [pendingTransaction, ...prev.transactions],
      }));

      setSelectedListId(marketList.id);
      setShowCreateModal(false);
      showToast(
        `Lista "${marketList.nombre}" creada. Su presupuesto estimado resta al Saldo Proyectado.`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al crear la lista', 'error');
    }
  };

  const handleOpenCloseModal = (list: MarketList) => {
    setShowCloseModal(list);
    const comp = calcularComparativaPresupuestoLista(list, activeRate);
    const initialTotal =
      comp.sumaItemsCompradosDetallados > 0
        ? comp.sumaItemsCompradosDetallados
        : comp.sumaItemsDetallados > 0
          ? comp.sumaItemsDetallados
          : list.presupuestoEstimado || 0;
    setClosePaymentMode('contado');
    setCloseAmount(initialTotal > 0 ? String(initialTotal) : '');
    setClosePaidTodayAmount('');
    setCloseCasheaInstallments(1);
    setCloseCasheaFrequency('biweekly');
    setCloseCasheaFirstDueDate(addDaysToIsoDate(todayStr, 14));
    setCloseCasheaPlatform('Cashea');
    setCloseUsdHelperTotal('');
    setCloseUsdHelperPaid('');
    setCloseCurrency(list.moneda);
    setCloseDate(list.fecha || todayStr);
    setCloseRate(
      activeRate && activeRate > 0
        ? String(activeRate)
        : list.exchangeRate
          ? String(list.exchangeRate)
          : '450'
    );
    const defaultW = activeWallets[0]?.id || 'wallet_bank_ves';
    setCloseWalletId(defaultW);
    setCloseFeeType('none');
    setCloseNotes('');
  };

  const selectedCloseWallet = activeWallets.find((w) => w.id === closeWalletId);
  const parsedCloseNominal = Math.max(0, Number(closeAmount) || 0);
  const parsedClosePaidTodayNominal =
    closePaymentMode === 'cashea'
      ? Math.max(0, Number(closePaidTodayAmount) || 0)
      : parsedCloseNominal;
  const parsedCloseRateNum = Math.max(
    1,
    Number(closeRate) || activeRate || 450
  );
  const parsedCloseTotalUsd =
    closeCurrency === 'VES'
      ? Math.round(((parsedCloseNominal / parsedCloseRateNum) + Number.EPSILON) * 100) / 100
      : Math.round((parsedCloseNominal + Number.EPSILON) * 100) / 100;
  const parsedClosePaidTodayUsd =
    closeCurrency === 'VES'
      ? Math.round(((parsedClosePaidTodayNominal / parsedCloseRateNum) + Number.EPSILON) * 100) / 100
      : Math.round((parsedClosePaidTodayNominal + Number.EPSILON) * 100) / 100;
  const parsedCasheaFinancedUsd = Math.max(
    0,
    Math.round(((parsedCloseTotalUsd - parsedClosePaidTodayUsd) + Number.EPSILON) * 100) / 100
  );
  const parsedCasheaFinancedNominal =
    closeCurrency === 'VES'
      ? Math.round(((parsedCasheaFinancedUsd * parsedCloseRateNum) + Number.EPSILON) * 100) / 100
      : parsedCasheaFinancedUsd;
  const parsedCasheaPerInstallmentUsd =
    closeCasheaInstallments > 0
      ? Math.round(((parsedCasheaFinancedUsd / closeCasheaInstallments) + Number.EPSILON) * 100) / 100
      : parsedCasheaFinancedUsd;

  const parsedCloseFeeVal = Math.max(0, Number(closeFeeValueStr.replace(',', '.')) || 0);
  const calculatedCloseFee = (() => {
    const baseForFee =
      closePaymentMode === 'cashea' ? parsedClosePaidTodayNominal : parsedCloseNominal;
    if (closeFeeType === 'none' || baseForFee <= 0 || parsedCloseFeeVal <= 0) return 0;
    if (closeFeeType === 'pago_movil') {
      const raw = (baseForFee * parsedCloseFeeVal) / 100;
      const finalFee = closeCurrency === 'VES' ? Math.max(14, raw) : raw;
      return Math.round(finalFee * 100) / 100;
    }
    if (closeCurrency === 'VES' && closeTransferFeeMode === 'fixed_ves') {
      return Math.round(parsedCloseFeeVal * 100) / 100;
    }
    return Math.round(((baseForFee * parsedCloseFeeVal) / 100) * 100) / 100;
  })();

  const handleConfirmClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCloseModal) return;
    try {
      const totalReal = Number(closeAmount);
      if (!Number.isFinite(totalReal) || totalReal <= 0) {
        showToast('Ingresa el monto total de la factura de este mercado.', 'error');
        return;
      }

      const rateNum =
        closeCurrency === 'VES' ? Number(closeRate) || activeRate : null;

      if (closePaymentMode === 'cashea') {
        const paidToday = Number(closePaidTodayAmount);
        if (!Number.isFinite(paidToday) || paidToday < 0) {
          showToast('Ingresa cuánto pagaste hoy (Inicial + Contado).', 'error');
          return;
        }
        if (paidToday >= totalReal) {
          showToast(
            'El monto pagado hoy debe ser menor al total del mercado para dejar saldo financiado en Cashea.',
            'error'
          );
          return;
        }
      }

      const input: CloseMarketListInput = {
        listId: showCloseModal.id,
        totalPagadoReal: totalReal,
        moneda: closeCurrency,
        exchangeRate: rateNum,
        walletId: closeWalletId,
        fechaPago: closeDate,
        notas: closeNotes,
        interbankFeeType: closeFeeType,
        interbankFeeAmount: closeFeeType !== 'none' ? calculatedCloseFee : 0,
        paymentMode: closePaymentMode,
        paidTodayAmount:
          closePaymentMode === 'cashea'
            ? Number(closePaidTodayAmount) || 0
            : totalReal,
        casheaInstallmentsCount:
          closePaymentMode === 'cashea' ? closeCasheaInstallments : undefined,
        casheaFrequency:
          closePaymentMode === 'cashea' ? closeCasheaFrequency : undefined,
        casheaFirstDueDate:
          closePaymentMode === 'cashea' ? closeCasheaFirstDueDate : undefined,
        casheaStoreOrPlatform:
          closePaymentMode === 'cashea'
            ? closeCasheaPlatform.trim() || 'Cashea'
            : undefined,
      };

      onUpdateData((prev) => cerrarListaMercadoEnAppData(prev, input));
      setShowCloseModal(null);
      setPrintDocMode('invoice');
      setInvoiceItemsFilter('all');
      if (closePaymentMode === 'cashea') {
        showToast(
          `Mercado cerrado con ${closeCasheaPlatform.trim() || 'Cashea'}: se descontaron $${parsedClosePaidTodayUsd.toFixed(
            2
          )} hoy y quedaron $${parsedCasheaFinancedUsd.toFixed(2)} en ${closeCasheaInstallments} cuota(s). ¡Ya puedes imprimir tu Factura de Mercado!`,
          'success'
        );
      } else {
        showToast(
          `Mercado cerrado exitosamente (${closeCurrency} ${totalReal.toFixed(
            2
          )}). ¡Tu Factura de Mercado ya está lista para imprimir o descargar!`,
          'success'
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al cerrar la lista de mercado',
        'error'
      );
    }
  };

  const handleReopen = (list: MarketList) => {
    const wasCashea = list.paymentMode === 'cashea' && Boolean(list.linkedCreditPurchaseId);
    onUpdateData((prev) => reabrirListaMercadoEnAppData(prev, list.id));
    showToast(
      wasCashea
        ? `Lista "${list.nombre}" reabierta. Se revirtió el pago inicial y se eliminaron las cuotas de Cashea asociadas.`
        : `Lista "${list.nombre}" reabierta. El egreso se canceló y el presupuesto vuelve a restar al Saldo Proyectado.`,
      'info'
    );
  };

  const handleOpenDuplicateModal = (list: MarketList) => {
    setShowDuplicateModal(list);
    setDupName(`${list.nombre} (Copia)`);
    setDupBudget(String(list.presupuestoEstimado || 80));
    setDupCurrency(list.moneda);
    setDupDate(todayStr);
    setDupRate(
      activeRate && activeRate > 0
        ? String(activeRate)
        : list.exchangeRate
          ? String(list.exchangeRate)
          : '450'
    );
  };

  const handleConfirmDuplicate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDuplicateModal) return;
    try {
      const budgetNum = Number(dupBudget) || 0;
      const rateNum =
        dupCurrency === 'VES' ? Number(dupRate) || activeRate : null;

      const input: DuplicateMarketListInput = {
        sourceListId: showDuplicateModal.id,
        nuevoNombre: dupName.trim() || `${showDuplicateModal.nombre} (Copia)`,
        presupuestoEstimado: budgetNum,
        moneda: dupCurrency,
        exchangeRate: rateNum,
        fecha: dupDate,
      };

      onUpdateData((prev) => duplicarListaMercadoEnAppData(prev, input));
      setShowDuplicateModal(null);
      showToast(
        `Lista duplicada con todos los artículos listos para volver a comprar.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al duplicar la lista',
        'error'
      );
    }
  };

  const handleOpenEditListModal = (list: MarketList) => {
    setEditingList(list);
    setEditListName(list.nombre);
    setEditListBudget(String(list.presupuestoEstimado ?? 0));
    setEditListCurrency(list.moneda);
    setEditListDate(list.fecha || todayStr);
    setEditListRate(
      list.exchangeRate && list.exchangeRate > 0
        ? String(list.exchangeRate)
        : activeRate && activeRate > 0
          ? String(activeRate)
          : '450'
    );
  };

  const handleConfirmEditList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList) return;
    try {
      const cleanName = editListName.trim();
      if (!cleanName) {
        showToast('Ingresa un nombre válido para la lista de mercado.', 'error');
        return;
      }
      const parsedBudget = Number(editListBudget);
      if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
        showToast('Ingresa un Monto Global Estimado válido (0 o mayor).', 'error');
        return;
      }
      const rateNum =
        editListCurrency === 'VES' ? Number(editListRate) || activeRate : null;
      const nextDate =
        editListDate && /^\d{4}-\d{2}-\d{2}$/.test(editListDate)
          ? editListDate
          : editingList.fecha;

      onUpdateData((prev) =>
        StorageService.updateMarketList(
          editingList.id,
          {
            nombre: cleanName,
            presupuestoEstimado: parsedBudget,
            moneda: editListCurrency,
            exchangeRate: rateNum,
            fecha: nextDate,
          },
          prev
        )
      );

      setEditingList(null);
      showToast(
        `Lista "${cleanName}" actualizada (${formatDateShort(nextDate)}). Estadísticas y columna mensual sincronizadas.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al actualizar la lista',
        'error'
      );
    }
  };

  const handleToggleItem = (itemId: string) => {
    if (!selectedList) return;
    // Vibración háptica en dispositivos móviles táctiles si está soportado
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(30);
      } catch (e) {
        // Ignorar si no está permitido
      }
    }
    onUpdateData((prev) =>
      alternarItemMercadoEnAppData(prev, selectedList.id, itemId)
    );
  };

  const handleQuickAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !quickItemName.trim()) return;

    const rawCant = quickItemQuantity.trim() !== '' ? Number(quickItemQuantity) : null;
    const rawMonto = quickItemUnitPrice.trim() !== '' ? Number(quickItemUnitPrice) : null;

    const validCant =
      rawCant !== null && Number.isFinite(rawCant) && rawCant > 0 ? rawCant : null;
    const validMonto =
      rawMonto !== null && Number.isFinite(rawMonto) && rawMonto > 0 ? rawMonto : null;

    onUpdateData((prev) =>
      StorageService.addMarketItem(
        selectedList.id,
        {
          nombre: quickItemName.trim(),
          categoria: quickItemStop,
          cantidad: validCant,
          montoUnitario: validMonto,
        },
        prev
      )
    );
    setQuickItemName('');
    setQuickItemQuantity('');
    setQuickItemUnitPrice('');
  };

  const handleOpenEditItemModal = (item: MarketItem) => {
    setEditingItem(item);
    setEditItemName(item.nombre);
    setEditItemStop(item.categoria);
    setEditItemQuantity(
      typeof item.cantidad === 'number' && item.cantidad > 0
        ? String(item.cantidad)
        : ''
    );
    setEditItemUnitPrice(
      typeof item.montoUnitario === 'number' && item.montoUnitario > 0
        ? String(item.montoUnitario)
        : ''
    );
  };

  const handleConfirmEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedList || !editingItem) return;
    try {
      const cleanName = editItemName.trim();
      if (!cleanName) {
        showToast('El nombre del artículo no puede estar vacío.', 'error');
        return;
      }

      const rawCant = editItemQuantity.trim() !== '' ? Number(editItemQuantity) : null;
      const rawMonto = editItemUnitPrice.trim() !== '' ? Number(editItemUnitPrice) : null;

      const validCant =
        rawCant !== null && Number.isFinite(rawCant) && rawCant > 0 ? rawCant : null;
      const validMonto =
        rawMonto !== null && Number.isFinite(rawMonto) && rawMonto > 0 ? rawMonto : null;

      onUpdateData((prev) =>
        StorageService.updateMarketItem(
          selectedList.id,
          editingItem.id,
          {
            nombre: cleanName,
            categoria: editItemStop,
            cantidad: validCant,
            montoUnitario: validMonto,
          },
          prev
        )
      );

      setEditingItem(null);
      showToast(`Artículo "${cleanName}" actualizado.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Error al actualizar el artículo',
        'error'
      );
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (!selectedList) return;
    onUpdateData((prev) =>
      eliminarItemDeListaEnAppData(prev, selectedList.id, itemId)
    );
  };

  const handleToggleAll = (markBought: boolean) => {
    if (!selectedList) return;
    onUpdateData((prev) =>
      alternarTodosLosItemsEnAppData(prev, selectedList.id, markBought)
    );
  };

  const handleDeleteList = (list: MarketList) => {
    onUpdateData((prev) => eliminarListaMercadoEnAppData(prev, list.id));
    setDeletingList(null);
    showToast(`Lista "${list.nombre}" eliminada.`, 'info');
  };

  const handlePrint = () => {
    if (!selectedList) {
      showToast('Selecciona o crea una lista de mercado para generar su reporte.', 'info');
      return;
    }
    if (selectedList.estado === 'cerrada') {
      setPrintDocMode('invoice');
      setInvoiceItemsFilter('all');
    } else {
      setPrintDocMode('checklist');
    }
    setShowPrintModal(true);
  };

  const handleOpenInvoiceForList = (list: MarketList) => {
    setSelectedListId(list.id);
    setPrintDocMode('invoice');
    setInvoiceItemsFilter('all');
    setShowPrintModal(true);
  };

  const handleTriggerBrowserPrint = () => {
    window.print();
  };

  const getInvoiceFolio = (list: MarketList): string => {
    const cleanDate = (list.fecha || '').replace(/-/g, '').slice(0, 6) || '202610';
    const shortHash = (list.id || 'MKT').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    return `FAC-MKT-${cleanDate}-${shortHash}`;
  };

  const handleDownloadInvoiceImage = (targetList?: MarketList) => {
    const list = targetList || selectedList;
    if (!list) return;

    try {
      const itemsToDraw =
        invoiceItemsFilter === 'bought' && list.items.some((i) => i.comprado)
          ? list.items.filter((i) => i.comprado)
          : list.items;

      const folio = getInvoiceFolio(list);
      const [yStr, mStr] = (list.fecha || '').split('-');
      const mIdx = Math.max(0, Math.min(11, (Number(mStr) || 1) - 1));
      const monthLabel = `${MONTH_NAMES_ES[mIdx]} ${yStr || new Date().getFullYear()}`;
      const walletObj = data.wallets.find((w) => w.id === list.walletId);
      const walletName = walletObj ? walletObj.name : 'Billetera Principal';

      const paymentCur = list.paymentCurrency || list.moneda || 'USD';
      const paymentRate =
        list.paymentExchangeRate && list.paymentExchangeRate > 0
          ? list.paymentExchangeRate
          : list.exchangeRate && list.exchangeRate > 0
            ? list.exchangeRate
            : activeRate && activeRate > 0
              ? activeRate
              : 450;

      const totalPaidUsd =
        list.estado === 'cerrada'
          ? list.totalPagadoRealUsd || 0
          : list.presupuestoEstimadoUsd || 0;
      const totalPaidNominal =
        list.estado === 'cerrada'
          ? list.totalPagadoReal || totalPaidUsd
          : list.presupuestoEstimado || totalPaidUsd;
      const totalPaidVes =
        paymentCur === 'VES' ? totalPaidNominal : totalPaidUsd * paymentRate;

      const isCashea =
        list.paymentMode === 'cashea' &&
        typeof list.casheaFinancedUsd === 'number' &&
        list.casheaFinancedUsd > 0;

      const scale = 2;
      const width = 760;
      const rowHeight = 32;
      const baseHeight = 520 + (isCashea ? 85 : 0);
      const totalHeight = Math.max(660, baseHeight + itemsToDraw.length * rowHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // Fondo blanco editorial
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, totalHeight);

      // Cinta superior esmeralda
      ctx.fillStyle = '#059669';
      ctx.fillRect(0, 0, width, 12);

      // Encabezado
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('FACTURA / COMPROBANTE DE COMPRA DE MERCADO', 40, 42);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(list.nombre.slice(0, 38), 40, 74);

      ctx.fillStyle = '#475569';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(
        `Fecha de Compra: ${formatDateShort(list.fecha)}  ·  Mes Contable: ${monthLabel}  ·  Titular: ${data.settings.userName || 'Mis Finanzas'}`,
        40,
        98
      );
      ctx.fillText(
        `Billetera: ${walletName}  ·  Modalidad: ${
          isCashea
            ? `${list.casheaStoreOrPlatform || 'Cashea'} (${list.casheaInstallmentsCount || 1} cuotas)`
            : 'Pago de Contado'
        }`,
        40,
        118
      );

      // Recuadro Folio a la derecha
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.fillRect(width - 230, 30, 190, 76);
      ctx.strokeRect(width - 230, 30, 190, 76);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(list.estado === 'cerrada' ? '✓ FACTURA PAGADA' : 'EN PROYECCIÓN', width - 52, 52);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(folio, width - 52, 72);
      ctx.fillStyle = '#64748B';
      ctx.font = '11px monospace';
      ctx.fillText(`${itemsToDraw.length} artículo(s)`, width - 52, 92);
      ctx.textAlign = 'left';

      // Línea divisoria
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, 136);
      ctx.lineTo(width - 40, 136);
      ctx.stroke();

      // Cabecera de tabla de ítems
      let y = 162;
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect(40, y - 18, width - 80, 28);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('#', 52, y);
      ctx.fillText('ARTÍCULO / PRODUCTO', 85, y);
      ctx.fillText('PARADA / CATEGORÍA', 350, y);
      ctx.textAlign = 'center';
      ctx.fillText('CANT.', 535, y);
      ctx.textAlign = 'right';
      ctx.fillText('IMPORTE / ESTADO', width - 52, y);
      ctx.textAlign = 'left';

      y += 24;

      itemsToDraw.forEach((it, idx) => {
        if (idx % 2 === 1) {
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(40, y - 18, width - 80, rowHeight);
        }

        const itemSub = calcularSubtotalItemMercado(it);
        const hasCant = typeof it.cantidad === 'number' && it.cantidad > 0;

        ctx.fillStyle = '#64748B';
        ctx.font = '11px monospace';
        ctx.fillText(String(idx + 1).padStart(2, '0'), 52, y);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(it.nombre.slice(0, 36), 85, y);

        ctx.fillStyle = '#475569';
        ctx.font = '11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(it.categoria, 350, y);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#0F172A';
        ctx.font = '11px monospace';
        ctx.fillText(hasCant ? `${it.cantidad}` : '1', 535, y);

        ctx.textAlign = 'right';
        if (itemSub !== null && itemSub > 0) {
          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(formatearMonto(itemSub, list.moneda, locale), width - 52, y);
        } else {
          ctx.fillStyle = '#059669';
          ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillText('✓ Incluido en monto total', width - 52, y);
        }
        ctx.textAlign = 'left';

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, y + 10);
        ctx.lineTo(width - 40, y + 10);
        ctx.stroke();

        y += rowHeight;
      });

      y += 14;

      // Caja de liquidación total
      const boxHeight = isCashea ? 210 : 145;
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.fillRect(40, y, width - 80, boxHeight);
      ctx.strokeRect(40, y, width - 80, boxHeight);

      ctx.fillStyle = '#475569';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Presupuesto Inicial Estimado:', 60, y + 30);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(
        `${formatearMonto(list.presupuestoEstimadoUsd || 0, 'USD', locale)}`,
        width - 60,
        y + 30
      );

      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Tasa de Cambio Aplicada:', 60, y + 54);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0F172A';
      ctx.font = '12px monospace';
      ctx.fillText(`Bs. ${paymentRate.toFixed(2)} / $1 USD`, width - 60, y + 54);

      // Línea separadora de total
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, y + 70);
      ctx.lineTo(width - 60, y + 70);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('MONTO TOTAL FACTURA (USD):', 60, y + 100);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(formatearMonto(totalPaidUsd, 'USD', locale), width - 60, y + 102);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = '12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Equivalente en Bolívares (VES):', 60, y + 126);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(formatearMonto(totalPaidVes, 'VES', locale), width - 60, y + 126);

      if (isCashea) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, y + 142);
        ctx.lineTo(width - 60, y + 142);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = '#B45309';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Pagado el día de la compra (Inicial + Contado):', 60, y + 166);
        ctx.textAlign = 'right';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(
          formatearMonto(list.paidTodayAmountUsd || 0, 'USD', locale),
          width - 60,
          y + 166
        );

        ctx.textAlign = 'left';
        ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(
          `Saldo Financiado en ${list.casheaStoreOrPlatform || 'Cashea'} (${list.casheaInstallmentsCount || 1} cuotas):`,
          60,
          y + 190
        );
        ctx.textAlign = 'right';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(
          formatearMonto(list.casheaFinancedUsd || 0, 'USD', locale),
          width - 60,
          y + 190
        );
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px monospace';
      ctx.fillText(
        `Comprobante generado por Mis Finanzas Personales  ·  ${folio}`,
        width / 2,
        y + boxHeight + 35
      );

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const safeName = list.nombre.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Factura_${safeName}_${list.fecha || 'mercado'}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Factura descargada en formato imagen PNG.', 'success');
    } catch (err) {
      showToast('Error al generar la imagen de la factura.', 'error');
    }
  };

  // Cálculos de la lista seleccionada
  const listItems = selectedList?.items || [];
  const boughtCount = listItems.filter((i) => i.comprado).length;
  const totalItemsCount = listItems.length;
  const progressPct =
    totalItemsCount > 0 ? Math.round((boughtCount / totalItemsCount) * 100) : 0;

  // Comparativa entre Monto Global de la Lista y Suma de los ítems detallados
  const budgetComparison = useMemo(
    () => (selectedList ? calcularComparativaPresupuestoLista(selectedList, activeRate) : null),
    [selectedList, activeRate]
  );

  // Filtrado de ítems
  const filteredItems = useMemo(() => {
    return listItems.filter((item) => {
      if (itemFilter === 'pending' && item.comprado) return false;
      if (itemFilter === 'bought' && !item.comprado) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.nombre.toLowerCase().includes(q) ||
          item.categoria.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [listItems, itemFilter, searchQuery]);

  // Agrupación por Paradas
  const groupedByStop = useMemo(() => {
    const map = new Map<MarketCategoryStop, MarketItem[]>();
    for (const stop of MARKET_STOPS) {
      map.set(stop.id, []);
    }

    for (const item of filteredItems) {
      const arr = map.get(item.categoria) || [];
      arr.push(item);
      map.set(item.categoria, arr);
    }

    return map;
  }, [filteredItems]);

  const getStopIcon = (stop: MarketCategoryStop) => {
    switch (stop) {
      case 'Feria/Hortalizas':
        return <Apple className="w-4 h-4 text-emerald-400" />;
      case 'Carnicería':
        return <Beef className="w-4 h-4 text-rose-400" />;
      case 'Charcutería':
        return <Sandwich className="w-4 h-4 text-amber-400" />;
      case 'Supermercado/Víveres':
        return <ShoppingBag className="w-4 h-4 text-blue-400" />;
      case 'Limpieza/Aseo':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      default:
        return <Tag className="w-4 h-4 text-slate-400" />;
    }
  };

  // Renderizador reutilizable de la Hoja de Reporte de Lista de Mercado (para @media print y Vista Previa)
  const renderMarketReportSheet = () => {
    if (!selectedList || !budgetComparison) {
      return (
        <div className="p-8 text-center text-sm text-slate-600">
          Selecciona una lista de mercado para generar el reporte imprimible.
        </div>
      );
    }

    const isVes = selectedList.moneda === 'VES';
    const rate = budgetComparison.tasaReferencial || 450;
    const printableStops = MARKET_STOPS.map((stop, idx) => {
      const allInStop = selectedList.items.filter((i) => i.categoria === stop.id);
      const visibleInStop =
        printFilterMode === 'pending'
          ? allInStop.filter((i) => !i.comprado)
          : allInStop;

      const stopSubtotal = visibleInStop.reduce((acc, it) => {
        const sub = calcularSubtotalItemMercado(it);
        return acc + (sub !== null ? sub : 0);
      }, 0);

      const stopBoughtCount = allInStop.filter((i) => i.comprado).length;

      return {
        stop,
        indexNumber: String(idx + 1).padStart(2, '0'),
        allCount: allInStop.length,
        boughtCount: stopBoughtCount,
        items: visibleInStop,
        stopSubtotal,
        stopSubtotalUsd: isVes && rate > 0 ? stopSubtotal / rate : stopSubtotal,
      };
    }).filter((group) => group.items.length > 0);

    const pendingCount = totalItemsCount - boughtCount;

    return (
      <article className="printable-report-sheet bg-white text-slate-900 p-6 sm:p-9 rounded-2xl border border-slate-200 space-y-6 shadow-xs">
        {/* 1. ENCABEZADO EDITORIAL DE LA HOJA DE MERCADO */}
        <header className="pb-5 border-b-2 border-slate-900 print-border-strong flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono-tabular font-bold uppercase tracking-widest text-emerald-700 print-text-muted">
              REPORTE DE COMPRAS · LISTA DE MERCADO POR PARADAS
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-slate-900 print-text-strong tracking-tight">
              {selectedList.nombre}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 print-text-muted">
              <span>
                Fecha prevista:{' '}
                <strong className="text-slate-900">{formatDateShort(selectedList.fecha)}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Estado:{' '}
                <strong className="text-slate-900">
                  {selectedList.estado === 'abierta'
                    ? 'Abierta (En Proyección)'
                    : 'Cerrada (Pagada)'}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Titular:{' '}
                <strong className="text-slate-900">
                  {data.settings.userName || 'Mis Finanzas'}
                </strong>
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-left sm:text-right font-mono-tabular text-xs space-y-1 shrink-0">
            <div className="text-slate-600">
              Moneda de lista:{' '}
              <strong className="text-slate-900">
                {isVes ? 'Bolívares (Bs. VES)' : 'Dólares ($ USD)'}
              </strong>
            </div>
            {isVes && (
              <div className="text-emerald-700 font-semibold">
                Tasa referencial: 1 $ = Bs. {rate.toFixed(2)}
              </div>
            )}
            <div className="text-slate-600">
              Progreso en carrito:{' '}
              <strong className="text-slate-900">
                {boughtCount}/{totalItemsCount} comprados ({progressPct}%)
              </strong>
            </div>
          </div>
        </header>

        {/* 2. RESUMEN EJECUTIVO DE PRESUPUESTO (3 TARJETAS) */}
        <section className="print-avoid-break space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Resumen Financiero de la Lista
            </h2>
            <span className="text-[11px] text-slate-500 font-mono-tabular">
              {printFilterMode === 'pending'
                ? `Mostrando solo pendientes (${pendingCount} artículos)`
                : `Mostrando lista completa (${totalItemsCount} artículos)`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print-grid-3">
            {/* Tarjeta 1: Monto Global */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 print-card space-y-1">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Monto Global de la Lista
              </span>
              <div className="text-lg font-bold font-mono-tabular text-slate-900">
                {formatearMonto(budgetComparison.montoGlobalLista, selectedList.moneda, locale)}
              </div>
              {isVes && (
                <div className="text-xs font-mono-tabular font-bold text-emerald-700">
                  ≈ {formatearMonto(budgetComparison.montoGlobalListaUsd, 'USD', locale)}
                </div>
              )}
              <span className="text-[10px] text-slate-500 block pt-0.5">
                Presupuesto maestro estimado
              </span>
            </div>

            {/* Tarjeta 2: Suma de ítems detallados */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 print-card space-y-1">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Suma de Ítems Detallados
              </span>
              <div className="text-lg font-bold font-mono-tabular text-emerald-700">
                {formatearMonto(budgetComparison.sumaItemsDetallados, selectedList.moneda, locale)}
              </div>
              {isVes && (
                <div className="text-xs font-mono-tabular font-bold text-slate-800">
                  ≈ {formatearMonto(budgetComparison.sumaItemsDetalladosUsd, 'USD', locale)}
                </div>
              )}
              <span className="text-[10px] text-slate-500 block pt-0.5">
                {budgetComparison.itemsConPrecioCount} con precio ·{' '}
                {budgetComparison.itemsSinPrecioCount} solo nombre
              </span>
            </div>

            {/* Tarjeta 3: Margen Disponible o Exceso */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 print-card space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold text-slate-600">
                  {selectedList.estado === 'cerrada'
                    ? 'Total Real Pagado'
                    : budgetComparison.excesoSobreGlobal > 0
                      ? 'Exceso sobre Presupuesto'
                      : 'Margen Disponible'}
                </span>
                <span className="text-[10px] font-mono-tabular font-bold text-slate-700">
                  {budgetComparison.porcentajeCubiertoPorItems}% detallado
                </span>
              </div>

              {selectedList.estado === 'cerrada' ? (
                <>
                  <div className="text-lg font-bold font-mono-tabular text-slate-900">
                    {formatearMonto(
                      selectedList.totalPagadoReal || 0,
                      selectedList.paymentCurrency || selectedList.moneda,
                      locale
                    )}
                  </div>
                  <div className="text-xs font-mono-tabular font-bold text-emerald-700">
                    ≈ {formatearMonto(selectedList.totalPagadoRealUsd || 0, 'USD', locale)}
                  </div>
                  {selectedList.paymentMode === 'cashea' &&
                    typeof selectedList.casheaFinancedUsd === 'number' &&
                    selectedList.casheaFinancedUsd > 0 && (
                      <div className="text-[10px] font-semibold text-amber-800 pt-0.5">
                        Pagado inicial:{' '}
                        {formatearMonto(selectedList.paidTodayAmountUsd || 0, 'USD', locale)} · En{' '}
                        {selectedList.casheaStoreOrPlatform || 'Cashea'}:{' '}
                        {formatearMonto(selectedList.casheaFinancedUsd, 'USD', locale)} (
                        {selectedList.casheaInstallmentsCount || 1} cuota
                        {(selectedList.casheaInstallmentsCount || 1) === 1 ? '' : 's'})
                      </div>
                    )}
                </>
              ) : (
                <>
                  <div
                    className={`text-lg font-bold font-mono-tabular ${
                      budgetComparison.excesoSobreGlobal > 0 ? 'text-rose-700' : 'text-slate-900'
                    }`}
                  >
                    {budgetComparison.excesoSobreGlobal > 0
                      ? `+${formatearMonto(
                          budgetComparison.excesoSobreGlobal,
                          selectedList.moneda,
                          locale
                        )}`
                      : formatearMonto(
                          budgetComparison.diferenciaDisponible,
                          selectedList.moneda,
                          locale
                        )}
                  </div>
                  {isVes && (
                    <div
                      className={`text-xs font-mono-tabular font-bold ${
                        budgetComparison.excesoSobreGlobal > 0
                          ? 'text-rose-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      ≈{' '}
                      {budgetComparison.excesoSobreGlobal > 0
                        ? `+${formatearMonto(
                            budgetComparison.excesoSobreGlobalUsd,
                            'USD',
                            locale
                          )}`
                        : formatearMonto(
                            budgetComparison.diferenciaDisponibleUsd,
                            'USD',
                            locale
                          )}
                    </div>
                  )}
                </>
              )}
              <span className="text-[10px] text-slate-500 block pt-0.5">
                En carrito con precio:{' '}
                {formatearMonto(
                  budgetComparison.sumaItemsCompradosDetallados,
                  selectedList.moneda,
                  locale
                )}
              </span>
            </div>
          </div>
        </section>

        {/* 3. CHECKLIST DE COMPRAS AGRUPADO POR PARADAS */}
        <section className="space-y-5">
          {printableStops.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
              No hay artículos para mostrar con el filtro seleccionado.
            </div>
          ) : (
            printableStops.map((group) => (
              <div
                key={group.stop.id}
                className="print-avoid-break print-table-wrapper rounded-xl border border-slate-300 overflow-hidden"
              >
                {/* Cabecera de la Parada */}
                <div className="print-table-header bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-xs font-bold text-slate-500">
                      {group.indexNumber}.
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900">
                      {group.stop.label}
                    </h3>
                    <span className="text-[11px] text-slate-600 font-medium">
                      ({group.items.length}{' '}
                      {group.items.length === 1 ? 'artículo' : 'artículos'} · {group.boughtCount}/
                      {group.allCount} comprados)
                    </span>
                  </div>

                  {printIncludePrices && group.stopSubtotal > 0 && (
                    <div className="text-xs font-mono-tabular font-semibold text-slate-800">
                      Subtotal parada:{' '}
                      <strong>
                        {formatearMonto(group.stopSubtotal, selectedList.moneda, locale)}
                      </strong>
                      {isVes && (
                        <span className="text-emerald-700 ml-1">
                          (≈ {formatearMonto(group.stopSubtotalUsd, 'USD', locale)})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Tabla de Artículos */}
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="w-10 py-2 px-2.5 text-center">Check</th>
                      <th className="py-2 px-3 text-left">Artículo / Producto</th>
                      <th className="w-20 py-2 px-2.5 text-center">Cant.</th>
                      <th className="w-28 py-2 px-2.5 text-right">
                        Precio Unit. ({selectedList.moneda})
                      </th>
                      <th className="w-36 py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {group.items.map((it) => {
                      const itemSub = calcularSubtotalItemMercado(it);
                      const hasCant = typeof it.cantidad === 'number' && it.cantidad > 0;
                      const hasPrice =
                        printIncludePrices &&
                        typeof it.montoUnitario === 'number' &&
                        it.montoUnitario > 0;

                      return (
                        <tr key={it.id} className="print-table-row">
                          <td className="py-2 px-2.5 text-center align-middle">
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px] font-bold leading-none ${
                                it.comprado
                                  ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-700 bg-white text-transparent'
                              }`}
                            >
                              {it.comprado ? '✓' : '·'}
                            </span>
                          </td>

                          <td className="py-2 px-3 align-middle">
                            <span
                              className={`font-medium ${
                                it.comprado
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900 font-semibold'
                              }`}
                            >
                              {it.nombre}
                            </span>
                            {it.comprado && (
                              <span className="ml-2 text-[10px] font-medium text-emerald-700">
                                · En carrito
                              </span>
                            )}
                          </td>

                          <td className="py-2 px-2.5 text-center font-mono-tabular align-middle text-slate-800">
                            {hasCant ? (
                              <span className="font-semibold">{it.cantidad}</span>
                            ) : (
                              <span className="text-slate-300">____</span>
                            )}
                          </td>

                          <td className="py-2 px-2.5 text-right font-mono-tabular align-middle text-slate-700">
                            {hasPrice ? (
                              formatearMonto(it.montoUnitario || 0, selectedList.moneda, locale)
                            ) : (
                              <span className="text-slate-300">__________</span>
                            )}
                          </td>

                          <td className="py-2 px-3 text-right font-mono-tabular align-middle">
                            {printIncludePrices && itemSub !== null ? (
                              <div>
                                <span className="font-bold text-slate-900">
                                  {formatearMonto(itemSub, selectedList.moneda, locale)}
                                </span>
                                {isVes && rate > 0 && (
                                  <span className="block text-[10px] font-semibold text-emerald-700">
                                    ≈ {formatearMonto(itemSub / rate, 'USD', locale)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">____________</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </section>

        {/* 4. PIE DE REPORTE Y RECUADRO DE CONTROL MANUAL EN CAJA */}
        <footer className="print-avoid-break pt-4 border-t-2 border-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono-tabular">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              Consolidado de la Lista
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Artículos totales / Pendientes:</span>
              <strong className="text-slate-900">
                {totalItemsCount} total ({pendingCount} por comprar)
              </strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Suma de ítems con precio:</span>
              <strong className="text-emerald-700">
                {formatearMonto(budgetComparison.sumaItemsDetallados, selectedList.moneda, locale)}
                {isVes &&
                  ` (≈ ${formatearMonto(budgetComparison.sumaItemsDetalladosUsd, 'USD', locale)})`}
              </strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>Monto Global Estimado:</span>
              <strong className="text-slate-900">
                {formatearMonto(budgetComparison.montoGlobalLista, selectedList.moneda, locale)}
                {isVes &&
                  ` (≈ ${formatearMonto(budgetComparison.montoGlobalListaUsd, 'USD', locale)})`}
              </strong>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Control en Caja (Para anotar en el mercado)
            </div>
            <div className="flex items-end justify-between gap-2 text-[11px] text-slate-600">
              <span className="shrink-0">Total Real Pagado en Caja:</span>
              <span className="flex-1 border-b border-slate-400 h-4" />
            </div>
            <div className="flex items-end justify-between gap-2 text-[11px] text-slate-600">
              <span className="shrink-0">Billetera / Método de Pago:</span>
              <span className="flex-1 border-b border-slate-400 h-4" />
            </div>
            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>Reporte generado por Mis Finanzas Personales</span>
              <span>Formato A4 / Carta</span>
            </div>
          </div>
        </footer>
      </article>
    );
  };

  // Renderizador de la FACTURA DE COMPRA DE MERCADO (Diseño Recibo / Factura Comercial para Listas Cerradas)
  const renderMarketInvoiceSheet = () => {
    if (!selectedList || !budgetComparison) {
      return (
        <div className="p-8 text-center text-sm text-slate-600">
          Selecciona una lista de mercado para generar su factura imprimible.
        </div>
      );
    }

    const folio = getInvoiceFolio(selectedList);
    const [yStr, mStr] = (selectedList.fecha || '').split('-');
    const mIdx = Math.max(0, Math.min(11, (Number(mStr) || 1) - 1));
    const monthNameEs = `${MONTH_NAMES_ES[mIdx]} ${yStr || new Date().getFullYear()}`;

    const walletObj = data.wallets.find((w) => w.id === selectedList.walletId);
    const walletName = walletObj ? walletObj.name : 'Billetera Principal';

    const paymentCur = selectedList.paymentCurrency || selectedList.moneda || 'USD';
    const paymentRate =
      selectedList.paymentExchangeRate && selectedList.paymentExchangeRate > 0
        ? selectedList.paymentExchangeRate
        : selectedList.exchangeRate && selectedList.exchangeRate > 0
          ? selectedList.exchangeRate
          : budgetComparison.tasaReferencial && budgetComparison.tasaReferencial > 0
            ? budgetComparison.tasaReferencial
            : 450;

    const totalPaidUsd =
      selectedList.estado === 'cerrada'
        ? selectedList.totalPagadoRealUsd || 0
        : selectedList.presupuestoEstimadoUsd || 0;

    const totalPaidNominal =
      selectedList.estado === 'cerrada'
        ? selectedList.totalPagadoReal || totalPaidUsd
        : selectedList.presupuestoEstimado || totalPaidUsd;

    const totalPaidVes =
      paymentCur === 'VES' ? totalPaidNominal : totalPaidUsd * paymentRate;

    const budgetDiffUsd = (selectedList.presupuestoEstimadoUsd || 0) - totalPaidUsd;

    const isCashea =
      selectedList.paymentMode === 'cashea' &&
      typeof selectedList.casheaFinancedUsd === 'number' &&
      selectedList.casheaFinancedUsd > 0;

    const invoiceStops = MARKET_STOPS.map((stop, idx) => {
      const allInStop = selectedList.items.filter((i) => i.categoria === stop.id);
      const visibleInStop =
        invoiceItemsFilter === 'bought' && boughtCount > 0
          ? allInStop.filter((i) => i.comprado)
          : allInStop;

      const stopSubtotal = visibleInStop.reduce((acc, it) => {
        const sub = calcularSubtotalItemMercado(it);
        return acc + (sub !== null ? sub : 0);
      }, 0);

      return {
        stop,
        indexNumber: String(idx + 1).padStart(2, '0'),
        items: visibleInStop,
        stopSubtotal,
      };
    }).filter((g) => g.items.length > 0);

    const visibleItemsFlat = invoiceStops.flatMap((g) => g.items);
    const pricedItemsCount = visibleItemsFlat.filter(
      (i) => typeof i.montoUnitario === 'number' && i.montoUnitario > 0
    ).length;
    const unpricedItemsCount = visibleItemsFlat.length - pricedItemsCount;

    let runningRowNumber = 0;

    return (
      <article className="printable-report-sheet bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
        {/* Cinta Decorativa Superior */}
        <div className="h-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900" />

        <div className="p-6 sm:p-9 space-y-6">
          {/* 1. CABECERA DE FACTURA COMERCIAL */}
          <header className="pb-5 border-b-2 border-dashed border-slate-300 print-border-strong flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-300 px-3 py-0.5 text-[10px] font-mono-tabular font-bold uppercase tracking-widest text-emerald-800">
                <span>🧾 FACTURA / RECIBO DE COMPRA DE MERCADO</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-slate-900 print-text-strong tracking-tight">
                {selectedList.nombre}
              </h1>
              <p className="text-xs text-slate-600 print-text-muted">
                Comprobante consolidado de artículos adquiridos y liquidación final en caja
              </p>

              <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Fecha de Compra
                  </span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatDateShort(selectedList.fecha)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Mes Contable (Excel)
                  </span>
                  <strong className="text-emerald-700 font-semibold">{monthNameEs}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Billetera / Cuenta
                  </span>
                  <strong className="text-slate-900">{walletName}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Modalidad de Pago
                  </span>
                  <strong className="text-slate-900">
                    {isCashea
                      ? `🛍️ ${selectedList.casheaStoreOrPlatform || 'Cashea'} (${selectedList.casheaInstallmentsCount || 1} cuotas)`
                      : '💳 Contado (Liquidado)'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Titular
                  </span>
                  <strong className="text-slate-900">
                    {data.settings.userName || 'Mis Finanzas'}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Tasa Referencial
                  </span>
                  <strong className="font-mono-tabular text-slate-900">
                    Bs. {paymentRate.toFixed(2)} / $1
                  </strong>
                </div>
              </div>
            </div>

            {/* Sello y Folio de la Factura */}
            <div className="rounded-2xl bg-slate-50 border-2 border-slate-900 p-4 text-left sm:text-right font-mono-tabular shrink-0 min-w-[210px] space-y-1">
              <div className="flex sm:justify-end">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    selectedList.estado === 'cerrada'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {selectedList.estado === 'cerrada' ? '✓ PAGADA Y CERRADA' : '⏳ EN PROYECCIÓN'}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-900 pt-1">{folio}</div>
              <div className="text-[11px] text-slate-500">
                Total Ítems: <strong className="text-slate-800">{visibleItemsFlat.length}</strong>
              </div>
              <div className="pt-1 border-t border-slate-200">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block">
                  Total Facturado
                </span>
                <span className="text-xl font-bold text-emerald-700">
                  {formatearMonto(totalPaidUsd, 'USD', locale)}
                </span>
              </div>
            </div>
          </header>

          {/* 2. DETALLE DE ARTÍCULOS INCLUIDOS EN LA FACTURA */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Detalle de Artículos Adquiridos en el Mercado ({visibleItemsFlat.length})
              </h2>
              <span className="text-[11px] text-slate-500">
                {unpricedItemsCount > 0
                  ? `${unpricedItemsCount} artículo(s) sin precio individual están incluidos dentro del monto total pagado`
                  : 'Todos los artículos cuentan con precio unitario detallado'}
              </span>
            </div>

            {visibleItemsFlat.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
                Esta compra de mercado fue registrada por monto global ({formatearMonto(totalPaidUsd, 'USD', locale)}) sin lista detallada de artículos.
              </div>
            ) : (
              <div className="print-table-wrapper rounded-xl border border-slate-300 overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <th className="w-10 py-2.5 px-2.5 text-center">#</th>
                      <th className="py-2.5 px-3 text-left">Descripción del Artículo</th>
                      <th className="w-36 py-2.5 px-2.5 text-left hidden sm:table-cell">
                        Parada / Sección
                      </th>
                      <th className="w-16 py-2.5 px-2 text-center">Cant.</th>
                      <th className="w-28 py-2.5 px-2.5 text-right">Precio Unit.</th>
                      <th className="w-40 py-2.5 px-3 text-right">Importe / Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {invoiceStops.map((group) => (
                      <React.Fragment key={group.stop.id}>
                        {/* Subencabezado compacto por Parada */}
                        <tr className="bg-slate-50/90 border-y border-slate-200">
                          <td
                            colSpan={6}
                            className="py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-700"
                          >
                            <div className="flex items-center justify-between">
                              <span>
                                {group.indexNumber}. {group.stop.label} ({group.items.length})
                              </span>
                              {group.stopSubtotal > 0 && (
                                <span className="font-mono-tabular text-slate-600">
                                  Subtotal detallado:{' '}
                                  {formatearMonto(group.stopSubtotal, selectedList.moneda, locale)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {group.items.map((it) => {
                          runningRowNumber += 1;
                          const itemSub = calcularSubtotalItemMercado(it);
                          const hasCant = typeof it.cantidad === 'number' && it.cantidad > 0;
                          const hasPrice =
                            typeof it.montoUnitario === 'number' && it.montoUnitario > 0;

                          return (
                            <tr key={it.id} className="print-table-row hover:bg-slate-50/50">
                              <td className="py-2 px-2.5 text-center font-mono-tabular text-[11px] text-slate-500">
                                {String(runningRowNumber).padStart(2, '0')}
                              </td>
                              <td className="py-2 px-3">
                                <span className="font-semibold text-slate-900">{it.nombre}</span>
                                <span className="block sm:hidden text-[10px] text-slate-500">
                                  {group.stop.shortLabel}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-[11px] text-slate-600 hidden sm:table-cell">
                                {group.stop.shortLabel}
                              </td>
                              <td className="py-2 px-2 text-center font-mono-tabular font-semibold text-slate-800">
                                {hasCant ? it.cantidad : 1}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono-tabular text-slate-600">
                                {hasPrice ? (
                                  formatearMonto(
                                    it.montoUnitario || 0,
                                    selectedList.moneda,
                                    locale
                                  )
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">
                                    Monto global
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono-tabular">
                                {itemSub !== null && itemSub > 0 ? (
                                  <span className="font-bold text-slate-900">
                                    {formatearMonto(itemSub, selectedList.moneda, locale)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                    ✓ Incluido en el total
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 3. RESUMEN DE LIQUIDACIÓN Y TOTAL DE LA FACTURA */}
          <footer className="print-avoid-break pt-4 border-t-2 border-slate-900 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            {/* Columna Izquierda: Notas, Presupuesto y Comparativa */}
            <div className="md:col-span-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3 text-xs">
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Resumen de Control Presupuestario
                </div>

                <div className="flex justify-between text-slate-600 font-mono-tabular">
                  <span>Presupuesto Inicial Estimado:</span>
                  <strong className="text-slate-900">
                    {formatearMonto(
                      selectedList.presupuestoEstimado,
                      selectedList.moneda,
                      locale
                    )}{' '}
                    (≈ {formatearMonto(selectedList.presupuestoEstimadoUsd, 'USD', locale)})
                  </strong>
                </div>

                <div className="flex justify-between text-slate-600 font-mono-tabular">
                  <span>Resultado vs. Presupuesto:</span>
                  <strong
                    className={
                      budgetDiffUsd >= -0.009 ? 'text-emerald-700' : 'text-rose-700'
                    }
                  >
                    {budgetDiffUsd > 0.009
                      ? `Ahorro de ${formatearMonto(budgetDiffUsd, 'USD', locale)}`
                      : budgetDiffUsd < -0.009
                        ? `Exceso de +${formatearMonto(Math.abs(budgetDiffUsd), 'USD', locale)}`
                        : 'Exacto al presupuesto ($0.00)'}
                  </strong>
                </div>

                {selectedList.notes && (
                  <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-600">
                    <strong>Nota de la compra:</strong> {selectedList.notes}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500 leading-relaxed">
                * Los artículos sin precio unitario individual están cubiertos dentro del{' '}
                <strong>Monto Total de la Factura ({formatearMonto(totalPaidUsd, 'USD', locale)})</strong>{' '}
                pagado en caja.
              </div>
            </div>

            {/* Columna Derecha: Gran Caja de Total Pagado */}
            <div className="md:col-span-6 p-4 rounded-xl bg-emerald-50/60 border-2 border-slate-900 space-y-2.5 font-mono-tabular">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold uppercase tracking-wider text-slate-800">
                  Liquidación Total en Caja
                </span>
                <span>{folio}</span>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-slate-300">
                <span className="text-xs font-bold text-slate-800">TOTAL PAGADO ($ USD):</span>
                <span className="text-2xl font-bold text-emerald-700">
                  {formatearMonto(totalPaidUsd, 'USD', locale)}
                </span>
              </div>

              <div className="flex items-baseline justify-between text-xs text-slate-700">
                <span>Total en Bolívares (VES):</span>
                <strong className="text-sm text-slate-900">
                  {formatearMonto(totalPaidVes, 'VES', locale)}
                </strong>
              </div>

              {isCashea && (
                <div className="mt-2 pt-2 border-t border-dashed border-amber-400 bg-amber-50/80 -mx-2 px-2.5 py-2 rounded-lg space-y-1 text-[11px]">
                  <div className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">
                    🛍️ Desglose de Compra con {selectedList.casheaStoreOrPlatform || 'Cashea'}
                  </div>
                  <div className="flex justify-between text-amber-900">
                    <span>Pagado el día del mercado (Inicial + Contado):</span>
                    <strong>
                      {formatearMonto(selectedList.paidTodayAmountUsd || 0, 'USD', locale)}
                    </strong>
                  </div>
                  <div className="flex justify-between text-amber-900">
                    <span>
                      Financiado en {selectedList.casheaInstallmentsCount || 1} cuota(s):
                    </span>
                    <strong>
                      {formatearMonto(selectedList.casheaFinancedUsd || 0, 'USD', locale)}
                    </strong>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
                <span>COMPROBANTE OFICIAL · MIS FINANZAS</span>
                <span>{formatDateShort(selectedList.fecha)}</span>
              </div>
            </div>
          </footer>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      {/* Vista de Impresión Nativa (SOLO visible al imprimir vía @media print) */}
      <div className="print-only-block">
        {printDocMode === 'invoice' || selectedList?.estado === 'cerrada'
          ? renderMarketInvoiceSheet()
          : renderMarketReportSheet()}
      </div>

      {/* Cabecera Principal y Controles Interactivos (Ocultos al imprimir) */}
      <div className="no-print print:hidden space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-[#203A43] via-[#2C5364] to-[#0F2027] p-6 text-white shadow-md">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-100">
                <ShoppingBag className="h-3.5 w-3.5" />
                Checklist de Compras Táctil & Paradas
              </span>
              <h2 className="mt-2 font-editorial text-2xl font-bold sm:text-3xl text-white">
                Lista de Mercado Simple
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-emerald-100/90">
                Organiza tus compras por <strong>paradas</strong> (Feria, Carnicería, Charcutería,
                Supermercado, Limpieza). Mientras la lista esté abierta, el presupuesto estimado
                resta a tu <strong>Saldo Proyectado</strong>. Al cerrarla, indicas cuánto gastaste en
                total para debitarlo de tu <strong>Saldo Real</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#203A43] shadow-sm transition hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                Nueva Lista de Mercado
              </button>
            </div>
          </div>

          {/* Tarjetas de Resumen Ejecutivo */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
              <span className="text-xs font-medium text-emerald-100/80">
                Presupuesto en Listas Abiertas
              </span>
              <p className="mt-1 font-mono-tabular text-2xl font-bold text-white">
                {formatearMonto(summary.presupuestoProyectadoTotalUsd, 'USD', locale)}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-100/80">
                Resta de tu Saldo Proyectado
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
              <span className="text-xs font-medium text-emerald-100/80">Listas Activas</span>
              <p className="mt-1 font-mono-tabular text-2xl font-bold text-white">
                {summary.listasAbiertas} abierta(s)
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-100/80">
                {summary.itemsPendientesEnAbiertas} artículos por comprar
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
              <span className="text-xs font-medium text-emerald-100/80">Total Real Pagado (Cerradas)</span>
              <p className="mt-1 font-mono-tabular text-2xl font-bold text-emerald-200">
                {formatearMonto(summary.totalGastadoHistoricoUsd, 'USD', locale)}
              </p>
              <p className="mt-0.5 text-[11px] text-emerald-100/80">
                {summary.listasCerradas} mercado(s) culminados
              </p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm border border-white/15">
              <span className="text-xs font-medium text-emerald-100/80">Modo Impresión / PDF</span>
              <p className="mt-1 font-editorial text-lg font-bold text-amber-200">
                Hoja de Compras Editorial
              </p>
              <button
                type="button"
                onClick={handlePrint}
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-white underline hover:text-emerald-200"
              >
                <Printer className="w-3.5 h-3.5" />
                Ver e imprimir reporte de lista
              </button>
            </div>
          </div>
        </div>

        {/* REGISTRO MENSUAL TIPO EXCEL Y COMPARADOR DE MESES */}
        <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface)] p-5 shadow-sm space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center justify-between border-b border-[var(--border-hairline)] pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                  📊 Hoja Mensual Tipo Excel
                </span>
                <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                  Registro de Gasto por Mes y Comparador Mensual
                </h3>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Cada mes se organiza automáticamente como una <strong>columna de Excel</strong>{' '}
                (ej. <em>Octubre $170.00 → Noviembre $200.00</em>) sumando tus listas de mercado
                (incluyendo compras completas con Cashea) y calculando la diferencia exacta entre meses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {monthlyColumns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExcelStopRows((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition"
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{showExcelStopRows ? 'Ocultar filas por parada' : 'Ver filas por parada'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowQuickMonthForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Anotar Mes Histórico (Ej. Oct $170)</span>
              </button>
            </div>
          </div>

          {/* Formulario rápido para anotar un mes histórico directamente en la tabla Excel */}
          {showQuickMonthForm && (
            <form
              onSubmit={handleQuickRegisterHistoricalMonth}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Agregar Registro Mensual Rápido (Sin descontar de billeteras actuales)
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Ideal si quieres anotar cuánto gastaste en un mes pasado (ej. Octubre: $170,
                    Noviembre: $200) para alimentar tus columnas de Excel y compararlos al instante.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickMonthForm(false)}
                  className="rounded-lg p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Mes
                  </label>
                  <select
                    value={quickMonthNum}
                    onChange={(e) => setQuickMonthNum(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                  >
                    {MONTH_NAMES_ES.map((mName, idx) => {
                      const val = String(idx + 1).padStart(2, '0');
                      return (
                        <option key={val} value={val}>
                          {val} - {mName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Año
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2035"
                    value={quickMonthYear}
                    onChange={(e) => setQuickMonthYear(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-mono-tabular font-semibold text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Monto Gastado ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={quickMonthAmountUsd}
                    onChange={(e) => setQuickMonthAmountUsd(e.target.value)}
                    placeholder="Ej: 170.00"
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-mono-tabular font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                    Concepto / Nota (Opcional)
                  </label>
                  <input
                    type="text"
                    value={quickMonthLabel}
                    onChange={(e) => setQuickMonthLabel(e.target.value)}
                    placeholder="Ej: Mercado Mensual"
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar en Columna</span>
                </button>
              </div>
            </form>
          )}

          {monthlyColumns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-6 text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                Aún no hay meses registrados. Crea una lista de mercado o usa el botón{' '}
                <strong>"Anotar Mes Histórico"</strong> arriba para registrar columnas como{' '}
                <em>Octubre ($170)</em> y <em>Noviembre ($200)</em>.
              </p>
            </div>
          ) : (
            <>
              {/* TABLA HORIZONTAL TIPO EXCEL (COLUMNAS POR MES) */}
              <div className="overflow-x-auto rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)]">
                <table className="w-full min-w-[640px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface)]">
                      <th className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] border-r border-[var(--border-hairline)] min-w-[190px]">
                        Concepto / Fila Excel
                      </th>
                      {monthlyColumns.map((col, idx) => {
                        const isBase = col.monthKey === effectiveBaseKey;
                        const isTarget = col.monthKey === effectiveTargetKey;
                        const colLetter = String.fromCharCode(66 + (idx % 25)); // B, C, D...
                        return (
                          <th
                            key={col.monthKey}
                            className={`px-4 py-3 text-right min-w-[165px] border-r border-[var(--border-hairline)] last:border-r-0 transition ${
                              isBase || isTarget ? 'bg-emerald-500/10' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono-tabular text-[var(--text-secondary)] mb-0.5">
                              <span className="rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] px-1.5 py-0.2 font-bold">
                                Col {colLetter}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setCompareBaseKey(col.monthKey)}
                                  title="Fijar como Mes Base (Mes A) para comparar"
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${
                                    isBase
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  Mes A
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCompareTargetKey(col.monthKey)}
                                  title="Fijar como Mes a Comparar (Mes B)"
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${
                                    isTarget
                                      ? 'bg-[var(--pink-primary)] text-white'
                                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  Mes B
                                </button>
                              </div>
                            </div>
                            <div className="font-editorial text-sm font-bold text-[var(--text-primary)]">
                              {col.label}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {/* FILA 1: TOTAL GASTO DEL MES ($ USD) */}
                    <tr className="bg-[var(--surface)]/70">
                      <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-3 font-bold text-[var(--text-primary)] border-r border-[var(--border-hairline)]">
                        <div>1. Total Mercado del Mes</div>
                        <span className="text-[10px] font-normal text-[var(--text-secondary)]">
                          Cerrado real + en proyección
                        </span>
                      </td>
                      {monthlyColumns.map((col) => (
                        <td
                          key={col.monthKey}
                          className="px-4 py-3 text-right font-mono-tabular border-r border-[var(--border-hairline)] last:border-r-0"
                        >
                          <div className="text-base font-bold text-emerald-400">
                            {formatearMonto(col.totalConsolidadoUsd, 'USD', locale)}
                          </div>
                          {activeRate && activeRate > 0 && (
                            <div className="text-[10px] text-[var(--text-secondary)]">
                              ≈ {formatearMonto(col.totalConsolidadoUsd * activeRate, 'VES', locale)}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* FILA 2: DIFERENCIA VS. MES ANTERIOR (FÓRMULA AUTOMÁTICA EXCEL) */}
                    <tr>
                      <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2.5 font-semibold text-[var(--text-primary)] border-r border-[var(--border-hairline)]">
                        <div>2. Variación vs. Mes Anterior</div>
                        <span className="text-[10px] font-normal text-[var(--text-secondary)]">
                          Diferencia automática ($ y %)
                        </span>
                      </td>
                      {monthlyColumns.map((col, idx) => {
                        if (idx === 0 || col.diffVsPrevUsd === null) {
                          return (
                            <td
                              key={col.monthKey}
                              className="px-4 py-2.5 text-right font-mono-tabular text-[11px] text-[var(--text-secondary)] border-r border-[var(--border-hairline)] last:border-r-0"
                            >
                              Mes inicial (Base)
                            </td>
                          );
                        }
                        const diff = col.diffVsPrevUsd;
                        const pct = col.diffVsPrevPercent;
                        const isMore = diff > 0.009;
                        const isLess = diff < -0.009;
                        const prevLabel = monthlyColumns[idx - 1]?.shortLabel || 'mes ant.';

                        return (
                          <td
                            key={col.monthKey}
                            className="px-4 py-2.5 text-right font-mono-tabular border-r border-[var(--border-hairline)] last:border-r-0"
                          >
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${
                                isMore
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : isLess
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-500/15 text-slate-300'
                              }`}
                            >
                              {isMore ? '+' : ''}
                              {formatearMonto(diff, 'USD', locale)}
                              {pct !== null && (
                                <span className="text-[10px] font-semibold">
                                  ({pct > 0 ? '+' : ''}
                                  {pct.toFixed(1)}%)
                                </span>
                              )}
                            </span>
                            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                              {isMore
                                ? `Más gasto que ${prevLabel}`
                                : isLess
                                  ? `Ahorro vs. ${prevLabel}`
                                  : `Igual que ${prevLabel}`}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {/* FILA 3: DESGLOSE CERRADO VS PROYECTADO Y CASHEA */}
                    <tr>
                      <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2.5 font-semibold text-[var(--text-secondary)] border-r border-[var(--border-hairline)]">
                        <div>3. Desglose de Pago</div>
                        <span className="text-[10px] font-normal">
                          Contado / Cashea / Abiertas
                        </span>
                      </td>
                      {monthlyColumns.map((col) => (
                        <td
                          key={col.monthKey}
                          className="px-4 py-2.5 text-right font-mono-tabular text-[11px] border-r border-[var(--border-hairline)] last:border-r-0 space-y-0.5"
                        >
                          <div className="text-[var(--text-primary)]">
                            Cerrado:{' '}
                            <strong>{formatearMonto(col.totalCerradoUsd, 'USD', locale)}</strong>
                          </div>
                          {col.financedCasheaUsd > 0 && (
                            <div className="text-[10px] font-semibold text-amber-400">
                              🛍️ Financiado Cashea:{' '}
                              {formatearMonto(col.financedCasheaUsd, 'USD', locale)}
                            </div>
                          )}
                          {col.totalAbiertoProyectadoUsd > 0 && (
                            <div className="text-[10px] text-blue-400">
                              Abiertas:{' '}
                              {formatearMonto(col.totalAbiertoProyectadoUsd, 'USD', locale)}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>

                    {/* FILA 4: LISTAS REGISTRADAS EN EL MES */}
                    <tr>
                      <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2.5 font-semibold text-[var(--text-secondary)] border-r border-[var(--border-hairline)]">
                        <div>4. Mercados del Mes</div>
                        <span className="text-[10px] font-normal">
                          Clic para abrir el detalle
                        </span>
                      </td>
                      {monthlyColumns.map((col) => (
                        <td
                          key={col.monthKey}
                          className="px-3 py-2.5 text-right border-r border-[var(--border-hairline)] last:border-r-0 align-top"
                        >
                          <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-1">
                            {col.totalListsCount} registro{col.totalListsCount === 1 ? '' : 's'}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {col.lists.map((l) => {
                              const amountUsd =
                                l.estado === 'cerrada'
                                  ? l.totalPagadoRealUsd || 0
                                  : l.presupuestoEstimadoUsd || 0;
                              return (
                                <div key={l.id} className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedListId(l.id)}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium border transition max-w-[140px] truncate ${
                                      selectedList?.id === l.id
                                        ? 'border-[var(--pink-primary)] bg-[var(--pink-primary)]/15 text-[var(--text-primary)] font-bold'
                                        : 'border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                    title={`${l.nombre} (${formatDateShort(l.fecha)})`}
                                  >
                                    <span className="truncate">{l.nombre}</span>
                                    <span className="font-mono-tabular font-bold text-emerald-400 shrink-0">
                                      ${amountUsd.toFixed(0)}
                                    </span>
                                  </button>
                                  {l.estado === 'cerrada' && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenInvoiceForList(l)}
                                      title={`Ver e imprimir factura de ${l.nombre}`}
                                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition"
                                    >
                                      🧾
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* FILAS OPCIONALES: DESGLOSE POR PARADA / CATEGORÍA */}
                    {showExcelStopRows &&
                      MARKET_STOPS.map((st) => (
                        <tr key={st.id} className="bg-[var(--surface-subtle)]/50">
                          <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2 text-[11px] font-medium text-[var(--text-secondary)] border-r border-[var(--border-hairline)]">
                            Parada: <strong className="text-[var(--text-primary)]">{st.shortLabel}</strong>
                          </td>
                          {monthlyColumns.map((col) => {
                            const val = col.stopBreakdownUsd[st.id] || 0;
                            return (
                              <td
                                key={col.monthKey}
                                className="px-4 py-2 text-right font-mono-tabular text-[11px] text-[var(--text-secondary)] border-r border-[var(--border-hairline)] last:border-r-0"
                              >
                                {val > 0 ? formatearMonto(val, 'USD', locale) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* COMPARADOR DIRECTO ENTRE 2 MESES (Ej. Octubre $170 vs Noviembre $200) */}
              {activeMonthComparison && (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pink-primary)]">
                        Comparador Directo de Meses (Columna A vs. Columna B)
                      </span>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Elige dos meses cualesquiera para calcular cuánto fue la diferencia exacta en
                        dólares y porcentaje.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Mes A
                        </span>
                        <select
                          value={effectiveBaseKey}
                          onChange={(e) => setCompareBaseKey(e.target.value)}
                          className="rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                        >
                          {monthlyColumns.map((col) => (
                            <option key={col.monthKey} value={col.monthKey}>
                              {col.label} ({formatearMonto(col.totalConsolidadoUsd, 'USD', locale)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <span className="text-xs font-bold text-[var(--text-secondary)]">vs.</span>

                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-[var(--pink-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Mes B
                        </span>
                        <select
                          value={effectiveTargetKey}
                          onChange={(e) => setCompareTargetKey(e.target.value)}
                          className="rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                        >
                          {monthlyColumns.map((col) => (
                            <option key={col.monthKey} value={col.monthKey}>
                              {col.label} ({formatearMonto(col.totalConsolidadoUsd, 'USD', locale)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tarjetas del resultado de la comparación */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[var(--surface)] p-3.5 border border-[var(--border-hairline)]">
                      <span className="text-[11px] font-semibold text-blue-400 block">
                        Mes Base (A): {activeMonthComparison.baseMonth.label}
                      </span>
                      <p className="mt-1 font-mono-tabular text-xl font-bold text-[var(--text-primary)]">
                        {formatearMonto(
                          activeMonthComparison.baseMonth.totalConsolidadoUsd,
                          'USD',
                          locale
                        )}
                      </p>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {activeMonthComparison.baseMonth.totalListsCount} compra(s) registrada(s)
                      </span>
                    </div>

                    <div className="rounded-xl bg-[var(--surface)] p-3.5 border border-[var(--border-hairline)]">
                      <span className="text-[11px] font-semibold text-[var(--pink-primary)] block">
                        Mes Comparado (B): {activeMonthComparison.targetMonth.label}
                      </span>
                      <p className="mt-1 font-mono-tabular text-xl font-bold text-[var(--text-primary)]">
                        {formatearMonto(
                          activeMonthComparison.targetMonth.totalConsolidadoUsd,
                          'USD',
                          locale
                        )}
                      </p>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {activeMonthComparison.targetMonth.totalListsCount} compra(s) registrada(s)
                      </span>
                    </div>

                    <div
                      className={`rounded-xl p-3.5 border ${
                        activeMonthComparison.trend === 'increase'
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : activeMonthComparison.trend === 'decrease'
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-[var(--surface)] border-[var(--border-hairline)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[var(--text-primary)]">
                          Diferencia Exacta (B - A)
                        </span>
                        {activeMonthComparison.percentageChange !== null && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono-tabular font-bold ${
                              activeMonthComparison.trend === 'increase'
                                ? 'bg-rose-500/20 text-rose-300'
                                : activeMonthComparison.trend === 'decrease'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-500/20 text-slate-300'
                            }`}
                          >
                            {activeMonthComparison.percentageChange > 0 ? '+' : ''}
                            {activeMonthComparison.percentageChange.toFixed(1)}%
                          </span>
                        )}
                      </div>

                      <p
                        className={`mt-1 font-mono-tabular text-xl font-bold ${
                          activeMonthComparison.trend === 'increase'
                            ? 'text-rose-400'
                            : activeMonthComparison.trend === 'decrease'
                              ? 'text-emerald-400'
                              : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {activeMonthComparison.differenceUsd > 0 ? '+' : ''}
                        {formatearMonto(activeMonthComparison.differenceUsd, 'USD', locale)}
                      </p>

                      {activeRate && activeRate > 0 && (
                        <span className="block text-[10px] font-mono-tabular text-[var(--text-secondary)]">
                          ≈{' '}
                          {activeMonthComparison.differenceUsd > 0 ? '+' : ''}
                          {formatearMonto(
                            activeMonthComparison.differenceUsd * activeRate,
                            'VES',
                            locale
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Conclusión legible */}
                  <div className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 border border-[var(--border-hairline)] flex items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--text-primary)] font-medium">
                      💡 {activeMonthComparison.summaryText}
                    </span>
                  </div>
                </div>
              )}

              {/* COMPARADOR DE LISTAS INDIVIDUALES ENTRE DIFERENTES MESES (Lista A vs. Lista B) */}
              {marketLists.length >= 1 && (
                <div className="rounded-2xl border border-emerald-500/30 bg-[var(--surface-subtle)] p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                          🔍 Análisis Lista vs. Lista
                        </span>
                        <h4 className="text-sm font-bold text-[var(--text-primary)]">
                          Comparador de Listas entre Meses (Cómo fue la misma lista en distintos meses)
                        </h4>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Selecciona dos listas de mercado (por ejemplo, tu lista de Octubre vs. tu lista de Noviembre) para analizar variación de monto total, artículos repetidos, productos nuevos y desglose por paradas.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowListComparator((prev) => !prev)}
                      className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shrink-0"
                    >
                      {showListComparator ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Ocultar análisis de listas</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Abrir comparador de listas</span>
                        </>
                      )}
                    </button>
                  </div>

                  {showListComparator && activeListComparison && (
                    <div className="space-y-4 pt-2 border-t border-[var(--border-hairline)]">
                      {/* Selectores de Lista A y Lista B */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-hairline)] space-y-1.5">
                          <label className="flex items-center justify-between text-[11px] font-bold text-blue-400">
                            <span>LISTA BASE (LISTA A · MES ANTERIOR)</span>
                            <span className="font-mono-tabular text-[10px] text-[var(--text-secondary)]">
                              {activeListComparison.baseMonthLabel}
                            </span>
                          </label>
                          <select
                            value={effectiveListBaseId}
                            onChange={(e) => setCompareListBaseId(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                          >
                            {sortedListsChronological.map((l) => {
                              const amt =
                                l.estado === 'cerrada'
                                  ? l.totalPagadoRealUsd || 0
                                  : l.presupuestoEstimadoUsd || 0;
                              return (
                                <option key={l.id} value={l.id}>
                                  {l.nombre} · {formatDateShort(l.fecha)} ({formatearMonto(amt, 'USD', locale)} · {l.items.length} ítems)
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-hairline)] space-y-1.5">
                          <label className="flex items-center justify-between text-[11px] font-bold text-[var(--pink-primary)]">
                            <span>LISTA A COMPARAR (LISTA B · OTRO MES)</span>
                            <span className="font-mono-tabular text-[10px] text-[var(--text-secondary)]">
                              {activeListComparison.targetMonthLabel}
                            </span>
                          </label>
                          <select
                            value={effectiveListTargetId}
                            onChange={(e) => setCompareListTargetId(e.target.value)}
                            className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                          >
                            {sortedListsChronological.map((l) => {
                              const amt =
                                l.estado === 'cerrada'
                                  ? l.totalPagadoRealUsd || 0
                                  : l.presupuestoEstimadoUsd || 0;
                              return (
                                <option key={l.id} value={l.id}>
                                  {l.nombre} · {formatDateShort(l.fecha)} ({formatearMonto(amt, 'USD', locale)} · {l.items.length} ítems)
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>

                      {/* Tarjetas de Comparación de Totales y Cantidad de Artículos */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-[var(--surface)] p-3.5 border border-[var(--border-hairline)] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-blue-400 truncate">
                              Lista A: {activeListComparison.baseList.nombre}
                            </span>
                            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                              {activeListComparison.baseMonthLabel}
                            </span>
                          </div>
                          <p className="font-mono-tabular text-xl font-bold text-[var(--text-primary)]">
                            {formatearMonto(activeListComparison.baseTotalUsd, 'USD', locale)}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                            <span>{activeListComparison.baseItemsCount} artículo(s)</span>
                            <span>
                              {activeListComparison.baseList.paymentMode === 'cashea'
                                ? '🛍️ Pagada con Cashea'
                                : '💵 Contado'}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-xl bg-[var(--surface)] p-3.5 border border-[var(--border-hairline)] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[var(--pink-primary)] truncate">
                              Lista B: {activeListComparison.targetList.nombre}
                            </span>
                            <span className="rounded bg-[var(--pink-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--pink-primary)]">
                              {activeListComparison.targetMonthLabel}
                            </span>
                          </div>
                          <p className="font-mono-tabular text-xl font-bold text-[var(--text-primary)]">
                            {formatearMonto(activeListComparison.targetTotalUsd, 'USD', locale)}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                            <span>{activeListComparison.targetItemsCount} artículo(s)</span>
                            <span>
                              {activeListComparison.targetList.paymentMode === 'cashea'
                                ? '🛍️ Pagada con Cashea'
                                : '💵 Contado'}
                            </span>
                          </div>
                        </div>

                        <div
                          className={`rounded-xl p-3.5 border space-y-1 ${
                            activeListComparison.trend === 'increase'
                              ? 'bg-rose-500/10 border-rose-500/30'
                              : activeListComparison.trend === 'decrease'
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-[var(--surface)] border-[var(--border-hairline)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-[var(--text-primary)]">
                              Variación Lista B vs. Lista A
                            </span>
                            {activeListComparison.percentageChange !== null && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-mono-tabular font-bold ${
                                  activeListComparison.trend === 'increase'
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : activeListComparison.trend === 'decrease'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : 'bg-slate-500/20 text-slate-300'
                                }`}
                              >
                                {activeListComparison.percentageChange > 0 ? '+' : ''}
                                {activeListComparison.percentageChange.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <p
                            className={`font-mono-tabular text-xl font-bold ${
                              activeListComparison.trend === 'increase'
                                ? 'text-rose-400'
                                : activeListComparison.trend === 'decrease'
                                  ? 'text-emerald-400'
                                  : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {activeListComparison.differenceUsd > 0 ? '+' : ''}
                            {formatearMonto(activeListComparison.differenceUsd, 'USD', locale)}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono-tabular">
                            <span>
                              Artículos:{' '}
                              {activeListComparison.differenceItemsCount > 0 ? '+' : ''}
                              {activeListComparison.differenceItemsCount} ítems
                            </span>
                            <span>
                              En común: {activeListComparison.commonItems.length}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Resumen analítico en texto */}
                      <div className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]">
                        📊 <strong>Análisis:</strong> {activeListComparison.summaryText}
                      </div>

                      {/* Comparativa por Paradas / Categorías */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {activeListComparison.stopComparisons.map((st) => (
                          <div
                            key={st.stopId}
                            className="rounded-xl bg-[var(--surface)] p-2.5 border border-[var(--border-hairline)] space-y-1"
                          >
                            <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                              {st.emoji} {st.label}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[var(--text-secondary)]">
                              <span>Ítems A→B:</span>
                              <strong className="text-[var(--text-primary)]">
                                {st.baseItemsCount} → {st.targetItemsCount}
                              </strong>
                            </div>
                            {(st.baseUsd > 0 || st.targetUsd > 0) && (
                              <div className="text-[10px] font-mono-tabular text-emerald-400">
                                {formatearMonto(st.baseUsd, 'USD', locale)} →{' '}
                                {formatearMonto(st.targetUsd, 'USD', locale)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Pestañas de Comparación de Artículos (Repetidos, Nuevos en B, Omitidos en B) */}
                      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setListCompareItemTab('common')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                listCompareItemTab === 'common'
                                  ? 'bg-emerald-600 text-white'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              En ambas listas ({activeListComparison.commonItems.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setListCompareItemTab('only_target')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                listCompareItemTab === 'only_target'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Nuevos en Lista B ({activeListComparison.onlyInTargetItems.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setListCompareItemTab('only_base')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                listCompareItemTab === 'only_base'
                                  ? 'bg-blue-600 text-white'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Solo en Lista A ({activeListComparison.onlyInBaseItems.length})
                            </button>
                          </div>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            Compara cantidades y artículos aunque no tengan precio individual
                          </span>
                        </div>

                        <div className="max-h-60 overflow-y-auto divide-y divide-[var(--border-hairline)]">
                          {listCompareItemTab === 'common' &&
                            (activeListComparison.commonItems.length === 0 ? (
                              <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                                No hay productos con el mismo nombre entre ambas listas (o una de las listas es un registro histórico sin ítems).
                              </div>
                            ) : (
                              activeListComparison.commonItems.map((it) => (
                                <div
                                  key={it.normalizedKey}
                                  className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <span className="font-semibold text-[var(--text-primary)]">
                                      {it.nombre}
                                    </span>
                                    <span className="ml-2 text-[10px] text-[var(--text-secondary)]">
                                      ({it.categoria})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 font-mono-tabular text-[11px]">
                                    <span className="text-[var(--text-secondary)]">
                                      Cant: <strong>{it.baseQuantity}</strong> →{' '}
                                      <strong>{it.targetQuantity}</strong>
                                      {it.diffQuantity !== 0 && (
                                        <span
                                          className={`ml-1 font-bold ${
                                            it.diffQuantity > 0
                                              ? 'text-amber-400'
                                              : 'text-emerald-400'
                                          }`}
                                        >
                                          ({it.diffQuantity > 0 ? '+' : ''}
                                          {it.diffQuantity})
                                        </span>
                                      )}
                                    </span>
                                    {it.hasPriceData && (
                                      <span className="text-emerald-400 font-semibold">
                                        {formatearMonto(it.baseSubtotalUsd, 'USD', locale)} →{' '}
                                        {formatearMonto(it.targetSubtotalUsd, 'USD', locale)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ))}

                          {listCompareItemTab === 'only_target' &&
                            (activeListComparison.onlyInTargetItems.length === 0 ? (
                              <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                                No hay productos nuevos exclusivos en la Lista B.
                              </div>
                            ) : (
                              activeListComparison.onlyInTargetItems.map((it) => (
                                <div
                                  key={it.normalizedKey}
                                  className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <span className="font-semibold text-[var(--text-primary)]">
                                      + {it.nombre}
                                    </span>
                                    <span className="ml-2 text-[10px] text-[var(--text-secondary)]">
                                      ({it.categoria})
                                    </span>
                                  </div>
                                  <div className="font-mono-tabular text-[11px] text-[var(--pink-primary)] font-semibold">
                                    Cant: {it.targetQuantity}
                                    {it.hasPriceData &&
                                      ` · ${formatearMonto(it.targetSubtotalUsd, 'USD', locale)}`}
                                  </div>
                                </div>
                              ))
                            ))}

                          {listCompareItemTab === 'only_base' &&
                            (activeListComparison.onlyInBaseItems.length === 0 ? (
                              <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
                                Todos los productos de la Lista A también estuvieron en la Lista B.
                              </div>
                            ) : (
                              activeListComparison.onlyInBaseItems.map((it) => (
                                <div
                                  key={it.normalizedKey}
                                  className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <span className="font-semibold text-[var(--text-primary)]">
                                      - {it.nombre}
                                    </span>
                                    <span className="ml-2 text-[10px] text-[var(--text-secondary)]">
                                      ({it.categoria})
                                    </span>
                                  </div>
                                  <div className="font-mono-tabular text-[11px] text-blue-400 font-semibold">
                                    Cant en Lista A: {it.baseQuantity}
                                    {it.hasPriceData &&
                                      ` · ${formatearMonto(it.baseSubtotalUsd, 'USD', locale)}`}
                                  </div>
                                </div>
                              ))
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Selector de Listas / Pestañas de Navegación de Listas */}
        {marketLists.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {marketLists.map((list) => {
              const isSelected = list.id === selectedList?.id;
              const openStatus = list.estado === 'abierta';
              const itemsCount = list.items.length;
              const doneCount = list.items.filter((i) => i.comprado).length;

              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                  className={`flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-xs font-semibold border transition shrink-0 ${
                    isSelected
                      ? 'border-[var(--pink-primary)] bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      openStatus ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <div className="text-left">
                    <span className="block font-bold truncate max-w-[140px] sm:max-w-[180px]">
                      {list.nombre}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] block">
                      {doneCount}/{itemsCount} comprados · {formatDateShort(list.fecha)}
                    </span>
                  </div>
                  {openStatus ? (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                      Abierta
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                      Cerrada
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Contenido de la Lista Seleccionada */}
        {!selectedList ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-hairline)] bg-[var(--surface)] p-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
              No tienes ninguna lista de mercado activa
            </h3>
            <p className="mx-auto max-w-md text-xs text-[var(--text-secondary)]">
              Crea tu primera lista con presupuesto global estimado y comienza a tildar con el
              pulgar en cada parada (Feria, Carnicería, Charcutería, etc.).
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[var(--pink-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--pink-dark)]"
            >
              <Plus className="h-4 w-4" />
              Crear Lista de Mercado
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tarjeta de Control de la Lista Actual */}
            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface)] p-5 shadow-sm space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between border-b border-[var(--border-hairline)] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
                      {selectedList.nombre}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleOpenEditListModal(selectedList)}
                      title="Editar nombre, fecha y monto global estimado de la lista"
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface-hover)] transition"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                      <span>Editar Nombre / Fecha</span>
                    </button>
                    {selectedList.estado === 'abierta' ? (
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        Abierta (En Proyección)
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-500/20 px-2.5 py-0.5 text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Cerrada
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEditListModal(selectedList)}
                      title="Haz clic para cambiar la fecha o el mes de esta lista"
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-hairline)] px-2 py-0.5 text-xs font-mono-tabular text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
                    >
                      <span>📅 {formatDateShort(selectedList.fecha)}</span>
                      <Edit2 className="w-3 h-3 opacity-70" />
                    </button>
                  </div>

                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {selectedList.estado === 'abierta' ? (
                      <>
                        Monto Global de la Lista:{' '}
                        <strong className="text-[var(--text-primary)] font-mono-tabular">
                          {selectedList.moneda} {selectedList.presupuestoEstimado.toFixed(2)}
                        </strong>{' '}
                        ({formatearMonto(selectedList.presupuestoEstimadoUsd, 'USD', locale)}) —{' '}
                        <span className="text-amber-400 font-semibold">
                          restando a tu Saldo Proyectado
                        </span>
                      </>
                    ) : selectedList.paymentMode === 'cashea' &&
                      typeof selectedList.casheaFinancedUsd === 'number' &&
                      selectedList.casheaFinancedUsd > 0 ? (
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          Total Factura Mercado:{' '}
                          <strong className="text-emerald-400 font-mono-tabular">
                            {formatearMonto(selectedList.totalPagadoRealUsd || 0, 'USD', locale)}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Pagado al cerrar:{' '}
                          <strong className="text-[var(--text-primary)] font-mono-tabular">
                            {formatearMonto(selectedList.paidTodayAmountUsd || 0, 'USD', locale)}
                          </strong>
                        </span>
                        <span>·</span>
                        <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                          🛍️ {selectedList.casheaStoreOrPlatform || 'Cashea'}:{' '}
                          {formatearMonto(selectedList.casheaFinancedUsd, 'USD', locale)} en{' '}
                          {selectedList.casheaInstallmentsCount || 1} cuota
                          {(selectedList.casheaInstallmentsCount || 1) === 1 ? '' : 's'}
                        </span>
                      </span>
                    ) : (
                      <>
                        Total Real Pagado:{' '}
                        <strong className="text-emerald-400 font-mono-tabular">
                          {selectedList.paymentCurrency || selectedList.moneda}{' '}
                          {(selectedList.totalPagadoReal || 0).toFixed(2)}
                        </strong>{' '}
                        (
                        {formatearMonto(
                          selectedList.totalPagadoRealUsd || 0,
                          'USD',
                          locale
                        )}
                        ) debitado de tu Saldo Real
                      </>
                    )}
                  </p>
                </div>

                {/* Botones de acción principales */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedList.estado === 'cerrada' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenInvoiceForList(selectedList)}
                        title="Ver e imprimir la Factura de Compra de este mercado con todos sus ítems y total pagado"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
                      >
                        <FileText className="w-4 h-4" />
                        <span>🧾 Ver / Imprimir Factura</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoiceImage(selectedList)}
                        title="Descargar recibo de factura en imagen PNG"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Descargar PNG</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePrint}
                      title="Imprimir lista para llevar en papel con lápiz"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      <Printer className="w-4 h-4 text-[var(--pink-primary)]" />
                      <span className="hidden sm:inline">Imprimir Checklist</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenDuplicateModal(selectedList)}
                    title="Clonar artículos de esta lista para una nueva compra"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  >
                    <Copy className="w-4 h-4 text-blue-400" />
                    <span>Duplicar Lista</span>
                  </button>

                  {selectedList.estado === 'abierta' ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCloseModal(selectedList)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Cerrar Lista (Pagar)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReopen(selectedList)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs font-semibold text-amber-400 hover:bg-[var(--surface-hover)]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reabrir Lista</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDeletingList(selectedList)}
                    title="Eliminar lista"
                    className="rounded-xl p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Banner destacado de Factura disponible cuando la lista está cerrada */}
              {selectedList.estado === 'cerrada' && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono-tabular font-bold text-emerald-300">
                        {getInvoiceFolio(selectedList)}
                      </span>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        🧾 Factura de Compra de Mercado Lista para Imprimir
                      </h4>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Incluye los <strong>{selectedList.items.length} artículos</strong> de tu lista
                      (aunque no tengan precio individual) junto con el monto total real pagado de{' '}
                      <strong className="text-emerald-400 font-mono-tabular">
                        {formatearMonto(selectedList.totalPagadoRealUsd || 0, 'USD', locale)}
                      </strong>
                      .
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenInvoiceForList(selectedList)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Ver Factura / Imprimir PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoiceImage(selectedList)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-[var(--surface-hover)] transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Guardar Imagen PNG</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Comparativa Visual de Totales: Monto Global de la Lista vs Suma de los ítems detallados */}
              {budgetComparison && (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-4 space-y-3">
                  {/* Encabezado del pequeño dashboard con moneda activa y tasa referencial */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[var(--border-hairline)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        Resumen del Presupuesto de Lista
                      </span>
                      <span className="rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-primary)]">
                        Moneda: {selectedList.moneda === 'VES' ? 'Bolívares (Bs.)' : 'Dólares ($ USD)'}
                      </span>
                    </div>

                    {selectedList.moneda === 'VES' && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-mono-tabular font-semibold text-emerald-400">
                          Tasa Lista: Bs. {(budgetComparison.tasaReferencial || 450).toFixed(2)} / $
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditListModal(selectedList)}
                          className="text-[10px] font-semibold text-[var(--pink-primary)] hover:underline"
                        >
                          Cambiar tasa
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {/* 1. Monto Global de la Lista */}
                    <div className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-hairline)] flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                          Monto Global de la Lista
                        </span>
                        <p className="mt-0.5 font-mono-tabular text-lg font-bold text-[var(--text-primary)]">
                          {formatearMonto(
                            budgetComparison.montoGlobalLista,
                            selectedList.moneda,
                            locale
                          )}
                        </p>
                        {selectedList.moneda === 'VES' && (
                          <p className="font-mono-tabular text-xs font-bold text-emerald-400">
                            ≈ {formatearMonto(budgetComparison.montoGlobalListaUsd, 'USD', locale)}
                          </p>
                        )}
                        <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">
                          Presupuesto maestro estimado
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenEditListModal(selectedList)}
                        title="Modificar Monto Global de la Lista"
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-2 text-[var(--text-secondary)] hover:text-[var(--pink-primary)] hover:border-[var(--pink-primary)] transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 2. Suma de los ítems detallados */}
                    <div className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-hairline)]">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                        Suma de los ítems detallados
                      </span>
                      <p className="mt-0.5 font-mono-tabular text-lg font-bold text-emerald-400">
                        {formatearMonto(
                          budgetComparison.sumaItemsDetallados,
                          selectedList.moneda,
                          locale
                        )}
                      </p>
                      {selectedList.moneda === 'VES' && (
                        <p className="font-mono-tabular text-xs font-bold text-[var(--text-primary)]">
                          ≈ {formatearMonto(budgetComparison.sumaItemsDetalladosUsd, 'USD', locale)}
                        </p>
                      )}
                      <span className="text-[10px] text-[var(--text-secondary)] block mt-0.5">
                        {budgetComparison.itemsConPrecioCount} artículo(s) con precio ·{' '}
                        {budgetComparison.itemsSinPrecioCount} solo nombre
                      </span>
                    </div>

                    {/* 3. Balance / Comparación Visual */}
                    <div className="rounded-xl bg-[var(--surface)] p-3 border border-[var(--border-hairline)] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                            {budgetComparison.excesoSobreGlobal > 0
                              ? 'Exceso sobre Monto Global'
                              : 'Margen disponible en Lista'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono-tabular ${
                              budgetComparison.excesoSobreGlobal > 0
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {budgetComparison.porcentajeCubiertoPorItems}% detallado
                          </span>
                        </div>

                        <p
                          className={`mt-0.5 font-mono-tabular text-lg font-bold ${
                            budgetComparison.excesoSobreGlobal > 0
                              ? 'text-rose-400'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {budgetComparison.excesoSobreGlobal > 0
                            ? `+${formatearMonto(
                                budgetComparison.excesoSobreGlobal,
                                selectedList.moneda,
                                locale
                              )}`
                            : formatearMonto(
                                budgetComparison.diferenciaDisponible,
                                selectedList.moneda,
                                locale
                              )}
                        </p>

                        {selectedList.moneda === 'VES' && (
                          <p
                            className={`font-mono-tabular text-xs font-bold ${
                              budgetComparison.excesoSobreGlobal > 0
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            ≈{' '}
                            {budgetComparison.excesoSobreGlobal > 0
                              ? `+${formatearMonto(
                                  budgetComparison.excesoSobreGlobalUsd,
                                  'USD',
                                  locale
                                )}`
                              : formatearMonto(
                                  budgetComparison.diferenciaDisponibleUsd,
                                  'USD',
                                  locale
                                )}
                          </p>
                        )}
                      </div>

                      {budgetComparison.sumaItemsDetallados > 0 &&
                      Math.abs(
                        budgetComparison.sumaItemsDetallados -
                          budgetComparison.montoGlobalLista
                      ) > 0.009 ? (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateData((prev) =>
                              StorageService.updateMarketList(
                                selectedList.id,
                                {
                                  presupuestoEstimado:
                                    budgetComparison.sumaItemsDetallados,
                                },
                                prev
                              )
                            );
                            showToast(
                              `Monto Global actualizado a ${formatearMonto(
                                budgetComparison.sumaItemsDetallados,
                                selectedList.moneda,
                                locale
                              )} según la suma de ítems detallados.`,
                              'info'
                            );
                          }}
                          className="mt-1 text-left text-[10px] font-semibold text-[var(--pink-primary)] hover:underline"
                        >
                          Igualar Monto Global a la suma detallada →
                        </button>
                      ) : (
                        <span className="mt-1 text-[10px] text-[var(--text-secondary)]">
                          {budgetComparison.sumaItemsCompradosDetallados > 0
                            ? `En carrito con precio: ${formatearMonto(
                                budgetComparison.sumaItemsCompradosDetallados,
                                selectedList.moneda,
                                locale
                              )}${
                                selectedList.moneda === 'VES'
                                  ? ` (≈ ${formatearMonto(
                                      budgetComparison.sumaItemsCompradosDetalladosUsd,
                                      'USD',
                                      locale
                                    )})`
                                  : ''
                              }`
                            : 'Añade cantidad y monto opcional a tus ítems'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barra comparativa entre Suma Detallada y Monto Global */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[var(--text-secondary)]">
                      <span>
                        Comparativa: Suma de ítems detallados vs. Monto Global de la Lista
                      </span>
                      <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                        {formatearMonto(
                          budgetComparison.sumaItemsDetallados,
                          selectedList.moneda,
                          locale
                        )}{' '}
                        /{' '}
                        {formatearMonto(
                          budgetComparison.montoGlobalLista,
                          selectedList.moneda,
                          locale
                        )}
                        {selectedList.moneda === 'VES' && (
                          <span className="ml-1.5 text-emerald-400">
                            (≈{' '}
                            {formatearMonto(
                              budgetComparison.sumaItemsDetalladosUsd,
                              'USD',
                              locale
                            )}{' '}
                            /{' '}
                            {formatearMonto(
                              budgetComparison.montoGlobalListaUsd,
                              'USD',
                              locale
                            )}
                            )
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface)] border border-[var(--border-hairline)]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          budgetComparison.excesoSobreGlobal > 0
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                            : 'bg-gradient-to-r from-blue-500 to-emerald-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, budgetComparison.porcentajeCubiertoPorItems)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Barra de Progreso Táctil */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)]">
                    Progreso en el carrito: {boughtCount} de {totalItemsCount} artículos tildados (
                    {progressPct}%)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAll(true)}
                      className="text-[11px] text-[var(--pink-primary)] hover:underline"
                    >
                      Marcar todos
                    </button>
                    <span className="text-[var(--text-secondary)]">·</span>
                    <button
                      type="button"
                      onClick={() => handleToggleAll(false)}
                      className="text-[11px] text-[var(--text-secondary)] hover:underline"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Formulario de Añadir Ítem con Cantidad y Monto Unitario (Estrictamente Opcionales) */}
              <form
                onSubmit={handleQuickAddItem}
                className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3 space-y-2.5"
              >
                <div className="flex flex-col lg:flex-row gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={quickItemName}
                      onChange={(e) => setQuickItemName(e.target.value)}
                      placeholder="Nombre del artículo (ej: Plátanos, Carne, Leche...)"
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/60"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:flex items-center gap-2">
                    <div className="sm:w-28">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quickItemQuantity}
                        onChange={(e) => setQuickItemQuantity(e.target.value)}
                        placeholder="Cant. (Opc.)"
                        title="Cantidad opcional (ej. 2, 1.5)"
                        className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2.5 text-xs font-mono-tabular text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/60"
                      />
                    </div>

                    <div className="sm:w-36">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={quickItemUnitPrice}
                        onChange={(e) => setQuickItemUnitPrice(e.target.value)}
                        placeholder={`Monto ${selectedList.moneda} (Opc.)`}
                        title="Monto unitario opcional (deja en blanco si solo quieres guardar el nombre)"
                        className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2.5 text-xs font-mono-tabular text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/60"
                      />
                    </div>

                    <select
                      value={quickItemStop}
                      onChange={(e) =>
                        setQuickItemStop(e.target.value as MarketCategoryStop)
                      }
                      className="col-span-2 sm:col-span-1 rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                    >
                      {MARKET_STOPS.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.shortLabel}
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--pink-primary)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--pink-dark)] shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Añadir Ítem</span>
                    </button>
                  </div>
                </div>

                {/* Vista previa sutil si el usuario ingresa monto o cantidad al agregar */}
                {(quickItemQuantity.trim() !== '' || quickItemUnitPrice.trim() !== '') && (
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-1">
                    <span>
                      Los campos <strong>Cantidad</strong> y <strong>Monto</strong> son opcionales.
                    </span>
                    {Number(quickItemUnitPrice) > 0 && (
                      <span className="font-mono-tabular font-semibold text-emerald-400">
                        Subtotal estimado:{' '}
                        {formatearMonto(
                          (Number(quickItemQuantity) > 0 ? Number(quickItemQuantity) : 1) *
                            Number(quickItemUnitPrice),
                          selectedList.moneda,
                          locale
                        )}
                        {selectedList.moneda === 'VES' && budgetComparison && (
                          <span className="ml-1 text-[var(--text-primary)]">
                            (≈{' '}
                            {formatearMonto(
                              ((Number(quickItemQuantity) > 0 ? Number(quickItemQuantity) : 1) *
                                Number(quickItemUnitPrice)) /
                                (budgetComparison.tasaReferencial || 450),
                              'USD',
                              locale
                            )}
                            )
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </form>

              {/* Barra de Filtros, Búsqueda y Control de Categorías Desplegables */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['all', 'pending', 'bought'] as const).map((filter) => {
                    const label =
                      filter === 'all'
                        ? `Todos (${totalItemsCount})`
                        : filter === 'pending'
                          ? `Por comprar (${totalItemsCount - boughtCount})`
                          : `Comprados (${boughtCount})`;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setItemFilter(filter)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          itemFilter === filter
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Botones rápidos para desplegar u ocultar todas las categorías */}
                  <div className="inline-flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-0.5">
                    <button
                      type="button"
                      onClick={() => handleToggleAllStopsCollapse(false)}
                      title="Desplegar los artículos de todas las categorías"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] transition"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Desplegar todas</span>
                    </button>
                    <span className="h-3.5 w-px bg-[var(--border-hairline)]" />
                    <button
                      type="button"
                      onClick={() => handleToggleAllStopsCollapse(true)}
                      title="Ocultar los artículos dejando solo el título de cada categoría"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] transition"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Ocultar todas</span>
                    </button>
                  </div>

                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar artículo..."
                      className="w-full sm:w-48 rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist Agrupado por Paradas / Categorías Desplegables */}
            <div className="space-y-4">
              {MARKET_STOPS.map((stop) => {
                const itemsInStop = groupedByStop.get(stop.id) || [];
                if (itemsInStop.length === 0) return null;

                const stopBoughtCount = itemsInStop.filter((i) => i.comprado).length;
                const isCollapsed = !!collapsedStops[stop.id];

                return (
                  <div
                    key={stop.id}
                    className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--surface)] overflow-hidden shadow-xs transition-all"
                  >
                    {/* Cabecera de la Categoría (Clicable para ocultar/desplegar sus ítems) */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={!isCollapsed}
                      onClick={() => toggleStopCollapse(stop.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleStopCollapse(stop.id);
                        }
                      }}
                      className={`px-5 py-3.5 bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] flex items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                        isCollapsed ? '' : 'border-b border-[var(--border-hairline)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${stop.badgeBg}`}
                        >
                          {getStopIcon(stop.id)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {stop.label}
                          </h4>
                          <span className="text-[10px] text-[var(--text-secondary)] block">
                            {stopBoughtCount} de {itemsInStop.length} artículos tildados
                            {isCollapsed ? ' · Categoría contraída' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            stopBoughtCount === itemsInStop.length
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]'
                          }`}
                        >
                          {stopBoughtCount === itemsInStop.length
                            ? 'Completada'
                            : `${stopBoughtCount}/${itemsInStop.length}`}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStopCollapse(stop.id);
                          }}
                          title={
                            isCollapsed
                              ? `Desplegar artículos de ${stop.shortLabel}`
                              : `Ocultar artículos de ${stop.shortLabel}`
                          }
                          className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition"
                        >
                          <span>{isCollapsed ? 'Desplegar' : 'Ocultar'}</span>
                          {isCollapsed ? (
                            <ChevronDown className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                          ) : (
                            <ChevronUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Lista de Ítems Táctiles (Se oculta cuando la categoría está contraída) */}
                    {!isCollapsed && (
                      <div className="divide-y divide-[var(--border-hairline)]">
                        {itemsInStop.map((item) => {
                          const itemSubtotal = calcularSubtotalItemMercado(item);
                          const hasQuantityOnly =
                            itemSubtotal === null &&
                            typeof item.cantidad === 'number' &&
                            item.cantidad > 0;

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleToggleItem(item.id)}
                              className={`flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors active:scale-[0.99] touch-manipulation min-h-[52px] ${
                                item.comprado
                                  ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                                  : 'hover:bg-[var(--surface-subtle)]'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                {/* Casilla táctil amplia para el pulgar */}
                                <div
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-all ${
                                    item.comprado
                                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-xs'
                                      : 'border-[var(--border-input)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)]'
                                  }`}
                                >
                                  {item.comprado && <Check className="w-4 h-4 stroke-[3]" />}
                                </div>

                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span
                                    className={`text-sm sm:text-base font-medium truncate transition-all ${
                                      item.comprado
                                        ? 'line-through text-[var(--text-secondary)] opacity-60'
                                        : 'text-[var(--text-primary)]'
                                    }`}
                                  >
                                    {item.nombre}
                                  </span>

                                  {/* Si tiene cantidad y monto, muestra el pequeño subtotal sutil al lado del nombre */}
                                  {itemSubtotal !== null && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-mono-tabular font-semibold ${
                                        item.comprado
                                          ? 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] opacity-70'
                                          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                                      }`}
                                    >
                                      <span>
                                        {item.cantidad ?? 1} ×{' '}
                                        {formatearMonto(
                                          item.montoUnitario || 0,
                                          selectedList.moneda,
                                          locale
                                        )}{' '}
                                        ={' '}
                                        <strong>
                                          {formatearMonto(
                                            itemSubtotal,
                                            selectedList.moneda,
                                            locale
                                          )}
                                        </strong>
                                        {selectedList.moneda === 'VES' && budgetComparison && (
                                          <span className="ml-1 opacity-90">
                                            (≈{' '}
                                            {formatearMonto(
                                              itemSubtotal / (budgetComparison.tasaReferencial || 450),
                                              'USD',
                                              locale
                                            )}
                                            )
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                  )}

                                  {/* Si solo indicó cantidad sin precio, muestra cantidad discreta */}
                                  {hasQuantityOnly && (
                                    <span className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                                      Cant: {item.cantidad}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditItemModal(item);
                                  }}
                                  title="Editar artículo (nombre, cantidad y monto)"
                                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--pink-primary)] transition"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Editar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item.id);
                                  }}
                                  title="Eliminar artículo"
                                  className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-rose-400"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)] rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                  No hay artículos con el filtro seleccionado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Crear Nueva Lista de Mercado */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCreateList}
            className="w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pink-primary)]">
                  Gestión de Mercado
                </span>
                <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                  Nueva Lista de Mercado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Nombre de la Lista *
                </label>
                <input
                  type="text"
                  required
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Ej: Mercado Quincenal, Compras del Sábado..."
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Moneda del Presupuesto
                  </label>
                  <select
                    value={newListCurrency}
                    onChange={(e) => setNewListCurrency(e.target.value as CurrencyCode)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    <option value="USD">Dólares ($ USD)</option>
                    <option value="VES">Bolívares (Bs. VES)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Presupuesto Global Estimado *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newListBudget}
                    onChange={(e) => setNewListBudget(e.target.value)}
                    placeholder="80.00"
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {newListCurrency === 'VES' && (
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                      Tasa de Cambio Referencial (Bs/USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newListRate}
                      onChange={(e) => setNewListRate(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    />
                  </div>
                  {Number(newListBudget) > 0 && Number(newListRate) > 0 && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">Equivalente en Dólares:</span>
                      <span className="font-mono-tabular font-bold text-emerald-400">
                        ≈ {formatearMonto(Number(newListBudget) / Number(newListRate), 'USD', locale)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Fecha Prevista de Compra
                </label>
                <input
                  type="date"
                  required
                  value={newListDate}
                  onChange={(e) => setNewListDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="rounded-2xl bg-[var(--surface-subtle)] p-3 border border-[var(--border-hairline)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">
                  Lógica Financiera:
                </span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Este monto restará de tu <strong>Saldo Proyectado</strong> mientras la lista esté
                  abierta. Luego podrás añadir artículos con solo el nombre o incluir cantidad y
                  monto unitario opcionales para comparar contra este presupuesto global.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-[var(--border-input)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[var(--pink-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--pink-dark)]"
              >
                Crear Lista
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Lista Maestra (Nombre y Monto Global Estimado) */}
      {editingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmEditList}
            className="w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pink-primary)]">
                  Edición de Lista Maestra
                </span>
                <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                  Editar Lista de Mercado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingList(null)}
                className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Nombre de la Lista *
                </label>
                <input
                  type="text"
                  required
                  value={editListName}
                  onChange={(e) => setEditListName(e.target.value)}
                  placeholder="Ej: Mercado Quincenal..."
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Moneda
                  </label>
                  <select
                    value={editListCurrency}
                    onChange={(e) => setEditListCurrency(e.target.value as CurrencyCode)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    <option value="USD">Dólares ($ USD)</option>
                    <option value="VES">Bolívares (Bs. VES)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Monto Global Estimado *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editListBudget}
                    onChange={(e) => setEditListBudget(e.target.value)}
                    placeholder="80.00"
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {editListCurrency === 'VES' && (
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                      Tasa de Cambio Referencial (Bs/USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editListRate}
                      onChange={(e) => setEditListRate(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    />
                  </div>
                  {Number(editListBudget) > 0 && Number(editListRate) > 0 && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">Equivalente en Dólares:</span>
                      <span className="font-mono-tabular font-bold text-emerald-400">
                        ≈ {formatearMonto(Number(editListBudget) / Number(editListRate), 'USD', locale)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-[var(--text-secondary)]">
                    Fecha de la Compra / Mes Asignado *
                  </label>
                  {editListDate && /^\d{4}-\d{2}-\d{2}$/.test(editListDate) && (
                    <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      Mes en Estadísticas y Excel:{' '}
                      {MONTH_NAMES_ES[
                        Math.min(12, Math.max(1, Number(editListDate.split('-')[1]) || 1)) - 1
                      ] || 'Mes'}{' '}
                      {editListDate.split('-')[0]}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  required
                  value={editListDate}
                  onChange={(e) => setEditListDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                />
              </div>

              <div className="rounded-2xl bg-[var(--surface-subtle)] p-3 border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
                Al guardar, se actualizarán al instante el <strong>Monto Global Estimado</strong> y
                la <strong>Fecha / Mes de la compra</strong> tanto en la{' '}
                <strong>Hoja Mensual Tipo Excel</strong> como en tus{' '}
                <strong>Estadísticas y Movimientos</strong>.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setEditingList(null)}
                className="rounded-xl border border-[var(--border-input)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[var(--pink-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--pink-dark)]"
              >
                Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Ítem Individual (Nombre, Cantidad y Monto Opcionales) */}
      {editingItem && selectedList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmEditItem}
            className="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--pink-primary)]">
                  Editar Producto
                </span>
                <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                  Modificar Artículo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Nombre del Producto *
                </label>
                <input
                  type="text"
                  required
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  placeholder="Ej: Pechuga de pollo, Queso blanco..."
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Categoría / Parada
                </label>
                <select
                  value={editItemStop}
                  onChange={(e) => setEditItemStop(e.target.value as MarketCategoryStop)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none"
                >
                  {MARKET_STOPS.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Cantidad (Opcional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editItemQuantity}
                    onChange={(e) => setEditItemQuantity(e.target.value)}
                    placeholder="Ej: 2"
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-mono-tabular text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Monto Unitario ({selectedList.moneda}, Opc.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editItemUnitPrice}
                    onChange={(e) => setEditItemUnitPrice(e.target.value)}
                    placeholder="Ej: 4.50"
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-mono-tabular font-bold text-[var(--text-primary)] focus:border-[var(--pink-primary)] focus:outline-none"
                  />
                </div>
              </div>

              {/* Vista previa del subtotal o limpieza */}
              <div className="rounded-2xl bg-[var(--surface-subtle)] p-3 border border-[var(--border-hairline)] flex items-center justify-between gap-2">
                {Number(editItemUnitPrice) > 0 ? (
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] block">
                      Subtotal calculado del artículo:
                    </span>
                    <span className="font-mono-tabular text-sm font-bold text-emerald-400">
                      {Number(editItemQuantity) > 0 ? Number(editItemQuantity) : 1} ×{' '}
                      {formatearMonto(
                        Number(editItemUnitPrice),
                        selectedList.moneda,
                        locale
                      )}{' '}
                      ={' '}
                      {formatearMonto(
                        (Number(editItemQuantity) > 0 ? Number(editItemQuantity) : 1) *
                          Number(editItemUnitPrice),
                        selectedList.moneda,
                        locale
                      )}
                      {selectedList.moneda === 'VES' && budgetComparison && (
                        <span className="ml-1.5 text-xs text-[var(--text-primary)]">
                          (≈{' '}
                          {formatearMonto(
                            ((Number(editItemQuantity) > 0 ? Number(editItemQuantity) : 1) *
                              Number(editItemUnitPrice)) /
                              (budgetComparison.tasaReferencial || 450),
                            'USD',
                            locale
                          )}
                          )
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Sin monto asignado (se mostrará únicamente el nombre limpio).
                  </span>
                )}

                {(editItemQuantity.trim() !== '' || editItemUnitPrice.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditItemQuantity('');
                      setEditItemUnitPrice('');
                    }}
                    className="text-[11px] font-semibold text-rose-400 hover:underline shrink-0"
                  >
                    Limpiar precio
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-[var(--border-input)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[var(--pink-primary)] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--pink-dark)]"
              >
                Guardar Artículo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Cerrar Lista ("¿Cuánto gastaste en total en este mercado?") */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <form
            onSubmit={handleConfirmClose}
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  {showCloseModal.nombre}
                </span>
                <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                  Cerrar y Registrar Pago del Mercado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(null)}
                className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Modalidad: Contado vs Cashea / En Cuotas */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                ¿Cómo pagaste este mercado?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClosePaymentMode('contado')}
                  className={`rounded-2xl border p-3 text-left transition ${
                    closePaymentMode === 'contado'
                      ? 'border-emerald-500 bg-emerald-500/15 text-[var(--text-primary)] shadow-xs'
                      : 'border-[var(--border-input)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>💵 Pago de Contado</span>
                    {closePaymentMode === 'contado' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[10px] mt-0.5 opacity-80">
                    100% pagado hoy de tu billetera
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setClosePaymentMode('cashea');
                    if (!closePaidTodayAmount && parsedCloseNominal > 0) {
                      setClosePaidTodayAmount(
                        String(Math.round(parsedCloseNominal * 0.4 * 100) / 100)
                      );
                    }
                  }}
                  className={`rounded-2xl border p-3 text-left transition ${
                    closePaymentMode === 'cashea'
                      ? 'border-amber-500 bg-amber-500/15 text-[var(--text-primary)] shadow-xs'
                      : 'border-[var(--border-input)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>🛍️ Con Cashea / Cuotas</span>
                    {closePaymentMode === 'cashea' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <p className="text-[10px] mt-0.5 opacity-80">
                    Inicial hoy + cuotas en Agenda de Pagos
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  {closePaymentMode === 'cashea'
                    ? 'Billetera de donde pagaste hoy (Inicial + Contado) *'
                    : 'Billetera de Origen *'}
                </label>
                <select
                  value={closeWalletId}
                  onChange={(e) => setCloseWalletId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                >
                  {activeWallets.map((w) => {
                    const ws = walletSummaries.billeteras.find((s) => s.wallet.id === w.id);
                    const bal = ws
                      ? formatearMonto(ws.saldoActualUsd, 'USD', locale)
                      : '$0.00';
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.currency}) — Disponible: {bal}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Moneda de Pago
                  </label>
                  <select
                    value={closeCurrency}
                    onChange={(e) => setCloseCurrency(e.target.value as CurrencyCode)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    <option value="USD">Dólares ($ USD)</option>
                    <option value="VES">Bolívares (Bs. VES)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    {closePaymentMode === 'cashea'
                      ? `Total Factura Mercado (${closeCurrency}) *`
                      : `Total Pagado Real (${closeCurrency}) *`}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={closeAmount}
                    onChange={(e) => setCloseAmount(e.target.value)}
                    placeholder="Ej: 170.00"
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-emerald-400"
                  />
                  {closeCurrency === 'VES' && parsedCloseNominal > 0 && (
                    <span className="mt-0.5 block text-[10px] font-mono-tabular text-emerald-400">
                      ≈ {formatearMonto(parsedCloseTotalUsd, 'USD', locale)}
                    </span>
                  )}
                </div>
              </div>

              {closeCurrency === 'VES' && (
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
                    <div>
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Tasa de Cambio Aplicada (Bs/USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={closeRate}
                        onChange={(e) => setCloseRate(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                        Calculadora rápida $ → Bs (Total $)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={closeUsdHelperTotal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCloseUsdHelperTotal(val);
                            const num = Number(val);
                            if (Number.isFinite(num) && num > 0) {
                              setCloseAmount(
                                String(Math.round(num * parsedCloseRateNum * 100) / 100)
                              );
                            }
                          }}
                          placeholder="Ej: 170 $"
                          className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Campos específicos de Pago con Cashea / En Cuotas */}
              {closePaymentMode === 'cashea' && (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span className="text-xs font-bold text-amber-300">
                      🛍️ Desglose de Pago con Cashea / En Cuotas
                    </span>
                    <span className="text-[10px] font-mono-tabular text-amber-200/90">
                      Categoría: Mercado / Alimentación
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-1">
                        Monto Pagado Hoy (Inicial + Contado en {closeCurrency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={closePaidTodayAmount}
                        onChange={(e) => setClosePaidTodayAmount(e.target.value)}
                        placeholder={closeCurrency === 'USD' ? 'Ej: 70.00' : 'Monto en Bs pagado hoy'}
                        className="w-full rounded-xl border border-amber-500/40 bg-[var(--surface)] px-3.5 py-2.5 text-sm font-bold text-amber-300"
                      />
                      {closeCurrency === 'VES' && (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono-tabular text-amber-300">
                            ≈ {formatearMonto(parsedClosePaidTodayUsd, 'USD', locale)}
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={closeUsdHelperPaid}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCloseUsdHelperPaid(val);
                              const num = Number(val);
                              if (Number.isFinite(num) && num >= 0) {
                                setClosePaidTodayAmount(
                                  String(Math.round(num * parsedCloseRateNum * 100) / 100)
                                );
                              }
                            }}
                            placeholder="O escribe $ hoy (ej: 70)"
                            className="w-36 rounded-lg border border-[var(--border-input)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-primary)]"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-1">
                        Plataforma / Comercio
                      </label>
                      <input
                        type="text"
                        value={closeCasheaPlatform}
                        onChange={(e) => setCloseCasheaPlatform(e.target.value)}
                        placeholder="Cashea"
                        className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  {/* Selector de cantidad de cuotas y frecuencia */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-1">
                        Cuotas pendientes por pagar
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setCloseCasheaInstallments(n)}
                            className={`rounded-xl py-2 text-xs font-bold border transition ${
                              closeCasheaInstallments === n
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-input)]'
                            }`}
                          >
                            {n} {n === 1 ? 'cuota' : 'cuotas'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[var(--text-primary)] mb-1">
                        Vencimiento de la 1ra Cuota
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={closeCasheaFirstDueDate}
                          onChange={(e) => setCloseCasheaFirstDueDate(e.target.value)}
                          className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                        />
                        <select
                          value={closeCasheaFrequency}
                          onChange={(e) => {
                            const freq = e.target.value as InstallmentFrequency;
                            setCloseCasheaFrequency(freq);
                            setCloseCasheaFirstDueDate(
                              addDaysToIsoDate(closeDate, freq === 'biweekly' ? 14 : 30)
                            );
                          }}
                          className="rounded-xl border border-[var(--border-input)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
                        >
                          <option value="biweekly">Cada 14 días</option>
                          <option value="monthly">Mensual</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta Resumen Automático Cashea */}
                  <div className="rounded-xl bg-[var(--surface)] border border-amber-500/30 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Total Factura del Mercado:
                      </span>
                      <span className="font-mono-tabular font-bold text-[var(--text-primary)]">
                        {formatearMonto(parsedCloseTotalUsd, 'USD', locale)}
                        {closeCurrency === 'VES' && (
                          <span className="ml-1 text-[10px] text-[var(--text-secondary)]">
                            ({formatearMonto(parsedCloseNominal, 'VES', locale)})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">
                        Se descuenta HOY de tu billetera:
                      </span>
                      <span className="font-mono-tabular font-bold text-emerald-400">
                        {formatearMonto(parsedClosePaidTodayUsd, 'USD', locale)}
                        {closeCurrency === 'VES' && (
                          <span className="ml-1 text-[10px] text-[var(--text-secondary)]">
                            ({formatearMonto(parsedClosePaidTodayNominal, 'VES', locale)})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border-hairline)]">
                      <span className="font-bold text-amber-300">
                        Queda financiado en {closeCasheaPlatform || 'Cashea'}:
                      </span>
                      <span className="font-mono-tabular font-bold text-amber-300">
                        {formatearMonto(parsedCasheaFinancedUsd, 'USD', locale)} (
                        {closeCasheaInstallments}{' '}
                        {closeCasheaInstallments === 1 ? 'cuota' : 'cuotas'} de{' '}
                        {formatearMonto(parsedCasheaPerInstallmentUsd, 'USD', locale)})
                        {closeCurrency === 'VES' && (
                          <span className="block text-right text-[10px] text-[var(--text-secondary)]">
                            ≈ {formatearMonto(parsedCasheaFinancedNominal, 'VES', locale)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Fecha de Compra / Cierre
                </label>
                <input
                  type="date"
                  required
                  value={closeDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setCloseDate(nextDate);
                    setCloseCasheaFirstDueDate(
                      addDaysToIsoDate(
                        nextDate,
                        closeCasheaFrequency === 'biweekly' ? 14 : 30
                      )
                    );
                  }}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>

              {/* Comisión bancaria opcional al cerrar mercado */}
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">
                    ¿Aplica comisión bancaria sobre el pago de hoy?
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Categoría: Comisiones Bancarias
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCloseFeeType('none')}
                    className={`rounded-lg py-1.5 px-2 text-[11px] font-bold border transition ${
                      closeFeeType === 'none'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-input)]'
                    }`}
                  >
                    Sin comisión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCloseFeeType('pago_movil');
                      setCloseFeeValueStr(
                        String(selectedCloseWallet?.comisionPagoMovil ?? 0.3)
                      );
                    }}
                    className={`rounded-lg py-1.5 px-2 text-[11px] font-bold border transition ${
                      closeFeeType === 'pago_movil'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-input)]'
                    }`}
                  >
                    📲 Pago Móvil ({selectedCloseWallet?.comisionPagoMovil ?? 0.3}%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCloseFeeType('transferencia');
                      const mode =
                        selectedCloseWallet?.comisionTransferenciaTipo ||
                        (selectedCloseWallet?.isBonusCard ? 'percent' : 'fixed_ves');
                      setCloseTransferFeeMode(mode);
                      setCloseFeeValueStr(
                        String(
                          selectedCloseWallet?.comisionTransferencia ??
                            (mode === 'fixed_ves' ? 54 : 1.5)
                        )
                      );
                    }}
                    className={`rounded-lg py-1.5 px-2 text-[11px] font-bold border transition ${
                      closeFeeType === 'transferencia'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-input)]'
                    }`}
                  >
                    🏦 Transferencia
                  </button>
                </div>
                {closeFeeType !== 'none' && (
                  <div className="pt-1.5 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      Comisión estimada hoy:
                    </span>
                    <span className="text-xs font-bold text-amber-400">
                      + {formatearMonto(calculatedCloseFee, closeCurrency, locale)} (Total hoy:{' '}
                      {formatearMonto(
                        parsedClosePaidTodayNominal + calculatedCloseFee,
                        closeCurrency,
                        locale
                      )}
                      )
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Notas de Cierre (Opcional)
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Mercado mensual en Central Madeirense..."
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setShowCloseModal(null)}
                className="rounded-xl border border-[var(--border-input)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition ${
                  closePaymentMode === 'cashea'
                    ? 'bg-amber-600 hover:bg-amber-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {closePaymentMode === 'cashea'
                  ? 'Confirmar Inicial y Crear Cuota(s) Cashea'
                  : 'Confirmar Egreso y Cerrar Lista'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Duplicar Lista */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmDuplicate}
            className="w-full max-w-lg rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  Productividad
                </span>
                <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                  Duplicar Lista de Mercado
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(null)}
                className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Se clonarán los <strong>{showDuplicateModal.items.length} artículos</strong> de «
              {showDuplicateModal.nombre}», reseteándolos todos como no comprados para tu próxima
              visita al supermercado.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Nombre de la Nueva Lista *
                </label>
                <input
                  type="text"
                  required
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Moneda
                  </label>
                  <select
                    value={dupCurrency}
                    onChange={(e) => setDupCurrency(e.target.value as CurrencyCode)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    <option value="USD">Dólares ($ USD)</option>
                    <option value="VES">Bolívares (Bs. VES)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Presupuesto Estimado
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={dupBudget}
                    onChange={(e) => setDupBudget(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Fecha de la Nueva Lista
                </label>
                <input
                  type="date"
                  required
                  value={dupDate}
                  onChange={(e) => setDupDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-input)] bg-[var(--surface-subtle)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(null)}
                className="rounded-xl border border-[var(--border-input)] px-4 py-2.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-500"
              >
                Crear Lista Duplicada
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Confirmar Eliminación de Lista */}
      {deletingList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] p-6 shadow-xl space-y-4">
            <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
              Eliminar «{deletingList.nombre}»
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              ¿Estás seguro de que deseas eliminar esta lista de mercado con sus{' '}
              {deletingList.items.length} artículos? Las transacciones asociadas también serán
              eliminadas.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingList(null)}
                className="rounded-xl border border-[var(--border-input)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteList(deletingList)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa e Impresión del Reporte de Lista de Mercado */}
      {showPrintModal && selectedList && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto"
          onClick={() => setShowPrintModal(false)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barra de herramientas superior de la vista previa */}
            <div className="px-5 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  {printDocMode === 'invoice' ? (
                    <FileText className="w-4 h-4" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                    {printDocMode === 'invoice'
                      ? '🧾 Factura de Compra de Mercado'
                      : '📋 Hoja de Compras (Checklist para llevar)'}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {printDocMode === 'invoice'
                      ? 'Recibo oficial con todos los artículos y el monto total pagado en caja'
                      : 'Hoja con casillas para marcar con lápiz mientras compras en el mercado'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Selector de Modo: Factura vs Checklist */}
                <div className="inline-flex items-center rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintDocMode('invoice')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                      printDocMode === 'invoice'
                        ? 'bg-emerald-600 text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    🧾 Modo Factura
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintDocMode('checklist')}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                      printDocMode === 'checklist'
                        ? 'bg-[var(--pink-primary)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    📋 Modo Checklist
                  </button>
                </div>

                {printDocMode === 'invoice' ? (
                  <div className="inline-flex items-center rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setInvoiceItemsFilter('all')}
                      className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                        invoiceItemsFilter === 'all'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Todos ({totalItemsCount})
                    </button>
                    {boughtCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setInvoiceItemsFilter('bought')}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                          invoiceItemsFilter === 'bought'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Solo marcados ({boughtCount})
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Filtro: Todos vs Solo pendientes */}
                    <div className="inline-flex items-center rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setPrintFilterMode('all')}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                          printFilterMode === 'all'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Todos ({totalItemsCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintFilterMode('pending')}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                          printFilterMode === 'pending'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Solo pendientes ({totalItemsCount - boughtCount})
                      </button>
                    </div>

                    {/* Toggle: Mostrar precios */}
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--text-primary)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={printIncludePrices}
                        onChange={(e) => setPrintIncludePrices(e.target.checked)}
                        className="rounded text-[var(--pink-primary)]"
                      />
                      <span>Incluir precios</span>
                    </label>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleDownloadInvoiceImage(selectedList)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 text-xs font-bold text-emerald-400 transition cursor-pointer"
                  title="Descargar la factura como imagen PNG lista para compartir o guardar"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PNG</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerBrowserPrint}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Guardar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="rounded-xl p-2 text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]"
                  title="Cerrar vista previa"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lienzo de la Hoja A4 en Vista Previa */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100/80 dark:bg-slate-900/60 flex-1">
              <div className="max-w-3xl mx-auto">
                {printDocMode === 'invoice'
                  ? renderMarketInvoiceSheet()
                  : renderMarketReportSheet()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WIDGET INTERACTIVO PARA EL DASHBOARD PRINCIPAL
// ============================================================================

interface MarketDashboardWidgetProps {
  data: AppDataSchema;
  activeRate: number | null;
  onNavigateToModule: () => void;
}

export const MarketDashboardWidget: React.FC<MarketDashboardWidgetProps> = ({
  data,
  activeRate,
  onNavigateToModule,
}) => {
  const locale = data.settings.numberFormatLocale || 'es-VE';
  const marketLists = data.marketLists || [];
  const openLists = marketLists.filter((l) => l.estado === 'abierta');
  const summary = calcularResumenMercado(marketLists);

  if (marketLists.length === 0) return null;

  const currentActive = openLists[0] || marketLists[0];
  const boughtCount = currentActive.items.filter((i) => i.comprado).length;
  const totalCount = currentActive.items.length;
  const pct = totalCount > 0 ? Math.round((boughtCount / totalCount) * 100) : 0;

  return (
    <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Lista de Mercado Simple (Checklist Táctil)
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {summary.listasAbiertas} lista(s) abierta(s) · Presupuesto en proyección:{' '}
              <strong className="text-emerald-400 font-mono-tabular">
                {formatearMonto(summary.presupuestoProyectadoTotalUsd, 'USD', locale)}
              </strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToModule}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Abrir Checklist Táctil →</span>
        </button>
      </div>

      <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[var(--text-primary)]">
              {currentActive.nombre}
            </span>
            {currentActive.estado === 'abierta' ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                Abierta
              </span>
            ) : (
              <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                Cerrada
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-[var(--text-secondary)] font-mono-tabular">
            {boughtCount} de {totalCount} comprados ({pct}%)
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface)] border border-[var(--border-hairline)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
          <span>Fecha: {formatDateShort(currentActive.fecha)}</span>
          <span className="font-mono-tabular">
            Presupuesto: {currentActive.moneda} {currentActive.presupuestoEstimado.toFixed(2)}
            {currentActive.moneda === 'VES' && (
              <span className="ml-1 font-semibold text-emerald-400">
                (≈ {formatearMonto(currentActive.presupuestoEstimadoUsd, 'USD', locale)})
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

