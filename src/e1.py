"""Bronce dental -> puerta Pandera -> Plata con variables de preprocesamiento."""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import urlsplit

import pandas as pd
import pandera.pandas as pa
from bs4 import BeautifulSoup
from src.correspondencias import cargar_catalogo, cargar_referencias, generar_correspondencias
from src.catalogo_imdent import extraer_listado
from src.dentalink import extraer_precio_principal
from src.validacion_e1 import url_https_valida
from src.preprocesamiento_e1 import enriquecer, estimar_faltantes, validar_imputacion, diagnosticar_faltantes
from src.integracion_oro import ISSSTE_SCHEMA, procesar_issste, construir_oro


SCHEMA = pa.DataFrameSchema({
    'fuente': pa.Column(str, pa.Check.str_length(min_value=1)),
    'url': pa.Column(str, pa.Check(lambda s: s.map(url_https_valida))),
    'fecha_utc': pa.Column(str, pa.Check(lambda s: s.map(fecha_valida))),
    'archivo': pa.Column(str, pa.Check.str_length(min_value=1)),
    'sha256': pa.Column(str, pa.Check.str_matches(r'^[0-9a-f]{64}$')),
    'producto': pa.Column(str, pa.Check.str_length(min_value=1)),
    'moneda': pa.Column(str, pa.Check.isin(['MXN'])),
    'precio': pa.Column(float, [pa.Check.gt(0), pa.Check.le(1000000), pa.Check(lambda s: s.map(math.isfinite))]),
}, strict=True, coerce=False)


def fecha_valida(valor):
    try:
        return dt.datetime.fromisoformat(valor.replace('Z', '+00:00')).utcoffset() is not None
    except (ValueError, TypeError, AttributeError):
        return False


def objetos(valor):
    if isinstance(valor, list):
        for item in valor:
            yield from objetos(item)
    elif isinstance(valor, dict):
        yield valor
        if '@graph' in valor:
            yield from objetos(valor['@graph'])


def extraer_producto(html):
    productos = []
    for script in BeautifulSoup(html, 'html.parser').find_all('script', type='application/ld+json'):
        try:
            for obj in objetos(json.loads(script.string or script.get_text())):
                tipo = obj.get('@type', [])
                if tipo == 'Product' or isinstance(tipo, list) and 'Product' in tipo:
                    productos.append(obj)
        except (ValueError, TypeError):
            continue
    if len(productos) != 1:
        raise ValueError(f'Se esperaba un Product JSON-LD; encontrados: {len(productos)}')
    producto = productos[0]
    oferta = producto.get('offers') or {}
    if not isinstance(oferta, dict):
        raise ValueError('Oferta múltiple o formato no admitido')
    precio = None
    if oferta.get('@type') == 'Offer':
        try:
            precio = float(oferta.get('price'))
        except (TypeError, ValueError):
            pass
    return {'producto': str(producto.get('name') or '').strip(),
            'moneda': str(oferta.get('priceCurrency') or '').strip().upper(), 'precio': precio}


def validar_filas(filas):
    validos, invalidos = [], []
    for fila in filas:
        try:
            SCHEMA.validate(pd.DataFrame([fila]), lazy=True)
            validos.append(fila)
        except (pa.errors.SchemaErrors, pa.errors.SchemaError) as error:
            invalidos.append({'registro': fila, 'motivo': str(error)})
    return validos, invalidos


