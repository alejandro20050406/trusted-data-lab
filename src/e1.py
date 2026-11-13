"""Bronce dental -> puerta Pandera -> Plata con variables de preprocesamiento."""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path

import pandas as pd
import pandera.pandas as pa
from bs4 import BeautifulSoup
from src.correspondencias import cargar_catalogo, cargar_referencias, generar_correspondencias


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
        return pd.DataFrame(columns=[*SCHEMA.columns, 'precio_minmax', 'precio_zscore',
                                     'atipico_iqr', 'banda_precio_mxn', 'jerarquia'])
    precios = df['precio']
    minimo, maximo = precios.min(), precios.max()
    media, sigma = precios.mean(), precios.std(ddof=0)
    df['precio_minmax'] = (precios - minimo) / (maximo - minimo) if maximo != minimo else float('nan')
    df['precio_zscore'] = (precios - media) / sigma if sigma else float('nan')
    df['atipico_iqr'] = pd.NA
    if len(df) >= 8:
        q1, q3 = precios.quantile([0.25, 0.75]); iqr = q3 - q1
        if iqr > 0:
            df['atipico_iqr'] = (precios < q1 - 1.5 * iqr) | (precios > q3 + 1.5 * iqr)
    df['banda_precio_mxn'] = pd.cut(precios, [0, 500, 1000, float('inf')], labels=['hasta_500', '501_a_1000', 'mas_de_1000'], include_lowest=False)
    df['jerarquia'] = 'salud > odontologia > resina dental (piloto)'
    return df


def ejecutar(bronce, salida, catalogo_manifest=None, referencias=None):
    filas, cuarentena = [], []
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
    validos, rechazados = validar_filas(filas)
    cuarentena.extend(rechazados)
    correspondencias = None
    if catalogo_manifest is not None and referencias is not None:
        catalogo, hash_catalogo = cargar_catalogo(catalogo_manifest)
        correspondencias = generar_correspondencias(filas, validos, catalogo, cargar_referencias(referencias), hash_catalogo)
    salida.mkdir(parents=True, exist_ok=False)
    (salida / 'cuarentena.json').write_text(json.dumps(cuarentena, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    plata = transformar(validos)
    plata.to_csv(salida / 'plata.csv', index=False, encoding='utf-8')
    if correspondencias is not None:
        columnas = ['fuente', 'url', 'producto', 'fecha_utc', 'archivo', 'sha256', 'apta_plata',
                    'clave_issste', 'descripcion_issste', 'unidad_issste', 'sha256_catalogo_issste',
                    'estado_revision', 'tipo_relacion', 'coincidencias', 'diferencias', 'evidencia',
                    'revisor', 'fecha_revision']
        pd.DataFrame(correspondencias, columns=columnas).to_csv(salida / 'correspondencias.csv', index=False, encoding='utf-8')
    resumen = {'entradas': len(filas) + len(cuarentena) - len(rechazados), 'validos': len(validos), 'cuarentena': len(cuarentena),
               'faltantes_candidatos': pd.DataFrame(filas).isna().sum().astype(int).to_dict() if filas else {},
               'nota': 'Estadística exploratoria; productos y condiciones no verificados como equivalentes.'}
    (salida / 'resumen.json').write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding='utf-8')
    return resumen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--bronce', type=Path, default=Path('datos/bronce/odontologia'))
    parser.add_argument('--salida', type=Path, default=None)
    parser.add_argument('--catalogo', type=Path, default=Path('datos/bronce/issste_insumos/20261113T015745409442Z/manifiesto.json'))
    parser.add_argument('--referencias', type=Path, default=Path('datos/referencias/correspondencias_issste.csv'))
    args = parser.parse_args()
    salida = args.salida or Path('datos/e1') / dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    print(json.dumps(ejecutar(args.bronce, salida, args.catalogo, args.referencias), ensure_ascii=False, indent=2))
    print(f'Salida: {salida}')


if __name__ == '__main__':
    main()
