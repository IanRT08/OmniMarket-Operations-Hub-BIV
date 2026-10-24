<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!--
Contexto del proyecto

Resumen del Proyecto y Objetivo de Evaluación
OmniMarket Operations Hub es un dashboard analítico web para la gestión integral de e-commerce.
Esta especificación define los requisitos técnicos obligatorios para la arquitectura en Next.js 14+,
interacción Kanban Drag & Drop y auditoría vía endpoints de prueba.

omnimarket-ops-hub/
├── .github/
│   └── workflows/
│       └── ci.yml                      # lint → typecheck → unit → e2e → deploy (bloqueante)
├── drizzle/                            # migraciones SQL generadas por drizzle-kit (versionadas)
├── e2e/                                # Playwright
│   ├── auth.setup.ts                   # reset-data + sesión simulada → storageState
│   ├── auth.spec.ts                    # Flujo 1: redirección de rutas privadas
│   ├── create-order.spec.ts            # Flujo 2: crear pedido y verlo en la tabla
│   ├── kanban-dnd.spec.ts              # Flujo 3: arrastre + aserción vía /api/test/kanban-status
│   └── fixtures/
│       └── seed-ids.ts                 # IDs fijos del dataset de prueba
├── tests/                              # Vitest
│   ├── setup.ts
│   └── unit/
│       ├── finance.test.ts             # ticket promedio, margen
│       ├── currency.test.ts            # formateador MXN
│       ├── schemas.test.ts             # Zod: createOrder, bulkUpdate, analyticsQuery
│       ├── filters.test.ts             # filtrado por estado/fecha
│       └── position.test.ts            # índice fraccional del Kanban
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # RSC raíz
│   │   ├── providers.tsx               # "use client": QueryClientProvider + <Toaster/>
│   │   ├── globals.css                 # Tailwind
│   │   ├── error.tsx  ·  not-found.tsx
│   │   ├── (auth)/
│   │   │   └── login/page.tsx          # RSC; botones OAuth son client
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # RSC: requireSession() + sidebar
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx            # RSC: KPIs + prefetch de TanStack Query
│   │   │   │   └── loading.tsx         # Skeleton del segmento
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx · loading.tsx
│   │   │   │   └── new/page.tsx
│   │   │   ├── kanban/
│   │   │   │   ├── page.tsx · loading.tsx
│   │   │   └── products/
│   │   │       ├── page.tsx · loading.tsx
│   │   │       └── new/page.tsx
│   │   └── api/
│   │       ├── auth/[...all]/route.ts  # handler de Better Auth (callbacks OAuth)
│   │       └── test/
│   │           ├── analytics/route.ts      # GET ?page&limit
│   │           ├── reset-data/route.ts     # POST (protegido por token)
│   │           └── kanban-status/route.ts  # GET ?orderId
│   ├── features/                       # módulos verticales por dominio
│   │   ├── analytics/
│   │   │   ├── components/
│   │   │   │   ├── kpi-cards.tsx               # RSC
│   │   │   │   ├── sales-chart.client.tsx      # "use client" (Recharts)
│   │   │   │   └── analytics-skeleton.tsx
│   │   │   └── queries.ts                       # queryOptions compartidas server/client
│   │   ├── orders/
│   │   │   ├── actions.ts              # "use server": createOrder, bulkUpdateStatus
│   │   │   ├── schemas.ts              # Zod
│   │   │   ├── hooks/use-bulk-update.ts
│   │   │   └── components/
│   │   │       ├── orders-table.client.tsx     # TanStack Table + selección de filas
│   │   │       ├── bulk-actions-bar.client.tsx
│   │   │       └── order-form.client.tsx
│   │   ├── kanban/
│   │   │   ├── actions.ts              # "use server": moveOrder
│   │   │   ├── hooks/use-move-order.ts # mutación optimista + rollback
│   │   │   └── components/
│   │   │       ├── kanban-board.client.tsx     # DndContext
│   │   │       ├── kanban-column.client.tsx
│   │   │       └── order-card.tsx
│   │   └── products/
│   │       ├── actions.ts · schemas.ts
│   │       └── components/
│   ├── components/
│   │   ├── ui/                         # shadcn/ui: button, skeleton, table, dialog, sonner…
│   │   └── layout/                     # sidebar, header, user-menu.client.tsx
│   ├── server/                         # todo con import "server-only"
│   │   ├── auth.ts                     # config Better Auth (Google + GitHub)
│   │   ├── session.ts                  # getSession / requireSession (cache por request)
│   │   ├── test-guard.ts               # validación de token para /api/test/*
│   │   └── dal/                        # Data Access Layer: única puerta a la BD
│   │       ├── analytics.ts
│   │       ├── orders.ts
│   │       └── products.ts
│   ├── db/
│   │   ├── index.ts                    # cliente Drizzle (pool)
│   │   ├── seed.ts                     # dataset determinista (IDs y fechas fijas)
│   │   └── schema/
│   │       ├── auth.ts                 # user, session, account, verification
│   │       ├── catalog.ts              # products
│   │       ├── orders.ts               # orders, order_items, order_status_events
│   │       └── metrics.ts              # daily_sales_metrics
│   ├── lib/                            # funciones puras → objetivo de unit tests
│   │   ├── finance.ts · currency.ts · filters.ts · position.ts
│   │   ├── auth-client.ts              # createAuthClient (lado cliente)
│   │   ├── query-keys.ts
│   │   └── utils.ts                    # cn()
│   └── proxy.ts                        # (middleware.ts en Next 14/15)
├── drizzle.config.ts · next.config.ts · vercel.json
├── vitest.config.ts · playwright.config.ts
└── .env.example

