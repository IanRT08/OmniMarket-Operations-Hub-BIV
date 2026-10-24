import { describe, expect, it } from "vitest";
import { parseDashboardRange } from "@/features/analytics/schemas";
import { formatCompactCurrency, formatShortDay } from "@/lib/format";

describe("rango del dashboard", () => {
  it("acepta solo los presets y cae a 30 días con cualquier otro valor", () => {
    expect(parseDashboardRange("7")).toBe(7);
    expect(parseDashboardRange(["90", "7"])).toBe(90);
    expect(parseDashboardRange(undefined)).toBe(30);
    expect(parseDashboardRange("15")).toBe(30);
    expect(parseDashboardRange("abc")).toBe(30);
  });
});

describe("formatos de la gráfica", () => {
  it("compacta montos del eje Y desde centavos", () => {
    expect(formatCompactCurrency(0)).toBe("$0");
    expect(formatCompactCurrency(50_000)).toBe("$500");
    expect(formatCompactCurrency(2_000_000)).toBe("$20K");
    expect(formatCompactCurrency(2_550_000)).toBe("$25.5K");
    expect(formatCompactCurrency(150_000_000)).toBe("$1.5M");
  });

  it("un día de negocio no se recorre por zona horaria", () => {
    // "2026-09-01" es una fecha de calendario: siempre 1 de septiembre, nunca
    // "31 ago" (lo que saldría al formatear medianoche UTC en hora de CDMX).
    // La abreviatura del mes ("sep"/"sept") depende de la versión de ICU.
    expect(formatShortDay("2026-09-01")).toMatch(/^1 sept?\.?$/);
  });
});
