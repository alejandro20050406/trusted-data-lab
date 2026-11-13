import hashlib
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
from scripts.captura_insumos import ROBOTS_URL, capturar, verificar_robots

CSV = (b"CLAVE,DESCRIPCION,UNIDAD DE PRESENTACION,NIVEL DE ATENCION,GRUPO TERAPEUTICO,INDICACIONES\r\n"
       b"123,Gasas,Paquete,Primero,Curacion,Uso medico\r\n")

class CapturaIsssteTest(unittest.TestCase):
    @patch("scripts.captura_insumos.verificar_robots", return_value="permitido")
    @patch("scripts.captura_insumos.obtener")
    def test_conserva_original_y_huella(self, obtener, robots):
        obtener.return_value = CSV
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "captura"
            resultado = capturar(destino)
            self.assertEqual(resultado["estado"], "ok")
            self.assertEqual(resultado["registros"], 1)
            self.assertEqual((destino / resultado["archivo"]).read_bytes(), CSV)
            self.assertEqual(resultado["sha256"], hashlib.sha256(CSV).hexdigest())
            self.assertEqual(json.loads((destino / "manifiesto.json").read_text(encoding="utf-8")), resultado)

    @patch("scripts.captura_insumos.verificar_robots", return_value="permitido")
    @patch("scripts.captura_insumos.obtener", return_value=b"<html>error</html>")
    def test_rechaza_respuesta_que_no_es_catalogo(self, obtener, robots):
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "captura"
            self.assertEqual(capturar(destino)["estado"], "error")
            self.assertFalse((destino / "catalogoinsumos.csv").exists())

    @patch("scripts.captura_insumos.obtener")
    def test_robots_denegado_impide_captura(self, obtener):
        obtener.return_value = b"User-agent: *\nDisallow: /datosabiertos/"
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(capturar(Path(tmp) / "captura")["estado"], "error")
            self.assertEqual(obtener.call_count, 1)

    @patch("scripts.captura_insumos.obtener")
    def test_robots_404_se_registra_como_ausente(self, obtener):
        obtener.side_effect = urllib.error.HTTPError(ROBOTS_URL, 404, "Not Found", {}, None)
        self.assertIn("404", verificar_robots())

    @patch("scripts.captura_insumos.obtener")
    def test_robots_403_no_es_autorizacion(self, obtener):
        obtener.side_effect = urllib.error.HTTPError(ROBOTS_URL, 403, "Forbidden", {}, None)
        with self.assertRaises(urllib.error.HTTPError):
            verificar_robots()
