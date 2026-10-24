import { describe, expect, it } from "vitest";
import { averageTicketCents, grossMarginCents, grossMarginRatio } from "@/lib/finance";

describe("averageTicketCents", () => {
  it("calcula el ticket promedio con datos normales", () => {
    // $1,000.00 + $500.00 + $300.00 = $1,800.00 / 3 pedidos
    expect(averageTicketCents(180_000, 3)).toBe(60_000);
  });

  it("devuelve 0 con 0 pedidos, sin NaN", () => {
    const result = averageTicketCents(0, 0);
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });
});

describe("margen bruto", () => {
  it("calcula el margen en centavos y como proporción", () => {
    expect(grossMarginCents(200_000, 150_000)).toBe(50_000);
    expect(grossMarginRatio(200_000, 150_000)).toBe(0.25);
  });

  it("devuelve 0 de margen con ingresos en 0", () => {
    expect(grossMarginRatio(0, 0)).toBe(0);
    expect(grossMarginRatio(0, 5_000)).toBe(0);
  });
});
