import { sql } from "drizzle-orm";
import { boolean, date, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Tablas de Better Auth (usuario, sesión, cuenta y verificación).
// Los nombres de columnas siguen el esquema núcleo de Better Auth.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// Contrato con Adrián: catálogo de dientes y avisos del panel de inicio.
// ---------------------------------------------------------------------------

export const arcadaEnum = pgEnum("arcada", ["superior", "inferior"]);
export const ladoEnum = pgEnum("lado", ["derecho", "izquierdo"]);

/** 32 dientes permanentes en notación FDI (11–48). */
export const diente = pgTable("diente", {
  fdi: integer("fdi").primaryKey(),
  nombre: text("nombre").notNull(),
  cuadrante: integer("cuadrante").notNull(),
  arcada: arcadaEnum("arcada").notNull(),
  lado: ladoEnum("lado").notNull(),
});

export const prioridadEnum = pgEnum("prioridad", ["alta", "media", "baja"]);

export const aviso = pgTable(
  "aviso",
  {
    id: serial("id").primaryKey(),
    tipo: text("tipo").notNull(),
    titulo: text("titulo").notNull(),
    detalle: text("detalle"),
    prioridad: prioridadEnum("prioridad").notNull(),
    fechaVencimiento: date("fecha_vencimiento", { mode: "string" }),
    urlAccion: text("url_accion"),
    origen: text("origen").notNull(),
    atendido: boolean("atendido").default(false).notNull(),
    /** Llave para no duplicar avisos abiertos (p. ej. "inventario:reserva:3"). */
    clave: text("clave"),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
    atendidoEn: timestamp("atendido_en", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("aviso_clave_abierta_idx").on(t.clave).where(sql`${t.atendido} = false`),
    index("aviso_pendiente_idx").on(t.atendido, t.prioridad),
  ],
);
