"""Valida el catálogo ISSSTE y fusiona entidades sin inventar equivalencias."""
import csv
import datetime as dt
import hashlib
import json
from collections import Counter
from pathlib import Path

import pandas as pd
import pandera.pandas as pa

from src.preprocesamiento_e1 import categoria_producto
from src.validacion_e1 import url_https_valida


ISSSTE_SCHEMA = pa.DataFrameSchema({
    'fuente': pa.Column(str, pa.Check.isin(['ISSSTE'])),
    'clave': pa.Column(str, pa.Check.str_matches(r'^\d+$')),
    'descripcion': pa.Column(str, pa.Check.str_length(min_value=1)),
    'unidad': pa.Column(str, pa.Check.str_length(min_value=1)),
    'nivel_atencion': pa.Column(str, pa.Check.str_length(min_value=1)),
    'grupo_terapeutico': pa.Column(str, pa.Check.str_length(min_value=1)),
    'indicaciones': pa.Column(str),
    'url_fuente': pa.Column(str, pa.Check(lambda s: s.map(url_https_valida))),
    'fecha_utc': pa.Column(str, pa.Check.str_length(min_value=1)),
    'archivo': pa.Column(str, pa.Check.str_length(min_value=1)),
    'sha256': pa.Column(str, pa.Check.str_matches(r'^[0-9a-f]{64}$')),
    'linea': pa.Column(int, pa.Check.ge(2)),
}, strict=True, coerce=False)

COLUMNAS_ORO = ['tipo_registro', 'identificador', 'fuente', 'vendedor', 'tienda_imdent', 'producto', 'categoria',
                'unidad', 'nivel_atencion', 'precio_observado_mxn', 'disponibilidad',
                'fecha_utc', 'url', 'sha256', 'clave_issste_verificada', 'estado_vinculo_issste']


def procesar_issste(manifiesto):
    ruta = Path(manifiesto)
    meta = json.loads(ruta.read_text(encoding='utf-8-sig'))
    nombre = meta.get('archivo', '')
    if meta.get('estado') != 'ok' or not nombre or Path(nombre).name != nombre:
        raise ValueError('Manifiesto ISSSTE inválido')
    fecha = dt.datetime.fromisoformat(meta['consultado_utc'].replace('Z', '+00:00'))
    if fecha.utcoffset() is None:
        raise ValueError('Fecha ISSSTE sin zona horaria')
    archivo = ruta.parent / nombre
    datos = archivo.read_bytes()
    sha = hashlib.sha256(datos).hexdigest()
    if sha != meta.get('sha256'):
        raise ValueError('SHA-256 del catálogo ISSSTE no coincide')
    texto = datos.decode('cp1252', errors='strict')
    import io
    lector = csv.DictReader(io.StringIO(texto, newline=''))
    esperadas = ['CLAVE', 'DESCRIPCION', 'UNIDAD DE PRESENTACION', 'NIVEL DE ATENCION',
                 'GRUPO TERAPEUTICO', 'INDICACIONES']
    if lector.fieldnames != esperadas:
        raise ValueError('Esquema de origen ISSSTE inesperado')
    originales = list(lector)
    llaves = Counter((str(x.get('CLAVE') or '').strip(), str(x.get('NIVEL DE ATENCION') or '').strip())
                     for x in originales)
    validos, rechazados = [], []
    for numero, original in enumerate(originales, start=2):
        try:
            if None in original or any(original.get(k) is None for k in esperadas):
                raise ValueError('Número de columnas inesperado')
            fila = {'fuente': 'ISSSTE', 'clave': original['CLAVE'].strip(),
                    'descripcion': original['DESCRIPCION'].strip(),
                    'unidad': original['UNIDAD DE PRESENTACION'].strip(),
                    'nivel_atencion': original['NIVEL DE ATENCION'].strip(),
                    'grupo_terapeutico': original['GRUPO TERAPEUTICO'].strip(),
                    'indicaciones': original['INDICACIONES'].strip(), 'url_fuente': meta['url'],
                    'fecha_utc': meta['consultado_utc'], 'archivo': archivo.as_posix(),
                    'sha256': sha, 'linea': numero}
            if llaves[(fila['clave'], fila['nivel_atencion'])] > 1:
                raise ValueError('Clave y nivel de atención duplicados')
            ISSSTE_SCHEMA.validate(pd.DataFrame([fila]), lazy=True)
            validos.append(fila)
        except (ValueError, KeyError, pa.errors.SchemaErrors, pa.errors.SchemaError) as error:
            rechazados.append({'linea': numero, 'archivo': archivo.as_posix(),
                               'sha256': sha, 'registro': original, 'motivo': str(error)})
    return validos, rechazados


