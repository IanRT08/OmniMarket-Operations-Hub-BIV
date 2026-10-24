import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@/generated/prisma/enums";
import {
  applyCardMove,
  boardToColumnIds,
  findColumn,
  moveAcrossColumns,
  positionForIndex,
  reorderWithinColumn,
} from "@/lib/kanban-board";
import type { KanbanBoard, KanbanCard } from "@/server/dal/orders";

const card = (id: string, status: OrderStatus, position: string, version = 1): KanbanCard => ({
  id,
  orderNumber: `OM-${id}`,
  customerName: "Cliente",
  status,
  position,
  version,
  totalCents: 10_000,
  createdAt: new Date("2026-09-01T15:00:00Z"),
  itemsCount: 1,
});

function makeBoard(): KanbanBoard {
  const columns = {
    PENDING: [card("p1", "PENDING", "a0"), card("p2", "PENDING", "a1"), card("p3", "PENDING", "a2")],
    PROCESSING: [card("r1", "PROCESSING", "a0")],
    SHIPPED: [] as KanbanCard[],
    DELIVERED: [] as KanbanCard[],
    CANCELLED: [] as KanbanCard[],
  };
  return {
    columns: (Object.keys(columns) as OrderStatus[]).map((status) => ({
      status,
      total: columns[status].length,
      cards: columns[status],
    })),
  };
}

const ids = (board: KanbanBoard, status: OrderStatus) =>
  board.columns.find((c) => c.status === status)!.cards.map((c) => c.id);
const total = (board: KanbanBoard, status: OrderStatus) => board.columns.find((c) => c.status === status)!.total;

describe("vista previa del arrastre", () => {
  it("encuentra la columna de una tarjeta o de una columna vacía", () => {
    const columns = boardToColumnIds(makeBoard());
    expect(findColumn(columns, "p2")).toBe("PENDING");
    expect(findColumn(columns, "SHIPPED")).toBe("SHIPPED");
    expect(findColumn(columns, "nope")).toBeUndefined();
  });

  it("mueve entre columnas antes de la tarjeta destino o al final de una vacía", () => {
    const columns = boardToColumnIds(makeBoard());
    const overCard = moveAcrossColumns(columns, "p2", "r1");
    expect(overCard.PENDING).toEqual(["p1", "p3"]);
    expect(overCard.PROCESSING).toEqual(["p2", "r1"]);

    const overEmpty = moveAcrossColumns(columns, "p1", "SHIPPED");
    expect(overEmpty.SHIPPED).toEqual(["p1"]);
    // Misma columna: no cambia la referencia (evita renders).
    expect(moveAcrossColumns(columns, "p1", "p3")).toBe(columns);
  });

  it("reordena dentro de la columna al soltar", () => {
    const columns = boardToColumnIds(makeBoard());
    expect(reorderWithinColumn(columns, "p1", "p3").PENDING).toEqual(["p2", "p3", "p1"]);
    expect(reorderWithinColumn(columns, "p3", "p1").PENDING).toEqual(["p3", "p1", "p2"]);
    expect(reorderWithinColumn(columns, "p1", "PENDING")).toBe(columns);
  });
});

describe("posición fraccional al soltar", () => {
  const neighbors = [{ position: "a0" }, { position: "a1" }];

  it("queda entre vecinas, al inicio o al final", () => {
    const middle = positionForIndex(neighbors, 1);
    expect("a0" < middle && middle < "a1").toBe(true);
    expect(positionForIndex(neighbors, 0) < "a0").toBe(true);
    expect(positionForIndex(neighbors, 2) > "a1").toBe(true);
    expect(positionForIndex([], 0)).toBe("a0");
  });
});

describe("applyCardMove (actualización optimista y rollback)", () => {
  it("mueve la tarjeta de columna, la ordena por posición y ajusta totales", () => {
    const board = makeBoard();
    const next = applyCardMove(board, { orderId: "p1", toStatus: "PROCESSING", position: "Zz", version: 2 });

    expect(ids(next, "PENDING")).toEqual(["p2", "p3"]);
    expect(ids(next, "PROCESSING")).toEqual(["p1", "r1"]); // "Zz" < "a0"
    expect(total(next, "PENDING")).toBe(2);
    expect(total(next, "PROCESSING")).toBe(2);
    const moved = next.columns[1].cards[0];
    expect(moved).toMatchObject({ status: "PROCESSING", position: "Zz", version: 2 });
    // Inmutable: el tablero original no cambió (es el snapshot del rollback).
    expect(ids(board, "PENDING")).toEqual(["p1", "p2", "p3"]);
  });

  it("reordenar dentro de la misma columna no cambia totales", () => {
    const next = applyCardMove(makeBoard(), { orderId: "p1", toStatus: "PENDING", position: "a1V", version: 2 });
    expect(ids(next, "PENDING")).toEqual(["p2", "p1", "p3"]);
    expect(total(next, "PENDING")).toBe(3);
  });

  it("el rollback (mover de vuelta al origen) restaura el tablero", () => {
    const board = makeBoard();
    const optimistic = applyCardMove(board, { orderId: "p2", toStatus: "SHIPPED", position: "a0", version: 2 });
    const rolledBack = applyCardMove(optimistic, { orderId: "p2", toStatus: "PENDING", position: "a1", version: 1 });
    expect(rolledBack).toEqual(board);
  });

  it("ignora una tarjeta que no está en el tablero", () => {
    const board = makeBoard();
    expect(applyCardMove(board, { orderId: "x", toStatus: "PENDING", position: "a0", version: 1 })).toBe(board);
  });
});
