import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from src.integracion_oro import construir_oro
from src.geoespacial_e2 import procesar


class E2Test(unittest.TestCase):
    def test_oro_conserva_localizador_de_bronce(self):
        filas = pd.DataFrame([dict(url='https://ejemplo.test/x', fecha_utc='2026-01-01T00:00:00Z',
            sha256='a'*64, archivo='datos/bronce/lote/p.html', registro_origen='tarjeta-3',
            fuente='imdent', producto='Resina', precio=10., categoria='resinas')])
        oro, metricas, _ = construir_oro(filas, [], [])
        self.assertEqual(oro.iloc[0]['archivo_bronce'], 'datos/bronce/lote/p.html')
        self.assertEqual(oro.iloc[0]['registro_origen'], 'tarjeta-3')
        linaje = json.loads(metricas.iloc[0]['linaje'])
        self.assertEqual(linaje[0]['archivo_bronce'], 'datos/bronce/lote/p.html')
        self.assertEqual(linaje[0]['fecha_utc'], '2026-01-01T00:00:00Z')

    def test_geoespacial_verifica_hash_y_genera_linaje(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw = json.dumps({'elements': [{'type': 'node', 'id': 1, 'lat': 19.24, 'lon': -103.72}]}).encode()
            (root / 'osm.json').write_bytes(raw)
            meta = {'archivo': 'osm.json', 'sha256': hashlib.sha256(raw).hexdigest(),
                    'consultado_utc': '2026-11-20T00:00:00+00:00', 'url': 'https://overpass-api.de/api/interpreter'}
            (root / 'manifiesto.json').write_text(json.dumps(meta), encoding='utf8')
            procesar(root / 'manifiesto.json', root / 'salida')
            oro = pd.read_csv(root / 'salida' / 'oro_dentistas_osm.csv')
            self.assertEqual(oro.iloc[0]['registro_origen'], 'node/1')
            self.assertEqual(oro.iloc[0]['sha256'], meta['sha256'])
            self.assertTrue((root / 'salida' / 'mapa_dentistas_osm.png').exists())
            (root / 'osm.json').write_bytes(b'{}')
            with self.assertRaises(ValueError):
                procesar(root / 'manifiesto.json', root / 'otra')