def construir_oro(plata, issste, correspondencias):
    pares = {}
    for x in correspondencias:
        if (x.get('estado_revision') == 'revisada' and x.get('tipo_relacion') == 'exacta'
                and x.get('apta_plata') == 'si'):
            pares.setdefault((x.get('url'), x.get('sha256')), set()).add(x.get('clave_issste', ''))
    filas = []
    if plata.empty:
        ultimas = plata
    else:
        ultimas = plata.copy()
        ultimas['_fecha_orden'] = pd.to_datetime(ultimas['fecha_utc'], utc=True, format='mixed')
        ultimas = ultimas.sort_values(['_fecha_orden', 'url', 'sha256'], kind='stable')
        ultimas = ultimas.drop_duplicates(subset=['url'], keep='last')
    for _, x in ultimas.iterrows():
        claves = pares.get((x['url'], x['sha256']), set()) - {''}
        clave = next(iter(claves)) if len(claves) == 1 else ''
        estado = 'exacta_revisada' if len(claves) == 1 else 'conflicto_correspondencias' if len(claves) > 1 else 'sin_correspondencia'
        filas.append({'tipo_registro': 'oferta_comercial', 'identificador': x['url'],
                      'fuente': x['fuente'], 'vendedor': x.get('vendedor', ''),
                      'tienda_imdent': x.get('tienda_imdent', ''), 'producto': x['producto'], 'categoria': x['categoria'],
                      'unidad': '', 'nivel_atencion': '', 'precio_observado_mxn': x['precio'],
                      'disponibilidad': x.get('disponibilidad', ''), 'fecha_utc': x['fecha_utc'],
                      'url': x['url'], 'sha256': x['sha256'],
                      'clave_issste_verificada': clave, 'estado_vinculo_issste': estado})
    for x in issste:
        filas.append({'tipo_registro': 'catalogo_issste',
                      'identificador': x['clave'] + '|' + x['nivel_atencion'],
                      'fuente': x['fuente'], 'vendedor': '', 'tienda_imdent': '', 'producto': x['descripcion'],
                      'categoria': categoria_producto(x['descripcion']), 'unidad': x['unidad'],
                      'nivel_atencion': x['nivel_atencion'], 'precio_observado_mxn': None,
                      'disponibilidad': '', 'fecha_utc': x['fecha_utc'], 'url': x.get('url_fuente', ''),
                      'sha256': x['sha256'], 'clave_issste_verificada': x['clave'], 'estado_vinculo_issste': 'registro_issste'})
    oro = pd.DataFrame(filas, columns=COLUMNAS_ORO)
    if oro.empty:
        metricas = pd.DataFrame(columns=['tipo_registro', 'categoria', 'registros', 'con_precio_observado'])
    else:
        metricas = (oro.groupby(['tipo_registro', 'categoria'], dropna=False)
                    .agg(registros=('identificador', 'size'),
                         con_precio_observado=('precio_observado_mxn', 'count'))
                    .reset_index())
    reduccion = {'observaciones_comerciales_entrada': len(plata), 'ofertas_comerciales_oro': len(ultimas),
                 'filas_issste': len(issste), 'filas_oro': len(oro),
                 'regla': 'Última observación válida por URL; ISSSTE conserva clave y nivel.',
                 'precios_issste': 'no publicados; sin imputar ni transferir'}
    return oro, metricas, reduccion