def transformar(filas):
    df = pd.DataFrame(filas)
    if df.empty:
        return pd.DataFrame(columns=[*SCHEMA.columns, 'registro_origen', 'tienda_imdent', 'precio_minmax', 'precio_zscore',
                                     'atipico_iqr', 'banda_precio_mxn', 'jerarquia'])
    if 'registro_origen' not in df:
        df['registro_origen'] = ''
    def tienda(url):
        partes = urlsplit(url)
        segmentos = partes.path.strip('/').split('/')
        return segmentos[1] if partes.netloc == 'imdent.com' and len(segmentos) > 1 and segmentos[0] == 'stores' else ''
    df['tienda_imdent'] = df['url'].map(tienda) if 'url' in df else ''
    precios = df['precio']
    # Solo se comparan capturas de la misma URL, no productos distintos.
    grupos = df.groupby('url', dropna=False) if 'url' in df else [(None, df)]
    df['precio_minmax'] = float('nan')
    df['precio_zscore'] = float('nan')
    df['atipico_iqr'] = pd.NA
    for _, grupo in grupos:
        valores = grupo['precio']
        minimo, maximo = valores.min(), valores.max()
        sigma = valores.std(ddof=0)
        if maximo != minimo:
            df.loc[grupo.index, 'precio_minmax'] = (valores - minimo) / (maximo - minimo)
        if sigma:
            df.loc[grupo.index, 'precio_zscore'] = (valores - valores.mean()) / sigma
        if len(grupo) >= 8:
            q1, q3 = valores.quantile([0.25, 0.75]); iqr = q3 - q1
            if iqr > 0:
                df.loc[grupo.index, 'atipico_iqr'] = (valores < q1 - 1.5 * iqr) | (valores > q3 + 1.5 * iqr)
    df['banda_precio_mxn'] = pd.cut(precios, [0, 500, 1000, float('inf')], labels=['hasta_500', '501_a_1000', 'mas_de_1000'], include_lowest=False)
    df['jerarquia'] = 'salud > insumos > categoría sin verificar'
    return df


