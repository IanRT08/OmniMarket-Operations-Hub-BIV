import { describe, expect, it } from "vitest";
import { isValidPosition, positionAfter, positionBetween } from "@/lib/position";

describe("índice fraccional del Kanban", () => {
  it("genera llaves ordenadas entre vecinas y en los extremos", () => {
    const first = positionAfter(null);
    const last = positionAfter(first);
    const middle = positionBetween(first, last);
    const top = positionBetween(null, first);

    expect([last, middle, first, top].sort()).toEqual([top, first, middle, last]);
  });

  it("mantiene el orden tras muchas inserciones en el mismo hueco", () => {
    let before = positionAfter(null);
    const after = positionAfter(before);
    for (let i = 0; i < 50; i++) {
      const key = positionBetween(before, after);
      expect(before < key && key < after).toBe(true);
      before = key;
    }
  });

  it("tolera vecinas empatadas o invertidas sin lanzar", () => {
    expect(positionBetween("a1", "a1") > "a1").toBe(true);
    expect(positionBetween("a2", "a1") > "a2").toBe(true);
  });

  it("valida el formato de las llaves", () => {
    expect(isValidPosition("a0")).toBe(true);
    expect(isValidPosition(positionBetween("a0", "a1"))).toBe(true);
    expect(isValidPosition("")).toBe(false);
    expect(isValidPosition("a0 ")).toBe(false);
    expect(isValidPosition("a10")).toBe(false); // termina en 0: no canónica
  });
});
