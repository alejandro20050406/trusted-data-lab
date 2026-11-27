import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { prepararDb } from "./ayuda-db";
import { AlmacenMemoria, FALSO, JPEG, PDF, PNG, WEBP } from "./ayuda-almacen";
import type { Db } from "@/lib/db";
import { accesoArchivo, archivoPaciente, user } from "@/lib/db/schema";
import { usarAlmacen, verificarFirmaLocal, rutaLocal } from "@/lib/archivos/almacen";
import { abrirArchivo, confirmarSubida, listarArchivos, prepararSubida, SEGUNDOS_DESCARGA } from "@/lib/archivos/archivos";
import {
  ArchivoInvalido,
  crearBoleto,
  detectarTipo,
  generarLlave,
  leerBoleto,
  nombreAutomatico,
  TAMANO_MAXIMO,
  validarDeclaracion,
  validarSubido,
} from "@/lib/archivos/validacion";
import { dimensionesReducidas } from "@/lib/archivos/cliente";
import { crearPaciente } from "@/lib/clinica/pacientes";

// La ruta de descarga lee la sesión; aquí se controla qué devuelve.
const sesionFalsa = vi.hoisted(() => ({ actual: null as null | { user: { id: string } } }));
vi.mock("@/lib/sesion", () => ({
  obtenerSesion: async () => sesionFalsa.actual,
  requireSession: async () => {
    if (!sesionFalsa.actual) throw new Error("NEXT_REDIRECT /login");
    return sesionFalsa.actual;
  },
}));

process.env.BETTER_AUTH_SECRET ??= "secreto-de-pruebas-0123456789abcdef0123456789";

describe("D-06 validación del tipo real", () => {
  it("reconoce JPEG, PNG, WebP y PDF por sus bytes", () => {
    expect(detectarTipo(JPEG)).toBe("image/jpeg");
    expect(detectarTipo(PNG)).toBe("image/png");
    expect(detectarTipo(WEBP)).toBe("image/webp");
    expect(detectarTipo(PDF)).toBe("application/pdf");
    expect(detectarTipo(FALSO)).toBeNull();
  });

  it("rechaza un archivo con extensión falsa o que no coincide con lo declarado", () => {
    expect(() => validarSubido("image/jpeg", FALSO, 1000)).toThrow(ArchivoInvalido);
    expect(() => validarSubido("image/jpeg", PDF, 1000)).toThrow("no coincide");
    expect(validarSubido("application/pdf", PDF, 1000)).toBe("application/pdf");
  });

  it("limita tamaño y tipos declarados", () => {
    expect(() => validarDeclaracion("image/gif", 10)).toThrow("Solo se aceptan");
    expect(() => validarDeclaracion("image/jpeg", 0)).toThrow("vacío");
    expect(() => validarDeclaracion("image/jpeg", TAMANO_MAXIMO + 1)).toThrow("10 MB");
    expect(() => validarSubido("image/jpeg", JPEG, TAMANO_MAXIMO + 1)).toThrow("10 MB");
    expect(() => validarDeclaracion("application/pdf", 5000)).not.toThrow();
  });

  it("las llaves son aleatorias y no llevan datos del paciente", () => {
    const a = generarLlave();
    const b = generarLlave();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^archivos\/[0-9a-f-]{36}$/);
    expect(() => rutaLocal(a)).not.toThrow();
    expect(() => rutaLocal("../../etc/passwd")).toThrow();
  });

  it("pone nombres automáticos sin repetir en el mismo día", () => {
    expect(nombreAutomatico("receta", "2026-11-27", 0)).toBe("Receta 27 nov 2026");
    expect(nombreAutomatico("receta", "2026-11-27", 1)).toBe("Receta 27 nov 2026 (2)");
  });

  it("el boleto de subida no se puede alterar ni usar vencido", () => {
    const datos = { llave: generarLlave(), pacienteId: 1, tipoContenido: "image/jpeg" as const, tamano: 10, exp: Date.now() + 1000 };
    const boleto = crearBoleto(datos);
    expect(leerBoleto(boleto)).toEqual(datos);
    const [cuerpo, firma] = boleto.split(".");
    const alterado = Buffer.from(JSON.stringify({ ...datos, pacienteId: 2 })).toString("base64url");
    expect(() => leerBoleto(`${alterado}.${firma}`)).toThrow("no es válida");
    expect(() => leerBoleto(`${cuerpo}.${firma}`, Date.now() + 5000)).toThrow("tardó");
  });

  it("las URL del almacén local solo valen con firma vigente", async () => {
    const { getAlmacen } = await import("@/lib/archivos/almacen");
    usarAlmacen(undefined);
    const llave = generarLlave();
    const url = new URL(await getAlmacen().urlDescarga(llave, 60), "http://localhost");
    const exp = url.searchParams.get("exp");
    const firma = url.searchParams.get("firma");
    expect(verificarFirmaLocal("GET", llave, exp, firma)).toBe(true);
    expect(verificarFirmaLocal("PUT", llave, exp, firma)).toBe(false);
    expect(verificarFirmaLocal("GET", generarLlave(), exp, firma)).toBe(false);
    expect(verificarFirmaLocal("GET", llave, exp, firma, "", Date.now() + 61_000)).toBe(false);
  });

  it("reduce las fotos grandes sin deformarlas", () => {
    expect(dimensionesReducidas(4000, 3000)).toEqual({ ancho: 2000, alto: 1500 });
    expect(dimensionesReducidas(1200, 1600)).toEqual({ ancho: 1200, alto: 1600 });
  });
});

