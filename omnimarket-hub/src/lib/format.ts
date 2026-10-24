import { BUSINESS_TIMEZONE } from "@/lib/dates";

// Formateadores de UI en es-MX y hora de CDMX (misma salida en servidor y
// cliente, así no hay diferencias de hidratación).

const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: BUSINESS_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("es-MX");

const percentFormatter = new Intl.NumberFormat("es-MX", { style: "percent", maximumFractionDigits: 1 });

export const formatDateTime = (date: Date | string) => dateTimeFormatter.format(new Date(date));
export const formatNumber = (value: number) => numberFormatter.format(value);
export const formatPercent = (ratio: number) => percentFormatter.format(ratio);

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});
export const formatTime = (date: Date | number) => timeFormatter.format(new Date(date));

// Un día de negocio "YYYY-MM-DD" ya es una fecha de calendario: se formatea en
// UTC para que la conversión de zona horaria no lo recorra al día anterior.
const shortDayFormatter = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short" });
const longDayFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
export const formatShortDay = (day: string) => shortDayFormatter.format(new Date(`${day}T00:00:00Z`));
export const formatLongDay = (day: string) => longDayFormatter.format(new Date(`${day}T00:00:00Z`));

/** Montos compactos para ejes: 2_000_000 centavos → "$20K", 150_000_000 → "$1.5M". */
export function formatCompactCurrency(cents: number): string {
  const pesos = cents / 100;
  const abs = Math.abs(pesos);
  const [value, suffix] = abs >= 1_000_000 ? [pesos / 1_000_000, "M"] : abs >= 1_000 ? [pesos / 1_000, "K"] : [pesos, ""];
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return `$${rounded}${suffix}`;
}
