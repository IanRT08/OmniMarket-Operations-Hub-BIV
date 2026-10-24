import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";

// ============================================================================
// Better Auth: OAuth 2.0 exclusivo con Google y GitHub.
// ----------------------------------------------------------------------------
// BETTER_AUTH_SECRET y BETTER_AUTH_URL se leen del entorno automáticamente.
// Callbacks a registrar en cada proveedor (prod y localhost):
//   <BETTER_AUTH_URL>/api/auth/callback/google
//   <BETTER_AUTH_URL>/api/auth/callback/github
// Las URLs de preview de Vercel no funcionan con OAuth salvo que se registren.
// ============================================================================

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },

  // Ambos proveedores verifican el email: la misma persona puede entrar con
  // Google o GitHub y termina en un solo User con dos Account.
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
  },

  session: {
    // Sesión firmada en cookie (5 min): getSession() no consulta la BD en
    // cada request; tras expirar se revalida contra la tabla session.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  // Permite que los Server Actions escriban las cookies de sesión.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
