import { NavLinks } from "@/components/layout/nav-links.client";
import { UserMenu } from "@/components/layout/user-menu.client";
import { requireSession } from "@/server/session";

// Autorización real de todo el dashboard (proxy.ts solo revisa la cookie).
// requireSession redirige a /login si la sesión no es válida.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <span className="grid size-7 place-items-center rounded-lg bg-brand-moss text-xs font-bold text-white" aria-hidden="true">
                OM
              </span>
              OmniMarket <span className="hidden font-normal text-ink-muted sm:inline">Operations Hub</span>
            </span>
            <NavLinks />
          </div>
          <UserMenu name={user.name} email={user.email} />
        </div>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
