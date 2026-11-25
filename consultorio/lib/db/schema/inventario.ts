import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { diente } from "./nucleo";

export const categoria = pgTable("categoria", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  orden: integer("orden").default(0).notNull(),
});

/** Qué distingue a las unidades de un insumo: color (ligas) o diente (brackets). */
export const tipoVarianteEnum = pgEnum("tipo_variante", ["color", "diente"]);

export const insumo = pgTable("insumo", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  categoriaId: integer("categoria_id")
    .notNull()
    .references(() => categoria.id),
  /** Unidad en que se cuenta (p. ej. "caja"). Null = sin definir con la clienta. */
  unidad: text("unidad"),
  /** Existencia mínima de reserva. Null = sin definir. */
  minimoReserva: integer("minimo_reserva"),
  /** Días de anticipación para avisar antes de la caducidad. Null = no avisa. */
  diasAvisoCaducidad: integer("dias_aviso_caducidad"),
  /** Días de validez desde la fecha de compra (ligas). Null = sin definir. */
  vidaUtilDias: integer("vida_util_dias"),
  controlaLote: boolean("controla_lote").default(true).notNull(),
  /** Si el registro de compra pide fecha de caducidad. */
  usaCaducidad: boolean("usa_caducidad").default(false).notNull(),
  tipoVariante: tipoVarianteEnum("tipo_variante"),
  activo: boolean("activo").default(true).notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
});

export const sistemaBracketEnum = pgEnum("sistema_bracket", ["metalico", "estetico"]);

/** Color de ligas o diente/sistema/slot de brackets. */
export const variante = pgTable(
  "variante",
  {
    id: serial("id").primaryKey(),
    insumoId: integer("insumo_id")
      .notNull()
      .references(() => insumo.id),
    tipo: tipoVarianteEnum("tipo").notNull(),
    nombre: text("nombre").notNull(),
    /** Color de muestra para ligas (#RRGGBB). Siempre se muestra junto al nombre. */
    colorHex: text("color_hex"),
    dienteFdi: integer("diente_fdi").references(() => diente.fdi),
    sistema: sistemaBracketEnum("sistema"),
    slot: text("slot"),
    activo: boolean("activo").default(true).notNull(),
  },
  (t) => [uniqueIndex("variante_insumo_nombre_idx").on(t.insumoId, t.nombre)],
);

/** Cada compra crea un lote. */
export const lote = pgTable(
  "lote",
  {
    id: serial("id").primaryKey(),
    insumoId: integer("insumo_id")
      .notNull()
      .references(() => insumo.id),
    varianteId: integer("variante_id").references(() => variante.id),
    /** Cantidad comprada, en la unidad del insumo. */
    cantidad: integer("cantidad").notNull(),
    fechaCompra: date("fecha_compra", { mode: "string" }).notNull(),
    fechaCaducidad: date("fecha_caducidad", { mode: "string" }),
    proveedor: text("proveedor"),
    marca: text("marca"),
    /** Presentación tal como se compró, p. ej. "Caja de 100 piezas". */
    presentacion: text("presentacion"),
    /** Piezas que trae cada unidad (p. ej. 100 guantes por caja), si se conoce. */
    contenidoPorUnidad: integer("contenido_por_unidad"),
    precioTotal: numeric("precio_total", { precision: 12, scale: 2, mode: "number" }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("lote_insumo_idx").on(t.insumoId),
    check("lote_cantidad_positiva", sql`${t.cantidad} > 0`),
    check("lote_contenido_positivo", sql`${t.contenidoPorUnidad} is null or ${t.contenidoPorUnidad} > 0`),
    check("lote_precio_no_negativo", sql`${t.precioTotal} is null or ${t.precioTotal} >= 0`),
  ],
);

export const tipoMovimientoEnum = pgEnum("tipo_movimiento", ["entrada", "consumo", "ajuste"]);

/**
 * Libro de movimientos: la existencia de un insumo o lote es la suma de
 * `cantidad` (positiva en entradas, negativa en consumos, con signo en ajustes).
 */
export const movimiento = pgTable(
  "movimiento",
  {
    id: serial("id").primaryKey(),
    insumoId: integer("insumo_id")
      .notNull()
      .references(() => insumo.id),
    loteId: integer("lote_id")
      .notNull()
      .references(() => lote.id),
    varianteId: integer("variante_id").references(() => variante.id),
    tipo: tipoMovimientoEnum("tipo").notNull(),
    cantidad: integer("cantidad").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).defaultNow().notNull(),
    /** Agrupa los movimientos de una misma operación (un consumo puede tocar varios lotes). */
    grupoId: text("grupo_id").notNull(),
    nota: text("nota"),
  },
  (t) => [
    index("movimiento_insumo_idx").on(t.insumoId),
    index("movimiento_lote_idx").on(t.loteId),
    index("movimiento_grupo_idx").on(t.grupoId),
    check(
      "movimiento_signo",
      sql`(${t.tipo} = 'entrada' and ${t.cantidad} > 0) or (${t.tipo} = 'consumo' and ${t.cantidad} < 0) or (${t.tipo} = 'ajuste' and ${t.cantidad} <> 0)`,
    ),
  ],
);
