/** Datos fijos del seed: dientes FDI, categorías e insumos iniciales. */

const TIPOS_DIENTE = [
  "Incisivo central",
  "Incisivo lateral",
  "Canino",
  "Primer premolar",
  "Segundo premolar",
  "Primer molar",
  "Segundo molar",
  "Tercer molar",
] as const;

const CUADRANTES = {
  1: { arcada: "superior", lado: "derecho" },
  2: { arcada: "superior", lado: "izquierdo" },
  3: { arcada: "inferior", lado: "izquierdo" },
  4: { arcada: "inferior", lado: "derecho" },
} as const;

export interface DienteCatalogo {
  fdi: number;
  nombre: string;
  cuadrante: 1 | 2 | 3 | 4;
  arcada: "superior" | "inferior";
  lado: "derecho" | "izquierdo";
}

/** Los 32 dientes permanentes, del 11 al 48. */
export const DIENTES: DienteCatalogo[] = ([1, 2, 3, 4] as const).flatMap((cuadrante) =>
  TIPOS_DIENTE.map((tipo, i) => {
    const { arcada, lado } = CUADRANTES[cuadrante];
    return { fdi: cuadrante * 10 + i + 1, nombre: `${tipo} ${arcada} ${lado}`, cuadrante, arcada, lado };
  }),
);

export const CATEGORIAS = [
  "Guantes",
  "Resinas",
  "Pasantes para resina",
  "Anestesia",
  "Jeringas",
  "Fresas para limpieza",
  "Brackets",
  "Ligas",
  "Ligas intermaxilares",
] as const;

export interface InsumoCatalogo {
  nombre: string;
  categoria: (typeof CATEGORIAS)[number];
  /** Null cuando la clienta aún no define la unidad. */
  unidad: string | null;
  /** Null cuando la clienta aún no define la reserva. */
  minimoReserva: number | null;
  diasAvisoCaducidad: number | null;
  usaCaducidad: boolean;
  tipoVariante: "color" | "diente" | null;
}

/**
 * Insumos iniciales, uno por categoría. Solo se cargan valores que pidió la
 * clienta o que el plan fija (reserva de 1 caja de guantes; aviso de 30 días
 * para resina y anestesia). El resto queda "Sin definir" y se ajusta en la app.
 */
export const INSUMOS: InsumoCatalogo[] = [
  { nombre: "Guantes", categoria: "Guantes", unidad: "caja", minimoReserva: 1, diasAvisoCaducidad: null, usaCaducidad: false, tipoVariante: null },
  { nombre: "Resina", categoria: "Resinas", unidad: null, minimoReserva: null, diasAvisoCaducidad: 30, usaCaducidad: true, tipoVariante: null },
  { nombre: "Pasantes para resina", categoria: "Pasantes para resina", unidad: null, minimoReserva: null, diasAvisoCaducidad: null, usaCaducidad: false, tipoVariante: null },
  { nombre: "Anestesia", categoria: "Anestesia", unidad: null, minimoReserva: null, diasAvisoCaducidad: 30, usaCaducidad: true, tipoVariante: null },
  { nombre: "Jeringas", categoria: "Jeringas", unidad: null, minimoReserva: null, diasAvisoCaducidad: null, usaCaducidad: false, tipoVariante: null },
  { nombre: "Fresas para limpieza", categoria: "Fresas para limpieza", unidad: null, minimoReserva: null, diasAvisoCaducidad: null, usaCaducidad: false, tipoVariante: null },
  { nombre: "Brackets", categoria: "Brackets", unidad: null, minimoReserva: null, diasAvisoCaducidad: null, usaCaducidad: false, tipoVariante: "diente" },
  { nombre: "Ligas", categoria: "Ligas", unidad: null, minimoReserva: null, diasAvisoCaducidad: null, usaCaducidad: false, tipoVariante: "color" },
  { nombre: "Ligas intermaxilares", categoria: "Ligas intermaxilares", unidad: null, minimoReserva: null, diasAvisoCaducidad: null, usaCaducidad: false, tipoVariante: null },
];
