export function sanitizeDecimalInput(value: string): string {
  // Permite dígitos, puntos y comas
  return value.replace(/[^0-9.,]/g, '');
}

export function parseNumberInput(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}
