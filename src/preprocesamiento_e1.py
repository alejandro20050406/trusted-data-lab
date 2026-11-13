"""Categorías y estimaciones exploratorias; jamás reemplaza precios observados."""
import datetime as dt
import hashlib
import math
import re
import unicodedata
from urllib.parse import urlsplit

import pandas as pd


PATRONES = (
    ('guantes', r'\bguantes?\b'),
    ('gasas', r'\bgasas?\b'),
    ('cubrebocas', r'\b(?:cubrebocas|mascarillas?)\b'),
    ('resinas', r'\b(?:nano)?resinas?\b'),
    ('adhesivos', r'\badhesiv\w*\b'),
    ('desinfeccion', r'\b(?:desinfectantes?|germicidas?)\b'),
    ('fresas_rotatorias', r'\bfresas?\b'),
    ('limas', r'\blimas?\b'),
    ('cementos', r'\bcementos?\b'),
    ('ionomeros', r'\bionomeros?\b'),
    ('material_impresion', r'\b(?:alginatos?|siliconas?)\b'),
    ('instrumental', r'\b(?:pinzas?|forceps|espejos?|retractores?)\b'),
    ('higiene_preventiva', r'\b(?:cepillos?|profilaxis|hilo dental)\b'),
    ('jeringas_agujas', r'\b(?:jeringas?|agujas?)\b'),
    ('anestesia', r'\banestesic\w*\b'),
)


def categoria_producto(nombre):
    texto = ''.join(c for c in unicodedata.normalize('NFKD', str(nombre).casefold())
                    if not unicodedata.combining(c))
    for categoria, patron in PATRONES:
        if re.search(patron, texto):
            return categoria
    return 'sin_clasificar'



def fecha_utc_dia(valor):
    try:
        fecha = dt.datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
        if fecha.utcoffset() is None:
            return ''
        return fecha.astimezone(dt.timezone.utc).date().isoformat()
    except (ValueError, TypeError, OverflowError):
        return ''


def tienda_de_url(url):
    partes = urlsplit(str(url))
    ruta = partes.path.strip('/').split('/')
    if partes.netloc == 'imdent.com' and len(ruta) > 1 and ruta[0] == 'stores':
        return ruta[1]
    return ''


def _grupos(df):
    if df.empty:
        return
    for clave, grupo in df.groupby(['grupo_tienda', 'categoria', 'fecha_grupo'], dropna=False):
        tienda, categoria, fecha = clave
        if not tienda or not fecha or categoria == 'sin_clasificar':
            continue
        unicos = grupo.sort_values('fecha_utc', kind='stable').drop_duplicates('url', keep='last')
        yield clave, grupo, unicos


def enriquecer(plata):
    df = plata.copy()
    for columna in ('precio_minmax_grupo', 'precio_zscore_grupo',
                    'limite_inferior_iqr', 'limite_superior_iqr'):
        df[columna] = float('nan')
    df['atipico_iqr_grupo'] = pd.Series(pd.NA, index=df.index, dtype='boolean')
    df['precio_suavizado_exploratorio'] = df['precio'].astype(float) if 'precio' in df else pd.Series(dtype=float)
    df['categoria'] = df['producto'].map(categoria_producto) if 'producto' in df else pd.Series(dtype=str)
    df['fecha_grupo'] = df['fecha_utc'].map(fecha_utc_dia) if 'fecha_utc' in df else pd.Series(dtype=str)
    df['grupo_tienda'] = df['url'].map(tienda_de_url) if 'url' in df else pd.Series(dtype=str)
    df['jerarquia'] = df['categoria'].map(lambda c: 'salud > insumos > ' + c)
    for _, grupo, unicos in _grupos(df):
        valores = unicos['precio'].astype(float)
        if len(valores) < 10:
            continue
        minimo, maximo = valores.min(), valores.max()
        sigma = valores.std(ddof=0)
        actuales = grupo['precio'].astype(float)
        if maximo > minimo:
            df.loc[grupo.index, 'precio_minmax_grupo'] = (actuales - minimo) / (maximo - minimo)
        if sigma > 0:
            df.loc[grupo.index, 'precio_zscore_grupo'] = (actuales - valores.mean()) / sigma
        if len(valores) >= 20:
            q1, q3 = valores.quantile([0.25, 0.75])
            iqr = q3 - q1
            if iqr > 0:
                inferior, superior = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                df.loc[grupo.index, 'limite_inferior_iqr'] = inferior
                df.loc[grupo.index, 'limite_superior_iqr'] = superior
                df.loc[grupo.index, 'atipico_iqr_grupo'] = (actuales < inferior) | (actuales > superior)
                df.loc[grupo.index, 'precio_suavizado_exploratorio'] = actuales.clip(lower=max(0, inferior), upper=superior)
    return df



