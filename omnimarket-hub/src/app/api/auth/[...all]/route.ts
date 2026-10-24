import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

// Endpoints de Better Auth: /api/auth/sign-in/social, /api/auth/callback/{google,github},
// /api/auth/get-session, /api/auth/sign-out, etc.
export const { GET, POST } = toNextJsHandler(auth);
