// frontend/src/components/calidad/CalidadApp.tsx
// Shell del rol calidad — una única vista, sin pestañas (a
// diferencia de jefe/rectificado): solo "últimos 15 lotes con
// calidad" + incidencias de calidad colgando de cada lote.

import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { CalidadLotesScreen } from "./CalidadLotesScreen";

export function CalidadApp({ username }: { username: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm text-[var(--texto-secundario)]">
            Conectado como <strong className="text-[var(--texto)]">{username}</strong>
          </span>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <button
              onClick={() => cerrarSesion()}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--texto-secundario)] hover:bg-[var(--superficie-alt)]"
            >
              <LogOut size={16} aria-hidden />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto max-w-5xl p-4 pb-24">
          <CalidadLotesScreen />
        </div>
      </main>
    </div>
  );
}