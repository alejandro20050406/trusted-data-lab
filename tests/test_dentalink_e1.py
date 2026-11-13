import unittest
from src.dentalink import extraer_precio_principal


class PrecioDentalinkTest(unittest.TestCase):
    def test_precio_principal_no_confunde_alternativas(self):
        html = '''
        <div class="grid">
          <h1>Resina 4g</h1>
          <a href="/mx/depositos/28-molar">Vendido y despachado por <b>Depósito Dental Molar</b></a>
          <div class="ha-card p-5 sticky">
            <span class="ha-num text-[28px] font-bold">$1,199.00</span>
            <p>Sin stock por ahora</p>
          </div>
        </div>
        <section><span class="ha-num text-[28px] font-bold">$825.00</span></section>'''
        r = extraer_precio_principal(html, 'Resina 4g', 'MXN')
        self.assertEqual(r['precio'], 1199.0)
        self.assertEqual(r['vendedor'], 'Depósito Dental Molar')
        self.assertEqual(r['disponibilidad'], 'sin_stock')

    def test_rechaza_estructura_ambigua_y_moneda_distinta(self):
        html = '<h1>Resina</h1><div class="ha-card sticky"><span class="ha-num font-bold text-[28px]">$20.00</span></div>'
        with self.assertRaises(ValueError):
            extraer_precio_principal(html, 'Resina', 'MXN')
        with self.assertRaises(ValueError):
            extraer_precio_principal(html, 'Resina', 'USD')
