import io
import unittest
import zipfile
import datetime as dt
import openpyxl
from scripts.captura import validar_coneval, validar_inegi


def archivo(fechas):
    f = io.BytesIO()
    with zipfile.ZipFile(f, 'w') as z:
        contenido = 'COBERTURA,PERIODICIDAD,FECHA,CONCEPTO,VALOR,UNIDAD_MEDIDA,ESTATUS\n'
        contenido += ''.join(f'Nacional,Mensual,{fecha},INPC,100,Índice,Definitiva\n' for fecha in fechas)
        z.writestr('conjunto_de_datos/conjunto_de_datos_inpc_mensual.csv', contenido)
    return f.getvalue()


class Validacion(unittest.TestCase):
    def test_rechaza_menos_de_36_periodos_distintos(self):
        with self.assertRaises(ValueError):
            validar_inegi(archivo(['2024-01-01'] * 40))

    def test_acepta_36_periodos_mensuales(self):
        fechas = [f'{a}-{m:02d}-01' for a in range(2021, 2024) for m in range(1, 13)]
        self.assertEqual(validar_inegi(archivo(fechas))['periodos'], 36)

    def test_rechaza_zip_invalido(self):
        with self.assertRaises((ValueError, zipfile.BadZipFile)):
            validar_inegi(b'archivo invalido')

    def test_coneval_exige_36_meses_con_valores_urbano_y_rural(self):
        libro = openpyxl.Workbook()
        hoja = libro.active
        for anio in range(2021, 2024):
            for mes in range(1, 13):
                hoja.append([None, None, None, anio, None, dt.datetime(anio, mes, 1), 100, 120])
        xlsx = io.BytesIO()
        libro.save(xlsx)
        contenedor = io.BytesIO()
        with zipfile.ZipFile(contenedor, 'w') as z:
            z.writestr('datos.xlsx', xlsx.getvalue())
        self.assertEqual(validar_coneval(contenedor.getvalue())['periodos'], 36)

    def test_coneval_rechaza_estructura_incorrecta(self):
        with self.assertRaises(ValueError):
            validar_coneval(archivo(['2025-01-01']))
