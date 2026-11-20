"""Captura mínima de nodos OSM y mapa reproducible con linaje a Bronce."""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

import geopandas as gpd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd

URL = 'https://overpass.kumi.systems/api/interpreter'
ROBOTS = 'https://overpass.kumi.systems/robots.txt'
AGENTE = 'TrustedDataLabAcademic/1.0 (academic research)'
CONSULTA = '[out:json][timeout:25];node["amenity"="dentist"](19.20,-103.78,19.30,-103.66);out skel;'


def capturar(destino):
    solicitud = urllib.request.Request(ROBOTS, headers={'User-Agent': AGENTE})
    try:
        with urllib.request.urlopen(solicitud, timeout=30) as respuesta:
            robots = respuesta.read(100000).decode('utf-8')
            estado = respuesta.status
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        robots, estado = '', 404
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(robots.splitlines())
    if estado == 200 and not parser.can_fetch(AGENTE, URL):
        raise ValueError('robots.txt no permite la consulta')
    url = URL + '?' + urllib.parse.urlencode({'data': CONSULTA})
    solicitud = urllib.request.Request(url, headers={'User-Agent': AGENTE, 'Accept': 'application/json'})
    with urllib.request.urlopen(solicitud, timeout=60) as respuesta:
        raw = respuesta.read(5000001)
    if len(raw) > 5000000:
        raise ValueError('Respuesta demasiado grande')
    datos = json.loads(raw)
    if 'remark' in datos or not isinstance(datos.get('elements'), list):
        raise ValueError('Respuesta Overpass incompleta')
    destino.mkdir(parents=True, exist_ok=False)
    (destino / 'osm.json').write_bytes(raw)
    meta = {'fuente': 'OpenStreetMap/Overpass', 'url': URL, 'consulta': CONSULTA,
            'consultado_utc': dt.datetime.now(dt.timezone.utc).isoformat(), 'archivo': 'osm.json',
            'sha256': hashlib.sha256(raw).hexdigest(), 'robots_url': ROBOTS, 'robots_http': estado,
            'robots_sha256': hashlib.sha256(robots.encode()).hexdigest() if estado == 200 else None}
    (destino / 'manifiesto.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')


def procesar(manifiesto, salida):
    manifiesto, salida = Path(manifiesto), Path(salida)
    meta = json.loads(manifiesto.read_text(encoding='utf-8'))
    if Path(meta['archivo']).name != meta['archivo']:
        raise ValueError('Archivo de Bronce inválido')
    archivo = manifiesto.parent / meta['archivo']
    raw = archivo.read_bytes()
    if hashlib.sha256(raw).hexdigest() != meta['sha256']:
        raise ValueError('SHA-256 de Bronce no coincide')
    fecha = dt.datetime.fromisoformat(meta['consultado_utc'].replace('Z', '+00:00'))
    if fecha.utcoffset() is None:
        raise ValueError('Fecha de ingesta sin zona horaria')
    elementos = json.loads(raw)['elements']
    filas, vistos = [], set()
    for elemento in elementos:
        ident = f"{elemento['type']}/{elemento['id']}"
        lat, lon = float(elemento['lat']), float(elemento['lon'])
        if elemento['type'] != 'node' or ident in vistos or not (19.20 <= lat <= 19.30 and -103.78 <= lon <= -103.66):
            raise ValueError('Nodo duplicado o fuera del área')
        vistos.add(ident)
        filas.append({'identificador': ident, 'latitud': lat, 'longitud': lon, 'fuente': 'OpenStreetMap',
                      'url': meta['url'], 'fecha_utc': meta['consultado_utc'], 'archivo_bronce': archivo.as_posix(),
                      'sha256': meta['sha256'], 'registro_origen': ident})
    if not filas:
        raise ValueError('Sin nodos para representar')
    salida.mkdir(parents=True, exist_ok=False)
    frame = pd.DataFrame(filas)
    frame.to_csv(salida / 'oro_dentistas_osm.csv', index=False, encoding='utf-8-sig')
    geo = gpd.GeoDataFrame(frame, geometry=gpd.points_from_xy(frame.longitud, frame.latitud), crs='EPSG:4326')
    fig, ax = plt.subplots(figsize=(8, 7))
    geo.to_crs('EPSG:32613').plot(ax=ax, color='#147d89', markersize=18)
    ax.set_title('Consultorios dentales mapeados en OpenStreetMap\nÁrea de Colima y Villa de Álvarez')
    ax.set_xlabel('Este (m, UTM 13N)'); ax.set_ylabel('Norte (m, UTM 13N)')
    fig.text(.02, .02, '© OpenStreetMap contributors | ODbL: openstreetmap.org/copyright\nCobertura incompleta; no representa todos los consultorios.', fontsize=8)
    fig.tight_layout(rect=(0, .06, 1, 1))
    fig.savefig(salida / 'mapa_dentistas_osm.png', dpi=150)
    plt.close(fig)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--capturar', type=Path)
    parser.add_argument('--manifiesto', type=Path)
    parser.add_argument('--salida', type=Path, required=True)
    args = parser.parse_args()
    if bool(args.capturar) == bool(args.manifiesto):
        parser.error('Indique exactamente uno de --capturar o --manifiesto')
    if args.capturar:
        capturar(args.capturar)
    procesar((args.capturar / 'manifiesto.json') if args.capturar else args.manifiesto, args.salida)
