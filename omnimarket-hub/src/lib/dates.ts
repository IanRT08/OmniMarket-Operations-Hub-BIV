/** Zona horaria del día de negocio (métricas diarias, filtros por fecha). */
export const BUSINESS_TIMEZONE = "America/Mexico_City";

// en-CA formatea como YYYY-MM-DD, el mismo formato que la columna DATE.
const businessDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Día de negocio (YYYY-MM-DD en hora de CDMX) de un instante. */
export function toBusinessDay(date: Date | string): string {
  return businessDayFormatter.format(new Date(date));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Suma `days` (puede ser negativo) a un día YYYY-MM-DD. Aritmética de calendario, sin zona horaria. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date) + days * DAY_MS).toISOString().slice(0, 10);
}

const wallClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** Diferencia (ms) entre la hora de CDMX y UTC en un instante: −6 h para CDMX. */
function businessOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(wallClockFormatter.formatToParts(instant).map((p) => [p.type, Number(p.value)]));
  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Instante en que empieza un día de negocio (00:00 en CDMX): "2026-09-01" →
 * 2026-09-01T06:00:00Z. Sirve para filtrar `created_at` con el índice en vez
 * de convertir cada fila a la zona horaria. El offset se calcula con Intl, no
 * se asume fijo.
 */
export function businessDayStart(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, date);
  return new Date(utcMidnight - businessOffsetMs(new Date(utcMidnight)));
}
