"""Reintenta fuentes incompletas sin mezclar intentos parciales con Bronce."""
import datetime as dt
import shutil
import time
from pathlib import Path


def recolectar(fuentes, intentos, esperas=(60, 300, 900), dormir=time.sleep):
    pendientes = dict(fuentes)
    ejecucion = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    for numero in range(1, len(esperas) + 2):
        for nombre, (capturar, bronce) in list(pendientes.items()):
            destino = intentos / ejecucion / f'intento-{numero}' / nombre
            print(f'Intento {numero}: {nombre}', flush=True)
            try:
                completa = capturar(destino)
            except (OSError, ValueError) as error:
                print(f'{nombre}: {type(error).__name__}: {error}', flush=True)
                completa = False
            if completa:
                bronce.mkdir(parents=True, exist_ok=True)
                shutil.copytree(destino, bronce / f'{ejecucion}-{nombre}')
                del pendientes[nombre]
        if not pendientes:
            return True
        if numero <= len(esperas):
            print(f'Pendientes: {", ".join(pendientes)}. Reintento en {esperas[numero-1]} s.', flush=True)
            dormir(esperas[numero-1])
    print(f'Fuentes incompletas: {", ".join(pendientes)}', flush=True)
    return False


def main():
    from scripts.captura_dental import capturar as capturar_dental
    from scripts.captura_imdent import capturar as capturar_catalogo
    from src.catalogo_imdent import TIENDAS

    def dental(destino):
        return all(item['estado'] == 'ok' for item in capturar_dental(destino))

    fuentes = {'odontologia': (dental, Path('datos/bronce/odontologia'))}
    for tienda in TIENDAS:
        def catalogo(destino, slug=tienda):
            return capturar_catalogo(destino, base='https://imdent.com/stores/' + slug)
        fuentes[tienda] = (catalogo, Path('datos/bronce/imd_catalogo'))
    return 0 if recolectar(fuentes, Path('intentos-captura')) else 1


if __name__ == '__main__':
    raise SystemExit(main())