def ejecutar(bronce, salida, catalogo_manifest=None, referencias=None, imdent_bronce=None):
    filas, cuarentena, registros, capturas_imdent, detalles = [], [], {}, [], {}
    manifiestos = sorted(bronce.glob('*/manifiesto.json'))
    if not manifiestos:
        raise ValueError('No se encontraron manifiestos Bronce')
    for manifiesto in manifiestos:
        entradas = json.loads(manifiesto.read_text(encoding='utf-8-sig'))
        if not isinstance(entradas, list):
            raise ValueError(f'Manifiesto dental inválido: {manifiesto}')
        for entrada in entradas:
            try:
                if entrada.get('estado') != 'ok':
                    raise ValueError('Captura fallida: ' + str(entrada.get('detalle', 'sin detalle')))
                nombre = entrada['archivo']
                if Path(nombre).name != nombre:
                    raise ValueError('Nombre de archivo inválido')
                datos = (manifiesto.parent / nombre).read_bytes()
                if hashlib.sha256(datos).hexdigest() != entrada['sha256']:
                    raise ValueError('SHA-256 no coincide con el manifiesto')
                fila = {'fuente': entrada['fuente'], 'url': entrada['url'], 'fecha_utc': entrada['consultado_utc'],
                        'archivo': str((manifiesto.parent / nombre).as_posix()), 'sha256': entrada['sha256']}
                html = datos.decode('utf-8', errors='strict')
                extraido = extraer_producto(html)
                if entrada['fuente'] == 'dentalink_market' and extraido['precio'] is None:
                    detalle = extraer_precio_principal(html, extraido['producto'], extraido['moneda'])
                    extraido['precio'] = detalle['precio']
                    detalles[id(fila)] = detalle
                fila.update(extraido)
                filas.append(fila)
            except (KeyError, ValueError, OSError, UnicodeError) as error:
                cuarentena.append({'registro': entrada, 'manifiesto': str(manifiesto), 'motivo': str(error)})
    if imdent_bronce and imdent_bronce.exists():
        for manifiesto in sorted(imdent_bronce.glob('*/manifiesto.json')):
            meta = json.loads(manifiesto.read_text(encoding='utf-8-sig'))
            if meta.get('version') != 1 or not isinstance(meta.get('paginas'), list):
                raise ValueError(f'Manifiesto de catálogo inválido: {manifiesto}')
            capturas_imdent.append({'manifiesto': str(manifiesto), 'estado': meta.get('estado'),
                                    'total_anunciado': meta.get('total_anunciado'),
                                    'tarjetas_detectadas': sum(p.get('productos_detectados', 0) for p in meta['paginas'])})
            vistos = set()
            for entrada in meta['paginas']:
                try:
                    if entrada.get('estado') != 'ok':
                        raise ValueError('Captura de página fallida: ' + str(entrada.get('detalle', 'sin detalle')))
                    nombre = entrada['archivo']
                    if Path(nombre).name != nombre:
                        raise ValueError('Nombre de archivo inválido')
                    ruta = manifiesto.parent / nombre
                    datos = ruta.read_bytes()
                    if hashlib.sha256(datos).hexdigest() != entrada['sha256']:
                        raise ValueError('SHA-256 no coincide con el manifiesto')
                    page = urlsplit(entrada.get('url', ''))
                    base = f'{page.scheme}://{page.netloc}{page.path}' if page.scheme else None
                    productos = extraer_listado(datos.decode('utf-8', errors='strict'), base) if base else extraer_listado(datos.decode('utf-8', errors='strict'))
                    if len(productos) != entrada['productos_detectados']:
                        raise ValueError('Número de productos difiere del manifiesto')
                    for producto in productos:
                        registro = producto.pop('registro_origen')
                        fila = {'fuente': entrada['fuente'], 'fecha_utc': entrada['consultado_utc'],
                                'archivo': str(ruta.as_posix()), 'sha256': entrada['sha256'], **producto}
                        if not registro or (fila['url'] and fila['url'] in vistos):
                            cuarentena.append({'registro': fila, 'registro_origen': registro,
                                               'motivo': 'Identificador ausente o URL repetida en la misma captura'})
                        else:
                            vistos.add(fila['url'])
                            filas.append(fila)
                            registros[id(fila)] = registro
                except (KeyError, ValueError, OSError, UnicodeError) as error:
                    cuarentena.append({'registro': entrada, 'manifiesto': str(manifiesto), 'motivo': str(error)})
    validos, rechazados = validar_filas(filas)
    for rechazo in rechazados:
        rechazo['registro_origen'] = registros.get(id(rechazo['registro']), '')
    cuarentena.extend(rechazados)
    correspondencias = []
    issste_validos, issste_rechazados = [], []
    if catalogo_manifest is not None and referencias is not None:
        catalogo, hash_catalogo = cargar_catalogo(catalogo_manifest)
        correspondencias = generar_correspondencias(filas, validos, catalogo, cargar_referencias(referencias), hash_catalogo)
        issste_validos, issste_rechazados = procesar_issste(catalogo_manifest)
    salida.mkdir(parents=True, exist_ok=False)
    (salida / 'cuarentena.json').write_text(json.dumps(cuarentena, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    enriquecidos = [{**fila, 'registro_origen': registros.get(id(fila), ''),
                     'vendedor': detalles.get(id(fila), {}).get('vendedor', ''),
                     'disponibilidad': detalles.get(id(fila), {}).get('disponibilidad', 'no_verificada')}
                    for fila in validos]
    plata = enriquecer(transformar(enriquecidos))
    plata.to_csv(salida / 'plata.csv', index=False, encoding='utf-8-sig')
    pd.DataFrame(issste_validos, columns=list(ISSSTE_SCHEMA.columns)).to_csv(
        salida / 'plata_issste.csv', index=False, encoding='utf-8-sig')
    (salida / 'cuarentena_issste.json').write_text(
        json.dumps(issste_rechazados, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    diagnostico = diagnosticar_faltantes(filas)
    pd.DataFrame(diagnostico, columns=['fuente', 'tienda', 'categoria', 'total',
                                      'precio_faltante', 'porcentaje_faltante']).to_csv(
        salida / 'diagnostico_faltantes.csv', index=False, encoding='utf-8-sig')
    estimaciones = estimar_faltantes(plata, cuarentena)
    columnas_estimacion = ['fuente', 'url', 'producto', 'fecha_utc', 'categoria', 'archivo', 'sha256',
                           'registro_origen', 'precio_original', 'precio_estimado_mxn', 'es_imputado',
                           'metodo', 'n_referencias', 'fecha_observacion_referencia', 'sha256_observacion_referencia',
                           'validacion_n', 'validacion_mape_porcentaje',
                           'diagnostico_confiabilidad', 'motivo_cuarentena', 'advertencia']
    pd.DataFrame(estimaciones, columns=columnas_estimacion).to_csv(
        salida / 'estimaciones_cuarentena.csv', index=False, encoding='utf-8-sig')
    validacion = validar_imputacion(plata)
    columnas_validacion = ['tienda', 'categoria', 'fecha_grupo', 'url_oculta', 'precio_observado',
                           'precio_estimado_validacion', 'error_absoluto', 'error_porcentual',
                           'n_entrenamiento', 'metodo', 'fecha_utc_objetivo', 'fecha_utc_referencia', 'sha256_referencia']
    pd.DataFrame(validacion, columns=columnas_validacion).to_csv(
        salida / 'validacion_imputacion.csv', index=False, encoding='utf-8-sig')
    validacion_mediana = [x for x in validacion if x['metodo'] == 'mediana_tienda_categoria_dia']
    validacion_historial = [x for x in validacion if x['metodo'] == 'ultima_observacion_misma_url_7d']
    oro, metricas, reduccion = construir_oro(plata, issste_validos, correspondencias)
    oro.to_csv(salida / 'oro_inventario.csv', index=False, encoding='utf-8-sig')
    metricas.to_csv(salida / 'oro_metricas.csv', index=False, encoding='utf-8-sig')
    (salida / 'oro_reduccion.json').write_text(
        json.dumps(reduccion, ensure_ascii=False, indent=2), encoding='utf-8')
    if catalogo_manifest is not None and referencias is not None:
        columnas = ['fuente', 'url', 'producto', 'fecha_utc', 'archivo', 'sha256', 'apta_plata',
                    'clave_issste', 'descripcion_issste', 'unidad_issste', 'sha256_catalogo_issste',
                    'estado_revision', 'tipo_relacion', 'coincidencias', 'diferencias', 'evidencia',
                    'revisor', 'fecha_revision']
        pd.DataFrame(correspondencias, columns=columnas).to_csv(salida / 'correspondencias.csv', index=False, encoding='utf-8-sig')
    resumen = {'entradas': len(filas) + len(cuarentena) - len(rechazados), 'validos': len(validos), 'cuarentena': len(cuarentena),
               'urls_unicas_validas': len({fila['url'] for fila in validos}), 'capturas_imdent': capturas_imdent,
               'issste_validos': len(issste_validos), 'issste_cuarentena': len(issste_rechazados),
               'oro_filas': len(oro), 'imputaciones_exploratorias': sum(bool(x['es_imputado']) for x in estimaciones),
               'validacion_imputacion_n': len(validacion_mediana),
               'validacion_imputacion_mae': (sum(x['error_absoluto'] for x in validacion_mediana) / len(validacion_mediana) if validacion_mediana else None),
               'validacion_imputacion_mape': (sum(x['error_porcentual'] for x in validacion_mediana) / len(validacion_mediana) if validacion_mediana else None),
               'validacion_historial_n': len(validacion_historial),
               'validacion_historial_mape': (sum(x['error_porcentual'] for x in validacion_historial) / len(validacion_historial) if validacion_historial else None),
               'atipicos_grupo': int(plata['atipico_iqr_grupo'].fillna(False).sum()),
               'faltantes_candidatos': pd.DataFrame(filas).isna().sum().astype(int).to_dict() if filas else {},
               'nota': 'Estadística exploratoria; productos y condiciones no verificados como equivalentes.'}
    (salida / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding='utf-8')
    return resumen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bronce', type=Path, default=Path('datos/bronce/odontologia'))
    parser.add_argument('--salida', type=Path, default=None)
    parser.add_argument('--imd-bronce', type=Path, default=Path('datos/bronce/imd_catalogo'))
    parser.add_argument('--catalogo', type=Path, default=Path('datos/bronce/issste_insumos/20261113T015745409442Z/manifiesto.json'))
    parser.add_argument('--referencias', type=Path, default=Path('datos/referencias/correspondencias_issste.csv'))
    args = parser.parse_args()
    salida = args.salida or Path('datos/e1') / dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    print(json.dumps(ejecutar(args.bronce, salida, args.catalogo, args.referencias, args.imd_bronce), ensure_ascii=False, indent=2))
    print(f'Salida: {salida}')


if __name__ == '__main__':
    main()
