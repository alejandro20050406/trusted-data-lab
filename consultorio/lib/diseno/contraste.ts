export type TipoContraste = "texto" | "grande" | "ui";

/** Razón mínima WCAG 2.x nivel AA: 4.5 para texto normal, 3 para texto grande, íconos y controles. */
export const MINIMO_AA: Record<TipoContraste, number> = { texto: 4.5, grande: 3, ui: 3 };

function canales(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Color hex inválido: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminanciaRelativa(hex: string): number {
  const [r, g, b] = canales(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razonContraste(a: string, b: string): number {
  const la = luminanciaRelativa(a);
  const lb = luminanciaRelativa(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function cumpleAA(razon: number, tipo: TipoContraste): boolean {
  return razon >= MINIMO_AA[tipo];
}
