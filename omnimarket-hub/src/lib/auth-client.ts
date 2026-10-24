import { createAuthClient } from "better-auth/react";

// Cliente de Better Auth para Client Components. Sin baseURL usa el origen
// actual, que es donde está montado /api/auth/[...all].
export const authClient = createAuthClient();
