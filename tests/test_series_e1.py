import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from scripts.captura_ipc_salud import validar_csv
from src import series_e1 as s


def serie_sintetica(meses=96, semilla=7):
    """Índice con tendencia, estacionalidad multiplicativa de enero y ruido pequeño."""
    rng = np.random.default_rng(semilla)
    fechas = pd.date_range("2015-01-01", periods=meses, freq="MS")
    tendencia = 100 * 1.004 ** np.arange(meses)
    estacional = np.where(fechas.month == 1, 1.01, 1.0)
    return pd.Series(tendencia * estacional * (1 + rng.normal(0, 0.0005, meses)), index=fechas)


def csv_ocde(serie_salud, serie_general):
    filas = ["REF_AREA,FREQ,EXPENDITURE,TIME_PERIOD,OBS_VALUE"]
    for clave, serie in (("CP06", serie_salud), ("_T", serie_general)):
        filas += [f"MEX,M,{clave},{f:%Y-%m},{v:.4f}" for f, v in serie.items()]
    return ("\n".join(filas) + "\n").encode("utf-8")


class CapturaTest(unittest.TestCase):
    def test_valida_series_y_minimo_de_periodos(self):
        y = serie_sintetica(40)
        resumen = validar_csv(csv_ocde(y, y))
        self.assertEqual(resumen["CP06"]["periodos"], 40)
        with self.assertRaises(ValueError):
            validar_csv(csv_ocde(y.iloc[:30], y))

    def test_rechaza_indices_no_positivos(self):
        y = serie_sintetica(40)
        y.iloc[3] = 0
        with self.assertRaises(ValueError):
            validar_csv(csv_ocde(y, y))


class SeriesTest(unittest.TestCase):
    def test_carga_verifica_hash(self):
        y = serie_sintetica(40)
        with tempfile.TemporaryDirectory() as tmp:
            carpeta = Path(tmp)
            datos = csv_ocde(y, y * 0.98)
            (carpeta / "ipc.csv").write_bytes(datos)
            manifiesto = {"estado": "ok", "archivo": "ipc.csv", "sha256": hashlib.sha256(datos).hexdigest()}
            (carpeta / "manifiesto.json").write_text(json.dumps(manifiesto), encoding="utf-8")
            tabla = s.cargar_series(carpeta)
            self.assertEqual(list(tabla.columns), ["salud", "general"])
            self.assertEqual(len(tabla), 40)
            (carpeta / "ipc.csv").write_bytes(datos + b"MEX,M,CP06,2030-01,1\n")
            with self.assertRaises(ValueError):
                s.cargar_series(carpeta)

    def test_metricas(self):
        m = s.metricas([100, 200], [110, 190])
        self.assertAlmostEqual(m["MAE"], 10)
        self.assertAlmostEqual(m["RMSE"], 10)
        self.assertAlmostEqual(m["MAPE"], 7.5)

    def test_diferenciar_quita_tendencia_y_estacionalidad(self):
        y = serie_sintetica()
        self.assertEqual(len(s.diferenciar(y, 1, 1)), len(y) - 13)
        self.assertEqual(len(s.diferenciar(y, 2, 0)), len(y) - 2)

    def test_eleccion_de_diferenciacion_es_la_menor_estacionaria(self):
        (d, D), tabla = s.elegir_diferenciacion(serie_sintetica())
        self.assertFalse(tabla[0]["estacionaria"])  # el nivel con tendencia no es estacionario
        primera = next(f for f in tabla if f["estacionaria"])
        self.assertEqual((d, D), (primera["d"], primera["D"]))

    def test_puerta_descarta_modelo_con_residuos_autocorrelacionados(self):
        class Falso:
            def __init__(self, residuos):
                self.resid = residuos
                self.model = type("M", (), {"data": type("D", (), {"row_labels": residuos.index})()})()

        fechas = pd.date_range("2010-01-01", periods=120, freq="MS")
        rng = np.random.default_rng(1)
        ruido = pd.Series(rng.normal(size=120), index=fechas)
        caminata = ruido.cumsum()  # muy autocorrelacionada
        modelos = {"Holt": Falso(caminata), "SARIMA": Falso(ruido)}
        tabla = pd.DataFrame({"modelo": ["Holt", "SARIMA"], "RMSE": [1.0, 2.0]})
        menor, publicado, _ = s.aplicar_puerta_supuestos(tabla, modelos)
        self.assertEqual(menor, "Holt")
        self.assertEqual(publicado, "SARIMA")

    def test_pronostico_holt_winters_es_reproducible_y_contiene_el_punto(self):
        y = serie_sintetica()
        _, a = s.pronosticar("Holt-Winters", y, (0, 1, 1, 0, 1, 1), simulaciones=300)
        _, b = s.pronosticar("Holt-Winters", y, (0, 1, 1, 0, 1, 1), simulaciones=300)
        pd.testing.assert_frame_equal(a, b)
        self.assertEqual(len(a), s.HORIZONTE_FUTURO)
        self.assertTrue((a.limite_inferior_95 <= a.pronostico).all())
        self.assertTrue((a.pronostico <= a.limite_superior_95).all())

    def test_cuatro_modelos_se_comparan_en_prueba(self):
        y = serie_sintetica()
        entrenamiento, prueba = s.separar(y)
        modelos = s.ajustar_modelos(entrenamiento, (0, 1, 1, 0, 1, 1))
        tabla, pronosticos = s.comparar_en_prueba(modelos, prueba)
        self.assertEqual(set(tabla.modelo), {"Suavizamiento simple", "Holt", "Holt-Winters", "SARIMA"})
        self.assertTrue(tabla.RMSE.is_monotonic_increasing)
        self.assertEqual(len(pronosticos), len(prueba))


if __name__ == "__main__":
    unittest.main()
