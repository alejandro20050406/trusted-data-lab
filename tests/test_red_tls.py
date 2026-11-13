import ssl
import unittest
import urllib.error
from unittest.mock import patch

from scripts.captura_dental import obtener


class ReintentosRedTest(unittest.TestCase):
    @patch('scripts.captura_dental.time.sleep')
    @patch('scripts.captura_dental._obtener_una_vez')
    def test_reintenta_eof_tls_y_conserva_respuesta(self, una_vez, dormir):
        eof = urllib.error.URLError(ssl.SSLEOFError(8, 'unexpected EOF'))
        esperado = (b'datos', 'text/html', 'https://ejemplo.test')
        una_vez.side_effect = [eof, esperado]
        self.assertEqual(obtener('https://ejemplo.test'), esperado)
        self.assertEqual(una_vez.call_count, 2)
        dormir.assert_called_once()

    @patch('scripts.captura_dental.time.sleep')
    @patch('scripts.captura_dental._obtener_una_vez')
    def test_no_reintenta_certificado_invalido_ni_403(self, una_vez, dormir):
        for error in (urllib.error.URLError(ssl.SSLCertVerificationError('certificado')),
                      urllib.error.HTTPError('https://ejemplo.test', 403, 'prohibido', {}, None)):
            una_vez.reset_mock()
            una_vez.side_effect = error
            with self.assertRaises(type(error)):
                obtener('https://ejemplo.test')
            self.assertEqual(una_vez.call_count, 1)
        dormir.assert_not_called()

    @patch('scripts.captura_dental.time.sleep')
    @patch('scripts.captura_dental._obtener_una_vez')
    def test_reintenta_503_pero_no_429(self, una_vez, dormir):
        temporal = urllib.error.HTTPError('https://ejemplo.test', 503, 'temporal', {}, None)
        limite = urllib.error.HTTPError('https://ejemplo.test', 429, 'limite', {}, None)
        esperado = (b'ok', 'text/plain', 'https://ejemplo.test')
        una_vez.side_effect = [temporal, esperado]
        self.assertEqual(obtener('https://ejemplo.test'), esperado)
        self.assertEqual(una_vez.call_count, 2)
        una_vez.reset_mock()
        dormir.reset_mock()
        una_vez.side_effect = limite
        with self.assertRaises(urllib.error.HTTPError):
            obtener('https://ejemplo.test')
        self.assertEqual(una_vez.call_count, 1)
        dormir.assert_not_called()

    @patch('scripts.captura_dental.time.sleep')
    @patch('scripts.captura_dental._obtener_una_vez')
    def test_agota_intentos_y_propaga_error(self, una_vez, dormir):
        una_vez.side_effect = urllib.error.URLError(ssl.SSLEOFError(8, 'unexpected EOF'))
        with self.assertRaises(urllib.error.URLError):
            obtener('https://ejemplo.test')
        self.assertEqual(una_vez.call_count, 4)
        self.assertEqual(dormir.call_count, 3)


if __name__ == '__main__':
    unittest.main()
