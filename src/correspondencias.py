"""Candidatos ISSSTE explícitos; no asigna precios ni aprueba equivalencias."""
import csv
import datetime as dt
import hashlib
import io
import json
from pathlib import Path


def cargar_catalogo(manifiesto):
    manifiesto = Path(manifiesto)
    meta = json.loads(manifiesto.read_text(encoding='utf-8-sig'))
    nombre = meta.get('archivo', '')
    if meta.get('estado') != 'ok' or not nombre or Path(nombre).name != nombre:
        raise ValueError('Manifiesto ISSSTE inválido')
    datos = (manifiesto.parent / nombre).read_bytes()
    huella = hashlib.sha256(datos).hexdigest()
    if huella != meta.get('sha256'):
        raise ValueError('SHA-256 del catálogo ISSSTE no coincide')
    lector = csv.DictReader(io.StringIO(datos.decode('cp1252'), newline=''))
    if not {'CLAVE', 'DESCRIPCION', 'UNIDAD DE PRESENTACION'} <= set(lector.fieldnames or []):
        raise ValueError('Esquema del catálogo ISSSTE incompleto')
    catalogo = {}
    for fila in lector:
        clave = fila['CLAVE'].strip()
        if clave in catalogo:
            catalogo[clave]['_duplicada'] = True
        else:
            catalogo[clave] = fila
    return catalogo, huella


def cargar_referencias(ruta):
    with Path(ruta).open(encoding='utf-8-sig', newline='') as archivo:
        refs = list(csv.DictReader(archivo))
    claves = set()
    requeridos = {'fuente', 'url', 'producto_esperado', 'clave_issste', 'estado_revision',
                  'tipo_relacion', 'coincidencias', 'diferencias', 'evidencia', 'revisor', 'fecha_revision',
                  'sha256_producto_revisado', 'sha256_catalogo_revisado'}
    for ref in refs:
        opcionales = {'revisor', 'fecha_revision', 'sha256_producto_revisado', 'sha256_catalogo_revisado'}
        if set(ref) != requeridos or any(not ref[k].strip() for k in requeridos - opcionales):
            raise ValueError('Referencia incompleta o esquema inesperado')
        identidad = (ref['fuente'], ref['url'], ref['producto_esperado'], ref['clave_issste'])
        if identidad in claves:
            raise ValueError('Referencia duplicada')
        claves.add(identidad)
        if ref['estado_revision'] not in {'pendiente', 'revisada'} or ref['tipo_relacion'] not in {'candidato_parcial', 'compatible_parcial', 'exacta', 'descartada'}:
            raise ValueError('Estado o tipo de relación no reconocido')
        if ref['estado_revision'] == 'pendiente':
            if ref['tipo_relacion'] != 'candidato_parcial' or any(ref[k] for k in opcionales):
                raise ValueError('Una referencia pendiente solo puede ser candidata y no tiene revisor')
        else:
            if ref['tipo_relacion'] == 'candidato_parcial' or not ref['revisor']:
                raise ValueError('Una revisión requiere decisión y revisor')
            try:
                dt.date.fromisoformat(ref['fecha_revision'])
            except ValueError as error:
                raise ValueError('Fecha de revisión inválida') from error
            for campo in ('sha256_producto_revisado', 'sha256_catalogo_revisado'):
                valor = ref[campo]
                if len(valor) != 64 or any(c not in '0123456789abcdef' for c in valor):
                    raise ValueError('Una revisión requiere hashes SHA-256 válidos')
    return refs


def generar_correspondencias(filas, validos, catalogo, referencias, hash_catalogo):
    for ref in referencias:
        item = catalogo.get(ref['clave_issste'])
        if item is None or item.get('_duplicada'):
            raise ValueError('Clave ISSSTE inexistente o duplicada: ' + ref['clave_issste'])
    ids_validos = {id(fila) for fila in validos}
    resultados = []
    for fila in filas:
        matches = [r for r in referencias if (r['fuente'], r['url'], r['producto_esperado']) ==
                   (fila['fuente'], fila['url'], fila['producto'])]
        for ref in matches or [None]:
            item = catalogo[ref['clave_issste']] if ref else {}
            resultado = {k: fila[k] for k in ('fuente', 'url', 'producto', 'fecha_utc', 'archivo', 'sha256') if k in fila}
            resultado.update(apta_plata='si' if id(fila) in ids_validos else 'no',
                             clave_issste=ref['clave_issste'] if ref else '',
                             descripcion_issste=item.get('DESCRIPCION', ''),
                             unidad_issste=item.get('UNIDAD DE PRESENTACION', ''),
                             sha256_catalogo_issste=hash_catalogo)
            for campo in ('estado_revision', 'tipo_relacion', 'coincidencias', 'diferencias', 'evidencia', 'revisor', 'fecha_revision'):
                resultado[campo] = ref[campo] if ref else ('sin_candidato' if campo == 'tipo_relacion' else '')
            if ref and ref['estado_revision'] == 'revisada' and (ref['sha256_producto_revisado'] != fila['sha256'] or ref['sha256_catalogo_revisado'] != hash_catalogo):
                resultado['estado_revision'] = 'pendiente_revalidacion'
                resultado['tipo_relacion'] = 'candidato_parcial'
            resultados.append(resultado)
    return resultados
