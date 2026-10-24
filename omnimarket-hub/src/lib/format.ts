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
