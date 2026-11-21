import * as XLSX from 'xlsx';
import { RateHistoryEntry } from '../types/finance';

export interface ParsedHistoricalRateItem {
  /** Fecha normalizada en formato YYYY-MM-DD */
  fecha: string;
  /** Fecha en formato DD/MM/YYYY para mostrar */
  fechaDisplay: string;
  /** Tasa de cambio en Bs/USD */
  tasa: number;
}

export interface HistoricalRatesImportResult {
  items: ParsedHistoricalRateItem[];
  skippedCount: number;
  minDate: string | null;
  maxDate: string | null;
  monthsCovered: string[];
}

/**
 * Normaliza cualquier valor de fecha (string YYYY-MM-DD, DD/MM/YYYY, Date o serial de Excel)
 * a formato YYYY-MM-DD. Devuelve null si no es una fecha válida.
 */
export function normalizarFechaHistorica(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const yyyy = raw.getUTCFullYear();
    const mm = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(raw.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Número serial de fecha de Excel (ej. 45658 -> fecha en 2025/2026)
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 25000 && raw < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const target = new Date(excelEpoch.getTime() + Math.round(raw) * 86400000);
    if (!isNaN(target.getTime())) {
      const yyyy = target.getUTCFullYear();
      const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(target.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Caso 1: YYYY-MM-DD o YYYY/MM/DD (con o sin hora ISO)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const yyyy = Number(isoMatch[1]);
    const mm = Number(isoMatch[2]);
    const dd = Number(isoMatch[3]);
    if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  // Caso 2: DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const yyyy = Number(dmyMatch[3]);
    // Por convención en Venezuela es DD/MM/YYYY; si el segundo número > 12 y primero <= 12 invertimos
    const dd = first > 12 ? first : second > 12 ? second : first;
    const mm = first > 12 ? second : second > 12 ? first : second;
    if (yyyy >= 2000 && yyyy <= 2100 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  // Caso 3: string numérico serial de Excel
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    return normalizarFechaHistorica(Number(str));
  }

  return null;
}

/**
 * Normaliza un valor de tasa (número o string como "425,50" o "1.234,56" o "425.50")
 */
export function normalizarTasaHistorica(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Number(raw.toFixed(2)) : null;
  }

  let str = String(raw)
    .trim()
    .replace(/[^\d.,-]/g, '');
  if (!str) return null;

  // Si tiene punto y coma, determinamos cuál es el separador decimal (el último)
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // Formato 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Solo coma: decimal en formato venezolano "425,50"
    str = str.replace(',', '.');
  }

  const parsed = Number(str);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

export function formatearFechaDisplayDesdeIso(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.split('-');
  if (!yyyy || !mm || !dd) return isoDate;
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Extrae fecha y tasa de un objeto con claves flexibles
 */
function extraerParDeObjeto(obj: Record<string, unknown>): {
  fecha: string | null;
  tasa: number | null;
} {
  const entries = Object.entries(obj);
  let rawFecha: unknown = undefined;
  let rawTasa: unknown = undefined;

  for (const [key, val] of entries) {
    const k = key.trim().toLowerCase();
    if (
      rawFecha === undefined &&
      (k === 'fecha' ||
        k === 'date' ||
        k === 'dia' ||
        k === 'día' ||
        k === 'apidate' ||
        k === 'fetchedat' ||
        k.includes('fecha') ||
        k.includes('date'))
    ) {
      rawFecha = val;
    } else if (
      rawTasa === undefined &&
      (k === 'tasa' ||
        k === 'rate' ||
        k === 'valor' ||
        k === 'bcv' ||
        k === 'precio' ||
        k === 'monto' ||
        k === 'promedio' ||
        k.includes('tasa') ||
        k.includes('rate') ||
        k.includes('bcv') ||
        k.includes('valor'))
    ) {
      rawTasa = val;
    }
  }

  // Si el objeto solo tiene 2 propiedades y no coincidieron por nombre, probamos orden [0]=fecha, [1]=tasa
  if ((rawFecha === undefined || rawTasa === undefined) && entries.length >= 2) {
    const f0 = normalizarFechaHistorica(entries[0][1]);
    const t1 = normalizarTasaHistorica(entries[1][1]);
    if (f0 && t1) {
      return { fecha: f0, tasa: t1 };
    }
    const f1 = normalizarFechaHistorica(entries[1][1]);
    const t0 = normalizarTasaHistorica(entries[0][1]);
    if (f1 && t0) {
      return { fecha: f1, tasa: t0 };
    }
  }

  return {
    fecha: normalizarFechaHistorica(rawFecha),
    tasa: normalizarTasaHistorica(rawTasa),
  };
}

/**
 * Consolida y deduplica una lista cruda de pares (fecha, tasa)
 */
function consolidarItemsImportados(
  rawPairs: Array<{ fecha: string | null; tasa: number | null }>
): HistoricalRatesImportResult {
  const byDate = new Map<string, ParsedHistoricalRateItem>();
  let skippedCount = 0;

  for (const pair of rawPairs) {
    if (!pair.fecha || pair.tasa === null || pair.tasa <= 0) {
      skippedCount++;
      continue;
    }
    byDate.set(pair.fecha, {
      fecha: pair.fecha,
      fechaDisplay: formatearFechaDisplayDesdeIso(pair.fecha),
      tasa: pair.tasa,
    });
  }

  const items = Array.from(byDate.values()).sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
  );

  const monthsSet = new Set<string>();
  for (const item of items) {
    monthsSet.add(item.fecha.slice(0, 7));
  }

  return {
    items,
    skippedCount,
    minDate: items.length > 0 ? items[0].fecha : null,
    maxDate: items.length > 0 ? items[items.length - 1].fecha : null,
    monthsCovered: Array.from(monthsSet).sort(),
  };
}

/**
 * Parsea un archivo JSON de tasas históricas.
 * Soporta:
 * 1) Array de objetos: [{ "fecha": "2026-08-01", "tasa": 36.55 }, ...]
 * 2) Objeto contenedor: { "tasas": [...] } o { "rateHistory": [...] } o { "data": [...] }
 * 3) Mapa clave-valor: { "2026-08-01": 36.55, "2026-08-02": 36.60 }
 */
export function parsearJsonTasasHistoricas(
  jsonText: string
): HistoricalRatesImportResult {
  const parsed = JSON.parse(jsonText);
  const rawPairs: Array<{ fecha: string | null; tasa: number | null }> = [];

  let listToProcess: unknown[] | null = null;

  if (Array.isArray(parsed)) {
    listToProcess = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidateArray =
      obj.tasas || obj.historial || obj.rateHistory || obj.rates || obj.data;
    if (Array.isArray(candidateArray)) {
      listToProcess = candidateArray;
    } else {
      // Mapa clave-valor { "2026-08-01": 36.55 }
      for (const [k, v] of Object.entries(obj)) {
        const fecha = normalizarFechaHistorica(k);
        const tasa = normalizarTasaHistorica(v);
        if (fecha && tasa) {
          rawPairs.push({ fecha, tasa });
        }
      }
    }
  }

  if (listToProcess) {
    for (const row of listToProcess) {
      if (Array.isArray(row) && row.length >= 2) {
        rawPairs.push({
          fecha: normalizarFechaHistorica(row[0]),
          tasa: normalizarTasaHistorica(row[1]),
        });
      } else if (row && typeof row === 'object') {
        rawPairs.push(extraerParDeObjeto(row as Record<string, unknown>));
      }
    }
  }

  const result = consolidarItemsImportados(rawPairs);
  if (result.items.length === 0) {
    throw new Error(
      'No se encontraron registros válidos de { "fecha", "tasa" } en el archivo JSON.'
    );
  }
  return result;
}

/**
 * Parsea un archivo Excel (.xlsx, .xls) o CSV usando SheetJS (xlsx)
 */
export function parsearExcelTasasHistoricas(
  buffer: ArrayBuffer
): HistoricalRatesImportResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo Excel no contiene hojas de cálculo.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rowsAsObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    worksheet,
    { defval: '' }
  );

  const rawPairs: Array<{ fecha: string | null; tasa: number | null }> = [];

  for (const row of rowsAsObjects) {
    rawPairs.push(extraerParDeObjeto(row));
  }

  // También revisamos como matriz cruda por si la primera fila no tenía encabezados sino datos directos
  const rowsAsArrays = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
  });
  if (rowsAsArrays.length > 0) {
    const firstRow = rowsAsArrays[0];
    if (Array.isArray(firstRow) && firstRow.length >= 2) {
      const f0 = normalizarFechaHistorica(firstRow[0]);
      const t1 = normalizarTasaHistorica(firstRow[1]);
      if (f0 && t1) {
        rawPairs.unshift({ fecha: f0, tasa: t1 });
      }
    }
  }

  const result = consolidarItemsImportados(rawPairs);
  if (result.items.length === 0) {
    throw new Error(
      'No se encontraron filas válidas con columnas de Fecha y Tasa en el archivo Excel/CSV.'
    );
  }
  return result;
}

