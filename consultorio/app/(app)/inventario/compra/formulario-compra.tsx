"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { CampoFormulario, FormularioCorto } from "@/components/ui/formulario-corto";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarCompraAccion, type EstadoCompra } from "../acciones";

export interface InsumoCompra {
  id: number;
  nombre: string;
  usaCaducidad: boolean;
  tipoVariante: "color" | "diente" | null;
  colores: { id: number; nombre: string; colorHex: string }[];
}

export interface UltimaCompra {
  proveedor: string | null;
  presentacion: string | null;
  contenidoPorUnidad: number | null;
}

interface Props {
  insumos: InsumoCompra[];
  dientes: { fdi: number; nombre: string }[];
  ultimas: Record<number, UltimaCompra | null>;
  insumoInicial: number | null;
  /** Diente preseleccionado (FDI) cuando se llega desde la vista de brackets. */
  dienteInicial?: number | null;
  hoy: string;
}

const inicial: EstadoCompra = { ok: false, error: null, campo: null, valores: {} };
const CAMPOS_EXTRA = ["fechaCompra", "proveedor", "presentacion", "contenidoPorUnidad"];
const CLASE_SELECT = "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base";

function MensajeError({ id, texto }: { id: string; texto: string | null }) {
  return texto ? (
    <p id={id} className="text-base text-alerta">
      {texto}
    </p>
  ) : null;
}

