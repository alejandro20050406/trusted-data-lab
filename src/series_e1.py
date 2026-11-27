"""Laboratorio estadístico E1: series de tiempo del índice de precios de salud en México.

Funciones reutilizables por el notebook `laboratorio/e1_series.ipynb` y por las pruebas.
Todas las funciones son deterministas: con la misma captura Bronce producen los mismos números.

Uso desde la raíz del proyecto:
    python -m src.series_e1 [--bronce datos/bronce/ipc_salud/<captura>] [--salida datos/oro/series_e1]
"""
import argparse
import hashlib
import itertools
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from statsmodels.stats.diagnostic import acorr_ljungbox, het_arch
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, ccf

BRONCE = Path("datos/bronce/ipc_salud")
SALIDA = Path("datos/oro/series_e1")
PERIODO = 12          # estacionalidad mensual
HORIZONTE_PRUEBA = 12  # últimos 12 meses reservados como prueba
HORIZONTE_FUTURO = 12  # pronóstico publicado
ALFA = 0.05


# --------------------------------------------------------------------- carga

def ultima_captura(bronce=BRONCE):
    """Devuelve la carpeta de la captura Bronce más reciente con estado ok."""
    candidatas = []
    for carpeta in sorted(Path(bronce).iterdir()):
        manifiesto = carpeta / "manifiesto.json"
        if manifiesto.exists() and json.loads(manifiesto.read_text(encoding="utf-8")).get("estado") == "ok":
            candidatas.append(carpeta)
    if not candidatas:
        raise FileNotFoundError(f"No hay capturas válidas en {bronce}")
    return candidatas[-1]


def cargar_series(carpeta):
    """Lee el CSV original, verifica su hash y devuelve un DataFrame mensual con columnas salud y general."""
    carpeta = Path(carpeta)
    manifiesto = json.loads((carpeta / "manifiesto.json").read_text(encoding="utf-8"))
    datos = (carpeta / manifiesto["archivo"]).read_bytes()
    if hashlib.sha256(datos).hexdigest() != manifiesto["sha256"]:
        raise ValueError("El archivo Bronce no coincide con el SHA-256 del manifiesto")
    crudo = pd.read_csv(carpeta / manifiesto["archivo"], dtype={"TIME_PERIOD": str})
    crudo["fecha"] = pd.PeriodIndex(crudo["TIME_PERIOD"], freq="M").to_timestamp()
    tabla = crudo.pivot_table(index="fecha", columns="EXPENDITURE", values="OBS_VALUE", aggfunc="first")
    tabla = tabla.rename(columns={"CP06": "salud", "_T": "general"})[["salud", "general"]]
    tabla = tabla.dropna().sort_index().asfreq("MS")
    if tabla.isna().any().any():
        raise ValueError("La serie tiene meses faltantes dentro del rango")
    return tabla


# ----------------------------------------------------------- caracterización

def caracterizar(serie):
    """Estadísticos descriptivos y variación anual para describir tendencia y cambios."""
    anual = serie.pct_change(PERIODO) * 100
    return {
        "inicio": serie.index.min().strftime("%Y-%m"),
        "fin": serie.index.max().strftime("%Y-%m"),
        "periodos": int(serie.size),
        "minimo": float(serie.min()),
        "maximo": float(serie.max()),
        "crecimiento_total_pct": float((serie.iloc[-1] / serie.iloc[0] - 1) * 100),
        "inflacion_anual_media_pct": float(anual.mean()),
        "inflacion_anual_max_pct": float(anual.max()),
        "mes_inflacion_anual_max": anual.idxmax().strftime("%Y-%m"),
    }


