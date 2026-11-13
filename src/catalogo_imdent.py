"""Extracción conservadora de páginas públicas de la tienda piloto de Imdent."""
import re
import json
from urllib.parse import parse_qs, urljoin, urlsplit
from bs4 import BeautifulSoup

BASE = 'https://imdent.com/stores/deposito-dental-q-narvarte'
TIENDAS = ('deposito-dental-q-narvarte', 'ddc-deposito-dental-del-caribe',
           'deposito-dental-goldentist', 'deposito-dental-dentac')


def total_anunciado(html):
    totales = []
    for script in BeautifulSoup(html, 'html.parser').find_all('script', type='application/ld+json'):
        try:
            obj = json.loads(script.string or script.get_text())
        except (TypeError, ValueError):
            continue
        if isinstance(obj, dict):
            cat = obj.get('hasOfferCatalog')
            if isinstance(cat, dict) and isinstance(cat.get('numberOfItems'), int):
                totales.append(cat['numberOfItems'])
    if len(totales) != 1 or totales[0] < 1:
        raise ValueError('No se encontró un total de productos único y válido')
    return totales[0]


def siguiente_pagina(html, actual):
    soup = BeautifulSoup(html, 'html.parser')
    enlaces = [a for a in soup.find_all('a', href=True)
               if 'página siguiente' in a.get_text(' ', strip=True).casefold()]
    if len(enlaces) > 1:
        raise ValueError('Paginación ambigua')
    if not enlaces:
        return None
    url = urljoin(actual, enlaces[0]['href'])
    partes = urlsplit(url)
    antes = parse_qs(urlsplit(actual).query).get('page', ['1'])
    query = parse_qs(partes.query, keep_blank_values=True)
    tienda_actual = urlsplit(actual).path
    if (partes.scheme != 'https' or partes.netloc != 'imdent.com' or partes.path != tienda_actual
            or tienda_actual not in {'/stores/' + slug for slug in TIENDAS}
            or set(query) != {'view', 'page'} or query.get('view') != ['list']
            or len(query.get('page', [])) != 1 or not query['page'][0].isdigit()
            or int(query['page'][0]) != int(antes[0]) + 1 or partes.fragment):
        raise ValueError('URL de página siguiente inesperada')
    return url


def extraer_listado(html, base=BASE):
    if base not in {'https://imdent.com/stores/' + slug for slug in TIENDAS}:
        raise ValueError('Tienda no configurada')
    soup = BeautifulSoup(html, 'html.parser')
    resultado = []
    for articulo in soup.select('article[data-view="list"]'):
        titulo = articulo.find('h3')
        enlace = titulo.find_parent('a', href=True) if titulo else None
        url = urljoin(base, enlace['href']) if enlace else ''
        if not url.startswith(base + '/products/'):
            url = ''
        precios = []
        for span in articulo.select('p span.font-bold'):
            if 'line-through' in span.get('class', []):
                continue
            texto = span.get_text(' ', strip=True).replace('\xa0', ' ')
            m = re.fullmatch(r'((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s+MXN', texto)
            if m:
                precios.append(float(m.group(1).replace('.', '').replace(',', '.')))
        resultado.append({'producto': titulo.get_text(' ', strip=True) if titulo else '',
                          'url': url, 'precio': precios[0] if len(precios) == 1 else None,
                          'moneda': 'MXN' if len(precios) == 1 else '',
                          'registro_origen': articulo.get('id', '')})
    if not resultado:
        raise ValueError('La página no contiene tarjetas de productos reconocibles')
    return resultado
