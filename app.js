/**
 * Mis Finanzas — Módulo principal de lógica financiera, consulta oficial BCV y almacenamiento local (app.js)
 * Diseñado exclusivamente para uso personal de una sola usuaria, sin backend ni base de datos externa.
 */

export const BCV_API_URL = "https://dolarflow.com/api/oficial/";
export const STORAGE_KEY = "mis_finanzas_personal_app_v1";

/**
 * Consulta la tasa oficial del BCV desde https://dolarflow.com/api/oficial/
 * Utiliza data.precio como valor numérico conservando su precisión interna.
 */
export async function obtenerTasaBCV() {
  const respuesta = await fetch(BCV_API_URL, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!respuesta.ok) {
    throw new Error("No se pudo consultar la tasa oficial del BCV.");
  }

  const data = await respuesta.json();

  if (
    !data ||
    data.exito !== true ||
    typeof data.precio !== "number" ||
    !Number.isFinite(data.precio) ||
    data.precio <= 0
  ) {
    throw new Error("La respuesta de la tasa oficial no es válida.");
  }

  return {
    tasa: Number(data.precio),
    fecha: data.fecha ?? null,
    hora: data.hora ?? null,
    fechaActualizacion: data.fechaActualizacion ?? null,
    fuente: data.fuente ?? "bcv.org.ve"
  };
}

/**
 * Formatea la tasa oficial mostrando SIEMPRE exactamente dos decimales.
 * Ejemplo: 881.8769 -> "881,88"
 */
export function formatearTasa(tasa, locale = "es-VE") {
  if (typeof tasa !== "number" || !Number.isFinite(tasa) || tasa <= 0) {
    return "—";
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(tasa);
}

/**
 * Presenta la equivalencia destacada en la interfaz: "1 USD = XXX,XX Bs"
 */
export function presentarEquivalenciaBCV(tasa, locale = "es-VE") {
  if (typeof tasa !== "number" || !Number.isFinite(tasa) || tasa <= 0) {
    return "Sin tasa disponible";
  }
  return `1 USD = ${formatearTasa(tasa, locale)} Bs`;
}

/**
 * Convierte un monto en VES a USD aplicando: montoUSD = montoVES / tasaVESporUSD
 * Si la moneda es USD, conserva el importe original sin conversión innecesaria.
 */
export function convertirMontoAUsd(monto, moneda, tasaVESporUSD) {
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0) {
    return 0;
  }
  if (moneda === "USD") {
    return monto;
  }
  if (
    typeof tasaVESporUSD !== "number" ||
    !Number.isFinite(tasaVESporUSD) ||
    tasaVESporUSD <= 0
  ) {
    throw new Error("La tasa de cambio VES/USD debe ser un número mayor que cero.");
  }
  return Number((monto / tasaVESporUSD).toFixed(6));
}

/**
 * Calcula el Saldo Proyectado según la fórmula:
 * Saldo Proyectado = Saldo Actual + Ingresos Pendientes - Gastos Pendientes
 */
export function calcularSaldoProyectado(
  saldoActual = 0,
  ingresosPendientes = 0,
  gastosPendientes = 0
) {
  return Number((saldoActual + ingresosPendientes - gastosPendientes).toFixed(6));
}

/**
 * Calcula los indicadores financieros de un periodo evitando divisiones entre cero y duplicidades contables.
 * Solo las transacciones con status === 'completed' (o sin estado definido) afectan el saldo real.
 * Las transacciones con status === 'pending' alimentan el Saldo Proyectado.
 */
export function calcularIndicadoresFinancieros(
  transactions = [],
  savings = [],
  startingBalanceUsd = 0,
  wallets = []
) {
  let ingresosDelPeriodo = 0;
  let gastosDelPeriodo = 0;
  let ingresosPendientes = 0;
  let gastosPendientes = 0;

  for (const txn of transactions) {
    const usd = Number.isFinite(txn.amountUsd) ? txn.amountUsd : 0;
    const isCompleted = (txn.status ?? "completed") === "completed";
    if (!isCompleted) {
      if (txn.type === "income") ingresosPendientes += usd;
      else if (txn.type === "expense") gastosPendientes += usd;
      continue;
    }
    if (txn.type === "income") ingresosDelPeriodo += usd;
    else if (txn.type === "expense") gastosDelPeriodo += usd;
  }

  let aportesAhorro = 0;
  let retirosAhorro = 0;
  let ajustesAhorro = 0;

  for (const sav of savings) {
    const usd = Number.isFinite(sav.amountUsd) && sav.amountUsd > 0 ? sav.amountUsd : 0;
    if (sav.type === "deposit") aportesAhorro += usd;
    else if (sav.type === "withdrawal") retirosAhorro += usd;
    else if (sav.type === "adjustment") {
      ajustesAhorro += sav.adjustmentDirection === "subtract" ? -usd : usd;
    }
  }

  const walletsInitialUsd = Array.isArray(wallets)
    ? wallets.reduce(
        (acc, w) =>
          acc + (Number.isFinite(w.initialBalanceUsd) ? w.initialBalanceUsd : 0),
        0
      )
    : 0;

  const balanceNeto = ingresosDelPeriodo - gastosDelPeriodo;
  const capacidadDeAhorro = ingresosDelPeriodo - gastosDelPeriodo;
  const porcentajeDeGastos =
    ingresosDelPeriodo > 0 ? (gastosDelPeriodo / ingresosDelPeriodo) * 100 : 0;

  const totalAhorrado = Math.max(0, aportesAhorro - retirosAhorro + ajustesAhorro);
  const dineroDisponible =
    (Number.isFinite(startingBalanceUsd) ? startingBalanceUsd : 0) +
    walletsInitialUsd +
    ingresosDelPeriodo -
    gastosDelPeriodo -
    aportesAhorro +
    retirosAhorro;

  const saldoProyectado = calcularSaldoProyectado(
    dineroDisponible,
    ingresosPendientes,
    gastosPendientes
  );

  const patrimonioFinanciero = dineroDisponible + totalAhorrado;

  return {
    ingresosDelPeriodo,
    gastosDelPeriodo,
    ingresosPendientes,
    gastosPendientes,
    balanceNeto,
    capacidadDeAhorro,
    porcentajeDeGastos,
    totalAhorrado,
    dineroDisponible,
    saldoProyectado,
    patrimonioFinanciero
  };
}