def comparar_descomposiciones(serie):
    """Ajusta ambos modelos y mide si la amplitud estacional crece con el nivel.

    Criterio: si la amplitud estacional de cada año se correlaciona con el nivel de la tendencia
    (r > 0.5), el modelo multiplicativo es el adecuado; si no, el aditivo basta. También se reporta
    la desviación de ambos residuos en puntos del índice.
    """
    aditiva = seasonal_decompose(serie, model="additive", period=PERIODO)
    multiplicativa = seasonal_decompose(serie, model="multiplicative", period=PERIODO)
    # amplitud estacional observada por año: rango de (serie - tendencia) dentro de cada año
    desvio = (serie - aditiva.trend).dropna()
    amplitud = desvio.groupby(desvio.index.year).agg(lambda x: x.max() - x.min())
    nivel = aditiva.trend.dropna().groupby(aditiva.trend.dropna().index.year).mean()
    comunes = amplitud.index.intersection(nivel.index)
    correlacion = float(np.corrcoef(amplitud[comunes], nivel[comunes])[0, 1])
    res_adi = aditiva.resid.dropna()
    res_mul = (multiplicativa.resid.dropna() - 1) * multiplicativa.trend.dropna().reindex(
        multiplicativa.resid.dropna().index)
    eleccion = "multiplicativa" if correlacion > 0.5 else "aditiva"
    return {
        "aditiva": aditiva,
        "multiplicativa": multiplicativa,
        "corr_amplitud_nivel": correlacion,
        "desv_residuo_aditivo": float(res_adi.std()),
        "desv_residuo_multiplicativo_en_puntos": float(res_mul.std()),
        "fuerza_estacional_aditiva": float(max(0.0, 1 - res_adi.var() / (aditiva.seasonal + aditiva.resid).dropna().var())),
        "eleccion": eleccion,
    }


# --------------------------------------------------------- estacionariedad

def prueba_adf(serie, nombre=""):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        estadistico, p, rezagos, n, criticos, _ = adfuller(serie.dropna(), autolag="AIC")
    return {"serie": nombre, "estadistico": float(estadistico), "p_valor": float(p),
            "rezagos": int(rezagos), "n": int(n), "critico_5pct": float(criticos["5%"]),
            "estacionaria": bool(p < ALFA)}


# combinaciones (d regular, D estacional) en orden de menor a mayor diferenciación
COMBINACIONES = ((0, 0), (1, 0), (0, 1), (1, 1), (2, 0))


def diferenciar(serie, d, D):
    actual = serie
    for _ in range(D):
        actual = actual.diff(PERIODO)
    for _ in range(d):
        actual = actual.diff()
    return actual.dropna()


def elegir_diferenciacion(serie):
    """Prueba ADF en cada combinación y elige la primera (menos diferenciada) que es estacionaria."""
    tabla = [prueba_adf(diferenciar(serie, d, D), f"d={d}, D={D}") | {"d": d, "D": D}
             for d, D in COMBINACIONES]
    elegida = next((fila for fila in tabla if fila["estacionaria"]), None)
    if elegida is None:
        raise ValueError("Ninguna diferenciación logra estacionariedad")
    return (elegida["d"], elegida["D"]), tabla


def correlacion_cruzada(x, y, rezagos=12):
    """ccf entre x (salud) y y (general) ya estacionarias: corr(x_t, y_{t-k}) para k = 0..rezagos.

    Ambas series se transforman igual (logaritmo, d=1 y D=1) para quitar tendencia y estacionalidad;
    sin eso la correlación reflejaría solo que las dos suben y comparten el mismo calendario.
    """
    dx = diferenciar(np.log(x), 1, 1)
    dy = diferenciar(np.log(y), 1, 1)
    comunes = dx.index.intersection(dy.index)
    dx, dy = dx[comunes], dy[comunes]
    # statsmodels.ccf(a, b)[k] = corr(a_{t+k}, b_t) -> con a=dx, b=dy da corr(x_t, y_{t-k})
    valores = ccf(dx, dy, adjusted=False)[: rezagos + 1]
    banda = 1.96 / np.sqrt(len(dx))
    return pd.DataFrame({"rezago_meses": range(rezagos + 1), "correlacion": valores,
                         "significativa": np.abs(valores) > banda}), float(banda)


# ---------------------------------------------------------------- modelos

def separar(serie, horizonte=HORIZONTE_PRUEBA):
    return serie.iloc[:-horizonte], serie.iloc[-horizonte:]


def metricas(real, pronostico):
    real = np.asarray(real, dtype=float)
    pron = np.asarray(pronostico, dtype=float)
    error = real - pron
    return {"MAE": float(np.mean(np.abs(error))),
            "RMSE": float(np.sqrt(np.mean(error ** 2))),
            "MAPE": float(np.mean(np.abs(error / real)) * 100)}


