"""Descarga acotada de fuentes oficiales; conserva los archivos originales."""
import csv
import datetime as dt
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import urllib.request
import zipfile
import openpyxl

INEGI = 'https://www.inegi.org.mx/contenidos/programas/inpc/2018a/datosabiertos/conjunto_de_datos_inpc_indicador_mensual_csv.zip'
CONEVAL = 'https://www.coneval.org.mx/Medicion/Documents/Lineas_de_Pobreza_por_Ingresos/Lineas_de_Pobreza_por_Ingresos.zip'
CSV = 'conjunto_de_datos/conjunto_de_datos_inpc_mensual.csv'


def validar_inegi(datos):
    with zipfile.ZipFile(io.BytesIO(datos)) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP INEGI corrupto')
        with z.open(CSV) as f:
            lector = csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig', newline=''))
            if not {'FECHA', 'VALOR', 'PERIODICIDAD'}.issubset(lector.fieldnames or []):
                raise ValueError('Columnas INEGI inesperadas')
            fechas = {fila['FECHA'][:7] for fila in lector if fila['PERIODICIDAD'] == 'Mensual' and fila['FECHA'] and fila['VALOR']}
    if len(fechas) < 36:
        raise ValueError(f'Solo se encontraron {len(fechas)} periodos mensuales')
    return {'periodos': len(fechas), 'primero': min(fechas), 'ultimo': max(fechas)}


def validar_coneval(datos):
    with zipfile.ZipFile(io.BytesIO(datos)) as z:
        if z.testzip() is not None:
            raise ValueError('ZIP CONEVAL corrupto')
        archivos = [n for n in z.namelist() if n.lower().endswith('.xlsx')]
        if len(archivos) != 1:
            raise ValueError('Se esperaba una hoja de cálculo CONEVAL')
        libro = openpyxl.load_workbook(io.BytesIO(z.read(archivos[0])), read_only=True, data_only=True)
        try:
            fechas = set()
            for fila in libro.worksheets[0].iter_rows(values_only=True):
                if len(fila) >= 8 and isinstance(fila[5], (dt.date, dt.datetime)) and all(isinstance(fila[i], (int, float)) and fila[i] > 0 for i in (6, 7)):
                    fechas.add(fila[5].strftime('%Y-%m'))
        finally:
            libro.close()
    if len(fechas) < 36:
        raise ValueError(f'Solo se encontraron {len(fechas)} periodos de canasta alimentaria')
    return {'periodos': len(fechas), 'primero': min(fechas), 'ultimo': max(fechas)}


def descargar(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'TrustedDataLab-E0/1.0 (investigacion academica)'})
    with urllib.request.urlopen(req, timeout=120) as respuesta:
        if respuesta.status != 200:
            raise ValueError(f'HTTP {respuesta.status}')
        return respuesta.read()


def main():
    destino = Path(os.environ.get('BRONCE_DIR', 'datos/bronce'))
    destino.mkdir(parents=True, exist_ok=True)
    resultados = []
    for nombre, url, ruta in [('inegi', INEGI, 'inegi/inpc_mensual.zip'), ('coneval', CONEVAL, 'coneval/lineas_pobreza.zip')]:
        try:
            datos = descargar(url)
            info = validar_inegi(datos) if nombre == 'inegi' else validar_coneval(datos)
            temporal = destino / (ruta + '.tmp')
            temporal.parent.mkdir(parents=True, exist_ok=True)
            temporal.write_bytes(datos)
            try:
                temporal.replace(destino / ruta)
            finally:
                temporal.unlink(missing_ok=True)
            resultados.append({'fuente': nombre, 'url': url, 'archivo': ruta, 'sha256': hashlib.sha256(datos).hexdigest(), 'bytes': len(datos), 'consultado_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'estado': 'ok', **info})
            print(f'{nombre}: descarga validada')
        except (OSError, ValueError, zipfile.BadZipFile) as exc:
            resultados.append({'fuente': nombre, 'url': url, 'estado': 'error', 'detalle': str(exc), 'consultado_utc': dt.datetime.now(dt.timezone.utc).isoformat()})
            print(f'{nombre}: ERROR: {exc}', file=sys.stderr)
    (destino / 'manifiesto.json').write_text(json.dumps(resultados, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return 1 if any(x['estado'] != 'ok' for x in resultados) else 0


if __name__ == '__main__':
    sys.exit(main())
