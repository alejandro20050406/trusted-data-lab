import { vi } from "vitest";

// `server-only` lanza un error fuera del entorno de React Server Components.
vi.mock("server-only", () => ({}));
