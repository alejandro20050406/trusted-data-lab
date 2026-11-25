import type { TipoContraste } from "./contraste";

/** Única fuente de la paleta. `app/globals.css` repite estos hex y una prueba verifica que coincidan. */
export const colores = {
  primario: "#1D4ED8",
  primarioTexto: "#FFFFFF",
  textoOscuro: "#0F2A5C",
  fondo: "#FFFFFF",
  superficieSuave: "#EFF6FF",
  textoSecundario: "#475569",
  bordeControl: "#64748B",
  bordeSuave: "#CBD5E1",
  alerta: "#B91C1C",
  alertaFondo: "#FEF2F2",
  advertencia: "#92400E",
  advertenciaFondo: "#FFFBEB",
  correcto: "#166534",
  correctoFondo: "#F0FDF4",
} as const;

export interface ParContraste {
  nombre: string;
  frente: string;
  fondo: string;
  tipo: TipoContraste;
}

const c = colores;

export const paresContraste: ParContraste[] = [
  { nombre: "Texto del botón primario sobre primario", frente: c.primarioTexto, fondo: c.primario, tipo: "texto" },
  { nombre: "Texto oscuro sobre fondo", frente: c.textoOscuro, fondo: c.fondo, tipo: "texto" },
  { nombre: "Texto oscuro sobre superficie suave", frente: c.textoOscuro, fondo: c.superficieSuave, tipo: "texto" },
  { nombre: "Texto secundario sobre fondo", frente: c.textoSecundario, fondo: c.fondo, tipo: "texto" },
  { nombre: "Texto secundario sobre superficie suave", frente: c.textoSecundario, fondo: c.superficieSuave, tipo: "texto" },
  { nombre: "Enlace primario sobre fondo", frente: c.primario, fondo: c.fondo, tipo: "texto" },
  { nombre: "Enlace primario sobre superficie suave", frente: c.primario, fondo: c.superficieSuave, tipo: "texto" },
  { nombre: "Borde de controles sobre fondo", frente: c.bordeControl, fondo: c.fondo, tipo: "ui" },
  { nombre: "Anillo de foco sobre fondo", frente: c.primario, fondo: c.fondo, tipo: "ui" },
  { nombre: "Alerta (texto) sobre su fondo suave", frente: c.alerta, fondo: c.alertaFondo, tipo: "texto" },
  { nombre: "Alerta (texto) sobre fondo", frente: c.alerta, fondo: c.fondo, tipo: "texto" },
  { nombre: "Advertencia (texto) sobre su fondo suave", frente: c.advertencia, fondo: c.advertenciaFondo, tipo: "texto" },
  { nombre: "Advertencia (texto) sobre fondo", frente: c.advertencia, fondo: c.fondo, tipo: "texto" },
  { nombre: "Correcto (texto) sobre su fondo suave", frente: c.correcto, fondo: c.correctoFondo, tipo: "texto" },
  { nombre: "Correcto (texto) sobre fondo", frente: c.correcto, fondo: c.fondo, tipo: "texto" },
  { nombre: "Ícono de alerta sobre su fondo suave", frente: c.alerta, fondo: c.alertaFondo, tipo: "ui" },
  { nombre: "Ícono de advertencia sobre su fondo suave", frente: c.advertencia, fondo: c.advertenciaFondo, tipo: "ui" },
  { nombre: "Ícono de correcto sobre su fondo suave", frente: c.correcto, fondo: c.correctoFondo, tipo: "ui" },
];
