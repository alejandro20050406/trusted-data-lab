import type { Metadata } from "next";
import { colores, paresContraste } from "@/lib/diseno/colores";
import { MINIMO_AA, cumpleAA, razonContraste } from "@/lib/diseno/contraste";
import { Button } from "@/components/ui/button";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { BotonUnToque } from "@/components/ui/boton-un-toque";
import { ProveedorConfirmacion } from "@/components/ui/confirmacion";
import { Estado } from "@/components/ui/estado";
import { CampoFormulario, FormularioCorto } from "@/components/ui/formulario-corto";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { DemoConfirmacion } from "./demo-confirmacion";

export const metadata: Metadata = { title: "Estilo · Consultorio" };

async function accionDemo() {
  "use server";
}

const NOMBRES_COLOR: Record<keyof typeof colores, string> = {
  primario: "Primario",
  primarioTexto: "Texto sobre primario",
  textoOscuro: "Texto oscuro",
  fondo: "Fondo",
  superficieSuave: "Superficie suave",
  textoSecundario: "Texto secundario",
  bordeControl: "Borde de controles",
  bordeSuave: "Borde suave",
  alerta: "Alerta",
  alertaFondo: "Alerta, fondo",
  advertencia: "Advertencia",
  advertenciaFondo: "Advertencia, fondo",
  correcto: "Correcto",
  correctoFondo: "Correcto, fondo",
};

export default function Estilo() {
  const filas = paresContraste.map((par) => {
    const razon = razonContraste(par.frente, par.fondo);
    return { ...par, razon, minimo: MINIMO_AA[par.tipo], cumple: cumpleAA(razon, par.tipo) };
  });

  return (
    <ProveedorConfirmacion>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        <h1 className="text-2xl font-semibold">Guía de estilo</h1>

        <section aria-labelledby="paleta" className="flex flex-col gap-3">
          <h2 id="paleta" className="text-xl font-semibold">Paleta</h2>
          <ul className="grid grid-cols-2 gap-3">
            {(Object.keys(colores) as (keyof typeof colores)[]).map((clave) => (
              <li key={clave} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-10 shrink-0 rounded-lg border border-border"
                  style={{ backgroundColor: colores[clave] }}
                />
                <span>
                  {NOMBRES_COLOR[clave]}
                  <br />
                  <span className="text-muted-foreground">{colores[clave]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="botones" className="flex flex-col gap-3">
          <h2 id="botones" className="text-xl font-semibold">Botones</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Predeterminado</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="secondary">Secundario</Button>
            <Button size="lg">Grande</Button>
            <BotonUnToque aria-label="Quitar uno">−1</BotonUnToque>
            <BotonUnToque aria-label="Agregar uno">+1</BotonUnToque>
          </div>
          <BotonPrimario>Botón primario</BotonPrimario>
          <BotonPrimario pendiente>Botón primario</BotonPrimario>
        </section>

        <section aria-labelledby="estados" className="flex flex-col gap-3">
          <h2 id="estados" className="text-xl font-semibold">Estados</h2>
          <Estado tipo="alerta" texto="Sin existencias: hay que pedir ya" />
          <Estado tipo="advertencia" texto="Quedan pocas piezas" />
          <Estado tipo="correcto" texto="Todo en orden" />
          <Estado tipo="neutro" texto="Sin cambios recientes" />
        </section>

        <section aria-labelledby="tarjetas" className="flex flex-col gap-3">
          <h2 id="tarjetas" className="text-xl font-semibold">Tarjeta y formulario corto</h2>
          <Tarjeta>
            <TarjetaTitulo>Guantes de nitrilo</TarjetaTitulo>
            <TarjetaContenido>
              <p className="text-muted-foreground">12 cajas disponibles</p>
            </TarjetaContenido>
          </Tarjeta>
          <Tarjeta>
            <TarjetaContenido>
              <FormularioCorto
                action={accionDemo}
                titulo="Nuevo insumo"
                envio={<BotonPrimario type="submit">Guardar</BotonPrimario>}
              >
                <CampoFormulario etiqueta="Nombre" nombre="nombre" placeholder="Ej. Anestesia" />
                <CampoFormulario etiqueta="Cantidad" nombre="cantidad" tipo="number" error="Escribe una cantidad mayor a cero." />
              </FormularioCorto>
            </TarjetaContenido>
          </Tarjeta>
        </section>

        <section aria-labelledby="confirmacion" className="flex flex-col gap-3">
          <h2 id="confirmacion" className="text-xl font-semibold">Confirmación con Deshacer</h2>
          <DemoConfirmacion />
        </section>

        <section aria-labelledby="contrastes" className="flex flex-col gap-3">
          <h2 id="contrastes" className="text-xl font-semibold">Contrastes medidos</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-3">Par</th>
                  <th scope="col" className="py-2 pr-3">Razón</th>
                  <th scope="col" className="py-2 pr-3">Mínimo</th>
                  <th scope="col" className="py-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.nombre} className="border-b border-border align-top">
                    <th scope="row" className="py-2 pr-3 font-normal">{f.nombre}</th>
                    <td className="py-2 pr-3">{f.razon.toFixed(2)}</td>
                    <td className="py-2 pr-3">{f.minimo}</td>
                    <td className="py-2">{f.cumple ? "Cumple" : "No cumple"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </ProveedorConfirmacion>
  );
}
