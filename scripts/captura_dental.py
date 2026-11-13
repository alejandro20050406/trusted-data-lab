"""Captura Bronce de páginas públicas: conserva respuestas originales, no genera precios."""
import datetime as dt
import hashlib
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from pathlib import Path

AGENTE = 'TrustedDataLabAcademic/1.0'
FUENTES = [
    {'id': 'imdent', 'url': 'https://imdent.com/stores/deposito-dental-q-narvarte/products/resina-filtek-z350-xt-4-gr-3m', 'marcador': 'Filtek Z350 XT'},
    {'id': 'tu_universo_dental', 'url': 'https://www.tuuniversodental.com.mx/resina-dental-3m-filtek', 'marcador': 'Filtek'},
    {'id': 'dentalink_market', 'url': 'https://dentalinkmarket.com/mx/productos/31069-jeringa-de-resina-z-350-xt-color-a2b-4g', 'marcador': 'z-350'},
]


class SinRedireccion(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _obtener_una_vez(url):
    solicitud = urllib.request.Request(url, headers={'User-Agent': AGENTE, 'Accept': 'text/html,text/plain'})
    with urllib.request.build_opener(SinRedireccion).open(solicitud, timeout=30) as respuesta:
        datos = respuesta.read(5_000_001)
        if len(datos) > 5_000_000:
            raise ValueError('Respuesta supera 5 MB')
        return datos, respuesta.headers.get_content_type(), respuesta.geturl()


def _error_transitorio(error):
    if isinstance(error, urllib.error.HTTPError):
        return error.code in {500, 502, 503, 504}
    if isinstance(error, urllib.error.URLError):
        error = error.reason
    if isinstance(error, socket.gaierror):
        return error.errno == socket.EAI_AGAIN
    return isinstance(error, (ssl.SSLEOFError, TimeoutError, ConnectionResetError,
                              ConnectionAbortedError))


def obtener(url):
    # Nunca se desactiva la verificación de certificados ni se evaden rechazos HTTP.
    for intento in range(4):
        try:
            return _obtener_una_vez(url)
        except (OSError, urllib.error.URLError) as error:
            if intento == 3 or not _error_transitorio(error):
                raise
            espera = 2 ** (intento + 1)
            print(f'Reintentando conexión transitoria ({intento + 1}/3) en {espera}s: {type(error).__name__}',
                  file=sys.stderr, flush=True)
            time.sleep(espera)


def permitido(texto, url):
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(texto.splitlines())
    return parser.can_fetch(AGENTE, url)


def validar_html(datos, marcador=None):
    texto = datos.decode('utf-8', errors='replace')
    if '<html' not in texto.lower() or not re.search(r'(?:(?:price|precio).{0,100}\d|(?:mxn|mx\$|\$)\s*[\d,.]+|\d[\d,.]*\s*mxn)', texto, re.I):
        raise ValueError('La respuesta no parece una página HTML de precios')
    if marcador and marcador.lower() not in texto.lower():
        raise ValueError('La página no contiene el producto esperado')


def capturar(destino, fuentes=FUENTES):
    destino.mkdir(parents=True, exist_ok=True)
    resultados = []
    for fuente in fuentes:
        fecha = dt.datetime.now(dt.timezone.utc).isoformat()
        entrada = {'fuente': fuente['id'], 'url': fuente['url'], 'consultado_utc': fecha}
        etapa = 'configuracion'
        try:
            partes = urllib.parse.urlsplit(fuente['url'])
            if partes.scheme != 'https':
                raise ValueError('Solo se admiten URLs HTTPS')
            robots_url = urllib.parse.urlunsplit((partes.scheme, partes.netloc, '/robots.txt', '', ''))
            etapa = 'robots'
            robots, tipo, _ = obtener(robots_url)
            if tipo != 'text/plain' or not permitido(robots.decode('utf-8', errors='replace'), fuente['url']):
                raise ValueError('robots.txt no permite o no confirma el acceso')
            etapa = 'producto'
            datos, tipo, url_final = obtener(fuente['url'])
            if tipo != 'text/html':
                raise ValueError('Respuesta no es HTML')
            validar_html(datos, fuente.get('marcador'))
            archivo = fuente['id'] + '.html'
            (destino / archivo).write_bytes(datos)
            entrada.update(estado='ok', archivo=archivo, url_final=url_final,
                           sha256=hashlib.sha256(datos).hexdigest(), bytes=len(datos),
                           robots_url=robots_url, robots_sha256=hashlib.sha256(robots).hexdigest())
        except (OSError, ValueError, UnicodeError) as error:
            entrada.update(estado='error', etapa_error=etapa, detalle=str(error))
            print(f"{fuente['id']} ({etapa}): {type(error).__name__}: {error}", file=sys.stderr)
        resultados.append(entrada)
        print(f"{fuente['id']}: {entrada['estado']}")
    (destino / 'manifiesto.json').write_text(json.dumps(resultados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return resultados


def main():
    fecha = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destino = Path('datos/bronce/odontologia') / fecha
    resultados = capturar(destino)
    print(f'Captura: {destino}')
    return int(any(r['estado'] != 'ok' for r in resultados))


if __name__ == '__main__':
    sys.exit(main())
