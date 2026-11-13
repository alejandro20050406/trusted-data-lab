"""Descarga páginas originales de un catálogo, respetando robots y pausas."""
import argparse
import datetime as dt
import hashlib
import json
import time
from pathlib import Path
from urllib.parse import urljoin

from scripts.captura_dental import obtener, permitido
from src.catalogo_imdent import BASE, TIENDAS, extraer_listado, siguiente_pagina, total_anunciado


def capturar(destino, pausa=1.5, max_paginas=100, base=BASE):
    destino.mkdir(parents=True, exist_ok=False)
    entradas = []
    url = base + '?view=list'
    robots_url = urljoin(base, '/robots.txt')
    total = None
    pendiente = None
    try:
        robots, tipo, _ = obtener(robots_url)
        if tipo != 'text/plain':
            raise ValueError('robots.txt no es texto')
        robots_texto = robots.decode('utf-8', errors='strict')
        robots_hash = hashlib.sha256(robots).hexdigest()
        while url:
            if len(entradas) >= max_paginas:
                raise ValueError('Límite de páginas alcanzado antes del final')
            if not permitido(robots_texto, url):
                raise ValueError('robots.txt no permite ' + url)
            time.sleep(pausa)
            fecha = dt.datetime.now(dt.timezone.utc).isoformat()
            datos, tipo, url_final = obtener(url)
            if tipo != 'text/html' or url_final != url:
                raise ValueError('Respuesta o redirección inesperada: ' + url)
            nombre = f'pagina-{len(entradas)+1:04d}.html'
            (destino / nombre).write_bytes(datos)
            pendiente = {'fuente': 'imdent_catalogo', 'url': url, 'consultado_utc': fecha,
                         'estado': 'error', 'archivo': nombre, 'sha256': hashlib.sha256(datos).hexdigest(),
                         'robots_url': robots_url, 'robots_sha256': robots_hash}
            html = datos.decode('utf-8', errors='strict')
            filas = extraer_listado(html, base)
            anunciado = total_anunciado(html)
            if total is None:
                total = anunciado
            elif total != anunciado:
                raise ValueError('El total anunciado cambió durante la captura')
            siguiente = siguiente_pagina(html, url)
            pendiente.update(estado='ok', productos_detectados=len(filas))
            entradas.append(pendiente)
            pendiente = None
            print(f"Página {len(entradas)}: {len(filas)} tarjetas", flush=True)
            url = siguiente
        detectados = sum(e['productos_detectados'] for e in entradas)
        if detectados != total:
            raise ValueError(f'Cobertura incompleta: {detectados} tarjetas frente a {total} anunciadas')
        estado = 'completa'
    except (OSError, ValueError, UnicodeError) as error:
        if pendiente is None:
            pendiente = {'fuente': 'imdent_catalogo', 'url': url, 'estado': 'error',
                         'consultado_utc': dt.datetime.now(dt.timezone.utc).isoformat()}
        pendiente['detalle'] = str(error)
        entradas.append(pendiente)
        estado = 'parcial'
    manifiesto = {'version': 1, 'estado': estado, 'total_anunciado': total, 'paginas': entradas}
    (destino / 'manifiesto.json').write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Captura {estado}: {destino}', flush=True)
    return estado == 'completa'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--salida', type=Path)
    parser.add_argument('--max-paginas', type=int, default=100)
    parser.add_argument('--tienda', choices=['todas', 'otras', *TIENDAS], default='todas')
    args = parser.parse_args()
    fecha = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    tiendas = TIENDAS if args.tienda == 'todas' else TIENDAS[1:] if args.tienda == 'otras' else (args.tienda,)
    if args.salida and len(tiendas) != 1:
        parser.error('--salida requiere una sola --tienda')
    resultados = []
    for tienda in tiendas:
        destino = args.salida or Path('datos/bronce/imd_catalogo') / f'{fecha}-{tienda}'
        resultados.append(capturar(destino, max_paginas=args.max_paginas,
                                   base='https://imdent.com/stores/' + tienda))
    return 0 if all(resultados) else 1


if __name__ == '__main__':
    raise SystemExit(main())