def _sarima(serie, orden):
    p, d, q, sp, sd, sq = orden
    estacional = (sp, sd, sq, PERIODO) if (sp or sd or sq) else (0, 0, 0, 0)
    # con dos diferencias en total no se estima constante; con una se estima la deriva
    tendencia = "n" if d + sd >= 2 else ("t" if d + sd == 1 else "c")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return ARIMA(serie, order=(p, d, q), seasonal_order=estacional, trend=tendencia).fit()


def seleccionar_arima(entrenamiento, d, D, ordenes_p=range(0, 4), ordenes_q=range(0, 4),
                      ordenes_P=range(0, 2), ordenes_Q=range(0, 2)):
    """Con d y D fijados por ADF busca p, q, P, Q y ordena por AIC.

    El AIC solo es comparable entre modelos con la misma diferenciación (misma serie modelada),
    por eso d y D no forman parte de la búsqueda.
    """
    tabla = []
    for p, q, sp, sq in itertools.product(ordenes_p, ordenes_q, ordenes_P, ordenes_Q):
        try:
            ajuste = _sarima(entrenamiento, (p, d, q, sp, D, sq))
        except (ValueError, np.linalg.LinAlgError):
            continue
        tabla.append({"p": p, "d": d, "q": q, "P": sp, "D": D, "Q": sq,
                      "AIC": float(ajuste.aic), "BIC": float(ajuste.bic)})
    return pd.DataFrame(tabla).sort_values("AIC").reset_index(drop=True)


