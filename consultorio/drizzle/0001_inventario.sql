CREATE TYPE "public"."arcada" AS ENUM('superior', 'inferior');--> statement-breakpoint
CREATE TYPE "public"."lado" AS ENUM('derecho', 'izquierdo');--> statement-breakpoint
CREATE TYPE "public"."prioridad" AS ENUM('alta', 'media', 'baja');--> statement-breakpoint
CREATE TYPE "public"."sistema_bracket" AS ENUM('metalico', 'estetico');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('entrada', 'consumo', 'ajuste');--> statement-breakpoint
CREATE TYPE "public"."tipo_variante" AS ENUM('color', 'diente');--> statement-breakpoint
CREATE TABLE "aviso" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"detalle" text,
	"prioridad" "prioridad" NOT NULL,
	"fecha_vencimiento" date,
	"url_accion" text,
	"origen" text NOT NULL,
	"atendido" boolean DEFAULT false NOT NULL,
	"clave" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"atendido_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "diente" (
	"fdi" integer PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"cuadrante" integer NOT NULL,
	"arcada" "arcada" NOT NULL,
	"lado" "lado" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categoria_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "insumo" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"categoria_id" integer NOT NULL,
	"unidad" text,
	"minimo_reserva" integer,
	"dias_aviso_caducidad" integer,
	"vida_util_dias" integer,
	"controla_lote" boolean DEFAULT true NOT NULL,
	"usa_caducidad" boolean DEFAULT false NOT NULL,
	"tipo_variante" "tipo_variante",
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insumo_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "lote" (
	"id" serial PRIMARY KEY NOT NULL,
	"insumo_id" integer NOT NULL,
	"variante_id" integer,
	"cantidad" integer NOT NULL,
	"fecha_compra" date NOT NULL,
	"fecha_caducidad" date,
	"proveedor" text,
	"marca" text,
	"presentacion" text,
	"contenido_por_unidad" integer,
	"precio_total" numeric(12, 2),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lote_cantidad_positiva" CHECK ("lote"."cantidad" > 0),
	CONSTRAINT "lote_contenido_positivo" CHECK ("lote"."contenido_por_unidad" is null or "lote"."contenido_por_unidad" > 0),
	CONSTRAINT "lote_precio_no_negativo" CHECK ("lote"."precio_total" is null or "lote"."precio_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "movimiento" (
	"id" serial PRIMARY KEY NOT NULL,
	"insumo_id" integer NOT NULL,
	"lote_id" integer NOT NULL,
	"variante_id" integer,
	"tipo" "tipo_movimiento" NOT NULL,
	"cantidad" integer NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"grupo_id" text NOT NULL,
	"nota" text,
	CONSTRAINT "movimiento_signo" CHECK (("movimiento"."tipo" = 'entrada' and "movimiento"."cantidad" > 0) or ("movimiento"."tipo" = 'consumo' and "movimiento"."cantidad" < 0) or ("movimiento"."tipo" = 'ajuste' and "movimiento"."cantidad" <> 0))
);
--> statement-breakpoint
CREATE TABLE "variante" (
	"id" serial PRIMARY KEY NOT NULL,
	"insumo_id" integer NOT NULL,
	"tipo" "tipo_variante" NOT NULL,
	"nombre" text NOT NULL,
	"color_hex" text,
	"diente_fdi" integer,
	"sistema" "sistema_bracket",
	"slot" text,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_categoria_id_categoria_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote" ADD CONSTRAINT "lote_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lote" ADD CONSTRAINT "lote_variante_id_variante_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_lote_id_lote_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."lote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_variante_id_variante_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variante"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variante" ADD CONSTRAINT "variante_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variante" ADD CONSTRAINT "variante_diente_fdi_diente_fdi_fk" FOREIGN KEY ("diente_fdi") REFERENCES "public"."diente"("fdi") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aviso_clave_abierta_idx" ON "aviso" USING btree ("clave") WHERE "aviso"."atendido" = false;--> statement-breakpoint
CREATE INDEX "aviso_pendiente_idx" ON "aviso" USING btree ("atendido","prioridad");--> statement-breakpoint
CREATE INDEX "lote_insumo_idx" ON "lote" USING btree ("insumo_id");--> statement-breakpoint
CREATE INDEX "movimiento_insumo_idx" ON "movimiento" USING btree ("insumo_id");--> statement-breakpoint
CREATE INDEX "movimiento_lote_idx" ON "movimiento" USING btree ("lote_id");--> statement-breakpoint
CREATE INDEX "movimiento_grupo_idx" ON "movimiento" USING btree ("grupo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variante_insumo_nombre_idx" ON "variante" USING btree ("insumo_id","nombre");