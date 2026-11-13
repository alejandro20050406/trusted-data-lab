import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from src.correspondencias import cargar_catalogo, generar_correspondencias


class CorrespondenciasTest(unittest.TestCase):
    def test_relacion_es_candidata_y_conserva_estado_de_calidad(self):
        filas = [{'fuente': 'tienda', 'url': 'https://ejemplo.test/p', 'producto': 'Resina 4 g',
                  'fecha_utc': '2026-01-01T00:00:00+00:00', 'sha256': 'a' * 64}]
        ref = [{'fuente': 'tienda', 'url': 'https://ejemplo.test/p', 'producto_esperado': 'Resina 4 g',
                'clave_issste': '001', 'estado_revision': 'pendiente', 'tipo_relacion': 'candidato_parcial',
                'coincidencias': 'resina', 'diferencias': 'kit frente a pieza', 'evidencia': 'descripciones',
                'revisor': '', 'fecha_revision': ''}]
        catalogo = {'001': {'CLAVE': '001', 'DESCRIPCION': 'kit de resina', 'UNIDAD DE PRESENTACION': 'KIT'}}
        resultado = generar_correspondencias(filas, [], catalogo, ref, 'b' * 64)
        self.assertEqual(resultado[0]['tipo_relacion'], 'candidato_parcial')
        self.assertEqual(resultado[0]['estado_revision'], 'pendiente')
        self.assertEqual(resultado[0]['apta_plata'], 'no')
        self.assertEqual(resultado[0]['clave_issste'], '001')
        self.assertNotIn('precio', resultado[0])
        ref[0].update(estado_revision='revisada', tipo_relacion='exacta', revisor='Revisor',
                      fecha_revision='2026-01-01', sha256_producto_revisado='c' * 64,
                      sha256_catalogo_revisado='b' * 64)
        obsoleta = generar_correspondencias(filas, filas, catalogo, ref, 'b' * 64)[0]
        self.assertEqual(obsoleta['estado_revision'], 'pendiente_revalidacion')
        self.assertEqual(obsoleta['tipo_relacion'], 'candidato_parcial')
        filas[0]['producto'] = 'Otro producto'
        self.assertEqual(generar_correspondencias(filas, [], catalogo, ref, 'b' * 64)[0]['tipo_relacion'], 'sin_candidato')

    def test_integridad_del_catalogo_y_clave_textual(self):
        with tempfile.TemporaryDirectory() as temp:
            carpeta = Path(temp)
            datos = 'CLAVE,DESCRIPCION,UNIDAD DE PRESENTACION\n001,Resina,KIT\n'.encode('cp1252')
            (carpeta / 'catalogo.csv').write_bytes(datos)
            m = {'estado': 'ok', 'archivo': 'catalogo.csv', 'sha256': hashlib.sha256(datos).hexdigest()}
            (carpeta / 'manifiesto.json').write_text(json.dumps(m), encoding='utf-8')
            catalogo, _ = cargar_catalogo(carpeta / 'manifiesto.json')
            self.assertIn('001', catalogo)
            (carpeta / 'catalogo.csv').write_bytes(datos + b'x')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                cargar_catalogo(carpeta / 'manifiesto.json')
