import { describe, expect, it } from "vitest";
import { addDays, businessDayStart, toBusinessDay } from "@/lib/dates";

describe("días de negocio (CDMX)", () => {
  it("el día empieza a las 00:00 de CDMX (06:00 UTC)", () => {
    expect(businessDayStart("2026-09-01").toISOString()).toBe("2026-09-01T06:00:00.000Z");
    // Ida y vuelta: el inicio del día pertenece a ese mismo día, el instante previo al anterior.
    const start = businessDayStart("2026-10-24");
    expect(toBusinessDay(start)).toBe("2026-10-24");
    expect(toBusinessDay(new Date(start.getTime() - 1))).toBe("2026-10-23");
  });

  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
