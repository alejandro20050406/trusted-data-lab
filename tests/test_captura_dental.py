import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
from scripts.captura_dental import capturar, permitido, validar_html


class CapturaDentalTest(unittest.TestCase):
    def test_robots_deniega_ruta(self):
        self.assertFalse(permitido('User-agent: *\nDisallow: /privado', 'https://ejemplo.test/privado/x'))
        self.assertTrue(permitido('User-agent: *\nDisallow: /privado', 'https://ejemplo.test/producto'))

    def test_rechaza_pagina_sin_precio(self):
        with self.assertRaises(ValueError):
            validar_html(b'<html>servicio no disponible</html>')

    @patch('scripts.captura_dental.obtener')
    def test_captura_guarda_original_y_metadatos(self, obtener):
        obtener.side_effect = [
            (b'User-agent: *\nAllow: /', 'text/plain', 'https://ejemplo.test/robots.txt'),
            (b'<html>Precio $240.00 MXN</html>', 'text/html', 'https://ejemplo.test/producto'),
        ]
        fuentes = [{'id': 'ejemplo', 'url': 'https://ejemplo.test/producto'}]
        with tempfile.TemporaryDirectory() as carpeta:
            resultados = capturar(Path(carpeta), fuentes)
            self.assertEqual(resultados[0]['estado'], 'ok')
            ruta = Path(carpeta) / resultados[0]['archivo']
            self.assertEqual(ruta.read_bytes(), b'<html>Precio $240.00 MXN</html>')
            self.assertEqual(len(resultados[0]['sha256']), 64)

    @patch('scripts.captura_dental.obtener')
    def test_no_descarga_producto_si_robots_lo_prohibe(self, obtener):
        obtener.return_value = (b'User-agent: *\nDisallow: /producto', 'text/plain', 'https://ejemplo.test/robots.txt')
        with tempfile.TemporaryDirectory() as carpeta:
            resultados = capturar(Path(carpeta), [{'id': 'ejemplo', 'url': 'https://ejemplo.test/producto'}])
            self.assertEqual(resultados[0]['estado'], 'error')
            self.assertEqual(obtener.call_count, 1)

    @patch('scripts.captura_dental.obtener')
    def test_registra_si_el_error_ocurre_en_robots(self, obtener):
        obtener.side_effect = urllib.error.URLError('fallo TLS')
        with tempfile.TemporaryDirectory() as carpeta:
            resultado = capturar(Path(carpeta), [{'id': 'ejemplo', 'url': 'https://ejemplo.test/producto'}])
            self.assertEqual(resultado[0]['etapa_error'], 'robots')
