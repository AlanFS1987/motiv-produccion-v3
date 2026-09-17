// frontend/src/components/mecanico/MecanicoApp.tsx
//
// Shell propio del rol mecánico, mismo patrón que OperarioApp/JefeApp.
// Por ahora solo Incidencias está construida; Almacén, Engrase y
// Unidades quedan como placeholder (17-rol-mecanico-plan.md).

import { useState } from "react";
import { LogOut, AlertTriangle, Package, Droplet, RefreshCw } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { NotificacionesBell } from "../notificaciones/NotificacionesBell";
import { IncidenciasScreen } from "./IncidenciasScreen";
import { EngraseScreen } from "./EngraseScreen";
import { AlmacenScreen } from "./AlmacenScreen";

type PestanaMecanico = "incidencias" | "almacen" | "engrase" | "unidades";

function BotonPestana({
  activa,
  onClick,
  icono,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
        activa
          ? "border-[var(--acento)] text-[var(--texto)]"
          : "border-transparent text-[var(--texto-secundario)] hover:text-[var(--texto)]"
      }`}
    >
      {icono}
      {children}
    </button>
  );
}

function Proximamente({ nombre }: { nombre: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed border-[var(--borde)] p-6 text-center text-sm text-[var(--texto-secundario)]">
      {nombre} está en construcción — vuelve pronto.
    </div>
  );
}

export function MecanicoApp({ username }: { username: string }) {
  const [pestana, setPestana] = useState<PestanaMecanico>("incidencias");

  return (
    <div className="min-h-screen bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-sm text-[var(--texto-secundario)]">
            Conectado como <strong className="text-[var(--texto)]">{username}</strong>
          </span>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <NotificacionesBell />
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

      <div className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          <BotonPestana activa={pestana === "incidencias"} onClick={() => setPestana("incidencias")} icono={<AlertTriangle size={16} />}>
            Incidencias
          </BotonPestana>
          <BotonPestana activa={pestana === "almacen"} onClick={() => setPestana("almacen")} icono={<Package size={16} />}>
            Almacén
          </BotonPestana>
          <BotonPestana activa={pestana === "engrase"} onClick={() => setPestana("engrase")} icono={<Droplet size={16} />}>
            Engrase
          </BotonPestana>
          <BotonPestana activa={pestana === "unidades"} onClick={() => setPestana("unidades")} icono={<RefreshCw size={16} />}>
            Unidades
          </BotonPestana>
        </div>
      </div>

      <main className="mx-auto max-w-6xl p-4">
        {pestana === "incidencias" && <IncidenciasScreen />}
        {pestana === "almacen" && <AlmacenScreen />}
        {pestana === "engrase" && <EngraseScreen />}
        {pestana === "unidades" && <Proximamente nombre="Unidades" />}
      </main>
    </div>
  );
}