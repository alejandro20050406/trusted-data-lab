import tempfile
import unittest
from pathlib import Path

from scripts.recoleccion_resiliente import recolectar


class RecoleccionResilienteTests(unittest.TestCase):
    def test_recupera_fallo_transitorio_sin_publicar_intento_parcial(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            llamadas = []

            def fuente(destino):
                destino.mkdir(parents=True)
                llamadas.append(destino)
                (destino / 'manifiesto.json').write_text('completa' if len(llamadas) == 2 else 'parcial')
                return len(llamadas) == 2

            pausas = []
            self.assertTrue(recolectar({'dental': (fuente, root / 'bronce')}, root / 'intentos',
                                      esperas=(1,), dormir=pausas.append))
            publicados = list((root / 'bronce').glob('*/manifiesto.json'))
            self.assertEqual([p.read_text() for p in publicados], ['completa'])
            self.assertEqual(len(list((root / 'intentos').glob('**/manifiesto.json'))), 2)
            self.assertEqual(pausas, [1])

    def test_agotamiento_falla_y_no_publica_datos_parciales(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def fuente(destino):
                destino.mkdir(parents=True)
                (destino / 'manifiesto.json').write_text('parcial')
                return False
            self.assertFalse(recolectar({'dental': (fuente, root / 'bronce')}, root / 'intentos',
                                       esperas=(1,), dormir=lambda _: None))
            self.assertFalse((root / 'bronce').exists())

    def test_no_repite_fuente_que_ya_se_recupero(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            llamadas = {'buena': 0, 'mala': 0}
            def fuente(nombre):
                def ejecutar(destino):
                    destino.mkdir(parents=True)
                    llamadas[nombre] += 1
                    return nombre == 'buena'
                return ejecutar
            self.assertFalse(recolectar({n: (fuente(n), root / n) for n in llamadas}, root / 'intentos',
                                       esperas=(1, 2), dormir=lambda _: None))
            self.assertEqual(llamadas, {'buena': 1, 'mala': 3})


if __name__ == '__main__':
    unittest.main()
