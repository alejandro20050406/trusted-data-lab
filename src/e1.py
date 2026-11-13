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


SCHEMA = pa.DataFrameSchema({
    'fuente': pa.Column(str, pa.Check.str_length(min_value=1)),
    'url': pa.Column(str, pa.Check.str_matches(r'^https://')),
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
    filas, cuarentena, registros, capturas_imdent = [], [], {}, []
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
                fila.update(extraer_producto(datos.decode('utf-8', errors='strict')))
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
    correspondencias = None
    if catalogo_manifest is not None and referencias is not None:
        catalogo, hash_catalogo = cargar_catalogo(catalogo_manifest)
        correspondencias = generar_correspondencias(filas, validos, catalogo, cargar_referencias(referencias), hash_catalogo)
    salida.mkdir(parents=True, exist_ok=False)
    (salida / 'cuarentena.json').write_text(json.dumps(cuarentena, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    plata = transformar([{**fila, 'registro_origen': registros.get(id(fila), '')} for fila in validos])
    plata.to_csv(salida / 'plata.csv', index=False, encoding='utf-8-sig')
    if correspondencias is not None:
        columnas = ['fuente', 'url', 'producto', 'fecha_utc', 'archivo', 'sha256', 'apta_plata',
                    'clave_issste', 'descripcion_issste', 'unidad_issste', 'sha256_catalogo_issste',
                    'estado_revision', 'tipo_relacion', 'coincidencias', 'diferencias', 'evidencia',
                    'revisor', 'fecha_revision']
        pd.DataFrame(correspondencias, columns=columnas).to_csv(salida / 'correspondencias.csv', index=False, encoding='utf-8-sig')
    resumen = {'entradas': len(filas) + len(cuarentena) - len(rechazados), 'validos': len(validos), 'cuarentena': len(cuarentena),
               'urls_unicas_validas': len({fila['url'] for fila in validos}), 'capturas_imdent': capturas_imdent,
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
