"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarSesion, type EstadoLogin } from "./acciones";

const inicial: EstadoLogin = { error: null, email: "" };

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, inicial);
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={estado.email} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {estado.error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {estado.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
