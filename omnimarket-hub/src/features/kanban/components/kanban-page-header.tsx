/** Encabezado compartido por la página y su loading.tsx (sin salto de layout al cargar). */
export function KanbanPageHeader() {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Tablero de pedidos</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Arrastra una tarjeta para cambiar el estado del pedido. Con teclado: enfoca la tarjeta, presiona Espacio, muévela
        con las flechas y vuelve a presionar Espacio.
      </p>
    </div>
  );
}
