import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Briefcase,
  Calculator,
  Calendar,
  CreditCard,
  Download,
  Edit3,
  Copy,
  FolderKanban,
  Heart,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Palette,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Upload,
  Wallet,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Landmark,
  Gift,
  HeartHandshake,
  ShoppingBag,
  Smartphone,
  CheckSquare,
  CalendarClock,
  ArrowLeftRight,
  ArrowRight,
  FileText,
  Printer,
  Shield,
  Utensils,
  Compass,
} from 'lucide-react';
import {
  AppDataSchema,
  Category,
  CategoryType,
  CreditInstallment,
  CreditPurchase,
  CurrencyCode,
  Debt,
  DebtPayment,
  LoanKind,
  MonthlyBudget,
  NavigationSection,
  P2POperation,
  RateHistoryEntry,
  SavingsGoal,
  SavingsMovement,
  ThemeMode,
  Transaction,
  TransactionStatus,
  TransactionType,
  WalletAccount,
  WalletKind,
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from './types/finance';
import {
  createInitialAppData,
  generateDemoDataset,
  INITIAL_WALLETS,
} from './data/defaultData';
import {
  formatearEquivalenciaTasa,
  formatearMonto,
  formatearPorcentaje,
  formatearTasa,
  obtenerTasaBCV,
} from './services/bcvApi';
import {
  AnalisisPoderAdquisitivoResult,
  calcularAnalisisPoderAdquisitivo,
  calcularDistribucionPorCategoria,
  calcularEquivalenteUsd,
  calcularEstadoDeuda,
  calcularEstadoPresupuestoPorCategoria,
  calcularProgresoMeta,
  calcularResumenBilleteras,
  calcularResumenFinanciero,
  calcularResumenPrestamos,
  calcularSaldoProyectado,
  compararRegistrosConHoraRecientesPrimero,
  compararTransaccionesPorFechaYHoraProceso,
  compararTransaccionesRecientesPrimero,
  esBilleteraEfectivo,
  esTransaccionCompletada,
  formatearNombreMes,
  obtenerFechaEfectivaContableTransaccion,
  obtenerFechaLocalIso,
  obtenerIdCategoriaComisionBancaria,
  obtenerInfoHoraProcesoTransaccion,
  obtenerMesLocalIso,
  obtenerSerieMensual,
  ResumenBilleteraItem,
} from './utils/calculations';
import {
  cargarDatosLocalStorage,
  fusionarRespaldos,
  generarArchivoRespaldoJson,
  guardarDatosLocalStorage,
  StorageService,
  validarYNormalizarRespaldo,
} from './utils/storage';
import {
  descargarPlantillaExcelTasas,
  descargarPlantillaJsonTasas,
  fusionarTasasHistoricasEnHistorial,
  HistoricalRatesImportResult,
  obtenerTasaPorFecha,
  parsearExcelTasasHistoricas,
  parsearJsonTasasHistoricas,
  registrarTasaDelDiaEnHistorial,
} from './utils/historicalRatesImporter';
import {
  BudgetComparisonChart,
  CategoryDonutChart,
  IncomeVsExpenseBarChart,
  MonthlyBalanceLineChart,
  SavingsProgressChart,
} from './components/ChartsView';
import {
  TransactionModal,
  PresetTransactionValues,
} from './components/TransactionModal';
import { GoalModal, SavingsModal } from './components/SavingsAndGoalsModals';
import { WishlistModal } from './components/WishlistModal';
import { WishlistView } from './components/WishlistView';
import { UsdToVesHelper } from './components/UsdToVesHelper';
import { CoupleFinanceView } from './components/CoupleFinanceView';
import { ImportSharedExpensesModal } from './components/ImportSharedExpensesModal';
import {
  InstallmentsModuleView,
  PayInstallmentModal,
} from './components/InstallmentsModuleView';
import {
  calcularResumenComprasACuotas,
  PayInstallmentInput,
  registrarPagoCuotaEnAppData,
} from './utils/installmentsController';
import {
  P2PExchangeView,
  SettleP2PModal,
} from './components/P2PExchangeView';
import {
  calcularResumenP2P,
  liquidarOperacionP2P,
  SettleP2POperationInput,
} from './utils/p2pController';
import {
  OfflineIndicator,
  PWAInstallButton,
} from './components/PWAInstallPrompt';
import { SubscriptionsModuleView } from './components/SubscriptionsModuleView';
import {
  AppCreditsDashboardWidget,
  AppCreditsModuleView,
} from './components/AppCreditsModuleView';
import {
  MarketDashboardWidget,
  MarketListView,
} from './components/MarketListView';
import { QuickPaymentFeeCalculator } from './components/QuickPaymentFeeCalculator';
import {
  PushNotificationBellButton,
  PushNotificationModal,
  PushNotificationSettingsPanel,
} from './components/PushNotificationCenter';
import {
  getPushEnvironmentStatus,
  loadPushNotificationConfig,
  PushNotificationConfig,
  scanPushReminders,
  syncAndDispatchDueReminders,
} from './services/pushNotifications';
import { WalletTransferSection } from './components/WalletTransferSection';
import { MonthlyReportPdfView } from './components/MonthlyReportPdfView';
import { AssetVaultView } from './components/AssetVaultView';
import { RomanceBudgetView } from './components/RomanceBudgetView';
import { YearlyWrappedModal } from './components/YearlyWrappedModal';
import {
  TrophyRoomContent,
  TrophyRoomModal,
} from './components/TrophyRoomModal';
import { WeeklyMenuPlannerView } from './components/WeeklyMenuPlannerView';
import { GuidedTourOverlay } from './components/GuidedTourOverlay';
import { UpcomingPaymentsView } from './components/UpcomingPaymentsView';

export const THEME_OPTIONS: {
  id: ThemeMode;
  pairedId: ThemeMode;
  mode: 'light' | 'dark';
  collection?: string;
  label: string;
  shortLabel: string;
  description: string;
  swatchBg: string;
  swatchAccent: string;
  swatchSecondary: string;
}[] = [
  // =========================================================================
  // COLECCIÓN ESPECIALIZADA SECTOR FINANCIERO — MODO CLARO (4 NUEVAS PAREJAS)
  // =========================================================================
  {
    id: 'neobank',
    pairedId: 'dark-neobank',
    mode: 'light',
    collection: 'Neo-Bank / Futurista',
    label: 'Claro Neo-Bank (Cobalto & Cian Ártico)',
    shortLabel: 'Claro Neo-Bank',
    description: 'Blanco polar tecnológico con azul eléctrico institucional y cian cuántico.',
    swatchBg: '#F4F7FB',
    swatchAccent: '#0052FF',
    swatchSecondary: '#0891B2',
  },
  {
    id: 'wealth',
    pairedId: 'dark-wealth',
    mode: 'light',
    collection: 'Wealth Management / Lujo',
    label: 'Claro Banca Privada (Marfil & Borgoña Imperial)',
    shortLabel: 'Claro Banca Privada',
    description: 'Pergamino suizo cálido con borgoña reserva, bronce mate y alto contraste.',
    swatchBg: '#FAF6F0',
    swatchAccent: '#7F1D3A',
    swatchSecondary: '#9A6E27',
  },
  {
    id: 'eco',
    pairedId: 'dark-eco',
    mode: 'light',
    collection: 'Eco-Finance / Sostenibilidad',
    label: 'Claro Eco-Finance (Hueso & Salvia Nórdica)',
    shortLabel: 'Claro Eco-Finance',
    description: 'Blanco hueso orgánico con verde salvia profundo y arcilla terracota suave.',
    swatchBg: '#F6F5F0',
    swatchAccent: '#2D6A4F',
    swatchSecondary: '#9C6644',
  },
  {
    id: 'corporate',
    pairedId: 'dark-corporate',
    mode: 'light',
    collection: 'Minimalista Corporativo',
    label: 'Claro Corporativo (Alabastro & Bermellón Suizo)',
    shortLabel: 'Claro Corporativo',
    description: 'Gris alabastro neutro de precisión con acento bermellón suizo y tinta negra.',
    swatchBg: '#F7F7F8',
    swatchAccent: '#D92D20',
    swatchSecondary: '#18181B',
  },
  // Combinaciones Claras Clásicas
  {
    id: 'rose',
    pairedId: 'dark-rose',
    mode: 'light',
    label: 'Claro con Rosa (Blush & Rosé)',
    shortLabel: 'Claro Rosa',
    description: 'Fondo marfil cálido con rosa empolvado, blush y lavanda suave.',
    swatchBg: '#FDFBF9',
    swatchAccent: '#C86D85',
    swatchSecondary: '#8A79A6',
  },
  {
    id: 'lavender',
    pairedId: 'dark-purple',
    mode: 'light',
    label: 'Claro con Lavanda (Lila & Violeta)',
    shortLabel: 'Claro Lavanda',
    description: 'Fondo perla suave con acentos violeta imperial, lila y malva.',
    swatchBg: '#FAF8FF',
    swatchAccent: '#7C3AED',
    swatchSecondary: '#C026D3',
  },
  {
    id: 'peach',
    pairedId: 'dark-gold',
    mode: 'light',
    label: 'Claro con Coral (Durazno & Ámbar)',
    shortLabel: 'Claro Coral',
    description: 'Fondo crema cálido con tonos coral rosado, durazno y terracota.',
    swatchBg: '#FFFDFB',
    swatchAccent: '#E06D53',
    swatchSecondary: '#D97706',
  },
  {
    id: 'emerald',
    pairedId: 'dark-emerald',
    mode: 'light',
    label: 'Claro con Esmeralda (Menta & Jade)',
    shortLabel: 'Claro Esmeralda',
    description: 'Fondo fresco botánico con verde esmeralda, menta suave y cielo.',
    swatchBg: '#F7FBF9',
    swatchAccent: '#0D9488',
    swatchSecondary: '#0284C7',
  },
  {
    id: 'masculine',
    pairedId: 'dark',
    mode: 'light',
    label: 'Claro con Azul (Ejecutivo Marino)',
    shortLabel: 'Claro Azul',
    description: 'Paleta sobria en blanco hielo con azul marino, acero e índigo.',
    swatchBg: '#F4F6F9',
    swatchAccent: '#1E40AF',
    swatchSecondary: '#4338CA',
  },
  // =========================================================================
  // COLECCIÓN ESPECIALIZADA SECTOR FINANCIERO — MODO OSCURO (4 NUEVAS PAREJAS)
  // =========================================================================
  {
    id: 'dark-neobank',
    pairedId: 'neobank',
    mode: 'dark',
    collection: 'Neo-Bank / Futurista',
    label: 'Oscuro Neo-Bank (Abismo & Cian Eléctrico)',
    shortLabel: 'Oscuro Neo-Bank',
    description: 'Obsidiana espacial con tarjetas pizarra criogénica, cian eléctrico e índigo.',
    swatchBg: '#04070D',
    swatchAccent: '#06B6D4',
    swatchSecondary: '#6366F1',
  },
  {
    id: 'dark-wealth',
    pairedId: 'wealth',
    mode: 'dark',
    collection: 'Wealth Management / Lujo',
    label: 'Oscuro Patrimonio (Medianoche & Oro Mate)',
    shortLabel: 'Oscuro Patrimonio',
    description: 'Azul medianoche suizo con oro mate centurión, rubí burdeos y marfil seda.',
    swatchBg: '#050811',
    swatchAccent: '#D4AF37',
    swatchSecondary: '#E15B76',
  },
  {
    id: 'dark-eco',
    pairedId: 'eco',
    mode: 'dark',
    collection: 'Eco-Finance / Sostenibilidad',
    label: 'Oscuro Bio-Capital (Bosque Nocturno & Salvia)',
    shortLabel: 'Oscuro Bio-Capital',
    description: 'Turba nocturna botánica con verde salvia luminoso y ocre tierra cálido.',
    swatchBg: '#050806',
    swatchAccent: '#52B788',
    swatchSecondary: '#DDA15E',
  },
  {
    id: 'dark-corporate',
    pairedId: 'corporate',
    mode: 'dark',
    collection: 'Minimalista Corporativo',
    label: 'Oscuro Monolito (Obsidiana & Naranja Terminal)',
    shortLabel: 'Oscuro Monolito',
    description: 'Acero monocromático puro con naranja terminal institucional de alto contraste.',
    swatchBg: '#050505',
    swatchAccent: '#FF5500',
    swatchSecondary: '#A1A1AA',
  },
  // Combinaciones Oscuras Clásicas (Base Negro Carbono + Ventanas en Grafito/Titanio)
  {
    id: 'dark-pro',
    pairedId: 'rose',
    mode: 'dark',
    label: 'Oscuro Pro (Negro Carbono & Titanio)',
    shortLabel: 'Oscuro Pro',
    description: 'Fondo negro puro con tarjetas grafito, ventanas en titanio y acentos violeta/esmeralda.',
    swatchBg: '#050507',
    swatchAccent: '#7C5CFC',
    swatchSecondary: '#10B981',
  },
  {
    id: 'dark',
    pairedId: 'masculine',
    mode: 'dark',
    label: 'Oscuro Grafito (Negro Mate & Acero)',
    shortLabel: 'Oscuro Grafito',
    description: 'Fondo negro carbón con superficies en antracita, ventanas titanio y acento índigo.',
    swatchBg: '#060608',
    swatchAccent: '#6366F1',
    swatchSecondary: '#38BDF8',
  },
  {
    id: 'dark-rose',
    pairedId: 'rose',
    mode: 'dark',
    label: 'Oscuro con Rosa (Carbono & Rosé)',
    shortLabel: 'Oscuro Rosa',
    description: 'Fondo negro carbono con detalles rosa, rose gold y lavanda.',
    swatchBg: '#060607',
    swatchAccent: '#E17A93',
    swatchSecondary: '#A594C4',
  },
  {
    id: 'dark-purple',
    pairedId: 'lavender',
    mode: 'dark',
    label: 'Oscuro con Morado (Carbono & Amatista)',
    shortLabel: 'Oscuro Morado',
    description: 'Fondo negro carbono con acentos púrpura vibrante y magenta.',
    swatchBg: '#060607',
    swatchAccent: '#A855F7',
    swatchSecondary: '#EC4899',
  },
  {
    id: 'dark-emerald',
    pairedId: 'emerald',
    mode: 'dark',
    label: 'Oscuro con Esmeralda (Carbono & Jade)',
    shortLabel: 'Oscuro Esmeralda',
    description: 'Fondo negro carbono con acentos verde esmeralda y turquesa.',
    swatchBg: '#050606',
    swatchAccent: '#10B981',
    swatchSecondary: '#14B8A6',
  },
  {
    id: 'dark-gold',
    pairedId: 'peach',
    mode: 'dark',
    label: 'Oscuro con Dorado (Ónix & Ámbar)',
    shortLabel: 'Oscuro Dorado',
    description: 'Fondo negro ónix de lujo con acentos dorado champán y ámbar.',
    swatchBg: '#060605',
    swatchAccent: '#E5A93B',
    swatchSecondary: '#EA580C',
  },
];

export function App() {
  const [appData, setAppData] = useState<AppDataSchema>(() =>
    cargarDatosLocalStorage()
  );
  const [activeSection, setActiveSection] =
    useState<NavigationSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentTheme: ThemeMode = appData.settings.themeMode || 'rose';

  // Sincronizar el atributo data-theme y la clase .dark en document.documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.classList.toggle(
      'dark',
      currentTheme.startsWith('dark')
    );
  }, [currentTheme]);

  // Periodo seleccionado en Dashboard y Presupuesto (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    obtenerMesLocalIso()
  );

  // Estado de la consulta manual a la API del BCV
  const [rateLoading, setRateLoading] = useState<boolean>(false);
  const [rateStatusMsg, setRateStatusMsg] = useState<string>(() =>
    appData.settings.lastOfficialRate
      ? 'Usando última tasa guardada · Pulsa «Actualizar tasa» para consultar BCV'
      : 'Pulsa «Actualizar tasa» cuando desees consultar el BCV'
  );
  const [rateFetchError, setRateFetchError] = useState<string | null>(null);

  // Notificaciones discretas en la interfaz
  const [toast, setToast] = useState<{
    text: string;
    kind: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (
    text: string,
    kind: 'success' | 'error' | 'info' = 'success'
  ) => {
    setToast({ text, kind });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Guardar automáticamente en localStorage cada vez que cambia appData
  useEffect(() => {
    guardarDatosLocalStorage(appData);
  }, [appData]);

  // Modales de Movimientos, Ahorros y Metas
  const [txnModalOpen, setTxnModalOpen] = useState(false);
  const [txnModalInitialType, setTxnModalInitialType] =
    useState<TransactionType>('expense');
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);

  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [editingSavings, setEditingSavings] = useState<SavingsMovement | null>(
    null
  );

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Modal y estados de Lista de Deseos (Wishlist)
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [editingWish, setEditingWish] = useState<WishlistItem | null>(null);
  const [presetTxnValues, setPresetTxnValues] =
    useState<PresetTransactionValues | null>(null);
  const [pendingWishlistPurchase, setPendingWishlistPurchase] =
    useState<WishlistItem | null>(null);

  // Modal de Importación de Gastos Compartidos (JSON de Finanzas en Pareja)
  const [importSharedModalOpen, setImportSharedModalOpen] = useState(false);

  // Modal de Cápsula del Tiempo Financiera (Estilo Spotify Wrapped)
  const [wrappedModalOpen, setWrappedModalOpen] = useState(false);

  // Modal Lanzador Universal "+ Nuevo" (¿Qué deseas hacer o registrar?)
  const [quickCreateModalOpen, setQuickCreateModalOpen] = useState(false);
  const [moduleAutoOpenTrigger, setModuleAutoOpenTrigger] = useState(0);

  // Modal y Motor de Evaluación de Sala de Trofeos y Logros (Gamificación)
  const [trophyModalOpen, setTrophyModalOpen] = useState(false);
  const achievementsEvaluation = useMemo(
    () => StorageService.checkAchievements(appData),
    [appData, activeSection]
  );

  // Ejecutar checkAchievements() al cargar el Dashboard y persistir los IDs desbloqueados
  useEffect(() => {
    if (activeSection === 'dashboard') {
      StorageService.checkAchievements(appData);
    }
  }, [activeSection, appData]);

  // Tour Guiado / Onboarding Interactivo (inicia automáticamente si es la primera vez)
  const [guidedTourOpen, setGuidedTourOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!StorageService.getHasSeenTutorial()) {
      const timer = window.setTimeout(() => {
        setActiveSection('dashboard');
        setGuidedTourOpen(true);
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const handleStartGuidedTour = () => {
    setMobileMenuOpen(false);
    setActiveSection('dashboard');
    setGuidedTourOpen(true);
  };

  // Centro de Notificaciones Push (PWA Service Worker: Créditos de Apps + Suscripciones)
  const [pushCenterOpen, setPushCenterOpen] = useState(false);
  const [pushConfig, setPushConfig] = useState<PushNotificationConfig>(() =>
    loadPushNotificationConfig()
  );
  const [pushPermission, setPushPermission] = useState<string>('default');

  const activePushReminders = useMemo(
    () => scanPushReminders(appData, pushConfig),
    [appData, pushConfig]
  );

  // Escuchar cambios en la configuración Push y mensajes desde el Service Worker de la PWA
  useEffect(() => {
    getPushEnvironmentStatus().then((st) => setPushPermission(st.permission));

    // Soporte de navegación por parámetro ?section=app_credits o ?section=subscriptions al abrir desde Push
    const params = new URLSearchParams(window.location.search);
    const requestedSection = params.get('section');
    if (
      requestedSection === 'app_credits' ||
      requestedSection === 'subscriptions'
    ) {
      setActiveSection(requestedSection);
    }

    const handlePushConfigUpdated = () => {
      setPushConfig(loadPushNotificationConfig());
      getPushEnvironmentStatus().then((st) => setPushPermission(st.permission));
    };
    window.addEventListener('push-config-updated', handlePushConfigUpdated);

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'SW_NOTIFICATION_CLICK' && msg.section) {
        setActiveSection(msg.section as NavigationSection);
        setPushCenterOpen(false);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener(
        'message',
        handleServiceWorkerMessage
      );
    }

    return () => {
      window.removeEventListener(
        'push-config-updated',
        handlePushConfigUpdated
      );
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener(
          'message',
          handleServiceWorkerMessage
        );
      }
    };
  }, []);

  // Sincronizar vencimientos de Créditos de Apps y Suscripciones con el Service Worker y disparar avisos del día
  useEffect(() => {
    const timer = setTimeout(() => {
      syncAndDispatchDueReminders(appData, { config: pushConfig }).then(
        (res) => {
          if (
            res.dispatchedCount > 0 &&
            res.lastResult?.channel === 'in-app-fallback'
          ) {
            showToast(
              `${res.lastResult.title} — ${res.lastResult.body}`,
              'info'
            );
          }
        }
      );
    }, 1200);
    return () => clearTimeout(timer);
  }, [appData.appCredits, appData.subscriptions, pushConfig]);

  // Modal de pago directo de cuota desde el Dashboard
  const [dashboardPayingInstallment, setDashboardPayingInstallment] = useState<{
    purchase: CreditPurchase;
    installment: CreditInstallment;
  } | null>(null);

  // Modal de liquidación directa P2P desde el Dashboard
  const [dashboardSettlingP2P, setDashboardSettlingP2P] =
    useState<P2POperation | null>(null);

  // Confirmación de eliminación genérica
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Filtros compartidos / de módulos
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(() =>
    obtenerFechaLocalIso().slice(0, 4)
  );
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterCurrency, setFilterCurrency] = useState<'all' | CurrencyCode>(
    'all'
  );
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | TransactionStatus>('all');
  const [filterWallet, setFilterWallet] = useState<string>('all');
  const [filterExpenseKind, setFilterExpenseKind] = useState<
    'all' | 'fixed' | 'variable' | 'recurring'
  >('all');
  const [sortBy, setSortBy] = useState<
    'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
  >('date_desc');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

  // Consulta manual de la tasa oficial BCV (únicamente al pulsar el botón «Actualizar tasa»)
  const actualizarTasaOficial = async (manualTrigger = true) => {
    if (rateLoading) return;
    setRateLoading(true);
    setRateFetchError(null);
    setRateStatusMsg('Consultando tasa oficial del BCV...');

    try {
      const resultado = await obtenerTasaBCV();
      const nowIso = new Date().toISOString();

      setAppData((prev) => {
        const todayLocal = obtenerFechaLocalIso();
        let updatedHistory = registrarTasaDelDiaEnHistorial(
          prev.rateHistory || [],
          resultado.fecha || todayLocal,
          resultado.tasa,
          'bcv',
          resultado.hora || '12:00:00',
          true
        );
        // También asegurar que quede registrada para la fecha local de hoy cuando se consulta en fin de semana o feriado
        updatedHistory = registrarTasaDelDiaEnHistorial(
          updatedHistory,
          todayLocal,
          resultado.tasa,
          'bcv',
          resultado.hora || '12:00:00',
          true
        );

        return {
          ...prev,
          settings: {
            ...prev.settings,
            lastOfficialRate: resultado.tasa,
            lastOfficialRateDate: resultado.fecha,
            lastOfficialRateTime: resultado.hora,
            lastOfficialRateUpdatedAt: resultado.fechaActualizacion,
            lastSuccessfulFetchAt: nowIso,
          },
          rateHistory: updatedHistory,
        };
      });

      setRateStatusMsg('Tasa oficial actualizada desde BCV');
      if (manualTrigger) {
        showToast(
          `Tasa oficial BCV actualizada: 1 USD = ${formatearTasa(resultado.tasa, appData.settings.numberFormatLocale)} Bs`,
          'success'
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la tasa oficial.';
      setRateFetchError('No se pudo actualizar la tasa oficial');
      setRateStatusMsg(
        appData.settings.lastOfficialRate
          ? 'No se pudo actualizar la tasa oficial · Usando última tasa válida guardada'
          : 'No se pudo actualizar la tasa oficial · Puedes definir una tasa manual'
      );
      if (manualTrigger) {
        showToast(msg, 'error');
      }
    } finally {
      setRateLoading(false);
    }
  };

  const locale = appData.settings.numberFormatLocale || 'es-VE';
  const officialRate = appData.settings.lastOfficialRate;
  const effectiveConversionRate =
    (appData.settings.preferManualRateByDefault &&
      appData.settings.defaultExchangeRate) ||
    officialRate ||
    appData.settings.defaultExchangeRate ||
    null;

  // Cuenta seleccionada y controles de vista limpia en el Dashboard
  const [dashboardSelectedWalletId, setDashboardSelectedWalletId] =
    useState<string>('');
  const [showDashboardDetailedBreakdown, setShowDashboardDetailedBreakdown] =
    useState<boolean>(false);
  const [dashboardBottomTab, setDashboardBottomTab] = useState<
    'movements' | 'wallets' | 'charts'
  >('movements');

  // Estado de la Calculadora Rápida USD ⇄ Bs (ventana emergente)
  const [calcModalOpen, setCalcModalOpen] = useState<boolean>(false);
  const [calcRateSource, setCalcRateSource] = useState<'bcv' | 'custom'>(() =>
    officialRate ? 'bcv' : 'custom'
  );
  const [calcCustomRateStr, setCalcCustomRateStr] = useState<string>(() =>
    officialRate
      ? Number(officialRate).toFixed(2)
      : appData.settings.defaultExchangeRate
        ? Number(appData.settings.defaultExchangeRate).toFixed(2)
        : ''
  );
  const [calcUsdInput, setCalcUsdInput] = useState<string>('50');
  const [calcVesInput, setCalcVesInput] = useState<string>(() => {
    const r = officialRate || appData.settings.defaultExchangeRate || 0;
    return r > 0 ? (50 * r).toFixed(2) : '';
  });
  const [calcLastEdited, setCalcLastEdited] = useState<'USD' | 'VES'>('USD');
  const [calcLookupDate, setCalcLookupDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [calcLookupHint, setCalcLookupHint] = useState<string | null>(null);

  const parseCalcNum = (raw: string): number => {
    const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
    if (!cleaned) return NaN;
    return Number(cleaned);
  };

  const activeCalculatorRate = useMemo(() => {
    if (calcRateSource === 'bcv' && officialRate && officialRate > 0) {
      return officialRate;
    }
    const customNum = parseCalcNum(calcCustomRateStr);
    return Number.isFinite(customNum) && customNum > 0 ? customNum : null;
  }, [calcRateSource, officialRate, calcCustomRateStr]);

  // Si se actualiza la tasa oficial BCV y la calculadora está en modo 'bcv', sincronizar
  useEffect(() => {
    if (calcRateSource === 'bcv' && officialRate && officialRate > 0) {
      setCalcCustomRateStr(Number(officialRate).toFixed(2));
      if (calcLastEdited === 'USD') {
        const u = parseCalcNum(calcUsdInput);
        if (Number.isFinite(u) && u >= 0) {
          setCalcVesInput((u * officialRate).toFixed(2));
        }
      } else {
        const v = parseCalcNum(calcVesInput);
        if (Number.isFinite(v) && v >= 0) {
          setCalcUsdInput((v / officialRate).toFixed(2));
        }
      }
    }
  }, [officialRate, calcRateSource]);

  const handleCalcUsdChange = (rawVal: string) => {
    setCalcLastEdited('USD');
    setCalcUsdInput(rawVal);
    const num = parseCalcNum(rawVal);
    if (!rawVal.trim() || !Number.isFinite(num)) {
      setCalcVesInput('');
      return;
    }
    if (activeCalculatorRate && activeCalculatorRate > 0) {
      setCalcVesInput((num * activeCalculatorRate).toFixed(2));
    }
  };

  const handleCalcVesChange = (rawVal: string) => {
    setCalcLastEdited('VES');
    setCalcVesInput(rawVal);
    const num = parseCalcNum(rawVal);
    if (!rawVal.trim() || !Number.isFinite(num)) {
      setCalcUsdInput('');
      return;
    }
    if (activeCalculatorRate && activeCalculatorRate > 0) {
      setCalcUsdInput((num / activeCalculatorRate).toFixed(2));
    }
  };

  const handleCalcRateChange = (newRateRaw: string, mode: 'bcv' | 'custom') => {
    setCalcRateSource(mode);
    setCalcCustomRateStr(newRateRaw);
    const r =
      mode === 'bcv' && officialRate ? officialRate : parseCalcNum(newRateRaw);
    if (!r || !Number.isFinite(r) || r <= 0) return;

    if (calcLastEdited === 'USD') {
      const u = parseCalcNum(calcUsdInput);
      if (Number.isFinite(u) && calcUsdInput.trim() !== '') {
        setCalcVesInput((u * r).toFixed(2));
      }
    } else {
      const v = parseCalcNum(calcVesInput);
      if (Number.isFinite(v) && calcVesInput.trim() !== '') {
        setCalcUsdInput((v / r).toFixed(2));
      }
    }
  };

  const handleCalcDateChange = (nextDateIso: string) => {
    setCalcLookupDate(nextDateIso);
    const lookup = obtenerTasaPorFecha(
      nextDateIso,
      appData.rateHistory,
      officialRate || appData.settings.defaultExchangeRate,
      appData.transactions
    );
    if (lookup.rate && lookup.rate > 0) {
      const roundedStr = lookup.rate.toFixed(2);
      handleCalcRateChange(roundedStr, 'custom');
      setCalcLookupHint(`${lookup.sourceLabel}: ${roundedStr} Bs/$`);
    } else {
      setCalcLookupHint('Sin tasa registrada para esa fecha');
    }
  };

  const handleSaveRateForCalcDate = () => {
    const r = activeCalculatorRate;
    if (!r || r <= 0 || !calcLookupDate) return;
    setAppData((prev) => ({
      ...prev,
      rateHistory: registrarTasaDelDiaEnHistorial(
        prev.rateHistory || [],
        calcLookupDate,
        r,
        'manual',
        '12:00:00',
        true
      ),
    }));
    setCalcLookupHint(
      `Tasa guardada para el ${calcLookupDate}: ${r.toFixed(2)} Bs/$`
    );
    showToast(
      `Tasa de ${r.toFixed(2)} Bs/$ guardada para el día ${calcLookupDate}.`,
      'success'
    );
  };

  // Modal rápido para pasar dinero a una Cuenta de Gastos / Uso de Otra Persona (Familiar / Mamá):
  // Permite elegir entre:
  // 1) 'from_my_wallet': Pasar desde una de mis billeteras (ej. Mercantil Bs), debitando de mi cuenta (+ comisión opcional) y sumando a Mamá.
  // 2) 'external_direct': Ingreso directo sin descontar de mis cuentas (ej. depósito de la empresa directo a esa tarjeta).
  const [thirdPartyReloadWallet, setThirdPartyReloadWallet] =
    useState<WalletAccount | null>(null);
  const [tpFundingMode, setTpFundingMode] = useState<
    'from_my_wallet' | 'external_direct'
  >('from_my_wallet');
  const [tpSourceWalletId, setTpSourceWalletId] = useState<string>('');
  const [tpFeeMode, setTpFeeMode] = useState<
    'none' | 'pago_movil' | 'transferencia'
  >('none');
  const [tpReloadAmountStr, setTpReloadAmountStr] = useState<string>('');
  const [tpReloadCurrency, setTpReloadCurrency] = useState<CurrencyCode>('VES');
  const [tpReloadRateSource, setTpReloadRateSource] = useState<'bcv' | 'manual'>('bcv');
  const [tpReloadCustomRateStr, setTpReloadCustomRateStr] = useState<string>('');
  const [tpReloadDate, setTpReloadDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [tpReloadCategoryId, setTpReloadCategoryId] = useState<string>('cat_exp_other');
  const [tpReloadNotes, setTpReloadNotes] = useState<string>('');

  const openThirdPartyReloadModal = (wallet: WalletAccount) => {
    setThirdPartyReloadWallet(wallet);
    setTpReloadAmountStr('');
    const targetCurr: CurrencyCode = wallet.currency === 'VES' ? 'VES' : 'USD';
    setTpReloadCurrency(targetCurr);

    // Pre-seleccionar billetera personal en Bs (priorizando Mercantil, luego cualquier banco VES activo)
    const personalCandidates = (appData.wallets || []).filter(
      (w) => w.active && !w.isThirdPartyExpenseAccount && w.id !== wallet.id
    );
    const mercantilVes = personalCandidates.find(
      (w) =>
        w.currency === 'VES' &&
        ((w.banco || '').toLowerCase().includes('mercantil') ||
          w.name.toLowerCase().includes('mercantil'))
    );
    const sameCurrWallet = personalCandidates.find(
      (w) => w.currency === targetCurr
    );
    const defaultSrc =
      mercantilVes || sameCurrWallet || personalCandidates[0] || null;
    setTpSourceWalletId(defaultSrc?.id || '');
    setTpFundingMode(defaultSrc ? 'from_my_wallet' : 'external_direct');
    setTpFeeMode('none');

    const prefManual =
      appData.settings.preferManualRateByDefault &&
      appData.settings.defaultExchangeRate;
    setTpReloadRateSource(prefManual ? 'manual' : 'bcv');
    setTpReloadCustomRateStr(
      Number(
        appData.settings.defaultExchangeRate ||
          officialRate ||
          effectiveConversionRate ||
          450
      ).toFixed(2)
    );
    setTpReloadDate(obtenerFechaLocalIso());
    const famCat =
      appData.categories.find(
        (c) =>
          c.type === 'expense' &&
          c.active &&
          (c.name.toLowerCase().includes('familia') ||
            c.name.toLowerCase().includes('hogar') ||
            c.name.toLowerCase().includes('mam'))
      ) ||
      appData.categories.find((c) => c.type === 'expense' && c.active);
    setTpReloadCategoryId(famCat?.id || 'cat_exp_other');
    setTpReloadNotes('');
  };

  const handleSaveThirdPartyReload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thirdPartyReloadWallet) return;
    const rawAmt = Number(tpReloadAmountStr.replace(',', '.'));
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) {
      showToast('Ingresa un monto válido mayor a cero.', 'error');
      return;
    }

    const sourceWalletObj =
      tpFundingMode === 'from_my_wallet' && tpSourceWalletId
        ? (appData.wallets || []).find((w) => w.id === tpSourceWalletId) || null
        : null;

    if (tpFundingMode === 'from_my_wallet' && !sourceWalletObj) {
      showToast(
        'Selecciona de cuál de tus billeteras (ej. Mercantil) sale el dinero, o cambia a "Ingreso directo".',
        'error'
      );
      return;
    }

    const fallbackRate =
      officialRate ||
      appData.settings.defaultExchangeRate ||
      effectiveConversionRate ||
      450;
    const parsedManualRate = Number(tpReloadCustomRateStr.replace(',', '.'));
    const chosenRate =
      tpReloadCurrency === 'VES'
        ? Number(
            (tpReloadRateSource === 'bcv' && officialRate && officialRate > 0
              ? officialRate
              : Number.isFinite(parsedManualRate) && parsedManualRate > 0
                ? parsedManualRate
                : fallbackRate
            ).toFixed(2)
          )
        : null;

    const amountUsd =
      tpReloadCurrency === 'VES'
        ? chosenRate && chosenRate > 0
          ? Number((rawAmt / chosenRate).toFixed(6))
          : 0
        : Number(rawAmt.toFixed(6));

    const beneficiaryLabel =
      thirdPartyReloadWallet.beneficiaryName || thirdPartyReloadWallet.name;

    const txnId = `txn_tp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const dateVal = tpReloadDate || obtenerFechaLocalIso();

    // Calcular comisión bancaria opcional si sale de una billetera propia en Bs
    let computedFee = 0;
    let feeTxn: Transaction | null = null;
    if (
      sourceWalletObj &&
      sourceWalletObj.currency === 'VES' &&
      tpFeeMode !== 'none'
    ) {
      if (tpFeeMode === 'pago_movil') {
        const pct =
          sourceWalletObj.comisionPagoMovil != null
            ? sourceWalletObj.comisionPagoMovil
            : 0.3;
        const rawFee = (rawAmt * pct) / 100;
        computedFee = Number(Math.max(14, rawFee).toFixed(2));
      } else if (tpFeeMode === 'transferencia') {
        const trTipo =
          sourceWalletObj.comisionTransferenciaTipo ||
          (sourceWalletObj.isBonusCard ? 'percent' : 'fixed_ves');
        if (trTipo === 'percent') {
          const pct =
            sourceWalletObj.comisionTransferencia != null
              ? sourceWalletObj.comisionTransferencia
              : 1.5;
          computedFee = Number(((rawAmt * pct) / 100).toFixed(2));
        } else {
          const fixedBs =
            sourceWalletObj.comisionTransferencia != null &&
            sourceWalletObj.comisionTransferencia >= 1
              ? sourceWalletObj.comisionTransferencia
              : 54;
          computedFee = Number(fixedBs.toFixed(2));
        }
      }

      if (computedFee > 0) {
        const feeCategoryId = obtenerIdCategoriaComisionBancaria(
          appData.categories
        );

        const rateForFee = chosenRate || fallbackRate;
        const feeUsd =
          rateForFee > 0 ? Number((computedFee / rateForFee).toFixed(6)) : 0;
        const nowIso = new Date().toISOString();

        feeTxn = {
          id: `txn_tpfee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          date: dateVal,
          createdAt: nowIso,
          processedAt: nowIso,
          type: 'expense',
          status: 'completed',
          walletId: sourceWalletObj.id,
          parentTransactionId: txnId,
          description: `Comisión ${tpFeeMode === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}: Envío a ${beneficiaryLabel}`,
          categoryId: feeCategoryId,
          amount: computedFee,
          currency: 'VES',
          exchangeRate: rateForFee,
          amountUsd: feeUsd,
          exchangeRateSource: tpReloadRateSource,
          paymentMethod:
            tpFeeMode === 'pago_movil' ? 'Pago Móvil' : 'Transferencia',
          expenseType: 'variable',
          isRecurring: false,
          notes: `Comisión bancaria descontada de ${sourceWalletObj.name} al pasar dinero a ${thirdPartyReloadWallet.name}`,
        };
      }
    }

    const nowIsoMain = new Date().toISOString();
    const newTxn: Transaction = {
      id: txnId,
      date: dateVal,
      createdAt: nowIsoMain,
      processedAt: nowIsoMain,
      type: 'expense',
      status: 'completed',
      // Si se pasa desde mi cuenta (ej. Mercantil), walletId es Mercantil (para que me lo debite a mí)
      // y thirdPartyTargetWalletId es la cuenta de Mamá (para que sume al acumulado de Mamá).
      // Si es depósito directo (empresa/externo), walletId es directamente la cuenta de Mamá.
      walletId: sourceWalletObj ? sourceWalletObj.id : thirdPartyReloadWallet.id,
      thirdPartyTargetWalletId: thirdPartyReloadWallet.id,
      isThirdPartyAllowance: true,
      isInterbankTransfer: computedFee > 0,
      interbankFeeType:
        computedFee > 0 && tpFeeMode !== 'none' ? tpFeeMode : undefined,
      interbankFeeAmount: computedFee > 0 ? computedFee : undefined,
      interbankFeeTxnId: feeTxn?.id,
      description: tpReloadNotes.trim()
        ? `${tpReloadNotes.trim()} (${beneficiaryLabel})`
        : sourceWalletObj
          ? `Pasado a ${beneficiaryLabel} desde ${sourceWalletObj.name}`
          : `Depósito directo en cuenta de ${beneficiaryLabel}`,
      categoryId: tpReloadCategoryId || 'cat_exp_other',
      amount: Number(rawAmt.toFixed(2)),
      currency: tpReloadCurrency,
      exchangeRate: chosenRate,
      amountUsd,
      exchangeRateSource:
        tpReloadCurrency === 'VES' ? tpReloadRateSource : 'none',
      paymentMethod: sourceWalletObj
        ? tpFeeMode === 'pago_movil'
          ? `Pago Móvil (${sourceWalletObj.name} → ${thirdPartyReloadWallet.name})`
          : `Transferencia (${sourceWalletObj.name} → ${thirdPartyReloadWallet.name})`
        : `Depósito directo (${thirdPartyReloadWallet.name})`,
      expenseType: 'variable',
      isRecurring: false,
      notes:
        tpReloadNotes.trim() ||
        (sourceWalletObj
          ? `Dinero pasado desde ${sourceWalletObj.name} a ${thirdPartyReloadWallet.name}`
          : `Ingreso/depósito directo sin descontar de mis cuentas (${thirdPartyReloadWallet.name})`),
    };

    setAppData((prev) => ({
      ...prev,
      transactions: feeTxn
        ? [feeTxn, newTxn, ...prev.transactions]
        : [newTxn, ...prev.transactions],
    }));

    if (sourceWalletObj) {
      showToast(
        `Se debitaron -${formatearMonto(rawAmt + computedFee, tpReloadCurrency, locale)} de "${sourceWalletObj.name}" y se acreditaron +${formatearMonto(rawAmt, tpReloadCurrency, locale)} (≈ ${formatearMonto(amountUsd, 'USD', locale)}) en "${thirdPartyReloadWallet.name}".`,
        'success'
      );
    } else {
      showToast(
        `Ingreso directo registrado: +${formatearMonto(rawAmt, tpReloadCurrency, locale)} (≈ ${formatearMonto(amountUsd, 'USD', locale)}) en "${thirdPartyReloadWallet.name}" (sin descontar de tus cuentas).`,
        'success'
      );
    }
    setThirdPartyReloadWallet(null);
  };

  // Modal especializado para Tarjeta de Bonos / Todoticket Integral (Opción 1: Recibir Bono + Pasar/Vaciar a mi Banco con comisión en % o Bs)
  const [bonusCardModalWallet, setBonusCardModalWallet] =
    useState<WalletAccount | null>(null);
  const [bonusCardTab, setBonusCardTab] = useState<
    'load_bonus' | 'transfer_to_bank'
  >('transfer_to_bank');
  // Estados Tab 1: Cargar Bono Recibido
  const [bonusLoadAmountStr, setBonusLoadAmountStr] = useState<string>('');
  const [bonusLoadRateSource, setBonusLoadRateSource] = useState<
    'bcv' | 'manual'
  >('bcv');
  const [bonusLoadCustomRateStr, setBonusLoadCustomRateStr] =
    useState<string>('');
  const [bonusLoadDate, setBonusLoadDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [bonusLoadNotes, setBonusLoadNotes] = useState<string>(
    'Bono Empresa / Todoticket Integral'
  );
  // Estados Tab 2: Pasar / Vaciar a mi Banco (ej. Mercantil)
  const [bonusDestWalletId, setBonusDestWalletId] = useState<string>('');
  const [bonusTransferAmountStr, setBonusTransferAmountStr] =
    useState<string>('');
  const [bonusFeeType, setBonusFeeType] = useState<'percent' | 'fixed_ves'>(
    'percent'
  );
  const [bonusFeeValueStr, setBonusFeeValueStr] = useState<string>('1.5');
  const [bonusDeductMode, setBonusDeductMode] = useState<
    'deduct_from_amount' | 'add_on_top'
  >('deduct_from_amount');
  const [bonusSaveFeeDefault, setBonusSaveFeeDefault] =
    useState<boolean>(true);
  const [bonusTransferDate, setBonusTransferDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [bonusTransferNotes, setBonusTransferNotes] = useState<string>('');

  const openBonusCardModal = (
    wallet: WalletAccount,
    initialTab: 'load_bonus' | 'transfer_to_bank' = 'transfer_to_bank'
  ) => {
    setBonusCardModalWallet(wallet);
    setBonusCardTab(initialTab);
    setBonusLoadAmountStr('');
    const prefManual =
      appData.settings.preferManualRateByDefault &&
      appData.settings.defaultExchangeRate;
    setBonusLoadRateSource(prefManual ? 'manual' : 'bcv');
    setBonusLoadCustomRateStr(
      Number(
        appData.settings.defaultExchangeRate ||
          officialRate ||
          effectiveConversionRate ||
          450
      ).toFixed(2)
    );
    const today = obtenerFechaLocalIso();
    setBonusLoadDate(today);
    setBonusLoadNotes(`Bono Empresa (${wallet.name})`);

    // Pre-seleccionar banco destino normal (priorizando Mercantil en Bs, luego cualquier banco VES activo)
    const candidateWallets = (appData.wallets || []).filter(
      (w) =>
        w.active &&
        w.id !== wallet.id &&
        !w.isThirdPartyExpenseAccount &&
        !w.isBonusCard
    );
    const mercantilWallet = candidateWallets.find(
      (w) =>
        w.currency === 'VES' &&
        ((w.banco || '').toLowerCase().includes('mercantil') ||
          w.name.toLowerCase().includes('mercantil'))
    );
    const anyVesBank = candidateWallets.find((w) => w.currency === 'VES');
    const chosenDest =
      mercantilWallet || anyVesBank || candidateWallets[0] || null;
    setBonusDestWalletId(chosenDest?.id || '');

    // Pre-llenar con el saldo disponible actual de la tarjeta Todoticket
    const currentSummary = calcularResumenBilleteras(
      appData,
      selectedMonth
    ).billeteras.find((b) => b.wallet.id === wallet.id);
    const availNominal = currentSummary
      ? wallet.currency === 'VES'
        ? currentSummary.saldoActualVes
        : currentSummary.saldoActualUsd
      : 0;
    setBonusTransferAmountStr(
      availNominal > 0 ? String(Number(availNominal.toFixed(2))) : ''
    );

    const wFeeType = wallet.comisionTransferenciaTipo || 'percent';
    setBonusFeeType(wFeeType);
    const wFeeVal =
      wallet.comisionTransferencia != null
        ? wallet.comisionTransferencia
        : wFeeType === 'percent'
          ? 1.5
          : 54;
    setBonusFeeValueStr(String(wFeeVal));
    setBonusDeductMode('deduct_from_amount');
    setBonusSaveFeeDefault(true);
    setBonusTransferDate(today);
    setBonusTransferNotes(
      chosenDest
        ? `Paso de bono ${wallet.name} a ${chosenDest.name}`
        : `Retiro de bono ${wallet.name}`
    );
  };

  const handleSaveBonusCardLoad = (
    e: React.FormEvent,
    andSwitchToTransfer = false
  ) => {
    e.preventDefault();
    if (!bonusCardModalWallet) return;
    const rawAmt = Number(bonusLoadAmountStr.replace(',', '.'));
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) {
      showToast('Ingresa el monto del bono recibido mayor a cero.', 'error');
      return;
    }

    const fallbackRate =
      officialRate ||
      appData.settings.defaultExchangeRate ||
      effectiveConversionRate ||
      450;
    const parsedManual = Number(bonusLoadCustomRateStr.replace(',', '.'));
    const isVes = bonusCardModalWallet.currency === 'VES';
    const chosenRate = isVes
      ? bonusLoadRateSource === 'bcv' && officialRate && officialRate > 0
        ? officialRate
        : Number.isFinite(parsedManual) && parsedManual > 0
          ? parsedManual
          : fallbackRate
      : null;

    const amountUsd = isVes
      ? chosenRate && chosenRate > 0
        ? Number((rawAmt / chosenRate).toFixed(6))
        : 0
      : Number(rawAmt.toFixed(6));

    const incCat =
      appData.categories.find(
        (c) =>
          c.type === 'income' &&
          c.active &&
          (c.name.toLowerCase().includes('bono') ||
            c.name.toLowerCase().includes('salario') ||
            c.name.toLowerCase().includes('sueldo') ||
            c.name.toLowerCase().includes('trabajo'))
      ) ||
      appData.categories.find((c) => c.type === 'income' && c.active);

    const nowBonusIso = new Date().toISOString();
    const newIncomeTxn: Transaction = {
      id: `txn_bonus_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: bonusLoadDate || obtenerFechaLocalIso(),
      createdAt: nowBonusIso,
      processedAt: nowBonusIso,
      type: 'income',
      status: 'completed',
      walletId: bonusCardModalWallet.id,
      description:
        bonusLoadNotes.trim() || `Bono recibido en ${bonusCardModalWallet.name}`,
      categoryId: incCat?.id || 'cat_inc_salary',
      amount: Number(rawAmt.toFixed(2)),
      currency: bonusCardModalWallet.currency,
      exchangeRate: chosenRate,
      amountUsd,
      exchangeRateSource: isVes ? bonusLoadRateSource : 'none',
      source: 'Empresa / Todoticket',
      paymentMethod: bonusCardModalWallet.name,
      notes:
        bonusLoadNotes.trim() ||
        `Carga de bono en ${bonusCardModalWallet.name}`,
    };

    const nextData: AppDataSchema = {
      ...appData,
      transactions: [newIncomeTxn, ...appData.transactions],
    };
    setAppData(nextData);

    showToast(
      `¡Bono cargado! +${formatearMonto(rawAmt, bonusCardModalWallet.currency, locale)} (≈ ${formatearMonto(amountUsd, 'USD', locale)}) disponibles en "${bonusCardModalWallet.name}".`,
      'success'
    );

    if (andSwitchToTransfer) {
      const updatedSummary = calcularResumenBilleteras(
        nextData,
        selectedMonth
      ).billeteras.find((b) => b.wallet.id === bonusCardModalWallet.id);
      const newAvail = updatedSummary
        ? isVes
          ? updatedSummary.saldoActualVes
          : updatedSummary.saldoActualUsd
        : rawAmt;
      setBonusTransferAmountStr(String(Number(newAvail.toFixed(2))));
      setBonusCardTab('transfer_to_bank');
    } else {
      setBonusCardModalWallet(null);
    }
  };

  const handleExecuteBonusCardTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusCardModalWallet) return;
    const destWallet = (appData.wallets || []).find(
      (w) => w.id === bonusDestWalletId
    );
    if (!destWallet) {
      showToast('Selecciona tu banco destino (ej. Mercantil).', 'error');
      return;
    }

    const rawAmount = Number(bonusTransferAmountStr.replace(',', '.'));
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      showToast('Ingresa un monto válido a transferir.', 'error');
      return;
    }

    const feeVal = Math.max(
      0,
      Number(bonusFeeValueStr.replace(',', '.')) || 0
    );
    const computedFee =
      bonusFeeType === 'percent'
        ? Number(((rawAmount * feeVal) / 100).toFixed(2))
        : Number(feeVal.toFixed(2));

    // Si es 'deduct_from_amount' (Vaciar tarjeta):
    // - De Todoticket salen en total `rawAmount` (amountOut de transferencia = rawAmount - computedFee, más el gasto de comisión = computedFee -> Total debitado = rawAmount).
    // - Al banco destino entran `rawAmount - computedFee`.
    // Si es 'add_on_top':
    // - Al banco destino entran `rawAmount`, y de Todoticket salen `rawAmount` (transferencia) + `computedFee` (gasto comisión).
    const netTransferAmount =
      bonusDeductMode === 'deduct_from_amount'
        ? Number((rawAmount - computedFee).toFixed(2))
        : Number(rawAmount.toFixed(2));

    if (netTransferAmount <= 0) {
      showToast(
        'La comisión supera o iguala el monto a transferir. Verifica el porcentaje o monto fijo.',
        'error'
      );
      return;
    }

    const activeRate =
      officialRate ||
      effectiveConversionRate ||
      appData.settings.defaultExchangeRate ||
      450;

    const isSameCurr =
      (bonusCardModalWallet.currency === 'VES') ===
      (destWallet.currency === 'VES');
    const transferRate = isSameCurr ? 1 : activeRate;

    try {
      const { updatedData, transfer } = StorageService.registerWalletTransfer(
        {
          date: bonusTransferDate || obtenerFechaLocalIso(),
          sourceWalletId: bonusCardModalWallet.id,
          destinationWalletId: destWallet.id,
          amountOut: netTransferAmount,
          exchangeRate: transferRate,
          feeAmount: computedFee,
          feeExchangeRateUsd: activeRate,
          notes:
            bonusTransferNotes.trim() ||
            `Paso de bono ${bonusCardModalWallet.name} → ${destWallet.name}`,
        },
        appData
      );

      // Si el usuario marcó guardar esta comisión como predeterminada en la tarjeta Todoticket
      const finalWallets = bonusSaveFeeDefault
        ? (updatedData.wallets || []).map((w) =>
            w.id === bonusCardModalWallet.id
              ? {
                  ...w,
                  comisionTransferenciaTipo: bonusFeeType,
                  comisionTransferencia: feeVal,
                }
              : w
          )
        : updatedData.wallets;

      const finalData: AppDataSchema = {
        ...updatedData,
        wallets: finalWallets,
      };
      StorageService.saveData(finalData);
      setAppData(finalData);

      showToast(
        `Transferencia completada: Entraron +${formatearMonto(transfer.amountIn, destWallet.currency, locale)} a "${destWallet.name}"${
          computedFee > 0
            ? ` y se descontó comisión de ${formatearMonto(computedFee, bonusCardModalWallet.currency, locale)}`
            : ''
        }.`,
        'success'
      );
      setBonusCardModalWallet(null);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudo completar la transferencia.',
        'error'
      );
    }
  };

  // Cálculos del Dashboard, Billeteras y serie de meses
  const resumenMes = useMemo(
    () => calcularResumenFinanciero(appData, selectedMonth),
    [appData, selectedMonth]
  );

  const resumenBilleteras = useMemo(
    () => calcularResumenBilleteras(appData, selectedMonth),
    [appData, selectedMonth]
  );

  const serieSeisMeses = useMemo(
    () => obtenerSerieMensual(appData, selectedMonth, 6),
    [appData, selectedMonth]
  );

  const transaccionesDelMes = useMemo(
    () =>
      appData.transactions.filter((t) => {
        const effectiveDate = esTransaccionCompletada(t)
          ? obtenerFechaEfectivaContableTransaccion(t, appData)
          : t.date;
        return effectiveDate.slice(0, 7) === selectedMonth;
      }),
    [appData, selectedMonth]
  );

  const distribucionGastosMes = useMemo(
    () =>
      calcularDistribucionPorCategoria(
        transaccionesDelMes,
        appData.categories,
        'expense'
      ),
    [transaccionesDelMes, appData.categories]
  );

  const estadoPresupuestoCategorias = useMemo(
    () => calcularEstadoPresupuestoPorCategoria(appData, selectedMonth),
    [appData, selectedMonth]
  );

  const resumenPrestamos = useMemo(
    () => calcularResumenPrestamos(appData.debts),
    [appData.debts]
  );

  // Estado para alternar rápidamente en el widget del Dashboard entre solo billeteras VES o todas las billeteras
  const [dashboardPurchasingPowerScope, setDashboardPurchasingPowerScope] =
    useState<'auto' | 'all_wallets'>('auto');

  const analisisPoderAdquisitivo = useMemo(() => {
    const baseResult = calcularAnalisisPoderAdquisitivo(appData);
    if (
      dashboardPurchasingPowerScope === 'all_wallets' &&
      baseResult.sumaTodasBilleterasBs > 0
    ) {
      return calcularAnalisisPoderAdquisitivo(appData, {
        scope: 'all_wallets',
      });
    }
    return baseResult;
  }, [appData, dashboardPurchasingPowerScope]);

  const comparacionPresupuestoMes = useMemo(() => {
    return estadoPresupuestoCategorias.conLimite
      .map((item) => ({
        categoryId: item.category.id,
        categoryName: item.category.name,
        plannedUsd: item.limitUsd,
        actualUsd: item.spentCompletedUsd,
      }))
      .sort((a, b) => b.plannedUsd - a.plannedUsd);
  }, [estadoPresupuestoCategorias]);

  // Handlers de Movimientos
  const handleSaveTransaction = (txn: Transaction, feeTxn?: Transaction) => {
    setAppData((prev) => {
      const exists = prev.transactions.some((t) => t.id === txn.id);
      let nextTxns = exists
        ? prev.transactions.map((t) => (t.id === txn.id ? txn : t))
        : [txn, ...prev.transactions];

      if (feeTxn) {
        const feeExists = nextTxns.some((t) => t.id === feeTxn.id);
        nextTxns = feeExists
          ? nextTxns.map((t) => (t.id === feeTxn.id ? feeTxn : t))
          : [feeTxn, ...nextTxns];
      }

      let nextWishlist = prev.wishlist || [];
      if (pendingWishlistPurchase) {
        nextWishlist = nextWishlist.map((w) =>
          w.id === pendingWishlistPurchase.id
            ? { ...w, estado: 'Comprado' as const, compradoTransactionId: txn.id }
            : w
        );
      }

      let nextRateHistory = prev.rateHistory || [];
      if (txn.exchangeRate && txn.exchangeRate > 0 && txn.date) {
        nextRateHistory = registrarTasaDelDiaEnHistorial(
          nextRateHistory,
          txn.date,
          txn.exchangeRate,
          txn.exchangeRateSource === 'bcv' ? 'bcv' : 'manual',
          '12:00:00',
          false
        );
      }

      return {
        ...prev,
        transactions: nextTxns,
        wishlist: nextWishlist,
        rateHistory: nextRateHistory,
      };
    });

    if (pendingWishlistPurchase) {
      showToast(
        `¡Felicidades! Has adquirido "${pendingWishlistPurchase.nombre}" y se ha registrado como gasto contable.`,
        'success'
      );
      setPendingWishlistPurchase(null);
      setPresetTxnValues(null);
    } else if (feeTxn) {
      showToast(
        `Gasto registrado y comisión bancaria de ${formatearMonto(feeTxn.amount, feeTxn.currency, locale)} descontada en "Comisiones Bancarias".`,
        'success'
      );
    } else {
      showToast(
        editingTxn
          ? 'Movimiento actualizado correctamente.'
          : 'Movimiento registrado correctamente.',
        'success'
      );
    }
    setEditingTxn(null);
  };

  const handleDuplicateTransaction = (txn: Transaction) => {
    const duplicated: Transaction = {
      ...txn,
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: obtenerFechaLocalIso(),
      description: `${txn.description} (Copia)`,
    };
    setAppData((prev) => ({
      ...prev,
      transactions: [duplicated, ...prev.transactions],
    }));
    showToast('Movimiento duplicado con fecha de hoy.', 'success');
  };

  const handleToggleTransactionStatus = (txn: Transaction) => {
    const currentStatus = esTransaccionCompletada(txn) ? 'completed' : 'pending';
    const nextStatus: TransactionStatus =
      currentStatus === 'completed' ? 'pending' : 'completed';
    const todayIso = obtenerFechaLocalIso();
    const nowIso = new Date().toISOString();
    const isPaidEarly = nextStatus === 'completed' && txn.date > todayIso;

    setAppData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => {
        if (t.id !== txn.id) return t;
        if (nextStatus === 'completed') {
          const updatedDate = t.date > todayIso ? todayIso : t.date;
          const noteSuffix =
            t.date > todayIso && !(t.notes || '').includes('Vencimiento original')
              ? `(Pagado por adelantado el ${todayIso} · Vencimiento original: ${t.date})`
              : '';
          return {
            ...t,
            status: nextStatus,
            date: updatedDate,
            processedAt: nowIso,
            notes: [t.notes, noteSuffix].filter(Boolean).join(' · '),
          };
        }
        return { ...t, status: nextStatus };
      }),
    }));

    showToast(
      nextStatus === 'completed'
        ? isPaidEarly
          ? `"${txn.description}" marcado como Pagado con fecha efectiva de hoy (${todayIso}) · Vencimiento original ${txn.date}.`
          : `"${txn.description}" marcado como Completado · Afecta el Saldo Actual.`
        : `"${txn.description}" marcado como Pendiente · Solo afecta el Saldo Proyectado.`,
      nextStatus === 'completed' ? 'success' : 'info'
    );
  };

  const handleDeleteTransaction = (txn: Transaction) => {
    setConfirmDialog({
      title: 'Eliminar movimiento',
      message: `¿Confirmas eliminar "${txn.description}" por ${formatearMonto(txn.amount, txn.currency, locale)}? Esta acción recalculará todos tus saldos.`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
      onConfirm: () => {
        setAppData((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((t) => t.id !== txn.id),
        }));
        setConfirmDialog(null);
        showToast('Movimiento eliminado.', 'info');
      },
    });
  };

  // Handlers de Puente Contable y Sincronización con Finanzas en Pareja
  const handleBridgePersonalExpense = (
    personalExpense: Transaction,
    walletName: string
  ) => {
    setAppData((prev) => ({
      ...prev,
      transactions: [personalExpense, ...prev.transactions],
    }));
    showToast(
      `Gasto registrado en Finanzas en Pareja y descontado automáticamente de ${walletName} en tu Balance Personal.`,
      'success'
    );
  };

  const handleRemoveLinkedPersonalTransaction = (txnId: string) => {
    setAppData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== txnId),
    }));
  };

  const handleConfirmImportSharedExpenses = (
    importedTransactions: Transaction[]
  ) => {
    if (importedTransactions.length === 0) return;
    setAppData((prev) => ({
      ...prev,
      transactions: [...importedTransactions, ...prev.transactions],
    }));
    showToast(
      `¡Se importaron ${importedTransactions.length} gasto(s) compartido(s) como egresos en tus Finanzas Personales!`,
      'success'
    );
  };

  // Handlers de Ahorros y Metas
  const handleSaveSavingsMovement = (mov: SavingsMovement) => {
    setAppData((prev) => {
      const exists = prev.savings.some((s) => s.id === mov.id);
      const nextSavings = exists
        ? prev.savings.map((s) => (s.id === mov.id ? mov : s))
        : [mov, ...prev.savings];

      // Verificar si alguna meta asociada alcanzó el 100%
      const nextGoals = prev.savingsGoals.map((g) => {
        if (g.id === mov.goalId && g.status === 'active') {
          const prog = calcularProgresoMeta(g, nextSavings);
          if (prog.ahorradoUsd >= g.targetAmountUsd) {
            setTimeout(() => {
              showToast(
                `¡Felicidades! Has completado el 100% de tu meta "${g.name}".`,
                'success'
              );
            }, 250);
            return { ...g, status: 'completed' as const };
          }
        }
        return g;
      });

      return {
        ...prev,
        savings: nextSavings,
        savingsGoals: nextGoals,
      };
    });
    showToast('Movimiento de ahorro guardado en USD.', 'success');
    setEditingSavings(null);
  };

  const handleDeleteSavingsMovement = (mov: SavingsMovement) => {
    setConfirmDialog({
      title: 'Eliminar registro de ahorro',
      message: `¿Deseas eliminar "${mov.description}" (${formatearMonto(mov.amountUsd, 'USD', locale)})? Se actualizará tu saldo de ahorro y disponible.`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: () => {
        setAppData((prev) => ({
          ...prev,
          savings: prev.savings.filter((s) => s.id !== mov.id),
        }));
        setConfirmDialog(null);
        showToast('Movimiento de ahorro eliminado.', 'info');
      },
    });
  };

  const handleSaveGoal = (goal: SavingsGoal) => {
    setAppData((prev) => {
      const exists = prev.savingsGoals.some((g) => g.id === goal.id);
      return {
        ...prev,
        savingsGoals: exists
          ? prev.savingsGoals.map((g) => (g.id === goal.id ? goal : g))
          : [goal, ...prev.savingsGoals],
      };
    });
    showToast('Meta de ahorro guardada.', 'success');
    setEditingGoal(null);
  };

  // Handlers de Lista de Deseos (Wishlist)
  const handleSaveWishlistItem = (wish: WishlistItem) => {
    setAppData((prev) => {
      const curList = prev.wishlist || [];
      const exists = curList.some((w) => w.id === wish.id);
      const nextList = exists
        ? curList.map((w) => (w.id === wish.id ? wish : w))
        : [wish, ...curList];
      return {
        ...prev,
        wishlist: nextList,
      };
    });
    showToast(
      editingWish
        ? `"${wish.nombre}" actualizado correctamente.`
        : `"${wish.nombre}" agregado a tu Lista de Deseos.`,
      'success'
    );
    setWishlistModalOpen(false);
    setEditingWish(null);
  };

  const handleDeleteWishlistItem = (wish: WishlistItem) => {
    setConfirmDialog({
      title: 'Eliminar deseo',
      message: `¿Estás seguro de que deseas eliminar "${wish.nombre}" de tu lista de deseos? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      danger: true,
      onConfirm: () => {
        setAppData((prev) => ({
          ...prev,
          wishlist: (prev.wishlist || []).filter((w) => w.id !== wish.id),
        }));
        setConfirmDialog(null);
        showToast(`"${wish.nombre}" eliminado de la lista de deseos.`, 'info');
      },
    });
  };

  const handleToggleWishlistStatus = (
    wish: WishlistItem,
    nextStatus: WishlistStatus
  ) => {
    setAppData((prev) => ({
      ...prev,
      wishlist: (prev.wishlist || []).map((w) =>
        w.id === wish.id ? { ...w, estado: nextStatus } : w
      ),
    }));
    showToast(
      nextStatus === 'Comprado'
        ? `¡Listo! "${wish.nombre}" marcado como comprado.`
        : nextStatus === 'Descartado'
          ? `"${wish.nombre}" movido a descartados.`
          : `"${wish.nombre}" devuelto a deseos pendientes.`,
      nextStatus === 'Comprado' ? 'success' : 'info'
    );
  };

  const handleStartBuyWishlistItem = (wish: WishlistItem) => {
    setPendingWishlistPurchase(wish);
    setEditingTxn(null);
    setPresetTxnValues({
      description: wish.nombre,
      amount: wish.costoEstimado,
      currency: wish.moneda,
      categoryId: wish.categoriaId,
      notes: wish.notas
        ? `Comprado desde Lista de Deseos · ${wish.notas}`
        : 'Comprado desde Lista de Deseos',
      expenseType: wish.prioridad === 'Alta' ? 'fixed' : 'variable',
    });
    setTxnModalInitialType('expense');
    setTxnModalOpen(true);
    showToast(
      `Selecciona la cuenta de origen para debitar "${wish.nombre}".`,
      'info'
    );
  };

  // Cargar datos de ejemplo
  const handleLoadDemoData = () => {
    const hasExisting =
      appData.transactions.length > 0 ||
      appData.savings.length > 0 ||
      appData.savingsGoals.length > 0 ||
      (appData.wishlist && appData.wishlist.length > 0);

    const executeLoad = () => {
      const demo = generateDemoDataset(officialRate);
      setAppData((prev) => {
        const nonDemoTxns = prev.transactions.filter((t) => !t.isDemo);
        const nonDemoSav = prev.savings.filter((s) => !s.isDemo);
        const nonDemoGoals = prev.savingsGoals.filter((g) => !g.isDemo);
        const nonDemoBudgets = prev.budgets.filter((b) => !b.isDemo);
        const nonDemoDebts = prev.debts.filter((d) => !d.isDemo);
        const nonDemoWish = (prev.wishlist || []).filter((w) => !w.isDemo);

        return {
          ...prev,
          wallets:
            prev.wallets && prev.wallets.length > 0
              ? prev.wallets
              : INITIAL_WALLETS,
          transactions: [...demo.transactions, ...nonDemoTxns],
          savings: [...demo.savings, ...nonDemoSav],
          savingsGoals: [...demo.savingsGoals, ...nonDemoGoals],
          budgets: [
            ...demo.budgets.filter(
              (db) => !nonDemoBudgets.some((nb) => nb.monthKey === db.monthKey)
            ),
            ...nonDemoBudgets,
          ],
          debts: [...demo.debts, ...nonDemoDebts],
          wishlist: [...demo.wishlist, ...nonDemoWish],
          creditPurchases: prev.creditPurchases || [],
          p2pOperations: prev.p2pOperations || [],
        };
      });
      setConfirmDialog(null);
      showToast(
        'Datos demostrativos [Ejemplo] cargados correctamente.',
        'success'
      );
    };

    if (hasExisting) {
      setConfirmDialog({
        title: 'Cargar datos demostrativos',
        message:
          'Se incorporarán registros identificados como [Ejemplo] (ingresos, gastos en USD y VES, presupuesto, ahorros y metas) junto a tus datos actuales. ¿Deseas continuar?',
        confirmLabel: 'Sí, cargar datos de ejemplo',
        onConfirm: executeLoad,
      });
    } else {
      executeLoad();
    }
  };

  // Exportar JSON
  const handleExportJson = () => {
    try {
      const jsonStr = generarArchivoRespaldoJson(appData);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = obtenerFechaLocalIso();
      link.href = url;
      link.download = `respaldo-mis-finanzas-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Respaldo JSON descargado correctamente.', 'success');
    } catch (err) {
      showToast('No se pudo generar el archivo de respaldo JSON.', 'error');
    }
  };

  // Cargar JSON rápido desde el icono discreto del panel superior fijado
  const headerJsonInputRef = useRef<HTMLInputElement | null>(null);
  const handleQuickHeaderImportJson = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text);
        const validated = validarYNormalizarRespaldo(parsed);
        setAppData(validated);
        showToast(
          `Respaldo JSON cargado (${validated.transactions.length} movimientos).`,
          'success'
        );
      } catch (err: unknown) {
        showToast(
          err instanceof Error
            ? err.message
            : 'El archivo seleccionado no es un respaldo JSON válido.',
          'error'
        );
      } finally {
        if (headerJsonInputRef.current) {
          headerJsonInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const navItems: {
    id: NavigationSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'upcoming_payments',
      label: 'Agenda de Pagos (Próximos)',
      icon: CalendarClock,
    },
    {
      id: 'trophies',
      label: 'Sala de Trofeos y Logros',
      icon: Award,
    },
    { id: 'movements', label: 'Movimientos', icon: Layers },
    { id: 'incomes', label: 'Mis ingresos', icon: ArrowUpRight },
    { id: 'expenses', label: 'Mis gastos', icon: ArrowDownRight },
    { id: 'categories', label: 'Categorías', icon: FolderKanban },
    { id: 'wallets', label: 'Mis billeteras', icon: Landmark },
    {
      id: 'p2p',
      label: 'Cambios P2P y Cuentas por Cobrar',
      icon: ArrowLeftRight,
    },
    { id: 'budgets', label: 'Presupuesto mensual', icon: Wallet },
    {
      id: 'installments',
      label: 'Compras por Cuota',
      icon: ShoppingBag,
    },
    {
      id: 'app_credits',
      label: 'Créditos de Apps (Ubii / Avila)',
      icon: Smartphone,
    },
    { id: 'debts', label: 'Préstamos', icon: CreditCard },
    {
      id: 'subscriptions',
      label: 'Gestor de Suscripciones',
      icon: RefreshCw,
    },
    { id: 'savings', label: 'Mis ahorros', icon: PiggyBank },
    { id: 'goals', label: 'Metas de ahorro', icon: Target },
    { id: 'wishlist', label: 'Lista de deseos', icon: Gift },
    {
      id: 'market',
      label: 'Lista de Mercado Simple',
      icon: CheckSquare,
    },
    {
      id: 'weekly_menu',
      label: 'Planificador de Menú Semanal',
      icon: Utensils,
    },
    {
      id: 'assets',
      label: 'Bóveda de Garantías (Assets)',
      icon: Shield,
    },
    { id: 'couples', label: 'Finanzas en Pareja', icon: HeartHandshake },
    {
      id: 'romance_fund',
      label: 'Fondo y Ruleta de Citas',
      icon: Heart,
    },
    { id: 'statistics', label: 'Estadísticas e informes', icon: BarChart3 },
    {
      id: 'monthly_report',
      label: 'Estado de Cuenta (PDF)',
      icon: FileText,
    },
    { id: 'tools', label: 'Herramientas (Tools)', icon: Sparkles },
    { id: 'settings', label: 'Configuración y respaldo', icon: Settings },
  ];

  // Organización consolidada en los laterales: agrupa vistas relacionadas en un mismo lugar
  const sidebarHubGroups: {
    groupTitle: string;
    hubs: {
      hubId: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      defaultSection: NavigationSection;
      badge?: string;
      isHighlight?: boolean;
      subSections: {
        id: NavigationSection;
        label: string;
        shortLabel: string;
        icon: React.ComponentType<{ className?: string }>;
      }[];
    }[];
  }[] = [
    {
      groupTitle: 'Principal',
      hubs: [
        {
          hubId: 'hub_dashboard',
          label: 'Dashboard y Agenda',
          icon: LayoutDashboard,
          defaultSection: 'dashboard',
          subSections: [
            {
              id: 'dashboard',
              label: 'Panel Principal (Dashboard)',
              shortLabel: 'Dashboard',
              icon: LayoutDashboard,
            },
            {
              id: 'upcoming_payments',
              label: 'Agenda de Pagos (Próximos Compromisos)',
              shortLabel: 'Agenda de Pagos 📅',
              icon: CalendarClock,
            },
            {
              id: 'trophies',
              label: 'Sala de Trofeos y Logros',
              shortLabel: 'Mis Logros 🏆',
              icon: Award,
            },
          ],
        },
      ],
    },
    {
      groupTitle: 'Cuentas y Movimientos',
      hubs: [
        {
          hubId: 'hub_movements',
          label: 'Movimientos y Categorías',
          icon: Layers,
          defaultSection: 'movements',
          subSections: [
            {
              id: 'movements',
              label: 'Todos los Movimientos',
              shortLabel: 'Movimientos',
              icon: Layers,
            },
            {
              id: 'incomes',
              label: 'Mis Ingresos',
              shortLabel: 'Ingresos',
              icon: ArrowUpRight,
            },
            {
              id: 'expenses',
              label: 'Mis Gastos',
              shortLabel: 'Gastos',
              icon: ArrowDownRight,
            },
            {
              id: 'categories',
              label: 'Categorías',
              shortLabel: 'Categorías',
              icon: FolderKanban,
            },
          ],
        },
        {
          hubId: 'hub_wallets',
          label: 'Billeteras y Cambios P2P',
          icon: Landmark,
          defaultSection: 'wallets',
          subSections: [
            {
              id: 'wallets',
              label: 'Mis Billeteras y Conversor',
              shortLabel: 'Mis Billeteras',
              icon: Landmark,
            },
            {
              id: 'p2p',
              label: 'Cambios P2P y Cuentas por Cobrar',
              shortLabel: 'Cambios P2P / Cobros',
              icon: ArrowLeftRight,
            },
          ],
        },
        {
          hubId: 'hub_budgets',
          label: 'Presupuesto Mensual',
          icon: Wallet,
          defaultSection: 'budgets',
          subSections: [
            {
              id: 'budgets',
              label: 'Presupuesto Mensual',
              shortLabel: 'Presupuesto',
              icon: Wallet,
            },
          ],
        },
      ],
    },
    {
      groupTitle: 'Créditos y Ahorros',
      hubs: [
        {
          hubId: 'hub_credits',
          label: 'Créditos, Cuotas y Deudas',
          icon: Smartphone,
          defaultSection: 'upcoming_payments',
          badge: 'Agenda',
          subSections: [
            {
              id: 'upcoming_payments',
              label: 'Agenda de Pagos Unificada',
              shortLabel: 'Agenda de Pagos 📅',
              icon: CalendarClock,
            },
            {
              id: 'installments',
              label: 'Compras por Cuota (Cashea)',
              shortLabel: 'Compras por Cuota',
              icon: ShoppingBag,
            },
            {
              id: 'app_credits',
              label: 'Créditos de Apps (Ubii / Avila)',
              shortLabel: 'Créditos de Apps',
              icon: Smartphone,
            },
            {
              id: 'debts',
              label: 'Préstamos y Deudas',
              shortLabel: 'Préstamos',
              icon: CreditCard,
            },
            {
              id: 'subscriptions',
              label: 'Gestor de Suscripciones',
              shortLabel: 'Suscripciones',
              icon: RefreshCw,
            },
          ],
        },
        {
          hubId: 'hub_savings',
          label: 'Ahorros, Metas y Deseos',
          icon: PiggyBank,
          defaultSection: 'savings',
          subSections: [
            {
              id: 'savings',
              label: 'Mis Ahorros',
              shortLabel: 'Mis Ahorros',
              icon: PiggyBank,
            },
            {
              id: 'goals',
              label: 'Metas de Ahorro',
              shortLabel: 'Metas de Ahorro',
              icon: Target,
            },
            {
              id: 'wishlist',
              label: 'Lista de Deseos (Wishlist)',
              shortLabel: 'Lista de Deseos',
              icon: Gift,
            },
          ],
        },
      ],
    },
    {
      groupTitle: 'Hogar, Pareja y Reportes',
      hubs: [
        {
          hubId: 'hub_home',
          label: 'Hogar, Mercado y Menú',
          icon: Utensils,
          defaultSection: 'market',
          badge: 'Hogar',
          subSections: [
            {
              id: 'market',
              label: 'Lista de Mercado Simple',
              shortLabel: 'Lista de Mercado',
              icon: CheckSquare,
            },
            {
              id: 'weekly_menu',
              label: 'Planificador de Menú Semanal',
              shortLabel: 'Menú Semanal',
              icon: Utensils,
            },
            {
              id: 'assets',
              label: 'Bóveda de Garantías (Assets)',
              shortLabel: 'Garantías (Assets)',
              icon: Shield,
            },
          ],
        },
        {
          hubId: 'hub_couples',
          label: 'Pareja y Fondo de Citas',
          icon: HeartHandshake,
          defaultSection: 'couples',
          badge: 'Hub',
          isHighlight: true,
          subSections: [
            {
              id: 'couples',
              label: 'Finanzas en Pareja',
              shortLabel: 'Finanzas en Pareja',
              icon: HeartHandshake,
            },
            {
              id: 'romance_fund',
              label: 'Fondo y Ruleta de Citas',
              shortLabel: 'Fondo y Ruleta de Citas',
              icon: Heart,
            },
          ],
        },
        {
          hubId: 'hub_reports',
          label: 'Estadísticas, PDF y Tools',
          icon: BarChart3,
          defaultSection: 'statistics',
          subSections: [
            {
              id: 'statistics',
              label: 'Estadísticas e Informes',
              shortLabel: 'Estadísticas',
              icon: BarChart3,
            },
            {
              id: 'monthly_report',
              label: 'Estado de Cuenta (PDF)',
              shortLabel: 'Estado de Cuenta PDF',
              icon: FileText,
            },
            {
              id: 'tools',
              label: 'Herramientas y Calculadoras',
              shortLabel: 'Herramientas',
              icon: Sparkles,
            },
          ],
        },
        {
          hubId: 'hub_settings',
          label: 'Configuración y Respaldo',
          icon: Settings,
          defaultSection: 'settings',
          subSections: [
            {
              id: 'settings',
              label: 'Configuración y Respaldo',
              shortLabel: 'Configuración',
              icon: Settings,
            },
          ],
        },
      ],
    },
  ];

  const activeHub = useMemo(() => {
    for (const group of sidebarHubGroups) {
      for (const hub of group.hubs) {
        if (hub.subSections.some((sub) => sub.id === activeSection)) {
          return hub;
        }
      }
    }
    return null;
  }, [activeSection]);

  const getCategoryById = (id: string): Category | undefined =>
    appData.categories.find((c) => c.id === id);

  const getWalletById = (id?: string): WalletAccount | undefined =>
    (appData.wallets || []).find((w) => w.id === id);

  const isMasculineOrDark =
    currentTheme === 'masculine' ||
    currentTheme === 'dark' ||
    currentTheme === 'dark-pro';

  return (
    <div
      data-theme={currentTheme}
      className="min-h-screen flex flex-col lg:flex-row bg-[var(--background)] text-[var(--text-primary)] transition-colors duration-200"
    >
      <OfflineIndicator />
      {/* Menú Lateral Fijo en Escritorio */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-[var(--surface-subtle)] border-r border-[var(--border-hairline)] select-none">
        <div className="px-6 py-5 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2.5">
            <img
              src="/icon.svg?v=2"
              alt="Mis Finanzas"
              className="w-9 h-9 rounded-xl shadow-xs shrink-0 select-none"
            />
            <span className="text-xl font-bold font-editorial tracking-tight text-[var(--text-primary)] truncate">
              {appData.settings.userName || 'Mis Finanzas'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5">
            Gestión financiera personal · Base USD
          </p>
        </div>

        <nav
          id="tour-sidebar-nav"
          className="flex-1 px-3 py-3 space-y-4 overflow-y-auto"
        >
          {sidebarHubGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-75">
                {group.groupTitle}
              </div>
              {group.hubs.map((hub) => {
                const Icon = hub.icon;
                const isHubActive = hub.subSections.some(
                  (s) => s.id === activeSection
                );
                return (
                  <div key={hub.hubId} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isHubActive) {
                          setActiveSection(hub.defaultSection);
                        }
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium rounded-xl transition-colors whitespace-nowrap ${
                        isHubActive
                          ? hub.isHighlight
                            ? 'bg-[var(--lavender-accent)] text-white shadow-xs'
                            : 'bg-[var(--pink-primary)] text-white shadow-xs'
                          : hub.isHighlight
                            ? 'bg-[var(--lavender-soft)]/60 text-[var(--lavender-text)] hover:bg-[var(--lavender-soft)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{hub.label}</span>
                      </span>
                      {hub.badge ? (
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider shrink-0 ${
                            isHubActive
                              ? 'bg-white/20 text-white'
                              : hub.isHighlight
                                ? 'bg-[var(--lavender-accent)] text-white'
                                : 'bg-[var(--pink-light)] text-[var(--pink-primary)]'
                          }`}
                        >
                          {hub.badge}
                        </span>
                      ) : hub.subSections.length > 1 ? (
                        <span
                          className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded-md ${
                            isHubActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[var(--surface)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {hub.subSections.length}
                        </span>
                      ) : null}
                    </button>

                    {/* Sub-secciones compactas cuando el grupo está activo */}
                    {isHubActive && hub.subSections.length > 1 && (
                      <div className="pl-5 pr-1 py-0.5 space-y-0.5 border-l-2 border-[var(--pink-primary)]/30 ml-4">
                        {hub.subSections.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = activeSection === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setActiveSection(sub.id)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                                isSubActive
                                  ? 'font-bold text-[var(--pink-primary)] bg-[var(--pink-light)]/70'
                                  : 'font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]/60'
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{sub.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Contenedor #config-menu con acceso a Mi Wrapped (Historias), Tutorial y PWA */}
        <div id="config-menu" className="px-3 pb-2 space-y-1.5">
          <button
            type="button"
            onClick={() => setWrappedModalOpen(true)}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-[#7C5CFC]/15 via-[#EC4899]/15 to-[#10B981]/15 hover:from-[#7C5CFC]/25 hover:via-[#EC4899]/25 hover:to-[#10B981]/25 text-[var(--text-primary)] border border-[#EC4899]/40 transition-all shadow-2xs"
            title="Ver tu Resumen estilo Spotify Wrapped e Historias de Instagram"
          >
            <span className="flex items-center gap-2.5 truncate">
              <Sparkles className="w-4 h-4 text-[#EC4899] shrink-0" />
              <span className="truncate">Mi Wrapped (Historias)</span>
            </span>
            <span className="text-[10px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899]">
              Stories
            </span>
          </button>
          <button
            type="button"
            onClick={handleStartGuidedTour}
            className="w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--pink-primary)] border border-[var(--border-hairline)] transition-colors shadow-2xs"
            title="Iniciar nuevamente el Tour Guiado paso a paso"
          >
            <span className="flex items-center gap-2.5 truncate">
              <Compass className="w-4 h-4 shrink-0" />
              <span className="truncate">Reproducir Tutorial</span>
            </span>
            <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--pink-light)] text-[var(--pink-primary)]">
              Tour
            </span>
          </button>
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* Resumen compacto de Tasa BCV en el menú lateral */}
        <div className="p-4 m-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Dólar oficial BCV</span>
            <button
              type="button"
              onClick={() => actualizarTasaOficial(true)}
              disabled={rateLoading}
              className="text-[var(--pink-primary)] hover:text-[var(--pink-dark)] disabled:opacity-40"
              title="Actualizar tasa BCV"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${rateLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
          <div className="text-sm font-semibold font-mono-tabular text-[var(--text-primary)]">
            {officialRate
              ? formatearEquivalenciaTasa(officialRate, locale)
              : appData.settings.defaultExchangeRate
                ? `1 USD = ${formatearTasa(appData.settings.defaultExchangeRate, locale)} Bs (Manual)`
                : 'Sin tasa consultada'}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            {appData.settings.lastOfficialRateDate
              ? `Fecha BCV: ${appData.settings.lastOfficialRateDate}`
              : 'Usa «Actualizar tasa» o tasa manual'}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
          Tus datos financieros se guardan en este navegador. Descarga copias de seguridad periódicamente para evitar perderlos.
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract (3 Zonas: Marca/Título, Enlaces concisos, 1 CTA primario) */}
        <header
          id="tour-header-bar"
          className="app-topbar no-print sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-8 py-3.5 bg-[var(--surface)]/95 backdrop-blur-xs border-b border-[var(--border-hairline)]"
        >
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-lg font-bold font-editorial text-[var(--text-primary)] whitespace-nowrap truncate">
              {navItems.find((n) => n.id === activeSection)?.label ||
                'Mis Finanzas'}
            </span>
          </div>

          {/* Enlaces rápidos en escritorio */}
          <nav className="hidden xl:flex items-center gap-6 text-xs font-medium text-[var(--text-secondary)]">
            <button
              type="button"
              onClick={() => setActiveSection('dashboard')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'dashboard'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Resumen
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('upcoming_payments')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                activeSection === 'upcoming_payments'
                  ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] font-bold'
                  : 'bg-[var(--pink-light)]/60 text-[var(--pink-primary)] border-[var(--pink-primary)]/30 font-semibold'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Agenda de Pagos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('couples')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeSection === 'couples'
                  ? 'text-[var(--lavender-accent)] font-bold'
                  : 'text-[var(--lavender-text)] font-semibold'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>En Pareja</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('wallets')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'wallets'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Billeteras
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('movements')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'movements'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Movimientos
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('budgets')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'budgets'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Presupuesto
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('debts')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'debts'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Préstamos
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('wishlist')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'wishlist'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Deseos
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('savings')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'savings'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Ahorros
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('statistics')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'statistics'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              Estadísticas
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('monthly_report')}
              className={`hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeSection === 'monthly_report'
                  ? 'text-[var(--pink-primary)] font-semibold'
                  : ''
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reporte PDF</span>
            </button>
          </nav>

          {/* Zona 3: Respaldo JSON discreto + Tema Oscuro Pro + Tutorial + Centro Push + 1 Acción Primaria */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Botones pequeños y discretos solo con icono para Descargar / Cargar JSON */}
            <div className="inline-flex items-center rounded-lg border border-transparent hover:border-[var(--border-hairline)] bg-transparent hover:bg-[var(--surface-subtle)]/70 p-0.5 transition-all opacity-65 hover:opacity-100">
              <button
                type="button"
                onClick={handleExportJson}
                title="Descargar respaldo JSON"
                aria-label="Descargar respaldo JSON"
                className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => headerJsonInputRef.current?.click()}
                title="Cargar respaldo JSON"
                aria-label="Cargar respaldo JSON"
                className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <input
                ref={headerJsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleQuickHeaderImportJson}
                className="hidden"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const currentOption = THEME_OPTIONS.find(
                  (t) => t.id === currentTheme
                );
                const nextTheme: ThemeMode =
                  currentOption?.pairedId ||
                  (currentTheme.startsWith('dark') ? 'neobank' : 'dark-pro');
                const nextOption = THEME_OPTIONS.find(
                  (t) => t.id === nextTheme
                );
                setAppData((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    themeMode: nextTheme,
                  },
                }));
                showToast(
                  `Tema aplicado: ${nextOption?.label || nextTheme}`,
                  'info'
                );
              }}
              title={
                currentTheme.startsWith('dark')
                  ? 'Cambiar a su versión en Modo Claro'
                  : 'Cambiar a su versión en Modo Oscuro'
              }
              aria-label="Alternar Modo Claro / Oscuro"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                currentTheme.startsWith('dark')
                  ? 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-input)] hover:bg-[var(--surface-hover)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] border-transparent hover:border-[var(--border-hairline)]'
              }`}
            >
              {currentTheme.startsWith('dark') ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xl:inline">Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Modo Oscuro</span>
                </>
              )}
            </button>
            <button
              id="tour-header-config-btn"
              type="button"
              onClick={handleStartGuidedTour}
              title="Reproducir Tutorial Guiado"
              aria-label="Reproducir Tutorial Guiado"
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--pink-primary)] hover:bg-[var(--surface-subtle)] border border-transparent hover:border-[var(--border-hairline)] transition-colors"
            >
              <Compass className="w-4 h-4" />
            </button>
            <PushNotificationBellButton
              reminders={activePushReminders}
              config={pushConfig}
              permission={pushPermission}
              onClick={() => setPushCenterOpen(true)}
            />
            <button
              type="button"
              onClick={() => setQuickCreateModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo</span>
            </button>
          </div>
        </header>

        {/* Menú Móvil Desplegable */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 w-72 max-w-[85vw] bg-[var(--surface-subtle)] h-full flex flex-col justify-between p-5 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src="/icon.svg?v=2"
                      alt="Mis Finanzas"
                      className="w-8 h-8 rounded-xl shadow-xs shrink-0"
                    />
                    <span className="text-lg font-bold font-editorial text-[var(--text-primary)] truncate">
                      {appData.settings.userName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="mt-4 space-y-3">
                  {sidebarHubGroups.map((group) => (
                    <div key={`mob_${group.groupTitle}`} className="space-y-1">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-75">
                        {group.groupTitle}
                      </div>
                      {group.hubs.map((hub) => {
                        const Icon = hub.icon;
                        const isHubActive = hub.subSections.some(
                          (s) => s.id === activeSection
                        );
                        return (
                          <div key={`mob_${hub.hubId}`} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSection(hub.defaultSection);
                                if (hub.subSections.length <= 1) {
                                  setMobileMenuOpen(false);
                                }
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium rounded-xl ${
                                isHubActive
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                              }`}
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="truncate">{hub.label}</span>
                              </span>
                              {hub.subSections.length > 1 && (
                                <span
                                  className={`text-[10px] font-mono-tabular px-1.5 py-0.5 rounded-md ${
                                    isHubActive
                                      ? 'bg-white/20 text-white'
                                      : 'bg-[var(--surface)] text-[var(--text-secondary)]'
                                  }`}
                                >
                                  {hub.subSections.length}
                                </span>
                              )}
                            </button>
                            {isHubActive && hub.subSections.length > 1 && (
                              <div className="pl-5 pr-1 py-0.5 space-y-0.5 border-l-2 border-[var(--pink-primary)]/30 ml-4">
                                {hub.subSections.map((sub) => {
                                  const SubIcon = sub.icon;
                                  const isSubActive = activeSection === sub.id;
                                  return (
                                    <button
                                      key={`mob_sub_${sub.id}`}
                                      type="button"
                                      onClick={() => {
                                        setActiveSection(sub.id);
                                        setMobileMenuOpen(false);
                                      }}
                                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${
                                        isSubActive
                                          ? 'font-bold text-[var(--pink-primary)] bg-[var(--pink-light)]/70'
                                          : 'font-medium text-[var(--text-secondary)]'
                                      }`}
                                    >
                                      <SubIcon className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">
                                        {sub.shortLabel}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </nav>

                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setWrappedModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#7C5CFC]/15 via-[#EC4899]/15 to-[#10B981]/15 text-[var(--text-primary)] border border-[#EC4899]/40"
                  >
                    <span className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-[#EC4899] shrink-0" />
                      <span>Mi Wrapped (Historias)</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular font-bold px-1.5 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899]">
                      Stories
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartGuidedTour}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-[var(--surface)] text-[var(--pink-primary)] border border-[var(--border-hairline)]"
                  >
                    <span className="flex items-center gap-2.5">
                      <Compass className="w-4 h-4 shrink-0" />
                      <span>Reproducir Tutorial</span>
                    </span>
                    <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-[var(--pink-light)]">
                      Tour
                    </span>
                  </button>
                  <PWAInstallButton variant="sidebar" />
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
                Tus datos financieros se guardan en este navegador. Descarga copias de seguridad periódicamente para evitar perderlos.
              </div>
            </div>
          </div>
        )}

        {/* Notificación Flotante */}
        {toast && (
          <div className="no-print fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl shadow-lg border bg-[var(--surface)] border-[var(--border-hairline)] flex items-center gap-3 text-xs text-[var(--text-primary)]">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                toast.kind === 'error'
                  ? 'bg-[var(--expense-color)]'
                  : toast.kind === 'info'
                    ? 'bg-[var(--lavender-accent)]'
                    : 'bg-[var(--income-color)]'
              }`}
            />
            <span>{toast.text}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Área de Contenido Principal */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1360px] w-full mx-auto space-y-6">
          {/* Barra unificada de pestañas cuando la sección pertenece a un módulo agrupado */}
          {activeHub && activeHub.subSections.length > 1 && (
            <div className="no-print bg-[var(--surface)] p-2 rounded-2xl border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {activeHub.subSections.map((sub) => {
                  const SubIcon = sub.icon;
                  const isCurrent = activeSection === sub.id;
                  return (
                    <button
                      key={`tab_${sub.id}`}
                      type="button"
                      onClick={() => setActiveSection(sub.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-all ${
                        isCurrent
                          ? 'bg-[var(--pink-primary)] text-white shadow-2xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      <SubIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>
              <span className="hidden sm:inline-block px-3 text-[11px] font-medium text-[var(--text-secondary)]">
                {activeHub.label}
              </span>
            </div>
          )}
          {/* ========================================================= */}
          {/* 1. SECCIÓN: DASHBOARD PRINCIPAL                           */}
          {/* ========================================================= */}
          {activeSection === 'dashboard' && (
            <div className="space-y-6">
              {/* 1. CABECERA SIMPLIFICADA DEL DASHBOARD */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[var(--surface-subtle)] p-5 sm:p-6 rounded-2xl border border-[var(--border-hairline)]">
                <div className="space-y-1.5">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
                    {isMasculineOrDark
                      ? `Panel financiero: ${appData.settings.userName}`
                      : `Hola, bienvenida a ${appData.settings.userName}`}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span>
                      Resumen de{' '}
                      <strong className="text-[var(--text-primary)]">
                        {formatearNombreMes(selectedMonth)}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setActiveSection('upcoming_payments')}
                      className="text-[var(--pink-primary)] font-semibold hover:underline inline-flex items-center gap-1"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Agenda de Pagos</span>
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setTrophyModalOpen(true)}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium hover:underline inline-flex items-center gap-1"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Logros ({achievementsEvaluation.unlockedCount}/
                        {achievementsEvaluation.totalCount})
                      </span>
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setWrappedModalOpen(true)}
                      className="text-[#EC4899] font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Mi Wrapped / Historias</span>
                    </button>
                  </div>
                </div>

                <div
                  id="tour-quick-actions"
                  className="flex flex-wrap items-center gap-2"
                >
                  {/* Botón Estilo Spotify Wrapped / Historia de Instagram */}
                  <button
                    type="button"
                    onClick={() => setWrappedModalOpen(true)}
                    title="Abrir tu Resumen Financiero estilo Spotify Wrapped / Historias de Instagram"
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#7C5CFC]/20 via-[#EC4899]/20 to-[#10B981]/20 hover:from-[#7C5CFC]/30 hover:via-[#EC4899]/30 hover:to-[#10B981]/30 text-[var(--text-primary)] border border-[#EC4899]/50 transition-all inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#EC4899]" />
                    <span>Mi Wrapped</span>
                  </button>

                  {/* Tasa BCV + Calculadora */}
                  <div
                    id="tour-bcv-rate"
                    className="inline-flex items-center gap-1.5 bg-[var(--surface)] px-3 py-1.5 rounded-xl border border-[var(--border-input)]"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--rose-gold)]">
                      BCV:
                    </span>
                    <span className="text-xs font-bold font-mono-tabular text-[var(--text-primary)]">
                      {officialRate
                        ? `1 $ = ${formatearTasa(officialRate, locale)} Bs`
                        : appData.settings.defaultExchangeRate
                          ? `1 $ = ${formatearTasa(appData.settings.defaultExchangeRate, locale)} Bs`
                          : 'Sin tasa'}
                    </span>
                    <button
                      type="button"
                      onClick={() => actualizarTasaOficial(true)}
                      disabled={rateLoading}
                      title="Actualizar tasa BCV"
                      aria-label="Actualizar tasa BCV"
                      className="p-1 rounded-lg text-[var(--pink-primary)] hover:bg-[var(--pink-light)] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          rateLoading ? 'animate-spin' : ''
                        }`}
                      />
                    </button>
                    <span className="h-3.5 w-px bg-[var(--border-hairline)]" />
                    <button
                      type="button"
                      onClick={() => setCalcModalOpen(true)}
                      title="Abrir calculadora rápida USD ⇄ Bs"
                      aria-label="Abrir calculadora rápida USD a Bs"
                      className="p-1 rounded-lg text-[var(--pink-primary)] hover:bg-[var(--pink-light)] transition-colors"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selector de mes */}
                  <div className="flex items-center gap-2 bg-[var(--surface)] px-3 py-1.5 rounded-xl border border-[var(--border-input)]">
                    <Calendar className="w-4 h-4 text-[var(--pink-primary)]" />
                    <label htmlFor="dashboard-month" className="sr-only">
                      Mes y año
                    </label>
                    <input
                      id="dashboard-month"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        if (e.target.value) setSelectedMonth(e.target.value);
                      }}
                      className="text-xs font-medium text-[var(--text-primary)] bg-transparent focus:outline-none"
                    />
                  </div>

                  {/* Botón único universal "+ Nuevo" que pregunta qué deseas registrar */}
                  <button
                    type="button"
                    onClick={() => setQuickCreateModalOpen(true)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors whitespace-nowrap inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nuevo</span>
                  </button>
                </div>
              </div>

              {/* 2. FILA PRINCIPAL DE 4 INDICADORES LIMPIOS (Regla de 1 cifra protagonista) */}
              <div id="tour-balance-cards" className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Indicador 1: Disponible Total Consolidado ($ + Bs) */}
                  <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span className="font-medium">
                        Disponible total ($ + Bs)
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-[var(--income-color)]" />
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--text-primary)]">
                        {formatearMonto(
                          resumenMes.dineroDisponibleEstimadoUsd,
                          'USD',
                          locale
                        )}
                      </div>
                      {effectiveConversionRate && (
                        <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
                          ≈{' '}
                          {formatearMonto(
                            resumenMes.dineroDisponibleEstimadoUsd *
                              effectiveConversionRate,
                            'VES',
                            locale
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Indicador 2: Mis Dólares ($) y Mis Bolívares (Bs) */}
                  <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span className="font-medium">
                        Separado por moneda
                      </span>
                      <Landmark className="w-4 h-4 text-[var(--pink-primary)]" />
                    </div>
                    <div className="space-y-1.5 font-mono-tabular">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-sans text-[var(--text-secondary)]">
                          En Dólares ($):
                        </span>
                        <span className="text-base font-bold text-[var(--text-primary)]">
                          {formatearMonto(
                            resumenMes.balanceSoloDolaresUsd,
                            'USD',
                            locale
                          )}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-[var(--border-divider)]">
                        <span className="text-xs font-sans text-[var(--text-secondary)]">
                          En Bolívares:
                        </span>
                        <div className="text-right">
                          <span className="text-base font-bold text-[var(--pink-primary)]">
                            {formatearMonto(
                              resumenMes.balanceSoloBolivaresVes,
                              'VES',
                              locale
                            )}
                          </span>
                          <span className="text-[11px] text-[var(--text-secondary)] block">
                            ≈{' '}
                            {formatearMonto(
                              effectiveConversionRate &&
                                effectiveConversionRate > 0
                                ? resumenMes.balanceSoloBolivaresVes /
                                    effectiveConversionRate
                                : resumenMes.balanceSoloBolivaresEquivUsd,
                              'USD',
                              locale
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Indicador 3: Ingresos del Mes */}
                  <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span className="font-medium">
                        Ingresos de {formatearNombreMes(selectedMonth)}
                      </span>
                      <ArrowUpRight className="w-4 h-4 text-[var(--income-color)]" />
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--income-color)]">
                        +{formatearMonto(resumenMes.ingresosMesUsd, 'USD', locale)}
                      </div>
                      <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5 flex items-center justify-between">
                        <span>
                          {effectiveConversionRate
                            ? `≈ ${formatearMonto(resumenMes.ingresosMesUsd * effectiveConversionRate, 'VES', locale)}`
                            : ''}
                        </span>
                        {resumenMes.ingresosPendientesMesUsd > 0 && (
                          <span className="text-[var(--lavender-accent)]">
                            Pend: +{formatearMonto(resumenMes.ingresosPendientesMesUsd, 'USD', locale)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Indicador 4: Gastos del Mes */}
                  <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span className="font-medium">
                        Gastos de {formatearNombreMes(selectedMonth)}
                      </span>
                      <ArrowDownRight className="w-4 h-4 text-[var(--expense-color)]" />
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[var(--expense-color)]">
                        -{formatearMonto(resumenMes.gastosMesUsd, 'USD', locale)}
                      </div>
                      <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5 flex items-center justify-between">
                        <span>
                          Neto mes:{' '}
                          <strong
                            className={
                              resumenMes.balanceNetoMensualUsd >= 0
                                ? 'text-[var(--income-color)]'
                                : 'text-[var(--expense-color)]'
                            }
                          >
                            {resumenMes.balanceNetoMensualUsd >= 0 ? '+' : ''}
                            {formatearMonto(
                              resumenMes.balanceNetoMensualUsd,
                              'USD',
                              locale
                            )}
                          </strong>
                        </span>
                        {resumenMes.gastosPendientesMesUsd > 0 && (
                          <span className="text-[var(--warning-color)]">
                            Pend: -{formatearMonto(resumenMes.gastosPendientesMesUsd, 'USD', locale)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botón sutil para desplegar u ocultar los detalles técnicos (Cuentas vs Efectivo, Proyectado y Patrimonio) */}
                <div className="flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() =>
                      setShowDashboardDetailedBreakdown((prev) => !prev)
                    }
                    className="text-xs font-semibold text-[var(--pink-primary)] hover:underline inline-flex items-center gap-1.5"
                  >
                    <span>
                      {showDashboardDetailedBreakdown
                        ? '▴ Ocultar desglose detallado (Cuentas, Efectivo, Proyectado y Patrimonio)'
                        : '▾ Ver desglose detallado (Cuentas vs. Efectivo, Proyectado y Patrimonio)'}
                    </span>
                  </button>

                  <span className="text-[11px] font-mono-tabular text-[var(--text-secondary)] hidden sm:inline">
                    Proyectado total:{' '}
                    <strong className="text-[var(--lavender-accent)]">
                      {formatearMonto(resumenMes.saldoProyectadoUsd, 'USD', locale)}
                    </strong>{' '}
                    · Ahorros:{' '}
                    <strong className="text-[var(--rose-gold)]">
                      {formatearMonto(resumenMes.totalAhorradoUsd, 'USD', locale)}
                    </strong>
                  </span>
                </div>

                {/* Panel Desplegable de Detalles Técnicos (Oculto por defecto para no abrumar) */}
                {showDashboardDetailedBreakdown && (
                  <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono-tabular">
                    {/* Columna 1: Desglose Dólares */}
                    <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
                      <div className="font-sans font-semibold text-[var(--text-primary)] border-b border-[var(--border-divider)] pb-1.5">
                        Detalle en Dólares (USD)
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[var(--text-secondary)]">
                          🏦 En Cuentas / Digital:
                        </span>
                        <strong className="text-[var(--text-primary)]">
                          {formatearMonto(
                            resumenMes.enCuentasDolaresUsd,
                            'USD',
                            locale
                          )}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[var(--text-secondary)]">
                          💵 En Efectivo ($):
                        </span>
                        <strong className="text-[var(--income-color)]">
                          {formatearMonto(
                            resumenMes.enEfectivoDolaresUsd,
                            'USD',
                            locale
                          )}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-divider)]">
                        <span className="font-sans text-[var(--text-secondary)]">
                          Proyectado USD:
                        </span>
                        <strong className="text-[var(--lavender-accent)]">
                          {formatearMonto(
                            resumenMes.proyectadoSoloDolaresUsd,
                            'USD',
                            locale
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* Columna 2: Desglose Bolívares */}
                    <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
                      <div className="font-sans font-semibold text-[var(--text-primary)] border-b border-[var(--border-divider)] pb-1.5">
                        Detalle en Bolívares (Bs)
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[var(--text-secondary)]">
                          🏦 En Bancos (Bs):
                        </span>
                        <strong className="text-[var(--text-primary)]">
                          {formatearMonto(
                            resumenMes.enCuentasBolivaresVes,
                            'VES',
                            locale
                          )}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[var(--text-secondary)]">
                          💵 En Efectivo (Bs):
                        </span>
                        <strong className="text-[var(--income-color)]">
                          {formatearMonto(
                            resumenMes.enEfectivoBolivaresVes,
                            'VES',
                            locale
                          )}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-divider)]">
                        <span className="font-sans text-[var(--text-secondary)]">
                          Proyectado Bs:
                        </span>
                        <strong className="text-[var(--lavender-accent)]">
                          {formatearMonto(
                            resumenMes.proyectadoSoloBolivaresVes,
                            'VES',
                            locale
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* Columna 3: Patrimonio, Ahorros y Proyectado Consolidado */}
                    <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
                      <div className="font-sans font-semibold text-[var(--text-primary)] border-b border-[var(--border-divider)] pb-1.5">
                        Patrimonio y Proyección Global
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[var(--text-secondary)]">
                          Saldo proyectado total:
                        </span>
                        <strong className="text-[var(--lavender-accent)]">
                          {formatearMonto(
                            resumenMes.saldoProyectadoUsd,
                            'USD',
                            locale
                          )}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-[var(--text-secondary)]">
                          Ahorro acumulado:
                        </span>
                        <strong className="text-[var(--rose-gold)]">
                          {formatearMonto(
                            resumenMes.totalAhorradoUsd,
                            'USD',
                            locale
                          )}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-divider)]">
                        <span className="font-sans text-[var(--text-secondary)]">
                          Patrimonio total:
                        </span>
                        <strong className="text-[var(--text-primary)]">
                          {formatearMonto(
                            resumenMes.patrimonioFinancieroUsd,
                            'USD',
                            locale
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. MITAD INFERIOR ORGANIZADA POR PESTAÑAS (Movimientos · Consultar Cuenta · Gráficas) */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] p-2 rounded-2xl border border-[var(--border-hairline)]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDashboardBottomTab('movements')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        dashboardBottomTab === 'movements'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      🕒 Últimos Movimientos
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardBottomTab('wallets')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        dashboardBottomTab === 'wallets'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      🏦 Consultar una Cuenta
                    </button>
                    <button
                      type="button"
                      onClick={() => setDashboardBottomTab('charts')}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        dashboardBottomTab === 'charts'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      📊 Gráficas del Mes
                    </button>
                  </div>

                  {dashboardBottomTab === 'movements' && (
                    <button
                      type="button"
                      onClick={() => setActiveSection('movements')}
                      className="px-3 text-xs font-semibold text-[var(--pink-primary)] hover:underline"
                    >
                      Ver historial completo →
                    </button>
                  )}
                  {dashboardBottomTab === 'wallets' && (
                    <button
                      type="button"
                      onClick={() => setActiveSection('wallets')}
                      className="px-3 text-xs font-semibold text-[var(--pink-primary)] hover:underline"
                    >
                      Ir al módulo de Billeteras →
                    </button>
                  )}
                  {dashboardBottomTab === 'charts' && (
                    <button
                      type="button"
                      onClick={() => setActiveSection('statistics')}
                      className="px-3 text-xs font-semibold text-[var(--pink-primary)] hover:underline"
                    >
                      Ver más estadísticas →
                    </button>
                  )}
                </div>

                {/* PESTAÑA A: ÚLTIMOS MOVIMIENTOS (LIMPIA Y DIRECTA) */}
                {dashboardBottomTab === 'movements' && (
                  <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
                    {appData.transactions.length === 0 ? (
                      <div className="p-8 text-center space-y-3">
                        <p className="text-sm text-[var(--text-secondary)]">
                          Todavía no hay movimientos registrados.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTxn(null);
                            setPresetTxnValues(null);
                            setTxnModalInitialType('expense');
                            setTxnModalOpen(true);
                          }}
                          className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] rounded-xl"
                        >
                          Registrar primer movimiento
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--text-secondary)]">
                              <th className="py-3 px-4">Fecha</th>
                              <th className="py-3 px-4">Descripción · Cuenta</th>
                              <th className="py-3 px-4">Estado</th>
                              <th className="py-3 px-4 text-right">Monto</th>
                              <th className="py-3 px-4 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-divider)] text-xs">
                            {[...appData.transactions]
                              .sort((a, b) =>
                                compararTransaccionesRecientesPrimero(a, b)
                              )
                              .slice(0, 8)
                              .map((txn) => {
                                const cat = getCategoryById(txn.categoryId);
                                const wallet = getWalletById(txn.walletId);
                                const isCompleted =
                                  esTransaccionCompletada(txn);
                                return (
                                  <tr
                                    key={txn.id}
                                    className="hover:bg-[var(--surface-subtle)]/60 transition-colors"
                                  >
                                    <td className="py-3 px-4 font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                                      <span className="font-semibold text-[var(--text-primary)]">
                                        {txn.date}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-medium text-[var(--text-primary)]">
                                        {txn.description}
                                      </div>
                                      <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-1.5 mt-0.5">
                                        {wallet && (
                                          <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                                            <span
                                              className="w-2 h-2 rounded-full shrink-0"
                                              style={{
                                                backgroundColor: wallet.color,
                                              }}
                                            />
                                            <span>{wallet.name}</span>
                                            <span>·</span>
                                          </span>
                                        )}
                                        <span>{cat?.name || 'General'}</span>
                                        {txn.purchasedItems &&
                                          txn.purchasedItems.length > 0 && (
                                            <>
                                              <span>·</span>
                                              <span className="text-[var(--pink-primary)] font-semibold">
                                                🛍️ {txn.purchasedItems.length} art.
                                              </span>
                                            </>
                                          )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleTransactionStatus(txn)
                                        }
                                        title="Haz clic para cambiar entre Completado y Pendiente"
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-opacity hover:opacity-80 ${
                                          isCompleted
                                            ? 'bg-[var(--income-bg)] text-[var(--income-color)]'
                                            : 'bg-[var(--lavender-soft)] text-[var(--lavender-text)]'
                                        }`}
                                      >
                                        {isCompleted ? (
                                          <>
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Completado</span>
                                          </>
                                        ) : (
                                          <>
                                            <Clock className="w-3 h-3" />
                                            <span>Pendiente</span>
                                          </>
                                        )}
                                      </button>
                                    </td>
                                    <td
                                      className={`py-3 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap ${
                                        !isCompleted
                                          ? 'text-[var(--text-secondary)]'
                                          : txn.type === 'income'
                                            ? 'text-[var(--income-color)]'
                                            : 'text-[var(--expense-color)]'
                                      }`}
                                    >
                                      <div>
                                        {txn.type === 'income' ? '+' : '-'}
                                        {formatearMonto(
                                          txn.amount,
                                          txn.currency,
                                          locale
                                        )}
                                      </div>
                                      <div className="text-[10px] font-normal text-[var(--text-secondary)]">
                                        ≈{' '}
                                        {txn.currency === 'VES'
                                          ? formatearMonto(
                                              txn.amountUsd,
                                              'USD',
                                              locale
                                            )
                                          : formatearMonto(
                                              txn.amountUsd *
                                                (txn.exchangeRate ||
                                                  effectiveConversionRate ||
                                                  450),
                                              'VES',
                                              locale
                                            )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingTxn(txn);
                                            setTxnModalOpen(true);
                                          }}
                                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg"
                                          title="Editar"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteTransaction(txn)
                                          }
                                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)] rounded-lg"
                                          title="Eliminar"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* PESTAÑA B: CONSULTAR UNA CUENTA INDIVIDUAL */}
                {dashboardBottomTab === 'wallets' &&
                  (() => {
                    const activeWalletsList =
                      resumenBilleteras.billeteras.filter(
                        (wb) => wb.wallet.active
                      );
                    const selectedWb =
                      activeWalletsList.find(
                        (wb) => wb.wallet.id === dashboardSelectedWalletId
                      ) ||
                      activeWalletsList[0] ||
                      null;
                    const currentIdx = selectedWb
                      ? activeWalletsList.findIndex(
                          (wb) => wb.wallet.id === selectedWb.wallet.id
                        )
                      : -1;

                    const reorderWalletFromDashboard = (
                      draggedId: string,
                      targetId: string
                    ) => {
                      if (!draggedId || !targetId || draggedId === targetId)
                        return;
                      setAppData((prev) => {
                        const list = [...(prev.wallets || INITIAL_WALLETS)].sort(
                          (a, b) => {
                            const oa =
                              typeof a.sortOrder === 'number'
                                ? a.sortOrder
                                : Number.MAX_SAFE_INTEGER;
                            const ob =
                              typeof b.sortOrder === 'number'
                                ? b.sortOrder
                                : Number.MAX_SAFE_INTEGER;
                            return oa - ob;
                          }
                        );
                        const fromIdx = list.findIndex(
                          (w) => w.id === draggedId
                        );
                        const toIdx = list.findIndex((w) => w.id === targetId);
                        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx)
                          return prev;
                        const [moved] = list.splice(fromIdx, 1);
                        list.splice(toIdx, 0, moved);
                        const normalized = list.map((w, idx) => ({
                          ...w,
                          sortOrder: idx,
                        }));
                        return {
                          ...prev,
                          wallets: normalized,
                        };
                      });
                    };

                    return (
                      <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
                          <div>
                            <h3 className="text-base font-semibold text-[var(--text-primary)]">
                              Selecciona la cuenta que deseas consultar
                            </h3>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              Mostrando únicamente los datos de la cuenta elegida · Puedes arrastrar las pestañas para ordenarlas.
                            </p>
                          </div>

                          {activeWalletsList.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setActiveSection('wallets')}
                                className="px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
                                title="Personalizar orden de tus cuentas"
                              >
                                ↕️ Ordenar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeWalletsList.length <= 1) return;
                                  const prevIndex =
                                    (currentIdx - 1 + activeWalletsList.length) %
                                    activeWalletsList.length;
                                  setDashboardSelectedWalletId(
                                    activeWalletsList[prevIndex].wallet.id
                                  );
                                }}
                                className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                                title="Cuenta anterior"
                              >
                                ◀
                              </button>
                              <select
                                value={selectedWb?.wallet.id || ''}
                                onChange={(e) =>
                                  setDashboardSelectedWalletId(e.target.value)
                                }
                                className="px-3.5 py-2 text-xs font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                              >
                                {activeWalletsList.map((wb, idx) => {
                                  const isV = wb.wallet.currency === 'VES';
                                  const bal = isV
                                    ? wb.wallet.isThirdPartyExpenseAccount
                                      ? wb.pasadoMesVes
                                      : wb.saldoActualVes
                                    : wb.wallet.isThirdPartyExpenseAccount
                                      ? wb.pasadoMesUsd
                                      : wb.saldoActualUsd;
                                  return (
                                    <option
                                      key={wb.wallet.id}
                                      value={wb.wallet.id}
                                    >
                                      {idx + 1}º {wb.wallet.name} ({wb.wallet.currency}) —{' '}
                                      {formatearMonto(
                                        bal,
                                        isV ? 'VES' : 'USD',
                                        locale
                                      )}
                                    </option>
                                  );
                                })}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeWalletsList.length <= 1) return;
                                  const nextIndex =
                                    (currentIdx + 1) % activeWalletsList.length;
                                  setDashboardSelectedWalletId(
                                    activeWalletsList[nextIndex].wallet.id
                                  );
                                }}
                                className="px-2.5 py-2 text-xs font-semibold rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                                title="Siguiente cuenta"
                              >
                                ▶
                              </button>
                            </div>
                          )}
                        </div>

                        {activeWalletsList.length > 1 && (
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {activeWalletsList.map((wb, idx) => {
                              const isSelected =
                                selectedWb?.wallet.id === wb.wallet.id;
                              return (
                                <button
                                  key={wb.wallet.id}
                                  type="button"
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData(
                                      'text/plain',
                                      wb.wallet.id
                                    );
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const draggedId =
                                      e.dataTransfer.getData('text/plain');
                                    reorderWalletFromDashboard(
                                      draggedId,
                                      wb.wallet.id
                                    );
                                  }}
                                  onClick={() =>
                                    setDashboardSelectedWalletId(wb.wallet.id)
                                  }
                                  title="Haz clic para ver o arrastra para cambiar de posición"
                                  className={`px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-2 shrink-0 border transition-all cursor-grab active:cursor-grabbing ${
                                    isSelected
                                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-hairline)]'
                                  }`}
                                >
                                  <span
                                    className={`text-[10px] font-bold font-mono-tabular px-1.5 py-0.5 rounded-md ${
                                      isSelected
                                        ? 'bg-black/20 text-white'
                                        : 'bg-[var(--surface)] text-[var(--text-secondary)]'
                                    }`}
                                  >
                                    {idx + 1}º
                                  </span>
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                                    style={{ backgroundColor: wb.wallet.color }}
                                  />
                                  <span className="truncate max-w-[160px]">
                                    {wb.wallet.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {selectedWb ? (
                          (() => {
                            const wb = selectedWb;
                            const isVes = wb.wallet.currency === 'VES';
                            const isThirdParty = Boolean(
                              wb.wallet.isThirdPartyExpenseAccount
                            );
                            const isBonusWallet =
                              Boolean(wb.wallet.isBonusCard) ||
                              (wb.wallet.banco || '')
                                .toLowerCase()
                                .includes('todoticket') ||
                              wb.wallet.name
                                .toLowerCase()
                                .includes('todoticket');
                            const isCashWallet = esBilleteraEfectivo(wb.wallet);
                            const primaryBalance = isVes
                              ? wb.saldoActualVes
                              : wb.saldoActualUsd;
                            const secondaryBalance = isVes
                              ? effectiveConversionRate &&
                                effectiveConversionRate > 0
                                ? wb.saldoActualVes / effectiveConversionRate
                                : wb.saldoActualUsd
                              : effectiveConversionRate
                                ? wb.saldoActualUsd * effectiveConversionRate
                                : wb.saldoActualVes;

                            if (isThirdParty) {
                              return (
                                <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-amber-500/40 space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                      <h4 className="text-base font-bold text-[var(--text-primary)]">
                                        {wb.wallet.name}
                                      </h4>
                                      <p className="text-xs text-[var(--text-secondary)]">
                                        Uso de{' '}
                                        {wb.wallet.beneficiaryName || 'Tercero'}{' '}
                                        · No suma a disponible
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openThirdPartyReloadModal(wb.wallet)
                                      }
                                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white"
                                    >
                                      + Pasar dinero
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                                      <span className="text-xs text-[var(--text-secondary)] block">
                                        Pasado este mes
                                      </span>
                                      <div className="text-xl font-bold font-mono-tabular text-[var(--expense-color)] mt-1">
                                        {formatearMonto(
                                          isVes
                                            ? wb.pasadoMesVes
                                            : wb.pasadoMesUsd,
                                          isVes ? 'VES' : 'USD',
                                          locale
                                        )}
                                      </div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                                      <span className="text-xs text-[var(--text-secondary)] block">
                                        Acumulado histórico
                                      </span>
                                      <div className="text-xl font-bold font-mono-tabular text-[var(--text-primary)] mt-1">
                                        {formatearMonto(
                                          isVes
                                            ? wb.acumuladoHistoricoVes
                                            : wb.acumuladoHistoricoUsdHistorico,
                                          isVes ? 'VES' : 'USD',
                                          locale
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className="w-4 h-4 rounded-lg shrink-0"
                                      style={{
                                        backgroundColor: wb.wallet.color,
                                      }}
                                    />
                                    <div>
                                      <h4 className="text-base font-bold text-[var(--text-primary)]">
                                        {wb.wallet.name}
                                      </h4>
                                      <span className="text-xs text-[var(--text-secondary)]">
                                        {wb.wallet.currency} ·{' '}
                                        {isCashWallet
                                          ? '💵 Efectivo'
                                          : isBonusWallet
                                            ? '🎟️ Tarjeta de Bonos'
                                            : wb.wallet.banco || '🏦 Cuenta'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {isBonusWallet && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openBonusCardModal(
                                              wb.wallet,
                                              'load_bonus'
                                            )
                                          }
                                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-hairline)]"
                                        >
                                          + Cargar Bono
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openBonusCardModal(
                                              wb.wallet,
                                              'transfer_to_bank'
                                            )
                                          }
                                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white"
                                        >
                                          💸 Pasar a Banco
                                        </button>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingTxn(null);
                                        setPresetTxnValues({
                                          walletId: wb.wallet.id,
                                          currency: wb.wallet.currency,
                                        });
                                        setTxnModalInitialType('expense');
                                        setTxnModalOpen(true);
                                      }}
                                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)]"
                                    >
                                      + Registrar gasto aquí
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                                    <span className="text-xs text-[var(--text-secondary)] block">
                                      Saldo disponible (
                                      {isVes ? 'Bolívares' : 'Dólares'})
                                    </span>
                                    <div
                                      className={`text-2xl font-bold font-mono-tabular mt-1 ${
                                        primaryBalance >= 0
                                          ? isVes
                                            ? 'text-[var(--pink-primary)]'
                                            : 'text-[var(--text-primary)]'
                                          : 'text-[var(--expense-color)]'
                                      }`}
                                    >
                                      {formatearMonto(
                                        primaryBalance,
                                        isVes ? 'VES' : 'USD',
                                        locale
                                      )}
                                    </div>
                                    <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
                                      ≈{' '}
                                      {formatearMonto(
                                        secondaryBalance,
                                        isVes ? 'USD' : 'VES',
                                        locale
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                                    <span className="text-xs text-[var(--text-secondary)] block">
                                      Saldo proyectado
                                    </span>
                                    <div className="text-xl font-bold font-mono-tabular text-[var(--lavender-accent)] mt-1">
                                      {formatearMonto(
                                        isVes
                                          ? wb.saldoProyectadoVes
                                          : wb.saldoProyectadoUsd,
                                        isVes ? 'VES' : 'USD',
                                        locale
                                      )}
                                    </div>
                                    <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
                                      ≈{' '}
                                      {formatearMonto(
                                        isVes
                                          ? wb.saldoProyectadoUsd
                                          : wb.saldoProyectadoVes,
                                        isVes ? 'USD' : 'VES',
                                        locale
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                            No hay cuentas activas registradas.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* PESTAÑA C: GRÁFICAS DEL MES */}
                {dashboardBottomTab === 'charts' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)]">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                        Ingresos frente a gastos por mes
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4">
                        Comparativa en USD de los últimos 6 meses hasta{' '}
                        {formatearNombreMes(selectedMonth)}.
                      </p>
                      <IncomeVsExpenseBarChart
                        serie={serieSeisMeses}
                        locale={locale}
                      />
                    </div>

                    <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)]">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                        Distribución de gastos por categoría
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4">
                        Proporción de tus gastos en{' '}
                        {formatearNombreMes(selectedMonth)}.
                      </p>
                      <CategoryDonutChart
                        items={distribucionGastosMes}
                        locale={locale}
                      />
                    </div>

                    <div className="lg:col-span-2 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)]">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                        Evolución del balance mensual
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4">
                        Tendencia de tu saldo neto mensual (Ingresos - Gastos en USD).
                      </p>
                      <MonthlyBalanceLineChart
                        serie={serieSeisMeses}
                        locale={locale}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1A. SECCIÓN: FINANZAS EN PAREJA (HUB DE PAREJA)           */}
          {/* ========================================================= */}
          {activeSection === 'couples' && (
            <CoupleFinanceView
              userName={appData.settings.userName}
              categories={appData.categories}
              wallets={appData.wallets || INITIAL_WALLETS}
              officialRate={officialRate}
              defaultManualRate={appData.settings.defaultExchangeRate}
              preferManualByDefault={appData.settings.preferManualRateByDefault}
              locale={locale}
              onBridgePersonalExpense={handleBridgePersonalExpense}
              onRemoveLinkedPersonalTransaction={
                handleRemoveLinkedPersonalTransaction
              }
              onOpenImportSharedModal={() => setImportSharedModalOpen(true)}
              showToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* 1A-AGENDA. SECCIÓN UNIFICADA: AGENDA DE PAGOS Y PRÓXIMOS   */}
          {/* ========================================================= */}
          {activeSection === 'upcoming_payments' && (
            <UpcomingPaymentsView
              data={appData}
              officialRate={officialRate}
              defaultManualRate={appData.settings.defaultExchangeRate}
              preferManualByDefault={appData.settings.preferManualRateByDefault}
              locale={locale}
              onUpdateData={setAppData}
              onNavigate={(sec) => setActiveSection(sec)}
              showToast={showToast}
              onPayPendingTransaction={(txn) => {
                setEditingTxn(txn);
                setPresetTxnValues({ forceCompletedStatus: true });
                setTxnModalInitialType('expense');
                setTxnModalOpen(true);
              }}
            />
          )}

          {/* ========================================================= */}
          {/* 1A-BIS. SECCIÓN: COMPRAS A CUOTAS (TIPO CASHEA / BNPL)    */}
          {/* ========================================================= */}
          {activeSection === 'installments' && (
            <InstallmentsModuleView
              appData={appData}
              setAppData={setAppData}
              resumenMes={resumenMes}
              officialRate={officialRate}
              locale={locale}
              showToast={showToast}
              setConfirmDialog={setConfirmDialog}
              autoOpenTrigger={moduleAutoOpenTrigger}
            />
          )}

          {/* ========================================================= */}
          {/* 1A-TER. SECCIÓN: CAMBIOS P2P Y CUENTAS POR COBRAR          */}
          {/* ========================================================= */}
          {activeSection === 'p2p' && (
            <P2PExchangeView
              appData={appData}
              setAppData={setAppData}
              officialRate={officialRate}
              locale={locale}
              showToast={showToast}
              setConfirmDialog={setConfirmDialog}
              autoOpenTrigger={moduleAutoOpenTrigger}
            />
          )}

          {/* ========================================================= */}
          {/* 1A-QUATER. SECCIÓN: GESTOR DE SUSCRIPCIONES               */}
          {/* ========================================================= */}
          {activeSection === 'subscriptions' && (
            <SubscriptionsModuleView
              appData={appData}
              setAppData={setAppData}
              resumenMes={resumenMes}
              selectedMonth={selectedMonth}
              officialRate={officialRate}
              locale={locale}
              showToast={showToast}
              setConfirmDialog={setConfirmDialog}
              onOpenPushCenter={() => setPushCenterOpen(true)}
              autoOpenTrigger={moduleAutoOpenTrigger}
            />
          )}

          {/* ========================================================= */}
          {/* 1A-QUINQUIES. SECCIÓN: CRÉDITOS DE APPS (UBII / AVILA)    */}
          {/* ========================================================= */}
          {activeSection === 'app_credits' && (
            <AppCreditsModuleView
              data={appData}
              activeRate={effectiveConversionRate}
              onUpdateData={setAppData}
              showToast={showToast}
              onOpenPushCenter={() => setPushCenterOpen(true)}
              autoOpenTrigger={moduleAutoOpenTrigger}
            />
          )}

          {/* ========================================================= */}
          {/* 1A-SEXIES. SECCIÓN: LISTA DE MERCADO SIMPLE               */}
          {/* ========================================================= */}
          {activeSection === 'market' && (
            <MarketListView
              data={appData}
              activeRate={effectiveConversionRate}
              onUpdateData={setAppData}
              showToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* 1B. SECCIÓN: SISTEMA DE BILLETERAS (WALLETS)              */}
          {/* ========================================================= */}
          {activeSection === 'wallets' && (
            <WalletsModuleView
              appData={appData}
              setAppData={setAppData}
              resumenBilleteras={resumenBilleteras.billeteras}
              resumenMes={resumenMes}
              selectedMonth={selectedMonth}
              effectiveConversionRate={effectiveConversionRate}
              locale={locale}
              showToast={showToast}
              onNewTransaction={(walletId, txnType = 'expense') => {
                setEditingTxn(null);
                if (walletId) {
                  const targetW = (appData.wallets || []).find(
                    (w) => w.id === walletId
                  );
                  setPresetTxnValues({
                    walletId,
                    currency: targetW?.currency,
                  });
                } else {
                  setPresetTxnValues(null);
                }
                setTxnModalInitialType(txnType);
                setTxnModalOpen(true);
              }}
              onOpenThirdPartyReload={openThirdPartyReloadModal}
              onOpenBonusCard={openBonusCardModal}
            />
          )}

          {/* ========================================================= */}
          {/* 2, 3 y 4. SECCIONES: INGRESOS, GASTOS Y MOVIMIENTOS       */}
          {/* ========================================================= */}
          {(activeSection === 'incomes' ||
            activeSection === 'expenses' ||
            activeSection === 'movements') && (
            <TransactionsModuleView
              mode={activeSection}
              transactions={appData.transactions}
              categories={appData.categories}
              wallets={appData.wallets || INITIAL_WALLETS}
              effectiveConversionRate={effectiveConversionRate}
              locale={locale}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterMonth={filterMonth}
              setFilterMonth={setFilterMonth}
              filterYear={filterYear}
              setFilterYear={setFilterYear}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              filterCurrency={filterCurrency}
              setFilterCurrency={setFilterCurrency}
              filterType={filterType}
              setFilterType={setFilterType}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
              filterWallet={filterWallet}
              setFilterWallet={setFilterWallet}
              filterExpenseKind={filterExpenseKind}
              setFilterExpenseKind={setFilterExpenseKind}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onAdd={(type) => {
                setEditingTxn(null);
                setPresetTxnValues(null);
                setTxnModalInitialType(type);
                setTxnModalOpen(true);
              }}
              onAddItemizedPurchase={() => {
                setEditingTxn(null);
                setPendingWishlistPurchase(null);
                setPresetTxnValues({
                  enableItemizedMode: true,
                  storeName: 'Farmatodo',
                  description: 'Compra en Farmatodo',
                });
                setTxnModalInitialType('expense');
                setTxnModalOpen(true);
              }}
              onEdit={(txn) => {
                setEditingTxn(txn);
                setTxnModalOpen(true);
              }}
              onToggleStatus={handleToggleTransactionStatus}
              onDuplicate={handleDuplicateTransaction}
              onDelete={handleDeleteTransaction}
              onOpenImportSharedModal={() => setImportSharedModalOpen(true)}
            />
          )}

          {/* ========================================================= */}
          {/* 5. SECCIÓN: PRESUPUESTO MENSUAL                           */}
          {/* ========================================================= */}
          {activeSection === 'budgets' && (
            <BudgetsModuleView
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              appData={appData}
              setAppData={setAppData}
              locale={locale}
              showToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* 6. SECCIÓN: MIS AHORROS                                   */}
          {/* ========================================================= */}
          {activeSection === 'savings' && (
            <SavingsModuleView
              appData={appData}
              resumenMes={resumenMes}
              locale={locale}
              onAddSavings={() => {
                setEditingSavings(null);
                setSavingsModalOpen(true);
              }}
              onEditSavings={(mov) => {
                setEditingSavings(mov);
                setSavingsModalOpen(true);
              }}
              onDeleteSavings={handleDeleteSavingsMovement}
            />
          )}

          {/* ========================================================= */}
          {/* 7. SECCIÓN: METAS DE AHORRO                               */}
          {/* ========================================================= */}
          {activeSection === 'goals' && (
            <GoalsModuleView
              appData={appData}
              setAppData={setAppData}
              locale={locale}
              onAddGoal={() => {
                setEditingGoal(null);
                setGoalModalOpen(true);
              }}
              onEditGoal={(goal) => {
                setEditingGoal(goal);
                setGoalModalOpen(true);
              }}
              onContributeToGoal={() => {
                setEditingSavings(null);
                setSavingsModalOpen(true);
              }}
              setConfirmDialog={setConfirmDialog}
              showToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* 8. SECCIÓN: DEUDAS Y PAGOS PENDIENTES                     */}
          {/* ========================================================= */}
          {activeSection === 'debts' && (
            <DebtsModuleView
              appData={appData}
              setAppData={setAppData}
              officialRate={officialRate}
              locale={locale}
              setConfirmDialog={setConfirmDialog}
              showToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* 8B. SECCIÓN: LISTA DE DESEOS (WISHLIST)                   */}
          {/* ========================================================= */}
          {activeSection === 'wishlist' && (
            <WishlistView
              wishlist={appData.wishlist || []}
              categories={appData.categories}
              saldoDisponibleUsd={resumenMes.dineroDisponibleEstimadoUsd}
              officialRate={officialRate}
              defaultManualRate={appData.settings.defaultExchangeRate}
              locale={locale}
              onAddWish={() => {
                setEditingWish(null);
                setWishlistModalOpen(true);
              }}
              onEditWish={(w) => {
                setEditingWish(w);
                setWishlistModalOpen(true);
              }}
              onDeleteWish={handleDeleteWishlistItem}
              onBuyWish={handleStartBuyWishlistItem}
              onToggleStatus={handleToggleWishlistStatus}
            />
          )}

          {/* ========================================================= */}
          {/* 8C. SECCIÓN: HERRAMIENTAS FINANCIERAS (TOOLS)             */}
          {/* ========================================================= */}
          {activeSection === 'tools' && (
            <ToolsModuleView
              appData={appData}
              resumenBilleteras={resumenBilleteras}
              officialRate={officialRate}
              locale={locale}
              onOpenQuickCalculator={() => setCalcModalOpen(true)}
              onNavigateToSection={(sec) => setActiveSection(sec)}
              onRegisterExpense={(preset) => {
                setEditingTxn(null);
                setPendingWishlistPurchase(null);
                setPresetTxnValues(preset);
                setTxnModalInitialType('expense');
                setTxnModalOpen(true);
              }}
            />
          )}

          {/* ========================================================= */}
          {/* 9. SECCIÓN: CATEGORÍAS EDITABLES                          */}
          {/* ========================================================= */}
          {activeSection === 'categories' && (
            <CategoriesModuleView
              appData={appData}
              setAppData={setAppData}
              showToast={showToast}
              locale={locale}
              onRegisterItemizedPurchase={(categoryId) => {
                setEditingTxn(null);
                setPendingWishlistPurchase(null);
                setPresetTxnValues({
                  enableItemizedMode: true,
                  storeName: 'Farmatodo',
                  description: 'Compra en Farmatodo',
                  categoryId,
                });
                setTxnModalInitialType('expense');
                setTxnModalOpen(true);
              }}
              onEditTransaction={(txn) => {
                setEditingTxn(txn);
                setTxnModalOpen(true);
              }}
            />
          )}

          {/* ========================================================= */}
          {/* 10. SECCIÓN: ESTADÍSTICAS E INFORMES                      */}
          {/* ========================================================= */}
          {activeSection === 'statistics' && (
            <StatisticsModuleView
              appData={appData}
              selectedMonth={selectedMonth}
              dateRangeStart={dateRangeStart}
              setDateRangeStart={setDateRangeStart}
              dateRangeEnd={dateRangeEnd}
              setDateRangeEnd={setDateRangeEnd}
              locale={locale}
              onOpenMonthlyReport={() => setActiveSection('monthly_report')}
            />
          )}

          {/* ========================================================= */}
          {/* 10B. SECCIÓN: GENERADOR DE REPORTE MENSUAL EN PDF         */}
          {/* ========================================================= */}
          {activeSection === 'monthly_report' && (
            <MonthlyReportPdfView
              appData={appData}
              selectedMonth={selectedMonth}
              onChangeMonth={(m) => setSelectedMonth(m)}
              locale={locale}
            />
          )}

          {/* ========================================================= */}
          {/* 10C. SECCIÓN: BÓVEDA DE GARANTÍAS Y MANTENIMIENTO (ASSETS)*/}
          {/* ========================================================= */}
          {activeSection === 'assets' && (
            <AssetVaultView
              appData={appData}
              setAppData={setAppData}
              effectiveConversionRate={effectiveConversionRate}
              locale={locale}
              showToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* 10D. SECCIÓN: FONDO DE CITAS Y RULETA DE CITAS            */}
          {/* ========================================================= */}
          {activeSection === 'romance_fund' && (
            <RomanceBudgetView
              appData={appData}
              setAppData={setAppData}
              effectiveConversionRate={effectiveConversionRate}
              locale={locale}
              showToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* 10E. SECCIÓN: SALA DE TROFEOS Y LOGROS (MIS LOGROS)       */}
          {/* ========================================================= */}
          {activeSection === 'trophies' && (
            <TrophyRoomContent
              appData={appData}
              checkResult={achievementsEvaluation}
              onNavigateToSection={(sec) => setActiveSection(sec)}
            />
          )}

          {/* ========================================================= */}
          {/* 10F. SECCIÓN: PLANIFICADOR DE MENÚ SEMANAL                */}
          {/* ========================================================= */}
          {activeSection === 'weekly_menu' && (
            <WeeklyMenuPlannerView
              appData={appData}
              setAppData={setAppData}
              showToast={showToast}
              onNavigateToSection={(sec) => setActiveSection(sec)}
            />
          )}

          {/* ========================================================= */}
          {/* 11. SECCIÓN: CONFIGURACIÓN Y RESPALDO JSON                */}
          {/* ========================================================= */}
          {activeSection === 'settings' && (
            <SettingsAndBackupView
              appData={appData}
              setAppData={setAppData}
              officialRate={officialRate}
              rateLoading={rateLoading}
              rateStatusMsg={rateStatusMsg}
              onRefreshRate={() => actualizarTasaOficial(true)}
              onExportJson={handleExportJson}
              onLoadDemoData={handleLoadDemoData}
              onReplayTutorial={handleStartGuidedTour}
              setConfirmDialog={setConfirmDialog}
              showToast={showToast}
              locale={locale}
            />
          )}
        </main>
      </div>

      {/* Modales Globales */}
      {/* Modal Universal "+ Nuevo": ¿Qué deseas hacer o registrar hoy? */}
      {quickCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          onClick={() => setQuickCreateModalOpen(false)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden my-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del lanzador */}
            <div className="flex items-center justify-between px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  ¿Qué deseas registrar hoy?
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Elige el tipo de operación y te llevaremos directo al formulario correspondiente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickCreateModalOpen(false)}
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"
                aria-label="Cerrar ventana"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Opciones organizadas por categoría */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Grupo 1: Movimientos Diarios */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  Movimientos diarios ($ o Bs)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setEditingTxn(null);
                      setPendingWishlistPurchase(null);
                      setPresetTxnValues(null);
                      setTxnModalInitialType('income');
                      setTxnModalOpen(true);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--income-color)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--income-bg)] text-[var(--income-color)] flex items-center justify-center">
                        <ArrowUpRight className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--income-color)] transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Ingreso de dinero
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Sueldo, cobro, bono o entrada en $ o Bs.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setEditingTxn(null);
                      setPendingWishlistPurchase(null);
                      setPresetTxnValues(null);
                      setTxnModalInitialType('expense');
                      setTxnModalOpen(true);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--expense-bg)] text-[var(--expense-color)] flex items-center justify-center">
                        <ArrowDownRight className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--pink-primary)] transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Gasto o pago normal
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Comida, servicio, pago móvil o transferencia.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setEditingTxn(null);
                      setPendingWishlistPurchase(null);
                      setPresetTxnValues({
                        enableItemizedMode: true,
                        storeName: 'Farmatodo',
                        description: 'Compra en Farmatodo',
                      });
                      setTxnModalInitialType('expense');
                      setTxnModalOpen(true);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--lavender-accent)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--lavender-soft)] text-[var(--lavender-text)] flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--lavender-accent)] transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Compra detallada
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Tipo Farmatodo: un pago con lista de artículos.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Grupo 2: Cashea, Créditos de Apps y Suscripciones */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  Cuotas, Préstamos de Apps y Suscripciones
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setActiveSection('installments');
                      setModuleAutoOpenTrigger((n) => n + 1);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--pink-primary)] transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Compra con Cashea
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Compra financiada con pago inicial y cuotas.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setActiveSection('app_credits');
                      setModuleAutoOpenTrigger((n) => n + 1);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--lavender-soft)] text-[var(--lavender-text)] flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--pink-primary)] transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Préstamo de App
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Dinero pedido en Ubii, Avila o Krece con cuotas.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setActiveSection('subscriptions');
                      setModuleAutoOpenTrigger((n) => n + 1);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center">
                        <RefreshCw className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--pink-primary)] transition-colors" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Suscripción fija
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Netflix, Spotify, Internet, Gimnasio o cobro mensual.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Grupo 3: P2P, Préstamos Personales, Ahorros y Mercado */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                  Cambios P2P, Préstamos, Ahorros y Mercado
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setActiveSection('p2p');
                      setModuleAutoOpenTrigger((n) => n + 1);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center">
                        <ArrowLeftRight className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Operación P2P
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Compra o venta de divisas ($ ⇄ Bs).
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setActiveSection('debts');
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--lavender-soft)] text-[var(--lavender-text)] flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Préstamo personal
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Dinero que prestaste a alguien por cobrar.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setEditingSavings(null);
                      setSavingsModalOpen(true);
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--income-bg)] text-[var(--income-color)] flex items-center justify-center">
                        <PiggyBank className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Ahorro en USD
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Apartar dinero o abonar a una meta.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickCreateModalOpen(false);
                      setActiveSection('market');
                    }}
                    className="p-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)] hover:bg-[var(--surface)] text-left transition-all flex flex-col justify-between gap-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center">
                        <CheckSquare className="w-4 h-4" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        Lista de mercado
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                        Crear o anotar artículos del supermercado.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <TransactionModal
        isOpen={txnModalOpen}
        initialType={txnModalInitialType}
        editingTransaction={editingTxn}
        presetValues={presetTxnValues}
        categories={appData.categories}
        wallets={appData.wallets || INITIAL_WALLETS}
        officialRate={officialRate}
        officialRateDate={appData.settings.lastOfficialRateDate}
        defaultManualRate={appData.settings.defaultExchangeRate}
        preferManualByDefault={appData.settings.preferManualRateByDefault}
        rateHistory={appData.rateHistory}
        existingTransactions={appData.transactions}
        locale={locale}
        onClose={() => {
          setTxnModalOpen(false);
          setEditingTxn(null);
          setPendingWishlistPurchase(null);
          setPresetTxnValues(null);
        }}
        onSave={handleSaveTransaction}
      />

      {/* Modal Directo: Pasar dinero / Recargar Cuenta de Gastos de Familiar (Desde mi cuenta Mercantil o Depósito directo) */}
      {thirdPartyReloadWallet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          onClick={() => setThirdPartyReloadWallet(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: thirdPartyReloadWallet.color }}
                />
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Pasar dinero a {thirdPartyReloadWallet.name}
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Uso de {thirdPartyReloadWallet.beneficiaryName || 'Familiar / Tercero'} · Elige si sale de tu banco o si es depósito directo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setThirdPartyReloadWallet(null)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveThirdPartyReload} className="p-5 space-y-4">
              {/* Selector de Modalidad: 1) Desde una de mis cuentas (Mercantil) vs 2) Ingreso directo sin descontar */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-primary)]">
                  ¿De dónde viene este dinero? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTpFundingMode('from_my_wallet')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tpFundingMode === 'from_my_wallet'
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] shadow-xs'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>🏦 Pasar de mi cuenta</span>
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 leading-snug ${
                        tpFundingMode === 'from_my_wallet'
                          ? 'text-white/90'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Yo le transfiero (ej. desde Mercantil Bs). <strong>Me lo debita a mí</strong> y entra a su cuenta.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTpFundingMode('external_direct');
                      setTpFeeMode('none');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      tpFundingMode === 'external_direct'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-amber-500/50'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span>🏢 Depósito directo</span>
                    </div>
                    <p
                      className={`text-[10px] mt-0.5 leading-snug ${
                        tpFundingMode === 'external_direct'
                          ? 'text-white/90'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Lo deposita la empresa / externo ahí. <strong>No descuenta</strong> de ninguna de mis cuentas.
                    </p>
                  </button>
                </div>
              </div>

              {/* Si elige "Pasar de mi cuenta": Selector de Billetera Origen + Comisión Bancaria */}
              {tpFundingMode === 'from_my_wallet' ? (
                <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border-2 border-[var(--pink-primary)]/40 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                      ¿De cuál de tus billeteras sale el dinero? (Se te debitará a ti) *
                    </label>
                    <select
                      value={tpSourceWalletId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setTpSourceWalletId(nextId);
                        const found = (appData.wallets || []).find(
                          (w) => w.id === nextId
                        );
                        if (found) {
                          setTpReloadCurrency(
                            found.currency === 'VES' ? 'VES' : 'USD'
                          );
                          if (found.currency !== 'VES') {
                            setTpFeeMode('none');
                          }
                        }
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    >
                      {(appData.wallets || [])
                        .filter(
                          (w) =>
                            w.active &&
                            !w.isThirdPartyExpenseAccount &&
                            w.id !== thirdPartyReloadWallet.id
                        )
                        .sort((a, b) =>
                          a.currency === 'VES' && b.currency !== 'VES'
                            ? -1
                            : a.currency !== 'VES' && b.currency === 'VES'
                              ? 1
                              : 0
                        )
                        .map((w) => {
                          const wb = resumenBilleteras.billeteras.find(
                            (b) => b.wallet.id === w.id
                          );
                          const bal = wb
                            ? w.currency === 'VES'
                              ? wb.saldoActualVes
                              : wb.saldoActualUsd
                            : 0;
                          return (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.currency}) — Disponible:{' '}
                              {formatearMonto(
                                bal,
                                w.currency === 'VES' ? 'VES' : 'USD',
                                locale
                              )}
                            </option>
                          );
                        })}
                    </select>
                  </div>

                  {/* Comisión bancaria si la cuenta origen es en VES */}
                  {(() => {
                    const srcW = (appData.wallets || []).find(
                      (w) => w.id === tpSourceWalletId
                    );
                    if (!srcW || srcW.currency !== 'VES') return null;
                    const amtNum =
                      Number(tpReloadAmountStr.replace(',', '.')) || 0;
                    const pmPct =
                      srcW.comisionPagoMovil != null
                        ? srcW.comisionPagoMovil
                        : 0.3;
                    const trTipo =
                      srcW.comisionTransferenciaTipo ||
                      (srcW.isBonusCard ? 'percent' : 'fixed_ves');
                    const trVal =
                      trTipo === 'percent'
                        ? srcW.comisionTransferencia ?? 1.5
                        : srcW.comisionTransferencia != null &&
                            srcW.comisionTransferencia >= 1
                          ? srcW.comisionTransferencia
                          : 54;
                    const feePreview =
                      tpFeeMode === 'none' || amtNum <= 0
                        ? 0
                        : tpFeeMode === 'pago_movil'
                          ? Number(
                              Math.max(14, (amtNum * pmPct) / 100).toFixed(2)
                            )
                          : trTipo === 'percent'
                            ? Number(((amtNum * trVal) / 100).toFixed(2))
                            : Number(trVal.toFixed(2));

                    return (
                      <div className="space-y-2 pt-2 border-t border-[var(--border-divider)]">
                        <span className="block text-[11px] font-semibold text-[var(--text-primary)]">
                          ¿Medio de envío y comisión bancaria en {srcW.name}?
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTpFeeMode('none')}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                              tpFeeMode === 'none'
                                ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                            }`}
                          >
                            Mismo banco (0 Bs)
                          </button>
                          <button
                            type="button"
                            onClick={() => setTpFeeMode('pago_movil')}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                              tpFeeMode === 'pago_movil'
                                ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                            }`}
                          >
                            📲 Pago Móvil ({pmPct}%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setTpFeeMode('transferencia')}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                              tpFeeMode === 'transferencia'
                                ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                                : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                            }`}
                          >
                            🏦 Transf. ({trTipo === 'percent' ? `${trVal}%` : `${trVal} Bs`})
                          </button>
                        </div>
                        {amtNum > 0 && (
                          <div className="flex items-center justify-between text-[11px] font-mono-tabular pt-1">
                            <span className="text-[var(--text-secondary)]">
                              Total a debitar de {srcW.name}:
                            </span>
                            <strong className="text-[var(--expense-color)]">
                              -{formatearMonto(amtNum + feePreview, 'VES', locale)}
                              {feePreview > 0
                                ? ` (incl. ${formatearMonto(feePreview, 'VES', locale)} comisión)`
                                : ''}
                            </strong>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border-2 border-amber-500/60 text-[11px] text-[var(--text-primary)] space-y-1">
                  <div className="font-bold text-amber-600">
                    🏢 Modo Depósito Directo (Empresa / Externo)
                  </div>
                  <p className="text-[var(--text-secondary)]">
                    • Entra directo a <strong className="text-[var(--text-primary)]">{thirdPartyReloadWallet.name}</strong> sin descontar de tu cuenta Mercantil ni de ninguna otra billetera tuya.
                    <br />• Suma a tus <strong className="text-[var(--text-primary)]">Gastos del mes</strong> y al <strong className="text-[var(--text-primary)]">Acumulado Histórico</strong> de esta cuenta con su equivalente en Dólares ($).
                  </p>
                </div>
              )}

              {/* Moneda y Monto */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Moneda
                  </label>
                  <select
                    value={tpReloadCurrency}
                    onChange={(e) =>
                      setTpReloadCurrency(e.target.value as CurrencyCode)
                    }
                    className="w-full px-3 py-2 text-xs font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  >
                    <option value="VES">Bs (VES)</option>
                    <option value="USD">$ (USD)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Monto que pasaste *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono-tabular text-[var(--text-secondary)]">
                      {tpReloadCurrency === 'VES' ? 'Bs' : '$'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      autoFocus
                      value={tpReloadAmountStr}
                      onChange={(e) => setTpReloadAmountStr(e.target.value)}
                      placeholder={
                        tpReloadCurrency === 'VES' ? 'Ej. 2500.00' : 'Ej. 50.00'
                      }
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* Tasa y Equivalente en vivo */}
              {tpReloadCurrency === 'VES' && (
                <UsdToVesHelper
                  officialRate={officialRate}
                  defaultManualRate={appData.settings.defaultExchangeRate}
                  currentRate={
                    tpReloadRateSource === 'bcv' && officialRate
                      ? officialRate
                      : Number(tpReloadCustomRateStr.replace(',', '.')) ||
                        effectiveConversionRate ||
                        450
                  }
                  rateSource={tpReloadRateSource}
                  locale={locale}
                  compact
                  onApplyVesAmount={(vesStr, usedRate, src) => {
                    setTpReloadAmountStr(vesStr);
                    setTpReloadRateSource(src);
                    if (src === 'manual') {
                      setTpReloadCustomRateStr(String(usedRate));
                    }
                  }}
                />
              )}
              {tpReloadCurrency === 'VES' ? (
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      Tasa para equivalente en USD ($)
                    </span>
                    <div className="inline-flex rounded-lg bg-[var(--surface)] p-0.5 border border-[var(--border-hairline)] text-[10px]">
                      <button
                        type="button"
                        onClick={() => setTpReloadRateSource('bcv')}
                        className={`px-2 py-0.5 rounded-md font-semibold ${
                          tpReloadRateSource === 'bcv'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        BCV {officialRate ? `(${formatearTasa(officialRate, locale)})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTpReloadRateSource('manual')}
                        className={`px-2 py-0.5 rounded-md font-semibold ${
                          tpReloadRateSource === 'manual'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  {tpReloadRateSource === 'manual' && (
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={tpReloadCustomRateStr}
                        onChange={(e) => setTpReloadCustomRateStr(e.target.value)}
                        placeholder="Ej. 450.00"
                        className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs font-mono-tabular pt-1 border-t border-[var(--border-divider)]">
                    <span className="text-[var(--text-secondary)]">
                      Equivalente en Dólares:
                    </span>
                    <strong className="text-[var(--income-color)]">
                      ≈{' '}
                      {(() => {
                        const amt = Number(tpReloadAmountStr.replace(',', '.')) || 0;
                        const r =
                          tpReloadRateSource === 'bcv' && officialRate
                            ? officialRate
                            : Number(tpReloadCustomRateStr.replace(',', '.')) ||
                              effectiveConversionRate ||
                              450;
                        return formatearMonto(r > 0 ? amt / r : 0, 'USD', locale);
                      })()}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-between text-xs font-mono-tabular">
                  <span className="text-[var(--text-secondary)]">
                    Equivalente en Bolívares:
                  </span>
                  <strong className="text-[var(--text-primary)]">
                    ≈{' '}
                    {formatearMonto(
                      (Number(tpReloadAmountStr.replace(',', '.')) || 0) *
                        (effectiveConversionRate || 450),
                      'VES',
                      locale
                    )}
                  </strong>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Fecha del envío *
                  </label>
                  <input
                    type="date"
                    required
                    value={tpReloadDate}
                    onChange={(e) => setTpReloadDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Categoría de gasto
                  </label>
                  <select
                    value={tpReloadCategoryId}
                    onChange={(e) => setTpReloadCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  >
                    {appData.categories
                      .filter((c) => c.type === 'expense' && c.active)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Concepto o nota (opcional)
                </label>
                <input
                  type="text"
                  value={tpReloadNotes}
                  onChange={(e) => setTpReloadNotes(e.target.value)}
                  placeholder={`Ej. Mesada / Gastos de ${thirdPartyReloadWallet.beneficiaryName || 'Mamá'}...`}
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setThirdPartyReloadWallet(null)}
                  className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
                >
                  Registrar dinero pasado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Especializado: Tarjeta de Bonos / Todoticket Integral (Opción 1: Cargar Bono + Pasar/Vaciar a mi Banco con comisión en % o Bs) */}
      {bonusCardModalWallet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          onClick={() => setBonusCardModalWallet(null)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: bonusCardModalWallet.color }}
                />
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <span>🎟️ {bonusCardModalWallet.name}</span>
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Tarjeta de Bonos / Todoticket Integral · Recibe el bono y pásalo a tu banco
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBonusCardModalWallet(null)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pestañas: 1) Cargar Bono Recibido vs 2) Pasar / Vaciar a mi Banco */}
            <div className="grid grid-cols-2 gap-1 p-2 bg-[var(--surface-subtle)]/60 border-b border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setBonusCardTab('load_bonus')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
                  bonusCardTab === 'load_bonus'
                    ? 'bg-[var(--pink-primary)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                1. + Cargar Bono Recibido
              </button>
              <button
                type="button"
                onClick={() => setBonusCardTab('transfer_to_bank')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
                  bonusCardTab === 'transfer_to_bank'
                    ? 'bg-[var(--pink-primary)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                2. 💸 Pasar a mi Banco (Mercantil / Otro)
              </button>
            </div>

            {bonusCardTab === 'load_bonus' ? (
              <form
                onSubmit={(e) => handleSaveBonusCardLoad(e, false)}
                className="p-5 space-y-4"
              >
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border-2 border-indigo-500/50 text-[11px] text-[var(--text-primary)] space-y-1">
                  <div className="font-bold">
                    Paso 1: Registrar abono de la empresa en {bonusCardModalWallet.name}
                  </div>
                  <p className="text-[var(--text-secondary)]">
                    Registra el monto en Bolívares que te depositaron en Todoticket. Puedes dejarlo disponible en la tarjeta o guardarlo y pasar de inmediato a la pestaña para transferirlo a tu banco normal.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                    Monto del bono recibido ({bonusCardModalWallet.currency}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono-tabular text-[var(--text-secondary)]">
                      {bonusCardModalWallet.currency === 'VES' ? 'Bs' : '$'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      autoFocus
                      value={bonusLoadAmountStr}
                      onChange={(e) => setBonusLoadAmountStr(e.target.value)}
                      placeholder="Ej. 3500.00"
                      className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                    />
                  </div>
                </div>

                {bonusCardModalWallet.currency === 'VES' && (
                  <UsdToVesHelper
                    officialRate={officialRate}
                    defaultManualRate={appData.settings.defaultExchangeRate}
                    currentRate={
                      bonusLoadRateSource === 'bcv' && officialRate
                        ? officialRate
                        : Number(bonusLoadCustomRateStr.replace(',', '.')) ||
                          effectiveConversionRate ||
                          450
                    }
                    rateSource={bonusLoadRateSource}
                    locale={locale}
                    compact
                    onApplyVesAmount={(vesStr, usedRate, src) => {
                      setBonusLoadAmountStr(vesStr);
                      setBonusLoadRateSource(src);
                      if (src === 'manual') {
                        setBonusLoadCustomRateStr(String(usedRate));
                      }
                    }}
                  />
                )}

                {bonusCardModalWallet.currency === 'VES' && (
                  <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        Tasa de referencia USD ($)
                      </span>
                      <div className="inline-flex rounded-lg bg-[var(--surface)] p-0.5 border border-[var(--border-hairline)] text-[10px]">
                        <button
                          type="button"
                          onClick={() => setBonusLoadRateSource('bcv')}
                          className={`px-2 py-0.5 rounded-md font-semibold ${
                            bonusLoadRateSource === 'bcv'
                              ? 'bg-[var(--pink-primary)] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          BCV{' '}
                          {officialRate
                            ? `(${formatearTasa(officialRate, locale)})`
                            : ''}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBonusLoadRateSource('manual')}
                          className={`px-2 py-0.5 rounded-md font-semibold ${
                            bonusLoadRateSource === 'manual'
                              ? 'bg-[var(--pink-primary)] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          Manual
                        </button>
                      </div>
                    </div>

                    {bonusLoadRateSource === 'manual' && (
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={bonusLoadCustomRateStr}
                        onChange={(e) =>
                          setBonusLoadCustomRateStr(e.target.value)
                        }
                        placeholder="Ej. 450.00"
                        className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                      />
                    )}

                    <div className="flex items-center justify-between text-xs font-mono-tabular pt-1 border-t border-[var(--border-divider)]">
                      <span className="text-[var(--text-secondary)]">
                        Equivalente en Dólares:
                      </span>
                      <strong className="text-[var(--income-color)]">
                        ≈{' '}
                        {(() => {
                          const amt =
                            Number(bonusLoadAmountStr.replace(',', '.')) || 0;
                          const r =
                            bonusLoadRateSource === 'bcv' && officialRate
                              ? officialRate
                              : Number(
                                  bonusLoadCustomRateStr.replace(',', '.')
                                ) ||
                                effectiveConversionRate ||
                                450;
                          return formatearMonto(
                            r > 0 ? amt / r : 0,
                            'USD',
                            locale
                          );
                        })()}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Fecha del abono *
                    </label>
                    <input
                      type="date"
                      required
                      value={bonusLoadDate}
                      onChange={(e) => setBonusLoadDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                      Concepto
                    </label>
                    <input
                      type="text"
                      value={bonusLoadNotes}
                      onChange={(e) => setBonusLoadNotes(e.target.value)}
                      placeholder="Ej. Bono Alimentación / Todoticket"
                      className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBonusCardModalWallet(null)}
                    className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)] hover:bg-[var(--surface)] border border-[var(--border-hairline)] rounded-xl transition-colors"
                  >
                    Solo guardar bono
                  </button>
                  <button
                    type="button"
                    onClick={(e) =>
                      handleSaveBonusCardLoad(
                        e as unknown as React.FormEvent,
                        true
                      )
                    }
                    className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
                  >
                    Guardar y pasar a mi banco →
                  </button>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleExecuteBonusCardTransfer}
                className="p-5 space-y-4"
              >
                {(() => {
                  const currentSummary = resumenBilleteras.billeteras.find(
                    (b) => b.wallet.id === bonusCardModalWallet.id
                  );
                  const availNominal = currentSummary
                    ? bonusCardModalWallet.currency === 'VES'
                      ? currentSummary.saldoActualVes
                      : currentSummary.saldoActualUsd
                    : 0;
                  const rawAmt =
                    Number(bonusTransferAmountStr.replace(',', '.')) || 0;
                  const feeVal = Math.max(
                    0,
                    Number(bonusFeeValueStr.replace(',', '.')) || 0
                  );
                  const computedFee =
                    bonusFeeType === 'percent'
                      ? Number(((rawAmt * feeVal) / 100).toFixed(2))
                      : Number(feeVal.toFixed(2));
                  const netEnteringBank =
                    bonusDeductMode === 'deduct_from_amount'
                      ? Math.max(0, Number((rawAmt - computedFee).toFixed(2)))
                      : Number(rawAmt.toFixed(2));
                  const totalLeavingCard =
                    bonusDeductMode === 'deduct_from_amount'
                      ? Number(rawAmt.toFixed(2))
                      : Number((rawAmt + computedFee).toFixed(2));
                  const activeR =
                    officialRate ||
                    effectiveConversionRate ||
                    appData.settings.defaultExchangeRate ||
                    450;

                  return (
                    <>
                      {/* Saldo disponible en la tarjeta Todoticket */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                        <div>
                          <span className="text-[11px] text-[var(--text-secondary)] block">
                            Saldo disponible en {bonusCardModalWallet.name}:
                          </span>
                          <strong className="text-sm font-bold font-mono-tabular text-[var(--pink-primary)]">
                            {formatearMonto(
                              availNominal,
                              bonusCardModalWallet.currency,
                              locale
                            )}
                          </strong>
                          <span className="text-[11px] font-mono-tabular text-[var(--text-secondary)] ml-1.5">
                            (≈{' '}
                            {formatearMonto(
                              bonusCardModalWallet.currency === 'VES'
                                ? activeR > 0
                                  ? availNominal / activeR
                                  : 0
                                : availNominal,
                              'USD',
                              locale
                            )}
                            )
                          </span>
                        </div>
                        {availNominal > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setBonusTransferAmountStr(
                                String(Number(availNominal.toFixed(2)))
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[var(--pink-primary)]/15 text-[var(--pink-primary)] hover:bg-[var(--pink-primary)]/25 transition-colors"
                          >
                            Usar todo el saldo
                          </button>
                        )}
                      </div>

                      {/* Banco destino y Monto */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                            Pasar a mi cuenta bancaria *
                          </label>
                          <select
                            required
                            value={bonusDestWalletId}
                            onChange={(e) => {
                              const nextId = e.target.value;
                              setBonusDestWalletId(nextId);
                              const found = (appData.wallets || []).find(
                                (w) => w.id === nextId
                              );
                              if (found) {
                                setBonusTransferNotes(
                                  `Paso de bono ${bonusCardModalWallet.name} a ${found.name}`
                                );
                              }
                            }}
                            className="w-full px-3 py-2 text-xs font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                          >
                            <option value="">Selecciona banco...</option>
                            {(appData.wallets || [])
                              .filter(
                                (w) =>
                                  w.active && w.id !== bonusCardModalWallet.id
                              )
                              .map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.isThirdPartyExpenseAccount
                                    ? `👩‍👧‍👦 ${w.name} (${w.currency} · Familiar)`
                                    : `${w.name} (${w.currency})`}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                            Monto a retirar de Todoticket *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono-tabular text-[var(--text-secondary)]">
                              {bonusCardModalWallet.currency === 'VES'
                                ? 'Bs'
                                : '$'}
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              value={bonusTransferAmountStr}
                              onChange={(e) =>
                                setBonusTransferAmountStr(e.target.value)
                              }
                              placeholder="Ej. 3500.00"
                              className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Configuración editable de la comisión de Todoticket (% o Bs fijos) */}
                      <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-semibold text-[var(--text-primary)] block">
                              Comisión de transferencia Todoticket
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              Modifícala en % o en Bs fijos cuando verifiques cuánto te cobró
                            </span>
                          </div>

                          <div className="inline-flex rounded-lg bg-[var(--surface)] p-0.5 border border-[var(--border-hairline)] text-[10px]">
                            <button
                              type="button"
                              onClick={() => setBonusFeeType('percent')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                                bonusFeeType === 'percent'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              En Porcentaje (%)
                            </button>
                            <button
                              type="button"
                              onClick={() => setBonusFeeType('fixed_ves')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                                bonusFeeType === 'fixed_ves'
                                  ? 'bg-[var(--pink-primary)] text-white'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              Monto Fijo (Bs)
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={bonusFeeValueStr}
                              onChange={(e) =>
                                setBonusFeeValueStr(e.target.value)
                              }
                              placeholder={
                                bonusFeeType === 'percent' ? 'Ej. 1.5' : 'Ej. 54'
                              }
                              className="w-full px-3 py-1.5 pr-10 text-xs font-bold font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-secondary)]">
                              {bonusFeeType === 'percent' ? '%' : 'Bs'}
                            </span>
                          </div>

                          <div className="text-xs font-mono-tabular text-right">
                            <span className="text-[var(--text-secondary)]">
                              Comisión calculada:{' '}
                            </span>
                            <strong className="text-[var(--expense-color)]">
                              -{formatearMonto(computedFee, 'VES', locale)}
                            </strong>
                          </div>
                        </div>

                        {/* Modo de descuento de la comisión */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setBonusDeductMode('deduct_from_amount')
                            }
                            className={`p-2 rounded-xl border text-left text-[11px] transition-all ${
                              bonusDeductMode === 'deduct_from_amount'
                                ? 'bg-[var(--pink-primary)]/15 border-[var(--pink-primary)] text-[var(--text-primary)] font-semibold'
                                : 'bg-[var(--surface)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                            }`}
                          >
                            <div className="font-semibold">
                              Vaciar tarjeta (Descontar del monto)
                            </div>
                            <div className="text-[10px] opacity-80">
                              Sale exactamente {formatearMonto(rawAmt, 'VES', locale)} de la tarjeta y entra el neto al banco.
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setBonusDeductMode('add_on_top')}
                            className={`p-2 rounded-xl border text-left text-[11px] transition-all ${
                              bonusDeductMode === 'add_on_top'
                                ? 'bg-[var(--pink-primary)]/15 border-[var(--pink-primary)] text-[var(--text-primary)] font-semibold'
                                : 'bg-[var(--surface)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                            }`}
                          >
                            <div className="font-semibold">
                              Cobrar comisión aparte del monto
                            </div>
                            <div className="text-[10px] opacity-80">
                              Entran {formatearMonto(rawAmt, 'VES', locale)} al banco y se debita monto + comisión.
                            </div>
                          </button>
                        </div>

                        <label className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={bonusSaveFeeDefault}
                            onChange={(e) =>
                              setBonusSaveFeeDefault(e.target.checked)
                            }
                            className="rounded accent-[var(--pink-primary)]"
                          />
                          <span>
                            Guardar esta comisión ({bonusFeeValueStr || '0'}
                            {bonusFeeType === 'percent' ? '%' : ' Bs'}) como predeterminada en {bonusCardModalWallet.name}
                          </span>
                        </label>
                      </div>

                      {/* Resumen en vivo de la operación */}
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5 text-xs font-mono-tabular">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-secondary)]">
                            Sale en total de {bonusCardModalWallet.name}:
                          </span>
                          <strong className="text-[var(--text-primary)]">
                            -{formatearMonto(totalLeavingCard, 'VES', locale)}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-secondary)]">
                            Comisión registrada como gasto:
                          </span>
                          <strong className="text-[var(--expense-color)]">
                            -{formatearMonto(computedFee, 'VES', locale)}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-[var(--border-divider)]">
                          <span className="font-sans font-bold text-[var(--text-primary)]">
                            Entra neto a tu banco destino:
                          </span>
                          <div className="text-right">
                            <strong className="text-sm text-[var(--income-color)] block">
                              +{formatearMonto(netEnteringBank, 'VES', locale)}
                            </strong>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              ≈{' '}
                              {formatearMonto(
                                activeR > 0 ? netEnteringBank / activeR : 0,
                                'USD',
                                locale
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                            Fecha de transferencia *
                          </label>
                          <input
                            type="date"
                            required
                            value={bonusTransferDate}
                            onChange={(e) =>
                              setBonusTransferDate(e.target.value)
                            }
                            className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                            Nota (opcional)
                          </label>
                          <input
                            type="text"
                            value={bonusTransferNotes}
                            onChange={(e) =>
                              setBonusTransferNotes(e.target.value)
                            }
                            placeholder="Ej. Paso de bono Todoticket a Mercantil"
                            className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setBonusCardModalWallet(null)}
                          className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
                        >
                          Confirmar transferencia al banco
                        </button>
                      </div>
                    </>
                  );
                })()}
              </form>
            )}
          </div>
        </div>
      )}

      <WishlistModal
        isOpen={wishlistModalOpen}
        editingWish={editingWish}
        categories={appData.categories}
        officialRate={officialRate}
        defaultManualRate={appData.settings.defaultExchangeRate}
        locale={locale}
        onClose={() => {
          setWishlistModalOpen(false);
          setEditingWish(null);
        }}
        onSave={handleSaveWishlistItem}
      />

      <SavingsModal
        isOpen={savingsModalOpen}
        editingMovement={editingSavings}
        categories={appData.categories}
        wallets={appData.wallets || INITIAL_WALLETS}
        goals={appData.savingsGoals}
        officialRate={officialRate}
        defaultManualRate={appData.settings.defaultExchangeRate}
        locale={locale}
        onClose={() => {
          setSavingsModalOpen(false);
          setEditingSavings(null);
        }}
        onSave={handleSaveSavingsMovement}
      />

      <GoalModal
        isOpen={goalModalOpen}
        editingGoal={editingGoal}
        onClose={() => {
          setGoalModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
      />

      <ImportSharedExpensesModal
        isOpen={importSharedModalOpen}
        onClose={() => setImportSharedModalOpen(false)}
        existingTransactions={appData.transactions}
        categories={appData.categories}
        wallets={appData.wallets || INITIAL_WALLETS}
        effectiveRate={effectiveConversionRate}
        locale={locale}
        onConfirmImport={handleConfirmImportSharedExpenses}
      />

      <PayInstallmentModal
        isOpen={Boolean(dashboardPayingInstallment)}
        onClose={() => setDashboardPayingInstallment(null)}
        purchase={dashboardPayingInstallment?.purchase || null}
        installment={dashboardPayingInstallment?.installment || null}
        wallets={appData.wallets || INITIAL_WALLETS}
        officialRate={officialRate}
        defaultManualRate={appData.settings.defaultExchangeRate}
        preferManualByDefault={appData.settings.preferManualRateByDefault}
        rateHistory={appData.rateHistory}
        existingTransactions={appData.transactions}
        locale={locale}
        onConfirmPay={(purchaseId, installmentId, payment: PayInstallmentInput) => {
          setAppData((prev) =>
            registrarPagoCuotaEnAppData(prev, purchaseId, installmentId, payment)
          );
          showToast(
            payment.alreadyPaidExternally
              ? 'Cuota marcada como pagada anteriormente (sin afectar tu balance).'
              : 'Cuota marcada como Pagada desde el Dashboard. Se registró el egreso real en tu billetera.',
            'success'
          );
        }}
      />

      <SettleP2PModal
        isOpen={Boolean(dashboardSettlingP2P)}
        onClose={() => setDashboardSettlingP2P(null)}
        operation={dashboardSettlingP2P}
        wallets={appData.wallets || INITIAL_WALLETS}
        officialRate={officialRate}
        locale={locale}
        onConfirmSettle={(operationId, input: SettleP2POperationInput) => {
          setAppData((prev) =>
            liquidarOperacionP2P(prev, operationId, input, officialRate)
          );
          showToast(
            'Operación liquidada desde el Dashboard. Monto ingresado a tu Saldo Real.',
            'success'
          );
        }}
      />

      {/* Modal Pantalla Completa: Cápsula del Tiempo Financiera (Wrapped) */}
      <YearlyWrappedModal
        isOpen={wrappedModalOpen}
        onClose={() => setWrappedModalOpen(false)}
        appData={appData}
        defaultYear={Number(selectedMonth.slice(0, 4)) || 2026}
        locale={locale}
      />

      {/* Modal: Sala de Trofeos y Logros (Mis Logros) */}
      <TrophyRoomModal
        isOpen={trophyModalOpen}
        onClose={() => setTrophyModalOpen(false)}
        appData={appData}
        checkResult={achievementsEvaluation}
        onNavigateToSection={(sec) => setActiveSection(sec)}
      />

      {/* Tour Guiado / Onboarding Interactivo (Overlay z-40 + Resaltado z-50 + Tooltip Nordic Clean) */}
      <GuidedTourOverlay
        isOpen={guidedTourOpen}
        onClose={() => setGuidedTourOpen(false)}
        onEnsureDashboard={() => setActiveSection('dashboard')}
      />

      {/* Pequeña ventana emergente: Calculadora Rápida USD ⇄ Bs */}
      {calcModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCalcModalOpen(false)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera de la pequeña ventana */}
            <div className="flex items-center justify-between px-5 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    Calculadora rápida ($ ⇄ Bs)
                  </h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Convierte dólares a bolívares y viceversa al instante
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalcModalOpen(false)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
                aria-label="Cerrar calculadora"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cuerpo de la calculadora */}
            <div className="p-5 space-y-4">
              {/* Consulta rápida de tasa por fecha (Días pasados o JSON cargado) */}
              <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                    <span>Consultar o usar tasa por fecha:</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={calcLookupDate}
                      onChange={(e) => handleCalcDateChange(e.target.value)}
                      className="px-2.5 py-1 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg focus:outline-none focus:border-[var(--pink-primary)]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRateForCalcDate}
                      title="Guardar la tasa escrita abajo para esta fecha en tu historial"
                      className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-[var(--pink-light)] text-[var(--pink-primary)] hover:opacity-90 transition-opacity"
                    >
                      Guardar día
                    </button>
                  </div>
                </div>
                {calcLookupHint && (
                  <p className="text-[11px] font-semibold text-emerald-500">
                    ✓ {calcLookupHint}
                  </p>
                )}
              </div>

              {/* Selección rápida de tasa + Input de tasa personalizada */}
              <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-[var(--text-primary)]">
                    Tasa de cálculo (Bs por 1 $)
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      disabled={!officialRate}
                      onClick={() =>
                        officialRate &&
                        handleCalcRateChange(String(officialRate), 'bcv')
                      }
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                        calcRateSource === 'bcv' && officialRate
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)] disabled:opacity-40'
                      }`}
                    >
                      BCV{officialRate ? ` (${formatearTasa(officialRate, locale)})` : ''}
                    </button>

                    {appData.settings.defaultExchangeRate && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCalcRateChange(
                            String(appData.settings.defaultExchangeRate),
                            'custom'
                          )
                        }
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                          calcRateSource === 'custom' &&
                          Number(calcCustomRateStr) ===
                            appData.settings.defaultExchangeRate
                            ? 'bg-[var(--lavender-accent)] text-white'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)]'
                        }`}
                      >
                        Manual ({formatearTasa(appData.settings.defaultExchangeRate, locale)})
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setCalcRateSource('custom')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                        calcRateSource === 'custom' &&
                        Number(calcCustomRateStr) !==
                          appData.settings.defaultExchangeRate
                          ? 'bg-[var(--lavender-accent)] text-white'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)]'
                      }`}
                    >
                      Otra tasa
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono-tabular text-[var(--text-secondary)]">
                    1 $ =
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={calcCustomRateStr}
                    onChange={(e) =>
                      handleCalcRateChange(e.target.value, 'custom')
                    }
                    placeholder="Escribe cualquier tasa en Bs..."
                    className="w-full pl-12 pr-9 py-1.5 text-sm font-semibold font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg focus:outline-none focus:border-[var(--pink-primary)]"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono-tabular text-[var(--text-secondary)]">
                    Bs
                  </span>
                </div>
              </div>

              {/* Entradas bidireccionales: Dólares ($) y Bolívares (Bs) */}
              <div className="space-y-3">
                {/* Monto en Dólares */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-primary)]">
                      Monto en Dólares (USD $)
                    </label>
                    {calcLastEdited === 'USD' && (
                      <span className="text-[10px] font-medium text-[var(--pink-primary)]">
                        Calculando $ → Bs
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-semibold font-mono-tabular text-[var(--text-secondary)]">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={calcUsdInput}
                      onChange={(e) => handleCalcUsdChange(e.target.value)}
                      placeholder="Ej. 50"
                      className={`w-full pl-8 pr-3 py-2 text-base font-semibold font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border rounded-xl focus:outline-none ${
                        calcLastEdited === 'USD'
                          ? 'border-[var(--pink-primary)]'
                          : 'border-[var(--border-input)]'
                      }`}
                    />
                  </div>
                </div>

                {/* Separador bidireccional */}
                <div className="flex items-center justify-center">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[var(--pink-light)] text-[var(--pink-primary)] text-xs font-semibold select-none">
                    ⇅ Conversión automática
                  </span>
                </div>

                {/* Monto en Bolívares */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[var(--text-primary)]">
                      Monto en Bolívares (VES Bs)
                    </label>
                    {calcLastEdited === 'VES' && (
                      <span className="text-[10px] font-medium text-[var(--lavender-accent)]">
                        Calculando Bs → $
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold font-mono-tabular text-[var(--text-secondary)]">
                      Bs
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={calcVesInput}
                      onChange={(e) => handleCalcVesChange(e.target.value)}
                      placeholder="Ej. 148000"
                      className={`w-full pl-9 pr-3 py-2 text-base font-semibold font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border rounded-xl focus:outline-none ${
                        calcLastEdited === 'VES'
                          ? 'border-[var(--lavender-accent)]'
                          : 'border-[var(--border-input)]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Botones rápidos en USD */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 5, 10, 20, 50, 100].map((presetUsd) => (
                    <button
                      key={presetUsd}
                      type="button"
                      onClick={() => handleCalcUsdChange(String(presetUsd))}
                      className="px-2.5 py-1 text-xs font-mono-tabular font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg transition-colors"
                    >
                      ${presetUsd}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCalcUsdInput('');
                    setCalcVesInput('');
                  }}
                  className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--expense-color)] rounded-lg transition-colors"
                >
                  Limpiar
                </button>
              </div>

              {/* Resultado formateado + Copiar */}
              <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center justify-between gap-2">
                {activeCalculatorRate &&
                Number.isFinite(parseCalcNum(calcUsdInput)) &&
                Number.isFinite(parseCalcNum(calcVesInput)) ? (
                  <>
                    <div className="text-xs sm:text-sm font-mono-tabular text-[var(--text-primary)]">
                      {calcLastEdited === 'USD' ? (
                        <>
                          <strong>
                            {formatearMonto(
                              parseCalcNum(calcUsdInput),
                              'USD',
                              locale
                            )}
                          </strong>{' '}
                          ={' '}
                          <strong className="text-[var(--pink-primary)]">
                            {formatearMonto(
                              parseCalcNum(calcVesInput),
                              'VES',
                              locale
                            )}
                          </strong>
                        </>
                      ) : (
                        <>
                          <strong>
                            {formatearMonto(
                              parseCalcNum(calcVesInput),
                              'VES',
                              locale
                            )}
                          </strong>{' '}
                          ={' '}
                          <strong className="text-[var(--lavender-accent)]">
                            {formatearMonto(
                              parseCalcNum(calcUsdInput),
                              'USD',
                              locale
                            )}
                          </strong>
                        </>
                      )}
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        Calculado a {formatearTasa(activeCalculatorRate, locale)} Bs/$
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const textToCopy =
                          calcLastEdited === 'USD'
                            ? `${formatearMonto(parseCalcNum(calcUsdInput), 'USD', locale)} = ${formatearMonto(parseCalcNum(calcVesInput), 'VES', locale)} (Tasa: ${formatearTasa(activeCalculatorRate, locale)} Bs/$)`
                            : `${formatearMonto(parseCalcNum(calcVesInput), 'VES', locale)} = ${formatearMonto(parseCalcNum(calcUsdInput), 'USD', locale)} (Tasa: ${formatearTasa(activeCalculatorRate, locale)} Bs/$)`;
                        navigator.clipboard?.writeText(textToCopy);
                        showToast('Cálculo copiado al portapapeles.', 'info');
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] hover:bg-[var(--pink-light)] border border-[var(--border-hairline)] rounded-lg flex items-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {activeCalculatorRate
                      ? 'Escribe un monto en $ o en Bs para ver el resultado.'
                      : 'Indica una tasa de cambio arriba para calcular.'}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCalcModalOpen(false);
                    setActiveSection('tools');
                  }}
                  className="text-[11px] font-medium text-[var(--pink-primary)] hover:underline flex items-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Simular Pago Móvil vs Transferencia →</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCalcModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmación */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  confirmDialog.danger
                    ? 'text-[var(--expense-color)]'
                    : 'text-[var(--pink-primary)]'
                }`}
              />
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] rounded-xl border border-[var(--border-input)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 text-xs font-medium text-white rounded-xl ${
                  confirmDialog.danger
                    ? 'bg-[var(--expense-color)] hover:opacity-90'
                    : 'bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)]'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal del Centro de Notificaciones Push (Service Worker PWA) */}
      <PushNotificationModal
        isOpen={pushCenterOpen}
        onClose={() => setPushCenterOpen(false)}
        appData={appData}
        locale={locale}
        onNavigateSection={(sec) => setActiveSection(sec)}
        showToast={showToast}
      />
    </div>
  );
}

/* ============================================================================
 * SUBCOMPONENTES DE MÓDULOS
 * ============================================================================ */

interface TransactionsModuleViewProps {
  mode: 'incomes' | 'expenses' | 'movements';
  transactions: Transaction[];
  categories: Category[];
  wallets: WalletAccount[];
  effectiveConversionRate: number | null;
  locale: 'es-VE' | 'en-US';
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filterMonth: string;
  setFilterMonth: (v: string) => void;
  filterYear: string;
  setFilterYear: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterCurrency: 'all' | CurrencyCode;
  setFilterCurrency: (v: 'all' | CurrencyCode) => void;
  filterType: 'all' | TransactionType;
  setFilterType: (v: 'all' | TransactionType) => void;
  filterStatus: 'all' | TransactionStatus;
  setFilterStatus: (v: 'all' | TransactionStatus) => void;
  filterWallet: string;
  setFilterWallet: (v: string) => void;
  filterExpenseKind: 'all' | 'fixed' | 'variable' | 'recurring';
  setFilterExpenseKind: (v: 'all' | 'fixed' | 'variable' | 'recurring') => void;
  sortBy: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  setSortBy: (
    v: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
  ) => void;
  onAdd: (type: TransactionType) => void;
  onAddItemizedPurchase?: () => void;
  onEdit: (txn: Transaction) => void;
  onToggleStatus: (txn: Transaction) => void;
  onDuplicate: (txn: Transaction) => void;
  onDelete: (txn: Transaction) => void;
  onOpenImportSharedModal?: () => void;
}

const TransactionsModuleView: React.FC<TransactionsModuleViewProps> = ({
  mode,
  transactions,
  categories,
  wallets,
  effectiveConversionRate,
  locale,
  searchQuery,
  setSearchQuery,
  filterMonth,
  setFilterMonth,
  filterYear,
  setFilterYear,
  filterCategory,
  setFilterCategory,
  filterCurrency,
  setFilterCurrency,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  filterWallet,
  setFilterWallet,
  filterExpenseKind,
  setFilterExpenseKind,
  sortBy,
  setSortBy,
  onAdd,
  onAddItemizedPurchase,
  onEdit,
  onToggleStatus,
  onDuplicate,
  onDelete,
  onOpenImportSharedModal,
}) => {
  const [visibleCount, setVisibleCount] = useState(25);
  const [filterItemizedOnly, setFilterItemizedOnly] = useState(false);
  const [expandedTxnIds, setExpandedTxnIds] = useState<Record<string, boolean>>({});
  const activeRate = effectiveConversionRate || 450;

  const toggleExpandTxn = (id: string) => {
    setExpandedTxnIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const yearsAvailable = useMemo(() => {
    const set = new Set<string>([String(new Date().getFullYear())]);
    transactions.forEach((t) => set.add(t.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (mode === 'incomes' && t.type !== 'income') return false;
        if (mode === 'expenses' && t.type !== 'expense') return false;
        if (mode === 'movements' && filterType !== 'all' && t.type !== filterType)
          return false;

        if (filterItemizedOnly) {
          const hasItems =
            Array.isArray(t.purchasedItems) && t.purchasedItems.length > 0;
          if (!hasItems && !t.storeName) return false;
        }

        const txnStatus: TransactionStatus = esTransaccionCompletada(t)
          ? 'completed'
          : 'pending';
        if (filterStatus !== 'all' && txnStatus !== filterStatus) return false;

        if (filterWallet !== 'all' && t.walletId !== filterWallet) return false;

        if (filterYear !== 'all' && t.date.slice(0, 4) !== filterYear) return false;
        if (filterMonth !== 'all' && t.date.slice(5, 7) !== filterMonth)
          return false;
        if (filterCategory !== 'all' && t.categoryId !== filterCategory)
          return false;
        if (filterCurrency !== 'all' && t.currency !== filterCurrency)
          return false;

        if (mode === 'expenses' && filterExpenseKind !== 'all') {
          if (filterExpenseKind === 'recurring' && !t.isRecurring) return false;
          if (filterExpenseKind === 'fixed' && t.expenseType !== 'fixed')
            return false;
          if (filterExpenseKind === 'variable' && t.expenseType !== 'variable')
            return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDesc = t.description.toLowerCase().includes(q);
          const matchNotes = (t.notes || '').toLowerCase().includes(q);
          const matchSource = (t.source || '').toLowerCase().includes(q);
          const matchStore = (t.storeName || '').toLowerCase().includes(q);
          const matchItems = Array.isArray(t.purchasedItems)
            ? t.purchasedItems.some((it) => it.name.toLowerCase().includes(q))
            : false;
          if (!matchDesc && !matchNotes && !matchSource && !matchStore && !matchItems)
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return compararTransaccionesRecientesPrimero(a, b);
        if (sortBy === 'date_asc') return compararTransaccionesPorFechaYHoraProceso(a, b);
        if (sortBy === 'amount_desc') return b.amountUsd - a.amountUsd;
        return a.amountUsd - b.amountUsd;
      });
  }, [
    transactions,
    mode,
    filterType,
    filterStatus,
    filterWallet,
    filterYear,
    filterMonth,
    filterCategory,
    filterCurrency,
    filterExpenseKind,
    filterItemizedOnly,
    searchQuery,
    sortBy,
  ]);

  // Solo Completados afectan el saldo real; los Pendientes van al saldo proyectado
  const totalCompletedFilteredUsd = useMemo(
    () =>
      filtered
        .filter((t) => esTransaccionCompletada(t))
        .reduce(
          (acc, t) =>
            acc +
            (t.type === 'income'
              ? t.amountUsd
              : mode === 'movements'
                ? -t.amountUsd
                : t.amountUsd),
          0
        ),
    [filtered, mode]
  );

  // Desglose separado de Completados: Todo lo que fue en USD vs Todo lo que fue en Bolívares (VES)
  const completedBreakdown = useMemo(() => {
    let soloUsd = 0;
    let soloVesNominal = 0;
    let soloVesEquivUsd = 0;
    for (const t of filtered) {
      if (!esTransaccionCompletada(t)) continue;
      const sign = t.type === 'income' ? 1 : mode === 'movements' ? -1 : 1;
      if (t.currency === 'VES') {
        soloVesNominal += sign * t.amount;
        soloVesEquivUsd += sign * t.amountUsd;
      } else {
        soloUsd += sign * t.amountUsd;
      }
    }
    return { soloUsd, soloVesNominal, soloVesEquivUsd };
  }, [filtered, mode]);

  const totalPendingFilteredUsd = useMemo(
    () =>
      filtered
        .filter((t) => !esTransaccionCompletada(t))
        .reduce(
          (acc, t) =>
            acc +
            (t.type === 'income'
              ? t.amountUsd
              : mode === 'movements'
                ? -t.amountUsd
                : t.amountUsd),
          0
        ),
    [filtered, mode]
  );

  const totalProjectedFilteredUsd =
    totalCompletedFilteredUsd + totalPendingFilteredUsd;

  const relevantCategories = categories.filter((c) => {
    if (mode === 'incomes') return c.type === 'income';
    if (mode === 'expenses') return c.type === 'expense';
    return c.type === 'income' || c.type === 'expense';
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)]">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {mode === 'incomes'
              ? 'Mis ingresos personales'
              : mode === 'expenses'
                ? 'Mis gastos personales'
                : 'Todos mis movimientos'}
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {mode === 'incomes' &&
              'Controla tus ingresos Completados (afectan saldo real) y Pendientes (afectan saldo proyectado) por billetera.'}
            {mode === 'expenses' &&
              'Administra tus gastos Completados y Pendientes por billetera conservando su tasa histórica.'}
            {mode === 'movements' &&
              'Historial cronológico unificado con filtro por estado (Completado / Pendiente) y billetera.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {mode !== 'incomes' && onOpenImportSharedModal && (
            <button
              type="button"
              onClick={onOpenImportSharedModal}
              className="px-3.5 py-2 text-xs font-semibold text-[var(--lavender-text)] bg-[var(--lavender-soft)] hover:opacity-90 rounded-xl transition-opacity flex items-center gap-1.5 whitespace-nowrap"
              title="Importar archivo .json con gastos compartidos de Finanzas en Pareja"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Gastos Compartidos</span>
            </button>
          )}
          {mode !== 'expenses' && (
            <button
              type="button"
              onClick={() => onAdd('income')}
              className="px-4 py-2 text-xs font-medium text-white bg-[var(--income-color)] hover:opacity-90 rounded-xl transition-opacity whitespace-nowrap"
            >
              + Registrar ingreso
            </button>
          )}
          {mode !== 'incomes' && onAddItemizedPurchase && (
            <button
              type="button"
              onClick={onAddItemizedPurchase}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[var(--pink-primary)] to-[var(--lavender-accent)] hover:opacity-95 rounded-xl transition-opacity flex items-center gap-1.5 shadow-xs whitespace-nowrap"
              title="Registrar una compra pagada de una vez detallando cada artículo que compraste (ej. Farmatodo, Locatel, Supermercado)"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>🛍️ Compra con Desglose (Ej. Farmatodo)</span>
            </button>
          )}
          {mode !== 'incomes' && (
            <button
              type="button"
              onClick={() => onAdd('expense')}
              className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors whitespace-nowrap"
            >
              + Registrar gasto
            </button>
          )}
        </div>
      </div>

      {/* Tarjetas de Resumen del Módulo (Completado vs Pendiente vs Proyectado con equivalentes bimonetarios) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              {mode === 'movements'
                ? 'Saldo real (Completados)'
                : 'Total completado (Saldo real)'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-[var(--income-color)]" />
          </div>
          <div>
            <div
              className={`text-xl font-bold font-mono-tabular ${
                mode === 'incomes'
                  ? 'text-[var(--income-color)]'
                  : mode === 'expenses'
                    ? 'text-[var(--expense-color)]'
                    : totalCompletedFilteredUsd >= 0
                      ? 'text-[var(--income-color)]'
                      : 'text-[var(--expense-color)]'
              }`}
            >
              {formatearMonto(totalCompletedFilteredUsd, 'USD', locale)}
            </div>
            <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
              ≈{' '}
              {formatearMonto(
                totalCompletedFilteredUsd * activeRate,
                'VES',
                locale
              )}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[11px] font-mono-tabular space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">En USD:</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {formatearMonto(completedBreakdown.soloUsd, 'USD', locale)}
                <span className="text-[10px] text-[var(--text-secondary)] ml-1">
                  (≈ {formatearMonto(completedBreakdown.soloUsd * activeRate, 'VES', locale)})
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">En Bs:</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {formatearMonto(completedBreakdown.soloVesNominal, 'VES', locale)}
                <span className="text-[10px] text-[var(--text-secondary)] ml-1">
                  (≈ {formatearMonto(completedBreakdown.soloVesEquivUsd, 'USD', locale)})
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              En estado Pendiente
            </span>
            <Clock className="w-4 h-4 text-[var(--lavender-accent)]" />
          </div>
          <div className="text-xl font-bold font-mono-tabular text-[var(--lavender-accent)]">
            {formatearMonto(totalPendingFilteredUsd, 'USD', locale)}
          </div>
          <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            ≈{' '}
            {formatearMonto(
              totalPendingFilteredUsd * activeRate,
              'VES',
              locale
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] pt-1">
            {filtered.filter((t) => !esTransaccionCompletada(t)).length} registros pendientes (no afectan saldo actual)
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1.5">
          <span className="text-xs text-[var(--text-secondary)] block">
            {mode === 'movements'
              ? 'Balance proyectado de selección'
              : 'Total proyectado (Completado + Pendiente)'}
          </span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(totalProjectedFilteredUsd, 'USD', locale)}
          </div>
          <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            ≈{' '}
            {formatearMonto(
              totalProjectedFilteredUsd * activeRate,
              'VES',
              locale
            )}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] pt-1">
            Haz clic en el estado de cualquier fila para alternar
          </p>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descripción, fuente o nota..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          <select
            value={filterWallet}
            onChange={(e) => setFilterWallet(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          >
            <option value="all">Todas las billeteras</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.currency})
              </option>
            ))}
          </select>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          >
            <option value="all">Todos los meses</option>
            <option value="01">Enero</option>
            <option value="02">Febrero</option>
            <option value="03">Marzo</option>
            <option value="04">Abril</option>
            <option value="05">Mayo</option>
            <option value="06">Junio</option>
            <option value="07">Julio</option>
            <option value="08">Agosto</option>
            <option value="09">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          >
            <option value="all">Todas las categorías</option>
            {relevantCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | 'date_desc'
                  | 'date_asc'
                  | 'amount_desc'
                  | 'amount_asc'
              )
            }
            className="px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          >
            <option value="date_desc">Más recientes primero</option>
            <option value="date_asc">Más antiguos primero</option>
            <option value="amount_desc">Mayor importe (USD)</option>
            <option value="amount_asc">Menor importe (USD)</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-divider)]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro de Estado: Todos / Completados / Pendientes */}
            <span className="text-xs text-[var(--text-secondary)]">Estado:</span>
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'completed', label: 'Completados' },
                { id: 'pending', label: 'Pendientes' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setFilterStatus(st.id)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  filterStatus === st.id
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {st.label}
              </button>
            ))}

            <span className="text-xs text-[var(--text-secondary)] ml-2">Moneda:</span>
            {(['all', 'USD', 'VES'] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setFilterCurrency(cur)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  filterCurrency === cur
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {cur === 'all' ? 'Todas' : cur === 'USD' ? 'Solo USD' : 'Solo Bs (VES)'}
              </button>
            ))}

            {mode === 'movements' && (
              <>
                <span className="text-xs text-[var(--text-secondary)] ml-2">Tipo:</span>
                {(['all', 'income', 'expense'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setFilterType(tp)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      filterType === tp
                        ? 'bg-[var(--lavender-accent)] text-white'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {tp === 'all'
                      ? 'Todos'
                      : tp === 'income'
                        ? 'Ingresos'
                        : 'Gastos'}
                  </button>
                ))}
              </>
            )}

            {mode === 'expenses' && (
              <>
                <span className="text-xs text-[var(--text-secondary)] ml-2">Clasificación:</span>
                {(
                  [
                    { id: 'all', label: 'Todos' },
                    { id: 'fixed', label: 'Fijos' },
                    { id: 'variable', label: 'Variables' },
                    { id: 'recurring', label: 'Recurrentes' },
                  ] as const
                ).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setFilterExpenseKind(k.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      filterExpenseKind === k.id
                        ? 'bg-[var(--rose-gold)] text-white'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </>
            )}
            {mode !== 'incomes' && (
              <button
                type="button"
                onClick={() => setFilterItemizedOnly((prev) => !prev)}
                className={`ml-2 px-2.5 py-1 text-xs rounded-lg transition-colors inline-flex items-center gap-1 font-medium ${
                  filterItemizedOnly
                    ? 'bg-[var(--pink-primary)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                }`}
              >
                <ShoppingBag className="w-3 h-3" />
                <span>🛍️ Con desglose de compra</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterMonth('all');
              setFilterYear('all');
              setFilterCategory('all');
              setFilterCurrency('all');
              setFilterType('all');
              setFilterStatus('all');
              setFilterWallet('all');
              setFilterExpenseKind('all');
              setFilterItemizedOnly(false);
            }}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Tabla de Registros */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No se encontraron movimientos con los filtros seleccionados.
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Prueba ajustando la búsqueda o registra un nuevo movimiento.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--text-secondary)]">
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Descripción · Billetera</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Importe y equivalente</th>
                    <th className="py-3 px-4 text-right">Consolidado USD</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)] text-xs">
                  {filtered.slice(0, visibleCount).map((txn) => {
                    const cat = categories.find((c) => c.id === txn.categoryId);
                    const wallet = wallets.find((w) => w.id === txn.walletId);
                    const isCompleted = esTransaccionCompletada(txn);
                    const rateForRow = txn.exchangeRate || activeRate;
                    const timeInfo = obtenerInfoHoraProcesoTransaccion(txn, locale);
                    return (
                      <tr
                        key={txn.id}
                        className="hover:bg-[var(--surface-subtle)]/60 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                          <div className="font-semibold text-[var(--text-primary)]">
                            {txn.date}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            Hora: {timeInfo.timeFormatted}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-[var(--text-primary)]">
                              {txn.description}
                            </span>
                            {(txn.storeName ||
                              (txn.purchasedItems &&
                                txn.purchasedItems.length > 0)) && (
                              <button
                                type="button"
                                onClick={() => toggleExpandTxn(txn.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--pink-light)] text-[var(--pink-primary)] border border-[var(--pink-primary)]/30 hover:opacity-90 transition-opacity"
                                title="Haz clic para ver u ocultar qué compraste en esta oportunidad"
                              >
                                <ShoppingBag className="w-3 h-3" />
                                <span>
                                  {txn.storeName || 'Compra detallada'}
                                  {txn.purchasedItems &&
                                  txn.purchasedItems.length > 0
                                    ? ` · ${txn.purchasedItems.reduce((acc, it) => acc + (it.quantity || 1), 0)} art.`
                                    : ''}
                                </span>
                                <span className="underline ml-0.5">
                                  {expandedTxnIds[txn.id] ? 'Ocultar' : 'Ver detalle'}
                                </span>
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-1.5 mt-0.5">
                            {wallet && (
                              <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: wallet.color }}
                                />
                                {wallet.name}
                                <span>·</span>
                              </span>
                            )}
                            <span>
                              {txn.type === 'income' ? 'Ingreso' : 'Gasto'}
                            </span>
                            {txn.expenseType && (
                              <>
                                <span>·</span>
                                <span>
                                  {txn.expenseType === 'fixed'
                                    ? 'Gasto fijo'
                                    : 'Gasto variable'}
                                </span>
                              </>
                            )}
                            {txn.isRecurring && (
                              <>
                                <span>·</span>
                                <span className="text-[var(--lavender-accent)]">Recurrente</span>
                              </>
                            )}
                            {txn.source && (
                              <>
                                <span>·</span>
                                <span>Fuente: {txn.source}</span>
                              </>
                            )}
                            {txn.paymentMethod && (
                              <>
                                <span>·</span>
                                <span>{txn.paymentMethod}</span>
                              </>
                            )}
                          </div>

                          {/* Desglose de artículos comprados (Tipo Farmatodo) */}
                          {txn.purchasedItems &&
                            txn.purchasedItems.length > 0 && (
                              <div className="mt-2">
                                {!expandedTxnIds[txn.id] ? (
                                  <div
                                    onClick={() => toggleExpandTxn(txn.id)}
                                    className="flex flex-wrap items-center gap-1 cursor-pointer"
                                  >
                                    {txn.purchasedItems.slice(0, 4).map((item) => (
                                      <span
                                        key={item.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[10px] text-[var(--text-primary)]"
                                      >
                                        <strong className="text-[var(--pink-primary)] font-mono-tabular">
                                          {item.quantity}x
                                        </strong>{' '}
                                        {item.name}
                                      </span>
                                    ))}
                                    {txn.purchasedItems.length > 4 && (
                                      <span className="text-[10px] font-semibold text-[var(--pink-primary)] underline">
                                        +{txn.purchasedItems.length - 4} más...
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--pink-primary)]/30 space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-hairline)] pb-1">
                                      <span>
                                        🛍️ Desglose de compra
                                        {txn.storeName ? ` en ${txn.storeName}` : ''} (
                                        {txn.purchasedItems.length} productos)
                                      </span>
                                      <span className="font-mono-tabular text-[var(--text-primary)]">
                                        Total pagado:{' '}
                                        {formatearMonto(
                                          txn.amount,
                                          txn.currency,
                                          locale
                                        )}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                      {txn.purchasedItems.map((item) => (
                                        <div
                                          key={item.id}
                                          className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-[11px]"
                                        >
                                          <span className="text-[var(--text-primary)] truncate">
                                            <strong className="text-[var(--pink-primary)] font-mono-tabular mr-1">
                                              {item.quantity}x
                                            </strong>
                                            {item.name}
                                          </span>
                                          {item.unitPrice != null &&
                                            item.unitPrice > 0 && (
                                              <span className="font-mono-tabular text-[10px] text-[var(--text-secondary)] shrink-0">
                                                {formatearMonto(
                                                  item.unitPrice * item.quantity,
                                                  txn.currency,
                                                  locale
                                                )}
                                              </span>
                                            )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-primary)] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{
                                backgroundColor: cat?.color || '#C86D85',
                              }}
                            />
                            {cat?.name || 'General'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onToggleStatus(txn)}
                            title="Haz clic para cambiar entre Completado y Pendiente"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-85 ${
                              isCompleted
                                ? 'bg-[var(--income-bg)] text-[var(--income-color)]'
                                : 'bg-[var(--lavender-soft)] text-[var(--lavender-text)]'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Completado</span>
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                <span>Pendiente</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-[var(--text-primary)] whitespace-nowrap">
                          <div className="font-semibold">
                            {formatearMonto(txn.amount, txn.currency, locale)}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            ≈{' '}
                            {txn.currency === 'VES'
                              ? formatearMonto(txn.amountUsd, 'USD', locale)
                              : formatearMonto(txn.amountUsd * rateForRow, 'VES', locale)}
                          </div>
                          {txn.currency === 'VES' && txn.exchangeRate && (
                            <div className="text-[10px] text-[var(--text-secondary)]">
                              Tasa {txn.exchangeRateSource === 'bcv' ? 'BCV' : 'Manual'}:{' '}
                              {formatearTasa(txn.exchangeRate, locale)} Bs
                            </div>
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono-tabular font-semibold whitespace-nowrap ${
                            !isCompleted
                              ? 'text-[var(--text-secondary)]'
                              : txn.type === 'income'
                                ? 'text-[var(--income-color)]'
                                : 'text-[var(--expense-color)]'
                          }`}
                        >
                          <div>
                            {txn.type === 'income' ? '+' : '-'}
                            {formatearMonto(txn.amountUsd, 'USD', locale)}
                          </div>
                          <div className="text-[10px] font-normal text-[var(--text-secondary)]">
                            ≈ {formatearMonto(txn.amountUsd * activeRate, 'VES', locale)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEdit(txn)}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg"
                              title="Editar registro"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDuplicate(txn)}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--lavender-accent)] rounded-lg"
                              title="Duplicar registro"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(txn)}
                              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)] rounded-lg"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > visibleCount && (
              <div className="p-4 border-t border-[var(--border-hairline)] text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 25)}
                  className="px-4 py-2 text-xs font-medium text-[var(--pink-primary)] hover:text-[var(--pink-dark)] underline"
                >
                  Mostrar más movimientos ({filtered.length - visibleCount}{' '}
                  restantes)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 1B. MÓDULO DE BILLETERAS Y SEGMENTACIÓN DE CUENTAS (WALLETS)
 * ============================================================================ */
const WalletsModuleView: React.FC<{
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  resumenBilleteras: ResumenBilleteraItem[];
  resumenMes: ReturnType<typeof calcularResumenFinanciero>;
  selectedMonth: string;
  effectiveConversionRate: number | null;
  locale: 'es-VE' | 'en-US';
  showToast: (t: string, k?: 'success' | 'error' | 'info') => void;
  onNewTransaction: (walletId?: string, type?: TransactionType) => void;
  onOpenThirdPartyReload: (wallet: WalletAccount) => void;
  onOpenBonusCard: (
    wallet: WalletAccount,
    tab?: 'load_bonus' | 'transfer_to_bank'
  ) => void;
}> = ({
  appData,
  setAppData,
  resumenBilleteras,
  resumenMes,
  selectedMonth,
  effectiveConversionRate,
  locale,
  showToast,
  onNewTransaction,
  onOpenThirdPartyReload,
  onOpenBonusCard,
}) => {
  const [editingWallet, setEditingWallet] = useState<WalletAccount | null>(null);
  const [name, setName] = useState('');
  const [banco, setBanco] = useState('');
  const [walletType, setWalletType] = useState<WalletKind>('digital_usd');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [initialBalanceStr, setInitialBalanceStr] = useState('0');
  const [comisionPagoMovilStr, setComisionPagoMovilStr] = useState('0.3');
  const [comisionTransferenciaTipo, setComisionTransferenciaTipo] = useState<
    'fixed_ves' | 'percent'
  >('fixed_ves');
  const [comisionTransferenciaStr, setComisionTransferenciaStr] = useState('54');
  const [color, setColor] = useState('#7C6A96');
  const [notes, setNotes] = useState('');
  const [isThirdPartyExpenseAccount, setIsThirdPartyExpenseAccount] =
    useState<boolean>(false);
  const [isPassThroughAccount, setIsPassThroughAccount] =
    useState<boolean>(false);
  const [hidePassThroughHistory, setHidePassThroughHistory] =
    useState<boolean>(false);
  const [beneficiaryName, setBeneficiaryName] = useState<string>('');
  const [isBonusCard, setIsBonusCard] = useState<boolean>(false);
  const [isCash, setIsCash] = useState<boolean>(false);

  // Vista activa para no saturar: 'single' (Explorar 1 cuenta seleccionada), 'reorder' (Ordenar cuentas), 'transfer' (Transferir entre cuentas), 'form' (Crear/Editar cuenta)
  const [activeViewTab, setActiveViewTab] = useState<
    'single' | 'reorder' | 'transfer' | 'form'
  >('single');
  const [showInactiveWallets, setShowInactiveWallets] =
    useState<boolean>(false);
  const [dragOverWalletId, setDragOverWalletId] = useState<string | null>(null);

  const moveWalletToPosition = (
    walletId: string,
    targetIndex: number,
    notify: boolean = false
  ) => {
    setAppData((prev) => {
      const list = [...(prev.wallets || INITIAL_WALLETS)].sort((a, b) => {
        const oa =
          typeof a.sortOrder === 'number'
            ? a.sortOrder
            : Number.MAX_SAFE_INTEGER;
        const ob =
          typeof b.sortOrder === 'number'
            ? b.sortOrder
            : Number.MAX_SAFE_INTEGER;
        return oa - ob;
      });
      const fromIdx = list.findIndex((w) => w.id === walletId);
      const boundedTarget = Math.max(
        0,
        Math.min(list.length - 1, targetIndex)
      );
      if (fromIdx < 0 || fromIdx === boundedTarget) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(boundedTarget, 0, moved);
      const normalized = list.map((w, idx) => ({
        ...w,
        sortOrder: idx,
      }));
      if (notify) {
        showToast(
          `"${moved.name}" colocada en la posición ${boundedTarget + 1}º.`,
          'info'
        );
      }
      return {
        ...prev,
        wallets: normalized,
      };
    });
  };

  const moveWalletBeforeOrAfterTarget = (
    draggedId: string,
    targetId: string
  ) => {
    if (!draggedId || !targetId || draggedId === targetId) return;
    setAppData((prev) => {
      const list = [...(prev.wallets || INITIAL_WALLETS)].sort((a, b) => {
        const oa =
          typeof a.sortOrder === 'number'
            ? a.sortOrder
            : Number.MAX_SAFE_INTEGER;
        const ob =
          typeof b.sortOrder === 'number'
            ? b.sortOrder
            : Number.MAX_SAFE_INTEGER;
        return oa - ob;
      });
      const fromIdx = list.findIndex((w) => w.id === draggedId);
      const toIdx = list.findIndex((w) => w.id === targetId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      const normalized = list.map((w, idx) => ({
        ...w,
        sortOrder: idx,
      }));
      showToast(
        `"${moved.name}" movida a la posición ${toIdx + 1}º.`,
        'info'
      );
      return {
        ...prev,
        wallets: normalized,
      };
    });
  };

  const selectableWallets = useMemo(() => {
    const filtered = showInactiveWallets
      ? resumenBilleteras
      : resumenBilleteras.filter((wb) => wb.wallet.active);
    return filtered.length > 0 ? filtered : resumenBilleteras;
  }, [resumenBilleteras, showInactiveWallets]);

  const [selectedWalletInspect, setSelectedWalletInspect] = useState<string>(
    () =>
      resumenBilleteras.find((w) => w.wallet.active)?.wallet.id ||
      resumenBilleteras[0]?.wallet.id ||
      ''
  );

  const selectedWalletEntry = useMemo(() => {
    return (
      selectableWallets.find((wb) => wb.wallet.id === selectedWalletInspect) ||
      selectableWallets[0] ||
      null
    );
  }, [selectableWallets, selectedWalletInspect]);

  const effectiveSelectedWalletId = selectedWalletEntry?.wallet.id || '';

  const activeRate =
    effectiveConversionRate ||
    appData.settings.lastOfficialRate ||
    appData.settings.defaultExchangeRate ||
    450;

  const parsedInitialNumber = useMemo(() => {
    const n = Number(initialBalanceStr.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [initialBalanceStr]);

  const resetForm = () => {
    setEditingWallet(null);
    setName('');
    setBanco('');
    setWalletType('digital_usd');
    setCurrency('USD');
    setInitialBalanceStr('0');
    setComisionPagoMovilStr('0.3');
    setComisionTransferenciaTipo('fixed_ves');
    setComisionTransferenciaStr('54');
    setColor('#7C6A96');
    setNotes('');
    setIsThirdPartyExpenseAccount(false);
    setIsPassThroughAccount(false);
    setHidePassThroughHistory(false);
    setBeneficiaryName('');
    setIsBonusCard(false);
    setIsCash(false);
  };

  const handleStartEditWallet = (wb: ResumenBilleteraItem) => {
    const wBonus =
      Boolean(wb.wallet.isBonusCard) ||
      (wb.wallet.banco || '').toLowerCase().includes('todoticket') ||
      wb.wallet.name.toLowerCase().includes('todoticket');
    const wCash = esBilleteraEfectivo(wb.wallet);
    const nextTrTipo =
      wb.wallet.comisionTransferenciaTipo || (wBonus ? 'percent' : 'fixed_ves');
    setEditingWallet(wb.wallet);
    setName(wb.wallet.name);
    setBanco(wb.wallet.banco || '');
    setWalletType(wb.wallet.type);
    setCurrency(wb.wallet.currency);
    setInitialBalanceStr(
      String(
        wb.wallet.currency === 'VES'
          ? Number(wb.initialBalanceNominal.toFixed(2))
          : Number(wb.wallet.initialBalanceUsd.toFixed(2))
      )
    );
    setComisionPagoMovilStr(
      wb.wallet.comisionPagoMovil != null
        ? String(wb.wallet.comisionPagoMovil)
        : wb.wallet.currency === 'VES'
          ? '0.3'
          : '0'
    );
    setComisionTransferenciaTipo(nextTrTipo);
    setComisionTransferenciaStr(
      wb.wallet.comisionTransferencia != null
        ? String(
            nextTrTipo === 'fixed_ves' &&
              wb.wallet.comisionTransferencia < 1 &&
              wb.wallet.comisionTransferencia > 0
              ? 54
              : wb.wallet.comisionTransferencia
          )
        : nextTrTipo === 'percent'
          ? '1.5'
          : wb.wallet.currency === 'VES'
            ? '54'
            : '0'
    );
    setColor(wb.wallet.color);
    setNotes(wb.wallet.notes || '');
    setIsThirdPartyExpenseAccount(Boolean(wb.wallet.isThirdPartyExpenseAccount));
    setIsPassThroughAccount(Boolean(wb.wallet.isPassThroughAccount));
    setHidePassThroughHistory(Boolean(wb.wallet.hidePassThroughHistory));
    setBeneficiaryName(wb.wallet.beneficiaryName || '');
    setIsBonusCard(wBonus);
    setIsCash(wCash);
    setActiveViewTab('form');
  };

  const handleSaveWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Escribe el nombre de la billetera o cuenta.', 'error');
      return;
    }

    const parsedInitial = Number(initialBalanceStr.replace(',', '.')) || 0;
    const parsedComisionPagoMovil = isCash
      ? 0
      : Math.max(0, Number(comisionPagoMovilStr.replace(',', '.')) || 0);
    const parsedComisionTransferencia = isCash
      ? 0
      : Math.max(0, Number(comisionTransferenciaStr.replace(',', '.')) || 0);

    const isVes = currency === 'VES';
    const effectiveType: WalletKind = isCash
      ? isVes
        ? 'cash_ves'
        : 'cash_usd'
      : walletType === 'cash_ves' || walletType === 'cash_usd'
        ? isVes
          ? 'bank_ves'
          : 'digital_usd'
        : walletType;

    const initialBalanceVes = isVes
      ? Number(parsedInitial.toFixed(2))
      : Number((parsedInitial * activeRate).toFixed(2));
    const initialBalanceUsd = isVes
      ? activeRate > 0
        ? Number((parsedInitial / activeRate).toFixed(6))
        : 0
      : Number(parsedInitial.toFixed(6));

    const newWallet: WalletAccount = {
      id: editingWallet
        ? editingWallet.id
        : `wallet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      banco: isCash ? undefined : banco.trim() || undefined,
      type: effectiveType,
      currency,
      initialBalanceUsd,
      initialBalanceVes,
      comisionPagoMovil: parsedComisionPagoMovil,
      comisionTransferenciaTipo,
      comisionTransferencia: parsedComisionTransferencia,
      color,
      active: editingWallet ? editingWallet.active : true,
      notes: notes.trim() || undefined,
      isThirdPartyExpenseAccount: Boolean(
        isThirdPartyExpenseAccount && !isPassThroughAccount
      ),
      isPassThroughAccount: Boolean(isPassThroughAccount),
      hidePassThroughHistory: Boolean(
        isPassThroughAccount && hidePassThroughHistory
      ),
      beneficiaryName:
        (isThirdPartyExpenseAccount || isPassThroughAccount) &&
        beneficiaryName.trim()
          ? beneficiaryName.trim()
          : undefined,
      isBonusCard: Boolean(isBonusCard && !isCash),
      isCash: Boolean(isCash),
      sortOrder: editingWallet?.sortOrder,
    };

    setAppData((prev) => {
      const currentWallets = prev.wallets || INITIAL_WALLETS;
      const exists = currentWallets.some((w) => w.id === newWallet.id);
      const nextList = exists
        ? currentWallets.map((w) =>
            w.id === newWallet.id
              ? { ...newWallet, sortOrder: w.sortOrder }
              : w
          )
        : [
            ...currentWallets,
            { ...newWallet, sortOrder: currentWallets.length },
          ];
      return {
        ...prev,
        wallets: nextList,
      };
    });

    showToast(
      editingWallet
        ? `Billetera "${newWallet.name}" actualizada.`
        : `Billetera "${newWallet.name}" creada con saldo inicial en ${isVes ? 'Bolívares (Bs)' : currency}.`,
      'success'
    );
    setSelectedWalletInspect(newWallet.id);
    resetForm();
    setActiveViewTab('single');
  };

  const kindLabels: Record<WalletKind, string> = {
    digital_usd: 'Zelle / Billetera Digital USD',
    bank_ves: 'Banco Nacional (Bs / Pago Móvil)',
    bank_usd: 'Cuenta Bancaria en USD',
    cash_usd: 'Efectivo USD ($)',
    cash_ves: 'Efectivo Bolívares (Bs)',
    other: 'Otra cuenta',
  };

  const [walletStatementScope, setWalletStatementScope] = useState<
    'all' | 'month'
  >('all');
  const [walletStatementTypeFilter, setWalletStatementTypeFilter] = useState<
    'all' | 'DEBITO' | 'CREDITO'
  >('all');
  const [walletStatementSearch, setWalletStatementSearch] =
    useState<string>('');
  const [showStatementEquiv, setShowStatementEquiv] = useState<boolean>(false);
  const [confirmClearPassThroughId, setConfirmClearPassThroughId] = useState<
    string | null
  >(null);
  const [editingStatementRow, setEditingStatementRow] = useState<{
    rowId: string;
    rawId: string;
    sourceKind: 'txn' | 'tr' | 'sav' | 'rom';
    descriptionInput: string;
    amountInput: string;
    currencyInput: CurrencyCode;
    dateInput: string;
    exchangeRateInput: string;
  } | null>(null);

  const walletTransactions = useMemo(() => {
    if (!effectiveSelectedWalletId) return [];
    return appData.transactions
      .filter(
        (t) =>
          t.walletId === effectiveSelectedWalletId ||
          t.thirdPartyTargetWalletId === effectiveSelectedWalletId
      )
      .sort((a, b) => compararTransaccionesRecientesPrimero(a, b));
  }, [appData.transactions, effectiveSelectedWalletId]);

  const handleStartEditStatementRow = (row: {
    id: string;
    rawId: string;
    sourceKind: 'txn' | 'tr' | 'sav' | 'rom';
    date: string;
    description: string;
    amountNominal: number;
  }) => {
    const isVesWallet = selectedWalletEntry?.wallet.currency === 'VES';
    if (row.sourceKind === 'txn') {
      const found = (appData.transactions || []).find((t) => t.id === row.rawId);
      if (found) {
        const cur: CurrencyCode = isVesWallet ? 'VES' : found.currency || 'USD';
        const nominalToEdit =
          cur === 'VES'
            ? found.currency === 'VES' && Number.isFinite(found.amount)
              ? found.amount
              : Number(
                  (
                    (Number(found.amountUsd) || 0) *
                    (found.exchangeRate && found.exchangeRate > 0
                      ? found.exchangeRate
                      : activeRate)
                  ).toFixed(2)
                )
            : Number((Number(found.amountUsd) || found.amount || 0).toFixed(2));
        setEditingStatementRow({
          rowId: row.id,
          rawId: row.rawId,
          sourceKind: 'txn',
          descriptionInput: found.description || row.description,
          amountInput: String(nominalToEdit),
          currencyInput: cur,
          dateInput: found.date || row.date,
          exchangeRateInput: String(
            found.exchangeRate && found.exchangeRate > 0
              ? found.exchangeRate
              : activeRate || 450
          ),
        });
        return;
      }
    }
    setEditingStatementRow({
      rowId: row.id,
      rawId: row.rawId,
      sourceKind: row.sourceKind,
      descriptionInput: row.description,
      amountInput: String(row.amountNominal),
      currencyInput: isVesWallet ? 'VES' : 'USD',
      dateInput: row.date,
      exchangeRateInput: String(activeRate || 450),
    });
  };

  const handleSaveEditedStatementRow = () => {
    if (!editingStatementRow) return;
    const parsedAmt = Number(editingStatementRow.amountInput);
    if (!Number.isFinite(parsedAmt) || parsedAmt < 0) {
      showToast('Ingresa un monto válido (mayor o igual a 0).', 'error');
      return;
    }
    const cleanAmt = Number(parsedAmt.toFixed(2));
    const cur = editingStatementRow.currencyInput;
    const rateVal =
      Number(editingStatementRow.exchangeRateInput) > 0
        ? Number(editingStatementRow.exchangeRateInput)
        : activeRate > 0
          ? activeRate
          : 450;
    const computedUsd =
      cur === 'USD'
        ? cleanAmt
        : rateVal > 0
          ? Number((cleanAmt / rateVal).toFixed(6))
          : 0;
    const cleanDesc = editingStatementRow.descriptionInput.trim();
    const cleanDate = editingStatementRow.dateInput;

    if (editingStatementRow.sourceKind === 'txn') {
      setAppData((prev) => {
        const nextTransactions = (prev.transactions || []).map((t) => {
          if (t.id !== editingStatementRow.rawId) return t;
          return {
            ...t,
            date: cleanDate || t.date,
            description: cleanDesc || t.description,
            amount: cleanAmt,
            currency: cur,
            exchangeRate: cur === 'VES' ? rateVal : null,
            amountUsd: computedUsd,
          };
        });

        const nextAppCredits = (prev.appCredits || []).map((cred) => {
          if (cred.depositTransactionId === editingStatementRow.rawId) {
            return {
              ...cred,
              depositCurrency: cur,
              depositAmountNominal: cleanAmt,
              depositGrossAmountNominal: cleanAmt,
              depositExchangeRate: cur === 'VES' ? rateVal : null,
            };
          }
          return cred;
        });

        return {
          ...prev,
          transactions: nextTransactions,
          appCredits: nextAppCredits,
        };
      });
      setEditingStatementRow(null);
      showToast(
        `Movimiento actualizado a ${formatearMonto(cleanAmt, cur, locale)}.`,
        'success'
      );
      return;
    }

    if (editingStatementRow.sourceKind === 'tr') {
      setAppData((prev) => ({
        ...prev,
        walletTransfers: (prev.walletTransfers || []).map((tr) => {
          if (tr.id !== editingStatementRow.rawId) return tr;
          const isSrc = tr.sourceWalletId === selectedWalletEntry?.wallet.id;
          const isDst = tr.destinationWalletId === selectedWalletEntry?.wallet.id;
          return {
            ...tr,
            date: cleanDate || tr.date,
            notes: cleanDesc || tr.notes,
            amountOut: isSrc ? cleanAmt : tr.amountOut,
            amountIn: isDst ? cleanAmt : tr.amountIn,
          };
        }),
      }));
      setEditingStatementRow(null);
      showToast('Transferencia actualizada.', 'success');
      return;
    }

    if (editingStatementRow.sourceKind === 'sav') {
      setAppData((prev) => ({
        ...prev,
        savings: (prev.savings || []).map((sav) =>
          sav.id === editingStatementRow.rawId
            ? {
                ...sav,
                date: cleanDate || sav.date,
                description: cleanDesc || sav.description,
                amountUsd: computedUsd,
                originalCurrency: cur,
                originalAmountVes: cur === 'VES' ? cleanAmt : null,
                exchangeRateUsed: cur === 'VES' ? rateVal : sav.exchangeRateUsed,
              }
            : sav
        ),
      }));
      setEditingStatementRow(null);
      showToast('Movimiento de ahorro actualizado.', 'success');
      return;
    }

    if (editingStatementRow.sourceKind === 'rom') {
      setAppData((prev) => ({
        ...prev,
        romanceFund: prev.romanceFund
          ? {
              ...prev.romanceFund,
              movements: (prev.romanceFund.movements || []).map((mov) =>
                mov.id === editingStatementRow.rawId
                  ? {
                      ...mov,
                      date: cleanDate || mov.date,
                      planName: cleanDesc || mov.planName,
                      amount: cleanAmt,
                      currency: cur,
                      exchangeRate: cur === 'VES' ? rateVal : null,
                      amountUsd: computedUsd,
                    }
                  : mov
              ),
            }
          : prev.romanceFund,
      }));
      setEditingStatementRow(null);
      showToast('Movimiento del fondo de citas actualizado.', 'success');
    }
  };

  const handleDeleteStatementRow = (row: {
    id: string;
    rawId: string;
    sourceKind: 'txn' | 'tr' | 'sav' | 'rom';
    description: string;
  }) => {
    if (row.sourceKind === 'txn') {
      setAppData((prev) => {
        const nextTransactions = (prev.transactions || []).filter(
          (t) => t.id !== row.rawId && t.parentTransactionId !== row.rawId
        );
        const nextAppCredits = (prev.appCredits || []).map((cred) => {
          if (cred.depositTransactionId === row.rawId) {
            return {
              ...cred,
              depositTransactionId: null,
              depositAmountNominal: null,
              depositGrossAmountNominal: null,
            };
          }
          return cred;
        });
        return {
          ...prev,
          transactions: nextTransactions,
          appCredits: nextAppCredits,
        };
      });
      if (editingStatementRow?.rowId === row.id) {
        setEditingStatementRow(null);
      }
      showToast('Movimiento eliminado del estado de cuenta.', 'info');
      return;
    }

    if (row.sourceKind === 'tr') {
      setAppData((prev) => ({
        ...prev,
        walletTransfers: (prev.walletTransfers || []).filter(
          (tr) => tr.id !== row.rawId
        ),
      }));
      showToast('Transferencia eliminada de la cuenta.', 'info');
      return;
    }

    if (row.sourceKind === 'sav') {
      setAppData((prev) => ({
        ...prev,
        savings: (prev.savings || []).filter((s) => s.id !== row.rawId),
      }));
      showToast('Movimiento de ahorro eliminado.', 'info');
      return;
    }

    if (row.sourceKind === 'rom') {
      setAppData((prev) => ({
        ...prev,
        romanceFund: prev.romanceFund
          ? {
              ...prev.romanceFund,
              movements: (prev.romanceFund.movements || []).filter(
                (m) => m.id !== row.rawId
              ),
            }
          : prev.romanceFund,
      }));
      showToast('Movimiento eliminado.', 'info');
    }
  };

  const handleClearPassThroughWallet = (walletIdToClear: string, walletName: string) => {
    setAppData((prev) => {
      const removedTxnIds = new Set(
        (prev.transactions || [])
          .filter(
            (t) =>
              t.walletId === walletIdToClear ||
              t.thirdPartyTargetWalletId === walletIdToClear
          )
          .map((t) => t.id)
      );
      const nextTransactions = (prev.transactions || []).filter(
        (t) => !removedTxnIds.has(t.id) && (!t.parentTransactionId || !removedTxnIds.has(t.parentTransactionId))
      );
      const nextWalletTransfers = (prev.walletTransfers || []).filter(
        (tr) =>
          tr.sourceWalletId !== walletIdToClear &&
          tr.destinationWalletId !== walletIdToClear
      );
      const nextWallets = (prev.wallets || INITIAL_WALLETS).map((w) =>
        w.id === walletIdToClear
          ? { ...w, initialBalanceUsd: 0, initialBalanceVes: 0 }
          : w
      );
      const nextAppCredits = (prev.appCredits || []).map((cred) => {
        if (
          cred.depositWalletId === walletIdToClear ||
          (cred.depositTransactionId && removedTxnIds.has(cred.depositTransactionId))
        ) {
          return {
            ...cred,
            depositTransactionId: null,
            depositAmountNominal: null,
            depositGrossAmountNominal: null,
          };
        }
        return cred;
      });
      return {
        ...prev,
        wallets: nextWallets,
        transactions: nextTransactions,
        walletTransfers: nextWalletTransfers,
        appCredits: nextAppCredits,
      };
    });
    setConfirmClearPassThroughId(null);
    setEditingStatementRow(null);
    showToast(
      `La cuenta "${walletName}" quedó limpia en 0,00.`,
      'success'
    );
  };

  const handleFixDoubleConvertedTxn = (txn: Transaction) => {
    const rateUsed =
      txn.exchangeRate && Number.isFinite(txn.exchangeRate) && txn.exchangeRate > 1
        ? txn.exchangeRate
        : activeRate > 1
          ? activeRate
          : 450;
    // El usuario ingresó el monto en Bolívares pero quedó guardado como USD (o multiplicado dos veces).
    // El valor original en Bolívares es txn.amount (si era p.ej. 17759.60 guardado con currency: 'USD')
    // o bien (txn.amount / rateUsed) si ya estaba multiplicado.
    const correctedVes =
      txn.currency === 'USD' && txn.amount > 500
        ? Number(txn.amount.toFixed(2))
        : Number(((txn.amount || txn.amountUsd * rateUsed) / rateUsed).toFixed(2));
    const correctedUsd = Number((correctedVes / rateUsed).toFixed(6));

    setAppData((prev) => {
      const nextWallets = (prev.wallets || INITIAL_WALLETS).map((w) =>
        w.id === selectedWalletEntry?.wallet.id && w.isPassThroughAccount
          ? { ...w, currency: 'VES' as CurrencyCode }
          : w
      );
      const nextTransactions = (prev.transactions || []).map((t) =>
        t.id === txn.id
          ? {
              ...t,
              amount: correctedVes,
              currency: 'VES' as CurrencyCode,
              exchangeRate: rateUsed,
              amountUsd: correctedUsd,
            }
          : t
      );
      const nextAppCredits = (prev.appCredits || []).map((cred) => {
        if (cred.depositTransactionId === txn.id) {
          return {
            ...cred,
            depositCurrency: 'VES' as CurrencyCode,
            depositAmountNominal: correctedVes,
            depositGrossAmountNominal: correctedVes,
            depositExchangeRate: rateUsed,
          };
        }
        return cred;
      });
      return {
        ...prev,
        wallets: nextWallets,
        transactions: nextTransactions,
        appCredits: nextAppCredits,
      };
    });
    showToast(
      `Monto corregido a ${formatearMonto(correctedVes, 'VES', locale)} (≈ ${formatearMonto(correctedUsd, 'USD', locale)}).`,
      'success'
    );
  };

  const walletBankStatement = useMemo(() => {
    if (!selectedWalletEntry) {
      return {
        rows: [] as Array<{
          id: string;
          rawId: string;
          sourceKind: 'txn' | 'tr' | 'sav' | 'rom';
          date: string;
          formattedDateTime: string;
          reference: string;
          description: string;
          subtitle?: string;
          dcType: 'DEBITO' | 'CREDITO';
          amountNominal: number;
          signedDelta: number;
          saldoAfter: number;
          secondaryEquiv: number;
          timestampMs: number;
          parentId?: string;
        }>,
        pendingRows: [] as Transaction[],
      };
    }

    const wb = selectedWalletEntry;
    const wId = wb.wallet.id;
    const isVesWallet = wb.wallet.currency === 'VES';
    const isAccumulatingWallet = Boolean(
      wb.wallet.isThirdPartyExpenseAccount || wb.wallet.isPassThroughAccount
    );

    const formatBankDateTime24h = (
      dateIso: string,
      record: {
        date: string;
        processedAt?: string;
        createdAt?: string;
        id?: string;
        parentTransactionId?: string;
      }
    ): { formatted: string; timestampMs: number } => {
      const parts = (dateIso || '').split('-');
      const yyyy = parts[0] || '2026';
      const mm = parts[1] || '01';
      const dd = parts[2] || '01';
      const ddmmyyyy = `${dd}-${mm}-${yyyy}`;

      let extracted: Date | null = null;
      const isoCand = record.processedAt || record.createdAt;
      if (typeof isoCand === 'string' && (isoCand.includes('T') || isoCand.includes(':'))) {
        const parsed = new Date(isoCand);
        if (!Number.isNaN(parsed.getTime())) {
          extracted = parsed;
        }
      }
      if (!extracted) {
        const cands = [record.id, record.parentTransactionId].filter(Boolean) as string[];
        for (const c of cands) {
          const m = c.match(/(\d{13})/);
          if (m) {
            const ms = Number(m[1]);
            if (Number.isFinite(ms) && ms >= 1577836800000 && ms <= 4102444800000) {
              extracted = new Date(ms);
              break;
            }
          }
        }
      }

      const yNum = Number(yyyy) || 2026;
      const mNum = (Number(mm) || 1) - 1;
      const dNum = Number(dd) || 1;

      if (extracted) {
        const hh = String(extracted.getHours()).padStart(2, '0');
        const min = String(extracted.getMinutes()).padStart(2, '0');
        const combined = new Date(
          yNum,
          mNum,
          dNum,
          extracted.getHours(),
          extracted.getMinutes(),
          extracted.getSeconds(),
          extracted.getMilliseconds()
        );
        return {
          formatted: `${ddmmyyyy} ${hh}:${min}`,
          timestampMs: combined.getTime(),
        };
      }

      const fallback = new Date(yNum, mNum, dNum, 12, 0, 0, 0);
      return {
        formatted: `${ddmmyyyy} 12:00`,
        timestampMs: fallback.getTime(),
      };
    };

    const buildReferenceNumber = (idStr: string, dateIso: string, desc: string): string => {
      const explicitMatch = desc.match(/(?:ref(?:erencia)?[:.\s#-]*)(\d{5,15})/i) || desc.match(/\b(\d{8,14})\b/);
      if (explicitMatch && explicitMatch[1]) {
        return explicitMatch[1];
      }
      const parts = (dateIso || '').split('-');
      const ddmmyyyy = `${parts[2] || '01'}${parts[1] || '01'}${parts[0] || '2026'}`;
      let hash = 0;
      for (let i = 0; i < idStr.length; i++) {
        hash = (hash * 31 + idStr.charCodeAt(i)) % 90000;
      }
      const prefix5 = String(Math.abs(hash) + 10000).slice(0, 5);
      return `${prefix5}${ddmmyyyy}`;
    };

    const rawEntries: Array<{
      id: string;
      rawId: string;
      sourceKind: 'txn' | 'tr' | 'sav' | 'rom';
      parentId?: string;
      date: string;
      formattedDateTime: string;
      timestampMs: number;
      reference: string;
      description: string;
      subtitle?: string;
      dcType: 'DEBITO' | 'CREDITO';
      amountNominal: number;
      signedDelta: number;
      secondaryEquiv: number;
    }> = [];

    const pendingRows: Transaction[] = [];

    // 1. Movimientos en appData.transactions
    for (const txn of appData.transactions || []) {
      const isDirectWallet = txn.walletId === wId;
      const isTargetThirdParty =
        txn.thirdPartyTargetWalletId === wId &&
        txn.thirdPartyTargetWalletId !== txn.walletId;

      if (!isDirectWallet && !isTargetThirdParty) continue;

      if (!esTransaccionCompletada(txn)) {
        pendingRows.push(txn);
        continue;
      }

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

      const amountNominal = isVesWallet ? valVes : valUsd;
      const secondaryEquiv = isVesWallet ? valUsd : valVes;

      let dcType: 'DEBITO' | 'CREDITO' = 'DEBITO';
      if (isAccumulatingWallet) {
        dcType = 'CREDITO';
      } else if (isDirectWallet) {
        dcType = txn.type === 'income' ? 'CREDITO' : 'DEBITO';
      }

      const signedDelta = dcType === 'CREDITO' ? amountNominal : -amountNominal;
      const dtInfo = formatBankDateTime24h(txn.date, txn);
      const originWalletName =
        isTargetThirdParty && txn.walletId
          ? (appData.wallets || []).find((w) => w.id === txn.walletId)?.name
          : undefined;

      rawEntries.push({
        id: `txn_${txn.id}`,
        rawId: txn.id,
        sourceKind: 'txn',
        parentId: txn.parentTransactionId,
        date: txn.date,
        formattedDateTime: dtInfo.formatted,
        timestampMs: dtInfo.timestampMs,
        reference: buildReferenceNumber(txn.id, txn.date, txn.description || ''),
        description: (txn.description || 'OPERACION REGISTRADA').toUpperCase(),
        subtitle: originWalletName
          ? `Desde ${originWalletName}`
          : undefined,
        dcType,
        amountNominal: Number(amountNominal.toFixed(2)),
        signedDelta,
        secondaryEquiv: Number(secondaryEquiv.toFixed(2)),
      });
    }

    // 2. Transferencias entre cuentas (appData.walletTransfers)
    for (const tr of appData.walletTransfers || []) {
      const isSource = tr.sourceWalletId === wId;
      const isDest = tr.destinationWalletId === wId;
      if (!isSource && !isDest) continue;

      const outAmt =
        typeof tr.amountOut === 'number' && Number.isFinite(tr.amountOut) && tr.amountOut > 0
          ? tr.amountOut
          : 0;
      const inAmt =
        typeof tr.amountIn === 'number' && Number.isFinite(tr.amountIn) && tr.amountIn > 0
          ? tr.amountIn
          : 0;
      const rateUsed =
        typeof tr.exchangeRate === 'number' && Number.isFinite(tr.exchangeRate) && tr.exchangeRate > 0
          ? tr.exchangeRate
          : activeRate;

      const srcWallet = (appData.wallets || []).find((w) => w.id === tr.sourceWalletId);
      const dstWallet = (appData.wallets || []).find((w) => w.id === tr.destinationWalletId);
      const isSrcVes = (srcWallet?.currency || tr.sourceCurrency) === 'VES';
      const isDstVes = (dstWallet?.currency || tr.destinationCurrency) === 'VES';
      const effectiveUsdRate =
        isSrcVes && isDstVes && rateUsed <= 1.05 ? activeRate : rateUsed;

      const dtInfo = formatBankDateTime24h(tr.date, tr);

      if (isSource && !isAccumulatingWallet) {
        const outVes = isSrcVes
          ? outAmt
          : !isSrcVes && !isDstVes && rateUsed <= 1.05
            ? outAmt * activeRate
            : outAmt * rateUsed;
        const outUsd = isSrcVes
          ? effectiveUsdRate > 0
            ? outAmt / effectiveUsdRate
            : 0
          : outAmt;
        const amountNominal = isVesWallet ? outVes : outUsd;
        const secondaryEquiv = isVesWallet ? outUsd : outVes;

        rawEntries.push({
          id: `tr_out_${tr.id}`,
          rawId: tr.id,
          sourceKind: 'tr',
          date: tr.date,
          formattedDateTime: dtInfo.formatted,
          timestampMs: dtInfo.timestampMs,
          reference: buildReferenceNumber(tr.id, tr.date, tr.notes || ''),
          description: (
            tr.notes?.trim()
              ? `TRANSFERENCIA A ${dstWallet?.name || 'CUENTA'} · ${tr.notes.trim()}`
              : `OPERACION TRANSFERENCIA A ${dstWallet?.name || 'CUENTA PROPIA'}`
          ).toUpperCase(),
          subtitle: `Transferencia enviada → ${dstWallet?.name || 'Otra cuenta'}`,
          dcType: 'DEBITO',
          amountNominal: Number(amountNominal.toFixed(2)),
          signedDelta: -amountNominal,
          secondaryEquiv: Number(secondaryEquiv.toFixed(2)),
        });
      }

      if (isDest) {
        const inVes = isDstVes
          ? inAmt
          : !isSrcVes && !isDstVes && rateUsed <= 1.05
            ? inAmt * activeRate
            : inAmt * rateUsed;
        const inUsd = isDstVes
          ? effectiveUsdRate > 0
            ? inAmt / effectiveUsdRate
            : 0
          : inAmt;
        const amountNominal = isVesWallet ? inVes : inUsd;
        const secondaryEquiv = isVesWallet ? inUsd : inVes;

        rawEntries.push({
          id: `tr_in_${tr.id}`,
          rawId: tr.id,
          sourceKind: 'tr',
          date: tr.date,
          formattedDateTime: dtInfo.formatted,
          timestampMs: dtInfo.timestampMs,
          reference: buildReferenceNumber(tr.id, tr.date, tr.notes || ''),
          description: (
            tr.notes?.trim()
              ? `TRANSFERENCIA RECIBIDA DE ${srcWallet?.name || 'CUENTA'} · ${tr.notes.trim()}`
              : `ABONO POR TRANSFERENCIA DESDE ${srcWallet?.name || 'CUENTA PROPIA'}`
          ).toUpperCase(),
          subtitle: `Transferencia recibida ← ${srcWallet?.name || 'Otra cuenta'}`,
          dcType: 'CREDITO',
          amountNominal: Number(amountNominal.toFixed(2)),
          signedDelta: amountNominal,
          secondaryEquiv: Number(secondaryEquiv.toFixed(2)),
        });
      }
    }

    // 3. Movimientos de Ahorro (appData.savings) en cuentas personales
    if (!isAccumulatingWallet) {
      for (const sav of appData.savings || []) {
        if (sav.walletId !== wId) continue;
        const valUsd =
          Number.isFinite(sav.amountUsd) && sav.amountUsd > 0 ? sav.amountUsd : 0;
        const rateUsed =
          sav.exchangeRateUsed && Number.isFinite(sav.exchangeRateUsed) && sav.exchangeRateUsed > 0
            ? sav.exchangeRateUsed
            : activeRate;
        const valVes =
          sav.originalCurrency === 'VES' &&
          sav.originalAmountVes != null &&
          Number.isFinite(sav.originalAmountVes) &&
          sav.originalAmountVes > 0
            ? sav.originalAmountVes
            : valUsd * rateUsed;

        const amountNominal = isVesWallet ? valVes : valUsd;
        const secondaryEquiv = isVesWallet ? valUsd : valVes;
        const isDeposit = sav.type === 'deposit';
        const dcType: 'DEBITO' | 'CREDITO' = isDeposit ? 'DEBITO' : 'CREDITO';
        const dtInfo = formatBankDateTime24h(sav.date, sav);

        rawEntries.push({
          id: `sav_${sav.id}`,
          rawId: sav.id,
          sourceKind: 'sav',
          date: sav.date,
          formattedDateTime: dtInfo.formatted,
          timestampMs: dtInfo.timestampMs,
          reference: buildReferenceNumber(
            sav.id,
            sav.date,
            sav.description || sav.notes || ''
          ),
          description: (
            sav.description?.trim()
              ? sav.description.trim()
              : isDeposit
                ? `APORTE A META DE AHORRO${sav.notes ? ` · ${sav.notes}` : ''}`
                : `RETIRO DE META DE AHORRO${sav.notes ? ` · ${sav.notes}` : ''}`
          ).toUpperCase(),
          dcType,
          amountNominal: Number(amountNominal.toFixed(2)),
          signedDelta: isDeposit ? -amountNominal : amountNominal,
          secondaryEquiv: Number(secondaryEquiv.toFixed(2)),
        });
      }

      // 4. Movimientos de Fondo de Citas (appData.romanceFund.movements)
      for (const mov of appData.romanceFund?.movements || []) {
        if (mov.walletId !== wId) continue;
        const valUsd =
          Number.isFinite(mov.amountUsd) && mov.amountUsd > 0 ? mov.amountUsd : 0;
        const rateUsed =
          mov.exchangeRate && Number.isFinite(mov.exchangeRate) && mov.exchangeRate > 0
            ? mov.exchangeRate
            : activeRate;
        const valVes =
          mov.currency === 'VES' && Number.isFinite(mov.amount) && mov.amount > 0
            ? mov.amount
            : valUsd * rateUsed;

        const amountNominal = isVesWallet ? valVes : valUsd;
        const secondaryEquiv = isVesWallet ? valUsd : valVes;
        const isAllocate = mov.type === 'allocate';
        const dcType: 'DEBITO' | 'CREDITO' = isAllocate ? 'DEBITO' : 'CREDITO';
        const dtInfo = formatBankDateTime24h(mov.date, mov);
        const movLabel = mov.planName || mov.notes || '';

        rawEntries.push({
          id: `rom_${mov.id}`,
          rawId: mov.id,
          sourceKind: 'rom',
          date: mov.date,
          formattedDateTime: dtInfo.formatted,
          timestampMs: dtInfo.timestampMs,
          reference: buildReferenceNumber(mov.id, mov.date, movLabel),
          description: (
            isAllocate
              ? `RESERVA FONDO DE CITAS · ${movLabel || 'ASIGNACION'}`
              : `LIBERACION RESERVA CITAS · ${movLabel || 'REINTEGRO'}`
          ).toUpperCase(),
          dcType,
          amountNominal: Number(amountNominal.toFixed(2)),
          signedDelta: isAllocate ? -amountNominal : amountNominal,
          secondaryEquiv: Number(secondaryEquiv.toFixed(2)),
        });
      }
    }

    // Ordenar del MÁS RECIENTE al MÁS ANTIGUO (igual que en el extracto bancario de la imagen)
    rawEntries.sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      if (a.parentId && a.parentId === b.rawId) return 1;
      if (b.parentId && b.parentId === a.rawId) return -1;
      if (b.timestampMs !== a.timestampMs) return b.timestampMs - a.timestampMs;
      return (b.id || '').localeCompare(a.id || '');
    });

    // Calcular Saldo progresivo exacto después de cada movimiento partiendo del saldo actual real de la cuenta
    let runningSaldo = isVesWallet ? wb.saldoActualVes : wb.saldoActualUsd;
    const rowsWithSaldo = rawEntries.map((entry) => {
      const saldoAfter = Number(runningSaldo.toFixed(2));
      runningSaldo = Number((runningSaldo - entry.signedDelta).toFixed(2));
      return {
        ...entry,
        saldoAfter,
      };
    });

    return {
      rows: rowsWithSaldo,
      pendingRows: pendingRows.sort((a, b) =>
        compararTransaccionesRecientesPrimero(a, b)
      ),
    };
  }, [
    selectedWalletEntry,
    appData.transactions,
    appData.walletTransfers,
    appData.savings,
    appData.romanceFund,
    appData.wallets,
    activeRate,
  ]);

  const filteredWalletStatementRows = useMemo(() => {
    const q = walletStatementSearch.trim().toLowerCase();
    return walletBankStatement.rows.filter((row) => {
      if (
        walletStatementScope === 'month' &&
        !row.date.startsWith(selectedMonth)
      ) {
        return false;
      }
      if (
        walletStatementTypeFilter !== 'all' &&
        row.dcType !== walletStatementTypeFilter
      ) {
        return false;
      }
      if (q) {
        const matchDesc = row.description.toLowerCase().includes(q);
        const matchRef = row.reference.toLowerCase().includes(q);
        const matchDate = row.formattedDateTime.toLowerCase().includes(q);
        if (!matchDesc && !matchRef && !matchDate) return false;
      }
      return true;
    });
  }, [
    walletBankStatement.rows,
    walletStatementScope,
    selectedMonth,
    walletStatementTypeFilter,
    walletStatementSearch,
  ]);

  const thirdPartyWalletIdSet = useMemo(
    () =>
      new Set(
        (appData.wallets || [])
          .filter((w) => w.isThirdPartyExpenseAccount)
          .map((w) => w.id)
      ),
    [appData.wallets]
  );

  const inactiveCount = useMemo(
    () => resumenBilleteras.filter((wb) => !wb.wallet.active).length,
    [resumenBilleteras]
  );

  return (
    <div className="space-y-6">
      {/* Cabecera limpia con Pestañas de Modo (Explorar Cuenta · Transferir · Nueva Cuenta) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)]">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Mis Cuentas y Billeteras (Wallets)
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Selecciona una cuenta para consultar su saldo bimonetario, configuración y movimientos sin saturar la vista.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-hairline)] gap-1">
            <button
              type="button"
              onClick={() => setActiveViewTab('single')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeViewTab === 'single'
                  ? 'bg-[var(--pink-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              🏦 Ver Cuenta Seleccionada
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('reorder')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeViewTab === 'reorder'
                  ? 'bg-[var(--pink-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              ↕️ Ordenar Cuentas
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('transfer')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeViewTab === 'transfer'
                  ? 'bg-[var(--pink-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              🔄 Transferir entre Cuentas
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveViewTab('form');
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeViewTab === 'form'
                  ? 'bg-[var(--pink-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {editingWallet ? '✏️ Editando Cuenta' : '+ Nueva Cuenta'}
            </button>
          </div>
        </div>
      </div>

      {/* Resumen Bimonetario Global Compacto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">
              Total en Dólares (USD)
            </span>
            <CheckCircle2 className="w-4 h-4 text-[var(--income-color)]" />
          </div>
          <div className="text-xl font-bold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(resumenMes.balanceSoloDolaresUsd, 'USD', locale)}
          </div>
          <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            ≈ {formatearMonto(resumenMes.balanceSoloDolaresUsd * activeRate, 'VES', locale)} · Cuentas: {formatearMonto(resumenMes.enCuentasDolaresUsd, 'USD', locale)} · Efectivo: {formatearMonto(resumenMes.enEfectivoDolaresUsd, 'USD', locale)}
          </div>
        </div>

        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">
              Total en Bolívares (Bs)
            </span>
            <Landmark className="w-4 h-4 text-[var(--pink-primary)]" />
          </div>
          <div className="text-xl font-bold font-mono-tabular text-[var(--pink-primary)]">
            {formatearMonto(resumenMes.balanceSoloBolivaresVes, 'VES', locale)}
          </div>
          <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            ≈{' '}
            {formatearMonto(
              activeRate > 0
                ? resumenMes.balanceSoloBolivaresVes / activeRate
                : resumenMes.balanceSoloBolivaresEquivUsd,
              'USD',
              locale
            )}{' '}
            · Cuentas: {formatearMonto(resumenMes.enCuentasBolivaresVes, 'VES', locale)}
          </div>
        </div>

        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Consolidado disponible ($ + Bs)</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--income-color)]" />
          </div>
          <div className="text-xl font-bold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(resumenMes.dineroDisponibleEstimadoUsd, 'USD', locale)}
          </div>
          <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            ≈ {formatearMonto(resumenMes.dineroDisponibleEstimadoUsd * activeRate, 'VES', locale)}
          </div>
        </div>

        <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--pink-primary)]/40 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">
              Saldo proyectado total
            </span>
            <Sparkles className="w-4 h-4 text-[var(--lavender-accent)]" />
          </div>
          <div className="text-xl font-bold font-mono-tabular text-[var(--lavender-accent)]">
            {formatearMonto(resumenMes.saldoProyectadoUsd, 'USD', locale)}
          </div>
          <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
            ≈ {formatearMonto(resumenMes.saldoProyectadoUsd * activeRate, 'VES', locale)}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VISTA DE ORDENAMIENTO PERSONALIZADO DE CUENTAS                        */}
      {/* ===================================================================== */}
      {activeViewTab === 'reorder' && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>↕️ Orden Personalizado de tus Cuentas</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Arrastra cualquier tarjeta o toca directamente el número de posición (<strong className="text-[var(--text-primary)]">1º, 2º, 3º...</strong>) para elegir cuál cuenta quieres ver primero en tu Dashboard, Cuentas, formularios de pago y Estado de Cuenta.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveViewTab('single')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors shrink-0"
            >
              ✓ Listo, volver a mis cuentas
            </button>
          </div>

          <div className="space-y-2.5">
            {resumenBilleteras.map((wb, index) => {
              const isVes = wb.wallet.currency === 'VES';
              const isThirdParty = Boolean(
                wb.wallet.isThirdPartyExpenseAccount
              );
              const isPassThrough = Boolean(wb.wallet.isPassThroughAccount);
              const shownAmt = isThirdParty
                ? isVes
                  ? wb.pasadoMesVes
                  : wb.pasadoMesUsd
                : isVes
                  ? wb.saldoActualVes
                  : wb.saldoActualUsd;
              const isDragTarget = dragOverWalletId === wb.wallet.id;
              const rankBadgeClass =
                index === 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : index === 1
                    ? 'bg-slate-400/20 text-slate-200 border-slate-400/40'
                    : index === 2
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]';

              return (
                <div
                  key={wb.wallet.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', wb.wallet.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverWalletId !== wb.wallet.id) {
                      setDragOverWalletId(wb.wallet.id);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverWalletId === wb.wallet.id) {
                      setDragOverWalletId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverWalletId(null);
                    const draggedId = e.dataTransfer.getData('text/plain');
                    moveWalletBeforeOrAfterTarget(draggedId, wb.wallet.id);
                  }}
                  className={`p-4 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-grab active:cursor-grabbing ${
                    isDragTarget
                      ? 'border-[var(--pink-primary)] bg-[var(--pink-light)]/20 scale-[1.005]'
                      : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] hover:border-[var(--pink-primary)]/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Grip & Posición actual */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-sm text-[var(--text-secondary)] select-none px-1"
                        title="Arrastra para mover"
                      >
                        ⋮⋮
                      </span>
                      <span
                        className={`w-9 h-9 rounded-xl border font-mono-tabular font-bold text-xs flex items-center justify-center ${rankBadgeClass}`}
                      >
                        {index + 1}º
                      </span>
                    </div>

                    {/* Color + Nombre + Etiquetas */}
                    <span
                      className="w-4 h-4 rounded-lg shrink-0 border border-white/25"
                      style={{ backgroundColor: wb.wallet.color }}
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {wb.wallet.name}
                        </span>
                        <span className="text-[11px] font-mono-tabular px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]">
                          {wb.wallet.currency}
                        </span>
                        {isThirdParty && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            👩‍👧 Familiar ({wb.wallet.beneficiaryName || 'Tercero'})
                          </span>
                        )}
                        {isPassThrough && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/30">
                            🤝 Puente Terceros
                          </span>
                        )}
                        {!wb.wallet.active && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-2 mt-0.5">
                        <span>{wb.wallet.banco || kindLabels[wb.wallet.type]}</span>
                        <span>·</span>
                        <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                          {isThirdParty ? 'Pasado este mes: ' : 'Saldo: '}
                          {formatearMonto(
                            shownAmt,
                            isVes ? 'VES' : 'USD',
                            locale
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Controles rápidos de posición: Botones directos 1º, 2º, 3º... + Subir/Bajar */}
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-[var(--border-divider)]">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[11px] text-[var(--text-secondary)] mr-1">
                        Poner de:
                      </span>
                      {resumenBilleteras.map((_, posIdx) => {
                        const isCurrentPos = posIdx === index;
                        return (
                          <button
                            key={posIdx}
                            type="button"
                            onClick={() =>
                              moveWalletToPosition(wb.wallet.id, posIdx, true)
                            }
                            disabled={isCurrentPos}
                            className={`w-7 h-7 rounded-lg text-[11px] font-mono-tabular font-bold border transition-all ${
                              isCurrentPos
                                ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] cursor-default'
                                : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] border-[var(--border-hairline)] cursor-pointer'
                            }`}
                            title={`Colocar "${wb.wallet.name}" en la posición ${posIdx + 1}º`}
                          >
                            {posIdx + 1}º
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          moveWalletToPosition(wb.wallet.id, index - 1, true)
                        }
                        disabled={index === 0}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] disabled:opacity-35 disabled:cursor-not-allowed"
                        title="Subir una posición"
                      >
                        ▲ Subir
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          moveWalletToPosition(wb.wallet.id, index + 1, true)
                        }
                        disabled={index === resumenBilleteras.length - 1}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] disabled:opacity-35 disabled:cursor-not-allowed"
                        title="Bajar una posición"
                      >
                        ▼ Bajar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 1: SELECTOR DE CUENTA INDIVIDUAL Y FICHA DE LA CUENTA ELEGIDA   */}
      {/* ===================================================================== */}
      {activeViewTab === 'single' && (
        <div className="space-y-6">
          {/* Barra Selectora de Cuenta */}
          <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)]">
                  Selecciona una cuenta para cargar sus datos
                </label>
                <p className="text-xs text-[var(--text-secondary)]">
                  Mostrando únicamente la información y movimientos de la cuenta activa seleccionada ({selectableWallets.length} disponible{selectableWallets.length === 1 ? '' : 's'}) · Puedes arrastrar las pestañas o tocar «↕️ Ordenar».
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveViewTab('reorder')}
                  className="px-3 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-hairline)] rounded-xl transition-colors"
                  title="Elegir qué cuenta va 1ra, 2da, 3ra..."
                >
                  ↕️ Ordenar Cuentas
                </button>

                {inactiveCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowInactiveWallets((prev) => !prev)}
                    className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-xl"
                  >
                    {showInactiveWallets
                      ? 'Ocultar inactivas'
                      : `Mostrar inactivas (${inactiveCount})`}
                  </button>
                )}

                {selectableWallets.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectableWallets.length <= 1) return;
                        const idx = selectableWallets.findIndex(
                          (w) => w.wallet.id === effectiveSelectedWalletId
                        );
                        const prevIdx =
                          (idx - 1 + selectableWallets.length) %
                          selectableWallets.length;
                        setSelectedWalletInspect(
                          selectableWallets[prevIdx].wallet.id
                        );
                      }}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                      title="Cuenta anterior"
                    >
                      ◀ Anterior
                    </button>

                    <select
                      value={effectiveSelectedWalletId}
                      onChange={(e) => setSelectedWalletInspect(e.target.value)}
                      className="px-4 py-2 text-xs font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
                    >
                      {selectableWallets.map((wb, idx) => {
                        const isV = wb.wallet.currency === 'VES';
                        const shownAmt = wb.wallet.isThirdPartyExpenseAccount
                          ? isV
                            ? wb.pasadoMesVes
                            : wb.pasadoMesUsd
                          : isV
                            ? wb.saldoActualVes
                            : wb.saldoActualUsd;
                        return (
                          <option key={wb.wallet.id} value={wb.wallet.id}>
                            {idx + 1}º {wb.wallet.name} ({wb.wallet.currency}) —{' '}
                            {formatearMonto(
                              shownAmt,
                              isV ? 'VES' : 'USD',
                              locale
                            )}
                            {!wb.wallet.active ? ' [Inactiva]' : ''}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectableWallets.length <= 1) return;
                        const idx = selectableWallets.findIndex(
                          (w) => w.wallet.id === effectiveSelectedWalletId
                        );
                        const nextIdx = (idx + 1) % selectableWallets.length;
                        setSelectedWalletInspect(
                          selectableWallets[nextIdx].wallet.id
                        );
                      }}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                      title="Siguiente cuenta"
                    >
                      Siguiente ▶
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pestañas horizontales de selección rápida (también arrastrables) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-[var(--border-divider)]">
              {selectableWallets.map((wb, idx) => {
                const isSelected = wb.wallet.id === effectiveSelectedWalletId;
                const isVes = wb.wallet.currency === 'VES';
                const bal = wb.wallet.isThirdPartyExpenseAccount
                  ? isVes
                    ? wb.pasadoMesVes
                    : wb.pasadoMesUsd
                  : isVes
                    ? wb.saldoActualVes
                    : wb.saldoActualUsd;
                return (
                  <button
                    key={wb.wallet.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', wb.wallet.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      moveWalletBeforeOrAfterTarget(draggedId, wb.wallet.id);
                    }}
                    onClick={() => setSelectedWalletInspect(wb.wallet.id)}
                    title="Haz clic para ver o arrastra para cambiar el orden"
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-2 shrink-0 border transition-all cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)] shadow-2xs'
                        : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold font-mono-tabular px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-black/20 text-white'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {idx + 1}º
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40"
                      style={{ backgroundColor: wb.wallet.color }}
                    />
                    <span className="font-semibold">{wb.wallet.name}</span>
                    <span
                      className={`text-[11px] font-mono-tabular ${
                        isSelected
                          ? 'text-white/90'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {formatearMonto(bal, isVes ? 'VES' : 'USD', locale)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ficha Completa de la Cuenta Seleccionada */}
          {selectedWalletEntry ? (
            (() => {
              const wb = selectedWalletEntry;
              const isVes = wb.wallet.currency === 'VES';
              const isThirdParty = Boolean(
                wb.wallet.isThirdPartyExpenseAccount
              );
              const isPassThrough = Boolean(wb.wallet.isPassThroughAccount);
              const primaryActual = isVes
                ? wb.saldoActualVes
                : wb.saldoActualUsd;
              const secondaryActual = isVes
                ? activeRate > 0
                  ? wb.saldoActualVes / activeRate
                  : wb.saldoActualUsd
                : wb.saldoActualUsd * activeRate;

              const primaryProjected = isVes
                ? wb.saldoProyectadoVes
                : wb.saldoProyectadoUsd;
              const secondaryProjected = isVes
                ? activeRate > 0
                  ? wb.saldoProyectadoVes / activeRate
                  : wb.saldoProyectadoUsd
                : wb.saldoProyectadoUsd * activeRate;

              const isBonusWallet =
                Boolean(wb.wallet.isBonusCard) ||
                (wb.wallet.banco || '').toLowerCase().includes('todoticket') ||
                wb.wallet.name.toLowerCase().includes('todoticket');
              const isCashWallet = esBilleteraEfectivo(wb.wallet);

              return (
                <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-6">
                  {/* Encabezado de la cuenta seleccionada + Acciones de la cuenta */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
                    <div className="flex items-start gap-3.5">
                      <span
                        className="w-5 h-5 rounded-xl shrink-0 mt-1"
                        style={{ backgroundColor: wb.wallet.color }}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-[var(--text-primary)]">
                            {wb.wallet.name}
                          </h2>
                          <span className="text-xs text-[var(--text-secondary)]">
                            · {wb.wallet.active ? 'Cuenta Activa' : 'Cuenta Inactiva'}
                          </span>
                          {isPassThrough && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-violet-500/20 px-2.5 py-0.5 text-[11px] font-bold text-violet-300 border border-violet-500/35">
                              🤝 Cuenta de Terceros / Dinero de Paso (No suma a tus ingresos)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-1.5 mt-1">
                          <span>{kindLabels[wb.wallet.type] || 'Cuenta'}</span>
                          <span>·</span>
                          <strong className="text-[var(--text-primary)]">
                            Moneda: {wb.wallet.currency}
                          </strong>
                          {wb.wallet.banco && !isCashWallet && (
                            <>
                              <span>·</span>
                              <span>🏦 Banco: {wb.wallet.banco}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>
                            {isPassThrough
                              ? `🤝 Dinero de Paso / Terceros (${wb.wallet.beneficiaryName || 'Amigos / Apps'}) — No afecta tu saldo personal`
                              : isCashWallet
                                ? '💵 Dinero en Efectivo'
                                : isBonusWallet
                                  ? '🎟️ Tarjeta de Bonos / Todoticket'
                                  : isThirdParty
                                    ? `Uso de ${wb.wallet.beneficiaryName || 'Familiar / Tercero'} (No suma a disponible)`
                                    : '🏦 En Cuenta / Digital'}
                          </span>
                        </div>
                        {wb.wallet.notes && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            Nota: {wb.wallet.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción de esta Cuenta */}
                    <div className="flex flex-wrap items-center gap-2">
                      {!isThirdParty && !isPassThrough && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onNewTransaction(wb.wallet.id, 'income')
                            }
                            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--income-color)] text-white hover:opacity-90 transition-opacity"
                          >
                            + Ingreso en esta cuenta
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onNewTransaction(wb.wallet.id, 'expense')
                            }
                            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] text-white hover:bg-[var(--pink-dark)] transition-colors"
                          >
                            + Gasto en esta cuenta
                          </button>
                        </>
                      )}

                      {!isThirdParty && !isPassThrough && !isBonusWallet && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextCash = !isCashWallet;
                            setAppData((prev) => ({
                              ...prev,
                              wallets: (prev.wallets || INITIAL_WALLETS).map(
                                (w) =>
                                  w.id === wb.wallet.id
                                    ? {
                                        ...w,
                                        isCash: nextCash,
                                        type: nextCash
                                          ? w.currency === 'VES'
                                            ? 'cash_ves'
                                            : 'cash_usd'
                                          : w.currency === 'VES'
                                            ? 'bank_ves'
                                            : 'digital_usd',
                                      }
                                    : w
                              ),
                            }));
                            showToast(
                              nextCash
                                ? `"${wb.wallet.name}" marcada como Efectivo (${wb.wallet.currency === 'VES' ? 'Bs' : '$'}).`
                                : `"${wb.wallet.name}" marcada como Cuenta Bancaria / Digital.`,
                              'info'
                            );
                          }}
                          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                            isCashWallet
                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-hairline)]'
                          }`}
                        >
                          {isCashWallet ? '💵 Es Efectivo' : 'Marcar Efectivo'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleStartEditWallet(wb)}
                        className="px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-hairline)] rounded-xl"
                      >
                        Editar cuenta
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setAppData((prev) => ({
                            ...prev,
                            wallets: (prev.wallets || INITIAL_WALLETS).map(
                              (w) =>
                                w.id === wb.wallet.id
                                  ? { ...w, active: !w.active }
                                  : w
                            ),
                          }))
                        }
                        className="px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl"
                      >
                        {wb.wallet.active ? 'Ocultar' : 'Activar'}
                      </button>
                    </div>
                  </div>

                  {/* Cuerpo de Datos de la Cuenta Seleccionada */}
                  {isPassThrough ? (
                    <div className="space-y-4">
                      {/* Detector inteligente si un movimiento en Bs se guardó como USD y se multiplicó por la tasa BCV (ej. 7,991,821.82 Bs) */}
                      {(() => {
                        const suspectTxn = walletTransactions.find(
                          (t) =>
                            (t.currency === 'USD' && t.amount > 500) ||
                            (Number(t.amountUsd) > 1000 &&
                              Number(t.amountUsd) * activeRate > 400000)
                        );
                        if (!suspectTxn) return null;
                        const rateToFix =
                          suspectTxn.exchangeRate && suspectTxn.exchangeRate > 1
                            ? suspectTxn.exchangeRate
                            : activeRate > 1
                              ? activeRate
                              : 450;
                        const realVesAmount =
                          suspectTxn.currency === 'USD' && suspectTxn.amount > 500
                            ? Number(suspectTxn.amount.toFixed(2))
                            : Number(
                                (
                                  (suspectTxn.amount ||
                                    suspectTxn.amountUsd * rateToFix) /
                                  rateToFix
                                ).toFixed(2)
                              );
                        const realUsdAmount = Number(
                          (realVesAmount / rateToFix).toFixed(2)
                        );
                        return (
                          <div className="rounded-2xl border-2 border-amber-500/60 bg-amber-500/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1 text-xs">
                              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                                ⚠️ Detectamos un monto en Bolívares que se multiplicó dos veces por la tasa BCV
                              </div>
                              <p className="text-[var(--text-primary)]">
                                El movimiento{' '}
                                <strong>«{suspectTxn.description}»</strong> tiene{' '}
                                <strong className="text-amber-300 font-mono-tabular">
                                  {formatearMonto(
                                    suspectTxn.amountUsd * rateToFix,
                                    'VES',
                                    locale
                                  )}
                                </strong>{' '}
                                porque{' '}
                                <strong className="font-mono-tabular">
                                  {formatearMonto(realVesAmount, 'VES', locale)}
                                </strong>{' '}
                                quedó registrado como Dólares ($) y se volvió a multiplicar por la tasa ({formatearTasa(rateToFix, locale)} Bs/$).
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleFixDoubleConvertedTxn(suspectTxn)
                                }
                                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs shadow-sm transition-colors whitespace-nowrap"
                              >
                                ✨ Corregir a{' '}
                                {formatearMonto(realVesAmount, 'VES', locale)} (≈{' '}
                                {formatearMonto(realUsdAmount, 'USD', locale)})
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
                            🛡️ Cuenta de Terceros / Dinero de Paso (No es tuya)
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const nextCur: CurrencyCode = isVes ? 'USD' : 'VES';
                                setAppData((prev) => ({
                                  ...prev,
                                  wallets: (prev.wallets || INITIAL_WALLETS).map((w) =>
                                    w.id === wb.wallet.id
                                      ? { ...w, currency: nextCur }
                                      : w
                                  ),
                                }));
                                showToast(
                                  `Moneda de visualización de "${wb.wallet.name}" cambiada a ${nextCur === 'VES' ? 'Bolívares (Bs)' : 'Dólares ($)'}.`,
                                  'info'
                                );
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--surface)] border border-violet-500/40 text-violet-300 hover:bg-violet-500/20"
                            >
                              🔄 Ver en {isVes ? 'Dólares ($)' : 'Bolívares (Bs)'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const nextHide = !wb.wallet.hidePassThroughHistory;
                                setAppData((prev) => ({
                                  ...prev,
                                  wallets: (prev.wallets || INITIAL_WALLETS).map((w) =>
                                    w.id === wb.wallet.id
                                      ? { ...w, hidePassThroughHistory: nextHide }
                                      : w
                                  ),
                                }));
                                showToast(
                                  nextHide
                                    ? 'Historial ocultado en esta cuenta de terceros.'
                                    : 'Historial visible en esta cuenta de terceros.',
                                  'info'
                                );
                              }}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--surface)] border border-violet-500/40 text-violet-300 hover:bg-violet-500/20"
                            >
                              {wb.wallet.hidePassThroughHistory
                                ? '👁️ Mostrar historial de esta cuenta'
                                : '🙈 No llevar / Ocultar historial'}
                            </button>

                            {confirmClearPassThroughId === wb.wallet.id ? (
                              <div className="inline-flex items-center gap-1.5 bg-red-500/15 border border-red-500/40 px-2.5 py-1 rounded-xl">
                                <span className="text-[11px] font-bold text-red-400">
                                  ¿Poner en 0 y borrar movimientos?
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleClearPassThroughWallet(
                                      wb.wallet.id,
                                      wb.wallet.name
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700"
                                >
                                  Sí, limpiar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmClearPassThroughId(null)}
                                  className="px-2 py-1 rounded-lg bg-[var(--surface)] text-[var(--text-secondary)] text-[11px] font-semibold"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmClearPassThroughId(wb.wallet.id)
                                }
                                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-500/15 border border-red-500/35 text-red-400 hover:bg-red-500/25 transition-colors"
                              >
                                🧹 Limpiar / Poner en 0
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Usa esta cuenta cuando pides dinero en una app de crédito (ej. Ubii App / Avila Pay) para un amigo o tercero y se lo pasas directo a su cuenta.{' '}
                          <strong className="text-[var(--text-primary)]">
                            Todo lo que pase por aquí NUNCA se suma a tus ingresos del mes ni a tu saldo disponible personal. Puedes editar o eliminar cualquier movimiento abajo en la tabla.
                          </strong>
                        </p>
                      </div>

                      {!wb.wallet.hidePassThroughHistory && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                            <span className="text-xs text-[var(--text-secondary)] block">
                              Dinero de terceros pasado por aquí (Referencial)
                            </span>
                            <span className="text-2xl font-bold font-mono-tabular text-violet-300 block mt-1">
                              {formatearMonto(
                                isVes
                                  ? wb.ingresosCompletadosVes
                                  : wb.ingresosCompletadosUsd,
                                isVes ? 'VES' : 'USD',
                                locale
                              )}
                            </span>
                            <span className="text-xs font-mono-tabular text-[var(--text-secondary)] block mt-0.5">
                              ≈{' '}
                              <strong className="text-[var(--text-primary)]">
                                {formatearMonto(
                                  isVes
                                    ? wb.ingresosCompletadosUsd
                                    : wb.ingresosCompletadosVes,
                                  isVes ? 'USD' : 'VES',
                                  locale
                                )}
                              </strong>
                            </span>
                            <span className="text-[11px] text-[var(--text-secondary)] block mt-1">
                              Ignorado al 100% en tu Dashboard, Ingresos y Saldo Real
                            </span>
                          </div>

                          <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                            <span className="text-xs text-[var(--text-secondary)] block">
                              Beneficiario / Uso registrado
                            </span>
                            <span className="text-lg font-bold text-[var(--text-primary)] block mt-1">
                              {wb.wallet.beneficiaryName || 'Amigos / Cuentas de Terceros'}
                            </span>
                            <span className="text-[11px] text-[var(--text-secondary)] block mt-1">
                              Operaciones registradas: {walletTransactions.length} (Puedes editarlas o borrarlas abajo)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isThirdParty ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-amber-500/30">
                          <span className="text-xs uppercase tracking-wider font-semibold text-[var(--expense-color)] block">
                            Pasado este mes ({selectedMonth.slice(5, 7)}/
                            {selectedMonth.slice(0, 4)})
                          </span>
                          <span className="text-2xl font-bold font-mono-tabular text-[var(--expense-color)] block mt-1">
                            {formatearMonto(
                              isVes ? wb.pasadoMesVes : wb.pasadoMesUsd,
                              isVes ? 'VES' : 'USD',
                              locale
                            )}
                          </span>
                          <span className="text-xs font-mono-tabular text-[var(--text-secondary)] block mt-0.5">
                            ≈{' '}
                            <strong className="text-[var(--text-primary)]">
                              {formatearMonto(
                                isVes
                                  ? wb.pasadoMesUsd
                                  : wb.pasadoMesUsd * activeRate,
                                isVes ? 'USD' : 'VES',
                                locale
                              )}
                            </strong>
                          </span>
                          <span className="text-xs text-[var(--text-secondary)] block mt-1">
                            {wb.pasadoMesCount} envíos registrados en el mes
                          </span>
                        </div>

                        <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                          <span className="text-xs uppercase tracking-wider font-bold text-amber-600 block">
                            Acumulado histórico enviado
                          </span>
                          <span className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)] block mt-1">
                            {formatearMonto(
                              isVes
                                ? wb.acumuladoHistoricoVes
                                : wb.acumuladoHistoricoUsdHistorico,
                              isVes ? 'VES' : 'USD',
                              locale
                            )}
                          </span>
                          <span className="text-xs font-mono-tabular text-[var(--income-color)] font-bold block mt-0.5">
                            ≈{' '}
                            {formatearMonto(
                              isVes
                                ? activeRate > 0
                                  ? wb.acumuladoHistoricoVes / activeRate
                                  : wb.acumuladoHistoricoUsd
                                : wb.acumuladoHistoricoUsdHistorico,
                              'USD',
                              locale
                            )}{' '}
                            USD
                          </span>
                          {isVes && (
                            <span className="text-xs font-mono-tabular text-[var(--text-secondary)] block mt-1">
                              Suma a tasa de cada envío:{' '}
                              {formatearMonto(
                                wb.acumuladoHistoricoUsdHistorico,
                                'USD',
                                locale
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[var(--surface-subtle)] border border-amber-500/40 text-xs">
                        <span className="text-[var(--text-primary)]">
                          Cuenta dedicada a registrar envíos o recargas para{' '}
                          <strong>
                            {wb.wallet.beneficiaryName || wb.wallet.name}
                          </strong>
                          .
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenThirdPartyReload(wb.wallet)}
                          className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] text-white whitespace-nowrap transition-colors"
                        >
                          + Pasar dinero / Recargar cuenta
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Tarjetas principales de la cuenta seleccionada */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                          <span className="text-xs text-[var(--text-secondary)] block">
                            Saldo actual ({isVes ? 'Bolívares' : 'Dólares'})
                          </span>
                          <span
                            className={`text-2xl font-bold font-mono-tabular block mt-1 ${
                              primaryActual >= 0
                                ? isVes
                                  ? 'text-[var(--pink-primary)]'
                                  : 'text-[var(--text-primary)]'
                                : 'text-[var(--expense-color)]'
                            }`}
                          >
                            {formatearMonto(
                              primaryActual,
                              isVes ? 'VES' : 'USD',
                              locale
                            )}
                          </span>
                          <span className="text-xs font-mono-tabular text-[var(--text-secondary)] block mt-0.5">
                            ≈{' '}
                            {formatearMonto(
                              secondaryActual,
                              isVes ? 'USD' : 'VES',
                              locale
                            )}
                          </span>
                        </div>

                        <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                          <span className="text-xs text-[var(--text-secondary)] block">
                            Saldo proyectado (con pendientes)
                          </span>
                          <span className="text-2xl font-bold font-mono-tabular text-[var(--lavender-accent)] block mt-1">
                            {formatearMonto(
                              primaryProjected,
                              isVes ? 'VES' : 'USD',
                              locale
                            )}
                          </span>
                          <span className="text-xs font-mono-tabular text-[var(--text-secondary)] block mt-0.5">
                            ≈{' '}
                            {formatearMonto(
                              secondaryProjected,
                              isVes ? 'USD' : 'VES',
                              locale
                            )}
                          </span>
                        </div>

                        <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-1.5 text-xs font-mono-tabular">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-secondary)] font-sans">
                              Saldo inicial:
                            </span>
                            <strong className="text-[var(--text-primary)]">
                              {formatearMonto(
                                wb.initialBalanceNominal,
                                isVes ? 'VES' : 'USD',
                                locale
                              )}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-secondary)] font-sans">
                              Ingresos compl.:
                            </span>
                            <strong className="text-[var(--income-color)]">
                              +
                              {formatearMonto(
                                isVes
                                  ? wb.ingresosCompletadosVes
                                  : wb.ingresosCompletadosUsd,
                                isVes ? 'VES' : 'USD',
                                locale
                              )}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-secondary)] font-sans">
                              Gastos compl.:
                            </span>
                            <strong className="text-[var(--expense-color)]">
                              -
                              {formatearMonto(
                                isVes
                                  ? wb.gastosCompletadosVes
                                  : wb.gastosCompletadosUsd,
                                isVes ? 'VES' : 'USD',
                                locale
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Comisiones y Transferencias P2P de esta cuenta */}
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--surface-subtle)]/70 border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                        <div className="flex flex-wrap items-center gap-3 font-mono-tabular">
                          <span className="font-sans font-medium text-[var(--text-primary)]">
                            Comisiones configuradas:
                          </span>
                          <span>
                            Pago Móvil:{' '}
                            <strong className="text-[var(--text-primary)]">
                              {wb.wallet.comisionPagoMovil ?? (isVes ? 0.3 : 0)}% (mín. 14 Bs)
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Transferencia:{' '}
                            <strong className="text-[var(--text-primary)]">
                              {wb.wallet.comisionTransferenciaTipo ===
                                'percent' ||
                              (wb.wallet.comisionTransferenciaTipo == null &&
                                isBonusWallet)
                                ? `${wb.wallet.comisionTransferencia ?? 1.5}%`
                                : isVes
                                  ? `${wb.wallet.comisionTransferencia != null && wb.wallet.comisionTransferencia >= 1 ? wb.wallet.comisionTransferencia : 54} Bs fija`
                                  : '0 Bs'}
                            </strong>
                          </span>
                        </div>

                        <div className="font-mono-tabular">
                          Movimientos registrados:{' '}
                          <strong className="text-[var(--text-primary)]">
                            {wb.movimientosCompletadosCount +
                              wb.movimientosPendientesCount}
                          </strong>
                        </div>
                      </div>

                      {isBonusWallet && (
                        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[var(--surface-subtle)] border border-indigo-500/40 text-xs">
                          <span className="text-[var(--text-primary)] font-medium">
                            🎟️ Acciones rápidas para Tarjeta de Bonos / Todoticket Integral
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onOpenBonusCard(wb.wallet, 'load_bonus')
                              }
                              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--surface)] hover:bg-[var(--pink-primary)]/10 text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
                            >
                              + Cargar Bono Recibido
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onOpenBonusCard(wb.wallet, 'transfer_to_bank')
                              }
                              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] text-white transition-colors"
                            >
                              💸 Pasar / Vaciar a mi Banco
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="p-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
              No hay cuentas registradas. Haz clic en «+ Nueva Cuenta» arriba para crear la primera.
            </div>
          )}

          {/* Estado de Cuenta Bancario exclusivo de la Cuenta Seleccionada */}
          {selectedWalletEntry?.wallet.isPassThroughAccount &&
          selectedWalletEntry?.wallet.hidePassThroughHistory ? (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] p-6 text-center space-y-2">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                🙈 Historial desactivado para «{selectedWalletEntry.wallet.name}»
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Elegiste no mostrar historial en esta cuenta de terceros. El dinero pasado aquí no afecta tus ingresos ni tu saldo disponible.
              </p>
            </div>
          ) : (
            <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
              {/* Encabezado Estilo Estado de Cuenta Bancario */}
              <div className="px-6 pt-6 pb-4 border-b border-[var(--border-hairline)] space-y-4">
                <div className="text-center space-y-1">
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#0066b2] dark:text-sky-400">
                    Cuenta:{' '}
                    {selectedWalletEntry?.wallet.name || 'Cuenta seleccionada'}
                    {selectedWalletEntry?.wallet.banco
                      ? ` · ${selectedWalletEntry.wallet.banco}`
                      : ''}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Estado de cuenta detallado con saldo progresivo después de cada operación ({filteredWalletStatementRows.length} movimiento{filteredWalletStatementRows.length === 1 ? '' : 's'})
                  </p>
                </div>

                {/* Barra de filtros y acciones del Estado de Cuenta de la Billetera */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Filtro Período: Todo el historial vs Solo este mes */}
                    <div className="inline-flex rounded-xl bg-[var(--surface-subtle)] p-1 border border-[var(--border-hairline)]">
                      <button
                        type="button"
                        onClick={() => setWalletStatementScope('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          walletStatementScope === 'all'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Todo el historial
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalletStatementScope('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          walletStatementScope === 'month'
                            ? 'bg-[var(--pink-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Mes ({selectedMonth})
                      </button>
                    </div>

                    {/* Filtro Débito / Crédito */}
                    <div className="inline-flex rounded-xl bg-[var(--surface-subtle)] p-1 border border-[var(--border-hairline)]">
                      <button
                        type="button"
                        onClick={() => setWalletStatementTypeFilter('all')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          walletStatementTypeFilter === 'all'
                            ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-2xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalletStatementTypeFilter('DEBITO')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          walletStatementTypeFilter === 'DEBITO'
                            ? 'bg-red-500/15 text-red-500 dark:text-rose-400'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Débitos (-)
                      </button>
                      <button
                        type="button"
                        onClick={() => setWalletStatementTypeFilter('CREDITO')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          walletStatementTypeFilter === 'CREDITO'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Créditos (+)
                      </button>
                    </div>

                    {/* Buscador por descripción o referencia */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={walletStatementSearch}
                        onChange={(e) =>
                          setWalletStatementSearch(e.target.value)
                        }
                        placeholder="Buscar descripción o ref..."
                        className="pl-8 pr-3 py-1.5 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)] w-48 sm:w-56"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none px-2.5 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                      <input
                        type="checkbox"
                        checked={showStatementEquiv}
                        onChange={(e) =>
                          setShowStatementEquiv(e.target.checked)
                        }
                        className="rounded accent-[var(--pink-primary)]"
                      />
                      <span>Ver equivalente ($/Bs)</span>
                    </label>

                    {selectedWalletEntry &&
                      !selectedWalletEntry.wallet.isPassThroughAccount && (
                        <button
                          type="button"
                          onClick={() =>
                            onNewTransaction(
                              selectedWalletEntry.wallet.id,
                              'expense'
                            )
                          }
                          className="px-3.5 py-1.5 text-xs font-semibold text-[var(--pink-primary)] bg-[var(--pink-light)] rounded-xl hover:opacity-90"
                        >
                          + Registrar movimiento
                        </button>
                      )}
                  </div>
                </div>
              </div>

              {/* Editor en línea cuando el usuario hace clic en ✏️ Editar en una fila del estado de cuenta */}
              {editingStatementRow && (
                <div className="p-4 sm:p-5 bg-violet-500/10 border-b border-violet-500/35 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-violet-300">
                      ✏️ Corregir / Editar Movimiento en Estado de Cuenta
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingStatementRow(null)}
                      className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      ✕ Cerrar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={editingStatementRow.dateInput}
                        onChange={(e) =>
                          setEditingStatementRow((prev) =>
                            prev ? { ...prev, dateInput: e.target.value } : null
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={editingStatementRow.descriptionInput}
                        onChange={(e) =>
                          setEditingStatementRow((prev) =>
                            prev
                              ? { ...prev, descriptionInput: e.target.value }
                              : null
                          )
                        }
                        className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Moneda
                      </label>
                      <select
                        value={editingStatementRow.currencyInput}
                        onChange={(e) =>
                          setEditingStatementRow((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  currencyInput: e.target.value as CurrencyCode,
                                }
                              : null
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                      >
                        <option value="VES">Bolívares (Bs)</option>
                        <option value="USD">Dólares ($)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Monto correcto ({editingStatementRow.currencyInput === 'VES' ? 'Bs' : '$'})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingStatementRow.amountInput}
                        onChange={(e) =>
                          setEditingStatementRow((prev) =>
                            prev ? { ...prev, amountInput: e.target.value } : null
                          )
                        }
                        className="w-full px-3 py-2 text-xs font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--pink-primary)] text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                        Tasa BCV (Bs/$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editingStatementRow.exchangeRateInput}
                        onChange={(e) =>
                          setEditingStatementRow((prev) =>
                            prev
                              ? { ...prev, exchangeRateInput: e.target.value }
                              : null
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {Number(editingStatementRow.amountInput) > 1000 &&
                        (Number(editingStatementRow.exchangeRateInput) ||
                          activeRate) > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const r =
                                Number(editingStatementRow.exchangeRateInput) ||
                                activeRate ||
                                450;
                              const divided = Number(
                                (
                                  Number(editingStatementRow.amountInput) / r
                                ).toFixed(2)
                              );
                              setEditingStatementRow((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      amountInput: String(divided),
                                      currencyInput: 'VES',
                                    }
                                  : null
                              );
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30"
                          >
                            💡 ¿Se multiplicó por la tasa? Dividir ÷{' '}
                            {formatearTasa(
                              Number(editingStatementRow.exchangeRateInput) ||
                                activeRate,
                              locale
                            )}{' '}
                            ={' '}
                            {(
                              Number(editingStatementRow.amountInput) /
                              (Number(editingStatementRow.exchangeRateInput) ||
                                activeRate ||
                                450)
                            ).toFixed(2)}{' '}
                            Bs
                          </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingStatementRow(null)}
                        className="px-3.5 py-2 rounded-xl border border-[var(--border-input)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditedStatementRow}
                        className="px-4 py-2 rounded-xl bg-[var(--pink-primary)] text-white text-xs font-bold hover:bg-[var(--pink-dark)] shadow-xs"
                      >
                        Guardar monto corregido
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Estado de Cuenta Bancario: Fecha | Referencia | Descripción | Débito / Crédito | Monto | Saldo | Acciones */}
              {filteredWalletStatementRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
                  No se encontraron movimientos completados para esta cuenta con el filtro actual.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border-hairline)] text-[var(--text-secondary)] font-normal">
                        <th className="py-3.5 px-5 font-medium whitespace-nowrap">
                          Fecha
                        </th>
                        <th className="py-3.5 px-5 font-medium whitespace-nowrap">
                          Referencia
                        </th>
                        <th className="py-3.5 px-5 font-medium">
                          Descripción
                        </th>
                        <th className="py-3.5 px-5 font-medium whitespace-nowrap">
                          Débito / Crédito
                        </th>
                        <th className="py-3.5 px-5 font-medium text-right whitespace-nowrap">
                          Monto
                        </th>
                        <th className="py-3.5 px-5 font-medium text-right whitespace-nowrap">
                          Saldo
                        </th>
                        <th className="py-3.5 px-4 font-medium text-right whitespace-nowrap">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-divider)]">
                      {filteredWalletStatementRows.map((row) => {
                        const isVesWallet =
                          selectedWalletEntry?.wallet.currency === 'VES';
                        const isDebit = row.dcType === 'DEBITO';
                        const isEditingThis =
                          editingStatementRow?.rowId === row.id;
                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              isEditingThis
                                ? 'bg-violet-500/15'
                                : 'hover:bg-[var(--surface-subtle)]/60'
                            }`}
                          >
                            {/* 1. Fecha (DD-MM-YYYY HH:mm) */}
                            <td className="py-4 px-5 font-mono-tabular text-[var(--text-primary)] whitespace-nowrap">
                              {row.formattedDateTime}
                            </td>

                            {/* 2. Referencia */}
                            <td className="py-4 px-5 font-mono-tabular text-[var(--text-primary)] whitespace-nowrap">
                              {row.reference}
                            </td>

                            {/* 3. Descripción */}
                            <td className="py-4 px-5 text-[var(--text-primary)] max-w-xs sm:max-w-md">
                              <div className="font-medium leading-snug">
                                {row.description}
                              </div>
                              {row.subtitle && (
                                <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                  {row.subtitle}
                                </div>
                              )}
                            </td>

                            {/* 4. Débito / Crédito */}
                            <td className="py-4 px-5 font-mono-tabular uppercase tracking-wide text-[var(--text-primary)] whitespace-nowrap">
                              {row.dcType}
                            </td>

                            {/* 5. Monto */}
                            <td
                              className={`py-4 px-5 text-right font-mono-tabular font-semibold whitespace-nowrap ${
                                isDebit
                                  ? 'text-red-500 dark:text-rose-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              <div>
                                {isDebit ? '-' : '+'}
                                {formatearMonto(
                                  row.amountNominal,
                                  isVesWallet ? 'VES' : 'USD',
                                  locale
                                )}
                                {isVesWallet ? '.' : ''}
                              </div>
                              {showStatementEquiv && (
                                <div className="text-[10px] font-normal text-[var(--text-secondary)] mt-0.5">
                                  ≈{' '}
                                  {formatearMonto(
                                    row.secondaryEquiv,
                                    isVesWallet ? 'USD' : 'VES',
                                    locale
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 6. Saldo (Saldo progresivo después del movimiento) */}
                            <td className="py-4 px-5 text-right font-mono-tabular text-[var(--text-primary)] whitespace-nowrap">
                              <div className="font-medium">
                                {formatearMonto(
                                  row.saldoAfter,
                                  isVesWallet ? 'VES' : 'USD',
                                  locale
                                )}
                                {isVesWallet ? '.' : ''}
                              </div>
                              {showStatementEquiv && activeRate > 0 && (
                                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                                  ≈{' '}
                                  {formatearMonto(
                                    isVesWallet
                                      ? row.saldoAfter / activeRate
                                      : row.saldoAfter * activeRate,
                                    isVesWallet ? 'USD' : 'VES',
                                    locale
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 7. Acciones (Editar monto / Eliminar movimiento) */}
                            <td className="py-4 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditStatementRow(row)}
                                  title="Editar monto o descripción de este movimiento"
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--surface-subtle)] hover:bg-violet-500/20 text-[var(--text-primary)] hover:text-violet-300 border border-[var(--border-hairline)] transition-colors"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStatementRow(row)}
                                  title="Eliminar este movimiento de la cuenta"
                                  className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/25 transition-colors"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Fila final de Saldo Inicial cuando se muestra todo el historial sin filtros */}
                      {walletStatementScope === 'all' &&
                        walletStatementTypeFilter === 'all' &&
                        !walletStatementSearch.trim() &&
                        selectedWalletEntry && (
                          <tr className="bg-[var(--surface-subtle)]/50 text-[var(--text-secondary)]">
                            <td className="py-3 px-5 font-mono-tabular whitespace-nowrap">
                              APERTURA
                            </td>
                            <td className="py-3 px-5 font-mono-tabular whitespace-nowrap">
                              0000000000000
                            </td>
                            <td className="py-3 px-5 font-medium">
                              SALDO INICIAL DE APERTURA DE CUENTA
                            </td>
                            <td className="py-3 px-5 font-mono-tabular">
                              APERTURA
                            </td>
                            <td className="py-3 px-5 text-right font-mono-tabular">
                              {formatearMonto(
                                selectedWalletEntry.initialBalanceNominal,
                                selectedWalletEntry.wallet.currency === 'VES'
                                  ? 'VES'
                                  : 'USD',
                                locale
                              )}
                            </td>
                            <td className="py-3 px-5 text-right font-mono-tabular font-semibold text-[var(--text-primary)]">
                              {formatearMonto(
                                selectedWalletEntry.initialBalanceNominal,
                                selectedWalletEntry.wallet.currency === 'VES'
                                  ? 'VES'
                                  : 'USD',
                                locale
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {selectedWalletEntry.initialBalanceNominal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAppData((prev) => ({
                                      ...prev,
                                      wallets: (
                                        prev.wallets || INITIAL_WALLETS
                                      ).map((w) =>
                                        w.id === selectedWalletEntry.wallet.id
                                          ? {
                                              ...w,
                                              initialBalanceUsd: 0,
                                              initialBalanceVes: 0,
                                            }
                                          : w
                                      ),
                                    }));
                                    showToast(
                                      'Saldo inicial de apertura puesto en 0,00.',
                                      'info'
                                    );
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-[var(--surface)] text-[var(--text-secondary)] hover:text-red-400 border border-[var(--border-hairline)]"
                                >
                                  Poner en 0
                                </button>
                              )}
                            </td>
                          </tr>
                        )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Si existen movimientos pendientes en esta cuenta, mostrarlos aparte sin alterar el Saldo Real */}
              {walletBankStatement.pendingRows.length > 0 && (
                <div className="p-4 border-t border-[var(--border-hairline)] bg-[var(--surface-subtle)]/40 space-y-2">
                  <div className="text-xs font-semibold text-[var(--lavender-accent)]">
                    ⏳ Compromisos pendientes programados en esta cuenta ({walletBankStatement.pendingRows.length}) — Aún no descontados del Saldo Real:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {walletBankStatement.pendingRows.map((pt) => (
                      <div
                        key={pt.id}
                        className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-between text-xs"
                      >
                        <div className="truncate pr-2">
                          <span className="font-mono-tabular text-[var(--text-secondary)] mr-2">
                            {pt.date}
                          </span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {pt.description}
                          </span>
                        </div>
                        <span className="font-mono-tabular font-semibold text-[var(--lavender-accent)] shrink-0">
                          {pt.type === 'income' ? '+' : '-'}
                          {formatearMonto(pt.amount, pt.currency, locale)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 2: TRANSFERENCIAS ENTRE CUENTAS (BAJO DEMANDA)                  */}
      {/* ===================================================================== */}
      {activeViewTab === 'transfer' && (
        <div className="space-y-4">
          <WalletTransferSection
            appData={appData}
            setAppData={setAppData}
            resumenBilleteras={resumenBilleteras}
            effectiveConversionRate={effectiveConversionRate}
            locale={locale}
            showToast={showToast}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISTA 3: FORMULARIO PARA CREAR O EDITAR BILLETERA (BAJO DEMANDA)      */}
      {/* ===================================================================== */}
      {activeViewTab === 'form' && (
        <div className="max-w-2xl mx-auto">
          <form
            onSubmit={handleSaveWallet}
            className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {editingWallet
                  ? `Editar cuenta: ${editingWallet.name}`
                  : 'Nueva billetera / cuenta'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveViewTab('single');
                }}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
              >
                ← Volver a la cuenta seleccionada
              </button>
            </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
              Nombre de la cuenta o billetera *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Tarjeta Mamá (Bs), Banco Mercantil Bs, Zelle..."
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
          </div>

          {/* Opción: Cuenta de Terceros / Dinero de Paso (Amigos / Apps de Crédito) */}
          <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/35 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isPassThroughAccount}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsPassThroughAccount(checked);
                  if (checked) {
                    setIsThirdPartyExpenseAccount(false);
                    setIsCash(false);
                    setIsBonusCard(false);
                    if (!name.trim()) {
                      setName('Cuenta de Terceros (Amigos / App)');
                    }
                    if (!beneficiaryName.trim()) {
                      setBeneficiaryName('Amigos / Terceros');
                    }
                  }
                }}
                className="mt-0.5 rounded accent-[var(--pink-primary)]"
              />
              <div className="text-xs">
                <span className="font-semibold text-violet-300 block">
                  🤝 Cuenta de Terceros / Dinero de Paso (No es mía · No suma ingresos)
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                  Ideal cuando pides $10 en una app de crédito para un amigo y se los pasas directo a su cuenta. Como ese dinero nunca pasó por tus cuentas, <strong>no te suma un ingreso que no tienes ni altera tu saldo disponible</strong>.
                </span>
              </div>
            </label>

            {isPassThroughAccount && (
              <div className="space-y-2.5 pt-1 pl-6">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-primary)] mb-1">
                    ¿Para quién es esta cuenta de paso? (Amigo / Tercero)
                  </label>
                  <input
                    type="text"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    placeholder="Ej. Amigos, Carlos, Cuenta Externa..."
                    className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={hidePassThroughHistory}
                    onChange={(e) => setHidePassThroughHistory(e.target.checked)}
                    className="rounded accent-[var(--pink-primary)]"
                  />
                  <span>
                    🙈 No mostrar historial de movimientos dentro de esta cuenta
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Opción: Cuenta de Gastos / Uso de Otra Persona (Familiar / Mamá) */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isThirdPartyExpenseAccount}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsThirdPartyExpenseAccount(checked);
                  if (checked) {
                    setIsPassThroughAccount(false);
                    if (!beneficiaryName) {
                      setBeneficiaryName('Mamá');
                    }
                  }
                }}
                className="mt-0.5 rounded accent-[var(--pink-primary)]"
              />
              <div className="text-xs">
                <span className="font-semibold text-[var(--text-primary)] block">
                  Cuenta de gastos / uso de otra persona (Familiar)
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                  Ideal para una tarjeta que le dejaste a tu mamá o familiar. El dinero que le pases entra sin pedir cuenta de origen, no suma a tu saldo disponible, no sale para otros pagos, cuenta como gasto del mes y guarda su acumulado histórico con equivalente en USD ($).
                </span>
              </div>
            </label>

            {isThirdPartyExpenseAccount && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-primary)] mb-1">
                  ¿Quién usa esta tarjeta o cuenta?
                </label>
                <input
                  type="text"
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  placeholder="Ej. Mamá, Papá, Abuela..."
                  className="w-full px-3 py-1.5 text-xs bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>
            )}
          </div>

          {/* Opción Destacada: Es Dinero en Efectivo ($ USD o Bs VES) */}
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isCash}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsCash(checked);
                  if (checked) {
                    setIsBonusCard(false);
                    setIsThirdPartyExpenseAccount(false);
                    setBanco('');
                    setComisionPagoMovilStr('0');
                    setComisionTransferenciaStr('0');
                    if (currency === 'VES') {
                      setWalletType('cash_ves');
                      if (!name || name === 'Todoticket Integral (Bs)') {
                        setName('Efectivo en Bolívares (Bs)');
                      }
                    } else {
                      setWalletType('cash_usd');
                      if (!name || name === 'Todoticket Integral (Bs)') {
                        setName('Efectivo en Dólares ($)');
                      }
                    }
                    setColor('#10B981');
                  } else {
                    setWalletType(
                      currency === 'VES' ? 'bank_ves' : 'digital_usd'
                    );
                  }
                }}
                className="mt-0.5 rounded accent-emerald-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-[var(--text-primary)] block">
                  💵 Es dinero en Efectivo (Billetes en $ o Bs)
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                  Marca esta opción si es dinero físico en efectivo. El Dashboard mostrará tu saldo separado entre <strong>En Cuentas (Bancos)</strong> y <strong>En Efectivo</strong> para que tus saldos bancarios cuadren exactos.
                </span>
              </div>
            </label>

            {isCash && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrency('VES');
                    setWalletType('cash_ves');
                    if (
                      !name ||
                      name === 'Efectivo en Dólares ($)' ||
                      name === 'Efectivo USD ($)'
                    ) {
                      setName('Efectivo en Bolívares (Bs)');
                    }
                  }}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                    currency === 'VES'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  💵 Efectivo en Bs (VES)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrency('USD');
                    setWalletType('cash_usd');
                    if (
                      !name ||
                      name === 'Efectivo en Bolívares (Bs)' ||
                      name === 'Efectivo Bs'
                    ) {
                      setName('Efectivo en Dólares ($)');
                    }
                  }}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                    currency !== 'VES'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  💵 Efectivo en Dólares ($)
                </button>
              </div>
            )}
          </div>

          {/* Opción: Tarjeta de Bonos / Beneficios de Empresa (Todoticket Integral) */}
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isBonusCard}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsBonusCard(checked);
                  if (checked) {
                    setIsThirdPartyExpenseAccount(false);
                    setIsCash(false);
                    if (!banco) setBanco('Todoticket Integral');
                    if (!name) setName('Todoticket Integral (Bs)');
                    setCurrency('VES');
                    setWalletType('bank_ves');
                    setComisionTransferenciaTipo('percent');
                    if (
                      comisionTransferenciaStr === '54' ||
                      comisionTransferenciaStr === '0.12' ||
                      comisionTransferenciaStr === '0'
                    ) {
                      setComisionTransferenciaStr('1.5');
                    }
                    setColor('#6366F1');
                  }
                }}
                className="mt-0.5 rounded accent-[var(--pink-primary)]"
              />
              <div className="text-xs">
                <span className="font-semibold text-[var(--text-primary)] block">
                  🎟️ Tarjeta de Bonos / Beneficios (Todoticket Integral)
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                  Activa los botones rápidos para <strong>Cargar Bono</strong> y <strong>Pasar / Vaciar a tu Banco</strong> (ej. Mercantil) descontando comisión en porcentaje (%) o monto fijo.
                </span>
              </div>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[var(--text-primary)]">
                Banco o entidad financiera
              </label>
              <span className="text-[10px] text-[var(--text-secondary)]">Opcional</span>
            </div>
            <input
              type="text"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              disabled={isCash}
              placeholder={
                isCash
                  ? 'No aplica (Dinero físico en Efectivo)'
                  : 'Ej. Todoticket Integral, Mercantil, Banesco...'
              }
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl disabled:opacity-50"
            />
            {/* Botones de selección rápida de banco o efectivo */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[
                {
                  name: '💵 Efectivo (Bs)',
                  rawName: '',
                  pm: '0',
                  tr: '0',
                  trTipo: 'fixed_ves' as const,
                  curr: 'VES',
                  type: 'cash_ves' as const,
                  bonus: false,
                  cash: true,
                },
                {
                  name: '💵 Efectivo ($)',
                  rawName: '',
                  pm: '0',
                  tr: '0',
                  trTipo: 'fixed_ves' as const,
                  curr: 'USD',
                  type: 'cash_usd' as const,
                  bonus: false,
                  cash: true,
                },
                {
                  name: '🎟️ Todoticket Integral',
                  rawName: 'Todoticket Integral',
                  pm: '0',
                  tr: '1.5',
                  trTipo: 'percent' as const,
                  curr: 'VES',
                  type: 'bank_ves' as const,
                  bonus: true,
                  cash: false,
                },
                {
                  name: 'Mercantil',
                  rawName: 'Mercantil',
                  pm: '0.3',
                  tr: '54',
                  trTipo: 'fixed_ves' as const,
                  curr: 'VES',
                  type: 'bank_ves' as const,
                  bonus: false,
                  cash: false,
                },
                {
                  name: 'Banco de Venezuela',
                  rawName: 'Banco de Venezuela',
                  pm: '0.3',
                  tr: '54',
                  trTipo: 'fixed_ves' as const,
                  curr: 'VES',
                  type: 'bank_ves' as const,
                  bonus: false,
                  cash: false,
                },
                {
                  name: 'Banesco',
                  rawName: 'Banesco',
                  pm: '0.3',
                  tr: '54',
                  trTipo: 'fixed_ves' as const,
                  curr: 'VES',
                  type: 'bank_ves' as const,
                  bonus: false,
                  cash: false,
                },
                {
                  name: 'BBVA Provincial',
                  rawName: 'BBVA Provincial',
                  pm: '0.3',
                  tr: '54',
                  trTipo: 'fixed_ves' as const,
                  curr: 'VES',
                  type: 'bank_ves' as const,
                  bonus: false,
                  cash: false,
                },
                {
                  name: 'Bancamiga',
                  rawName: 'Bancamiga',
                  pm: '0.3',
                  tr: '54',
                  trTipo: 'fixed_ves' as const,
                  curr: 'VES',
                  type: 'bank_ves' as const,
                  bonus: false,
                  cash: false,
                },
                {
                  name: 'BNC',
                  rawName: 'BNC',
                  pm: '0.3',
                  tr: '54',
                  trTipo: 'fixed_ves' as const,
                  curr: 'VES',
                  type: 'bank_ves' as const,
                  bonus: false,
                  cash: false,
                },
                {
                  name: 'Zelle / USD',
                  rawName: 'Zelle / USD',
                  pm: '0',
                  tr: '0',
                  trTipo: 'fixed_ves' as const,
                  curr: 'USD',
                  type: 'digital_usd' as const,
                  bonus: false,
                  cash: false,
                },
              ].map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => {
                    setBanco(b.rawName);
                    if (b.cash) {
                      setName(
                        b.curr === 'VES'
                          ? 'Efectivo en Bolívares (Bs)'
                          : 'Efectivo en Dólares ($)'
                      );
                      setColor('#10B981');
                    } else if (!name || name === banco || isCash) {
                      setName(
                        `${b.rawName} ${b.curr === 'VES' ? '(Bs)' : '(USD)'}`
                      );
                    }
                    setComisionPagoMovilStr(b.pm);
                    setComisionTransferenciaTipo(b.trTipo);
                    setComisionTransferenciaStr(b.tr);
                    setCurrency(b.curr as CurrencyCode);
                    setWalletType(b.type);
                    setIsBonusCard(b.bonus);
                    setIsCash(b.cash);
                    if (b.bonus) setColor('#6366F1');
                  }}
                  className={`px-2 py-0.5 text-[10px] rounded-lg border transition-colors ${
                    b.cash
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 font-bold'
                      : b.bonus
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 font-bold'
                        : 'bg-[var(--surface-subtle)] hover:bg-[var(--pink-primary)]/10 hover:text-[var(--pink-primary)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Tipo de cuenta
              </label>
              <select
                value={walletType}
                onChange={(e) => {
                  const nextType = e.target.value as WalletKind;
                  setWalletType(nextType);
                  if (nextType === 'cash_ves' || nextType === 'cash_usd') {
                    setIsCash(true);
                    setIsBonusCard(false);
                    setComisionPagoMovilStr('0');
                    setComisionTransferenciaStr('0');
                  } else {
                    setIsCash(false);
                  }
                  if (nextType === 'bank_ves' || nextType === 'cash_ves') {
                    setCurrency('VES');
                  } else if (
                    nextType === 'digital_usd' ||
                    nextType === 'bank_usd' ||
                    nextType === 'cash_usd'
                  ) {
                    if (currency === 'VES') setCurrency('USD');
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              >
                <option value="digital_usd">Zelle / Binance / Digital USD / USDT</option>
                <option value="bank_ves">Banco Nacional (Bs / Pago Móvil)</option>
                <option value="bank_usd">Cuenta Bancaria USD</option>
                <option value="cash_usd">💵 Efectivo USD ($)</option>
                <option value="cash_ves">💵 Efectivo Bs (VES)</option>
                <option value="other">Otra</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Moneda de la cuenta
              </label>
              <select
                value={currency}
                onChange={(e) => {
                  const nextCurr = e.target.value as CurrencyCode;
                  setCurrency(nextCurr);
                  if (isCash) {
                    setWalletType(nextCurr === 'VES' ? 'cash_ves' : 'cash_usd');
                  }
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              >
                <option value="USD">USD ($) — Dólares</option>
                <option value="VES">VES (Bs) — Bolívares</option>
                <option value="USDT">USDT — Cripto</option>
              </select>
            </div>
          </div>

          {/* Saldo inicial dinámico en la moneda nativa de la billetera (Bs o USD) con equivalente en pequeño debajo */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                {currency === 'VES'
                  ? 'Saldo inicial en Bolívares (Bs)'
                  : currency === 'USDT'
                    ? 'Saldo inicial en USDT ($)'
                    : 'Saldo inicial en Dólares (USD)'}
              </label>
              <div className="inline-flex rounded-lg bg-[var(--surface)] p-0.5 border border-[var(--border-hairline)] text-[10px]">
                <button
                  type="button"
                  onClick={() => setCurrency('VES')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    currency === 'VES'
                      ? 'bg-[var(--pink-primary)] text-white'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  En Bs
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors ${
                    currency !== 'VES'
                      ? 'bg-[var(--income-color)] text-white'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  En USD
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold font-mono-tabular text-[var(--text-secondary)]">
                {currency === 'VES' ? 'Bs' : '$'}
              </span>
              <input
                type="number"
                step="0.01"
                value={initialBalanceStr}
                onChange={(e) => setInitialBalanceStr(e.target.value)}
                placeholder={currency === 'VES' ? 'Ej. 5000.00' : 'Ej. 150.00'}
                className="w-full pl-9 pr-3 py-2 text-sm font-bold font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            {currency === 'VES' && (
              <UsdToVesHelper
                officialRate={appData.settings.lastOfficialRate}
                defaultManualRate={appData.settings.defaultExchangeRate}
                currentRate={activeRate}
                locale={locale}
                compact
                onApplyVesAmount={(vesStr) => {
                  setInitialBalanceStr(vesStr);
                }}
              />
            )}

            {/* Equivalente automático en la moneda contraria en un número más pequeño */}
            <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[var(--text-secondary)] pt-0.5">
              <span>Equivalente en {currency === 'VES' ? 'Dólares (USD)' : 'Bolívares (Bs)'}:</span>
              <strong className="text-[var(--text-primary)]">
                ≈{' '}
                {currency === 'VES'
                  ? formatearMonto(
                      activeRate > 0 ? parsedInitialNumber / activeRate : 0,
                      'USD',
                      locale
                    )
                  : formatearMonto(parsedInitialNumber * activeRate, 'VES', locale)}
              </strong>
            </div>
          </div>

          {/* Configuración de Comisiones Bancarias */}
          <div className="p-3 rounded-xl bg-[var(--surface-subtle)]/70 border border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                Comisiones bancarias
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">Automático en egresos</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  % Pago Móvil (mín. 14 Bs)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={comisionPagoMovilStr}
                    onChange={(e) => setComisionPagoMovilStr(e.target.value)}
                    placeholder="0.3"
                    className="w-full px-2.5 py-1.5 pr-7 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]">
                    %
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                    Transferencia otro banco
                  </label>
                  <div className="inline-flex rounded-md bg-[var(--surface)] p-0.5 border border-[var(--border-hairline)] text-[9px]">
                    <button
                      type="button"
                      onClick={() => {
                        setComisionTransferenciaTipo('percent');
                        if (
                          comisionTransferenciaStr === '54' ||
                          comisionTransferenciaStr === '0'
                        ) {
                          setComisionTransferenciaStr('1.5');
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        comisionTransferenciaTipo === 'percent'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setComisionTransferenciaTipo('fixed_ves');
                        if (
                          Number(comisionTransferenciaStr) < 5 &&
                          currency === 'VES'
                        ) {
                          setComisionTransferenciaStr('54');
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        comisionTransferenciaTipo === 'fixed_ves'
                          ? 'bg-[var(--pink-primary)] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      Bs
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={comisionTransferenciaStr}
                    onChange={(e) =>
                      setComisionTransferenciaStr(e.target.value)
                    }
                    placeholder={
                      comisionTransferenciaTipo === 'percent' ? '1.5' : '54.00'
                    }
                    className="w-full px-2.5 py-1.5 pr-8 text-xs font-mono-tabular bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[var(--text-secondary)]">
                    {comisionTransferenciaTipo === 'percent' ? '%' : 'Bs'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Color identificador
              </label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-9 p-1 bg-[var(--surface-subtle)] border border-[var(--border-input)] rounded-xl cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Notas opcionales
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Cuenta principal Bs..."
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setActiveViewTab('single');
              }}
              className="px-3 py-2 text-xs text-[var(--text-secondary)] border border-[var(--border-input)] rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
            >
              {editingWallet ? 'Guardar cambios' : 'Crear billetera'}
            </button>
          </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 5. MÓDULO DE PRESUPUESTO MENSUAL
 * ============================================================================ */
const BudgetsModuleView: React.FC<{
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  locale: 'es-VE' | 'en-US';
  showToast: (t: string, k?: 'success' | 'error' | 'info') => void;
}> = ({
  selectedMonth,
  setSelectedMonth,
  appData,
  setAppData,
  locale,
  showToast,
}) => {
  const expenseCategories = appData.categories.filter(
    (c) => c.type === 'expense' && c.active
  );

  const currentBudget = appData.budgets.find(
    (b) => b.monthKey === selectedMonth
  );

  const [totalLimitStr, setTotalLimitStr] = useState<string>(
    currentBudget ? String(currentBudget.totalLimitUsd) : ''
  );
  const [catLimits, setCatLimits] = useState<Record<string, string>>({});
  const [alertFilter, setAlertFilter] = useState<'all' | 'with_limit' | 'alerts_only'>('all');

  useEffect(() => {
    const found = appData.budgets.find((b) => b.monthKey === selectedMonth);
    setTotalLimitStr(
      found && found.totalLimitUsd > 0 ? String(found.totalLimitUsd) : ''
    );
    const map: Record<string, string> = {};
    for (const cat of appData.categories) {
      if (cat.type !== 'expense') continue;
      const monthSpecific = found?.categoryLimits?.[cat.id];
      if (typeof monthSpecific === 'number' && monthSpecific > 0) {
        map[cat.id] = String(monthSpecific);
      } else if (
        typeof cat.monthlyLimitUsd === 'number' &&
        cat.monthlyLimitUsd > 0
      ) {
        map[cat.id] = String(cat.monthlyLimitUsd);
      }
    }
    setCatLimits(map);
  }, [selectedMonth, appData.budgets, appData.categories]);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const numericTotal = Number(totalLimitStr.replace(',', '.')) || 0;
    const numericCatLimits: Record<string, number> = {};
    let sumCategories = 0;

    for (const [k, v] of Object.entries(catLimits)) {
      const n = Number(v.replace(',', '.'));
      if (Number.isFinite(n) && n > 0) {
        numericCatLimits[k] = n;
        sumCategories += n;
      }
    }

    const finalTotal = numericTotal > 0 ? numericTotal : sumCategories;

    const newBudget: MonthlyBudget = {
      id: `budget_${selectedMonth}`,
      monthKey: selectedMonth,
      totalLimitUsd: finalTotal,
      categoryLimits: numericCatLimits,
    };

    setAppData((prev) => {
      const exists = prev.budgets.some((b) => b.monthKey === selectedMonth);
      const nextCategories = prev.categories.map((c) => {
        if (c.type !== 'expense') return c;
        const val = numericCatLimits[c.id];
        return {
          ...c,
          monthlyLimitUsd: typeof val === 'number' && val > 0 ? val : 0,
        };
      });
      return {
        ...prev,
        categories: nextCategories,
        budgets: exists
          ? prev.budgets.map((b) =>
              b.monthKey === selectedMonth ? newBudget : b
            )
          : [newBudget, ...prev.budgets],
      };
    });

    showToast(
      `Presupuestos por categoría de ${formatearNombreMes(selectedMonth)} guardados.`,
      'success'
    );
  };

  const estadoPresupuestoCat = useMemo(
    () => calcularEstadoPresupuestoPorCategoria(appData, selectedMonth),
    [appData, selectedMonth]
  );

  const monthExpenses = appData.transactions.filter(
    (t) =>
      t.type === 'expense' &&
      t.date.slice(0, 7) === selectedMonth &&
      esTransaccionCompletada(t)
  );
  const totalSpentUsd = monthExpenses.reduce((acc, t) => acc + t.amountUsd, 0);
  const configuredTotalUsd = currentBudget
    ? currentBudget.totalLimitUsd > 0
      ? currentBudget.totalLimitUsd
      : estadoPresupuestoCat.totalPresupuestadoPorCategoriasUsd
    : estadoPresupuestoCat.totalPresupuestadoPorCategoriasUsd;
  const availableUsd = Math.max(0, configuredTotalUsd - totalSpentUsd);
  const usedPct =
    configuredTotalUsd > 0 ? (totalSpentUsd / configuredTotalUsd) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)]">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Presupuestos mensuales por categoría (USD)
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Define un monto límite mensual para cada categoría, compara el gasto real vs. el presupuesto y recibe alertas cuando superes el 80% o el 100%.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[var(--surface)] px-3 py-2 rounded-xl border border-[var(--border-input)]">
          <Calendar className="w-4 h-4 text-[var(--pink-primary)]" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
            className="text-xs font-medium text-[var(--text-primary)] bg-transparent focus:outline-none"
          />
        </div>
      </div>

      {/* Alertas activas de límites por categoría */}
      {estadoPresupuestoCat.enAlerta.length > 0 && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            estadoPresupuestoCat.excedidas.length > 0
              ? 'bg-[var(--expense-bg)] border-[var(--expense-border)] text-[var(--expense-text-dark)]'
              : 'bg-amber-500/10 border-amber-500/30 text-[var(--text-primary)]'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                estadoPresupuestoCat.excedidas.length > 0
                  ? 'text-[var(--expense-color)]'
                  : 'text-[var(--warning-color)]'
              }`}
            />
            <div className="text-xs space-y-1">
              <div className="font-semibold">
                {estadoPresupuestoCat.excedidas.length > 0
                  ? `Alerta de límite superado en ${estadoPresupuestoCat.excedidas.length} categoría(s)`
                  : `Aviso preventivo: ${estadoPresupuestoCat.preventivas.length} categoría(s) al 80% o más de su límite`}
              </div>
              <div className="opacity-90">
                {estadoPresupuestoCat.enAlerta
                  .map(
                    (it) =>
                      `${it.category.name}: ${formatearMonto(it.spentCompletedUsd, 'USD', locale)} / ${formatearMonto(it.limitUsd, 'USD', locale)} (${formatearPorcentaje(it.consumptionPct, 0, locale)})`
                  )
                  .join(' · ')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setAlertFilter((prev) =>
                prev === 'alerts_only' ? 'all' : 'alerts_only'
              )
            }
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-hairline)] shrink-0"
          >
            {alertFilter === 'alerts_only'
              ? 'Ver todas las categorías'
              : 'Filtrar en alerta'}
          </button>
        </div>
      )}

      {/* Resumen general del presupuesto del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Presupuesto planificado</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--text-primary)] mt-1">
            {formatearMonto(configuredTotalUsd, 'USD', locale)}
          </div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Gastado en el mes</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--expense-color)] mt-1">
            {formatearMonto(totalSpentUsd, 'USD', locale)}
          </div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Disponible del presupuesto</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--income-color)] mt-1">
            {formatearMonto(availableUsd, 'USD', locale)}
          </div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Porcentaje utilizado</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--lavender-accent)] mt-1">
            {formatearPorcentaje(usedPct, 1, locale)}
          </div>
        </div>
      </div>

      {/* Formulario de configuración y estado por categoría */}
      <form
        onSubmit={handleSaveBudget}
        className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[var(--border-hairline)]">
          <div className="w-full sm:max-w-xs">
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
              Presupuesto mensual total para {formatearNombreMes(selectedMonth)} (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={totalLimitStr}
              onChange={(e) => setTotalLimitStr(e.target.value)}
              placeholder="Opcional (o suma automática de categorías)"
              className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'with_limit', label: 'Con límite' },
                {
                  id: 'alerts_only',
                  label: `En alerta (${estadoPresupuestoCat.enAlerta.length})`,
                },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAlertFilter(f.id)}
                className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                  alertFilter === f.id
                    ? 'bg-[var(--lavender-accent)] text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors whitespace-nowrap"
            >
              Guardar límites de categorías
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
            Límites mensuales, porcentaje de consumo y alertas por categoría
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Asigna el monto límite mensual en USD para cada categoría. Se muestra el porcentaje de consumo real y una alerta preventiva al llegar al 80% o roja al superar el 100%.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {expenseCategories
              .filter((cat) => {
                const limitVal =
                  Number((catLimits[cat.id] || '0').replace(',', '.')) || 0;
                const spentCat = monthExpenses
                  .filter((t) => t.categoryId === cat.id)
                  .reduce((acc, t) => acc + t.amountUsd, 0);
                const pctCat = limitVal > 0 ? (spentCat / limitVal) * 100 : 0;
                if (alertFilter === 'with_limit') return limitVal > 0;
                if (alertFilter === 'alerts_only')
                  return limitVal > 0 && pctCat >= 80;
                return true;
              })
              .map((cat) => {
                const limitVal =
                  Number((catLimits[cat.id] || '0').replace(',', '.')) || 0;
                const spentCat = monthExpenses
                  .filter((t) => t.categoryId === cat.id)
                  .reduce((acc, t) => acc + t.amountUsd, 0);
                const remCat = Math.max(0, limitVal - spentCat);
                const exceededCat =
                  limitVal > 0 ? Math.max(0, spentCat - limitVal) : 0;
                const pctCat = limitVal > 0 ? (spentCat / limitVal) * 100 : 0;

                const isExceeded = limitVal > 0 && spentCat > limitVal + 0.001;
                const isWarning = !isExceeded && limitVal > 0 && pctCat >= 80;

                const barColor = isExceeded
                  ? 'var(--expense-color)'
                  : isWarning
                    ? 'var(--warning-color)'
                    : 'var(--income-color)';

                return (
                  <div
                    key={cat.id}
                    className={`p-4 rounded-xl border space-y-3 transition-colors ${
                      isExceeded
                        ? 'bg-[var(--expense-bg)]/35 border-[var(--expense-border)]'
                        : isWarning
                          ? 'bg-amber-500/5 border-amber-500/40'
                          : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {cat.name}
                        </span>
                        {limitVal > 0 && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular font-semibold shrink-0 ${
                              isExceeded
                                ? 'bg-[var(--expense-bg)] text-[var(--expense-color)]'
                                : isWarning
                                  ? 'bg-amber-500/15 text-[var(--warning-color)]'
                                  : 'bg-[var(--income-bg)] text-[var(--income-color)]'
                            }`}
                          >
                            {isExceeded
                              ? `¡Límite excedido! (${formatearPorcentaje(pctCat, 0, locale)})`
                              : isWarning
                                ? `Alerta ≥80% (${formatearPorcentaje(pctCat, 0, locale)})`
                                : `${formatearPorcentaje(pctCat, 0, locale)} consumido`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Límite $:
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={catLimits[cat.id] || ''}
                          onChange={(e) =>
                            setCatLimits((prev) => ({
                              ...prev,
                              [cat.id]: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="w-24 px-2.5 py-1 text-xs font-mono-tabular text-right bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-lg focus:outline-none focus:border-[var(--pink-primary)]"
                        />
                      </div>
                    </div>

                    {limitVal > 0 ? (
                      <>
                        <div className="w-full h-2.5 bg-[var(--surface)] rounded-full overflow-hidden border border-[var(--border-hairline)]">
                          <div
                            style={{
                              width: `${Math.min(100, pctCat)}%`,
                              backgroundColor: barColor,
                            }}
                            className="h-full rounded-full transition-all"
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono-tabular gap-2">
                          <span>
                            Gasto real:{' '}
                            <strong className="text-[var(--text-primary)]">
                              {formatearMonto(spentCat, 'USD', locale)}
                            </strong>{' '}
                            de {formatearMonto(limitVal, 'USD', locale)}
                          </span>
                          {exceededCat > 0 ? (
                            <span className="text-[var(--expense-color)] font-semibold">
                              Excedido por +{formatearMonto(exceededCat, 'USD', locale)}
                            </span>
                          ) : (
                            <span className="text-[var(--income-color)] font-medium">
                              Disponible: {formatearMonto(remCat, 'USD', locale)}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono-tabular">
                        <span>
                          Gasto real del mes:{' '}
                          <strong className="text-[var(--text-primary)]">
                            {formatearMonto(spentCat, 'USD', locale)}
                          </strong>
                        </span>
                        <span>Sin límite asignado</span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </form>

      {/* Histórico de presupuestos anteriores */}
      {appData.budgets.length > 0 && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-hairline)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Histórico de presupuestos mensuales
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[var(--text-secondary)]">
                  <th className="py-3 px-4">Periodo</th>
                  <th className="py-3 px-4 text-right">Presupuesto (USD)</th>
                  <th className="py-3 px-4 text-right">Gasto real (USD)</th>
                  <th className="py-3 px-4 text-right">Disponible / Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-divider)]">
                {[...appData.budgets]
                  .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
                  .map((b) => {
                    const spent = appData.transactions
                      .filter(
                        (t) =>
                          t.type === 'expense' &&
                          t.date.slice(0, 7) === b.monthKey &&
                          esTransaccionCompletada(t)
                      )
                      .reduce((acc, t) => acc + t.amountUsd, 0);
                    const pct =
                      b.totalLimitUsd > 0 ? (spent / b.totalLimitUsd) * 100 : 0;

                    return (
                      <tr key={b.id} className="hover:bg-[var(--surface-subtle)]/50">
                        <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                          {formatearNombreMes(b.monthKey)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {formatearMonto(b.totalLimitUsd, 'USD', locale)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-[var(--expense-color)]">
                          {formatearMonto(spent, 'USD', locale)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {formatearPorcentaje(pct, 1, locale)} utilizado
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedMonth(b.monthKey)}
                            className="text-[var(--pink-primary)] underline hover:text-[var(--pink-dark)]"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 6. MÓDULO DE AHORROS PERSONALES
 * ============================================================================ */
const SavingsModuleView: React.FC<{
  appData: AppDataSchema;
  resumenMes: ReturnType<typeof calcularResumenFinanciero>;
  locale: 'es-VE' | 'en-US';
  onAddSavings: () => void;
  onEditSavings: (mov: SavingsMovement) => void;
  onDeleteSavings: (mov: SavingsMovement) => void;
}> = ({
  appData,
  resumenMes,
  locale,
  onAddSavings,
  onEditSavings,
  onDeleteSavings,
}) => {
  const [catFilter, setCatFilter] = useState('all');

  // Estados de la calculadora simple de ahorro en el panel lateral derecho
  const [monthlySaveStr, setMonthlySaveStr] = useState<string>('100');
  const [monthsCount, setMonthsCount] = useState<number>(6);

  const monthlySaveAmount = useMemo(() => {
    const parsed = Number(monthlySaveStr.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [monthlySaveStr]);

  const projectedSavedUsd = monthlySaveAmount * monthsCount;
  const projectedWithCurrentSavingsUsd =
    resumenMes.totalAhorradoUsd + projectedSavedUsd;

  const effectiveRate =
    appData.settings.lastOfficialRate ||
    appData.settings.defaultExchangeRate ||
    null;

  const totalDeposits = appData.savings
    .filter((s) => s.type === 'deposit')
    .reduce((a, b) => a + b.amountUsd, 0);
  const totalWithdrawals = appData.savings
    .filter((s) => s.type === 'withdrawal')
    .reduce((a, b) => a + b.amountUsd, 0);

  const filteredSavings = appData.savings
    .filter((s) => catFilter === 'all' || s.categoryId === catFilter)
    .sort((a, b) => compararRegistrosConHoraRecientesPrimero(a, b));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)]">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Mis ahorros personales (USD)
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Registra aportes, retiros y ajustes justificados. Los aportes trasladan dinero disponible a tu fondo de ahorro sin duplicar ingresos ni gastos.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddSavings}
          className="px-4 py-2.5 text-xs font-medium text-white bg-[var(--lavender-accent)] hover:bg-[var(--lavender-dark)] rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          + Registrar movimiento de ahorro
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Saldo total ahorrado</span>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--lavender-accent)] mt-1">
            {formatearMonto(resumenMes.totalAhorradoUsd, 'USD', locale)}
          </div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Total aportes históricos</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--income-color)] mt-1">
            +{formatearMonto(totalDeposits, 'USD', locale)}
          </div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Total retiros históricos</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--expense-color)] mt-1">
            -{formatearMonto(totalWithdrawals, 'USD', locale)}
          </div>
        </div>
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Dinero disponible actual</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--text-primary)] mt-1">
            {formatearMonto(
              resumenMes.dineroDisponibleEstimadoUsd,
              'USD',
              locale
            )}
          </div>
        </div>
      </div>

      {/* Contenedor Principal: Historial a la izquierda y Calculadora de Ahorro a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Historial de movimientos de ahorro */}
        <div className="lg:col-span-8 bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Historial de movimientos de ahorro
            </h3>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            >
              <option value="all">Todas las categorías de ahorro</option>
              {appData.categories
                .filter((c) => c.type === 'savings')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {filteredSavings.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-secondary)]">
              Aún no hay movimientos de ahorro registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[var(--text-secondary)]">
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Descripción y origen</th>
                    <th className="py-3 px-4">Categoría · Meta</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Importe (USD)</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-divider)]">
                  {filteredSavings.map((sav) => {
                    const cat = appData.categories.find(
                      (c) => c.id === sav.categoryId
                    );
                    const goal = appData.savingsGoals.find(
                      (g) => g.id === sav.goalId
                    );
                    const savTime = obtenerInfoHoraProcesoTransaccion(sav, locale);
                    return (
                      <tr key={sav.id} className="hover:bg-[var(--surface-subtle)]/50">
                        <td className="py-3 px-4 font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                          <div className="font-semibold text-[var(--text-primary)]">
                            {sav.date}
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            Hora: {savTime.timeFormatted}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-[var(--text-primary)]">
                            {sav.description}
                          </div>
                          {sav.originalCurrency === 'VES' &&
                            sav.originalAmountVes &&
                            sav.exchangeRateUsed && (
                              <div className="text-[11px] text-[var(--text-secondary)] font-mono-tabular">
                                Convertido desde{' '}
                                {formatearMonto(
                                  sav.originalAmountVes,
                                  'VES',
                                  locale
                                )}{' '}
                                a tasa {formatearTasa(sav.exchangeRateUsed, locale)} Bs
                              </div>
                            )}
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)]">
                          <span>{cat?.name || 'Ahorro'}</span>
                          {goal && (
                            <>
                              <span> · </span>
                              <span className="text-[var(--lavender-accent)] font-medium">
                                Meta: {goal.name}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {sav.type === 'deposit' && (
                            <span className="text-[var(--income-color)] font-medium">
                              Aporte (+)
                            </span>
                          )}
                          {sav.type === 'withdrawal' && (
                            <span className="text-[var(--expense-color)] font-medium">
                              Retiro (-)
                            </span>
                          )}
                          {sav.type === 'adjustment' && (
                            <span className="text-[var(--rose-gold)] font-medium">
                              Ajuste ({sav.adjustmentDirection === 'subtract' ? '-' : '+'})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[var(--text-primary)] whitespace-nowrap">
                          {sav.type === 'withdrawal' ||
                          (sav.type === 'adjustment' &&
                            sav.adjustmentDirection === 'subtract')
                            ? '-'
                            : '+'}
                          {formatearMonto(sav.amountUsd, 'USD', locale)}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onEditSavings(sav)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSavings(sav)}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Columna Lateral Derecha: Calculadora Simple de Ahorro por Meses */}
        <aside className="lg:col-span-4 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Calculadora de ahorro
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Escribe cuánto quieres reunir al mes y desliza la barra de meses.
              </p>
            </div>
          </div>

          {/* 1. Tipear el monto mensual */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text-primary)]">
              Monto a reunir por mes (USD $)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm font-semibold font-mono-tabular text-[var(--text-secondary)]">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlySaveStr}
                onChange={(e) => setMonthlySaveStr(e.target.value)}
                placeholder="Ej. 100"
                className="w-full pl-8 pr-3 py-2 text-base font-semibold font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[25, 50, 100, 200, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMonthlySaveStr(String(preset))}
                  className={`px-2.5 py-1 text-[11px] font-mono-tabular font-medium rounded-lg transition-colors ${
                    monthlySaveAmount === preset
                      ? 'bg-[var(--pink-primary)] text-white'
                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Barrita deslizable (slider) para rodar la cantidad de meses */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Cantidad de meses
              </label>
              <span className="px-2.5 py-0.5 rounded-lg bg-[var(--lavender-soft)] text-[var(--lavender-text)] text-xs font-bold font-mono-tabular">
                {monthsCount} {monthsCount === 1 ? 'mes' : 'meses'}
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={36}
              step={1}
              value={monthsCount}
              onChange={(e) => setMonthsCount(Number(e.target.value))}
              className="w-full h-2 bg-[var(--surface-subtle)] rounded-lg appearance-none cursor-pointer accent-[var(--pink-primary)]"
            />

            <div className="flex items-center justify-between text-[10px] font-mono-tabular text-[var(--text-secondary)]">
              <span>1 mes</span>
              <span>6m</span>
              <span>12m (1 año)</span>
              <span>24m</span>
              <span>36m</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[3, 6, 12, 24].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonthsCount(m)}
                  className={`py-1 text-[11px] font-mono-tabular font-medium rounded-lg transition-colors ${
                    monthsCount === m
                      ? 'bg-[var(--lavender-accent)] text-white'
                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]'
                  }`}
                >
                  {m} meses
                </button>
              ))}
            </div>
          </div>

          {/* 3. Resultado del cálculo (Monto × Meses) */}
          <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-secondary)] block">
                En{' '}
                <strong className="text-[var(--text-primary)]">
                  {monthsCount} {monthsCount === 1 ? 'mes' : 'meses'}
                </strong>{' '}
                reunirás:
              </span>
              <div className="text-2xl font-bold font-mono-tabular text-[var(--pink-primary)]">
                {formatearMonto(projectedSavedUsd, 'USD', locale)}
              </div>
              <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                Cálculo: {formatearMonto(monthlySaveAmount, 'USD', locale)} ×{' '}
                {monthsCount} {monthsCount === 1 ? 'mes' : 'meses'}
              </div>
              {effectiveRate && effectiveRate > 0 && projectedSavedUsd > 0 && (
                <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
                  ≈{' '}
                  {formatearMonto(
                    projectedSavedUsd * effectiveRate,
                    'VES',
                    locale
                  )}
                </div>
              )}
            </div>

            <div className="pt-2.5 border-t border-[var(--border-divider)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">
                Sumado a tu ahorro actual:
              </span>
              <strong className="font-mono-tabular text-[var(--income-color)]">
                {formatearMonto(projectedWithCurrentSavingsUsd, 'USD', locale)}
              </strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

/* ============================================================================
 * 7. MÓDULO DE METAS DE AHORRO
 * ============================================================================ */
const GoalsModuleView: React.FC<{
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  locale: 'es-VE' | 'en-US';
  onAddGoal: () => void;
  onEditGoal: (goal: SavingsGoal) => void;
  onContributeToGoal: () => void;
  setConfirmDialog: React.Dispatch<
    React.SetStateAction<{
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    } | null>
  >;
  showToast: (t: string, k?: 'success' | 'error' | 'info') => void;
}> = ({
  appData,
  setAppData,
  locale,
  onAddGoal,
  onEditGoal,
  onContributeToGoal,
  setConfirmDialog,
  showToast,
}) => {
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'completed' | 'archived'
  >('all');

  const goalsFiltered = appData.savingsGoals.filter(
    (g) => statusFilter === 'all' || g.status === statusFilter
  );

  const toggleGoalStatus = (
    goal: SavingsGoal,
    nextStatus: 'active' | 'completed' | 'archived'
  ) => {
    setAppData((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map((g) =>
        g.id === goal.id ? { ...g, status: nextStatus } : g
      ),
    }));
    showToast(`Estado de la meta actualizado a ${nextStatus}.`, 'info');
  };

  const handleDeleteGoal = (goal: SavingsGoal) => {
    setConfirmDialog({
      title: 'Eliminar meta de ahorro',
      message: `¿Deseas eliminar la meta "${goal.name}"? Los movimientos de ahorro asociados conservarán su saldo en tu fondo general.`,
      confirmLabel: 'Eliminar meta',
      danger: true,
      onConfirm: () => {
        setAppData((prev) => ({
          ...prev,
          savingsGoals: prev.savingsGoals.filter((g) => g.id !== goal.id),
          savings: prev.savings.map((s) =>
            s.goalId === goal.id ? { ...s, goalId: null } : s
          ),
        }));
        setConfirmDialog(null);
        showToast('Meta eliminada.', 'info');
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)]">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Metas de ahorro personales
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Visualiza el progreso hacia tus sueños y proyectos. Cada aporte suma desde tus movimientos de ahorro sin duplicar saldos.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onContributeToGoal}
            className="px-4 py-2 text-xs font-medium text-[var(--lavender-text)] bg-[var(--lavender-soft)] hover:opacity-90 rounded-xl transition-opacity whitespace-nowrap"
          >
            + Abonar a una meta
          </button>
          <button
            type="button"
            onClick={onAddGoal}
            className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors whitespace-nowrap"
          >
            + Crear meta
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(
          [
            { id: 'all', label: 'Todas' },
            { id: 'active', label: 'Activas' },
            { id: 'completed', label: 'Completadas' },
            { id: 'archived', label: 'Archivadas' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-colors ${
              statusFilter === tab.id
                ? 'bg-[var(--pink-primary)] text-white'
                : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {goalsFiltered.length === 0 ? (
        <div className="bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border-hairline)] text-center space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            No hay metas de ahorro en esta vista.
          </p>
          <button
            type="button"
            onClick={onAddGoal}
            className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] rounded-xl"
          >
            Crear mi primera meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goalsFiltered.map((goal) => {
            const prog = calcularProgresoMeta(goal, appData.savings);
            const isCompleted =
              goal.status === 'completed' || prog.porcentaje >= 100;

            return (
              <div
                key={goal.id}
                className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                      {goal.name}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditGoal(goal)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title="Editar meta"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(goal)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                        title="Eliminar meta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-xs text-[var(--text-secondary)]">
                      {goal.description}
                    </p>
                  )}

                  {isCompleted && (
                    <div className="p-2.5 rounded-xl bg-[var(--income-bg)] border border-[var(--income-color)]/30 text-xs text-[var(--income-color)] flex items-center gap-2">
                      <Award className="w-4 h-4 shrink-0" />
                      <span>¡Meta alcanzada con éxito!</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono-tabular text-[var(--text-primary)]">
                      {formatearMonto(prog.ahorradoUsd, 'USD', locale)}
                    </span>
                    <span className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                      de {formatearMonto(goal.targetAmountUsd, 'USD', locale)} (
                      {formatearPorcentaje(prog.porcentaje, 1, locale)})
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-[var(--pink-light)] rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${prog.porcentaje}%`,
                        backgroundColor: goal.color || 'var(--pink-primary)',
                      }}
                      className="h-full rounded-full transition-all duration-150"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] pt-1">
                    <span>
                      Restante:{' '}
                      <strong className="font-mono-tabular text-[var(--text-primary)]">
                        {formatearMonto(prog.restanteUsd, 'USD', locale)}
                      </strong>
                    </span>
                    {goal.targetDate && (
                      <span>Fecha meta: {goal.targetDate}</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>
                    Estado:{' '}
                    <strong className="text-[var(--text-primary)]">
                      {goal.status === 'active'
                        ? 'Activa'
                        : goal.status === 'completed'
                          ? 'Completada'
                          : 'Archivada'}
                    </strong>
                  </span>
                  <div className="flex items-center gap-2">
                    {goal.status !== 'archived' ? (
                      <button
                        type="button"
                        onClick={() => toggleGoalStatus(goal, 'archived')}
                        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
                      >
                        Archivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleGoalStatus(goal, 'active')}
                        className="text-[var(--pink-primary)] hover:text-[var(--pink-dark)] underline"
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 8. MÓDULO DE PRÉSTAMOS OTORGADOS (Dinero que presté · Cuentas por cobrar)
 * ============================================================================ */
const DebtsModuleView: React.FC<{
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  officialRate: number | null;
  locale: 'es-VE' | 'en-US';
  setConfirmDialog: React.Dispatch<
    React.SetStateAction<{
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    } | null>
  >;
  showToast: (t: string, k?: 'success' | 'error' | 'info') => void;
}> = ({
  appData,
  setAppData,
  officialRate,
  locale,
  setConfirmDialog,
  showToast,
}) => {
  const activeWallets = (appData.wallets || INITIAL_WALLETS).filter(
    (w) => w.active && !w.isThirdPartyExpenseAccount
  );
  const allWallets = appData.wallets || INITIAL_WALLETS;
  const effectiveRate =
    officialRate || appData.settings.defaultExchangeRate || null;

  // Saldos actuales por billetera para mostrar cuánto hay disponible al elegir de qué wallet sale el préstamo
  const resumenBilleteras = useMemo(
    () => calcularResumenBilleteras(appData),
    [appData]
  );
  const getWalletBalanceUsd = (wId: string): number => {
    const found = resumenBilleteras.billeteras.find(
      (b) => b.wallet.id === wId
    );
    return found ? found.saldoActualUsd : 0;
  };

  const todayIso = obtenerFechaLocalIso();

  // Estado del formulario para registrar un nuevo préstamo que yo hice
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState<string>(
    activeWallets[0]?.id || 'wallet_zelle'
  );
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [amountStr, setAmountStr] = useState('');
  const [rateStr, setRateStr] = useState(
    effectiveRate ? String(effectiveRate) : ''
  );
  const [loanDate, setLoanDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState('');
  const [initialStatus, setInitialStatus] = useState<'pending' | 'paid'>(
    'pending'
  );
  const [deductFromWalletNow, setDeductFromWalletNow] = useState(true);
  const [notes, setNotes] = useState('');

  // Filtros de visualización
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>(
    'all'
  );
  const [walletFilter, setWalletFilter] = useState<string>('all');

  // Modal para registrar cómo y cuándo me pagan un préstamo
  const [payingLoan, setPayingLoan] = useState<Debt | null>(null);
  const [payCurrency, setPayCurrency] = useState<CurrencyCode>('USD');
  const [payAmountStr, setPayAmountStr] = useState('');
  const [payRateStr, setPayRateStr] = useState(
    effectiveRate ? String(effectiveRate) : ''
  );
  const [payDate, setPayDate] = useState(todayIso);
  const [payTargetWalletId, setPayTargetWalletId] = useState<string>(
    activeWallets[0]?.id || 'wallet_zelle'
  );
  const [payMethod, setPayMethod] = useState<string>('Zelle');
  const [payNotes, setPayNotes] = useState<string>('');
  const [recordAsIncomeInWallet, setRecordAsIncomeInWallet] =
    useState<boolean>(true);

  useEffect(() => {
    if (!rateStr && effectiveRate) {
      setRateStr(String(effectiveRate));
    }
    if (!payRateStr && effectiveRate) {
      setPayRateStr(String(effectiveRate));
    }
  }, [effectiveRate, rateStr, payRateStr]);

  const resumenPrestamos = useMemo(
    () => calcularResumenPrestamos(appData.debts),
    [appData.debts]
  );

  const getWalletById = (id?: string) =>
    allWallets.find((w) => w.id === id);

  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amountStr.replace(',', '.'));
    const parsedRate = Number(rateStr.replace(',', '.')) || effectiveRate || 0;
    const rate = currency === 'VES' ? parsedRate : null;

    if (
      !personName.trim() ||
      !description.trim() ||
      !Number.isFinite(amt) ||
      amt <= 0
    ) {
      showToast(
        'Indica a quién le prestaste, el concepto y un monto mayor que cero.',
        'error'
      );
      return;
    }

    if (currency === 'VES' && (!rate || rate <= 0)) {
      showToast(
        'Indica una tasa de cambio válida para el préstamo en bolívares.',
        'error'
      );
      return;
    }

    const totalUsd =
      currency === 'USD' ? amt : calcularEquivalenteUsd(amt, 'VES', rate);

    const selectedWallet = getWalletById(sourceWalletId);
    const shouldCreateDisbursementTxn =
      deductFromWalletNow && initialStatus === 'pending';
    const initialTxnId = shouldCreateDisbursementTxn
      ? `txn_loan_out_${Date.now()}`
      : null;

    const initialPayments: DebtPayment[] =
      initialStatus === 'paid'
        ? [
            {
              id: `pay_init_${Date.now()}`,
              date: loanDate || todayIso,
              amount: amt,
              currency,
              exchangeRate: rate,
              amountUsd: totalUsd,
              walletId: sourceWalletId,
              paymentMethod: selectedWallet?.name || 'Pago directo',
              linkedTransactionId: null,
              notes: 'Registrado inicialmente como préstamo ya cobrado',
            },
          ]
        : [];

    const newLoan: Debt = {
      id: `loan_${Date.now()}`,
      kind: 'receivable',
      creditor: personName.trim(),
      description: description.trim(),
      totalAmount: amt,
      currency,
      exchangeRate: rate,
      totalAmountUsd: totalUsd,
      loanDate: loanDate || todayIso,
      dueDate: dueDate || null,
      walletId: sourceWalletId,
      initialTransactionId: initialTxnId,
      payments: initialPayments,
      notes: notes.trim(),
      status: initialStatus,
    };

    setAppData((prev) => {
      let nextTransactions = prev.transactions;
      if (shouldCreateDisbursementTxn && initialTxnId) {
        const disbursementTxn: Transaction = {
          id: initialTxnId,
          date: loanDate || todayIso,
          type: 'expense',
          status: 'completed',
          walletId: sourceWalletId,
          description: `Préstamo entregado a ${personName.trim()}: ${description.trim()}`,
          categoryId: 'cat_exp_other',
          amount: amt,
          currency,
          exchangeRate: rate,
          amountUsd: totalUsd,
          exchangeRateSource:
            currency === 'USD'
              ? 'none'
              : officialRate && Math.abs((rate || 0) - officialRate) < 0.01
                ? 'bcv'
                : 'manual',
          paymentMethod: selectedWallet?.name || 'Billetera',
          expenseType: 'variable',
          notes: `Dinero sacado de ${selectedWallet?.name || 'billetera'} para préstamo a ${personName.trim()}`,
        };
        nextTransactions = [disbursementTxn, ...prev.transactions];
      }

      return {
        ...prev,
        debts: [newLoan, ...prev.debts],
        transactions: nextTransactions,
      };
    });

    setPersonName('');
    setDescription('');
    setAmountStr('');
    setDueDate('');
    setNotes('');
    setInitialStatus('pending');
    showToast(
      shouldCreateDisbursementTxn
        ? `Préstamo a ${personName.trim()} registrado y descontado de ${selectedWallet?.name || 'tu billetera'}.`
        : `Préstamo a ${personName.trim()} guardado correctamente.`,
      'success'
    );
  };

  const openPaymentModal = (loan: Debt) => {
    const st = calcularEstadoDeuda(loan);
    setPayingLoan(loan);
    setPayCurrency('USD');
    setPayAmountStr(st.pendienteUsd > 0 ? String(st.pendienteUsd) : '');
    setPayRateStr(
      effectiveRate
        ? String(effectiveRate)
        : loan.exchangeRate
          ? String(loan.exchangeRate)
          : ''
    );
    setPayDate(obtenerFechaLocalIso());
    const defaultWallet =
      loan.walletId || activeWallets[0]?.id || 'wallet_zelle';
    setPayTargetWalletId(defaultWallet);
    const wObj = getWalletById(defaultWallet);
    setPayMethod(wObj?.name || 'Zelle');
    setPayNotes('');
    setRecordAsIncomeInWallet(true);
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLoan) return;

    const rawAmt = Number(payAmountStr.replace(',', '.'));
    const parsedRate =
      Number(payRateStr.replace(',', '.')) || effectiveRate || 0;
    const rate = payCurrency === 'VES' ? parsedRate : null;

    if (!Number.isFinite(rawAmt) || rawAmt <= 0) {
      showToast('Ingresa un monto de pago mayor que cero.', 'error');
      return;
    }

    if (payCurrency === 'VES' && (!rate || rate <= 0)) {
      showToast(
        'Indica una tasa de cambio válida para calcular el equivalente en USD.',
        'error'
      );
      return;
    }

    const amtUsd =
      payCurrency === 'USD'
        ? rawAmt
        : calcularEquivalenteUsd(rawAmt, 'VES', rate);

    const paymentDate = payDate || obtenerFechaLocalIso();
    const linkedTxnId = recordAsIncomeInWallet
      ? `txn_loan_in_${Date.now()}`
      : null;
    const targetWallet = getWalletById(payTargetWalletId);

    const payment: DebtPayment = {
      id: `pay_${Date.now()}`,
      date: paymentDate,
      amount: rawAmt,
      currency: payCurrency,
      exchangeRate: rate,
      amountUsd: amtUsd,
      walletId: payTargetWalletId,
      paymentMethod: payMethod.trim() || targetWallet?.name || 'Abono',
      linkedTransactionId: linkedTxnId,
      notes:
        payNotes.trim() ||
        `Pago recibido de ${payingLoan.creditor} (${payMethod.trim() || targetWallet?.name || 'Directo'})`,
    };

    setAppData((prev) => {
      const nextDebts = prev.debts.map((d) => {
        if (d.id !== payingLoan.id) return d;
        const nextPayments = [...d.payments, payment];
        const totalPaid = nextPayments.reduce((a, b) => a + b.amountUsd, 0);
        return {
          ...d,
          payments: nextPayments,
          status:
            totalPaid >= d.totalAmountUsd - 0.005
              ? ('paid' as const)
              : ('pending' as const),
        };
      });

      let nextTxns = prev.transactions;
      if (recordAsIncomeInWallet && linkedTxnId) {
        const repaymentTxn: Transaction = {
          id: linkedTxnId,
          date: paymentDate,
          type: 'income',
          status: 'completed',
          walletId: payTargetWalletId,
          description: `Cobro de préstamo (${payingLoan.creditor}): ${payingLoan.description}`,
          categoryId: 'cat_inc_other',
          amount: rawAmt,
          currency: payCurrency,
          exchangeRate: rate,
          amountUsd: amtUsd,
          exchangeRateSource:
            payCurrency === 'USD'
              ? 'none'
              : officialRate && Math.abs((rate || 0) - officialRate) < 0.01
                ? 'bcv'
                : 'manual',
          source: payingLoan.creditor,
          paymentMethod: payMethod.trim() || targetWallet?.name || 'Billetera',
          notes:
            payNotes.trim() ||
            `Pago de préstamo recibido de ${payingLoan.creditor} en ${targetWallet?.name || 'billetera'}`,
        };
        nextTxns = [repaymentTxn, ...prev.transactions];
      }

      return {
        ...prev,
        debts: nextDebts,
        transactions: nextTxns,
      };
    });

    setPayingLoan(null);
    setPayAmountStr('');
    showToast(
      recordAsIncomeInWallet
        ? `Pago de ${payingLoan.creditor} registrado y sumado al saldo de ${targetWallet?.name || 'tu billetera'}.`
        : 'Pago registrado en el historial del préstamo.',
      'success'
    );
  };

  const handleDeletePayment = (loan: Debt, payment: DebtPayment) => {
    setAppData((prev) => {
      const nextDebts = prev.debts.map((d) => {
        if (d.id !== loan.id) return d;
        const nextPayments = d.payments.filter((p) => p.id !== payment.id);
        const totalPaid = nextPayments.reduce((a, b) => a + b.amountUsd, 0);
        return {
          ...d,
          payments: nextPayments,
          status:
            totalPaid >= d.totalAmountUsd - 0.005
              ? ('paid' as const)
              : ('pending' as const),
        };
      });

      const nextTxns = payment.linkedTransactionId
        ? prev.transactions.filter((t) => t.id !== payment.linkedTransactionId)
        : prev.transactions;

      return {
        ...prev,
        debts: nextDebts,
        transactions: nextTxns,
      };
    });
    showToast(
      payment.linkedTransactionId
        ? 'Abono eliminado y movimiento revertido de la billetera.'
        : 'Abono eliminado del préstamo.',
      'info'
    );
  };

  const handleToggleLoanStatus = (loan: Debt) => {
    const st = calcularEstadoDeuda(loan);
    const isCurrentlyPaid = loan.status === 'paid' || st.pendienteUsd <= 0.005;

    if (!isCurrentlyPaid) {
      // Abrir el modal de cobro con el monto restante para que elija cómo y a qué billetera le pagaron
      openPaymentModal(loan);
    } else {
      setAppData((prev) => ({
        ...prev,
        debts: prev.debts.map((d) =>
          d.id === loan.id ? { ...d, status: 'pending' } : d
        ),
      }));
      showToast('Préstamo marcado nuevamente como Pendiente.', 'info');
    }
  };

  const filteredLoans = useMemo(() => {
    return appData.debts.filter((d) => {
      const st = calcularEstadoDeuda(d);
      const isPaid = d.status === 'paid' || st.pendienteUsd <= 0.005;
      if (statusFilter === 'pending' && isPaid) return false;
      if (statusFilter === 'paid' && !isPaid) return false;
      if (walletFilter !== 'all' && d.walletId !== walletFilter) return false;
      return true;
    });
  }, [appData.debts, statusFilter, walletFilter]);

  return (
    <div className="space-y-8">
      {/* Cabecera explicativa enfocada en dinero que YO presté */}
      <div className="bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)]">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          Préstamos otorgados (Dinero que presté)
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Administra a quién le prestaste dinero, de qué billetera (wallet) salió el monto, cuándo se lo prestaste y el registro detallado de cómo y cuándo te lo van pagando.
        </p>
      </div>

      {/* KPIs de Resumen de Préstamos Otorgados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Pendiente por cobrar (Me deben)
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--pink-light)] text-[var(--pink-primary)]">
              {resumenPrestamos.porCobrarActivosCount} pendiente(s)
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--pink-primary)]">
            {formatearMonto(
              resumenPrestamos.porCobrarPendienteUsd,
              'USD',
              locale
            )}
          </div>
          {effectiveRate && effectiveRate > 0 && (
            <div className="text-[11px] font-mono-tabular text-[var(--text-secondary)]">
              ≈{' '}
              {formatearMonto(
                resumenPrestamos.porCobrarPendienteUsd * effectiveRate,
                'VES',
                locale
              )}
            </div>
          )}
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Total cobrado / recuperado
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--income-bg)] text-[var(--income-color)]">
              {resumenPrestamos.porCobrarPagadosCount} pagado(s)
            </span>
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--income-color)]">
            {formatearMonto(
              resumenPrestamos.porCobrarCobradoUsd,
              'USD',
              locale
            )}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            Dinero que ya regresó a tus billeteras
          </div>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Total prestado acumulado
            </span>
            {resumenPrestamos.vencidosCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--expense-bg)] text-[var(--expense-color)]">
                {resumenPrestamos.vencidosCount} vencido(s)
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)]">
            {formatearMonto(resumenPrestamos.porCobrarTotalUsd, 'USD', locale)}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            Suma histórica de los préstamos registrados
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulario: Registrar nuevo préstamo que hice */}
        <form
          onSubmit={handleCreateLoan}
          className="lg:col-span-5 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-4 h-fit"
        >
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Registrar nuevo préstamo
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
              Anota a quién le prestaste dinero y de cuál billetera salió.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
              ¿A quién le prestaste dinero? (Persona) *
            </label>
            <input
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Ej. Carlos Pérez, Mariana Gómez, Hermano..."
              required
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
              Motivo o concepto del préstamo *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Préstamo para repuesto, Emergencia, Compra..."
              required
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
              ¿De qué billetera (wallet) sacaste el dinero? *
            </label>
            <select
              value={sourceWalletId}
              onChange={(e) => setSourceWalletId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--pink-primary)]"
            >
              {activeWallets.map((w) => {
                const balUsd = getWalletBalanceUsd(w.id);
                return (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency}) · Disp:{' '}
                    {formatearMonto(balUsd, 'USD', locale)}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Moneda prestada
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              >
                <option value="USD">USD ($)</option>
                <option value="VES">VES (Bs)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Monto prestado *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
          </div>

          {currency === 'VES' && (
            <UsdToVesHelper
              officialRate={officialRate}
              defaultManualRate={appData.settings.defaultExchangeRate}
              currentRate={Number(rateStr.replace(',', '.')) || effectiveRate}
              locale={locale}
              compact
              onApplyVesAmount={(vesStr, usedRate) => {
                setAmountStr(vesStr);
                setRateStr(String(usedRate));
              }}
            />
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                {currency === 'VES'
                  ? 'Tasa de cambio (Bs/USD) *'
                  : 'Tasa de referencia (Bs/USD)'}
              </label>
              {officialRate && (
                <button
                  type="button"
                  onClick={() => setRateStr(String(officialRate))}
                  className="text-[10px] font-medium text-[var(--pink-primary)] hover:underline"
                >
                  Usar BCV ({formatearTasa(officialRate, locale)})
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={rateStr}
              onChange={(e) => setRateStr(e.target.value)}
              placeholder="Ej. 881.88"
              className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
            {Number(amountStr.replace(',', '.')) > 0 &&
              Number(rateStr.replace(',', '.')) > 0 && (
                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs font-mono-tabular text-[var(--text-secondary)] flex items-center justify-between">
                  <span>
                    {currency === 'VES'
                      ? 'Equivalente prestado en USD:'
                      : 'Equivalente prestado en Bs:'}
                  </span>
                  <strong className="text-[var(--text-primary)]">
                    {currency === 'VES'
                      ? formatearMonto(
                          Number(amountStr.replace(',', '.')) /
                            Number(rateStr.replace(',', '.')),
                          'USD',
                          locale
                        )
                      : formatearMonto(
                          Number(amountStr.replace(',', '.')) *
                            Number(rateStr.replace(',', '.')),
                          'VES',
                          locale
                        )}
                  </strong>
                </div>
              )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                ¿Cuándo lo prestaste?
              </label>
              <input
                type="date"
                value={loanDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setLoanDate(nextDate);
                  const lookup = obtenerTasaPorFecha(
                    nextDate,
                    appData.rateHistory,
                    effectiveRate,
                    appData.transactions
                  );
                  if (lookup.rate && lookup.rate > 0) {
                    setRateStr(String(Number(lookup.rate.toFixed(2))));
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Fecha acordada de pago
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Estado del préstamo
              </label>
              <select
                value={initialStatus}
                onChange={(e) =>
                  setInitialStatus(e.target.value as 'pending' | 'paid')
                }
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              >
                <option value="pending">Pendiente por cobrar</option>
                <option value="paid">Ya pagado / cobrado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Nota adicional
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej. Paga en 2 partes..."
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
          </div>

          {initialStatus === 'pending' && (
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={deductFromWalletNow}
                onChange={(e) => setDeductFromWalletNow(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong className="text-[var(--text-primary)] block">
                  Descontar de la billetera seleccionada ({getWalletById(sourceWalletId)?.name})
                </strong>
                Registra automáticamente la salida del dinero en esa billetera para que tu saldo disponible sea exacto.
              </span>
            </label>
          )}

          <button
            type="submit"
            className="w-full py-2.5 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
          >
            Guardar préstamo otorgado
          </button>
        </form>

        {/* Listado y administración de préstamos otorgados */}
        <div className="lg:col-span-7 space-y-4">
          {/* Barra de filtros */}
          <div className="bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `Todos (${appData.debts.length})` },
                  {
                    id: 'pending',
                    label: `Pendientes (${resumenPrestamos.porCobrarActivosCount})`,
                  },
                  {
                    id: 'paid',
                    label: `Pagados (${resumenPrestamos.porCobrarPagadosCount})`,
                  },
                ] as const
              ).map((stTab) => (
                <button
                  key={stTab.id}
                  type="button"
                  onClick={() => setStatusFilter(stTab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors ${
                    statusFilter === stTab.id
                      ? 'bg-[var(--pink-primary)] text-white'
                      : 'bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {stTab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--text-secondary)]">
                Billetera origen:
              </span>
              <select
                value={walletFilter}
                onChange={(e) => setWalletFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              >
                <option value="all">Todas las billeteras</option>
                {allWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredLoans.length === 0 ? (
            <div className="bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border-hairline)] text-center space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                No hay préstamos en esta vista
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Usa el formulario de la izquierda cuando prestes dinero a alguien para llevar el control de qué billetera salió y cómo te lo van pagando.
              </p>
            </div>
          ) : (
            filteredLoans.map((loan) => {
              const st = calcularEstadoDeuda(loan);
              const isPaid =
                loan.status === 'paid' || st.pendienteUsd <= 0.005;
              const isOverdue =
                !isPaid && Boolean(loan.dueDate && loan.dueDate < todayIso);
              const sourceWallet = getWalletById(loan.walletId);
              const progressPct = isPaid ? 100 : st.porcentajePagado;

              return (
                <div
                  key={loan.id}
                  className={`bg-[var(--surface)] p-5 rounded-2xl border space-y-4 transition-colors ${
                    isOverdue
                      ? 'border-[var(--expense-border)]'
                      : 'border-[var(--border-hairline)]'
                  }`}
                >
                  {/* Encabezado: Persona a quien le presté, billetera de donde salió y estado */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--pink-light)] text-[var(--pink-primary)]">
                          Deudor: {loan.creditor}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleLoanStatus(loan)}
                          title="Haz clic para registrar el pago o cambiar estado"
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-opacity hover:opacity-85 ${
                            isPaid
                              ? 'bg-[var(--income-bg)] text-[var(--income-color)]'
                              : isOverdue
                                ? 'bg-[var(--expense-bg)] text-[var(--expense-color)]'
                                : 'bg-[var(--lavender-soft)] text-[var(--lavender-text)]'
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Pagado / Cobrado</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>
                                {isOverdue
                                  ? 'Pendiente · Vencido'
                                  : 'Pendiente por cobrar'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>

                      <h4 className="text-base font-semibold text-[var(--text-primary)]">
                        {loan.description}
                      </h4>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                        {sourceWallet && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-primary)] bg-[var(--surface-subtle)] px-2.5 py-0.5 rounded-lg border border-[var(--border-hairline)]">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: sourceWallet.color }}
                            />
                            <span>Salió de: {sourceWallet.name}</span>
                          </span>
                        )}
                        {loan.loanDate && (
                          <span>Prestado el: {loan.loanDate}</span>
                        )}
                        {loan.dueDate && (
                          <span
                            className={
                              isOverdue
                                ? 'text-[var(--expense-color)] font-semibold'
                                : ''
                            }
                          >
                            Fecha de pago: {loan.dueDate}
                          </span>
                        )}
                      </div>

                      {loan.notes && (
                        <p className="text-[11px] text-[var(--text-secondary)] italic">
                          Nota: {loan.notes}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDialog({
                          title: 'Eliminar préstamo',
                          message: `¿Deseas eliminar el préstamo a "${loan.creditor}" (${loan.description})?`,
                          confirmLabel: 'Eliminar',
                          danger: true,
                          onConfirm: () => {
                            setAppData((prev) => ({
                              ...prev,
                              debts: prev.debts.filter((d) => d.id !== loan.id),
                            }));
                            setConfirmDialog(null);
                            showToast('Préstamo eliminado.', 'info');
                          },
                        })
                      }
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)] self-end sm:self-start"
                      title="Eliminar préstamo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Barra de progreso de recuperación del préstamo */}
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-[var(--surface-subtle)] rounded-full overflow-hidden border border-[var(--border-hairline)]">
                      <div
                        style={{ width: `${Math.min(100, progressPct)}%` }}
                        className="h-full bg-[var(--income-color)] rounded-full transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono-tabular">
                      <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                        <span className="text-[10px] text-[var(--text-secondary)] block">
                          Monto prestado
                        </span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {formatearMonto(loan.totalAmountUsd, 'USD', locale)}
                        </span>
                        {loan.currency === 'VES' && (
                          <span className="text-[10px] text-[var(--text-secondary)] block">
                            ({formatearMonto(loan.totalAmount, 'VES', locale)})
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                        <span className="text-[10px] text-[var(--text-secondary)] block">
                          Me ha pagado ({formatearPorcentaje(progressPct, 0, locale)})
                        </span>
                        <span className="font-semibold text-[var(--income-color)]">
                          {formatearMonto(
                            isPaid ? loan.totalAmountUsd : st.pagadoUsd,
                            'USD',
                            locale
                          )}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)]">
                        <span className="text-[10px] text-[var(--text-secondary)] block">
                          Falta por cobrar
                        </span>
                        <span
                          className={`font-semibold ${
                            isPaid
                              ? 'text-[var(--text-secondary)]'
                              : 'text-[var(--pink-primary)]'
                          }`}
                        >
                          {formatearMonto(
                            isPaid ? 0 : st.pendienteUsd,
                            'USD',
                            locale
                          )}
                        </span>
                        {!isPaid &&
                          effectiveRate &&
                          effectiveRate > 0 &&
                          st.pendienteUsd > 0 && (
                            <span className="text-[10px] text-[var(--text-secondary)] block">
                              ≈{' '}
                              {formatearMonto(
                                st.pendienteUsd * effectiveRate,
                                'VES',
                                locale
                              )}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Historial detallado: Cómo y cuándo me lo han ido pagando */}
                  <div className="pt-2 border-t border-[var(--border-divider)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                        Historial de pagos recibidos ({loan.payments.length})
                      </span>
                      {!isPaid && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openPaymentModal(loan)}
                            className="px-3.5 py-1.5 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
                          >
                            + Registrar pago / abono
                          </button>
                        </div>
                      )}
                    </div>

                    {loan.payments.length === 0 ? (
                      <div className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface-subtle)]/60 px-3 py-2 rounded-xl border border-[var(--border-hairline)]">
                        Todavía no se han registrado pagos de {loan.creditor}.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {loan.payments.map((pay) => {
                          const payWallet = getWalletById(pay.walletId);
                          return (
                            <div
                              key={pay.id}
                              className="px-3 py-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-[11px]"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                                  📅 {pay.date}
                                </span>
                                {pay.paymentMethod && (
                                  <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-medium">
                                    Vía: {pay.paymentMethod}
                                  </span>
                                )}
                                {payWallet && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{
                                        backgroundColor: payWallet.color,
                                      }}
                                    />
                                    <span>Entró a: {payWallet.name}</span>
                                  </span>
                                )}
                                {pay.notes && (
                                  <span className="text-[var(--text-secondary)]">
                                    · {pay.notes}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="text-right font-mono-tabular">
                                  <span className="font-semibold text-[var(--income-color)]">
                                    +{formatearMonto(pay.amountUsd, 'USD', locale)}
                                  </span>
                                  {pay.currency === 'VES' && (
                                    <span className="text-[10px] text-[var(--text-secondary)] ml-1">
                                      ({formatearMonto(pay.amount, 'VES', locale)})
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(loan, pay)}
                                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                                  title="Eliminar este pago"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Registrar cómo, cuándo y a qué wallet me pagaron */}
      {payingLoan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPayingLoan(null)}
        >
          <form
            onSubmit={handleRegisterPayment}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--income-bg)] text-[var(--income-color)]">
                  Pago recibido de {payingLoan.creditor}
                </span>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mt-1">
                  {payingLoan.description}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Saldo pendiente:{' '}
                  <strong className="font-mono-tabular text-[var(--pink-primary)]">
                    {formatearMonto(
                      calcularEstadoDeuda(payingLoan).pendienteUsd,
                      'USD',
                      locale
                    )}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingLoan(null)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  ¿En qué moneda te pagó?
                </label>
                <select
                  value={payCurrency}
                  onChange={(e) => {
                    const nextCurr = e.target.value as CurrencyCode;
                    setPayCurrency(nextCurr);
                    const pendUsd = calcularEstadoDeuda(payingLoan).pendienteUsd;
                    const r =
                      Number(payRateStr.replace(',', '.')) ||
                      effectiveRate ||
                      0;
                    if (nextCurr === 'VES' && r > 0) {
                      setPayAmountStr((pendUsd * r).toFixed(2));
                    } else if (nextCurr === 'USD') {
                      setPayAmountStr(String(pendUsd));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                >
                  <option value="USD">Dólares (USD $)</option>
                  <option value="VES">Bolívares (VES Bs)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Monto recibido ({payCurrency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payAmountStr}
                  onChange={(e) => setPayAmountStr(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>
            </div>

            {payCurrency === 'VES' && (
              <UsdToVesHelper
                officialRate={officialRate}
                defaultManualRate={appData.settings.defaultExchangeRate}
                currentRate={Number(payRateStr.replace(',', '.')) || effectiveRate}
                locale={locale}
                compact
                onApplyVesAmount={(vesStr, usedRate) => {
                  setPayAmountStr(vesStr);
                  setPayRateStr(String(usedRate));
                }}
              />
            )}

            {payCurrency === 'VES' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  Tasa de cambio aplicada (Bs por 1 $) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payRateStr}
                  onChange={(e) => setPayRateStr(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
                {Number(payAmountStr.replace(',', '.')) > 0 &&
                  Number(payRateStr.replace(',', '.')) > 0 && (
                    <div className="mt-1 text-xs font-mono-tabular text-[var(--text-secondary)] flex justify-between">
                      <span>Equivalente que abona en USD:</span>
                      <strong className="text-[var(--income-color)]">
                        {formatearMonto(
                          Number(payAmountStr.replace(',', '.')) /
                            Number(payRateStr.replace(',', '.')),
                          'USD',
                          locale
                        )}
                      </strong>
                    </div>
                  )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  ¿Cuándo te pagó? *
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setPayDate(nextDate);
                    const lookup = obtenerTasaPorFecha(
                      nextDate,
                      appData.rateHistory,
                      effectiveRate,
                      appData.transactions
                    );
                    if (lookup.rate && lookup.rate > 0) {
                      const rounded = Number(lookup.rate.toFixed(2));
                      setPayRateStr(String(rounded));
                      if (payCurrency === 'VES' && payingLoan) {
                        const pendUsd = calcularEstadoDeuda(payingLoan).pendienteUsd;
                        if (pendUsd > 0) {
                          setPayAmountStr((pendUsd * rounded).toFixed(2));
                        }
                      }
                    }
                  }}
                  required
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                  ¿Cómo te pagó? (Método) *
                </label>
                <input
                  type="text"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  placeholder="Ej. Pago Móvil, Zelle, Efectivo..."
                  required
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                ¿A qué billetera (wallet) entró el dinero? *
              </label>
              <select
                value={payTargetWalletId}
                onChange={(e) => {
                  setPayTargetWalletId(e.target.value);
                  const w = getWalletById(e.target.value);
                  if (w) setPayMethod(w.name);
                }}
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              >
                {activeWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Nota del pago (opcional)
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Ej. Pagó la mitad acordada, Referencia #1234..."
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={recordAsIncomeInWallet}
                onChange={(e) => setRecordAsIncomeInWallet(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong className="text-[var(--text-primary)] block">
                  Sumar este dinero al saldo de la billetera ({getWalletById(payTargetWalletId)?.name})
                </strong>
                Crea automáticamente un movimiento de Ingreso Completado en esa billetera para reflejar el dinero que te devolvieron.
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayingLoan(null)}
                className="px-4 py-2 text-xs text-[var(--text-secondary)] border border-[var(--border-input)] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl"
              >
                Confirmar pago recibido
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 9. MÓDULO DE CATEGORÍAS EDITABLES (Con límite mensual y protección)
 * ============================================================================ */
const CategoriesModuleView: React.FC<{
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  showToast: (t: string, k?: 'success' | 'error' | 'info') => void;
  locale: 'es-VE' | 'en-US';
  onRegisterItemizedPurchase: (categoryId?: string) => void;
  onEditTransaction: (txn: Transaction) => void;
}> = ({
  appData,
  setAppData,
  showToast,
  locale,
  onRegisterItemizedPurchase,
  onEditTransaction,
}) => {
  const [selectedType, setSelectedType] = useState<CategoryType>('expense');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#C86D85');
  const [newMonthlyLimitStr, setNewMonthlyLimitStr] = useState('');
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);

  const [reassignTargetCat, setReassignTargetCat] = useState<Category | null>(
    null
  );
  const [replacementCatId, setReplacementCatId] = useState<string>('');

  const palette = [
    '#C86D85',
    '#1E40AF',
    '#059669',
    '#8A79A6',
    '#B76E79',
    '#D45B72',
    '#0284C7',
    '#C98A3B',
  ];

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const parsedLimit =
      selectedType === 'expense' && newMonthlyLimitStr.trim()
        ? Number(newMonthlyLimitStr.replace(',', '.'))
        : 0;
    const validLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0;

    if (editingCat) {
      setAppData((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.id === editingCat.id
            ? {
                ...c,
                name: newName.trim(),
                color: newColor,
                monthlyLimitUsd:
                  c.type === 'expense' ? validLimit : c.monthlyLimitUsd,
              }
            : c
        ),
      }));
      setEditingCat(null);
      setNewName('');
      setNewMonthlyLimitStr('');
      showToast('Categoría actualizada.', 'success');
    } else {
      const created: Category = {
        id: `cat_${selectedType}_${Date.now()}`,
        name: newName.trim(),
        type: selectedType,
        color: newColor,
        icon: 'Tag',
        active: true,
        monthlyLimitUsd: selectedType === 'expense' ? validLimit : undefined,
      };
      setAppData((prev) => ({
        ...prev,
        categories: [...prev.categories, created],
      }));
      setNewName('');
      setNewMonthlyLimitStr('');
      showToast('Categoría creada correctamente.', 'success');
    }
  };

  const countRecordsForCategory = (catId: string): number => {
    const txnCount = appData.transactions.filter(
      (t) => t.categoryId === catId
    ).length;
    const savCount = appData.savings.filter((s) => s.categoryId === catId).length;
    return txnCount + savCount;
  };

  const handleAttemptDeleteCategory = (cat: Category) => {
    const count = countRecordsForCategory(cat.id);
    const sameTypeCats = appData.categories.filter(
      (c) => c.type === cat.type && c.id !== cat.id && c.active
    );

    if (sameTypeCats.length === 0) {
      showToast(
        'Debes mantener al menos una categoría activa de este tipo.',
        'error'
      );
      return;
    }

    if (count > 0) {
      setReassignTargetCat(cat);
      setReplacementCatId(sameTypeCats[0].id);
    } else {
      setAppData((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c.id !== cat.id),
      }));
      showToast(`Categoría "${cat.name}" eliminada.`, 'info');
    }
  };

  const handleConfirmReassignAndDelete = () => {
    if (!reassignTargetCat || !replacementCatId) return;
    const oldId = reassignTargetCat.id;

    setAppData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.categoryId === oldId ? { ...t, categoryId: replacementCatId } : t
      ),
      savings: prev.savings.map((s) =>
        s.categoryId === oldId ? { ...s, categoryId: replacementCatId } : s
      ),
      categories: prev.categories.filter((c) => c.id !== oldId),
    }));

    setReassignTargetCat(null);
    showToast(
      'Movimientos reasignados y categoría eliminada manteniendo la integridad histórica.',
      'success'
    );
  };

  const visibleCategories = appData.categories.filter(
    (c) => c.type === selectedType
  );

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Administración de categorías y compras detalladas
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Personaliza tus categorías, define límites mensuales en USD y registra o consulta compras con desglose de productos (tipo Farmatodo) por categoría.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRegisterItemizedPurchase(undefined)}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[var(--pink-primary)] to-[var(--lavender-accent)] hover:opacity-95 rounded-xl transition-opacity inline-flex items-center gap-2 shadow-xs shrink-0 self-start sm:self-auto"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>🛍️ Registrar Compra con Desglose (Ej. Farmatodo)</span>
        </button>
      </div>

      {/* Selector de Tipo de Categoría */}
      <div className="flex items-center gap-2">
        {(
          [
            { id: 'expense', label: 'Categorías de Gastos' },
            { id: 'income', label: 'Categorías de Ingresos' },
            { id: 'savings', label: 'Categorías de Ahorros' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setSelectedType(tab.id);
              setEditingCat(null);
              setNewName('');
              setNewMonthlyLimitStr('');
            }}
            className={`px-4 py-2 text-xs font-medium rounded-xl transition-colors ${
              selectedType === tab.id
                ? 'bg-[var(--pink-primary)] text-white'
                : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveCategory}
          className="lg:col-span-4 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-4 h-fit"
        >
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {editingCat ? 'Editar categoría' : 'Nueva categoría'}
          </h3>
          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
              Nombre de la categoría *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Deporte, Tecnología, Mascotas..."
              required
              className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
          </div>

          {selectedType === 'expense' && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Límite de presupuesto mensual (USD, opcional)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newMonthlyLimitStr}
                onChange={(e) => setNewMonthlyLimitStr(e.target.value)}
                placeholder="Ej. 150.00"
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-primary)] mb-1.5">
              Color complementario
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {palette.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setNewColor(hex)}
                  style={{ backgroundColor: hex }}
                  className={`w-6 h-6 rounded-full ${
                    newColor === hex
                      ? 'ring-2 ring-offset-2 ring-[var(--text-primary)] scale-110'
                      : ''
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {editingCat && (
              <button
                type="button"
                onClick={() => {
                  setEditingCat(null);
                  setNewName('');
                  setNewMonthlyLimitStr('');
                }}
                className="px-3 py-2 text-xs text-[var(--text-secondary)] border border-[var(--border-input)] rounded-xl"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl"
            >
              {editingCat ? 'Guardar cambios' : 'Crear categoría'}
            </button>
          </div>
        </form>

        <div className="lg:col-span-8 bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
          <div className="divide-y divide-[var(--border-divider)]">
            {visibleCategories.map((cat) => {
              const usedCount = countRecordsForCategory(cat.id);
              const catTransactions = appData.transactions.filter(
                (t) => t.categoryId === cat.id
              );
              const itemizedCount = catTransactions.filter(
                (t) =>
                  (t.purchasedItems && t.purchasedItems.length > 0) ||
                  Boolean(t.storeName)
              ).length;
              const isExpanded = expandedCatId === cat.id;

              return (
                <div key={cat.id} className="transition-colors">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--surface-subtle)]/50">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3.5 h-3.5 rounded-sm shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              cat.active
                                ? 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)] line-through'
                            }`}
                          >
                            {cat.name}
                          </span>
                          {cat.type === 'expense' &&
                            cat.monthlyLimitUsd &&
                            cat.monthlyLimitUsd > 0 && (
                              <span className="px-2 py-0.5 rounded bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[10px] font-mono-tabular text-[var(--pink-primary)] font-semibold">
                                Límite: ${cat.monthlyLimitUsd.toFixed(2)}/mes
                              </span>
                            )}
                          {itemizedCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--pink-light)] text-[var(--pink-primary)] text-[10px] font-semibold">
                              🛍️ {itemizedCount} compra(s) con desglose
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-2 mt-0.5">
                          <span>
                            {cat.active ? 'Activa' : 'Desactivada'} · {usedCount}{' '}
                            registros asociados
                          </span>
                          {catTransactions.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCatId(isExpanded ? null : cat.id)
                              }
                              className="text-[var(--pink-primary)] font-semibold underline hover:opacity-80"
                            >
                              {isExpanded
                                ? 'Ocultar movimientos'
                                : 'Ver compras y desglose'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {cat.type === 'expense' && cat.active && (
                        <button
                          type="button"
                          onClick={() => onRegisterItemizedPurchase(cat.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-[var(--pink-primary)] bg-[var(--pink-light)] hover:opacity-90 border border-[var(--pink-primary)]/30 rounded-lg inline-flex items-center gap-1"
                          title="Registrar compra pagada de una vez detallando cada producto comprado en esta categoría"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          <span>+ Compra con desglose</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(cat);
                          setNewName(cat.name);
                          setNewColor(cat.color);
                          setNewMonthlyLimitStr(
                            cat.monthlyLimitUsd && cat.monthlyLimitUsd > 0
                              ? String(cat.monthlyLimitUsd)
                              : ''
                          );
                        }}
                        className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAppData((prev) => ({
                            ...prev,
                            categories: prev.categories.map((c) =>
                              c.id === cat.id ? { ...c, active: !c.active } : c
                            ),
                          }))
                        }
                        className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg"
                      >
                        {cat.active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAttemptDeleteCategory(cat)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--expense-color)]"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Historial desplegable de movimientos y compras con desglose en esta categoría */}
                  {isExpanded && catTransactions.length > 0 && (
                    <div className="px-4 pb-4 pt-1 bg-[var(--surface-subtle)]/60 border-t border-[var(--border-hairline)] space-y-2">
                      <div className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                        <span>
                          Últimos movimientos en «{cat.name}» (
                          {catTransactions.length})
                        </span>
                        {cat.type === 'expense' && (
                          <button
                            type="button"
                            onClick={() => onRegisterItemizedPurchase(cat.id)}
                            className="text-[var(--pink-primary)] underline font-semibold"
                          >
                            + Nueva compra tipo Farmatodo aquí
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {catTransactions.slice(0, 15).map((txn) => (
                          <div
                            key={txn.id}
                            className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                                  {txn.date}
                                </span>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {txn.description}
                                </span>
                                {txn.storeName && (
                                  <span className="px-2 py-0.5 rounded-full bg-[var(--pink-light)] text-[var(--pink-primary)] text-[10px] font-semibold">
                                    🛍️ {txn.storeName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono-tabular font-bold text-[var(--text-primary)]">
                                  {formatearMonto(
                                    txn.amount,
                                    txn.currency,
                                    locale
                                  )}
                                </span>
                                <span className="font-mono-tabular text-[11px] text-[var(--text-secondary)]">
                                  (≈{' '}
                                  {formatearMonto(txn.amountUsd, 'USD', locale)})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onEditTransaction(txn)}
                                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--pink-primary)]"
                                  title="Editar movimiento o su desglose de artículos"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {txn.purchasedItems &&
                              txn.purchasedItems.length > 0 && (
                                <div className="pt-1.5 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-semibold text-[var(--text-secondary)]">
                                    Compraste:
                                  </span>
                                  {txn.purchasedItems.map((it) => (
                                    <span
                                      key={it.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-primary)]"
                                    >
                                      <strong className="text-[var(--pink-primary)] font-mono-tabular">
                                        {it.quantity}x
                                      </strong>
                                      <span>{it.name}</span>
                                      {it.unitPrice != null &&
                                        it.unitPrice > 0 && (
                                          <span className="text-[10px] font-mono-tabular text-[var(--text-secondary)]">
                                            (
                                            {formatearMonto(
                                              it.unitPrice * it.quantity,
                                              txn.currency,
                                              locale
                                            )}
                                            )
                                          </span>
                                        )}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de protección de integridad al eliminar categoría con registros */}
      {reassignTargetCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Protección de registros históricos
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              La categoría <strong>{reassignTargetCat.name}</strong> tiene{' '}
              <strong>{countRecordsForCategory(reassignTargetCat.id)}</strong>{' '}
              movimientos asociados. Para no dejar referencias rotas, puedes desactivarla o elegir a qué categoría reasignar sus movimientos antes de eliminarla:
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--text-primary)] mb-1">
                Reasignar movimientos a:
              </label>
              <select
                value={replacementCatId}
                onChange={(e) => setReplacementCatId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              >
                {appData.categories
                  .filter(
                    (c) =>
                      c.type === reassignTargetCat.type &&
                      c.id !== reassignTargetCat.id
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReassignTargetCat(null)}
                className="px-3 py-2 text-xs text-[var(--text-secondary)] border border-[var(--border-input)] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAppData((prev) => ({
                    ...prev,
                    categories: prev.categories.map((c) =>
                      c.id === reassignTargetCat.id
                        ? { ...c, active: false }
                        : c
                    ),
                  }));
                  setReassignTargetCat(null);
                  showToast(
                    'Categoría desactivada conservando sus movimientos.',
                    'info'
                  );
                }}
                className="px-3 py-2 text-xs text-[var(--lavender-text)] bg-[var(--lavender-soft)] rounded-xl"
              >
                Solo desactivar
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignAndDelete}
                className="px-3 py-2 text-xs text-white bg-[var(--expense-color)] rounded-xl"
              >
                Reasignar y eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 10. MÓDULO DE ESTADÍSTICAS E INFORMES
 * ============================================================================ */
const StatisticsModuleView: React.FC<{
  appData: AppDataSchema;
  selectedMonth: string;
  dateRangeStart: string;
  setDateRangeStart: (v: string) => void;
  dateRangeEnd: string;
  setDateRangeEnd: (v: string) => void;
  locale: 'es-VE' | 'en-US';
  onOpenMonthlyReport?: () => void;
}> = ({
  appData,
  selectedMonth,
  dateRangeStart,
  setDateRangeStart,
  dateRangeEnd,
  setDateRangeEnd,
  locale,
  onOpenMonthlyReport,
}) => {
  const [statCategory, setStatCategory] = useState('all');
  const [statCurrency, setStatCurrency] = useState<'all' | CurrencyCode>('all');

  const filteredTxns = useMemo(() => {
    return appData.transactions.filter((t) => {
      if (!esTransaccionCompletada(t)) return false;
      if (dateRangeStart && t.date < dateRangeStart) return false;
      if (dateRangeEnd && t.date > dateRangeEnd) return false;
      if (statCategory !== 'all' && t.categoryId !== statCategory) return false;
      if (statCurrency !== 'all' && t.currency !== statCurrency) return false;
      return true;
    });
  }, [
    appData.transactions,
    dateRangeStart,
    dateRangeEnd,
    statCategory,
    statCurrency,
  ]);

  const stats = useMemo(() => {
    let totalIngresos = 0;
    let totalGastos = 0;
    const monthsSet = new Set<string>();
    const monthBalanceMap = new Map<string, number>();

    for (const t of filteredTxns) {
      const m = t.date.slice(0, 7);
      monthsSet.add(m);
      const prevBal = monthBalanceMap.get(m) || 0;
      if (t.type === 'income') {
        totalIngresos += t.amountUsd;
        monthBalanceMap.set(m, prevBal + t.amountUsd);
      } else {
        totalGastos += t.amountUsd;
        monthBalanceMap.set(m, prevBal - t.amountUsd);
      }
    }

    const numMonths = Math.max(1, monthsSet.size);
    const balanceNeto = totalIngresos - totalGastos;
    const capacidadDeAhorro = totalIngresos - totalGastos;
    const porcentajeDeGastos =
      totalIngresos > 0 ? (totalGastos / totalIngresos) * 100 : 0;
    const promedioMensualIngresos = totalIngresos / numMonths;
    const promedioMensualGastos = totalGastos / numMonths;

    const distGastos = calcularDistribucionPorCategoria(
      filteredTxns,
      appData.categories,
      'expense'
    );
    const categoriaMayorGasto = distGastos[0] || null;

    let mejorMesKey: string | null = null;
    let mejorMesAhorro = -Infinity;
    for (const [mKey, bal] of monthBalanceMap.entries()) {
      if (bal > mejorMesAhorro) {
        mejorMesAhorro = bal;
        mejorMesKey = mKey;
      }
    }

    return {
      totalIngresos,
      totalGastos,
      balanceNeto,
      capacidadDeAhorro,
      porcentajeDeGastos,
      promedioMensualIngresos,
      promedioMensualGastos,
      categoriaMayorGasto,
      mejorMesKey,
      mejorMesAhorro: mejorMesKey ? mejorMesAhorro : 0,
      distGastos,
    };
  }, [filteredTxns, appData.categories]);

  const serieDoceMeses = useMemo(
    () => obtenerSerieMensual(appData, selectedMonth, 6),
    [appData, selectedMonth]
  );

  return (
    <div className="space-y-8">
      <div className="bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Estadísticas e informes financieros
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Análisis detallado en USD de tu balance neto, capacidad de ahorro, promedios mensuales y evolución del patrimonio.
          </p>
        </div>
        {onOpenMonthlyReport && (
          <button
            type="button"
            onClick={onOpenMonthlyReport}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
          >
            <Printer className="w-4 h-4" />
            <span>Estado de Cuenta Mensual (PDF)</span>
          </button>
        )}
      </div>

      {/* Filtros del informe */}
      <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">
            Desde fecha
          </label>
          <input
            type="date"
            value={dateRangeStart}
            onChange={(e) => setDateRangeStart(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">
            Hasta fecha
          </label>
          <input
            type="date"
            value={dateRangeEnd}
            onChange={(e) => setDateRangeEnd(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">
            Categoría
          </label>
          <select
            value={statCategory}
            onChange={(e) => setStatCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          >
            <option value="all">Todas las categorías</option>
            {appData.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1">
            Moneda origen
          </label>
          <select
            value={statCurrency}
            onChange={(e) =>
              setStatCurrency(e.target.value as 'all' | CurrencyCode)
            }
            className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          >
            <option value="all">USD + VES</option>
            <option value="USD">Solo USD</option>
            <option value="VES">Solo VES (Bs)</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            setDateRangeStart('');
            setDateRangeEnd('');
            setStatCategory('all');
            setStatCurrency('all');
          }}
          className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
        >
          Restablecer rango
        </button>
      </div>

      {/* Indicadores Clave (Sección 16) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Total de ingresos</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--income-color)] mt-1">
            {formatearMonto(stats.totalIngresos, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Promedio mensual:{' '}
            {formatearMonto(stats.promedioMensualIngresos, 'USD', locale)}
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">Total de gastos</span>
          <div className="text-xl font-bold font-mono-tabular text-[var(--expense-color)] mt-1">
            {formatearMonto(stats.totalGastos, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Promedio mensual:{' '}
            {formatearMonto(stats.promedioMensualGastos, 'USD', locale)}
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">
            Balance neto y capacidad de ahorro
          </span>
          <div
            className={`text-xl font-bold font-mono-tabular mt-1 ${
              stats.balanceNeto >= 0
                ? 'text-[var(--income-color)]'
                : 'text-[var(--expense-color)]'
            }`}
          >
            {formatearMonto(stats.balanceNeto, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            % ingresos destinado a gastos:{' '}
            {formatearPorcentaje(stats.porcentajeDeGastos, 1, locale)}
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">
            Categoría con mayor gasto y mejor mes
          </span>
          <div className="text-sm font-semibold text-[var(--text-primary)] mt-1 truncate">
            {stats.categoriaMayorGasto
              ? `${stats.categoriaMayorGasto.categoryName} (${formatearMonto(stats.categoriaMayorGasto.amountUsd, 'USD', locale)})`
              : 'Sin gastos'}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Mes con mayor ahorro:{' '}
            {stats.mejorMesKey
              ? `${formatearNombreMes(stats.mejorMesKey)} (${formatearMonto(stats.mejorMesAhorro, 'USD', locale)})`
              : '—'}
          </p>
        </div>
      </div>

      {/* Gráficas Completas de Estadísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
            Evolución de ingresos, gastos y capacidad de ahorro
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Comparativa histórica en USD.
          </p>
          <MonthlyBalanceLineChart
            serie={serieDoceMeses}
            locale={locale}
            showIncomeAndExpenseLines
          />
        </div>

        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
            Progreso de ahorros y patrimonio financiero
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Evolución acumulada sin duplicar aportes de ahorro.
          </p>
          <SavingsProgressChart serie={serieDoceMeses} locale={locale} />
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 11. MÓDULO DE CONFIGURACIÓN, TEMA VISUAL, RESPALDO JSON Y GUÍA TÉCNICA
 * ============================================================================ */
const SettingsAndBackupView: React.FC<{
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  officialRate: number | null;
  rateLoading: boolean;
  rateStatusMsg: string;
  onRefreshRate: () => void;
  onExportJson: () => void;
  onLoadDemoData: () => void;
  onReplayTutorial: () => void;
  setConfirmDialog: React.Dispatch<
    React.SetStateAction<{
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    } | null>
  >;
  showToast: (t: string, k?: 'success' | 'error' | 'info') => void;
  locale: 'es-VE' | 'en-US';
}> = ({
  appData,
  setAppData,
  officialRate,
  rateLoading,
  rateStatusMsg,
  onRefreshRate,
  onExportJson,
  onLoadDemoData,
  onReplayTutorial,
  setConfirmDialog,
  showToast,
  locale,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [userName, setUserName] = useState(appData.settings.userName);
  const [manualRateStr, setManualRateStr] = useState(
    appData.settings.defaultExchangeRate
      ? Number(appData.settings.defaultExchangeRate).toFixed(2)
      : ''
  );
  const [startingBalanceStr, setStartingBalanceStr] = useState(
    String(appData.settings.startingBalanceUsd || 0)
  );
  const [trackingStart, setTrackingStart] = useState(
    appData.settings.trackingStartDate || '2026-01-01'
  );

  // Estado para importar JSON de respaldo completo con confirmación
  const [pendingImportData, setPendingImportData] =
    useState<AppDataSchema | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Estado para importar archivo de Tasas Históricas (XLS / XLSX / CSV / JSON)
  const ratesFileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingRatesImport, setPendingRatesImport] =
    useState<HistoricalRatesImportResult | null>(null);
  const [ratesImportFileName, setRatesImportFileName] = useState<string>('');
  const [ratesImportError, setRatesImportError] = useState<string | null>(null);
  const [showJsonFormatGuide, setShowJsonFormatGuide] = useState<boolean>(false);

  const purchasingPowerSummary = useMemo(
    () => calcularAnalisisPoderAdquisitivo(appData),
    [appData]
  );

  // Confirmación doble para borrar todos los datos
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const rawManualVal = manualRateStr.trim()
      ? Number(manualRateStr.replace(',', '.'))
      : null;

    if (
      rawManualVal !== null &&
      (!Number.isFinite(rawManualVal) || rawManualVal <= 0)
    ) {
      showToast(
        'La tasa manual alternativa debe ser un número mayor que cero.',
        'error'
      );
      return;
    }
    const manualVal =
      rawManualVal !== null ? Number(rawManualVal.toFixed(2)) : null;

    const startBal = Number(startingBalanceStr.replace(',', '.')) || 0;

    setAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        userName: userName.trim() || 'Mis Finanzas',
        defaultExchangeRate: manualVal,
        startingBalanceUsd: startBal,
        trackingStartDate: trackingStart,
      },
      rateHistory:
        manualVal && manualVal > 0
          ? registrarTasaDelDiaEnHistorial(
              prev.rateHistory || [],
              obtenerFechaLocalIso(),
              manualVal,
              'manual',
              '12:00:00',
              false
            )
          : prev.rateHistory,
    }));

    showToast('Configuración guardada en este navegador.', 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text);
        const validated = validarYNormalizarRespaldo(parsed);
        setPendingImportData(validated);
      } catch (err: unknown) {
        setImportError(
          err instanceof Error
            ? err.message
            : 'El archivo seleccionado no es un respaldo JSON válido.'
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRatesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRatesImportError(null);
    setPendingRatesImport(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setRatesImportFileName(file.name);
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          const parsedResult = parsearJsonTasasHistoricas(text);
          setPendingRatesImport(parsedResult);
        } catch (err: unknown) {
          setRatesImportError(
            err instanceof Error
              ? err.message
              : 'No se pudo leer el archivo JSON de tasas históricas.'
          );
        } finally {
          if (ratesFileInputRef.current) ratesFileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    } else {
      // Excel (.xlsx, .xls) o .csv
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const buffer = reader.result as ArrayBuffer;
          const parsedResult = parsearExcelTasasHistoricas(buffer);
          setPendingRatesImport(parsedResult);
        } catch (err: unknown) {
          setRatesImportError(
            err instanceof Error
              ? err.message
              : 'No se pudo leer el archivo Excel/CSV de tasas históricas.'
          );
        } finally {
          if (ratesFileInputRef.current) ratesFileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleRecalculateHistoricalVes = () => {
    const targetRate = officialRate || appData.settings.defaultExchangeRate;
    if (!targetRate || targetRate <= 0) {
      showToast('No hay una tasa válida disponible para recalcular.', 'error');
      return;
    }

    setConfirmDialog({
      title: 'Advertencia: Recalcular registros históricos en VES',
      message: `Por regla contable, los movimientos históricos en bolívares conservan la tasa del día en que se registraron. ¿Confirmas que deseas sobrescribir la tasa de TODOS los movimientos en VES usando la tasa actual (${formatearTasa(targetRate, locale)} Bs/USD)?`,
      confirmLabel: 'Sí, recalcular históricos',
      danger: true,
      onConfirm: () => {
        setAppData((prev) => ({
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.currency === 'VES'
              ? {
                  ...t,
                  exchangeRate: targetRate,
                  amountUsd: calcularEquivalenteUsd(
                    t.amount,
                    'VES',
                    targetRate
                  ),
                }
              : t
          ),
        }));
        setConfirmDialog(null);
        showToast('Registros históricos en VES recalculados.', 'info');
      },
    });
  };

  const activeTheme = appData.settings.themeMode || 'rose';
  const [showRatesHistoryPanel, setShowRatesHistoryPanel] =
    useState<boolean>(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Cabecera limpia de Configuración */}
      <div className="bg-[var(--surface)] px-6 py-5 rounded-2xl border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Configuración
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Administra tu perfil, tasa de cambio, apariencia visual y copias de seguridad desde una sola lista ordenada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onReplayTutorial}
            className="px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-hairline)] rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Compass className="w-4 h-4 text-[var(--pink-primary)]" />
            <span>Ver Tutorial</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: PERFIL, FORMATO Y TASA DE CAMBIO (ESTILO LISTA DE CONFIGURACIÓN) */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden"
      >
        <div className="px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              General y Tasa de Cambio
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Datos básicos de tu cuenta, formato numérico y preferencias de tasa BCV o manual
            </p>
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors shadow-xs shrink-0"
          >
            Guardar cambios
          </button>
        </div>

        <div className="divide-y divide-[var(--border-divider)]">
          {/* Fila 1: Nombre del perfil */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Nombre del perfil o espacio
              </label>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Nombre que se muestra en el encabezado principal de la aplicación
              </p>
            </div>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Mis Finanzas"
              className="w-full sm:w-64 px-3 py-2 text-xs font-medium bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            />
          </div>

          {/* Fila 2: Formato numérico */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Formato numérico preferido
              </label>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Define cómo se muestran los separadores de miles y decimales
              </p>
            </div>
            <select
              value={appData.settings.numberFormatLocale}
              onChange={(e) =>
                setAppData((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    numberFormatLocale: e.target.value as 'es-VE' | 'en-US',
                  },
                }))
              }
              className="w-full sm:w-64 px-3 py-2 text-xs font-medium bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            >
              <option value="es-VE">Estándar Venezuela (1.234,56)</option>
              <option value="en-US">Estándar Internacional (1,234.56)</option>
            </select>
          </div>

          {/* Fila 3: Saldo inicial y fecha de inicio */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Saldo base inicial (USD) y fecha de inicio
              </label>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Punto de partida contable para tus reportes históricos
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--text-secondary)]">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={startingBalanceStr}
                  onChange={(e) => setStartingBalanceStr(e.target.value)}
                  className="w-full sm:w-32 pl-7 pr-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>
              <input
                type="date"
                value={trackingStart}
                onChange={(e) => setTrackingStart(e.target.value)}
                className="w-full sm:w-40 px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
          </div>

          {/* Fila 4: Tasa Oficial BCV */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Tasa Oficial BCV actual
                </span>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono-tabular font-bold bg-[var(--pink-light)] text-[var(--pink-primary)]">
                  {officialRate
                    ? formatearEquivalenciaTasa(officialRate, locale)
                    : 'Sin tasa'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Fecha BCV: {appData.settings.lastOfficialRateDate || '—'} ·{' '}
                {rateStatusMsg}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshRate}
              disabled={rateLoading}
              className="px-3.5 py-2 text-xs font-semibold text-[var(--pink-primary)] bg-[var(--pink-light)] hover:opacity-90 rounded-xl transition-opacity self-start sm:self-auto shrink-0"
            >
              {rateLoading ? 'Actualizando...' : 'Actualizar tasa BCV'}
            </button>
          </div>

          {/* Fila 5: Tasa Manual Alternativa y Preferencia */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Tasa manual personalizada (Bs/USD)
              </label>
              <label className="inline-flex items-center gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={appData.settings.preferManualRateByDefault}
                  onChange={(e) =>
                    setAppData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        preferManualRateByDefault: e.target.checked,
                      },
                    }))
                  }
                  className="rounded accent-[var(--pink-primary)]"
                />
                <span>Usar tasa manual por defecto al registrar movimientos</span>
              </label>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-64">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={manualRateStr}
                onChange={(e) => setManualRateStr(e.target.value)}
                placeholder="Ej. 88.50"
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
              <span className="text-xs font-mono-tabular text-[var(--text-secondary)] shrink-0">
                Bs/$
              </span>
            </div>
          </div>
        </div>
      </form>

      {/* SECCIÓN 2: APARIENCIA Y TEMAS EN FORMATO LISTA COMPACTA */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Palette className="w-4 h-4 text-[var(--pink-primary)] shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Apariencia y Tema de Color
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Selecciona un tema claro u oscuro de la lista
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--pink-light)] text-[var(--pink-primary)] self-start sm:self-auto">
            Activo: {THEME_OPTIONS.find((t) => t.id === activeTheme)?.label || 'Claro con Rosa'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border-divider)]">
          {/* Columna Lista Modo Claro */}
          <div>
            <div className="px-5 py-2.5 bg-[var(--surface-subtle)]/50 border-b border-[var(--border-divider)] flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Sun className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
              <span>Temas Claros (Modo Día)</span>
            </div>
            <div className="divide-y divide-[var(--border-divider)]">
              {THEME_OPTIONS.filter((t) => t.mode === 'light').map((tOpt) => {
                const isSelected = activeTheme === tOpt.id;
                return (
                  <button
                    key={tOpt.id}
                    type="button"
                    onClick={() => {
                      setAppData((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          themeMode: tOpt.id,
                        },
                      }));
                      showToast(`Tema aplicado: ${tOpt.label}`, 'info');
                    }}
                    className={`w-full px-5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-[var(--pink-light)]/35'
                        : 'hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: tOpt.swatchBg }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: tOpt.swatchAccent }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: tOpt.swatchSecondary }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {tOpt.label}
                          </span>
                          {tOpt.collection && (
                            <span className="text-[10px] font-semibold text-[var(--pink-primary)] opacity-90">
                              · {tOpt.collection}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          {tOpt.description}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--pink-primary)] text-white shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Activo</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
                        Elegir
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Columna Lista Modo Oscuro */}
          <div>
            <div className="px-5 py-2.5 bg-[var(--surface-subtle)]/50 border-b border-[var(--border-divider)] flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Moon className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
              <span>Temas Oscuros (Modo Noche)</span>
            </div>
            <div className="divide-y divide-[var(--border-divider)]">
              {THEME_OPTIONS.filter((t) => t.mode === 'dark').map((tOpt) => {
                const isSelected = activeTheme === tOpt.id;
                return (
                  <button
                    key={tOpt.id}
                    type="button"
                    onClick={() => {
                      setAppData((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          themeMode: tOpt.id,
                        },
                      }));
                      showToast(`Tema aplicado: ${tOpt.label}`, 'info');
                    }}
                    className={`w-full px-5 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-[var(--pink-light)]/35'
                        : 'hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span
                          className="w-4 h-4 rounded-full border border-white/25 shadow-2xs"
                          style={{ backgroundColor: tOpt.swatchBg }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white/25 shadow-2xs"
                          style={{ backgroundColor: tOpt.swatchAccent }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white/25 shadow-2xs"
                          style={{ backgroundColor: tOpt.swatchSecondary }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {tOpt.label}
                          </span>
                          {tOpt.collection && (
                            <span className="text-[10px] font-semibold text-[var(--pink-primary)] opacity-90">
                              · {tOpt.collection}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] truncate">
                          {tOpt.description}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--pink-primary)] text-white shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Activo</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] shrink-0">
                        Elegir
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2.5: CONFIGURACIÓN DE NOTIFICACIONES PUSH Y ALERTAS */}
      <PushNotificationSettingsPanel
        appData={appData}
        locale={locale}
        showToast={showToast}
      />

      {/* SECCIÓN 3: DATOS, RESPALDO JSON, TASAS HISTÓRICAS Y SISTEMA (EN LISTA) */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
        <div className="px-6 py-4 bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Respaldo de Datos, Historial Cambiario y Sistema
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Copias de seguridad JSON, tasas históricas BCV y mantenimiento de tus datos
          </p>
        </div>

        <div className="divide-y divide-[var(--border-divider)]">
          {/* Fila 1: Exportar / Importar JSON */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Copia de seguridad completa (.JSON)
                </span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Descarga todos tus registros o restaura un archivo de respaldo guardado previamente
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onExportJson}
                  className="py-2 px-3.5 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2 px-3.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border-input)] rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                  <span>Cargar JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-[var(--expense-bg)] border border-[var(--expense-border)] text-xs text-[var(--expense-text-dark)]">
                Error al validar el archivo JSON: {importError}
              </div>
            )}

            {pendingImportData && (
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--pink-primary)] space-y-3">
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                  Archivo de respaldo validado correctamente
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Contiene {pendingImportData.transactions.length} movimientos,{' '}
                  {pendingImportData.savings.length} registros de ahorro y{' '}
                  {pendingImportData.savingsGoals.length} metas. ¿Cómo deseas restaurarlo?
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAppData(pendingImportData);
                      setPendingImportData(null);
                      showToast(
                        'Respaldo restaurado reemplazando los datos anteriores.',
                        'success'
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--pink-primary)] rounded-lg"
                  >
                    Reemplazar datos actuales
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAppData((prev) =>
                        fusionarRespaldos(prev, pendingImportData)
                      );
                      setPendingImportData(null);
                      showToast(
                        'Respaldo fusionado sin duplicar registros.',
                        'success'
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--lavender-accent)] rounded-lg"
                  >
                    Fusionar sin duplicados
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingImportData(null)}
                    className="px-3 py-1.5 text-xs text-[var(--text-secondary)] border border-[var(--border-input)] rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fila 2: Historial de tasas BCV y JSON por fecha */}
          <div className="px-6 py-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Historial de tasas diarias y carga por JSON / Excel
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                    {(appData.rateHistory || []).length} tasas guardadas
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Cada tasa del día se guarda automáticamente. También puedes cargar un JSON o Excel con todas las tasas de un mes para que al elegir cualquier fecha pasada se ponga la tasa de ese día.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => ratesFileInputRef.current?.click()}
                  className="py-2 px-3.5 text-xs font-semibold text-[var(--pink-primary)] bg-[var(--pink-light)] hover:opacity-90 rounded-xl flex items-center gap-1.5 transition-opacity"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Cargar tasas JSON / Excel</span>
                </button>
                <input
                  ref={ratesFileInputRef}
                  type="file"
                  accept=".json,.xls,.xlsx,.csv,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={handleRatesFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowRatesHistoryPanel((prev) => !prev)}
                  className="py-2 px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-xl transition-colors"
                >
                  {showRatesHistoryPanel ? 'Ocultar detalles' : 'Ver plantillas y meses'}
                </button>
              </div>
            </div>

            {ratesImportError && (
              <div className="p-3 rounded-xl bg-[var(--expense-bg)] border border-[var(--expense-border)] text-xs text-[var(--expense-text-dark)] flex items-center justify-between gap-2">
                <span>{ratesImportError}</span>
                <button
                  type="button"
                  onClick={() => setRatesImportError(null)}
                  className="text-xs font-semibold underline shrink-0"
                >
                  Cerrar
                </button>
              </div>
            )}

            {pendingRatesImport && (
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--pink-primary)] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pink-primary)]">
                      Archivo procesado: {ratesImportFileName}
                    </span>
                    <h4 className="text-xs font-bold text-[var(--text-primary)] mt-0.5">
                      {pendingRatesImport.items.length} tasas históricas detectadas ({pendingRatesImport.minDate} a {pendingRatesImport.maxDate})
                    </h4>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAppData((prev) => ({
                        ...prev,
                        rateHistory: fusionarTasasHistoricasEnHistorial(
                          prev.rateHistory || [],
                          pendingRatesImport.items,
                          false
                        ),
                      }));
                      const count = pendingRatesImport.items.length;
                      setPendingRatesImport(null);
                      showToast(
                        `Se fusionaron ${count} tasas históricas correctamente.`,
                        'success'
                      );
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[var(--pink-primary)] rounded-lg"
                  >
                    Fusionar con historial actual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAppData((prev) => ({
                        ...prev,
                        rateHistory: fusionarTasasHistoricasEnHistorial(
                          prev.rateHistory || [],
                          pendingRatesImport.items,
                          true
                        ),
                      }));
                      const count = pendingRatesImport.items.length;
                      setPendingRatesImport(null);
                      showToast(
                        `Historial reemplazado con ${count} tasas históricas.`,
                        'success'
                      );
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border-input)] rounded-lg"
                  >
                    Reemplazar historial
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingRatesImport(null)}
                    className="px-3 py-1.5 text-xs text-[var(--text-secondary)]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {showRatesHistoryPanel && (
              <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Plantillas descargables y meses cargados
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        descargarPlantillaExcelTasas(
                          officialRate || appData.settings.defaultExchangeRate || 440
                        )
                      }
                      className="py-1.5 px-3 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border-input)] rounded-lg flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                      <span>Plantilla Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        descargarPlantillaJsonTasas(
                          officialRate || appData.settings.defaultExchangeRate || 440
                        )
                      }
                      className="py-1.5 px-3 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border-input)] rounded-lg flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                      <span>Plantilla JSON (.json)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJsonFormatGuide((prev) => !prev)}
                      className="py-1.5 px-3 text-xs font-medium text-[var(--pink-primary)] bg-[var(--pink-light)]/60 rounded-lg"
                    >
                      {showJsonFormatGuide ? 'Ocultar ejemplo' : 'Ver formato'}
                    </button>
                  </div>
                </div>

                {showJsonFormatGuide && (
                  <p className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface)] p-3 rounded-lg border border-[var(--border-hairline)]">
                    Tu archivo Excel o JSON solo necesita dos columnas o campos:{' '}
                    <code className="font-mono-tabular text-[var(--pink-primary)]">fecha</code> (ej.{' '}
                    <code className="font-mono-tabular">2026-08-01</code>) y{' '}
                    <code className="font-mono-tabular text-[var(--pink-primary)]">tasa</code> (ej.{' '}
                    <code className="font-mono-tabular">36.62</code>).
                  </p>
                )}

                {purchasingPowerSummary.tasasPromedioPorMes.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-[var(--border-hairline)] bg-[var(--surface)]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)]">
                          <th className="py-2 px-3">Mes</th>
                          <th className="py-2 px-3 text-right">Promedio</th>
                          <th className="py-2 px-3 text-right">Mín / Máx</th>
                          <th className="py-2 px-3 text-right">Registros</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-divider)]">
                        {purchasingPowerSummary.tasasPromedioPorMes
                          .slice(0, 6)
                          .map((m) => (
                            <tr key={m.monthKey}>
                              <td className="py-1.5 px-3 font-medium text-[var(--text-primary)]">
                                {formatearNombreMes(m.monthKey)} ({m.monthKey})
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono-tabular font-bold text-[var(--pink-primary)]">
                                {formatearTasa(m.averageRate, locale)} Bs
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono-tabular text-[var(--text-secondary)]">
                                {formatearTasa(m.minRate, locale)} /{' '}
                                {formatearTasa(m.maxRate, locale)} Bs
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono-tabular text-[var(--text-primary)]">
                                {m.sampleCount}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fila 3: Recalcular históricos en VES y Datos demostrativos */}
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-[var(--text-primary)] block">
                Utilidades de datos y demostración
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Carga datos de ejemplo para probar la app o recalcula movimientos antiguos en Bs
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRecalculateHistoricalVes}
                className="py-2 px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-subtle)] border border-[var(--border-hairline)] rounded-xl transition-colors"
              >
                Recalcular históricos VES
              </button>
              <button
                type="button"
                onClick={onLoadDemoData}
                className="py-2 px-3.5 text-xs font-semibold text-[var(--lavender-text)] bg-[var(--lavender-soft)] hover:opacity-90 rounded-xl transition-opacity inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Cargar datos de ejemplo</span>
              </button>
            </div>
          </div>

          {/* Fila 4: Zona de peligro — Borrar todos los datos */}
          <div className="px-6 py-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[var(--expense-color)] block">
                  Restablecer aplicación de fábrica
                </span>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Elimina todos los movimientos, ahorros, metas y cuentas guardadas en este navegador
                </p>
              </div>
              {deleteStep === 0 && (
                <button
                  type="button"
                  onClick={() => setDeleteStep(1)}
                  className="py-2 px-3.5 text-xs font-semibold text-[var(--expense-color)] bg-[var(--expense-bg)] hover:opacity-90 rounded-xl transition-opacity inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Borrar todos los datos</span>
                </button>
              )}
            </div>

            {deleteStep === 1 && (
              <div className="p-3.5 rounded-xl bg-[var(--expense-bg)] border border-[var(--expense-border)] space-y-2.5">
                <p className="text-xs text-[var(--expense-text-dark)] font-medium">
                  Confirmación 1 de 2: ¿Confirmas que deseas borrar todos tus movimientos, ahorros, metas y presupuestos?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--expense-color)] rounded-lg"
                  >
                    Sí, continuar al paso final
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    className="px-3 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--surface)] rounded-lg border border-[var(--border-input)]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="p-3.5 rounded-xl bg-[var(--expense-bg)] border border-[var(--expense-color)] space-y-2.5">
                <p className="text-xs text-[var(--expense-text-dark)] font-bold">
                  Confirmación definitiva (2 de 2): Esta acción eliminará todos los registros guardados. ¿Confirmas el borrado total?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const clean = createInitialAppData();
                      clean.settings.lastOfficialRate = officialRate;
                      clean.settings.lastOfficialRateDate =
                        appData.settings.lastOfficialRateDate;
                      clean.settings.themeMode = appData.settings.themeMode;
                      setAppData(clean);
                      setDeleteStep(0);
                      showToast(
                        'Todos los registros financieros fueron eliminados.',
                        'info'
                      );
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--expense-color)] rounded-lg"
                  >
                    Confirmar borrado definitivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    className="px-3 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--surface)] rounded-lg border border-[var(--border-input)]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instalación como Aplicación Móvil / Escritorio (PWA) */}
      <PWAInstallButton variant="card" />
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTE: SECCIÓN DE HERRAMIENTAS FINANCIERAS (TOOLS)
// Selector interactivo donde cada herramienta se abre bajo demanda al elegirla
// ============================================================================
interface ToolsModuleViewProps {
  appData: AppDataSchema;
  resumenBilleteras: {
    billeteras: ResumenBilleteraItem[];
    totalSaldoActualUsd: number;
    totalSaldoProyectadoUsd: number;
  };
  officialRate: number | null;
  locale: 'es-VE' | 'en-US';
  onOpenQuickCalculator: () => void;
  onNavigateToSection: (section: NavigationSection) => void;
  onRegisterExpense: (preset: PresetTransactionValues) => void;
}

type ToolId =
  | 'fee_calc'
  | 'implied_rate'
  | 'purchasing_power'
  | 'savings_proj';

const ToolsModuleView: React.FC<ToolsModuleViewProps> = ({
  appData,
  resumenBilleteras,
  officialRate,
  locale,
  onOpenQuickCalculator,
  onNavigateToSection,
  onRegisterExpense,
}) => {
  // Ninguna herramienta abierta por defecto: el usuario selecciona cuál abrir
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);

  const baseAnalysis = useMemo(
    () => calcularAnalisisPoderAdquisitivo(appData),
    [appData]
  );

  // Modo de saldo en Bs a evaluar: 'ves_wallets' | 'all_wallets' | 'custom'
  const [balanceMode, setBalanceMode] = useState<
    'ves_wallets' | 'all_wallets' | 'custom'
  >(() =>
    baseAnalysis.sumaBilleterasVesBs > 0 ? 'ves_wallets' : 'all_wallets'
  );
  const [customBsAmountStr, setCustomBsAmountStr] = useState<string>(() =>
    baseAnalysis.sumaBsEvaluada > 0
      ? baseAnalysis.sumaBsEvaluada.toFixed(2)
      : '50000'
  );

  // Modo de tasa de hace 30 días: 'monthly_avg' | 'select_month' | 'custom_rate'
  const [rate30dMode, setRate30dMode] = useState<
    'monthly_avg' | 'select_month' | 'custom_rate'
  >('monthly_avg');
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState<string>(
    () => baseAnalysis.mesAnteriorKey
  );
  const [customRate30dStr, setCustomRate30dStr] = useState<string>(() =>
    baseAnalysis.tasaPromedioHace30Dias.toFixed(2)
  );
  const [customCurrentRateStr, setCustomCurrentRateStr] = useState<string>('');

  // Mini simulador rápido de ahorro por meses dentro del hub de Tools
  const [quickSaveMonthlyAmount, setQuickSaveMonthlyAmount] =
    useState<string>('100');
  const [quickSaveMonths, setQuickSaveMonths] = useState<number>(6);

  // Calculadora de Tasa Aplicada / Implícita en un Pago ($ + Bs -> Tasa Bs/$)
  const [impliedUsdStr, setImpliedUsdStr] = useState<string>('200');
  const [impliedVesStr, setImpliedVesStr] = useState<string>(() => {
    const baseR = officialRate || appData.settings.defaultExchangeRate || 450;
    return (200 * baseR).toFixed(2);
  });

  // IDs de billeteras en Bs excluidas manualmente por el usuario dentro del Diagnóstico
  const [excludedVesWalletIds, setExcludedVesWalletIds] = useState<string[]>(
    []
  );

  // Filtrar solo billeteras personales (sin cuentas de amigos ni tarjeta de mamá) y excluir las desmarcadas
  const selectedVesWalletsSumBs = useMemo(() => {
    return baseAnalysis.billeterasVesDetalle
      .filter(
        (item) =>
          !item.wallet.isThirdPartyExpenseAccount &&
          !item.wallet.isPassThroughAccount &&
          !excludedVesWalletIds.includes(item.wallet.id)
      )
      .reduce((acc, item) => acc + item.saldoNominalVes, 0);
  }, [baseAnalysis.billeterasVesDetalle, excludedVesWalletIds]);

  const parseNumberInput = (raw: string): number => {
    const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
    if (!cleaned) return NaN;
    return Number(cleaned);
  };

  const effectiveAnalysis: AnalisisPoderAdquisitivoResult = useMemo(() => {
    let customAmountBs: number | undefined = undefined;
    let scope: 'ves_wallets_only' | 'all_wallets' | undefined = undefined;

    if (balanceMode === 'ves_wallets') {
      scope = 'ves_wallets_only';
      customAmountBs = selectedVesWalletsSumBs;
    } else if (balanceMode === 'all_wallets') {
      scope = 'all_wallets';
      customAmountBs = baseAnalysis.sumaTodasBilleterasBs;
    } else if (balanceMode === 'custom') {
      const parsed = parseNumberInput(customBsAmountStr);
      customAmountBs = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }

    let customPrevMonthRate: number | undefined = undefined;
    if (rate30dMode === 'select_month') {
      const foundMonth = baseAnalysis.tasasPromedioPorMes.find(
        (m) => m.monthKey === selectedHistoryMonth
      );
      if (foundMonth && foundMonth.averageRate > 0) {
        customPrevMonthRate = foundMonth.averageRate;
      }
    } else if (rate30dMode === 'custom_rate') {
      const parsedRate = parseNumberInput(customRate30dStr);
      if (Number.isFinite(parsedRate) && parsedRate > 0) {
        customPrevMonthRate = parsedRate;
      }
    }

    const parsedCurrent = parseNumberInput(customCurrentRateStr);
    const customCurrentRate =
      Number.isFinite(parsedCurrent) && parsedCurrent > 0
        ? parsedCurrent
        : undefined;

    return calcularAnalisisPoderAdquisitivo(appData, {
      customAmountBs,
      customPrevMonthRate,
      customCurrentRate,
      scope,
    });
  }, [
    appData,
    baseAnalysis,
    balanceMode,
    selectedVesWalletsSumBs,
    customBsAmountStr,
    rate30dMode,
    selectedHistoryMonth,
    customRate30dStr,
    customCurrentRateStr,
  ]);

  const parsedQuickSaveAmount = useMemo(() => {
    const n = parseNumberInput(quickSaveMonthlyAmount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [quickSaveMonthlyAmount]);

  const quickSaveTotal = parsedQuickSaveAmount * quickSaveMonths;

  const toolCatalog: {
    id: ToolId;
    title: string;
    subtitle: string;
    badge: string;
    icon: React.ReactNode;
    accentClass: string;
  }[] = [
    {
      id: 'fee_calc',
      title: 'Pago Móvil vs. Transferencia',
      subtitle:
        'Compara la comisión bancaria en Bolívares y descubre con cuál método pagas menos antes de transferir.',
      badge: 'Comisiones Bs',
      icon: <ArrowLeftRight className="w-5 h-5" />,
      accentClass:
        'bg-[var(--pink-light)] text-[var(--pink-primary)] border-[var(--pink-primary)]/25',
    },
    {
      id: 'implied_rate',
      title: 'Calculadora de Tasa Aplicada ($ y Bs → Tasa)',
      subtitle:
        'Ingresa cuántos dólares eran y cuántos bolívares pagaste o recibiste para saber exactamente a qué tasa te cobraron.',
      badge: '¿A qué tasa fue?',
      icon: <Calculator className="w-5 h-5" />,
      accentClass:
        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'purchasing_power',
      title: 'Diagnóstico de Poder Adquisitivo',
      subtitle:
        'Analiza cuánto valor en USD han conservado o perdido tus Bolívares frente a la tasa promedio de hace 30 días.',
      badge: 'Inflación y Tasas',
      icon: <AlertTriangle className="w-5 h-5" />,
      accentClass:
        'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    },
    {
      id: 'savings_proj',
      title: 'Proyector de Ahorro por Tiempo',
      subtitle:
        'Simula cuánto capital en dólares reunirás ahorrando una cuota fija mensual durante el plazo que elijas.',
      badge: 'Metas en USD',
      icon: <PiggyBank className="w-5 h-5" />,
      accentClass:
        'bg-[var(--lavender-soft)] text-[var(--lavender-text)] border-[var(--lavender-accent)]/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado limpio de Herramientas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-[var(--pink-light)] text-[var(--pink-primary)]">
              Caja de Herramientas
            </span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            Herramientas y Calculadoras Financieras
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl">
            Selecciona la herramienta que necesitas utilizar para abrirla en pantalla sin distracciones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedTool !== null && (
            <button
              type="button"
              onClick={() => setSelectedTool(null)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
            >
              ← Ver todas las herramientas
            </button>
          )}
          <button
            type="button"
            onClick={onOpenQuickCalculator}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] text-white transition-colors shadow-xs"
          >
            <Calculator className="w-4 h-4" />
            <span>Conversor Rápido $ ⇄ Bs</span>
          </button>
        </div>
      </div>

      {/* Selector rápido en barra cuando ya hay una herramienta abierta */}
      {selectedTool !== null && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)]">
          {toolCatalog.map((tool) => {
            const isActive = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setSelectedTool(tool.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-[var(--pink-primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                }`}
              >
                {tool.icon}
                <span>{tool.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* VISTA CATÁLOGO: Tarjetas limpias para elegir y abrir una herramienta a la vez */}
      {selectedTool === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {toolCatalog.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setSelectedTool(tool.id)}
              className="group bg-[var(--surface)] hover:bg-[var(--surface-subtle)]/70 p-5 rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50 text-left transition-all flex flex-col justify-between gap-4 shadow-2xs"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${tool.accentClass}`}
                  >
                    {tool.icon}
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-hairline)]">
                    {tool.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--pink-primary)] transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
                    {tool.subtitle}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-divider)] flex items-center justify-between text-xs font-semibold text-[var(--pink-primary)]">
                <span>Abrir herramienta</span>
                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
            </button>
          ))}

          {/* Tarjeta #5: Acceso directo al Conversor Cambiario Rápido USD ⇄ Bs */}
          <button
            type="button"
            onClick={onOpenQuickCalculator}
            className="group md:col-span-2 bg-[var(--surface)] hover:bg-[var(--surface-subtle)]/70 p-5 rounded-2xl border border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50 text-left transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[var(--pink-light)] text-[var(--pink-primary)] border border-[var(--pink-primary)]/25 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--pink-primary)] transition-colors">
                    Conversor Cambiario Rápido USD ⇄ Bolívares
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono-tabular font-semibold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-hairline)]">
                    1 USD = {formatearTasa(baseAnalysis.tasaActual, locale)} Bs
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Abre la calculadora flotante para convertir al instante entre Dólares y Bolívares con la tasa BCV o personalizada.
                </p>
              </div>
            </div>
            <span className="px-4 py-2 rounded-xl bg-[var(--pink-primary)] text-white text-xs font-semibold shrink-0 self-start sm:self-auto">
              Abrir conversor →
            </span>
          </button>
        </div>
      )}

      {/* HERRAMIENTA 1: CALCULADORA RÁPIDA PAGO MÓVIL VS TRANSFERENCIA */}
      {selectedTool === 'fee_calc' && (
        <QuickPaymentFeeCalculator
          wallets={appData.wallets || []}
          walletSummaries={resumenBilleteras.billeteras}
          officialRate={officialRate}
          defaultManualRate={appData.settings.defaultExchangeRate}
          locale={locale}
          onRegisterExpense={onRegisterExpense}
          onNavigateToWallets={() => onNavigateToSection('wallets')}
        />
      )}

      {/* HERRAMIENTA 2: CALCULADORA DE TASA APLICADA EN UN PAGO ($ + Bs -> ¿A qué tasa me cobraron/pagaron?) */}
      {selectedTool === 'implied_rate' &&
        (() => {
          const usdAmount = parseNumberInput(impliedUsdStr);
          const vesAmount = parseNumberInput(impliedVesStr);
          const validInputs =
            Number.isFinite(usdAmount) &&
            usdAmount > 0 &&
            Number.isFinite(vesAmount) &&
            vesAmount > 0;
          const calculatedRate = validInputs ? vesAmount / usdAmount : 0;

          const bcvRef = officialRate && officialRate > 0 ? officialRate : null;
          const manualRef =
            appData.settings.defaultExchangeRate &&
            appData.settings.defaultExchangeRate > 0
              ? appData.settings.defaultExchangeRate
              : null;

          const diffVsBcvRate =
            validInputs && bcvRef ? calculatedRate - bcvRef : null;
          const pctVsBcv =
            validInputs && bcvRef
              ? ((calculatedRate - bcvRef) / bcvRef) * 100
              : null;
          const expectedVesAtBcv =
            validInputs && bcvRef ? usdAmount * bcvRef : null;
          const diffVesVsBcv =
            validInputs && expectedVesAtBcv !== null
              ? vesAmount - expectedVesAtBcv
              : null;
          const equivUsdAtBcv =
            validInputs && bcvRef ? vesAmount / bcvRef : null;

          return (
            <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Calculator className="w-4 h-4" />
                    </span>
                    <h3 className="text-xl font-bold font-editorial text-[var(--text-primary)]">
                      Calculadora de Tasa Aplicada en un Pago ($ y Bs → Tasa)
                    </h3>
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-emerald-600 text-white">
                      ¿A qué tasa me pagaron / cobraron?
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] max-w-3xl">
                    Ingresa cuántos <strong>Dólares ($)</strong> eran (ej. $200) y cuántos <strong>Bolívares (Bs)</strong> te pasaron o cobraron para descubrir al instante qué tasa exacta (Bs/$) aplicaron en esa operación.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Entradas: Monto en $ y Monto en Bs */}
                <div className="lg:col-span-6 p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                        Monto acordado en Dólares ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[var(--income-color)]">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={impliedUsdStr}
                          onChange={(e) => setImpliedUsdStr(e.target.value)}
                          placeholder="Ej. 200"
                          className="w-full pl-8 pr-3 py-2.5 text-base font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                        Monto pagado / recibido en Bolívares (Bs)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-[var(--pink-primary)]">
                          Bs
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={impliedVesStr}
                          onChange={(e) => setImpliedVesStr(e.target.value)}
                          placeholder="Ej. 90000"
                          className="w-full pl-9 pr-3 py-2.5 text-base font-mono-tabular font-bold rounded-xl bg-[var(--surface)] border border-[var(--border-input)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Botones rápidos de montos frecuentes en $ */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      Montos rápidos en $:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[10, 20, 50, 100, 200, 500].map((presetUsd) => (
                        <button
                          key={presetUsd}
                          type="button"
                          onClick={() => setImpliedUsdStr(String(presetUsd))}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono-tabular font-semibold border transition-colors ${
                            Number(impliedUsdStr.replace(',', '.')) ===
                            presetUsd
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          ${presetUsd}
                        </button>
                      ))}
                    </div>
                  </div>

                  {bcvRef && validInputs && (
                    <div className="pt-2 border-t border-[var(--border-divider)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>
                        Si fuera a tasa BCV ({formatearTasa(bcvRef, locale)} Bs/$):
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setImpliedVesStr((usdAmount * bcvRef).toFixed(2))
                        }
                        className="font-mono-tabular font-bold text-[var(--pink-primary)] hover:underline"
                        title="Haz clic para poner este monto en Bs"
                      >
                        Serían {formatearMonto(usdAmount * bcvRef, 'VES', locale)}
                      </button>
                    </div>
                  )}
                </div>

                {/* Resultado: Tasa Calculada y Comparativa */}
                <div className="lg:col-span-6 p-5 rounded-2xl bg-[var(--surface-subtle)] border-2 border-[var(--border-input)] flex flex-col justify-between space-y-4">
                  {validInputs ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                            Tasa exacta aplicada en el pago
                          </span>
                          <div className="text-3xl sm:text-4xl font-extrabold font-mono-tabular text-[var(--text-primary)] mt-1">
                            {formatearTasa(calculatedRate, locale)}{' '}
                            <span className="text-base font-bold text-[var(--income-color)]">
                              Bs / $
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono-tabular">
                            Fórmula: {formatearMonto(vesAmount, 'VES', locale)} ÷{' '}
                            {formatearMonto(usdAmount, 'USD', locale)}
                          </p>
                        </div>

                        {pctVsBcv !== null && (
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-mono-tabular font-bold ${
                              Math.abs(pctVsBcv) < 0.05
                                ? 'bg-emerald-600 text-white'
                                : pctVsBcv > 0
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-sky-600 text-white'
                            }`}
                          >
                            {Math.abs(pctVsBcv) < 0.05
                              ? 'Exactamente Tasa BCV'
                              : `${pctVsBcv > 0 ? '+' : ''}${pctVsBcv.toFixed(2)}% vs BCV`}
                          </span>
                        )}
                      </div>

                      {bcvRef &&
                        diffVsBcvRate !== null &&
                        diffVesVsBcv !== null &&
                        equivUsdAtBcv !== null && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-[var(--border-divider)] text-xs">
                            <div className="p-2.5 rounded-xl bg-[var(--surface)]/80 border border-[var(--border-hairline)]">
                              <span className="text-[10px] text-[var(--text-secondary)] block">
                                Diferencia de tasa vs. BCV (
                                {formatearTasa(bcvRef, locale)}):
                              </span>
                              <strong className="font-mono-tabular text-sm text-[var(--text-primary)]">
                                {diffVsBcvRate >= 0 ? '+' : ''}
                                {formatearTasa(diffVsBcvRate, locale)} Bs por
                                cada $
                              </strong>
                            </div>

                            <div className="p-2.5 rounded-xl bg-[var(--surface)]/80 border border-[var(--border-hairline)]">
                              <span className="text-[10px] text-[var(--text-secondary)] block">
                                Esos Bs a tasa BCV equivalen a:
                              </span>
                              <strong className="font-mono-tabular text-sm text-[var(--text-primary)]">
                                {formatearMonto(equivUsdAtBcv, 'USD', locale)}{' '}
                                <span className="text-[11px] font-normal text-[var(--text-secondary)]">
                                  ({diffVesVsBcv >= 0 ? '+' : ''}
                                  {formatearMonto(diffVesVsBcv, 'VES', locale)})
                                </span>
                              </strong>
                            </div>
                          </div>
                        )}

                      {manualRef && (
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1">
                          <span>
                            Comparación vs. tu Tasa Manual (
                            {formatearTasa(manualRef, locale)} Bs/$):
                          </span>
                          <strong className="font-mono-tabular text-[var(--text-primary)]">
                            {calculatedRate - manualRef >= 0 ? '+' : ''}
                            {formatearTasa(calculatedRate - manualRef, locale)}{' '}
                            Bs/$ (
                            {(
                              ((calculatedRate - manualRef) / manualRef) *
                              100
                            ).toFixed(2)}
                            %)
                          </strong>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-xs text-[var(--text-secondary)]">
                      Ingresa un monto mayor a 0 en <strong>Dólares ($)</strong>{' '}
                      y en <strong>Bolívares (Bs)</strong> para ver la tasa
                      exacta que usaron.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* HERRAMIENTA 3: ALERTA DE PODER ADQUISITIVO */}
      {selectedTool === 'purchasing_power' && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[var(--expense-bg)] text-[var(--expense-color)] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <h3 className="text-xl font-bold font-editorial text-[var(--text-primary)]">
                  Alerta de Poder Adquisitivo
                </h3>
                <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-[var(--lavender-soft)] text-[var(--lavender-text)]">
                  Tasa Promedio Mensual
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-3xl">
                Evalúa cuánto poder de compra en dólares han perdido o conservado tus Bolívares comparando la tasa actual frente a la <strong>tasa promedio por mes</strong> de hace 30 días, evitando que picos aislados distorsionen la realidad.
              </p>
            </div>
          </div>

          {/* Tarjeta protagonista con el mensaje dinámico exacto */}
          <div
            className={`p-5 sm:p-6 rounded-2xl border-2 space-y-3 ${
              effectiveAnalysis.porcentajePerdidaValor > 0
                ? 'bg-[var(--expense-bg)]/70 border-[var(--expense-border)]'
                : 'bg-[var(--income-bg)]/60 border-[var(--income-border)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <span>Diagnóstico dinámico de poder adquisitivo</span>
              <span className="font-mono-tabular">
                Comparativa: Hoy vs. Hace 30 días
              </span>
            </div>

            <p className="text-base sm:text-lg font-medium text-[var(--text-primary)] leading-relaxed">
              «Tus{' '}
              <strong className="font-mono-tabular font-bold text-[var(--text-primary)] underline decoration-[var(--pink-primary)]/50 underline-offset-4">
                {formatearMonto(effectiveAnalysis.sumaBsEvaluada, 'VES', locale)}
              </strong>{' '}
              hoy equivalen a{' '}
              <strong className="font-mono-tabular font-bold text-[var(--pink-primary)]">
                {formatearMonto(
                  effectiveAnalysis.equivalenteHoyUsd,
                  'USD',
                  locale
                )}{' '}
                USD
              </strong>
              , pero hace un mes equivalían a{' '}
              <strong className="font-mono-tabular font-bold text-[var(--text-primary)]">
                {formatearMonto(
                  effectiveAnalysis.equivalenteHaceUnMesUsd,
                  'USD',
                  locale
                )}{' '}
                USD
              </strong>
              .{' '}
              {effectiveAnalysis.porcentajePerdidaValor >= 0 ? (
                <span className="font-bold text-[var(--expense-color)]">
                  Tu dinero ha perdido un{' '}
                  <span className="font-mono-tabular">
                    {formatearPorcentaje(
                      effectiveAnalysis.porcentajePerdidaValor,
                      2,
                      locale
                    )}
                  </span>{' '}
                  de su valor.
                </span>
              ) : (
                <span className="font-bold text-[var(--income-color)]">
                  Tu dinero ha ganado un{' '}
                  <span className="font-mono-tabular">
                    {formatearPorcentaje(
                      Math.abs(effectiveAnalysis.porcentajePerdidaValor),
                      2,
                      locale
                    )}
                  </span>{' '}
                  de su valor.
                </span>
              )}
              »
            </p>
          </div>

          {/* Controles interactivos de la herramienta */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Columna 1: Selección del Saldo en Bolívares */}
            <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  1. Saldo en Bolívares a evaluar
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Elige si deseas analizar tus billeteras en Bs, el total de tus billeteras expresado en Bs, o simular un monto específico.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceMode('ves_wallets')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    balanceMode === 'ves_wallets'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-semibold">
                    Billeteras en Bs (VES)
                  </div>
                  <div className="text-xs font-mono-tabular font-bold mt-1 truncate">
                    {formatearMonto(selectedVesWalletsSumBs, 'VES', locale)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBalanceMode('all_wallets')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    balanceMode === 'all_wallets'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-semibold">
                    Todas mis billeteras
                  </div>
                  <div className="text-xs font-mono-tabular font-bold mt-1 truncate">
                    {formatearMonto(
                      baseAnalysis.sumaTodasBilleterasBs,
                      'VES',
                      locale
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBalanceMode('custom')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    balanceMode === 'custom'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-semibold">
                    Simular monto en Bs
                  </div>
                  <div className="text-xs font-mono-tabular font-bold mt-1 truncate">
                    Personalizado
                  </div>
                </button>
              </div>

              {balanceMode === 'custom' && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Escribe la cantidad en Bolívares (Bs) a evaluar:
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customBsAmountStr}
                    onChange={(e) => setCustomBsAmountStr(e.target.value)}
                    placeholder="Ej: 150000"
                    className="w-full px-3.5 py-2.5 text-sm font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
                  />
                </div>
              )}

              {/* Desglose y selector interactivo de billeteras personales en VES */}
              <div className="pt-2 border-t border-[var(--border-divider)] space-y-2">
                <div className="flex items-center justify-between text-xs gap-2">
                  <div>
                    <span className="font-semibold text-[var(--text-secondary)] block">
                      Tus billeteras personales en Bolívares (VES):
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      Toca una cuenta para incluirla o excluirla del cálculo (se omiten cuentas de amigos y terceros).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToSection('wallets')}
                    className="text-[11px] font-medium text-[var(--pink-primary)] hover:underline shrink-0"
                  >
                    Gestionar billeteras →
                  </button>
                </div>
                {baseAnalysis.billeterasVesDetalle.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">
                    No tienes billeteras personales configuradas en moneda VES actualmente.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {baseAnalysis.billeterasVesDetalle.map((item) => {
                      const isIncluded = !excludedVesWalletIds.includes(
                        item.wallet.id
                      );
                      return (
                        <button
                          key={item.wallet.id}
                          type="button"
                          onClick={() => {
                            setBalanceMode('ves_wallets');
                            setExcludedVesWalletIds((prev) =>
                              prev.includes(item.wallet.id)
                                ? prev.filter((id) => id !== item.wallet.id)
                                : [...prev, item.wallet.id]
                            );
                          }}
                          className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between text-xs transition-all text-left ${
                            isIncluded
                              ? 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/40'
                              : 'bg-[var(--surface)]/40 border-[var(--border-hairline)]/50 opacity-55'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isIncluded}
                              readOnly
                              className="w-3.5 h-3.5 rounded accent-[var(--pink-primary)] pointer-events-none shrink-0"
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.wallet.color }}
                            />
                            <span
                              className={`font-medium truncate ${
                                isIncluded
                                  ? 'text-[var(--text-primary)]'
                                  : 'text-[var(--text-secondary)] line-through'
                              }`}
                            >
                              {item.wallet.name}
                            </span>
                          </div>
                          <div className="text-right font-mono-tabular shrink-0">
                            <span className="font-semibold text-[var(--text-primary)]">
                              {formatearMonto(
                                item.saldoNominalVes,
                                'VES',
                                locale
                              )}
                            </span>
                            <span className="text-[11px] text-[var(--text-secondary)] ml-2">
                              (
                              {formatearMonto(
                                item.saldoActualUsd,
                                'USD',
                                locale
                              )}
                              )
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Columna 2: Configuración de Tasas (Tasa promedio mensual vs Tasa actual) */}
            <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  2. Tasa de cambio de hace 30 días (Promedio mensual)
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Usamos el promedio mensual de tus tasas registradas para evitar distorsiones por variaciones bruscas de un solo día.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRate30dMode('monthly_avg')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    rate30dMode === 'monthly_avg'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-semibold">
                    Promedio hace 30d
                  </div>
                  <div className="text-xs font-mono-tabular font-bold mt-1">
                    {formatearTasa(baseAnalysis.tasaPromedioHace30Dias, locale)}{' '}
                    Bs
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRate30dMode('select_month')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    rate30dMode === 'select_month'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-semibold">
                    Elegir mes del historial
                  </div>
                  <div className="text-xs font-mono-tabular font-bold mt-1 truncate">
                    {baseAnalysis.tasasPromedioPorMes.length} mes(es)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRate30dMode('custom_rate')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    rate30dMode === 'custom_rate'
                      ? 'bg-[var(--pink-primary)] text-white border-[var(--pink-primary)]'
                      : 'bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--pink-primary)]/50'
                  }`}
                >
                  <div className="text-[11px] font-semibold">
                    Tasa manual / Exacta
                  </div>
                  <div className="text-xs font-mono-tabular font-bold mt-1">
                    {baseAnalysis.tasaExactaHace30Dias
                      ? `${formatearTasa(baseAnalysis.tasaExactaHace30Dias, locale)} Bs`
                      : 'Personalizada'}
                  </div>
                </button>
              </div>

              {baseAnalysis.tasaExactaHace30Dias && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs">
                  <span className="text-[var(--text-secondary)]">
                    Tasa exacta registrada hace ~30 días (
                    {baseAnalysis.fechaExactaHace30Dias}):{' '}
                    <strong className="font-mono-tabular text-[var(--text-primary)]">
                      {formatearTasa(baseAnalysis.tasaExactaHace30Dias, locale)}{' '}
                      Bs/USD
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRate30dMode('custom_rate');
                      setCustomRate30dStr(
                        String(baseAnalysis.tasaExactaHace30Dias)
                      );
                    }}
                    className="text-[11px] font-semibold text-[var(--pink-primary)] hover:underline shrink-0"
                  >
                    Usar esta tasa exacta
                  </button>
                </div>
              )}

              {rate30dMode === 'select_month' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Selecciona el mes cuyo promedio deseas comparar:
                  </label>
                  <select
                    value={selectedHistoryMonth}
                    onChange={(e) => setSelectedHistoryMonth(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
                  >
                    {baseAnalysis.tasasPromedioPorMes.map((m) => (
                      <option key={m.monthKey} value={m.monthKey}>
                        {formatearNombreMes(m.monthKey)} — Promedio:{' '}
                        {formatearTasa(m.averageRate, locale)} Bs/USD (
                        {m.sampleCount} reg.)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {rate30dMode === 'custom_rate' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">
                    Tasa de cambio de hace 30 días (Bs por 1 USD):
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customRate30dStr}
                    onChange={(e) => setCustomRate30dStr(e.target.value)}
                    placeholder="Ej: 58.50"
                    className="w-full px-3.5 py-2.5 text-sm font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-[var(--border-divider)] space-y-1.5">
                <label className="block text-xs font-medium text-[var(--text-secondary)]">
                  Tasa actual de referencia (Opcional: déjalo vacío para usar la tasa activa{' '}
                  {formatearTasa(baseAnalysis.tasaActual, locale)} Bs/USD):
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customCurrentRateStr}
                  onChange={(e) => setCustomCurrentRateStr(e.target.value)}
                  placeholder={`Usando tasa activa: ${formatearTasa(
                    baseAnalysis.tasaActual,
                    locale
                  )} Bs/USD`}
                  className="w-full px-3.5 py-2 text-xs font-mono-tabular rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--pink-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Tasas Promedio por Mes */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  Historial de Tasa Promedio por Mes (Anti-distorsión)
                </h4>
                <p className="text-xs text-[var(--text-secondary)]">
                  Calculado automáticamente a partir de las tasas de tus movimientos, ahorros, préstamos y consultas BCV de cada mes.
                </p>
              </div>
            </div>

            {baseAnalysis.tasasPromedioPorMes.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">
                Aún no hay suficientes registros con tasa de cambio por mes.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)]">
                      <th className="py-2.5 px-4">Mes</th>
                      <th className="py-2.5 px-4 text-right">
                        Tasa Promedio Mensual
                      </th>
                      <th className="py-2.5 px-4 text-right">Mínima del mes</th>
                      <th className="py-2.5 px-4 text-right">Máxima del mes</th>
                      <th className="py-2.5 px-4 text-right">Muestras</th>
                      <th className="py-2.5 px-4 text-right">
                        Equivalente de tus Bs
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-divider)]">
                    {baseAnalysis.tasasPromedioPorMes.map((m) => {
                      const eqUsd =
                        m.averageRate > 0
                          ? effectiveAnalysis.sumaBsEvaluada / m.averageRate
                          : 0;
                      const isReferenceMonth =
                        m.monthKey === effectiveAnalysis.mesAnteriorKey;
                      return (
                        <tr
                          key={m.monthKey}
                          className={`hover:bg-[var(--surface-subtle)]/60 ${
                            isReferenceMonth ? 'bg-[var(--pink-light)]/25' : ''
                          }`}
                        >
                          <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                            <span>{formatearNombreMes(m.monthKey)}</span>
                            {isReferenceMonth && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-[var(--pink-light)] text-[var(--pink-primary)] font-semibold">
                                Referencia 30 días
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[var(--pink-primary)]">
                            1 USD = {formatearTasa(m.averageRate, locale)} Bs
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-[var(--text-secondary)]">
                            {formatearTasa(m.minRate, locale)} Bs
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-[var(--text-secondary)]">
                            {formatearTasa(m.maxRate, locale)} Bs
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-[var(--text-secondary)]">
                            {m.sampleCount}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-[var(--text-primary)]">
                            {formatearMonto(eqUsd, 'USD', locale)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HERRAMIENTA 4: PROYECTOR DE AHORRO POR TIEMPO */}
      {selectedTool === 'savings_proj' && (
        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] space-y-5">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)] flex items-center justify-center shrink-0">
                <PiggyBank className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Proyector de Ahorro por Tiempo
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Calcula cuánto reunirás ahorrando un monto fijo mensual durante los meses que elijas.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Monto a reunir por mes (USD)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={quickSaveMonthlyAmount}
                onChange={(e) => setQuickSaveMonthlyAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-[var(--text-secondary)]">
                  Plazo de ahorro:
                </span>
                <span className="font-mono-tabular font-bold text-[var(--pink-primary)]">
                  {quickSaveMonths} {quickSaveMonths === 1 ? 'mes' : 'meses'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={quickSaveMonths}
                onChange={(e) => setQuickSaveMonths(Number(e.target.value))}
                className="w-full accent-[var(--pink-primary)] cursor-pointer mt-2"
              />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[var(--text-secondary)]">
              En <strong>{quickSaveMonths}</strong>{' '}
              {quickSaveMonths === 1 ? 'mes' : 'meses'} habrás reunido (
              {formatearMonto(parsedQuickSaveAmount, 'USD', locale)} ×{' '}
              {quickSaveMonths}):
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-[var(--income-color)]">
              {formatearMonto(quickSaveTotal, 'USD', locale)}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border-divider)] flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">
              Puedes crear metas de ahorro específicas en el módulo Mis Ahorros
            </span>
            <button
              type="button"
              onClick={() => onNavigateToSection('savings')}
              className="font-semibold text-[var(--pink-primary)] hover:underline"
            >
              Ir a Mis ahorros →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
