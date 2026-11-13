"""Extrae la oferta principal Dentalink sin interpretar el rango agregado."""
import re
from bs4 import BeautifulSoup


def extraer_precio_principal(html, producto, moneda):
    if moneda != 'MXN':
        raise ValueError('La moneda de la oferta no es MXN')
    soup = BeautifulSoup(html, 'html.parser')
    titulos = soup.find_all('h1')
    if len(titulos) != 1 or titulos[0].get_text(' ', strip=True) != producto:
        raise ValueError('El título de la ficha no coincide con el producto')
    seccion = None
    for contenedor in titulos[0].parents:
        if contenedor.name in {'body', 'html', '[document]'}:
            break
        vendedores = [a for a in contenedor.find_all('a', href=True)
                      if a['href'].startswith('/mx/depositos/') and
                      'Vendido y despachado por' in a.get_text(' ', strip=True)]
        tarjetas = contenedor.select('div.ha-card.sticky')
        if len(vendedores) == 1 and len(tarjetas) == 1:
            seccion = (vendedores[0], tarjetas[0])
            break
    if seccion is None:
        raise ValueError('No se identificó una oferta principal y vendedor únicos')
    vendedor, tarjeta = seccion
    nombre = vendedor.find('b')
    if not nombre or not nombre.get_text(' ', strip=True):
        raise ValueError('El vendedor no está identificado')
    montos = []
    for span in tarjeta.select('span.ha-num.font-bold'):
        texto = span.get_text(' ', strip=True)
        if re.fullmatch(r'\$(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{2}', texto):
            montos.append(float(texto[1:].replace(',', '')))
    if len(montos) != 1:
        raise ValueError('El precio principal no es único o reconocible')
    estado = 'sin_stock' if 'sin stock por ahora' in tarjeta.get_text(' ', strip=True).casefold() else 'no_verificada'
    return {'precio': montos[0], 'vendedor': nombre.get_text(' ', strip=True),
            'disponibilidad': estado}
