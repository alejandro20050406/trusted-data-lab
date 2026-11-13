import unittest
import tempfile
import json
import hashlib
from pathlib import Path
from unittest.mock import patch
from src.catalogo_imdent import extraer_listado, siguiente_pagina, total_anunciado
from src.e1 import ejecutar, transformar
from scripts.captura_imdent import capturar


class CatalogoImdentTest(unittest.TestCase):
    def test_precio_actual_y_faltantes(self):
        html = '''<article data-view="list" id="prod-1"><a href="/stores/deposito-dental-q-narvarte/products/a"><h3>Guantes</h3></a><p><span class="font-bold">152,00 MXN</span><span class="line-through">174,80 MXN</span></p></article>
        <article data-view="list" id="prod-2"><a href="/stores/deposito-dental-q-narvarte/products/b"><h3>Gasas</h3></a></article>'''
        filas = extraer_listado(html)
        self.assertEqual(len(filas), 2)
        self.assertEqual(filas[0]['precio'], 152.0)
        self.assertIsNone(filas[1]['precio'])
        self.assertEqual(filas[1]['producto'], 'Gasas')
        self.assertEqual(filas[0]['registro_origen'], 'prod-1')

    def test_no_interpreta_precio_ambiguo(self):
        html = '<article data-view="list" id="p"><a href="/stores/deposito-dental-q-narvarte/products/a"><h3>X</h3></a><p><span class="font-bold">10,00 MXN</span><span class="font-bold">20,00 MXN</span></p></article>'
        self.assertIsNone(extraer_listado(html)[0]['precio'])

    def test_siguiente_pagina_limitada_a_tienda_y_numero(self):
        u = 'https://imdent.com/stores/deposito-dental-q-narvarte?view=list&page=2'
        self.assertEqual(siguiente_pagina('<a href="?view=list&amp;page=2">Página siguiente</a>', u.replace('page=2','page=1')), u)
        with self.assertRaises(ValueError):
            siguiente_pagina('<a href="https://malicioso.test/x">Página siguiente</a>', u)

    def test_total_anunciado_y_tienda_adicional(self):
        pagina = '<script type="application/ld+json">{"hasOfferCatalog":{"numberOfItems":846}}</script>'
        self.assertEqual(total_anunciado(pagina), 846)
        with self.assertRaises(ValueError):
            total_anunciado('<html></html>')
        base = 'https://imdent.com/stores/ddc-deposito-dental-del-caribe'
        html = '<article data-view="list" id="p"><a href="/stores/ddc-deposito-dental-del-caribe/products/a"><h3>Gasa</h3></a><p><span class="font-bold">1.234,50 MXN</span></p></article>'
        self.assertEqual(extraer_listado(html, base)[0]['precio'], 1234.5)

    def test_no_mezcla_precios_de_productos_diferentes(self):
        df = transformar([{'url': 'a', 'precio': 10.0}, {'url': 'b', 'precio': 200.0}])
        self.assertTrue(df['precio_zscore'].isna().all())
        self.assertTrue(df['precio_minmax'].isna().all())

    def test_pagina_integra_ingresa_y_sin_precio_va_a_cuarentena(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            odont = base / 'dental' / 'snapshot'
            odont.mkdir(parents=True)
            (odont / 'manifiesto.json').write_text('[]', encoding='utf-8')
            carpeta = base / 'catalogo' / 'snapshot'
            carpeta.mkdir(parents=True)
            html = ('<article data-view="list" id="p1"><a href="/stores/deposito-dental-q-narvarte/products/a"><h3>A</h3></a><p><span class="font-bold">10,00 MXN</span></p></article>'
                    '<article data-view="list" id="p2"><a href="/stores/deposito-dental-q-narvarte/products/b"><h3>B</h3></a></article>')
            datos = html.encode('utf-8')
            (carpeta / 'p.html').write_bytes(datos)
            item = {'estado': 'ok', 'fuente': 'imdent_catalogo', 'archivo': 'p.html', 'sha256': hashlib.sha256(datos).hexdigest(), 'consultado_utc': '2026-01-01T00:00:00+00:00', 'productos_detectados': 2}
            (carpeta / 'manifiesto.json').write_text(json.dumps({'version': 1, 'estado': 'completa', 'paginas': [item]}), encoding='utf-8')
            resumen = ejecutar(base / 'dental', base / 'out', imdent_bronce=base / 'catalogo')
            self.assertEqual((resumen['entradas'], resumen['validos'], resumen['cuarentena']), (2, 1, 1))
            self.assertEqual(resumen['urls_unicas_validas'], 1)
            self.assertEqual(resumen['capturas_imdent'][0]['tarjetas_detectadas'], 2)
            self.assertIn('p1', (base / 'out' / 'plata.csv').read_text(encoding='utf-8'))
            self.assertIn('p2', (base / 'out' / 'cuarentena.json').read_text(encoding='utf-8'))

    @patch('scripts.captura_imdent.time.sleep')
    @patch('scripts.captura_imdent.obtener')
    def test_detecta_catalogo_incompleto_y_conserva_html(self, obtener, _):
        html = ('<script type="application/ld+json">{"hasOfferCatalog":{"numberOfItems":2}}</script>'
                '<article data-view="list" id="p"><a href="/stores/deposito-dental-q-narvarte/products/a"><h3>A</h3></a></article>').encode()
        obtener.side_effect = [(b'User-agent: *\nAllow: /', 'text/plain', 'https://imdent.com/robots.txt'),
                               (html, 'text/html', 'https://imdent.com/stores/deposito-dental-q-narvarte?view=list')]
        with tempfile.TemporaryDirectory() as temp:
            destino = Path(temp) / 'captura'
            self.assertFalse(capturar(destino, pausa=0))
            self.assertEqual((destino / 'pagina-0001.html').read_bytes(), html)
            meta = json.loads((destino / 'manifiesto.json').read_text(encoding='utf-8'))
            self.assertEqual(meta['estado'], 'parcial')
            self.assertIn('Cobertura incompleta', meta['paginas'][-1]['detalle'])
