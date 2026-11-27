"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

/** Registra /sw.js una vez que la página cargó. */
export function RegistroServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sin service worker la app sigue funcionando en línea.
    });
  }, []);
  return null;
}

function suscribirConexion(cambio: () => void) {
  window.addEventListener("online", cambio);
  window.addEventListener("offline", cambio);
  return () => {
    window.removeEventListener("online", cambio);
    window.removeEventListener("offline", cambio);
  };
}

/** Franja fija y clara cuando el celular pierde la conexión. */
export function AvisoSinConexion() {
  const enLinea = useSyncExternalStore(
    suscribirConexion,
    () => navigator.onLine,
    () => true,
  );
  if (enLinea) return null;
  return (
    <div
      role="alert"
      data-sin-conexion
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-alerta px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-base font-medium text-white md:left-60"
    >
      <WifiOff aria-hidden="true" className="size-5 shrink-0" />
      Sin conexión: los cambios no se guardarán hasta que vuelva internet.
    </div>
  );
}