/**
 * Fusiona los registros de tasas históricas importados dentro del historial de la app (`rateHistory`)
 * sin duplicar fechas (si una fecha ya existe, actualiza su tasa con el valor del archivo).
 */
export function fusionarTasasHistoricasEnHistorial(
  currentHistory: RateHistoryEntry[],
  importedItems: ParsedHistoricalRateItem[],
  replaceExistingHistory = false
): RateHistoryEntry[] {
  const mapByIsoDate = new Map<string, RateHistoryEntry>();

  if (!replaceExistingHistory) {
    for (const entry of currentHistory || []) {
      const isoDate =
        normalizarFechaHistorica(entry.fetchedAt) ||
        normalizarFechaHistorica(entry.apiDate);
      if (isoDate && entry.rate > 0) {
        mapByIsoDate.set(isoDate, {
          ...entry,
          fetchedAt: entry.fetchedAt.startsWith(isoDate)
            ? entry.fetchedAt
            : `${isoDate}T12:00:00.000Z`,
          apiDate: formatearFechaDisplayDesdeIso(isoDate),
        });
      }
    }
  }

  for (const item of importedItems) {
    mapByIsoDate.set(item.fecha, {
      id: `rate-hist-${item.fecha}`,
      rate: item.tasa,
      apiDate: item.fechaDisplay,
      apiTime: '12:00:00',
      fetchedAt: `${item.fecha}T12:00:00.000Z`,
      source: 'bcv',
    });
  }

  // Ordenar de más reciente a más antigua (convención de rateHistory en la app)
  return Array.from(mapByIsoDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, val]) => val);
}

