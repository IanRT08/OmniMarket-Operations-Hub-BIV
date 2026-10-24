import "@/lib/zod-locale";
import { z } from "zod";

/** Rangos del dashboard (presets, sin calendario: "últimos N días"). */
export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export const DASHBOARD_DEFAULT_RANGE: DashboardRange = 30;

export const dashboardRangeSchema = z.coerce
  .number()
  .refine((days): days is DashboardRange => (DASHBOARD_RANGES as readonly number[]).includes(days), {
    message: "Rango no soportado",
  });

/** ?days= de la URL → rango válido (cualquier otro valor cae al default). */
export function parseDashboardRange(raw: string | string[] | undefined): DashboardRange {
  const parsed = dashboardRangeSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  return parsed.success ? (parsed.data as DashboardRange) : DASHBOARD_DEFAULT_RANGE;
}

export const ANALYTICS_DEFAULT_LIMIT = 50;
export const ANALYTICS_MAX_LIMIT = 100;

// Query string de GET /api/test/analytics. Los parámetros ausentes toman el
// valor por defecto; los presentes pero inválidos ("abc", "0", "101") fallan.
export const analyticsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(ANALYTICS_MAX_LIMIT).default(ANALYTICS_DEFAULT_LIMIT),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
