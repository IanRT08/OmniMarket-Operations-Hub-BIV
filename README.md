# OmniMarket — Operations Hub

[![CI](https://github.com/IanRT08/OmniMarket-Operations-Hub-BIV/actions/workflows/ci.yml/badge.svg)](https://github.com/IanRT08/OmniMarket-Operations-Hub-BIV/actions/workflows/ci.yml)

Dashboard analítico para la gestión de un e-commerce: KPIs de ventas, tabla de pedidos con edición en lote, tablero Kanban con Drag & Drop y catálogo de productos. Next.js 16 (App Router) + TypeScript + Tailwind CSS, PostgreSQL y autenticación OAuth 2.0 con Google y GitHub.

| | |
|---|---|
| **Producción** | `https://omni-market-operations-hub-biv.vercel.app` |
| **Pipeline CI/CD** | [GitHub Actions](https://github.com/IanRT08/OmniMarket-Operations-Hub-BIV/actions/workflows/ci.yml) |
| **Token de auditoría** | Se entrega por separado (no se publica en el repositorio) |

---

## Para el evaluador

Los pasos de la *Lista de Comprobación para el Evaluador* (sección 6 de los lineamientos), con los comandos listos. Sustituye `$URL` por la URL de producción y `$TOKEN` por el token de auditoría.

```bash
URL=https://omni-market-operations-hub-biv.vercel.app
TOKEN=<token-de-auditoría>
```

### 1. Autenticación OAuth

Abre `$URL`. Sin sesión, cualquier ruta privada redirige a `/login`, que ofrece **Continuar con Google** y **Continuar con GitHub**. Tras iniciar sesión se regresa a la ruta solicitada.

### 2. Latencia SLA de `GET /api/test/analytics`

```bash
curl -s -o /dev/null -D - "$URL/api/test/analytics?page=1&limit=50" | grep -i server-timing
curl -s "$URL/api/test/analytics?page=1&limit=50" | jq .meta
```

Cada respuesta incluye `meta.durationMs` y el header `Server-Timing` (también visible en *DevTools → Network → Timing*), para que la latencia del servidor se pueda medir y no solo afirmar. La primera petición tras un periodo de inactividad incluye el arranque en frío de la función serverless; las siguientes reflejan el tiempo normal.

### 3. Drag & Drop con persistencia

1. Restablece el dataset conocido (opcional):
   ```bash
   curl -s -X POST -H "x-audit-token: $TOKEN" "$URL/api/test/reset-data" | jq .data
   ```
2. En **Kanban**, arrastra la tarjeta **OM-E2E-0001** (primera de *Pendiente*) a otra columna. La tarjeta cambia al instante (actualización optimista) y aparece un toast de confirmación. También se puede mover con teclado: enfocar la tarjeta, **Espacio**, flechas, **Espacio**.
3. Verifica que el cambio se guardó en la base de datos:
   ```bash
   curl -s "$URL/api/test/kanban-status?orderId=OM-E2E-0001" | jq .data
   ```
   `order.status` muestra el estado nuevo y `lastEvent` el movimiento (`fromStatus` → `toStatus`).

### 4. Pipeline de integración continua

En la pestaña **Actions** del repositorio, la última corrida de `CI` sobre `main` debe tener los cuatro jobs en verde: *Lint y typecheck → Tests unitarios → Tests E2E → Desplegar a producción*. El enlace **View deployment** de la corrida apunta a la versión desplegada.

### Otras funciones a revisar

- **Bulk Update** — *Pedidos*: selecciona varias filas, elige un estado y pulsa **Aplicar**. Cambio optimista, toast con el resumen y reversión si el servidor falla.
- **CRUD completo de pedidos y productos**:
  - **Crear**: *Pedidos → Nuevo pedido* y *Productos → Nuevo producto*. El registro aparece en su tabla al guardar.
  - **Editar** (✏️ en cada fila): datos del cliente y estado del pedido; nombre, precio, costo, ajuste de stock y disponibilidad del producto. El SKU y las partidas de un pedido no se editan: conservan el precio de la venta.
  - **Eliminar** (🗑️ en cada fila, con confirmación):
    - Un pedido desaparece de la tabla al instante (optimista) y, si contaba como venta, devuelve su stock y se resta de las métricas.
    - Un producto solo se puede borrar si nunca se ha vendido. Si tiene ventas, el aviso ofrece **Desactivarlo** para conservar su historial.
- **Dashboard** — KPIs del periodo (7 / 30 / 90 días), ingresos por día y pedidos por estado; se refresca cada 30 s.

---

## Endpoints de auditoría

Habilitados con `ENABLE_TEST_ENDPOINTS=true`; si no, responden 404. Todas las respuestas son JSON con `meta.durationMs` y el header `Server-Timing`.

### `GET /api/test/analytics?page=1&limit=50`

Métricas de ventas por día (zona horaria America/Mexico_City), paginadas.

| Parámetro | Tipo | Default | Regla |
|---|---|---|---|
| `page` | entero | 1 | ≥ 1 |
| `limit` | entero | 50 | 1 – 100 |

```jsonc
{
  "data": [
    { "day": "2026-10-05", "ordersCount": 3, "revenueCents": 2598600, "costCents": 1547000,
      "itemsSold": 14, "grossMarginCents": 1051600, "grossMarginRatio": 0.4047, "averageTicketCents": 866200 }
  ],
  "summary": { "days": 35, "ordersCount": 95, "revenueCents": 74798200, "...": "...",
               "ordersByStatus": { "PENDING": 21, "PROCESSING": 21, "SHIPPED": 21, "DELIVERED": 32, "CANCELLED": 10 } },
  "pagination": { "page": 1, "limit": 50, "total": 35, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false },
  "meta": { "durationMs": 12.4 }
}
```

Parámetros inválidos → `400` con el detalle por campo. Montos en centavos (`revenueCents: 2598600` = $25,986.00 MXN).

**Cómo cumple el SLA < 300 ms:** lee la tabla pre-agregada `daily_sales_metrics` (una fila por día, actualizada en la misma transacción que crea, cancela o mueve pedidos) en lugar de sumar todos los pedidos; pagina sobre la llave primaria y lanza sus consultas en paralelo. Las funciones de Vercel (`iad1`) y la base de datos (us-east-1) están en la misma región.

### `GET /api/test/kanban-status?orderId=OM-E2E-0001`

Estado actual de un pedido y su último movimiento. `orderId` acepta el UUID o el número de pedido.

```jsonc
{
  "ok": true,
  "data": {
    "order": { "id": "b0000000-0000-4000-8000-000000000001", "orderNumber": "OM-E2E-0001",
               "status": "PROCESSING", "position": "a0", "version": 2, "updatedAt": "…" },
    "lastEvent": { "id": "275", "fromStatus": "PENDING", "toStatus": "PROCESSING",
                   "actorId": "…", "createdAt": "…" }
  },
  "meta": { "durationMs": 8.1 }
}
```

`404` si el pedido no existe; `400` si falta `orderId`. No usa caché: refleja el movimiento al instante.

### `POST /api/test/reset-data` — header `x-audit-token` obligatorio

Restablece el dataset de prueba conocido y responde con los conteos:

```json
{ "ok": true, "data": { "products": 12, "orders": 105, "orderItems": 228, "statusEvents": 274, "dailyMetrics": 35, "e2eSession": false } }
```

- Sin token o con token incorrecto → `401`; comparación en tiempo constante.
- Una sola transacción: o queda el seed completo, o la base queda como estaba. Un *advisory lock* serializa resets simultáneos.
- Solo toca las tablas de negocio. Las de autenticación quedan intactas, así que tu sesión OAuth sigue activa.
- Dataset determinista: IDs, fechas y posiciones fijas. **OM-E2E-0001** es siempre la primera tarjeta de *Pendiente*.

---

## Cobertura de la matriz de evaluación

| Módulo | Implementación |
|---|---|
| **1. Arquitectura & Next.js** | App Router, TypeScript estricto y Tailwind CSS 4. Server Components por defecto, Client Components solo con interactividad. Un test E2E recorre todas las páginas y falla ante cualquier error de consola. |
| **2. Endpoints de auditoría** | Los tres endpoints de arriba, con `Server-Timing` y SLA verificado en E2E. |
| **3. Drag & Drop y CRUD** | Kanban con dnd-kit (puntero y teclado), mutación optimista con reversión y control de concurrencia por versión. Bulk Update de hasta 100 pedidos. CRUD completo (crear, listar, editar, eliminar) de pedidos y productos. Toasts y skeletons en toda carga. |
| **4. Pruebas & CI/CD** | 42 tests unitarios (Vitest) y 37 E2E (Playwright) que cubren los 3 flujos obligatorios. El pipeline bloquea el despliegue si algo falla. |
| **5. Despliegue** | Vercel (`iad1`) + PostgreSQL en Supabase (us-east-1), SSL de Vercel. |

---

## Arquitectura

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Estilos / UI | Tailwind CSS 4, componentes estilo shadcn/ui, Sonner (toasts), Recharts |
| Datos en cliente | TanStack Query 5 (cache, optimismo, refresco), TanStack Table 9 |
| Formularios | React Hook Form + Zod 4 (los mismos esquemas en cliente, Server Actions y tests) |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable`, índices fraccionales (`fractional-indexing`) |
| Base de datos | PostgreSQL (Supabase), Prisma ORM 7 con `@prisma/adapter-pg` |
| Autenticación | Better Auth — OAuth 2.0 con Google y GitHub |
| Pruebas | Vitest, Playwright |

```
.github/workflows/ci.yml            # pipeline CI/CD (en la raíz del repo, donde GitHub lo busca)
omnimarket-hub/                     # la aplicación Next.js
├── src/
│   ├── app/
│   │   ├── (auth)/login/           # inicio de sesión (Google / GitHub)
│   │   ├── (dashboard)/            # layout con requireSession() + navegación
│   │   │   └── dashboard/  kanban/  orders/{new, [id]/edit}/  products/{new, [id]/edit}/
│   │   └── api/
│   │       ├── auth/[...all]/      # Better Auth
│   │       └── test/               # endpoints de auditoría
│   ├── features/                   # módulos por dominio: actions, schemas, queries, hooks, componentes
│   │   └── analytics/  kanban/  orders/  products/
│   ├── server/                     # solo servidor ("server-only")
│   │   ├── dal/                    # Data Access Layer: única puerta a la base de datos
│   │   └── auth.ts  session.ts  db.ts  test-guard.ts
│   ├── lib/                        # funciones puras (objetivo de los tests unitarios)
│   └── proxy.ts                    # chequeo rápido de cookie (middleware en Next 16)
├── prisma/                         # schema, migraciones y seed
├── e2e/   tests/                   # Playwright y Vitest
├── scripts/smoke-test.mjs          # verificación del despliegue
└── vercel.json                     # región iad1 y auto-deploy por Git desactivado
```

**Decisiones clave**

- **Métricas pre-agregadas.** `daily_sales_metrics` se actualiza en la misma transacción que cada mutación de pedidos, así que las lecturas analíticas no recorren la tabla de pedidos.
- **Concurrencia optimista en el Kanban.** `UPDATE … WHERE id = $1 AND version = $2`. Si otro usuario movió la tarjeta, el servidor responde `VERSION_CONFLICT` y la interfaz revierte el cambio con un aviso.
- **Índice fraccional + `COLLATE "C"`.** Mover una tarjeta actualiza una sola fila, y Postgres ordena las llaves byte a byte.
- **Stock transaccional.** Se descuenta al crear un pedido o al sacarlo de *Cancelado* y se repone al cancelarlo o eliminarlo. Los locks se toman en orden fijo para evitar *deadlocks*.
- **Eliminar sin perder historial.** `order_items → products` es `RESTRICT`: un producto vendido no se borra, se desactiva. Editar o eliminar un pedido exige la `version` leída, igual que el Kanban.
- **Dos capas de autenticación.** `proxy.ts` solo revisa que exista la cookie (rápido); la validación real ocurre en el layout y en cada Server Action con `requireSession()`. Un E2E comprueba que una cookie falsificada no da acceso.
- **Caché con tag.** Los KPIs del dashboard se cachean con el tag `analytics`, y cada mutación lo invalida.
- **Dinero en centavos** (enteros) en toda la base de datos y la lógica.

---

## Pruebas

```bash
npm test                 # Vitest: 42 tests unitarios
npm run test:e2e         # Playwright: 37 tests E2E (ver "Desarrollo local")
```

**Unitarias (`tests/unit/`)** — los 10 casos mínimos de los lineamientos más extras:

| Lineamiento | Archivo |
|---|---|
| Ticket promedio (normal y con 0 pedidos), margen bruto (normal y con ingresos en 0) | `finance.test.ts` |
| Formateador de moneda MXN (normal; cero, negativos y redondeo) | `currency.test.ts` |
| Esquemas Zod: `createOrderSchema` válido / cantidad ≤ 0; `bulkUpdateSchema` > 100 IDs o estado inválido | `schemas.test.ts` |
| Filtrado por estado y rango de fechas | `filters.test.ts` |
| Extras: índice fraccional, lógica del tablero, fechas de negocio, normalización de filtros, esquemas de productos, edición/eliminación y dashboard | `position`, `kanban-board`, `dates`, `list-and-product-schemas`, `crud-schemas`, `dashboard-format` |

**End-to-end (`e2e/`)** — los 3 flujos obligatorios:

| Flujo | Archivo | Qué verifica |
|---|---|---|
| 1. Autenticación | `auth.spec.ts` | Las rutas privadas redirigen a `/login` sin sesión; una cookie falsificada no da acceso; la sesión simulada entra; no hay redirecciones abiertas |
| 2. Creación | `create-order.spec.ts` | Alta de producto y de pedido reflejadas en sus tablas; Bulk Update persistido |
| 3. Drag & Drop | `kanban-dnd.spec.ts` | Arrastre de OM-E2E-0001 con cambio de columna en el DOM y persistencia vía `kanban-status`; reversión visual si el servidor falla |
| CRUD | `crud.spec.ts` | Editar producto y pedido (con cambio de estado persistido), eliminar producto sin ventas, rechazo de producto con ventas, eliminar pedido (404 en `kanban-status`) |
| Extras | `audit-api`, `dashboard`, `console` | Contrato y SLA de los endpoints, dashboard, páginas sin errores de consola |

La sesión E2E se simula: el reset crea una sesión con un token conocido y `auth.setup.ts` construye la cookie firmada, así que nunca se usa Google ni GitHub reales.

---

## CI/CD

`.github/workflows/ci.yml` (en la raíz del repositorio; sus comandos corren dentro de `omnimarket-hub/`), en cada push a `main` y en cada pull request:

```
Lint y typecheck ──► Tests unitarios ──► Tests E2E (Postgres 17) ──► Desplegar a producción
                                                                     (solo push a main)
```

El auto-deploy por Git de Vercel está desactivado (`omnimarket-hub/vercel.json` → `"git": { "deploymentEnabled": false }`), así que **la única vía a producción es el último job**, y solo se ejecuta si los tres anteriores pasan. Los E2E corren contra un Postgres efímero con secretos de prueba; nunca tocan producción.

Secretos del repositorio (*Settings → Secrets and variables → Actions*): `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

---

## Desarrollo local

**Requisitos:** Node.js ≥ 22.12 y una base PostgreSQL. Puede ser local, con `npx prisma dev`. Todos los comandos se ejecutan dentro de `omnimarket-hub/`.

```bash
cd omnimarket-hub
npm install                      # también genera el cliente de Prisma
cp .env.example .env             # completa los valores
npm run db:migrate               # aplica las migraciones
npm run db:seed                  # carga el dataset de prueba
npm run dev                      # http://localhost:3000
```

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión de la app. En Supabase: pooler en modo transacción (puerto 6543, `pgbouncer=true`) |
| `DIRECT_URL` | Conexión para migraciones. En Supabase: pooler en modo sesión (puerto 5432) |
| `DB_POOL_MAX` | Conexiones por instancia (5). Con la base local de `prisma dev` usa **1** |
| `BETTER_AUTH_SECRET` | Secreto de firma de sesiones (32+ caracteres aleatorios) |
| `BETTER_AUTH_URL` | URL pública de la app (`http://localhost:3000` en local) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciales OAuth de Google |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Credenciales OAuth de GitHub |
| `ENABLE_TEST_ENDPOINTS` | `true` para habilitar `/api/test/*` |
| `AUDIT_TOKEN` | Valor del header `x-audit-token` para `reset-data` |
| `E2E_SESSION_TOKEN` | Solo para pruebas: sesión simulada. **No definir en producción** |

Callbacks de OAuth a registrar: `<BETTER_AUTH_URL>/api/auth/callback/google` y `<BETTER_AUTH_URL>/api/auth/callback/github`.

**E2E en local** contra una base desechable, sin tocar la de tu `.env` (PowerShell):

```powershell
npx prisma dev --name omnimarket-e2e --detach   # imprime la URL postgres://… local
$env:DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"; $env:DIRECT_URL=$env:DATABASE_URL
$env:DB_POOL_MAX="1"; $env:ENABLE_TEST_ENDPOINTS="true"; $env:E2E_BASE_URL="http://localhost:3200"; $env:BETTER_AUTH_URL="http://localhost:3200"
npx prisma migrate deploy
npm run test:e2e:install   # solo la primera vez: descarga Chromium
npm run test:e2e
```

---

## Despliegue en Vercel

1. **Base de datos:** aplica las migraciones y carga el seed en la base de producción (`npm run db:migrate` y `npm run db:seed` con las URLs de producción, o el `reset-data` una vez desplegado).
2. **Root Directory:** en *Settings → Build and Deployment* del proyecto, **Root Directory = `omnimarket-hub`** (la app no está en la raíz del repositorio).
3. **Variables de entorno** del proyecto (*Settings → Environment Variables → Production*): todas las de la tabla anterior excepto `E2E_SESSION_TOKEN`. `BETTER_AUTH_URL` debe ser la URL pública (`https://…`) y `ENABLE_TEST_ENDPOINTS=true`.
4. **OAuth:** registra los callbacks de producción en Google Cloud Console y en una OAuth App de GitHub (GitHub admite una sola callback URL por app; usa apps distintas para local y producción).
5. **Secretos de GitHub:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Los dos últimos salen de `.vercel/project.json` tras `npx vercel link`.
6. **Push a `main`.** El pipeline prueba y despliega.
7. **Verifica el despliegue** (desde `omnimarket-hub/`):
   ```bash
   npm run smoke -- https://omni-market-operations-hub-biv.vercel.app
   ```
   Comprueba en solo lectura HTTPS, protección de rutas, Better Auth, los callbacks de ambos OAuth, los endpoints de auditoría con su SLA, el seed y que `reset-data` exija token. Si algo falla, indica qué variable revisar.