/**
 * Registra o actualiza la tasa de un día específico (YYYY-MM-DD) dentro de `rateHistory`
 * sin truncar el historial existente.
 */
export function registrarTasaDelDiaEnHistorial(
  currentHistory: RateHistoryEntry[] | undefined,
  fechaRaw: string | null | undefined,
  tasaRaw: number | null | undefined,
  source: 'bcv' | 'manual' = 'bcv',
  apiTime = '12:00:00',
  overwriteExisting = true
): RateHistoryEntry[] {
  const list = currentHistory || [];
  const isoDate = normalizarFechaHistorica(fechaRaw);
  const tasa = normalizarTasaHistorica(tasaRaw);
  if (!isoDate || !tasa || tasa <= 0) {
    return list;
  }

  const mapByIsoDate = new Map<string, RateHistoryEntry>();
  for (const entry of list) {
    const entryIso =
      normalizarFechaHistorica(entry.fetchedAt) ||
      normalizarFechaHistorica(entry.apiDate);
    if (entryIso && entry.rate > 0) {
      mapByIsoDate.set(entryIso, {
        ...entry,
        rate: Number(entry.rate.toFixed(2)),
        fetchedAt: entry.fetchedAt.startsWith(entryIso)
          ? entry.fetchedAt
          : `${entryIso}T12:00:00.000Z`,
        apiDate: formatearFechaDisplayDesdeIso(entryIso),
      });
    }
  }

  if (overwriteExisting || !mapByIsoDate.has(isoDate)) {
    mapByIsoDate.set(isoDate, {
      id: `rate-hist-${isoDate}`,
      rate: tasa,
      apiDate: formatearFechaDisplayDesdeIso(isoDate),
      apiTime,
      fetchedAt: `${isoDate}T12:00:00.000Z`,
      source,
    });
  }

  return Array.from(mapByIsoDate.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, val]) => val);
}

export interface LookupHistoricalRateResult {
  rate: number | null;
  exactMatch: boolean;
  matchedDate: string | null;
  matchedDateDisplay: string | null;
  sourceLabel: string;
}

/**
 * Busca la tasa correspondiente a una fecha (YYYY-MM-DD):
 * 1. Coincidencia exacta en `rateHistory` (incluye tasas del día guardadas y JSON/Excel cargados en Configuración).
 * 2. Coincidencia exacta en `transactions` (si hubo un movimiento en Bs ese día con tasa).
 * 3. Tasa anterior más cercana en `rateHistory` (útil para fines de semana o feriados bancarios).
 * 4. Tasa activa de respaldo (`fallbackRate`).
 */