def ajustar_modelos(entrenamiento, orden_arima):
    """Ajusta los cuatro modelos pedidos sobre el entrenamiento y devuelve los objetos ajustados."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        modelos = {
            "Suavizamiento simple": SimpleExpSmoothing(entrenamiento, initialization_method="estimated").fit(),
            "Holt": ExponentialSmoothing(entrenamiento, trend="add", initialization_method="estimated").fit(),
            # estacionalidad multiplicativa, coherente con la descomposición elegida
            "Holt-Winters": ExponentialSmoothing(entrenamiento, trend="add", seasonal="mul",
                                                 seasonal_periods=PERIODO,
                                                 initialization_method="estimated").fit(),
        }
    modelos["SARIMA"] = _sarima(entrenamiento, orden_arima)
    return modelos


def comparar_en_prueba(modelos, prueba):
    filas, pronosticos = [], {}
    for nombre, ajuste in modelos.items():
        pron = pd.Series(np.asarray(ajuste.forecast(len(prueba))), index=prueba.index)
        pronosticos[nombre] = pron
        filas.append({"modelo": nombre, **metricas(prueba, pron)})
    tabla = pd.DataFrame(filas).sort_values("RMSE").reset_index(drop=True)
    return tabla, pd.DataFrame(pronosticos)


def validacion_por_origenes(serie, orden_arima, pliegues=3, horizonte=HORIZONTE_PRUEBA):
    """Repite la prueba en varios orígenes: ventanas de 12 meses consecutivas hacia atrás.

    Sirve para saber si el ganador de la prueba final lo es de forma estable o por una sola ventana.
    """
    filas = []
    for k in range(pliegues, 0, -1):
        fin = len(serie) - (k - 1) * horizonte
        entrenamiento, prueba = serie.iloc[:fin - horizonte], serie.iloc[fin - horizonte:fin]
        tabla, _ = comparar_en_prueba(ajustar_modelos(entrenamiento, orden_arima), prueba)
        ventana = f"{prueba.index.min():%Y-%m} a {prueba.index.max():%Y-%m}"
        for fila in tabla.to_dict(orient="records"):
            filas.append({"ventana": ventana, **fila})
    detalle = pd.DataFrame(filas)
    promedio = (detalle.groupby("modelo")[["MAE", "RMSE", "MAPE"]].mean()
                .sort_values("RMSE").reset_index())
    return detalle, promedio


def parametros(ajuste):
    if isinstance(getattr(ajuste, "params", None), dict):
        claves = ("smoothing_level", "smoothing_trend", "smoothing_seasonal")
        return {k: float(ajuste.params[k]) for k in claves
                if ajuste.params.get(k) is not None and not np.isnan(ajuste.params[k])}
    return {k: float(v) for k, v in ajuste.params.items()}


# --------------------------------------------------------------- residuos

def residuos_utiles(nombre, ajuste):
    """Quita el arranque del modelo, donde los residuos reflejan la inicialización y no el ajuste."""
    residuos = pd.Series(np.asarray(ajuste.resid), index=ajuste.model.data.row_labels)
    descartar = 2 * PERIODO + 1 if nombre in ("SARIMA", "Holt-Winters") else 2
    return residuos.iloc[descartar:]


def diagnostico_residuos(residuos, rezagos=(12, 24)):
    residuos = pd.Series(residuos).dropna()
    lb = acorr_ljungbox(residuos, lags=list(rezagos), return_df=True)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        _, arch_p, _, _ = het_arch(residuos, nlags=12)
    tercio = len(residuos) // 3
    return {
        "ljung_box": [{"rezago": int(k), "Q": float(fila.lb_stat), "p_valor": float(fila.lb_pvalue)}
                      for k, fila in lb.iterrows()],
        "sin_autocorrelacion": bool((lb.lb_pvalue > ALFA).all()),
        "arch_p_valor": float(arch_p),
        "sin_efecto_arch": bool(arch_p > ALFA),
        "razon_varianza_final_inicial": float(residuos.iloc[-tercio:].var() / residuos.iloc[:tercio].var()),
        "media": float(residuos.mean()),
    }


def aplicar_puerta_supuestos(tabla, modelos):
    """Puerta de calidad 3: recorre los modelos por error y publica el primero sin autocorrelación residual.

    Devuelve el modelo con menor error de prueba, el publicado y el diagnóstico de cada uno.
    """
    diagnosticos = {nombre: diagnostico_residuos(residuos_utiles(nombre, ajuste))
                    for nombre, ajuste in modelos.items()}
    menor_error = tabla.iloc[0]["modelo"]
    publicado = next((m for m in tabla["modelo"] if diagnosticos[m]["sin_autocorrelacion"]), None)
    return menor_error, publicado, diagnosticos


# ------------------------------------------------------------- pronóstico

def pronosticar(nombre, serie, orden_arima, horizonte=HORIZONTE_FUTURO, alfa=ALFA,
                simulaciones=5000, semilla=2026):
    """Reajusta el modelo publicado con toda la serie y devuelve pronóstico con intervalo al 95 %.

    SARIMA usa el intervalo analítico; los de suavizamiento, simulación de errores con semilla fija.
    """
    if nombre == "SARIMA":
        ajuste = _sarima(serie, orden_arima)
        pron = ajuste.get_forecast(horizonte)
        intervalo = pron.conf_int(alpha=alfa)
        media, bajo, alto = pron.predicted_mean, intervalo.iloc[:, 0], intervalo.iloc[:, 1]
    else:
        ajuste = ajustar_modelos(serie, orden_arima)[nombre]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            sims = ajuste.simulate(horizonte, repetitions=simulaciones, error="add", anchor="end",
                                   random_state=semilla)
        media = ajuste.forecast(horizonte)
        bajo, alto = sims.quantile(alfa / 2, axis=1), sims.quantile(1 - alfa / 2, axis=1)
    return ajuste, pd.DataFrame({
        "fecha": pd.DatetimeIndex(media.index).strftime("%Y-%m"),
        "pronostico": np.asarray(media), "limite_inferior_95": np.asarray(bajo),
        "limite_superior_95": np.asarray(alto)})


def frase_cliente(serie, futuro):
    ultimo = serie.iloc[-1]
    fin = futuro.iloc[-1]
    centro = (fin.pronostico / ultimo - 1) * 100
    bajo = (fin.limite_inferior_95 / ultimo - 1) * 100
    alto = (fin.limite_superior_95 / ultimo - 1) * 100
    mes_fin = f"{fin.fecha[5:]}/{fin.fecha[:4]}"
    return (f"Con 95 % de confianza, entre {serie.index[-1]:%m/%Y} y {mes_fin} los precios de "
            f"productos y servicios de salud en México subirían entre {bajo:.1f} % y {alto:.1f} % "
            f"(estimación central: {centro:.1f} %). Para un consultorio que gasta $10,000 al mes en "
            f"insumos, eso equivale a presupuestar entre ${10000 * (1 + bajo / 100):,.0f} y "
            f"${10000 * (1 + alto / 100):,.0f} al mes un año después, si su canasta sigue al índice nacional.")


# -------------------------------------------------------------- ejecución

def ejecutar(bronce=None, salida=SALIDA):
    """Corre todo el análisis y escribe los resultados en `salida` (los archivos se sobrescriben)."""
    carpeta = Path(bronce) if bronce else ultima_captura()
    datos = cargar_series(carpeta)
    salud = datos["salud"]
    salida = Path(salida)
    salida.mkdir(parents=True, exist_ok=True)

    desc = comparar_descomposiciones(salud)
    (d, D), adf = elegir_diferenciacion(salud)
    entrenamiento, prueba = separar(salud)
    busqueda = seleccionar_arima(entrenamiento, d, D)
    mejor = busqueda.iloc[0]
    orden = tuple(int(mejor[c]) for c in ("p", "d", "q", "P", "D", "Q"))
    modelos = ajustar_modelos(entrenamiento, orden)
    tabla, pron_prueba = comparar_en_prueba(modelos, prueba)
    menor_error, publicado, diagnosticos = aplicar_puerta_supuestos(tabla, modelos)
    detalle_origenes, promedio_origenes = validacion_por_origenes(salud, orden)
    if publicado is None:
        futuro = None
        frase = "Ningún modelo cumple el supuesto de residuos sin autocorrelación: no se publica pronóstico."
    else:
        _, futuro = pronosticar(publicado, salud, orden)
        frase = frase_cliente(salud, futuro)
    cruzada, banda = correlacion_cruzada(salud, datos["general"])

    datos.reset_index().to_csv(salida / "serie_ipc_salud.csv", index=False, encoding="utf-8-sig")
    tabla.to_csv(salida / "comparacion_modelos.csv", index=False, encoding="utf-8-sig")
    pron_prueba.assign(real=prueba).reset_index().to_csv(
        salida / "pronostico_prueba.csv", index=False, encoding="utf-8-sig")
    detalle_origenes.to_csv(salida / "validacion_origenes.csv", index=False, encoding="utf-8-sig")
    busqueda.head(15).to_csv(salida / "busqueda_arima_aic.csv", index=False, encoding="utf-8-sig")
    cruzada.to_csv(salida / "correlacion_cruzada.csv", index=False, encoding="utf-8-sig")
    if futuro is not None:
        futuro.to_csv(salida / "pronostico_publicado.csv", index=False, encoding="utf-8-sig")
    resumen = {
        "captura_bronce": carpeta.as_posix(),
        "caracterizacion": caracterizar(salud),
        "descomposicion": {k: v for k, v in desc.items() if k not in ("aditiva", "multiplicativa")},
        "adf": adf,
        "diferenciacion": {"d": d, "D": D},
        "sarima_por_aic": {"orden": orden, "AIC": float(mejor["AIC"])},
        "prueba": {"inicio": f"{prueba.index.min():%Y-%m}", "fin": f"{prueba.index.max():%Y-%m}"},
        "comparacion": tabla.to_dict(orient="records"),
        "validacion_origenes_promedio": promedio_origenes.to_dict(orient="records"),
        "menor_error_prueba": menor_error,
        "modelo_publicado": publicado,
        "parametros": {nombre: parametros(ajuste) for nombre, ajuste in modelos.items()},
        "diagnostico_residuos": diagnosticos,
        "banda_ccf_95": banda,
        "pronostico": None if futuro is None else futuro.to_dict(orient="records"),
        "frase_cliente": frase,
    }
    (salida / "resumen.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=2) + "\n",
                                         encoding="utf-8")
    return resumen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bronce", help="Carpeta de captura Bronce (por defecto, la más reciente)")
    parser.add_argument("--salida", default=str(SALIDA))
    args = parser.parse_args()
    resumen = ejecutar(args.bronce, args.salida)
    claves = ("comparacion", "validacion_origenes_promedio", "menor_error_prueba",
              "modelo_publicado", "sarima_por_aic", "frase_cliente")
    print(json.dumps({k: resumen[k] for k in claves}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
