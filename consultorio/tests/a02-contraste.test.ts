import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colores, paresContraste } from "@/lib/diseno/colores";
import { cumpleAA, luminanciaRelativa, razonContraste } from "@/lib/diseno/contraste";

describe("fórmula de contraste WCAG", () => {
  it("negro sobre blanco es 21", () => {
    expect(razonContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });
  it("mismo color es 1", () => {
    expect(razonContraste("#1D4ED8", "#1D4ED8")).toBeCloseTo(1, 5);
  });
  it("#777777 sobre blanco es cerca de 4.48", () => {
    expect(razonContraste("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
  it("no depende del orden", () => {
    expect(razonContraste("#FFFFFF", "#777777")).toBeCloseTo(razonContraste("#777777", "#FFFFFF"), 10);
  });
  it("luminancia de blanco y negro", () => {
    expect(luminanciaRelativa("#FFFFFF")).toBeCloseTo(1, 5);
    expect(luminanciaRelativa("#000000")).toBeCloseTo(0, 5);
  });
  it("acepta hex corto", () => {
    expect(razonContraste("#000", "#fff")).toBeCloseTo(21, 5);
  });
  it("umbrales AA: 4.5 texto, 3 grande y ui", () => {
    expect(cumpleAA(4.5, "texto")).toBe(true);
    expect(cumpleAA(4.49, "texto")).toBe(false);
    expect(cumpleAA(3, "grande")).toBe(true);
    expect(cumpleAA(2.99, "ui")).toBe(false);
  });
});

describe("paleta", () => {
  it("tiene pares a medir", () => {
    expect(paresContraste.length).toBeGreaterThan(10);
  });
  it.each(paresContraste.map((p) => [p.nombre, p] as const))("cumple AA: %s", (_n, p) => {
    expect(cumpleAA(razonContraste(p.frente, p.fondo), p.tipo)).toBe(true);
  });
});

describe("variables CSS de globals.css", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const raiz = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const variable = (nombre: string) =>
    new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(raiz)?.[1]?.toUpperCase();

  const esperado: Record<string, string> = {
    primary: colores.primario,
    "primary-foreground": colores.primarioTexto,
    foreground: colores.textoOscuro,
    background: colores.fondo,
    muted: colores.superficieSuave,
    "muted-foreground": colores.textoSecundario,
    border: colores.bordeSuave,
    input: colores.bordeControl,
    ring: colores.primario,
    destructive: colores.alerta,
    card: colores.fondo,
    "card-foreground": colores.textoOscuro,
    popover: colores.fondo,
    "popover-foreground": colores.textoOscuro,
    secondary: colores.superficieSuave,
    "secondary-foreground": colores.textoOscuro,
    accent: colores.superficieSuave,
    "accent-foreground": colores.textoOscuro,
    alerta: colores.alerta,
    "alerta-fondo": colores.alertaFondo,
    advertencia: colores.advertencia,
    "advertencia-fondo": colores.advertenciaFondo,
    correcto: colores.correcto,
    "correcto-fondo": colores.correctoFondo,
  };

  it.each(Object.entries(esperado))("--%s coincide con colores.ts", (nombre, hex) => {
    expect(variable(nombre)).toBe(hex.toUpperCase());
  });
});
