import { vi } from "vitest";

// "server-only" lanza al importarse fuera del bundler de Next. Los tests
// unitarios apuntan a src/lib y a los esquemas, pero si alguno toca un
// módulo de src/server no debe romper por esta guarda.
vi.mock("server-only", () => ({}));
