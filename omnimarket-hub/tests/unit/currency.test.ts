import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/currency";

describe("formatCurrency", () => {
  it("formatea centavos como MXN en es-MX", () => {
    expect(formatCurrency(123_450)).toBe("$1,234.50");
    expect(formatCurrency(649_900)).toBe("$6,499.00");
  });

  it("maneja cero, negativos y redondeo de centavos", () => {
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(-0.4)).toBe("$0.00"); // nunca "-$0.00"
    expect(formatCurrency(-25_050)).toBe("-$250.50");
    expect(formatCurrency(12_345.6)).toBe("$123.46");
    expect(formatCurrency(99.4)).toBe("$0.99");
  });
});