Reglas de frontera:

Server Components son el default (pages, layouts, KPIs).
Client Components solo donde hay interactividad (D&D, tablas seleccionables, formularios, charts). El sufijo .client.tsx es convención del equipo para hacer visible la frontera; lo que manda es la directiva "use client".
Server Actions viven en features/*/actions.ts y sirven las mutaciones de la UI.
Route Handlers solo existen para lo que consume un tercero: OAuth y auditoría.
Ambos llaman al mismo server/dal/. Así el evaluador audita exactamente la lógica que usa la UI.

2. Stack secundario
Necesidad	Librería	Justificación
Drag & Drop	@dnd-kit/core + @dnd-kit/sortable	Soporta Kanban multicolumna, tiene KeyboardSensor (accesible y útil para E2E deterministas) y no depende de la API HTML5. Uso la línea estable; el nuevo paquete @dnd-kit/react sigue en versiones 0.x.
Caché / optimismo	TanStack Query v5	onMutate guarda un snapshot y escribe el cache; onError hace rollback y lanza un toast de error; onSettled invalida. El Kanban y el Bulk Update comparten el cache, cosa que useOptimistic (local al componente) no resuelve. refetchInterval da el “tiempo real” del dashboard. Los datos iniciales se precargan en el RSC con HydrationBoundary, así no hay cascada de carga.
UI base	shadcn/ui (Radix + Tailwind)	Componentes copiados al repo, accesibles e incluye Skeleton.
Toasts	Sonner	Es el toast que integra shadcn/ui. Cubre “Toast de éxito o reversión”.
Tablas	TanStack Table	Selección múltiple de filas para el Bulk Update.
Formularios	React Hook Form + Zod	Los mismos esquemas Zod se reusan en cliente, en Server Actions y en los tests.
Orden en Kanban	fractional-indexing	Mover una tarjeta actualiza solo 1 fila.
Charts	Recharts (charts de shadcn)	Encaja con el theming de Tailwind. 

Contrato de Server Actions: devuelven { ok: true, data } | { ok: false, error } en vez de lanzar excepciones. En producción Next sanitiza los errores lanzados, y el cliente necesita el motivo para decidir entre rollback y toast.

3. Datos y autenticación

BD: PostgreSQL serverless (Neon vía Vercel Marketplace, o el Postgres de Railway). ORM: Drizzle. Es SQL delgado, con bundle chico y cold starts rápidos, y tiene adapter nativo para Better Auth.

Esquema principal (el dinero va en centavos integer, nunca float):

Cómo se cumple el SLA < 300 ms:

Pre-agregación. daily_sales_metrics se actualiza en la misma transacción que crea o modifica pedidos. /api/test/analytics lee filas ya agregadas y nunca hace SUM sobre todos los pedidos.
Paginación acotada. limit se valida con Zod (máximo 100). El total sale del conteo de días, no de un COUNT(*) sobre orders.
Co-localización. La región de las funciones de Vercel debe ser la misma que la de la BD (por ejemplo, ambas en iad1/us-east-1). Se usa la URL pooled de conexión. Esto suele pesar más que cualquier optimización de código.
Caché con tag. El resumen de KPIs se cachea con el tag analytics, y cada Server Action que muta llama a revalidateTag('analytics'). kanban-status va con dynamic = 'force-dynamic', sin caché, porque debe reflejar el movimiento al instante.
Medición. Cada endpoint de test responde con un header Server-Timing y meta.durationMs, para que la latencia se pueda demostrar y no solo afirmar.

Concurrencia en Kanban: moveOrder ejecuta UPDATE … WHERE id = $1 AND version = $2. Si afecta 0 filas, devuelve conflicto y el cliente revierte y muestra un toast. Además inserta un order_status_events que kanban-status expone.

OAuth 2.0: Better Auth con socialProviders: { google, github } montado en /api/auth/[...all]. No elegí Auth.js porque desde septiembre de 2025 lo mantiene el equipo de Better Auth en modo de parches de seguridad, y su propia guía recomienda Better Auth para proyectos nuevos. 
logrocket

Sesión rápida: se activa session.cookieCache (sesión firmada en cookie con maxAge corto) para no consultar la BD en cada request.
Dos capas de protección:
proxy.ts solo revisa que la cookie exista y redirige a /login. Es un chequeo barato que corre en cada navegación.
La validación real ocurre en (dashboard)/layout.tsx y en cada Server Action con requireSession(). No dependas solo del proxy/middleware para autorizar.
Callbacks a registrar: https://<prod>/api/auth/callback/google y /callback/github, más sus equivalentes en localhost. Las URLs de preview de Vercel no funcionarán con OAuth a menos que las registres.

Endpoints de auditoría (/api/test/*): los dos GET son de solo lectura y pueden quedar abiertos. reset-data debe exigir un header x-audit-token (variable de entorno), porque si lo dejas público cualquiera puede borrar tu BD de producción. Incluye el token en el README de entrega. Confírmalo con tu profesor: si espera llamarlo sin token, al menos limita el reset a un dataset demo aislado.

4. Testing

Vitest (tests/unit/): estas son las 10 pruebas mínimas, todas sobre src/lib y los esquemas:

Ticket promedio con datos normales
Ticket promedio con 0 pedidos → 0, sin NaN
Margen bruto
Margen con ingresos en 0
formatCurrency en es-MX/MXN
formatCurrency con cero, negativos y redondeo de centavos
createOrderSchema acepta una entrada válida
createOrderSchema rechaza cantidad ≤ 0
bulkUpdateSchema rechaza más de 100 IDs o un estado inválido
filterOrders por estado y rango de fechas

Extra: position.test.ts para el índice fraccional.

// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: { provider: 'v8', include: ['src/lib/**', 'src/features/**/schemas.ts'] },
  },
});

