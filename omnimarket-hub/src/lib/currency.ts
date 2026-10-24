const mxnFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

/**
 * Formatea centavos como pesos mexicanos: 123450 → "$1,234.50".
 * Redondea fracciones de centavo y nunca muestra "-$0.00".
 */
export function formatCurrency(cents: number): string {
  const roundedCents = Math.round(cents) || 0; // `|| 0` convierte -0 en 0
  return mxnFormatter.format(roundedCents / 100);
}