export function obtenerTasaPorFecha(
  fechaRaw: string | null | undefined,
  rateHistory?: RateHistoryEntry[],
  fallbackRate?: number | null,
  transactions?: Array<{ date: string; exchangeRate?: number | null }>
): LookupHistoricalRateResult {
  const cleanFallback =
    fallbackRate && Number.isFinite(fallbackRate) && fallbackRate > 0
      ? Number(fallbackRate.toFixed(2))
      : null;

  const targetIso = normalizarFechaHistorica(fechaRaw);
  if (!targetIso) {
    return {
      rate: cleanFallback,
      exactMatch: false,
      matchedDate: null,
      matchedDateDisplay: null,
      sourceLabel: cleanFallback ? 'Tasa actual activa' : 'Sin tasa registrada',
    };
  }

  const byIso = new Map<string, number>();
  for (const entry of rateHistory || []) {
    const r = normalizarTasaHistorica(entry.rate);
    if (!r) continue;
    const f1 = normalizarFechaHistorica(entry.fetchedAt);
    const f2 = normalizarFechaHistorica(entry.apiDate);
    if (f1 && !byIso.has(f1)) byIso.set(f1, r);
    if (f2 && !byIso.has(f2)) byIso.set(f2, r);
  }

  // 1. Coincidencia exacta en el historial de tasas (rateHistory / JSON cargado)
  const exactInHistory = byIso.get(targetIso);
  if (exactInHistory && exactInHistory > 0) {
    const disp = formatearFechaDisplayDesdeIso(targetIso);
    return {
      rate: exactInHistory,
      exactMatch: true,
      matchedDate: targetIso,
      matchedDateDisplay: disp,
      sourceLabel: `Tasa registrada del ${disp}`,
    };
  }

  // 2. Coincidencia exacta en transacciones registradas ese mismo día
  if (transactions && transactions.length > 0) {
    for (const t of transactions) {
      if (t.date === targetIso && t.exchangeRate && t.exchangeRate > 0) {
        const r = Number(t.exchangeRate.toFixed(2));
        const disp = formatearFechaDisplayDesdeIso(targetIso);
        return {
          rate: r,
          exactMatch: true,
          matchedDate: targetIso,
          matchedDateDisplay: disp,
          sourceLabel: `Tasa de movimiento del ${disp}`,
        };
      }
    }
  }

  // 3. Tasa anterior más cercana en rateHistory (ej. fin de semana usa viernes)
  const previousDates = Array.from(byIso.keys())
    .filter((d) => d <= targetIso)
    .sort((a, b) => b.localeCompare(a));

  if (previousDates.length > 0) {
    const closestIso = previousDates[0];
    const closestRate = byIso.get(closestIso)!;
    const disp = formatearFechaDisplayDesdeIso(closestIso);
    return {
      rate: closestRate,
      exactMatch: false,
      matchedDate: closestIso,
      matchedDateDisplay: disp,
      sourceLabel: `Tasa previa más cercana (${disp})`,
    };
  }

  // 4. Fallback a la tasa activa actual
  return {
    rate: cleanFallback,
    exactMatch: false,
    matchedDate: null,
    matchedDateDisplay: null,
    sourceLabel: cleanFallback ? 'Tasa activa actual' : 'Sin tasa para esta fecha',
  };
}

/**
 * Genera datos de plantilla con los últimos 2 meses para que el usuario pueda descargar
 * un ejemplo listo en JSON o Excel (.xlsx)
 */
export function generarPlantillaTasasUltimosDosMeses(
  tasaReferenciaActual = 440
): Array<{ fecha: string; tasa: number }> {
  const now = new Date();
  const sample: Array<{ fecha: string; tasa: number }> = [];

  // Generamos muestras representativas de los 2 meses anteriores
  for (let daysAgo = 60; daysAgo >= 1; daysAgo -= 3) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    // Tasa progresiva realista hacia la tasa actual
    const factor = 1 - (daysAgo / 60) * 0.08;
    const tasa = Number((tasaReferenciaActual * factor).toFixed(2));
    sample.push({
      fecha: `${yyyy}-${mm}-${dd}`,
      tasa,
    });
  }

  return sample;
}

export function descargarPlantillaJsonTasas(tasaReferenciaActual?: number): void {
  const data = generarPlantillaTasasUltimosDosMeses(
    tasaReferenciaActual && tasaReferenciaActual > 0 ? tasaReferenciaActual : 440
  );
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_tasas_historicas_bcv.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function descargarPlantillaExcelTasas(tasaReferenciaActual?: number): void {
  const data = generarPlantillaTasasUltimosDosMeses(
    tasaReferenciaActual && tasaReferenciaActual > 0 ? tasaReferenciaActual : 440
  );
  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [{ wch: 15 }, { wch: 14 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasas_Historicas');
  XLSX.writeFile(workbook, 'plantilla_tasas_historicas_bcv.xlsx');
}
