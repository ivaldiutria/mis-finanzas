import { BcvRateResponse, CurrencyCode } from '../types/finance';

const BCV_API_URL = 'https://dolarflow.com/api/oficial/';

/**
 * Consulta la tasa oficial del BCV desde la API indicada.
 * Conserva la precisión numérica recibida en data.precio para los cálculos internos.
 */
export async function obtenerTasaBCV(): Promise<BcvRateResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const respuesta = await fetch(BCV_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!respuesta.ok) {
      throw new Error(`No se pudo consultar la tasa oficial del BCV (HTTP ${respuesta.status}).`);
    }

    const data = await respuesta.json();

    if (
      !data ||
      data.exito !== true ||
      typeof data.precio !== 'number' ||
      !Number.isFinite(data.precio) ||
      data.precio <= 0
    ) {
      throw new Error('La respuesta de la tasa oficial no es válida.');
    }

    return {
      tasa: Number(Number(data.precio).toFixed(2)),
      fecha: typeof data.fecha === 'string' ? data.fecha : null,
      hora: typeof data.hora === 'string' ? data.hora : null,
      fechaActualizacion:
        typeof data.fechaActualizacion === 'string' ? data.fechaActualizacion : null,
      fuente: typeof data.fuente === 'string' ? data.fuente : 'bcv.org.ve',
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al consultar la tasa oficial del BCV.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('No se pudo conectar con el servicio de tasa oficial del BCV.');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Formatea la tasa de cambio mostrando SIEMPRE exactamente dos decimales.
 * Ejemplo: 881.8769 -> "881,88"
 */
export function formatearTasa(
  tasa: number | null | undefined,
  locale: 'es-VE' | 'en-US' | string = 'es-VE'
): string {
  if (tasa === null || tasa === undefined || !Number.isFinite(tasa) || tasa <= 0) {
    return '—';
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(tasa);
}

/**
 * Formatea la equivalencia destacada de la tasa: "1 USD = XXX,XX Bs"
 */
export function formatearEquivalenciaTasa(
  tasa: number | null | undefined,
  locale: 'es-VE' | 'en-US' | string = 'es-VE'
): string {
  if (tasa === null || tasa === undefined || !Number.isFinite(tasa) || tasa <= 0) {
    return 'Sin tasa disponible';
  }
  return `1 USD = ${formatearTasa(tasa, locale)} Bs`;
}

/**
 * Formatea cualquier importe monetario con exactamente 2 decimales.
 */
export function formatearMonto(
  monto: number | null | undefined,
  moneda: CurrencyCode = 'USD',
  locale: 'es-VE' | 'en-US' | string = 'es-VE'
): string {
  const safeVal =
    monto !== null && monto !== undefined && Number.isFinite(monto) ? monto : 0;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeVal);

  if (moneda === 'USDT') return `${formatted} USDT`;
  return moneda === 'USD' ? `${formatted} USD` : `${formatted} Bs`;
}

/**
 * Formatea un porcentaje de forma segura evitando NaN o Infinity.
 */
export function formatearPorcentaje(
  valor: number | null | undefined,
  decimales = 1,
  locale: 'es-VE' | 'en-US' | string = 'es-VE'
): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return '0 %';
  }
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor)} %`;
}