Playwright (e2e/): un proyecto setup corre auth.setup.ts, que llama a POST /api/test/reset-data y escribe storageState. Los specs dependen de él.

// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,                 // comparten BD: evita carreras entre specs
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json' }, dependencies: ['setup'] },
  ],
  webServer: { command: 'pnpm build && pnpm start', url: 'http://localhost:3000',
               reuseExistingServer: !process.env.CI },
});

Notas de los flujos E2E:

Simulación de sesión: el seed inserta un usuario y una sesión con token conocido, y auth.setup.ts construye la cookie firmada con el BETTER_AUTH_SECRET de CI. En CI nunca se toca Google ni GitHub reales. Verifica el nombre y el formato exacto de la cookie contra tu versión de Better Auth.
Flujo de autenticación: se ejecuta con test.use({ storageState: { cookies: [], origins: [] } }) para comprobar la redirección sin sesión.
Flujo D&D: locator.dragTo() no siempre activa el PointerSensor de dnd-kit. Hay dos opciones:
mouse.down(), luego mouse.move(x, y, { steps: 10 }), luego mouse.up().
Teclado: foco en la tarjeta, Space, flechas, Space.
Después se aserta la columna en el DOM y con request.get('/api/test/kanban-status?orderId=…'). Esa segunda aserción demuestra la persistencia, no solo el cambio visual.

CI/CD (ci.yml):

Jobs: quality (lint + tsc --noEmit) → unit → e2e, este último con un service container de Postgres más drizzle-kit migrate y el seed.
Despliegue: el bloqueo más robusto es desactivar el auto-deploy por Git en vercel.json ("git": { "deploymentEnabled": false }). Luego un job deploy con needs: [e2e] ejecuta vercel build y vercel deploy --prebuilt --prod. Si un test falla, el despliegue simplemente no ocurre.

