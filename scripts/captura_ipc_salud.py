"""Captura Bronce de la serie histórica mensual del índice de precios de salud en México.

Fuente: OCDE, conjunto DSD_PRICES@DF_PRICES_ALL (los datos de México provienen del INPC de INEGI).
Se descargan dos series mensuales, base 2015 = 100:
- CP06: división "Salud" de la clasificación COICOP (medicamentos, material de curación,
  aparatos terapéuticos y servicios médicos). Es la variable que se pronostica en E1.
- _T: índice general, usado como segunda variable para la correlación cruzada.

El archivo original se guarda sin modificar junto con un manifiesto (URL, fecha, SHA-256).
"""
import csv
import datetime as dt
import hashlib
import io
import json
import sys
import urllib.error
import urllib.request
import urllib.robotparser
from pathlib import Path

AGENTE = "TrustedDataLabAcademic/1.0"
URL = ("https://sdmx.oecd.org/public/rest/data/OECD.SDD.TPS,DSD_PRICES@DF_PRICES_ALL,1.0/"
       "MEX.M.N.CPI.IX.CP06+_T.N._Z")
ROBOTS_URL = "https://sdmx.oecd.org/robots.txt"
ACEPTA = "application/vnd.sdmx.data+csv; charset=utf-8"
LIMITE = 5_000_000
COLUMNAS = {"REF_AREA", "FREQ", "EXPENDITURE", "TIME_PERIOD", "OBS_VALUE"}
SERIES = {"CP06", "_T"}
MINIMO_PERIODOS = 36


def obtener(url, limite, acepta=None):
    encabezados = {"User-Agent": AGENTE}
    if acepta:
        encabezados["Accept"] = acepta
    solicitud = urllib.request.Request(url, headers=encabezados)
    with urllib.request.urlopen(solicitud, timeout=120) as respuesta:
        datos = respuesta.read(limite + 1)
    if len(datos) > limite:
        raise ValueError("La respuesta excede el límite")
    return datos


def verificar_robots():
    try:
        texto = obtener(ROBOTS_URL, 1_000_000).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return "robots.txt ausente (HTTP 404); no hay restricción publicada"
        raise
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(texto.splitlines())
    if not parser.can_fetch(AGENTE, URL):
        raise ValueError("robots.txt no permite la descarga")
    return "robots.txt permite la descarga"


def validar_csv(datos):
    """Comprueba columnas, series y que cada serie tenga al menos 36 periodos numéricos."""
    lector = csv.DictReader(io.StringIO(datos.decode("utf-8-sig"), newline=""))
    faltan = COLUMNAS - set(lector.fieldnames or [])
    if faltan:
        raise ValueError(f"Columnas faltantes: {sorted(faltan)}")
    periodos = {serie: set() for serie in SERIES}
    for fila in lector:
        if fila["REF_AREA"] != "MEX" or fila["FREQ"] != "M":
            raise ValueError("Registro fuera de México o no mensual")
        if fila["EXPENDITURE"] not in SERIES:
            raise ValueError(f"Serie inesperada: {fila['EXPENDITURE']}")
        valor = float(fila["OBS_VALUE"])
        if not valor > 0:
            raise ValueError("Índice no positivo")
        periodos[fila["EXPENDITURE"]].add(fila["TIME_PERIOD"])
    resumen = {}
    for serie, fechas in periodos.items():
        if len(fechas) < MINIMO_PERIODOS:
            raise ValueError(f"La serie {serie} tiene {len(fechas)} periodos (< {MINIMO_PERIODOS})")
        resumen[serie] = {"periodos": len(fechas), "inicio": min(fechas), "fin": max(fechas)}
    return resumen


def capturar(destino):
    destino.mkdir(parents=True, exist_ok=False)
    info = {"fuente": "OCDE - Consumer price indices (DSD_PRICES@DF_PRICES_ALL), México",
            "origen_primario": "INEGI - Índice Nacional de Precios al Consumidor",
            "url": URL, "consultado_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "licencia": "Términos de uso de datos de la OCDE: reutilización permitida con atribución",
            "series": {"CP06": "Salud (COICOP 06), índice 2015=100",
                       "_T": "Índice general, 2015=100"}}
    try:
        info["robots"] = verificar_robots()
        datos = obtener(URL, LIMITE, ACEPTA)
        info["cobertura"] = validar_csv(datos)
        nombre = "ipc_mexico_ocde.csv"
        (destino / nombre).write_bytes(datos)
        info.update(estado="ok", archivo=nombre, bytes=len(datos),
                    sha256=hashlib.sha256(datos).hexdigest())
    except (OSError, ValueError, UnicodeError, csv.Error) as error:
        info.update(estado="error", detalle=str(error))
    (destino / "manifiesto.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return info


def main():
    fecha = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destino = Path("datos/bronce/ipc_salud") / fecha
    resultado = capturar(destino)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    print(f"Captura: {destino}")
    return 0 if resultado["estado"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
