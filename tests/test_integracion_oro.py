import csv
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import pandas as pd
from src.integracion_oro import procesar_issste, construir_oro


class IntegracionOroTest(unittest.TestCase):
    def test_catalogo_valida_filas_y_conserva_claves_textuales(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            raw = ('CLAVE,DESCRIPCION,UNIDAD DE PRESENTACION,NIVEL DE ATENCION,GRUPO TERAPEUTICO,INDICACIONES\n'
                   '001,Gasas,PIEZA,1er Nivel,Material,0\n'
                   '001,Gasas,PIEZA,2do Nivel,Material,0\n'
                   ',Registro inválido,PIEZA,1er Nivel,Material,0\n').encode('cp1252')
            (p / 'catalogo.csv').write_bytes(raw)
            meta = {'archivo': 'catalogo.csv', 'estado': 'ok', 'sha256': hashlib.sha256(raw).hexdigest(),
                    'consultado_utc': '2026-11-13T00:00:00+00:00', 'url': 'https://issste.test/catalogo.csv'}
            m = p / 'manifiesto.json'
            m.write_text(json.dumps(meta), encoding='utf8')
            validos, rechazados = procesar_issste(m)
            self.assertEqual((len(validos), len(rechazados)), (2, 1))
            self.assertEqual([x['clave'] for x in validos], ['001', '001'])
            self.assertEqual({x['nivel_atencion'] for x in validos}, {'1er Nivel', '2do Nivel'})

    def test_conflicto_de_correspondencias_no_elige_una_clave(self):
        oferta = pd.DataFrame([{'url':'https://a.test/1', 'fecha_utc':'2026-01-01T00:00:00+00:00',
            'producto':'Guantes', 'fuente':'a', 'precio':100.0, 'categoria':'guantes', 'sha256':'a'*64}])
        comunes = {'url':'https://a.test/1', 'sha256':'a'*64, 'estado_revision':'revisada',
                   'tipo_relacion':'exacta', 'apta_plata':'si'}
        relaciones = [{**comunes, 'clave_issste':'001'}, {**comunes, 'clave_issste':'002'}]
        oro, _, _ = construir_oro(oferta, [], relaciones)
        self.assertEqual(oro.iloc[0]['clave_issste_verificada'], '')
        self.assertEqual(oro.iloc[0]['estado_vinculo_issste'], 'conflicto_correspondencias')

    def test_oro_reduce_historial_y_no_inventa_precio_catalogo(self):
        ofertas = pd.DataFrame([
            {'url': 'https://a.test/1', 'fecha_utc': '2026-01-01T00:00:00+00:00', 'producto': 'Guantes',
             'fuente': 'a', 'precio': 100.0, 'categoria': 'guantes', 'sha256': 'a'*64},
            {'url': 'https://a.test/1', 'fecha_utc': '2026-01-02T00:00:00+00:00', 'producto': 'Guantes',
             'fuente': 'a', 'precio': 120.0, 'categoria': 'guantes', 'sha256': 'b'*64}])
        catalogo = [{'clave': '001', 'descripcion': 'Gasas', 'nivel_atencion': '1er Nivel',
                     'unidad': 'PIEZA', 'fuente': 'ISSSTE', 'fecha_utc': '2026-01-01T00:00:00+00:00',
                     'sha256': 'c'*64}]
        oro, metricas, reduccion = construir_oro(ofertas, catalogo, [])
        self.assertEqual(len(oro), 2)
        venta = oro[oro['tipo_registro'] == 'oferta_comercial'].iloc[0]
        oficial = oro[oro['tipo_registro'] == 'catalogo_issste'].iloc[0]
        self.assertEqual(venta['precio_observado_mxn'], 120.0)
        self.assertTrue(pd.isna(oficial['precio_observado_mxn']))
        self.assertEqual(reduccion['observaciones_comerciales_entrada'], 2)
        self.assertEqual(reduccion['ofertas_comerciales_oro'], 1)
        self.assertEqual(len(metricas), 2)
