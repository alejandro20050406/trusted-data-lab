import unittest
import pandas as pd
from src.preprocesamiento_e1 import categoria_producto, enriquecer, estimar_faltantes, validar_imputacion, diagnosticar_faltantes


def registros():
    return [{'url': f'https://imdent.com/stores/a/products/{i}', 'tienda_imdent': 'a',
             'fuente': 'imdent_catalogo', 'fecha_utc': '2026-11-13T00:00:00+00:00',
             'producto': f'Guantes de nitrilo {i}', 'precio': float(100 + i)}
            for i in range(30)]


class PreprocesamientoE1Test(unittest.TestCase):
    def test_diagnostico_cuenta_faltantes_por_fuente_y_categoria(self):
        filas = registros()[:2]
        filas[0]['precio'] = None
        resultado = diagnosticar_faltantes(filas)
        self.assertEqual(resultado[0]['total'], 2)
        self.assertEqual(resultado[0]['precio_faltante'], 1)
        self.assertEqual(resultado[0]['porcentaje_faltante'], 50.0)

    def test_fecha_grupo_convertida_a_utc(self):
        filas = registros()[:1]
        filas[0]['fecha_utc'] = '2026-11-13T00:30:00+02:00'
        self.assertEqual(enriquecer(pd.DataFrame(filas)).iloc[0]['fecha_grupo'], '2026-11-12')

    def test_categorias_no_confunden_medicamento(self):
        self.assertEqual(categoria_producto('Guantes de nitrilo'), 'guantes')
        self.assertEqual(categoria_producto('Resina dental 4g'), 'resinas')
        self.assertEqual(categoria_producto('Desmopresina solución'), 'sin_clasificar')
        self.assertEqual(categoria_producto('Fresa de carburo dental'), 'fresas_rotatorias')
        self.assertEqual(categoria_producto('Fresero de plástico'), 'sin_clasificar')
        self.assertEqual(categoria_producto('Ionómero de vidrio'), 'ionomeros')

    def test_estadisticas_y_atipicos_conservan_el_precio(self):
        filas = registros()
        filas[-1]['precio'] = 9999.0
        df = enriquecer(pd.DataFrame(filas))
        self.assertEqual(df.iloc[-1]['precio'], 9999.0)
        self.assertTrue(bool(df.iloc[-1]['atipico_iqr_grupo']))
        self.assertLess(df.iloc[-1]['precio_suavizado_exploratorio'], 9999.0)
        self.assertTrue(df['precio_minmax_grupo'].notna().all())
        self.assertTrue(df['precio_zscore_grupo'].notna().all())

    def test_imputacion_separa_estimaciones_de_registros_invalidos(self):
        df = enriquecer(pd.DataFrame(registros()))
        base = {'url': 'https://imdent.com/stores/a/products/faltante',
                'fuente': 'imdent_catalogo', 'fecha_utc': '2026-11-13T03:00:00+00:00',
                'producto': 'Guantes de nitrilo', 'precio': None, 'moneda': ''}
        rechazados = [{'registro': base, 'registro_origen': 'prod-x', 'motivo': 'precio ausente'}]
        estimaciones = estimar_faltantes(df, rechazados)
        self.assertEqual(len(estimaciones), 1)
        self.assertTrue(estimaciones[0]['es_imputado'])
        self.assertEqual(estimaciones[0]['metodo'], 'mediana_tienda_categoria_dia')
        self.assertEqual(estimaciones[0]['precio_estimado_mxn'], 114.5)
        self.assertEqual(estimaciones[0]['diagnostico_confiabilidad'], 'revision_manual')
        self.assertIn('no es precio publicado', estimaciones[0]['advertencia'])
        self.assertIsNone(base['precio'])

    def test_imputa_con_precio_anterior_de_la_misma_ficha(self):
        anterior = registros()[:1]
        df = enriquecer(pd.DataFrame(anterior))
        falta = {**anterior[0], 'fecha_utc':'2026-11-14T00:00:00+00:00', 'precio':None}
        salida = estimar_faltantes(df, [{'registro':falta, 'motivo':'sin precio'}])
        self.assertEqual(salida[0]['metodo'], 'ultima_observacion_misma_url_7d')
        self.assertEqual(salida[0]['precio_estimado_mxn'], 100.0)
        self.assertEqual(salida[0]['fecha_observacion_referencia'], anterior[0]['fecha_utc'])

    def test_no_usa_precio_futuro_ni_historico_vencido(self):
        referencia = registros()[0]
        df = enriquecer(pd.DataFrame([referencia]))
        for fecha in ('2026-11-12T00:00:00+00:00', '2026-11-21T00:00:00+00:00'):
            falta = {**referencia, 'fecha_utc': fecha, 'precio': None}
            resultado = estimar_faltantes(df, [{'registro': falta, 'motivo': 'sin precio'}])[0]
            self.assertFalse(resultado['es_imputado'])
            self.assertIsNone(resultado['precio_estimado_mxn'])

    def test_validacion_historica_usa_solo_precio_anterior(self):
        primera = registros()[0]
        segunda = {**primera, 'fecha_utc':'2026-11-14T00:00:00+00:00', 'precio':110.0}
        df = enriquecer(pd.DataFrame([primera, segunda]))
        salida = [x for x in validar_imputacion(df) if x['metodo'] == 'ultima_observacion_misma_url_7d']
        self.assertEqual(len(salida), 1)
        self.assertEqual(salida[0]['precio_estimado_validacion'], 100.0)
        self.assertEqual(salida[0]['precio_observado'], 110.0)

    def test_validacion_oculta_datos_y_no_usa_la_misma_url(self):
        df = enriquecer(pd.DataFrame(registros()))
        resultados = validar_imputacion(df)
        self.assertGreater(len(resultados), 0)
        self.assertTrue(all(x['n_entrenamiento'] >= 10 for x in resultados))
        self.assertTrue(all(x['metodo'] == 'mediana_tienda_categoria_dia' for x in resultados))

    def test_grupos_pequenos_no_tienen_estadisticas_ni_imputacion(self):
        df = enriquecer(pd.DataFrame(registros()[:2]))
        self.assertTrue(df['precio_minmax_grupo'].isna().all())
        self.assertTrue(df['atipico_iqr_grupo'].isna().all())
        r = {'registro': {'url': 'https://imdent.com/stores/a/products/x', 'fuente': 'imdent_catalogo',
                          'fecha_utc': '2026-11-13T00:00:00+00:00', 'producto': 'Guantes',
                          'precio': None}, 'motivo': 'falta'}
        self.assertIsNone(estimar_faltantes(df, [r])[0]['precio_estimado_mxn'])
