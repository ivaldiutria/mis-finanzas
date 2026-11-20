import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileJson,
  HeartHandshake,
  ShieldCheck,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import {
  Category,
  Transaction,
  WalletAccount,
} from '../types/finance';
import { formatearMonto } from '../services/bcvApi';
import { validarEImportarGastosCompartidosJson } from '../utils/coupleStorage';

interface ImportSharedExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTransactions: Transaction[];
  categories: Category[];
  wallets: WalletAccount[];
  effectiveRate: number | null;
  locale: 'es-VE' | 'en-US';
  onConfirmImport: (newTransactions: Transaction[]) => void;
}

export const ImportSharedExpensesModal: React.FC<
  ImportSharedExpensesModalProps
> = ({
  isOpen,
  onClose,
  existingTransactions,
  categories,
  wallets,
  effectiveRate,
  locale,
  onConfirmImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeWallets = wallets.filter((w) => w.active);
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    activeWallets[0]?.id || wallets[0]?.id || 'wallet_zelle'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    nuevasTransacciones: Transaction[];
    omitidasPorDuplicado: number;
    totalImportadoUsd: number;
    rawFileName: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setErrorMsg(null);
    setPreviewResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setPreviewResult(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsed = JSON.parse(text);
        const result = validarEImportarGastosCompartidosJson(
          parsed,
          existingTransactions,
          categories,
          selectedWalletId,
          effectiveRate
        );
        setPreviewResult({
          ...result,
          rawFileName: file.name,
        });
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'El archivo seleccionado no tiene un formato JSON válido de gastos compartidos.'
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleWalletChange = (newWalletId: string) => {
    setSelectedWalletId(newWalletId);
    if (previewResult) {
      setPreviewResult({
        ...previewResult,
        nuevasTransacciones: previewResult.nuevasTransacciones.map((t) => ({
          ...t,
          walletId: newWalletId,
        })),
      });
    }
  };

  const handleConfirm = () => {
    if (!previewResult || previewResult.nuevasTransacciones.length === 0) return;
    onConfirmImport(previewResult.nuevasTransacciones);
    handleReset();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 py-4 bg-gradient-to-r from-[var(--lavender-soft)] via-[var(--surface-subtle)] to-[var(--pink-light)] border-b border-[var(--border-hairline)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--lavender-accent)] text-white flex items-center justify-center shrink-0 shadow-xs">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-editorial text-[var(--text-primary)]">
                Importar Gastos Compartidos (JSON)
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Sincronización manual · Registra como egresos personales los gastos pagados en pareja
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Explicación del flujo */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="w-4 h-4 text-[var(--lavender-accent)] shrink-0" />
              <span>Verificación anti-duplicados por ID único activa</span>
            </div>
            <p className="leading-relaxed">
              Sube el archivo <code className="font-mono-tabular text-[var(--pink-primary)]">.json</code> exportado desde el Hub de Pareja. El sistema verificará el identificador único de cada gasto para no importar dos veces el mismo movimiento y descontará los nuevos egresos de la billetera que elijas.
            </p>
          </div>

          {/* Selector de Billetera destino */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[var(--lavender-accent)]" />
                Billetera personal donde se debitarán los egresos importados
              </span>
            </label>
            <select
              value={selectedWalletId}
              onChange={(e) => handleWalletChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl focus:outline-none focus:border-[var(--lavender-accent)]"
            >
              {activeWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.currency})
                </option>
              ))}
            </select>
          </div>

          {/* Zona de carga de archivo JSON */}
          <div className="border-2 border-dashed border-[var(--border-input)] hover:border-[var(--lavender-accent)] rounded-2xl p-6 text-center transition-colors bg-[var(--surface-subtle)]/50 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--lavender-soft)] text-[var(--lavender-accent)] mx-auto flex items-center justify-center">
              <FileJson className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Selecciona el archivo JSON de Gastos Compartidos
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Archivo generado desde «Finanzas en Pareja → Exportar gastos pagados por Pareja»
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-semibold text-white bg-[var(--lavender-accent)] hover:bg-[var(--lavender-dark)] rounded-xl transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Seleccionar archivo .json</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Mensaje de error si falla la validación */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[var(--expense-bg)] border border-[var(--expense-border)] text-xs text-[var(--expense-text-dark)] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[var(--expense-color)]" />
              <div>
                <strong className="block font-semibold">No se pudo procesar el archivo</strong>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Previsualización del resultado antes de confirmar */}
          {previewResult && (
            <div className="p-4 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--lavender-accent)]/50 space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2.5">
                <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[var(--income-color)]" />
                  <span>Archivo analizado: {previewResult.rawFileName}</span>
                </div>
                <span className="text-[11px] font-mono-tabular font-semibold text-[var(--lavender-text)] bg-[var(--lavender-soft)] px-2 py-0.5 rounded-md">
                  {previewResult.nuevasTransacciones.length} nuevo(s)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Total a registrar como egreso
                  </span>
                  <span className="text-base font-bold font-mono-tabular text-[var(--expense-color)]">
                    -{formatearMonto(previewResult.totalImportadoUsd, 'USD', locale)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)]">
                  <span className="text-[11px] text-[var(--text-secondary)] block">
                    Omitidos por ID duplicado
                  </span>
                  <span className="text-base font-bold font-mono-tabular text-[var(--text-primary)]">
                    {previewResult.omitidasPorDuplicado} movimiento(s)
                  </span>
                </div>
              </div>

              {previewResult.nuevasTransacciones.length > 0 ? (
                <div className="max-h-44 overflow-y-auto divide-y divide-[var(--border-divider)] bg-[var(--surface)] rounded-xl border border-[var(--border-hairline)] text-xs">
                  {previewResult.nuevasTransacciones.map((t) => (
                    <div
                      key={t.id}
                      className="px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--text-primary)] truncate">
                          {t.description}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-mono-tabular">
                          {t.date} · ID: {t.sharedExpenseId}
                        </div>
                      </div>
                      <div className="text-right font-mono-tabular shrink-0">
                        <div className="font-semibold text-[var(--expense-color)]">
                          -{formatearMonto(t.amount, t.currency, locale)}
                        </div>
                        {t.currency === 'VES' && (
                          <div className="text-[10px] text-[var(--text-secondary)]">
                            ≈ {formatearMonto(t.amountUsd, 'USD', locale)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] text-center">
                  Todos los gastos contenidos en este archivo ya fueron importados previamente en tu cuenta.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="px-6 py-4 bg-[var(--surface-subtle)] border-t border-[var(--border-hairline)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-input)] rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              !previewResult || previewResult.nuevasTransacciones.length === 0
            }
            onClick={handleConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-[var(--lavender-accent)] hover:bg-[var(--lavender-dark)] disabled:opacity-40 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Importar a Mis Gastos (
              {previewResult ? previewResult.nuevasTransacciones.length : 0})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