1. Esquema (schema.prisma)
Autenticación OAuth: tablas User, Session, Account y Verification con la forma que espera el adaptador de Prisma de Better Auth. Account tiene un único (providerId, accountId) que cubre a la vez Google y GitHub. Cuando instales Better Auth, corre su comando generate y compara; si tu versión agrega campos, manda lo que genere el comando.
Kanban:
Order tiene status (un enum, donde cada valor es una columna del tablero), position (un índice fraccional) y version (para detectar ediciones simultáneas).
Los totales en centavos se guardan como copia al crear el pedido, para no hacer JOIN en cada lectura.
OrderStatusEvent registra cada movimiento; lo usará /api/test/kanban-status.
Métricas: DailySalesMetric guarda una fila por día (hora de CDMX), ya calculada.
Migraciones (incluidas):
init la generó el propio motor de Prisma a partir del schema, así que es lo mismo que te daría prisma migrate dev.
Una migración extra agrega lo que Prisma no puede expresar: reglas CHECK (montos ≥ 0, cantidad > 0) y COLLATE "C" en position. Sin esto último Postgres ordena las llaves fraccionales alfabéticamente y las tarjetas aparecen desordenadas.
2. GET /api/test/analytics y estrategia de índices

El endpoint valida page y limit con Zod (limit máximo 100 y valor por defecto 50; si son inválidos responde 400 con el detalle). Luego ejecuta 4 consultas en paralelo y responde con data, summary, pagination y meta.durationMs. También envía un header Server-Timing, para que el evaluador vea la latencia directamente en el navegador.

La decisión clave: pre-agregar en vez de indexar. Ningún índice evita que un SUM sobre todos los pedidos crezca con el volumen. Por eso daily_sales_metrics se actualiza en la misma transacción que crea o cancela un pedido. Así, el endpoint pagina unas 365 filas por año en lugar de recorrer miles de pedidos.

Consulta	Índice	Plan medido con 500k pedidos
Página de métricas (ORDER BY day DESC LIMIT/OFFSET)	PK B-tree de day	Index Scan Backward, 0.2 ms
count y SUM del resumen	No necesita: la tabla es pequeña	Microsegundos
Conteo por estado (GROUP BY status)	Ninguno sirve	Seq scan paralelo, 57 ms
Columna Kanban (WHERE status ORDER BY position)	(status, position) compuesto	Index Scan, 0.08 ms

Otros índices del schema y su motivo:

orders(created_at DESC): para el listado de pedidos y para recalcular métricas.
order_status_events(order_id, created_at DESC): para obtener el último movimiento de un pedido.
session.token único: para buscar la sesión en cada request.
Índices en cada llave foránea (userId, productId, etc.): Postgres no los crea automáticamente, y sin ellos los borrados en cascada y los JOIN recorren la tabla completa.

Sobre el conteo por estado: al principio supuse que un índice lo aceleraría. Lo medí y no es así: contar 500k filas cuesta lo mismo con o sin índice. A ese volumen son 57 ms, todavía muy por debajo del SLA. Si llegaras a millones de pedidos, la solución sería una tabla de contadores mantenida por un trigger. Lo dejé anotado en el código.

En producción, lo que más influye en la latencia es la red, no el código: pon la función de Vercel en la misma región que la base de datos (preferredRegion está comentado en el route handler).

3. POST /api/test/reset-data
Llaves foráneas: usé un solo TRUNCATE que incluye todas las tablas de negocio. Postgres revisa las relaciones contra el conjunto completo, así que el orden no importa. No usé CASCADE a propósito: si mañana alguien agrega una tabla que apunte a orders y no la incluye ahí, el reset falla con error en vez de vaciarla sin avisar.
Transacción completa: el TRUNCATE es reversible en Postgres. O queda el seed completo, o la base queda exactamente como estaba.
Bloqueo: un advisory lock evita que dos resets simultáneos choquen (por ejemplo, CI y el evaluador al mismo tiempo).
Tablas de autenticación intactas: borrarlas cerraría la sesión OAuth real del evaluador.
Seed estático:
12 productos, 105 pedidos y 228 partidas, todo con IDs, fechas y posiciones fijas.
El pedido OM-E2E-0001 es la primera tarjeta de PENDING y es el que arrastrará tu prueba de Drag & Drop.
Las métricas se recalculan con un único INSERT … SELECT.
Seguridad: exige el header x-audit-token (comparado de forma segura contra ataques de tiempo). Si ENABLE_TEST_ENDPOINTS no está en "true", todas las rutas /api/test/* responden 404.
Sesión de prueba: solo se crea si existe E2E_SESSION_TOKEN. No definas esa variable en producción.
Mismo código en CLI: npx prisma db seed usa exactamente la misma función.

-->