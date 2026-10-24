// Funciones puras de finanzas. Todo el dinero entra y sale en centavos.

/** Ticket promedio en centavos. Con 0 pedidos devuelve 0 (nunca NaN). */
export function averageTicketCents(revenueCents: number, ordersCount: number): number {
  if (ordersCount <= 0) return 0;
  return Math.round(revenueCents / ordersCount);
}

/** Margen bruto en centavos: ingresos − costo. */
export function grossMarginCents(revenueCents: number, costCents: number): number {
  return revenueCents - costCents;
}

/** Margen bruto como proporción de los ingresos (0.25 = 25 %). Con ingresos en 0 devuelve 0. */
export function grossMarginRatio(revenueCents: number, costCents: number): number {
  if (revenueCents === 0) return 0;
  return (revenueCents - costCents) / revenueCents;
}
