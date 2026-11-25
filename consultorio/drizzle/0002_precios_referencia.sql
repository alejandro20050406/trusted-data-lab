CREATE TABLE "correspondencia_observatorio" (
	"id" serial PRIMARY KEY NOT NULL,
	"insumo_id" integer NOT NULL,
	"url" text NOT NULL,
	"nota" text,
	"revisado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precio_referencia" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto" text NOT NULL,
	"tienda" text NOT NULL,
	"fuente" text NOT NULL,
	"precio" numeric(12, 2) NOT NULL,
	"presentacion" text,
	"categoria" text,
	"disponibilidad" text,
	"url" text NOT NULL,
	"fecha_captura" timestamp with time zone NOT NULL,
	"sha256" text NOT NULL,
	"importado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "precio_referencia_positivo" CHECK ("precio_referencia"."precio" > 0)
);
--> statement-breakpoint
ALTER TABLE "correspondencia_observatorio" ADD CONSTRAINT "correspondencia_observatorio_insumo_id_insumo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "correspondencia_insumo_url_idx" ON "correspondencia_observatorio" USING btree ("insumo_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "precio_referencia_unico_idx" ON "precio_referencia" USING btree ("url","fecha_captura","sha256");--> statement-breakpoint
CREATE INDEX "precio_referencia_url_idx" ON "precio_referencia" USING btree ("url");