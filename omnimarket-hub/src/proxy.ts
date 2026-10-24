import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Chequeo optimista y barato en cada navegación: solo verifica que exista la
// cookie de sesión, sin validarla ni tocar la BD. La autorización real la hace
// requireSession() en el layout del dashboard y en cada Server Action.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/orders/:path*", "/kanban/:path*", "/products/:path*"],
};
