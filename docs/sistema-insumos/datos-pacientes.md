# Datos de pacientes y su protección (D-01)

**Sistema:** inventario y módulo clínico del consultorio (`consultorio/`).
**Responsable:** Adrián. **Revisión:** Angel y la clienta.
**Estado:** borrador para revisión. **No se guardan datos reales de pacientes hasta que la clienta y Angel aprueben este documento** (criterio de aceptación de D-01, requisito previo de D-05).

> Este sistema es distinto del observatorio de precios. `docs/etica-datos.md` indica que el observatorio no recopila datos de pacientes, y eso sigue igual: los datos de este documento viven solo en la base y el bucket del consultorio, nunca en `datos/` ni en el pipeline de `src/`.

## 1. Qué datos se guardan (mínimos necesarios)

| Dato | Para qué | ¿Obligatorio? |
|---|---|---|
| Nombre del paciente | Identificar la ficha | Sí |
| Teléfono | Contactar para reagendar | No |
| Notas cortas | Recordatorios de organización (no diagnóstico) | No |
| Citas: fecha, hora y estado | Última visita y veces que reagenda | Sí, si se usa la agenda |
| Archivos escaneados (radiografía, consentimiento, receta, otro) | Llevar el registro que pidió la clienta | No |
| Brackets caídos: diente, fecha, foto opcional y nota | Evidencia de qué brackets se caen | No |
| Registro de accesos a archivos: usuario y fecha | Saber quién abrió cada archivo | Automático |

**No se guardan:** CURP, domicilio, correo del paciente, datos de pago, diagnóstico ni historia clínica estructurada. Si la clienta los necesita, se revisa este documento antes de agregarlos.

Los archivos escaneados pueden contener datos de salud (datos personales **sensibles** según la LFPDPPP). Se tratan con las medidas de la sección 4.

## 2. Quién accede

- Solo la dentista, con su cuenta de correo y contraseña (Better Auth). El registro público está desactivado (`disableSignUp`).
- Cada página y cada Server Action del módulo clínico llama a `requireSession()`.
- Los desarrolladores (Angel y Adrián) trabajan con **pacientes ficticios** en sus ramas de Neon (`dev-angel`, `dev-adrian`) y en la base en memoria de las pruebas. No tienen acceso a la rama de producción salvo para soporte autorizado por la clienta.

## 3. Aviso de privacidad y consentimiento

Pendiente de redactar con la clienta (ella es la **responsable** del tratamiento; el sistema y sus proveedores son **encargados**). Debe incluir, como mínimo:

1. Identidad y domicilio del consultorio.
2. Finalidades: registro de citas, expediente de archivos escaneados y seguimiento de tratamiento de ortodoncia.
3. Datos sensibles que se tratan (radiografías, recetas, fotografías intraorales) y **consentimiento expreso y por escrito** para tratarlos (art. 9 LFPDPPP).
4. **Transferencia a proveedores fuera de México** (ver sección 5) como encargados que solo almacenan la información.
5. Medios para ejercer derechos ARCO y revocar el consentimiento.

Sugerencia: escanear el consentimiento firmado con el tipo "Consentimiento" en la ficha de cada paciente.

## 4. Medidas de seguridad implementadas

| Medida | Dónde |
|---|---|
| Bucket de Cloudflare R2 **privado**; nunca se publica una URL permanente | `lib/archivos/almacen.ts` |
| Subida con URL firmada que se genera solo después de `requireSession()` | `app/(app)/pacientes/[id]/acciones-archivos.ts` |
| Descarga por `/api/archivos/[id]`: verifica la sesión (401 sin sesión) y redirige a una URL firmada válida por **60 segundos** | `app/api/archivos/[id]/route.ts` |
| Llaves aleatorias (UUID), sin el nombre del paciente | `lib/archivos/validacion.ts` |
| Límite de tamaño (10 MB) y tipos permitidos (JPEG, PNG, WebP, PDF) | `lib/archivos/validacion.ts` |
| Validación del **tipo real** con los primeros bytes; se rechaza y borra un archivo con extensión falsa | `lib/archivos/validacion.ts` |
| Registro de quién y cuándo abrió cada archivo | tabla `acceso_archivo` |
| Conexión cifrada (HTTPS en Vercel, TLS a Neon y R2) | Infraestructura |

## 5. Dónde se guardan los datos (transferencia a proveedores)

| Proveedor | Qué guarda | Región a elegir | Anotar aquí la elegida |
|---|---|---|---|
| Neon (PostgreSQL) | Pacientes, citas, metadatos de archivos, accesos | AWS `us-east-2` (Ohio) o la más cercana disponible | _pendiente_ |
| Cloudflare R2 | Escaneos y fotos | Jurisdicción automática o "ENAM" (Norteamérica) | _pendiente_ |
| Vercel | Ejecuta la app; no guarda datos de pacientes en disco | Región de funciones `iad1` o la más cercana a Neon | _pendiente_ |

Ninguno de los tres tiene región en México. Esto se menciona en el aviso de privacidad como transferencia a proveedores que actúan como encargados.

## 6. Conservación y respaldo

- **NOM-004-SSA3-2012:** el expediente clínico se conserva al menos **5 años** contados desde el último acto médico. Los archivos escaneados y las citas no se borran antes de ese plazo; un paciente que ya no viene se marca como inactivo (`activo = false`), no se elimina.
- **Respaldo de la base:** Neon guarda historial de cambios (point-in-time restore) según el plan contratado. Además, exportar un respaldo mensual (`pg_dump`) a un medio que controle la clienta. _Responsable y frecuencia: pendiente con la clienta._
- **Respaldo de archivos:** activar la réplica o copia periódica del bucket de R2 a un segundo bucket privado (o descarga mensual cifrada). _Pendiente con la clienta._
- **Al terminar el plazo:** borrar los objetos de R2 y las filas de `archivo_paciente` del paciente, y anotar la fecha de eliminación.

## 7. Revisión antes de usar datos reales

- [ ] Angel revisó este documento.
- [ ] La clienta revisó la sección 1 (datos que se guardan) y la sección 3 (aviso y consentimiento) frente a la LFPDPPP.
- [ ] La clienta confirmó la conservación de la NOM-004-SSA3-2012 y quién hace los respaldos.
- [ ] Se anotaron las regiones elegidas de Neon, R2 y Vercel.
- [ ] El bucket de R2 de producción está creado como privado y sus llaves solo están en Vercel.
