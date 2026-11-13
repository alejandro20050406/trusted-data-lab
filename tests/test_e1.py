import json
import hashlib
import tempfile
import unittest
from pathlib import Path
from src.e1 import ejecutar, extraer_producto, validar_filas, transformar


class E1Test(unittest.TestCase):
    def test_offer_and_range(self):
        def html(offer):
            return '<script type="application/ld+json">' + json.dumps({'@type': 'Product', 'name': 'X', 'offers': offer}) + '</script>'
        self.assertEqual(extraer_producto(html({'@type': 'Offer', 'price': '123.5', 'priceCurrency': 'mxn'}))['precio'], 123.5)
        self.assertIsNone(extraer_producto(html({'@type': 'AggregateOffer', 'lowPrice': 10}))['precio'])

    def test_gate_preserves_invalid_reason(self):
        rows = [dict(fuente='a', url='https://a.test', fecha_utc='2026-01-01T00:00:00+00:00', archivo='a.html', sha256='a'*64, producto='x', moneda='MXN', precio=10.0), dict(fuente='b', url='https://b.test', fecha_utc='bad', archivo='b.html', sha256='b'*64, producto='x', moneda='MXN', precio=-1.0)]
        good, bad = validar_filas(rows)
        self.assertEqual(len(good), 1)
        self.assertEqual(len(bad), 1)
        self.assertTrue(bad[0]['motivo'])
        self.assertEqual(bad[0]['registro']['precio'], -1.0)

    def test_small_sample(self):
        df = transformar([{'precio': 10.0}, {'precio': 20.0}])
        self.assertTrue(df['atipico_iqr'].isna().all())
        self.assertEqual(df['precio_minmax'].tolist(), [0.0, 1.0])

    def test_pipeline_checks_hash_and_retains_failed_capture(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            capture = base / 'bronze' / 'one'
            capture.mkdir(parents=True)
            html = '<script type="application/ld+json">' + json.dumps({'@type': 'Product', 'name': 'X', 'offers': {'@type': 'Offer', 'price': '4', 'priceCurrency': 'MXN'}}) + '</script>'
            (capture / 'x.html').write_text(html, encoding='utf-8')
            entry = dict(fuente='x', estado='ok', archivo='x.html', sha256=hashlib.sha256(html.encode()).hexdigest(), url='https://x.test', consultado_utc='2026-01-01T00:00:00+00:00')
            (capture / 'manifiesto.json').write_text(json.dumps([entry, dict(fuente='bad', estado='error', detalle='fallo')]), encoding='utf-8')
            summary = ejecutar(base / 'bronze', base / 'out')
            self.assertEqual((summary['entradas'], summary['validos'], summary['cuarentena']), (2, 1, 1))
            self.assertIn('fallo', (base / 'out' / 'cuarentena.json').read_text(encoding='utf-8'))
            (capture / 'x.html').write_text('alterado', encoding='utf-8')
            summary = ejecutar(base / 'bronze', base / 'out2')
            self.assertEqual((summary['validos'], summary['cuarentena']), (0, 2))
            self.assertIn('SHA-256', (base / 'out2' / 'cuarentena.json').read_text(encoding='utf-8'))
