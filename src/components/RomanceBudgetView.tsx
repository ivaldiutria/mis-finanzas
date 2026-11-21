import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Coffee,
  Film,
  Gift,
  Heart,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import {
  AppDataSchema,
  CurrencyCode,
  RomanceFundMovement,
  RomanceRouletteSuggestion,
} from '../types/finance';
import { StorageService } from '../utils/storage';
import {
  compararRegistrosConHoraRecientesPrimero,
  obtenerFechaLocalIso,
  obtenerInfoHoraProcesoTransaccion,
} from '../utils/calculations';
import { formatearMonto, formatearTasa } from '../services/bcvApi';

interface RomanceBudgetViewProps {
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  effectiveConversionRate: number | null;
  locale: 'es-VE' | 'en-US';
  showToast: (text: string, kind?: 'success' | 'error' | 'info') => void;
}

export const RomanceBudgetView: React.FC<RomanceBudgetViewProps> = ({
  appData,
  setAppData,
  effectiveConversionRate,
  locale,
  showToast,
}) => {
  const activeRate =
    effectiveConversionRate ||
    appData.settings.lastOfficialRate ||
    appData.settings.defaultExchangeRate ||
    450;

  const activeWallets = useMemo(
    () => (appData.wallets || []).filter((w) => w.active),
    [appData.wallets]
  );

  const romanceFund = useMemo(
    () => appData.romanceFund || { balanceUsd: 0, movements: [] },
    [appData.romanceFund]
  );

  // Estado de la Ruleta de Citas
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [currentSuggestion, setCurrentSuggestion] =
    useState<RomanceRouletteSuggestion | null>(null);

  // Modal: Asignar dinero al Fondo de Citas
  const [allocateModalOpen, setAllocateModalOpen] = useState<boolean>(false);
  const [allocDate, setAllocDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [allocAmountInput, setAllocAmountInput] = useState<string>('');
  const [allocCurrency, setAllocCurrency] = useState<CurrencyCode>('USD');
  const [allocRateInput, setAllocRateInput] = useState<string>(() =>
    String(activeRate)
  );
  const [allocWalletId, setAllocWalletId] = useState<string>(
    () => activeWallets[0]?.id || ''
  );
  const [allocNotes, setAllocNotes] = useState<string>('');

  // Modal: Gastar Fondo de Citas
  const [spendModalOpen, setSpendModalOpen] = useState<boolean>(false);
  const [spendDate, setSpendDate] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [spendAmountInput, setSpendAmountInput] = useState<string>('');
  const [spendCurrency, setSpendCurrency] = useState<CurrencyCode>('USD');
  const [spendRateInput, setSpendRateInput] = useState<string>(() =>
    String(activeRate)
  );
  const [spendWalletId, setSpendWalletId] = useState<string>(
    () => activeWallets[0]?.id || ''
  );
  const [spendPlanName, setSpendPlanName] = useState<string>('');
  const [spendMemoryNotes, setSpendMemoryNotes] = useState<string>('');

  const currentBracketInfo = useMemo(() => {
    const bal = romanceFund.balanceUsd;
    if (bal > 30) {
      return {
        id: 'high',
        badge: 'Tramo > $30 USD · Cena / Especial',
        short: 'Cena / Especial',
        colorClass: 'bg-[#F6E6EA] text-[#9B475E] border-[#E8C5D0]',
      };
    }
    if (bal >= 10) {
      return {
        id: 'mid',
        badge: 'Tramo $10 – $30 USD · Cine / Hamburguesas',
        short: 'Cine / Hamburguesas',
        colorClass: 'bg-[#EAE4F2] text-[#62517D] border-[#D8CCF0]',
      };
    }
    return {
      id: 'low',
      badge: 'Tramo < $10 USD · Helados / Caminar',
      short: 'Helados / Caminar',
      colorClass: 'bg-[#FDECE8] text-[#B94E36] border-[#F9C6BA]',
    };
  }, [romanceFund.balanceUsd]);

  const handleSpinRoulette = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    const extraSpins = 1080 + Math.floor(Math.random() * 720);
    setWheelRotation((prev) => prev + extraSpins);

    setTimeout(() => {
      const suggestion = StorageService.spinRomanceRoulette(
        romanceFund.balanceUsd,
        currentSuggestion?.planTitle
      );
      setCurrentSuggestion(suggestion);
      setIsSpinning(false);
    }, 650);
  };

  const handleOpenAllocateModal = () => {
    setAllocDate(obtenerFechaLocalIso());
    setAllocAmountInput('');
    setAllocCurrency('USD');
    setAllocRateInput(String(activeRate));
    setAllocWalletId(activeWallets[0]?.id || '');
    setAllocNotes('');
    setAllocateModalOpen(true);
  };

  const handleOpenSpendModal = (prefillPlan?: string) => {
    setSpendDate(obtenerFechaLocalIso());
    setSpendAmountInput(
      romanceFund.balanceUsd > 0 ? String(romanceFund.balanceUsd) : ''
    );
    setSpendCurrency('USD');
    setSpendRateInput(String(activeRate));
    setSpendWalletId(activeWallets[0]?.id || '');
    setSpendPlanName(
      prefillPlan ||
        currentSuggestion?.planTitle ||
        currentBracketInfo.short
    );
    setSpendMemoryNotes('');
    setSpendModalOpen(true);
  };

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(allocAmountInput.replace(',', '.'));
    const parsedRate = Number(allocRateInput.replace(',', '.'));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast('Ingresa un monto válido para asignar al Fondo de Citas.', 'error');
      return;
    }

    try {
      const { updatedData, movement } = StorageService.allocateToRomanceFund(
        {
          date: allocDate,
          amount: parsedAmount,
          currency: allocCurrency,
          exchangeRate:
            allocCurrency === 'VES' && parsedRate > 0 ? parsedRate : activeRate,
          walletId: allocWalletId,
          notes: allocNotes,
        },
        appData
      );
      setAppData(updatedData);
      setAllocateModalOpen(false);
      showToast(
        `Se asignaron ${formatearMonto(
          movement.amountUsd,
          'USD',
          locale
        )} al Fondo de Citas (apartados de tu Saldo General Disponible).`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudo asignar el monto al Fondo de Citas.',
        'error'
      );
    }
  };

  const handleSpendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(spendAmountInput.replace(',', '.'));
    const parsedRate = Number(spendRateInput.replace(',', '.'));

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast('Ingresa un monto mayor que cero para gastar.', 'error');
      return;
    }

    try {
      const { updatedData, movement } = StorageService.spendFromRomanceFund(
        {
          date: spendDate,
          amount: parsedAmount,
          currency: spendCurrency,
          exchangeRate:
            spendCurrency === 'VES' && parsedRate > 0 ? parsedRate : activeRate,
          walletId: spendWalletId,
          planName: spendPlanName,
          notes: spendMemoryNotes,
        },
        appData
      );
      setAppData(updatedData);
      setSpendModalOpen(false);
      showToast(
        `¡Cita registrada! Se descontaron ${formatearMonto(
          movement.amountUsd,
          'USD',
          locale
        )} del Fondo de Citas y se registró el egreso general.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar el gasto del Fondo de Citas.',
        'error'
      );
    }
  };

  const handleDeleteMovement = (mov: RomanceFundMovement) => {
    const updatedData = StorageService.deleteRomanceFundMovement(
      mov.id,
      appData
    );
    setAppData(updatedData);
    showToast('Registro eliminado del Fondo de Citas.', 'info');
  };

  const getWalletName = (id?: string) =>
    (appData.wallets || []).find((w) => w.id === id)?.name || 'General';

  return (
    <div className="space-y-7">
      {/* Cabecera Romántica / Pastel */}
      <div className="p-6 sm:p-8 rounded-3xl border border-[#E8C5D0]/70 bg-gradient-to-br from-[#FAF5F6] via-[#FDFBF9] to-[#F2EFF8] dark:from-[#251C20] dark:via-[#1C1518] dark:to-[#261E33] dark:border-[#45333A] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F6E6EA] dark:bg-[#3D1821] text-[#C86D85] dark:text-[#FAD1D8] text-xs font-semibold">
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Romance Budget · Fondo Virtual y Ruleta de Citas</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-[var(--text-primary)]">
            Fondo de Citas y Ruleta de Planes
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Aparta dinero para sus momentos especiales (el saldo asignado aquí se reserva y deja de mostrarse como disponible en tu Saldo General). ¡Gira la ruleta para descubrir qué plan hacer hoy según su presupuesto!
          </p>
        </div>

        {/* Tarjeta del Saldo Virtual Reservado */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)]/95 border border-[#E8C5D0]/80 dark:border-[#45333A] shadow-xs min-w-[280px] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Disponible en Fondo de Citas
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${currentBracketInfo.colorClass}`}
            >
              {currentBracketInfo.short}
            </span>
          </div>

          <div>
            <div className="text-3xl font-bold font-mono-tabular text-[#C86D85]">
              {formatearMonto(romanceFund.balanceUsd, 'USD', locale)}
            </div>
            <div className="text-xs font-mono-tabular text-[var(--text-secondary)] mt-0.5">
              ≈{' '}
              {formatearMonto(
                romanceFund.balanceUsd * activeRate,
                'VES',
                locale
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleOpenAllocateModal}
              className="px-3.5 py-2.5 text-xs font-semibold text-[#9B475E] dark:text-[#FAD1D8] bg-[#F6E6EA] dark:bg-[#3D1821] hover:opacity-90 rounded-xl transition-opacity flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Asignar Fondo</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenSpendModal()}
              disabled={romanceFund.balanceUsd <= 0}
              className="px-3.5 py-2.5 text-xs font-semibold text-white bg-[#C86D85] hover:bg-[#9B475E] disabled:opacity-45 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Gastar Fondo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sección Central: Ruleta de Citas + Tramos de Presupuesto */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Columna Izquierda (7 cols): La Ruleta Lúdica y el Botón Grande */}
        <div className="lg:col-span-7 bg-[var(--surface)] p-6 sm:p-8 rounded-3xl border border-[var(--border-hairline)] flex flex-col items-center justify-between text-center space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-editorial text-[var(--text-primary)]">
              Ruleta de Citas Según tu Fondo
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Tramo activo evaluado automáticamente:{' '}
              <strong className="text-[#C86D85]">
                {currentBracketInfo.badge}
              </strong>
            </p>
          </div>

          {/* Rueda Visual Pastel Animada */}
          <div className="relative flex items-center justify-center my-2">
            {/* Indicador superior */}
            <div className="absolute -top-3 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-[#C86D85]" />

            <div
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                transition: isSpinning
                  ? 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'none',
              }}
              className="w-52 h-52 sm:w-60 sm:h-60 rounded-full border-8 border-[#F6E6EA] dark:border-[#3D1821] shadow-md relative overflow-hidden flex items-center justify-center bg-gradient-to-tr from-[#F6E6EA] via-[#EAE4F2] to-[#FDECE8] dark:from-[#2B1D23] dark:via-[#272033] dark:to-[#32252B]"
            >
              {/* Divisiones decorativas */}
              <div className="absolute inset-0 border-r-2 border-b-2 border-white/60 dark:border-white/10 rotate-45" />
              <div className="absolute inset-0 border-r-2 border-b-2 border-white/60 dark:border-white/10 -rotate-45" />

              {/* Iconos de los 3 tramos en la rueda */}
              <div className="absolute top-5 flex flex-col items-center text-[#9B475E] dark:text-[#FAD1D8]">
                <Coffee className="w-5 h-5" />
                <span className="text-[10px] font-bold mt-0.5">&lt;$10</span>
              </div>
              <div className="absolute bottom-6 left-7 flex flex-col items-center text-[#62517D] dark:text-[#DFD8EC]">
                <Film className="w-5 h-5" />
                <span className="text-[10px] font-bold mt-0.5">$10-$30</span>
              </div>
              <div className="absolute bottom-6 right-7 flex flex-col items-center text-[#B94E36] dark:text-[#F9C6BA]">
                <Utensils className="w-5 h-5" />
                <span className="text-[10px] font-bold mt-0.5">&gt;$30</span>
              </div>

              {/* Centro de la ruleta */}
              <div className="w-20 h-20 rounded-full bg-[var(--surface)] border-4 border-[#E8C5D0] dark:border-[#A85B6F] shadow-sm flex flex-col items-center justify-center z-10">
                <Sparkles className="w-6 h-6 text-[#C86D85]" />
                <span className="text-[10px] font-bold text-[var(--text-primary)] mt-0.5">
                  CITAS
                </span>
              </div>
            </div>
          </div>

          {/* Botón Grande para Girar la Ruleta */}
          <button
            type="button"
            onClick={handleSpinRoulette}
            disabled={isSpinning}
            className="w-full max-w-md py-4 px-6 rounded-2xl text-sm sm:text-base font-bold text-white bg-gradient-to-r from-[#C86D85] via-[#B76E79] to-[#8A79A6] hover:opacity-95 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-5 h-5 ${isSpinning ? 'animate-spin' : ''}`}
            />
            <span>
              {isSpinning
                ? 'Girando la ruleta del amor...'
                : '¡Girar la Ruleta y Descubrir el Plan!'}
            </span>
          </button>

          {/* Resultado del Plan Sugerido */}
          {currentSuggestion ? (
            <div className="w-full p-5 rounded-2xl bg-[#FAF5F6] dark:bg-[#251C20] border-2 border-[#E8C5D0] dark:border-[#A85B6F] text-left space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#C86D85] text-white">
                  Plan Sugerido · {currentSuggestion.planCategory}
                </span>
                <span className="text-xs font-mono-tabular font-semibold text-[#8A79A6]">
                  Estimado: {currentSuggestion.estimatedCostRange}
                </span>
              </div>

              <h3 className="text-lg font-bold text-[var(--text-primary)]">
                ✨ {currentSuggestion.planTitle}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {currentSuggestion.description}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#E8C5D0]/50">
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {currentSuggestion.bracketLabel}
                </span>
                {romanceFund.balanceUsd > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenSpendModal(currentSuggestion.planTitle)
                    }
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#C86D85] hover:bg-[#9B475E] transition-colors flex items-center gap-1.5"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>Hacer este plan y Gastar Fondo</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">
              Presiona el botón grande para que la ruleta elija una cita sorpresa acorde a los{' '}
              <strong className="font-mono-tabular text-[var(--text-primary)]">
                {formatearMonto(romanceFund.balanceUsd, 'USD', locale)}
              </strong>{' '}
              acumulados en tu fondo.
            </p>
          )}
        </div>

        {/* Columna Derecha (5 cols): Guía de Tramos de la Ruleta */}
        <div className="lg:col-span-5 bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border-hairline)] flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#C86D85]" />
              <span>Escala de Planes por Tramos</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              A medida que asignas más saldo a tu Fondo Virtual de Citas, desbloqueas nuevos tramos en la ruleta:
            </p>

            <div className="space-y-3">
              {/* Tramo 1: < $10 */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  currentBracketInfo.id === 'low'
                    ? 'border-[#C86D85] bg-[#FAF5F6] dark:bg-[#251C20]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-[#C86D85]" />
                    <span>Menos de $10 USD (&lt; $10)</span>
                  </span>
                  {currentBracketInfo.id === 'low' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C86D85] text-white">
                      Tramo Actual
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  <strong>Helados / Caminar:</strong> Barquillas artesanales, café y postre en el parque, cine en casa o picnic al atardecer.
                </p>
              </div>

              {/* Tramo 2: $10 - $30 */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  currentBracketInfo.id === 'mid'
                    ? 'border-[#8A79A6] bg-[#F2EFF8] dark:bg-[#261E33]'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-[#8A79A6]" />
                    <span>De $10 a $30 USD ($10 – $30)</span>
                  </span>
                  {currentBracketInfo.id === 'mid' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8A79A6] text-white">
                      Tramo Actual
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  <strong>Cine / Hamburguesas:</strong> Entradas al cine con cotufas, hamburguesas smash, pizzas a la leña, sushi o brunch.
                </p>
              </div>

              {/* Tramo 3: > $30 */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  currentBracketInfo.id === 'high'
                    ? 'border-[#B76E79] bg-[#F6E6EA]/70 dark:bg-[#3D1821]/60'
                    : 'border-[var(--border-hairline)] bg-[var(--surface-subtle)] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Utensils className="w-4 h-4 text-[#B76E79]" />
                    <span>Más de $30 USD (&gt; $30)</span>
                  </span>
                  {currentBracketInfo.id === 'high' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B76E79] text-white">
                      Tramo Actual
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  <strong>Cena / Especial:</strong> Velada romántica a la luz de las velas, restaurante especial, teatro en vivo o Full Day.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)]">
            💡 <strong>Regla contable:</strong> El saldo asignado al Fondo de Citas se descuenta inmediatamente de tu disponible general para que no lo gastes por error. Al presionar <strong>«Gastar Fondo»</strong>, se convierte en un egreso formal con tu nota o recuerdo.
          </div>
        </div>
      </div>

      {/* Bitácora de Recuerdos de Citas y Movimientos del Fondo */}
      <div className="bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border-hairline)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C86D85]" />
              <span>Álbum de Recuerdos y Movimientos del Fondo</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Registro histórico de tus aportes al fondo y de cada cita vivida.
            </p>
          </div>
          <span className="text-xs font-mono-tabular text-[var(--text-secondary)]">
            {romanceFund.movements.length}{' '}
            {romanceFund.movements.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {romanceFund.movements.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] py-4">
            Todavía no hay movimientos en tu Fondo de Citas. Haz clic en «Asignar Fondo» para empezar a ahorrar para su próxima salida.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-hairline)]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--surface-subtle)] border-b border-[var(--border-hairline)] text-[11px] font-semibold text-[var(--text-secondary)]">
                  <th className="py-2.5 px-4">Fecha y Hora</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4">Plan / Recuerdo o Nota</th>
                  <th className="py-2.5 px-4">Billetera</th>
                  <th className="py-2.5 px-4 text-right">Monto USD</th>
                  <th className="py-2.5 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-divider)]">
                {[...romanceFund.movements]
                  .sort((a, b) => compararRegistrosConHoraRecientesPrimero(a, b))
                  .map((mov) => {
                  const isSpend = mov.type === 'spend';
                  const movTime = obtenerInfoHoraProcesoTransaccion(mov, locale);
                  return (
                    <tr
                      key={mov.id}
                      className="hover:bg-[var(--surface-subtle)]/60 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {mov.date}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)]">
                          Hora: {movTime.timeFormatted}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isSpend ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6E6EA] text-[#9B475E] dark:bg-[#3D1821] dark:text-[#FAD1D8]">
                            <Heart className="w-3 h-3" />
                            <span>Cita Realizada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--income-bg)] text-[var(--income-color)]">
                            <Plus className="w-3 h-3" />
                            <span>Asignación al Fondo</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {mov.planName && (
                          <div className="font-semibold text-[var(--text-primary)]">
                            {mov.planName}
                          </div>
                        )}
                        <div className="text-[var(--text-secondary)]">
                          {mov.notes || 'Sin nota adicional'}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-[var(--text-secondary)]">
                        {getWalletName(mov.walletId)}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono-tabular font-bold whitespace-nowrap ${
                          isSpend
                            ? 'text-[#C86D85]'
                            : 'text-[var(--income-color)]'
                        }`}
                      >
                        {isSpend ? '-' : '+'}
                        {formatearMonto(mov.amountUsd, 'USD', locale)}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteMovement(mov)}
                          title="Eliminar registro"
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--expense-color)] hover:bg-[var(--expense-bg)]"
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

      {/* Modal 1: Asignar Dinero al Fondo Virtual de Citas */}
      {allocateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Asignar Dinero al Fondo de Citas
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Este monto dejará de verse como disponible en tu Saldo General.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllocateModalOpen(false)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAllocateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={allocDate}
                    onChange={(e) => setAllocDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Moneda
                  </label>
                  <select
                    value={allocCurrency}
                    onChange={(e) =>
                      setAllocCurrency(e.target.value as CurrencyCode)
                    }
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl font-semibold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Monto a apartar ({allocCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={allocAmountInput}
                  onChange={(e) => setAllocAmountInput(e.target.value)}
                  placeholder="Ej. 15.00"
                  className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              {allocCurrency === 'VES' && (
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Tasa de Cambio (Bs / USD)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={allocRateInput}
                    onChange={(e) => setAllocRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">
                    Tasa BCV activa: {formatearTasa(activeRate, locale)} Bs/$
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Billetera donde se reserva este monto
                </label>
                <select
                  value={allocWalletId}
                  onChange={(e) => setAllocWalletId(e.target.value)}
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
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Nota (opcional)
                </label>
                <input
                  type="text"
                  value={allocNotes}
                  onChange={(e) => setAllocNotes(e.target.value)}
                  placeholder="Ej. Aporte quincenal para nuestras salidas"
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAllocateModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#C86D85] hover:bg-[#9B475E] rounded-xl"
                >
                  Asignar al Fondo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Gastar Fondo de Citas (Resta del Fondo, Registra Egreso General y Guarda Recuerdo) */}
      {spendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Gastar Fondo de Citas
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Disponible en el fondo:{' '}
                  <strong className="font-mono-tabular text-[#C86D85]">
                    {formatearMonto(romanceFund.balanceUsd, 'USD', locale)}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSpendModalOpen(false)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSpendSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Fecha de la cita
                  </label>
                  <input
                    type="date"
                    required
                    value={spendDate}
                    onChange={(e) => setSpendDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Moneda del gasto
                  </label>
                  <select
                    value={spendCurrency}
                    onChange={(e) =>
                      setSpendCurrency(e.target.value as CurrencyCode)
                    }
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl font-semibold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="VES">VES (Bs)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Monto gastado en la cita ({spendCurrency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={spendAmountInput}
                  onChange={(e) => setSpendAmountInput(e.target.value)}
                  placeholder="Ej. 18.00"
                  className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              {spendCurrency === 'VES' && (
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Tasa de Cambio aplicada (Bs / USD)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={spendRateInput}
                    onChange={(e) => setSpendRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Plan realizado
                </label>
                <input
                  type="text"
                  required
                  value={spendPlanName}
                  onChange={(e) => setSpendPlanName(e.target.value)}
                  placeholder="Ej. Cine / Hamburguesas"
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Notas o Recuerdos de la cita (opcional)
                </label>
                <input
                  type="text"
                  value={spendMemoryNotes}
                  onChange={(e) => setSpendMemoryNotes(e.target.value)}
                  placeholder="Ej. Cita mensual, vimos una película increíble"
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Wallet de pago
                </label>
                <select
                  value={spendWalletId}
                  onChange={(e) => setSpendWalletId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSpendModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#C86D85] hover:bg-[#9B475E] rounded-xl flex items-center gap-1.5"
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Confirmar Gasto y Guardar Recuerdo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