def _instante(valor):
    try:
        fecha = dt.datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
        return fecha.astimezone(dt.timezone.utc) if fecha.utcoffset() is not None else None
    except (ValueError, TypeError, OverflowError):
        return None


def _historial_por_ficha(plata):
    historial = {}
    if plata.empty:
        return historial
    for _, fila in plata.iterrows():
        url, producto = str(fila.get('url') or ''), str(fila.get('producto') or '')
        momento = _instante(fila.get('fecha_utc'))
        if not tienda_de_url(url) or not producto or momento is None:
            continue
        historial.setdefault((url, producto), []).append({
            'momento': momento, 'fecha_utc': fila['fecha_utc'], 'precio': float(fila['precio']),
            'sha256': fila.get('sha256', ''), 'categoria': fila.get('categoria', '')})
    for filas in historial.values():
        filas.sort(key=lambda x: (x['momento'], x['sha256']))
    return historial


def estimar_faltantes(plata, cuarentena):
    modelos = {}
    for clave, _, unicos in _grupos(plata):
        if len(unicos) >= 10:
            modelos[clave] = (float(unicos['precio'].median()), len(unicos))
    errores = {}
    for resultado in validar_imputacion(plata):
        if resultado['metodo'] == 'mediana_tienda_categoria_dia':
            clave = (resultado['tienda'], resultado['categoria'], resultado['fecha_grupo'])
            errores.setdefault(clave, []).append(resultado['error_porcentual'])
    historiales = _historial_por_ficha(plata)
    salida = []
    for rechazo in cuarentena:
        fila = rechazo.get('registro') or {}
        if not isinstance(fila, dict) or fila.get('fuente') != 'imdent_catalogo' or fila.get('precio') is not None:
            continue
        url = str(fila.get('url') or '')
        tienda = tienda_de_url(url)
        categoria = categoria_producto(fila.get('producto', ''))
        fecha = fecha_utc_dia(fila.get('fecha_utc'))
        clave = (tienda, categoria, fecha)
        modelo = modelos.get(clave)
        pruebas = errores.get(clave, [])
        mape = sum(pruebas) / len(pruebas) if pruebas else None
        momento = _instante(fila.get('fecha_utc'))
        previos = [x for x in historiales.get((url, str(fila.get('producto') or '')), [])
                   if momento and dt.timedelta(0) < momento - x['momento'] <= dt.timedelta(days=7)]
        referencia = previos[-1] if previos else None
        metodo = ('ultima_observacion_misma_url_7d' if referencia else
                  'mediana_tienda_categoria_dia' if modelo else 'sin_estimacion')
        diagnostico = ('historico_exploratorio' if referencia else
                       'sin_modelo' if not modelo else
                       'evidencia_insuficiente' if len(pruebas) < 5 else
                       'error_alto' if mape > 30 else 'revision_manual')
        salida.append({
            'fuente': fila.get('fuente', ''), 'url': url, 'producto': fila.get('producto', ''),
            'fecha_utc': fila.get('fecha_utc', ''), 'categoria': categoria,
            'archivo': fila.get('archivo', ''), 'sha256': fila.get('sha256', ''),
            'registro_origen': rechazo.get('registro_origen', ''),
            'precio_original': None,
            'precio_estimado_mxn': referencia['precio'] if referencia else modelo[0] if modelo else None,
            'es_imputado': bool(referencia or modelo), 'metodo': metodo,
            'n_referencias': len(previos) if referencia else modelo[1] if modelo else 0,
            'fecha_observacion_referencia': referencia['fecha_utc'] if referencia else '',
            'sha256_observacion_referencia': referencia['sha256'] if referencia else '',
            'validacion_n': 0 if referencia else len(pruebas), 'validacion_mape_porcentaje': None if referencia else mape,
            'diagnostico_confiabilidad': diagnostico,
            'motivo_cuarentena': rechazo.get('motivo', ''),
            'advertencia': 'Estimación exploratoria; no es precio publicado ni cotización.',
        })
    return salida



