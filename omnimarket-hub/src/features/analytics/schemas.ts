import { z } from "zod";

export const ANALYTICS_DEFAULT_LIMIT = 50;
export const ANALYTICS_MAX_LIMIT = 100;

// Query string de GET /api/test/analytics. Los parámetros ausentes toman el
// valor por defecto; los presentes pero inválidos ("abc", "0", "101") fallan.
export const analyticsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(ANALYTICS_MAX_LIMIT).default(ANALYTICS_DEFAULT_LIMIT),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