export function FormularioCompra({ insumos, dientes, ultimas, insumoInicial, dienteInicial = null, hoy }: Props) {
  const [estado, accion, pendiente] = useActionState(registrarCompraAccion, inicial);
  const [insumoId, setInsumoId] = useState(insumoInicial === null ? "" : String(insumoInicial));
  const [extraAbierto, setExtraAbierto] = useState(false);
  const cantidadRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { mostrar } = useConfirmacion();

  useEffect(() => {
    if (!estado.ok) return;
    mostrar({ mensaje: "Compra registrada" });
    router.push("/inventario");
  }, [estado, mostrar, router]);

  // Al cambiar el insumo, el cursor queda en la cantidad para escribir sin otro toque.
  useEffect(() => {
    if (insumoId !== "" && insumoId !== String(insumoInicial)) cantidadRef.current?.focus();
  }, [insumoId, insumoInicial]);

  const elegido = insumos.find((i) => String(i.id) === insumoId) ?? null;
  const ultima = elegido ? (ultimas[elegido.id] ?? null) : null;
  const mismoInsumo = estado.valores.insumoId === insumoId;
  const valor = (nombre: string, porDefecto: string) => (mismoInsumo && nombre in estado.valores ? estado.valores[nombre] : porDefecto);
  const errorDe = (campo: string) => (estado.campo === campo ? estado.error : null);
  const extraForzado = estado.campo !== null && CAMPOS_EXTRA.includes(estado.campo);

  return (
    <FormularioCorto
      action={accion}
      noValidate
      envio={
        <BotonPrimario type="submit" pendiente={pendiente}>
          Guardar
        </BotonPrimario>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="campo-insumoId">Insumo</Label>
        <select
          id="campo-insumoId"
          name="insumoId"
          value={insumoId}
          onChange={(e) => {
            setInsumoId(e.target.value);
          }}
          aria-invalid={errorDe("insumoId") ? true : undefined}
          aria-describedby={errorDe("insumoId") ? "campo-insumoId-error" : undefined}
          className={CLASE_SELECT}
        >
          <option value="">Elige un insumo</option>
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
        <MensajeError id="campo-insumoId-error" texto={errorDe("insumoId")} />
      </div>

      <div key={insumoId} className="contents">
        <CampoFormulario
          etiqueta="Cantidad"
          nombre="cantidad"
          tipo="number"
          inputMode="numeric"
          min={1}
          step={1}
          ref={cantidadRef}
          autoFocus={insumoInicial !== null}
          defaultValue={valor("cantidad", "")}
          error={errorDe("cantidad")}
        />
        <CampoFormulario
          etiqueta="Precio total (MXN)"
          nombre="precioTotal"
          tipo="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={valor("precioTotal", "")}
          error={errorDe("precioTotal")}
        />

        {elegido?.usaCaducidad ? (
          <CampoFormulario
            etiqueta="Fecha de caducidad"
            nombre="fechaCaducidad"
            tipo="date"
            defaultValue={valor("fechaCaducidad", "")}
            error={errorDe("fechaCaducidad")}
          />
        ) : null}

        {elegido?.tipoVariante === "color" ? (
          <SelectorColor insumo={elegido} valores={mismoInsumo ? estado.valores : {}} errorColor={errorDe("colorId")} errorNombre={errorDe("colorNombre")} />
        ) : null}

        {elegido?.tipoVariante === "diente" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="campo-dienteFdi">Diente</Label>
              <select
                id="campo-dienteFdi"
                name="dienteFdi"
                defaultValue={valor("dienteFdi", dienteInicial === null ? "" : String(dienteInicial))}
                aria-invalid={errorDe("dienteFdi") ? true : undefined}
                aria-describedby={errorDe("dienteFdi") ? "campo-dienteFdi-error" : undefined}
                className={CLASE_SELECT}
              >
                <option value="">Elige el diente</option>
                {dientes.map((d) => (
                  <option key={d.fdi} value={d.fdi}>
                    {d.fdi} · {d.nombre}
                  </option>
                ))}
              </select>
              <MensajeError id="campo-dienteFdi-error" texto={errorDe("dienteFdi")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="campo-sistema">Sistema</Label>
              <select
                id="campo-sistema"
                name="sistema"
                defaultValue={valor("sistema", "metalico")}
                aria-invalid={errorDe("sistema") ? true : undefined}
                aria-describedby={errorDe("sistema") ? "campo-sistema-error" : undefined}
                className={CLASE_SELECT}
              >
                <option value="metalico">Metálico</option>
                <option value="estetico">Estético</option>
              </select>
              <MensajeError id="campo-sistema-error" texto={errorDe("sistema")} />
            </div>
            <CampoFormulario etiqueta="Slot" nombre="slot" defaultValue={valor("slot", "")} error={errorDe("slot")} />
          </div>
        ) : null}

        <details
          open={extraAbierto || extraForzado}
          onToggle={(e) => setExtraAbierto(e.currentTarget.open)}
          className="rounded-lg border border-border px-3"
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-base font-medium">Más datos</summary>
          <div className="flex flex-col gap-4 pt-2 pb-3">
            <CampoFormulario etiqueta="Fecha de compra" nombre="fechaCompra" tipo="date" defaultValue={valor("fechaCompra", hoy)} error={errorDe("fechaCompra")} />
            <CampoFormulario etiqueta="Proveedor" nombre="proveedor" defaultValue={valor("proveedor", ultima?.proveedor ?? "")} />
            <CampoFormulario etiqueta="Presentación" nombre="presentacion" defaultValue={valor("presentacion", ultima?.presentacion ?? "")} placeholder="Ej. caja de 100" />
            <CampoFormulario
              etiqueta="Piezas por unidad"
              nombre="contenidoPorUnidad"
              tipo="number"
              inputMode="numeric"
              min={1}
              step={1}
              defaultValue={valor("contenidoPorUnidad", ultima?.contenidoPorUnidad ? String(ultima.contenidoPorUnidad) : "")}
              error={errorDe("contenidoPorUnidad")}
            />
          </div>
        </details>
      </div>

      {estado.error && estado.campo === null ? (
        <p role="alert" className="text-base text-alerta">
          {estado.error}
        </p>
      ) : null}
    </FormularioCorto>
  );
}

function SelectorColor({
  insumo,
  valores,
  errorColor,
  errorNombre,
}: {
  insumo: InsumoCompra;
  valores: Record<string, string>;
  errorColor: string | null;
  errorNombre: string | null;
}) {
  const [seleccion, setSeleccion] = useState(valores.colorId ?? (insumo.colores.length === 0 ? "nuevo" : ""));
  const opcion = "inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-base has-checked:border-primary has-checked:ring-2 has-checked:ring-primary has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={errorColor ? "campo-colorId-error" : undefined}>
      <legend className="mb-2 text-base font-medium">Color</legend>
      <div className="flex flex-wrap gap-2">
        {insumo.colores.map((c) => (
          <label key={c.id} className={opcion}>
            <input
              type="radio"
              name="colorId"
              value={c.id}
              checked={seleccion === String(c.id)}
              onChange={() => setSeleccion(String(c.id))}
              className="sr-only"
            />
            <span aria-hidden="true" className="size-6 shrink-0 rounded-full border border-foreground/40" style={{ backgroundColor: c.colorHex }} />
            <span>{c.nombre}</span>
          </label>
        ))}
        <label className={opcion}>
          <input type="radio" name="colorId" value="nuevo" checked={seleccion === "nuevo"} onChange={() => setSeleccion("nuevo")} className="sr-only" />
          <span>Nuevo color</span>
        </label>
      </div>
      <MensajeError id="campo-colorId-error" texto={errorColor} />
      {seleccion === "nuevo" ? (
        <div className="flex flex-col gap-3">
          <CampoFormulario etiqueta="Nombre del color" nombre="colorNombre" defaultValue={valores.colorNombre ?? ""} error={errorNombre} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="campo-colorHex">Tono</Label>
            <Input id="campo-colorHex" name="colorHex" type="color" defaultValue={valores.colorHex ?? "#1d4ed8"} className={cn("w-20 p-1")} />
          </div>
        </div>
      ) : null}
    </fieldset>
  );
}
