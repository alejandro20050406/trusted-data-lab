"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { borrarSuscripcionAccion, enviarPruebaAccion, guardarSuscripcionAccion } from "./acciones";

function base64AUint8(base64: string): Uint8Array<ArrayBuffer> {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  const salida = new Uint8Array(new ArrayBuffer(crudo.length));
  for (let i = 0; i < crudo.length; i++) salida[i] = crudo.charCodeAt(i);
  return salida;
}

type Soporte = "cargando" | "si" | "no" | "ios-sin-instalar";

/** Activar, probar y desactivar notificaciones push en este celular. */
export function Notificaciones({ llavePublica }: { llavePublica: string | null }) {
  const [soporte, setSoporte] = useState<Soporte>("cargando");
  const [suscripcion, setSuscripcion] = useState<PushSubscription | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "correcto" | "alerta"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let cancelado = false;
    async function revisar() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return ios && !instalada ? "ios-sin-instalar" : "no";
      }
      const registro = await navigator.serviceWorker.ready;
      const actual = await registro.pushManager.getSubscription();
      if (!cancelado) setSuscripcion(actual);
      return "si";
    }
    revisar().then((s) => {
      if (!cancelado) setSoporte(s);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  function activar() {
    setMensaje(null);
    iniciar(async () => {
      if (!llavePublica) return setMensaje({ tipo: "alerta", texto: "Faltan las llaves VAPID en el servidor." });
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") return setMensaje({ tipo: "alerta", texto: "No se dio permiso. Actívalo en los ajustes del navegador." });
      try {
        const registro = await navigator.serviceWorker.ready;
        const nueva = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64AUint8(llavePublica) });
        const r = await guardarSuscripcionAccion(JSON.parse(JSON.stringify(nueva)));
        if (!r.ok) return setMensaje({ tipo: "alerta", texto: r.error });
        setSuscripcion(nueva);
        setMensaje({ tipo: "correcto", texto: "Notificaciones activadas en este celular." });
      } catch {
        setMensaje({ tipo: "alerta", texto: "No se pudieron activar en este navegador." });
      }
    });
  }

  function desactivar() {
    if (!suscripcion) return;
    setMensaje(null);
    iniciar(async () => {
      await borrarSuscripcionAccion(suscripcion.endpoint);
      await suscripcion.unsubscribe();
      setSuscripcion(null);
      setMensaje({ tipo: "correcto", texto: "Notificaciones desactivadas en este celular." });
    });
  }

  function probar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await enviarPruebaAccion();
      setMensaje(r.ok ? { tipo: "correcto", texto: r.mensaje ?? "Enviada." } : { tipo: "alerta", texto: r.error });
    });
  }

  if (soporte === "cargando") return <p className="text-muted-foreground">Revisando este navegador…</p>;
  if (soporte === "ios-sin-instalar") {
    return <Estado tipo="advertencia" texto="En iPhone las notificaciones solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o posterior). Instálala primero." />;
  }
  if (soporte === "no") return <Estado tipo="neutro" texto="Este navegador no admite notificaciones. Los avisos siguen apareciendo en Inicio." />;

  return (
    <div className="flex flex-col gap-3">
      {suscripcion ? (
        <>
          <Estado tipo="correcto" texto="Las notificaciones están activas en este celular." />
          <div className="flex flex-wrap gap-2">
            <Button onClick={probar} disabled={pendiente}>
              <Send aria-hidden="true" />
              Enviar una de prueba
            </Button>
            <Button variant="outline" onClick={desactivar} disabled={pendiente}>
              <BellOff aria-hidden="true" />
              Desactivar
            </Button>
          </div>
        </>
      ) : (
        <Button size="lg" className="h-14 text-lg" onClick={activar} disabled={pendiente}>
          <Bell aria-hidden="true" />
          Activar notificaciones
        </Button>
      )}
      {mensaje ? <Estado tipo={mensaje.tipo} texto={mensaje.texto} /> : null}
    </div>
  );
}