describe("D-05 y D-06 subida, confirmación y descarga", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let almacen: AlmacenMemoria;
  let pacienteId: number;
  const USUARIO = "usuario-prueba";

  beforeAll(async () => {
    ({ db, cerrar } = await prepararDb());
    await db.insert(user).values({ id: USUARIO, name: "Dentista", email: "d@consultorio.test" });
    pacienteId = await crearPaciente({ nombre: "Paciente Ficticio" });
  });
  afterAll(async () => {
    usarAlmacen(undefined);
    await cerrar();
  });
  beforeEach(() => {
    almacen = new AlmacenMemoria();
    usarAlmacen(almacen);
  });

  async function subir(bytes: Uint8Array, declarado: string, tipo: "receta" | "radiografia" = "receta") {
    const prep = await prepararSubida(pacienteId, declarado, bytes.length);
    almacen.poner(leerBoleto(prep.boleto).llave, bytes);
    return confirmarSubida(prep.boleto, tipo, USUARIO, "2026-11-27");
  }

  it("guarda solo metadatos y la llave; dos hojas el mismo día llevan nombres distintos", async () => {
    const a = await subir(JPEG, "image/jpeg");
    const b = await subir(PDF, "application/pdf");
    expect(a).toMatchObject({ nombre: "Receta 27 nov 2026", tipoContenido: "image/jpeg", tamanoBytes: JPEG.length });
    expect(b.nombre).toBe("Receta 27 nov 2026 (2)");
    const [fila] = await db.select().from(archivoPaciente).where(eq(archivoPaciente.id, a.id));
    expect(fila.llave).toMatch(/^archivos\//);
    expect((await listarArchivos(pacienteId)).map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it("rechaza y borra del bucket un archivo con extensión falsa", async () => {
    const prep = await prepararSubida(pacienteId, "image/jpeg", FALSO.length);
    const { llave } = leerBoleto(prep.boleto);
    almacen.poner(llave, FALSO);
    await expect(confirmarSubida(prep.boleto, "receta", USUARIO)).rejects.toThrow(ArchivoInvalido);
    expect(almacen.borrados).toContain(llave);
    expect(await db.select().from(archivoPaciente).where(eq(archivoPaciente.llave, llave))).toHaveLength(0);
  });

  it("no confirma un boleto si el archivo no se subió, ni lo guarda dos veces", async () => {
    const prep = await prepararSubida(pacienteId, "image/png", PNG.length);
    await expect(confirmarSubida(prep.boleto, "otro", USUARIO)).rejects.toThrow("No se encontró");
    almacen.poner(leerBoleto(prep.boleto).llave, PNG);
    await confirmarSubida(prep.boleto, "otro", USUARIO);
    await expect(confirmarSubida(prep.boleto, "otro", USUARIO)).rejects.toThrow("ya se había guardado");
  });

  it("no firma subidas para pacientes que no existen", async () => {
    await expect(prepararSubida(99999, "image/jpeg", 100)).rejects.toThrow("no existe");
  });

  it("al abrir un archivo registra quién y cuándo, con URL de 60 segundos", async () => {
    const a = await subir(JPEG, "image/jpeg", "radiografia");
    const url = await abrirArchivo(a.id, USUARIO);
    expect(url).toContain("exp=60");
    expect(SEGUNDOS_DESCARGA).toBe(60);
    const accesos = await db.select().from(accesoArchivo).where(eq(accesoArchivo.archivoId, a.id));
    expect(accesos).toHaveLength(1);
    expect(accesos[0]).toMatchObject({ userId: USUARIO, accion: "ver" });
    expect(await abrirArchivo(424242, USUARIO)).toBeNull();
  });

  it("la ruta de descarga responde 401 sin sesión y redirige con sesión", async () => {
    const { GET } = await import("@/app/api/archivos/[id]/route");
    const a = await subir(JPEG, "image/jpeg");
    const ctx = { params: Promise.resolve({ id: String(a.id) }) } as never;

    sesionFalsa.actual = null;
    const sin = await GET(new Request(`http://localhost/api/archivos/${a.id}`), ctx);
    expect(sin.status).toBe(401);
    expect(almacen.descargas).toHaveLength(0);

    sesionFalsa.actual = { user: { id: USUARIO } };
    const con = await GET(new Request(`http://localhost/api/archivos/${a.id}`), ctx);
    expect(con.status).toBe(302);
    expect(con.headers.get("location")).toContain("exp=60");
    expect(con.headers.get("cache-control")).toContain("no-store");
    sesionFalsa.actual = null;
  });

  it("las Server Actions de subida exigen sesión", async () => {
    const { prepararSubidaAccion } = await import("@/app/(app)/pacientes/acciones");
    sesionFalsa.actual = null;
    await expect(prepararSubidaAccion({ pacienteId, tipoContenido: "image/jpeg", tamano: 10 })).rejects.toThrow("/login");
  });
});
