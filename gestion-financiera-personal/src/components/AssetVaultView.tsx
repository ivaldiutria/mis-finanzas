import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  AppDataSchema,
  Asset,
  AssetStatusEvaluation,
  CurrencyCode,
} from '../types/finance';
import { calcularEstadoAsset, obtenerFechaLocalIso } from '../utils/calculations';
import { StorageService } from '../utils/storage';
import { formatearMonto, formatearTasa } from '../services/bcvApi';

interface AssetVaultViewProps {
  appData: AppDataSchema;
  setAppData: React.Dispatch<React.SetStateAction<AppDataSchema>>;
  effectiveConversionRate: number | null;
  locale: 'es-VE' | 'en-US';
  showToast: (text: string, kind?: 'success' | 'error' | 'info') => void;
}

export const AssetVaultView: React.FC<AssetVaultViewProps> = ({
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

  // Estado del formulario de creación / edición de Bien (Asset)
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [nombre, setNombre] = useState<string>('');
  const [costoInput, setCostoInput] = useState<string>('');
  const [moneda, setMoneda] = useState<CurrencyCode>('USD');
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() =>
    String(activeRate)
  );
  const [fechaCompra, setFechaCompra] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [mesesGarantiaInput, setMesesGarantiaInput] = useState<string>('12');
  const [frecuenciaMesesInput, setFrecuenciaMesesInput] = useState<string>('6');
  const [notas, setNotas] = useState<string>('');

  // Estado del modal de Registrar Mantenimiento
  const [maintTargetAsset, setMaintTargetAsset] = useState<Asset | null>(null);
  const [maintFecha, setMaintFecha] = useState<string>(() =>
    obtenerFechaLocalIso()
  );
  const [maintCostoInput, setMaintCostoInput] = useState<string>('');
  const [maintMoneda, setMaintMoneda] = useState<CurrencyCode>('USD');
  const [maintRateInput, setMaintRateInput] = useState<string>(() =>
    String(activeRate)
  );
  const [maintWalletId, setMaintWalletId] = useState<string>(
    () => activeWallets[0]?.id || ''
  );
  const [maintNotas, setMaintNotas] = useState<string>('');

  // Control de historial desplegable por tarjeta
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(
    null
  );

  const evaluations = useMemo<AssetStatusEvaluation[]>(() => {
    return (appData.assets || []).map((asset) => calcularEstadoAsset(asset));
  }, [appData.assets]);

  const summary = useMemo(() => {
    let totalAssetsValueUsd = 0;
    let totalMaintenanceUsd = 0;
    let alertsCount = 0;

    for (const ev of evaluations) {
      totalAssetsValueUsd += ev.asset.costoUsd;
      totalMaintenanceUsd += ev.totalMaintenanceSpentUsd;
      if (ev.alertLevel !== 'ok') {
        alertsCount += 1;
      }
    }

    return {
      count: evaluations.length,
      totalAssetsValueUsd,
      totalMaintenanceUsd,
      alertsCount,
    };
  }, [evaluations]);

  const handleOpenCreate = () => {
    setEditingAsset(null);
    setNombre('');
    setCostoInput('');
    setMoneda('USD');
    setExchangeRateInput(String(activeRate));
    setFechaCompra(obtenerFechaLocalIso());
    setMesesGarantiaInput('12');
    setFrecuenciaMesesInput('6');
    setNotas('');
    setFormOpen(true);
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setNombre(asset.nombre);
    setCostoInput(String(asset.costo));
    setMoneda(asset.moneda);
    setExchangeRateInput(String(asset.exchangeRate || activeRate));
    setFechaCompra(asset.fechaCompra);
    setMesesGarantiaInput(String(asset.mesesGarantia));
    setFrecuenciaMesesInput(String(asset.frecuenciaMantenimientoMeses));
    setNotas(asset.notas || '');
    setFormOpen(true);
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCosto = Number(costoInput.replace(',', '.'));
    const parsedRate = Number(exchangeRateInput.replace(',', '.'));
    const parsedGarantia = Number(mesesGarantiaInput);
    const parsedFrecuencia = Number(frecuenciaMesesInput);

    if (!nombre.trim()) {
      showToast('Indica el nombre del bien (ej. Aire Acondicionado).', 'error');
      return;
    }
    if (!Number.isFinite(parsedCosto) || parsedCosto < 0) {
      showToast('Ingresa un costo de compra válido.', 'error');
      return;
    }

    try {
      const { updatedData, asset } = StorageService.saveAsset(
        {
          id: editingAsset?.id,
          nombre,
          costo: parsedCosto,
          moneda,
          exchangeRate:
            moneda === 'VES' && parsedRate > 0 ? parsedRate : activeRate,
          fechaCompra,
          mesesGarantia: Number.isFinite(parsedGarantia) ? parsedGarantia : 12,
          frecuenciaMantenimientoMeses: Number.isFinite(parsedFrecuencia)
            ? parsedFrecuencia
            : 6,
          notas,
        },
        appData
      );
      setAppData(updatedData);
      setFormOpen(false);
      setEditingAsset(null);
      showToast(
        editingAsset
          ? `Bien «${asset.nombre}» actualizado en la Bóveda.`
          : `Bien «${asset.nombre}» registrado en la Bóveda de Garantías.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el bien en la bóveda.',
        'error'
      );
    }
  };

  const handleDeleteAsset = (asset: Asset) => {
    const updatedData = StorageService.deleteAsset(asset.id, appData);
    setAppData(updatedData);
    showToast(`Bien «${asset.nombre}» eliminado de la bóveda.`, 'info');
  };

  const handleOpenMaintenanceModal = (asset: Asset) => {
    setMaintTargetAsset(asset);
    setMaintFecha(obtenerFechaLocalIso());
    setMaintCostoInput('');
    setMaintMoneda('USD');
    setMaintRateInput(String(activeRate));
    setMaintWalletId(activeWallets[0]?.id || '');
    setMaintNotas('');
  };

  const handleSubmitMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintTargetAsset) return;

    const parsedCosto = Number(maintCostoInput.replace(',', '.'));
    const parsedRate = Number(maintRateInput.replace(',', '.'));

    if (!Number.isFinite(parsedCosto) || parsedCosto <= 0) {
      showToast('Ingresa un costo de mantenimiento mayor que cero.', 'error');
      return;
    }

    try {
      const { updatedData, maintenanceRecord } =
        StorageService.registerAssetMaintenance(
          {
            assetId: maintTargetAsset.id,
            fecha: maintFecha,
            costo: parsedCosto,
            moneda: maintMoneda,
            exchangeRate:
              maintMoneda === 'VES' && parsedRate > 0 ? parsedRate : activeRate,
            walletId: maintWalletId,
            notas: maintNotas,
          },
          appData
        );

      setAppData(updatedData);
      setMaintTargetAsset(null);
      showToast(
        `Mantenimiento de «${maintTargetAsset.nombre}» registrado por ${formatearMonto(
          maintenanceRecord.costoUsd,
          'USD',
          locale
        )} y descontado del Saldo Real.`,
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar el mantenimiento.',
        'error'
      );
    }
  };

  return (
    <div className="space-y-7">
      {/* Encabezado de la Bóveda de Garantías y Mantenimiento */}
      <div className="bg-[var(--surface-subtle)] p-6 rounded-2xl border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[var(--pink-light)] text-[var(--pink-primary)]">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
              Bóveda de Garantías y Mantenimiento (Asset Tracker)
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Monitorea tus bienes, fechas exactas de expiración de garantía y próximos mantenimientos preventivos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Bien / Equipo</span>
        </button>
      </div>

      {/* KPIs Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">
            Bienes registrados
          </span>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)] mt-1">
            {summary.count}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Equipos y electrodomésticos bajo control
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">
            Valor total en bienes (Adquisición)
          </span>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--text-primary)] mt-1">
            {formatearMonto(summary.totalAssetsValueUsd, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1 font-mono-tabular">
            ≈{' '}
            {formatearMonto(
              summary.totalAssetsValueUsd * activeRate,
              'VES',
              locale
            )}
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">
            Inversión acumulada en mantenimientos
          </span>
          <div className="text-2xl font-bold font-mono-tabular text-[var(--lavender-accent)] mt-1">
            {formatearMonto(summary.totalMaintenanceUsd, 'USD', locale)}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Registrados como egresos reales
          </p>
        </div>

        <div className="bg-[var(--surface)] p-5 rounded-2xl border border-[var(--border-hairline)]">
          <span className="text-xs text-[var(--text-secondary)]">
            Alertas próximas (&lt; 1 mes)
          </span>
          <div
            className={`text-2xl font-bold font-mono-tabular mt-1 ${
              summary.alertsCount > 0
                ? 'text-[var(--warning-color)]'
                : 'text-[var(--income-color)]'
            }`}
          >
            {summary.alertsCount}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Garantías por expirar o mantenimientos próximos
          </p>
        </div>
      </div>

      {/* Formulario Desplegable para Crear / Editar un Bien */}
      {formOpen && (
        <form
          onSubmit={handleSaveAsset}
          className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--pink-primary)]/40 space-y-5 shadow-sm"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editingAsset
                ? `Editar bien: ${editingAsset.nombre}`
                : 'Registrar nuevo bien en la Bóveda'}
            </h2>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Nombre del Bien / Equipo
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Aire Acondicionado Split 18.000 BTU"
                className="w-full px-3.5 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Costo de Compra ({moneda})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={costoInput}
                  onChange={(e) => setCostoInput(e.target.value)}
                  placeholder="Ej. 380.00"
                  className="flex-1 px-3.5 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as CurrencyCode)}
                  className="px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl font-semibold"
                >
                  <option value="USD">USD ($)</option>
                  <option value="VES">VES (Bs)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Fecha de Compra
              </label>
              <input
                type="date"
                required
                value={fechaCompra}
                onChange={(e) => setFechaCompra(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Meses de Garantía
              </label>
              <input
                type="number"
                min="0"
                max="240"
                required
                value={mesesGarantiaInput}
                onChange={(e) => setMesesGarantiaInput(e.target.value)}
                placeholder="Ej. 12"
                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Frecuencia de Mantenimiento (en meses)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                required
                value={frecuenciaMesesInput}
                onChange={(e) => setFrecuenciaMesesInput(e.target.value)}
                placeholder="Ej. 6"
                className="w-full px-3.5 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Notas o serial / tienda (opcional)
              </label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. Tienda Daka · Limpieza de filtros cada 6 meses"
                className="w-full px-3.5 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl"
            >
              {editingAsset ? 'Guardar cambios' : 'Guardar Bien en Bóveda'}
            </button>
          </div>
        </form>
      )}

      {/* Tarjetas de Bienes (Assets) */}
      {evaluations.length === 0 ? (
        <div className="bg-[var(--surface)] p-10 rounded-2xl border border-[var(--border-hairline)] text-center space-y-3">
          <Shield className="w-8 h-8 text-[var(--pink-primary)] mx-auto opacity-80" />
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            Tu Bóveda de Garantías y Mantenimiento está vacía
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            Registra tus electrodomésticos, equipos o vehículos (ej. «Aire Acondicionado», «Nevera», «Laptop») para calcular automáticamente cuándo vence su garantía y cuándo toca su próximo mantenimiento.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl"
          >
            + Registrar primer bien
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {evaluations.map((ev) => {
            const { asset } = ev;
            const isUrgent = ev.alertLevel === 'urgent';
            const isWarning = ev.alertLevel === 'warning';
            const isHistoryOpen = expandedHistoryId === asset.id;

            const cardBorderClasses = isUrgent
              ? 'border-2 border-[var(--expense-color)] bg-[var(--expense-bg)]/35 shadow-sm'
              : isWarning
                ? 'border-2 border-amber-500/80 bg-amber-500/5 shadow-sm'
                : 'border border-[var(--border-hairline)] bg-[var(--surface)]';

            return (
              <div
                key={asset.id}
                className={`p-5 rounded-2xl transition-all flex flex-col justify-between space-y-4 ${cardBorderClasses}`}
              >
                {/* Cabecera de la tarjeta */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-[var(--text-primary)]">
                          {asset.nombre}
                        </h3>
                        {isUrgent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--expense-color)] text-white">
                            <ShieldAlert className="w-3 h-3" />
                            <span>¡Atención Urgente!</span>
                          </span>
                        )}
                        {!isUrgent && isWarning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Próximo a vencer (&lt; 1 mes)</span>
                          </span>
                        )}
                        {ev.alertLevel === 'ok' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--income-bg)] text-[var(--income-color)]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Al día</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Comprado el{' '}
                        <strong className="font-mono-tabular text-[var(--text-primary)]">
                          {asset.fechaCompra}
                        </strong>{' '}
                        · Costo:{' '}
                        <strong className="font-mono-tabular text-[var(--text-primary)]">
                          {formatearMonto(asset.costoUsd, 'USD', locale)}
                        </strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(asset)}
                        title="Editar bien"
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(asset)}
                        title="Eliminar bien"
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--expense-color)] hover:bg-[var(--expense-bg)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bloques de Garantía y Próximo Mantenimiento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Estado de Garantía */}
                    <div
                      className={`p-3.5 rounded-xl border ${
                        ev.isWarrantyExpiringSoon
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : ev.isWarrantyExpired
                            ? 'bg-[var(--surface-subtle)] border-[var(--border-hairline)] opacity-80'
                            : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                        <span className="font-semibold flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-[var(--pink-primary)]" />
                          Garantía ({asset.mesesGarantia} meses)
                        </span>
                      </div>
                      <div className="text-sm font-bold font-mono-tabular text-[var(--text-primary)] mt-1">
                        Expira: {ev.warrantyExpirationDate}
                      </div>
                      <div
                        className={`text-[11px] font-medium mt-0.5 ${
                          ev.isWarrantyExpiringSoon
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : ev.isWarrantyExpired
                              ? 'text-[var(--text-secondary)]'
                              : 'text-[var(--income-color)]'
                        }`}
                      >
                        {asset.mesesGarantia === 0
                          ? 'Sin garantía registrada'
                          : ev.isWarrantyExpired
                            ? `Expiró hace ${Math.abs(ev.daysUntilWarrantyExpires)} días`
                            : ev.daysUntilWarrantyExpires === 0
                              ? '¡Expira hoy!'
                              : `Faltan ${ev.daysUntilWarrantyExpires} días`}
                      </div>
                    </div>

                    {/* Estado de Próximo Mantenimiento */}
                    <div
                      className={`p-3.5 rounded-xl border ${
                        ev.isMaintenanceOverdue
                          ? 'bg-[var(--expense-bg)] border-[var(--expense-color)]/60'
                          : ev.isMaintenanceDueSoon
                            ? 'bg-amber-500/10 border-amber-500/50'
                            : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                        <span className="font-semibold flex items-center gap-1">
                          <Wrench className="w-3.5 h-3.5 text-[var(--lavender-accent)]" />
                          Mantenimiento (cada {asset.frecuenciaMantenimientoMeses}m)
                        </span>
                      </div>
                      <div className="text-sm font-bold font-mono-tabular text-[var(--text-primary)] mt-1">
                        {ev.nextMaintenanceDate
                          ? `Próximo: ${ev.nextMaintenanceDate}`
                          : 'No programado'}
                      </div>
                      <div
                        className={`text-[11px] font-medium mt-0.5 ${
                          ev.isMaintenanceOverdue
                            ? 'text-[var(--expense-color)] font-bold'
                            : ev.isMaintenanceDueSoon
                              ? 'text-amber-600 dark:text-amber-400 font-semibold'
                              : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {ev.daysUntilNextMaintenance === null
                          ? 'Sin frecuencia'
                          : ev.isMaintenanceOverdue
                            ? `¡Vencido hace ${Math.abs(ev.daysUntilNextMaintenance)} días!`
                            : ev.daysUntilNextMaintenance === 0
                              ? '¡Toca mantenimiento hoy!'
                              : `Faltan ${ev.daysUntilNextMaintenance} días`}
                      </div>
                    </div>
                  </div>

                  {asset.notas && (
                    <p className="text-[11px] text-[var(--text-secondary)] bg-[var(--surface-subtle)] px-3 py-2 rounded-xl border border-[var(--border-hairline)]">
                      {asset.notas}
                    </p>
                  )}
                </div>

                {/* Pie de la tarjeta: Botón Registrar Mantenimiento + Historial */}
                <div className="pt-3 border-t border-[var(--border-divider)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedHistoryId(isHistoryOpen ? null : asset.id)
                      }
                      className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5"
                    >
                      <History className="w-3.5 h-3.5 text-[var(--lavender-accent)]" />
                      <span>
                        Historial ({asset.historialMantenimiento.length}) ·{' '}
                        <strong className="font-mono-tabular text-[var(--text-primary)]">
                          {formatearMonto(
                            ev.totalMaintenanceSpentUsd,
                            'USD',
                            locale
                          )}
                        </strong>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenMaintenanceModal(asset)}
                      className="px-3.5 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Registrar Mantenimiento</span>
                    </button>
                  </div>

                  {/* Lista desplegable de mantenimientos realizados */}
                  {isHistoryOpen && (
                    <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-2">
                      {asset.historialMantenimiento.length === 0 ? (
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Aún no se han registrado mantenimientos para este equipo.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto">
                          {asset.historialMantenimiento.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)]"
                            >
                              <div>
                                <span className="font-mono-tabular font-semibold text-[var(--text-primary)]">
                                  {m.fecha}
                                </span>
                                <span className="text-[var(--text-secondary)] ml-2">
                                  {m.notas || 'Mantenimiento preventivo'}
                                </span>
                              </div>
                              <span className="font-mono-tabular font-semibold text-[var(--expense-color)]">
                                -{formatearMonto(m.costoUsd, 'USD', locale)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Registrar Mantenimiento (Crea Egreso Regular y afecta Saldo Real) */}
      {maintTargetAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border-hairline)] shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Registrar Mantenimiento
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Bien: <strong>{maintTargetAsset.nombre}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMaintTargetAsset(null)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitMaintenance} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Fecha del servicio
                  </label>
                  <input
                    type="date"
                    required
                    value={maintFecha}
                    onChange={(e) => setMaintFecha(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Moneda de pago
                  </label>
                  <select
                    value={maintMoneda}
                    onChange={(e) =>
                      setMaintMoneda(e.target.value as CurrencyCode)
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
                  Costo del Mantenimiento ({maintMoneda})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={maintCostoInput}
                  onChange={(e) => setMaintCostoInput(e.target.value)}
                  placeholder={
                    maintMoneda === 'VES' ? 'Ej. 1800.00' : 'Ej. 35.00'
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-mono-tabular font-bold bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              {maintMoneda === 'VES' && (
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Tasa de Cambio aplicada (Bs / USD)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={maintRateInput}
                    onChange={(e) => setMaintRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono-tabular bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                  />
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5 block">
                    Tasa BCV activa: {formatearTasa(activeRate, locale)} Bs/$
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Wallet de donde se debita el pago (Afecta Saldo Real)
                </label>
                <select
                  value={maintWalletId}
                  onChange={(e) => setMaintWalletId(e.target.value)}
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
                  Detalle del trabajo realizado (opcional)
                </label>
                <input
                  type="text"
                  value={maintNotas}
                  onChange={(e) => setMaintNotas(e.target.value)}
                  placeholder="Ej. Lavado químico de serpentín y revisión de gas"
                  className="w-full px-3 py-2 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                />
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--pink-primary)] shrink-0" />
                <span>
                  Este costo se registrará automáticamente como un{' '}
                  <strong className="text-[var(--text-primary)]">
                    egreso regular completado
                  </strong>{' '}
                  y actualizará la fecha del próximo mantenimiento.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMaintTargetAsset(null)}
                  className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl"
                >
                  Confirmar y Registrar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
