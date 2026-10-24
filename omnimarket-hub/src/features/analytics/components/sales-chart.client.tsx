"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatCurrency } from "@/lib/currency";
import { formatCompactCurrency, formatLongDay, formatNumber, formatPercent, formatShortDay } from "@/lib/format";
import type { DashboardKpis } from "@/server/dal/dashboard";

type Point = DashboardKpis["series"][number];

// Color de datos: olive de la paleta. Validado con el script de dataviz sobre
// la tarjeta blanca: banda de luminosidad, croma ≥ 0.1 y contraste 3.1:1.
// (moss se ve casi gris como color de datos: falla el piso de croma.)
// Hover: lime, también de la paleta, aclara la barra para que "responda".
const SERIES = "#90984c";
const SERIES_HOVER = "#9bbf4c";
const GRID = "#e6ecdc"; // un paso sobre la superficie: recesivo
const AXIS_TEXT = "#4a5238"; // ink-muted (texto nunca con el color de la serie)

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-ink-muted">{formatLongDay(point.day)}</p>
      {/* El valor manda; la etiqueta de la serie es secundaria. */}
      <p className="mt-1 flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES }} aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">{formatCurrency(point.revenueCents)}</span>
        <span className="text-ink-muted">ingresos</span>
      </p>
      <p className="mt-1 text-ink-muted">
        {formatNumber(point.ordersCount)} {point.ordersCount === 1 ? "pedido" : "pedidos"} · margen{" "}
        {formatPercent(point.grossMarginRatio)}
      </p>
    </div>
  );
}

/**
 * Ingresos por día (una sola serie → sin leyenda: el título dice qué es).
 * Columnas ≤ 24 px con punta redondeada de 4 px y base recta; rejilla
 * horizontal fina; tooltip por barra. La tabla de abajo es la vista
 * equivalente sin gráfica (accesible y sin depender del hover).
 */
export function SalesChart({ series, range }: { series: Point[]; range: DashboardKpis["range"] }) {
  const total = series.reduce((sum, point) => sum + point.revenueCents, 0);
  const best = series.reduce<Point | undefined>((top, point) => (!top || point.revenueCents > top.revenueCents ? point : top), undefined);

  return (
    <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="sales-chart-title">
      <div className="mb-4">
        <h2 id="sales-chart-title" className="text-base font-semibold text-ink">
          Ingresos por día
        </h2>
        <p className="text-xs text-ink-muted">
          Del {formatShortDay(range.from)} al {formatShortDay(range.to)} · sin pedidos cancelados
        </p>
      </div>

      {/* La altura incluye la banda del eje X: sin scroll interno. */}
      <div
        className="h-72"
        role="img"
        aria-label={`Gráfica de ingresos diarios: ${formatCurrency(total)} en ${range.days} días${
          best && best.revenueCents > 0 ? `; el mejor día fue ${formatLongDay(best.day)} con ${formatCurrency(best.revenueCents)}` : ""
        }.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="day"
              tickFormatter={formatShortDay}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={formatCompactCurrency}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={ChartTooltip} cursor={false} isAnimationActive={false} />
            <Bar
              dataKey="revenueCents"
              name="Ingresos"
              fill={SERIES}
              activeBar={{ fill: SERIES_HOVER }}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">Ver datos en tabla</summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-brand-mint/30">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">Día</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink">Pedidos</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink">Ingresos</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold text-ink">Margen</th>
              </tr>
            </thead>
            <tbody>
              {series.map((point) => (
                <tr key={point.day} className="border-t border-border">
                  <td className="px-3 py-1.5 text-ink">{formatLongDay(point.day)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{formatNumber(point.ordersCount)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{formatCurrency(point.revenueCents)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">
                    {point.revenueCents > 0 ? formatPercent(point.grossMarginRatio) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
