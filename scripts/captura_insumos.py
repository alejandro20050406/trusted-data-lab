"""Captura Bronce del catálogo institucional de insumos del ISSSTE."""
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
URL = "https://www.issste.gob.mx/datosabiertos/catalogoinsumos.csv"
ROBOTS_URL = "https://www.issste.gob.mx/robots.txt"
LIMITE = 20_000_000
CAMPOS = ("CLAVE", "DESCRIPCION", "UNIDAD DE PRESENTACION", "NIVEL DE ATENCION", "GRUPO TERAPEUTICO", "INDICACIONES")


def obtener(url, limite):
    solicitud = urllib.request.Request(url, headers={"User-Agent": AGENTE})
    with urllib.request.urlopen(solicitud, timeout=120) as respuesta:
        if respuesta.geturl() != url:
            raise ValueError("Redirección no autorizada: revisar la fuente")
        datos = respuesta.read(limite + 1)
    if len(datos) > limite:
        raise ValueError("La respuesta excede el límite")
    return datos


def verificar_robots():
    try:
        texto = obtener(ROBOTS_URL, 1_000_000).decode("utf-8")
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return "robots.txt ausente (HTTP 404)"
        raise
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(texto.splitlines())
    if not parser.can_fetch(AGENTE, URL):
        raise ValueError("robots.txt no permite la descarga")
    return "robots.txt permite la descarga"


def validar_csv(datos):
    # El archivo oficial contiene texto en codificación Windows-1252.
    texto = datos.decode("cp1252")
    lector = csv.reader(io.StringIO(texto, newline=""), strict=True)
    if tuple(next(lector, [])) != CAMPOS:
        raise ValueError("Encabezado del catálogo inesperado")
    cuenta = 0
    for fila in lector:
        if len(fila) != len(CAMPOS):
            raise ValueError("Registro con número de campos inesperado")
        cuenta += 1
    if cuenta == 0:
        raise ValueError("Catálogo sin registros")
    return cuenta


def capturar(destino):
    destino.mkdir(parents=True, exist_ok=False)
    info = {"fuente": "ISSSTE - Catálogo institucional de insumos",
            "url": URL, "consultado_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "ficha": "https://www.datos.gob.mx/dataset/catalogo_institucional_insumos",
            "licencia": "Creative Commons Atribución 4.0 según ficha de datos.gob.mx",
            "cobertura": "Catálogo institucional mexicano; no contiene precios ni disponibilidad en Colima"}
    try:
        info["robots"] = verificar_robots()
        datos = obtener(URL, LIMITE)
        registros = validar_csv(datos)
        nombre = "catalogoinsumos.csv"
        (destino / nombre).write_bytes(datos)
        info.update(estado="ok", archivo=nombre, bytes=len(datos),
                    sha256=hashlib.sha256(datos).hexdigest(), registros=registros,
                    codificacion="Windows-1252")
    except (OSError, ValueError, UnicodeError, csv.Error) as error:
        info.update(estado="error", detalle=str(error))
    (destino / "manifiesto.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return info


def main():
    fecha = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destino = Path("datos/bronce/issste_insumos") / fecha
    resultado = capturar(destino)
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    print(f"Captura: {destino}")
    return 0 if resultado["estado"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
