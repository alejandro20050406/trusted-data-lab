CREATE TYPE "public"."estado_cita" AS ENUM('programada', 'atendida', 'reagendada', 'cancelada', 'no_asistio');--> statement-breakpoint
CREATE TYPE "public"."tipo_archivo" AS ENUM('radiografia', 'consentimiento', 'receta', 'otro', 'foto_bracket');--> statement-breakpoint
CREATE TYPE "public"."tipo_tarea" AS ENUM('esterilizacion', 'residuos');--> statement-breakpoint
CREATE TABLE "acceso_archivo" (
	"id" serial PRIMARY KEY NOT NULL,
	"archivo_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"accion" text DEFAULT 'ver' NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archivo_paciente" (
	"id" serial PRIMARY KEY NOT NULL,
	"paciente_id" integer NOT NULL,
	"tipo" "tipo_archivo" NOT NULL,
	"nombre" text NOT NULL,
	"llave" text NOT NULL,
	"tipo_contenido" text NOT NULL,
	"tamano_bytes" integer NOT NULL,
	"fecha" date NOT NULL,
	"subido_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "archivo_paciente_llave_unique" UNIQUE("llave"),
	CONSTRAINT "archivo_tamano_positivo" CHECK ("archivo_paciente"."tamano_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "bracket_caido" (
	"id" serial PRIMARY KEY NOT NULL,
	"paciente_id" integer NOT NULL,
	"diente_fdi" integer NOT NULL,
	"fecha" date NOT NULL,
	"foto_archivo_id" integer,
	"nota" text,
	"consumo_grupo_id" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cita" (
	"id" serial PRIMARY KEY NOT NULL,
	"paciente_id" integer NOT NULL,
	"fecha_hora" timestamp with time zone NOT NULL,
	"estado" "estado_cita" DEFAULT 'programada' NOT NULL,
	"cita_original_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacion_enviada" (
	"aviso_id" integer PRIMARY KEY NOT NULL,
	"enviado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paciente" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"telefono" text,
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realizacion_tarea" (
	"id" serial PRIMARY KEY NOT NULL,
	"tarea_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"detalle" text,
	"comprobante" text,
	"nota" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suscripcion_push" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_id" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suscripcion_push_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "tarea_periodica" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_tarea" NOT NULL,
	"cada_dias" integer,
	"ultima_realizacion" date,
	"dias_anticipacion" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tarea_periodica_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "tarea_cada_dias_positivo" CHECK ("tarea_periodica"."cada_dias" is null or "tarea_periodica"."cada_dias" > 0),
	CONSTRAINT "tarea_anticipacion_no_negativa" CHECK ("tarea_periodica"."dias_anticipacion" >= 0)
);
--> statement-breakpoint
ALTER TABLE "acceso_archivo" ADD CONSTRAINT "acceso_archivo_archivo_id_archivo_paciente_id_fk" FOREIGN KEY ("archivo_id") REFERENCES "public"."archivo_paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acceso_archivo" ADD CONSTRAINT "acceso_archivo_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivo_paciente" ADD CONSTRAINT "archivo_paciente_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archivo_paciente" ADD CONSTRAINT "archivo_paciente_subido_por_user_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_caido" ADD CONSTRAINT "bracket_caido_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_caido" ADD CONSTRAINT "bracket_caido_diente_fdi_diente_fdi_fk" FOREIGN KEY ("diente_fdi") REFERENCES "public"."diente"("fdi") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bracket_caido" ADD CONSTRAINT "bracket_caido_foto_archivo_id_archivo_paciente_id_fk" FOREIGN KEY ("foto_archivo_id") REFERENCES "public"."archivo_paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_paciente_id_paciente_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."paciente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_cita_original_id_cita_id_fk" FOREIGN KEY ("cita_original_id") REFERENCES "public"."cita"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacion_enviada" ADD CONSTRAINT "notificacion_enviada_aviso_id_aviso_id_fk" FOREIGN KEY ("aviso_id") REFERENCES "public"."aviso"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "realizacion_tarea" ADD CONSTRAINT "realizacion_tarea_tarea_id_tarea_periodica_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tarea_periodica"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suscripcion_push" ADD CONSTRAINT "suscripcion_push_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acceso_archivo_idx" ON "acceso_archivo" USING btree ("archivo_id","fecha");--> statement-breakpoint
CREATE INDEX "archivo_paciente_idx" ON "archivo_paciente" USING btree ("paciente_id","fecha");--> statement-breakpoint
CREATE INDEX "bracket_caido_paciente_idx" ON "bracket_caido" USING btree ("paciente_id","fecha");--> statement-breakpoint
CREATE INDEX "bracket_caido_fecha_idx" ON "bracket_caido" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "cita_paciente_idx" ON "cita" USING btree ("paciente_id","fecha_hora");--> statement-breakpoint
CREATE UNIQUE INDEX "cita_original_unica_idx" ON "cita" USING btree ("cita_original_id");--> statement-breakpoint
CREATE INDEX "paciente_nombre_idx" ON "paciente" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "realizacion_tarea_idx" ON "realizacion_tarea" USING btree ("tarea_id","fecha");