def diagnosticar_faltantes(filas):
    grupos = {}
    for fila in filas:
        clave = (str(fila.get('fuente') or ''), tienda_de_url(fila.get('url') or ''),
                 categoria_producto(fila.get('producto', '')))
        total, faltan = grupos.get(clave, (0, 0))
        precio = fila.get('precio')
        faltante = precio is None or bool(pd.isna(precio))
        grupos[clave] = (total + 1, faltan + int(faltante))
    return [{'fuente': k[0], 'tienda': k[1], 'categoria': k[2], 'total': n,
             'precio_faltante': f, 'porcentaje_faltante': 100.0 * f / n}
            for k, (n, f) in sorted(grupos.items())]


def validar_imputacion(plata):
    resultados = []
    for clave, _, unicos in _grupos(plata):
        if len(unicos) < 13:
            continue
        orden = sorted((str(x['url']), float(x['precio'])) for _, x in unicos.iterrows())
        orden.sort(key=lambda par: hashlib.sha256(par[0].encode('utf-8')).hexdigest())
        n_prueba = max(1, math.ceil(len(orden) * 0.2))
        prueba, entrenamiento = orden[:n_prueba], orden[n_prueba:]
        if len(entrenamiento) < 10:
            continue
        mediana = float(pd.Series([v for _, v in entrenamiento]).median())
        for url, observado in prueba:
            resultados.append({'tienda': clave[0], 'categoria': clave[1], 'fecha_grupo': clave[2],
                               'url_oculta': url, 'precio_observado': observado,
                               'precio_estimado_validacion': mediana, 'error_absoluto': abs(observado-mediana),
                               'error_porcentual': abs(observado-mediana)/observado * 100,
                               'n_entrenamiento': len(entrenamiento),
                               'metodo': 'mediana_tienda_categoria_dia'})
    for (url, _), observaciones in _historial_por_ficha(plata).items():
        for anterior, actual in zip(observaciones, observaciones[1:]):
            diferencia = actual['momento'] - anterior['momento']
            if not dt.timedelta(0) < diferencia <= dt.timedelta(days=7):
                continue
            real, estimado = actual['precio'], anterior['precio']
            resultados.append({'tienda': tienda_de_url(url), 'categoria': actual['categoria'],
                               'fecha_grupo': fecha_utc_dia(actual['fecha_utc']), 'url_oculta': url,
                               'precio_observado': real, 'precio_estimado_validacion': estimado,
                               'error_absoluto': abs(real-estimado), 'error_porcentual': abs(real-estimado)/real*100,
                               'n_entrenamiento': 1, 'metodo': 'ultima_observacion_misma_url_7d',
                               'fecha_utc_objetivo': actual['fecha_utc'],
                               'fecha_utc_referencia': anterior['fecha_utc'], 'sha256_referencia': anterior['sha256']})
    return resultados
