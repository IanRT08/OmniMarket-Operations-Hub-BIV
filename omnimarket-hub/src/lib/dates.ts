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
