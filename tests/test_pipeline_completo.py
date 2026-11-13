import csv
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from src.e1 import ejecutar


class PipelineCompletoTest(unittest.TestCase):
    def test_integracion_y_oro_con_precio_individual(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            captura = root / 'odontologia' / 'uno'
            captura.mkdir(parents=True)
            url = 'https://dentalinkmarket.com/mx/productos/1'
            product = {'@type':'Product', 'name':'Resina 4g',
                       'offers':{'@type':'AggregateOffer','priceCurrency':'MXN','lowPrice':800,'highPrice':1200}}
            html = ('<script type="application/ld+json">' + json.dumps(product) + '</script>'
                    '<div><h1>Resina 4g</h1><a href="/mx/depositos/28-molar">'
                    'Vendido y despachado por <b>Molar</b></a><div class="ha-card sticky">'
                    '<span class="ha-num font-bold">$1,199.00</span><p>Sin stock por ahora</p></div></div>').encode()
            (captura / 'x.html').write_bytes(html)
            sha = hashlib.sha256(html).hexdigest()
            (captura / 'manifiesto.json').write_text(json.dumps([{'estado':'ok','fuente':'dentalink_market',
                'archivo':'x.html','sha256':sha,'url':url,'consultado_utc':'2026-01-01T00:00:00+00:00'}]), encoding='utf-8')
            institucional = root / 'issste'
            institucional.mkdir()
            raw = ('CLAVE,DESCRIPCION,UNIDAD DE PRESENTACION,NIVEL DE ATENCION,GRUPO TERAPEUTICO,INDICACIONES\n'
                   '001,Resina,PIEZA,1er Nivel,Material,0\n').encode('cp1252')
            (institucional / 'catalogo.csv').write_bytes(raw)
            sha_catalogo = hashlib.sha256(raw).hexdigest()
            manifiesto = institucional / 'manifiesto.json'
            manifiesto.write_text(json.dumps({'estado':'ok','archivo':'catalogo.csv','sha256':sha_catalogo,
                'url':'https://issste.test/catalogo.csv','consultado_utc':'2026-01-01T00:00:00+00:00'}), encoding='utf8')
            referencias = root / 'refs.csv'
            columnas = ['fuente','url','producto_esperado','clave_issste','estado_revision','tipo_relacion',
                'coincidencias','diferencias','evidencia','revisor','fecha_revision',
                'sha256_producto_revisado','sha256_catalogo_revisado']
            with referencias.open('w',encoding='utf8',newline='') as f:
                w=csv.DictWriter(f,fieldnames=columnas)
                w.writeheader()
                w.writerow(dict(fuente='dentalink_market',url=url,producto_esperado='Resina 4g',
                    clave_issste='001',estado_revision='revisada',tipo_relacion='exacta',
                    coincidencias='Ficha coincidente',diferencias='Ninguna',evidencia='Prueba',
                    revisor='Revisor',fecha_revision='2026-01-01',
                    sha256_producto_revisado=sha,sha256_catalogo_revisado=sha_catalogo))
            salida = root / 'salida'
            resumen = ejecutar(root / 'odontologia', salida, manifiesto, referencias)
            self.assertEqual((resumen['validos'],resumen['cuarentena']), (1,0))
            with (salida / 'plata.csv').open(encoding='utf-8-sig',newline='') as f:
                fila=next(csv.DictReader(f))
            self.assertEqual(float(fila['precio']),1199.0)
            self.assertEqual(fila['vendedor'],'Molar')
            self.assertEqual(fila['disponibilidad'],'sin_stock')
            with (salida / 'oro_inventario.csv').open(encoding='utf-8-sig',newline='') as f:
                oro=list(csv.DictReader(f))
            oferta=next(x for x in oro if x['tipo_registro']=='oferta_comercial')
            oficial=next(x for x in oro if x['tipo_registro']=='catalogo_issste')
            self.assertEqual(oferta['clave_issste_verificada'],'001')
            self.assertEqual(oferta['estado_vinculo_issste'],'exacta_revisada')
            self.assertEqual(oficial['precio_observado_mxn'],'')
            self.assertEqual(resumen['issste_validos'],1)
