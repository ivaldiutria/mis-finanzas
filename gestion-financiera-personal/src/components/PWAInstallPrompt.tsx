import React, { useState } from 'react';
import { CheckCircle2, Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'sidebar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="p-4 rounded-xl bg-[var(--income-bg)] border border-[var(--income-border)] flex items-center gap-3 text-xs text-[var(--income-text-dark)]">
          <CheckCircle2 className="w-4 h-4 text-[var(--income-color)] shrink-0" />
          <div>
            <strong className="block font-semibold">
              Aplicación instalada como PWA
            </strong>
            <span>
              Mis Finanzas ya se está ejecutando en modo independiente con soporte sin conexión.
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleAction}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>{isInstallable ? 'Instalar App en dispositivo' : 'Instalar en móvil (PWA)'}</span>
        </button>
      ) : (
        <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[var(--pink-primary)]" />
              <span>Instalación como Aplicación Móvil / Escritorio (PWA)</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Instala Mis Finanzas en la pantalla de inicio de tu teléfono (Android / iPhone) o computadora para abrirla a pantalla completa y usarla incluso sin conexión a internet.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAction}
            className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isInstallable ? 'Instalar ahora' : 'Cómo instalar en móvil'}</span>
          </button>
        </div>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="bg-[var(--surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/icon.svg?v=2"
                  alt="Mis Finanzas"
                  className="w-9 h-9 rounded-xl shadow-xs shrink-0"
                />
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    Instalar «Mis Finanzas» en tu móvil
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Progressive Web App (PWA) · Funciona offline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              {isIOS ? (
                <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-1.5">
                  <div className="font-semibold text-[var(--text-primary)]">
                    En iPhone / iPad (Safari):
                  </div>
                  <p>
                    1. Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.
                  </p>
                  <p>
                    2. Desliza hacia abajo y selecciona{' '}
                    <strong>«Agregar a pantalla de inicio»</strong>.
                  </p>
                  <p>
                    3. Toca <strong>Agregar</strong> en la esquina superior derecha.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-1.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      En Android (Chrome / Edge):
                    </div>
                    <p>
                      1. Abre la aplicación en una pestaña directa del navegador (fuera del marco de vista previa si estás en el editor).
                    </p>
                    <p>
                      2. Toca el menú de tres puntos <strong>(⋮)</strong> arriba a la derecha y elige{' '}
                      <strong>«Instalar aplicación»</strong> o{' '}
                      <strong>«Agregar a la pantalla principal»</strong>.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] space-y-1.5">
                    <div className="font-semibold text-[var(--text-primary)]">
                      En iPhone / iPad (Safari):
                    </div>
                    <p>
                      1. Toca el botón <strong>Compartir</strong> en Safari y selecciona{' '}
                      <strong>«Agregar a pantalla de inicio»</strong>.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 text-xs font-medium text-white bg-[var(--pink-primary)] hover:bg-[var(--pink-dark)] rounded-xl transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[var(--warning-bg)] border border-[var(--warning-border)] px-3.5 py-2 text-xs font-medium text-[var(--warning-color)] shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Modo sin conexión — Tus datos locales siguen disponibles.</span>
    </div>
  );
};
