/**
 * Módulo clínico (dueño: Adrián). Pacientes, citas, archivos escaneados,
 * brackets caídos, tareas periódicas y suscripciones de notificaciones.
 *
 * Los archivos (escaneos y fotos) no viven en Neon: aquí solo se guardan sus
 * metadatos y la llave del objeto en el bucket privado de R2.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { aviso, diente, user } from "./nucleo";

// ---------------------------------------------------------------------------
// D-03: pacientes y citas.
// ---------------------------------------------------------------------------

export const paciente = pgTable(
  "paciente",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull(),
    telefono: text("telefono"),
    /** Notas cortas de organización. No es el expediente clínico. */
    notas: text("notas"),
    activo: boolean("activo").default(true).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("paciente_nombre_idx").on(t.nombre)],
);

export const estadoCitaEnum = pgEnum("estado_cita", ["programada", "atendida", "reagendada", "cancelada", "no_asistio"]);

/**
 * Al reagendar, la cita original queda en estado `reagendada` y se crea una
 * nueva cita `programada` con `citaOriginalId` apuntando a la original.
 */
export const cita = pgTable(
  "cita",
  {
    id: serial("id").primaryKey(),
    pacienteId: integer("paciente_id")
      .notNull()
      .references(() => paciente.id),
    fechaHora: timestamp("fecha_hora", { withTimezone: true }).notNull(),
    estado: estadoCitaEnum("estado").default("programada").notNull(),
    citaOriginalId: integer("cita_original_id").references((): AnyPgColumn => cita.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("cita_paciente_idx").on(t.pacienteId, t.fechaHora),
    // Una cita solo se reagenda una vez: la que la reemplaza puede reagendarse a su vez.
    uniqueIndex("cita_original_unica_idx").on(t.citaOriginalId),
  ],
);

// ---------------------------------------------------------------------------
// D-05 y D-06: archivos de pacientes en R2 y registro de accesos.
// ---------------------------------------------------------------------------

export const tipoArchivoEnum = pgEnum("tipo_archivo", ["radiografia", "consentimiento", "receta", "otro", "foto_bracket"]);

export const archivoPaciente = pgTable(
  "archivo_paciente",
  {
    id: serial("id").primaryKey(),
    pacienteId: integer("paciente_id")
      .notNull()
      .references(() => paciente.id),
    tipo: tipoArchivoEnum("tipo").notNull(),
    /** Nombre automático, p. ej. "Receta 2026-11-27 (2)". */
    nombre: text("nombre").notNull(),
    /** Llave aleatoria del objeto en el bucket privado. */
    llave: text("llave").notNull().unique(),
    /** Tipo MIME verificado con los primeros bytes del archivo. */
    tipoContenido: text("tipo_contenido").notNull(),
    tamanoBytes: integer("tamano_bytes").notNull(),
    fecha: date("fecha", { mode: "string" }).notNull(),
    subidoPor: text("subido_por").references(() => user.id),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("archivo_paciente_idx").on(t.pacienteId, t.fecha),
    check("archivo_tamano_positivo", sql`${t.tamanoBytes} > 0`),
  ],
);

/** Quién y cuándo abrió cada archivo. */
export const accesoArchivo = pgTable(
  "acceso_archivo",
  {
    id: serial("id").primaryKey(),
    archivoId: integer("archivo_id")
      .notNull()
      .references(() => archivoPaciente.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    accion: text("accion").default("ver").notNull(),
    fecha: timestamp("fecha", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("acceso_archivo_idx").on(t.archivoId, t.fecha)],
);

// ---------------------------------------------------------------------------
// D-07: brackets caídos.
// ---------------------------------------------------------------------------

export const bracketCaido = pgTable(
  "bracket_caido",
  {
    id: serial("id").primaryKey(),
    pacienteId: integer("paciente_id")
      .notNull()
      .references(() => paciente.id),
    dienteFdi: integer("diente_fdi")
      .notNull()
      .references(() => diente.fdi),
    fecha: date("fecha", { mode: "string" }).notNull(),
    /** Foto de evidencia opcional; el archivo vive en R2 como `foto_bracket`. */
    fotoArchivoId: integer("foto_archivo_id").references(() => archivoPaciente.id),
    nota: text("nota"),
    /** Consumo del bracket de reposición en el inventario, si se descontó. */
    consumoGrupoId: text("consumo_grupo_id"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("bracket_caido_paciente_idx").on(t.pacienteId, t.fecha), index("bracket_caido_fecha_idx").on(t.fecha)],
);

// ---------------------------------------------------------------------------
// D-09, D-10 y D-11: tareas periódicas (esterilización y residuos).
// ---------------------------------------------------------------------------

export const tipoTareaEnum = pgEnum("tipo_tarea", ["esterilizacion", "residuos"]);

export const tareaPeriodica = pgTable(
  "tarea_periodica",
  {
    id: serial("id").primaryKey(),
    nombre: text("nombre").notNull().unique(),
    tipo: tipoTareaEnum("tipo").notNull(),
    /** Cada cuántos días se repite. Null = sin definir con la clienta (no avisa). */
    cadaDias: integer("cada_dias"),
    /** Fecha real de la última vez que se hizo. */
    ultimaRealizacion: date("ultima_realizacion", { mode: "string" }),
    /** Cuántos días antes de la fecha se avisa. */
    diasAnticipacion: integer("dias_anticipacion").default(0).notNull(),
    activo: boolean("activo").default(true).notNull(),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("tarea_cada_dias_positivo", sql`${t.cadaDias} is null or ${t.cadaDias} > 0`),
    check("tarea_anticipacion_no_negativa", sql`${t.diasAnticipacion} >= 0`),
  ],
);

/** Cada vez que se realizó una tarea: ciclo de esterilización o recolección de residuos. */
export const realizacionTarea = pgTable(
  "realizacion_tarea",
  {
    id: serial("id").primaryKey(),
    tareaId: integer("tarea_id")
      .notNull()
      .references(() => tareaPeriodica.id),
    fecha: date("fecha", { mode: "string" }).notNull(),
    /** Esterilización: piezas, paquetes o ciclo de autoclave (pendiente con la clienta). */
    detalle: text("detalle"),
    /** Residuos: número de manifiesto o comprobante del recolector. */
    comprobante: text("comprobante"),
    nota: text("nota"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("realizacion_tarea_idx").on(t.tareaId, t.fecha)],
);

// ---------------------------------------------------------------------------
// D-12: notificaciones push.
// ---------------------------------------------------------------------------

export const suscripcionPush = pgTable("suscripcion_push", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
});

/** Avisos que ya se notificaron por push, para no repetir la notificación. */
export const notificacionEnviada = pgTable("notificacion_enviada", {
  avisoId: integer("aviso_id")
    .primaryKey()
    .references(() => aviso.id, { onDelete: "cascade" }),
  enviadoEn: timestamp("enviado_en", { withTimezone: true }).defaultNow().notNull(),
});
