// frontend/src/components/jefe/JefeApp.tsx
// Shell propio del jefe de planta, igual patrón que OperarioApp.tsx:
// se monta en vez del shell de responsable (Turno/Resumen/Lotes) en
// cuanto usuario.rol === 'jefe'.
//
// Cuatro pestañas: Vista Rápida, Vista Detallada, Incidencias y
// Ceria — dashboard del jefe completo por ahora (ver
// memorias/07-pendientes.md punto 6 para lo que quede fuera).

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { CeriaScreen } from "../ceria/CeriaScreen";
import { VistaRapidaScreen } from "./VistaRapidaScreen";
import { VistaDetalladaScreen } from "./VistaDetalladaScreen";
import { IncidenciasScreen } from "./IncidenciasScreen";

type PestanaJefe = "vista-rapida" | "vista-detallada" | "incidencias" | "ceria";

function BotonPestana({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium ${
        activa ? "border-[var(--acento)] text-[var(--texto)]" : "border-transparent text-[var(--texto-tenue)] hover:text-[var(--texto-secundario)]"
      }`}
    >
      {children}
    </button>
  );
}

export function JefeApp({ username }: { username: string }) {
  const [pestana, setPestana] = useState<PestanaJefe>("vista-rapida");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-sm text-[var(--texto-secundario)]">
            Conectado como <strong className="text-[var(--texto)]">{username}</strong>
          </span>
          <ThemeSwitcher />
          <button
            onClick={() => cerrarSesion()}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-[var(--texto-secundario)] hover:bg-[var(--superficie-alt)]"
          >
            <LogOut size={16} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <div className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4">
          <BotonPestana activa={pestana === "vista-rapida"} onClick={() => setPestana("vista-rapida")}>
            Vista Rápida
          </BotonPestana>
          <BotonPestana activa={pestana === "vista-detallada"} onClick={() => setPestana("vista-detallada")}>
            Vista Detallada
          </BotonPestana>
          <BotonPestana activa={pestana === "incidencias"} onClick={() => setPestana("incidencias")}>
            Incidencias
          </BotonPestana>
          <BotonPestana activa={pestana === "ceria"} onClick={() => setPestana("ceria")}>
            Ceria
          </BotonPestana>
        </div>
      </div>

      <div className="flex-1">
        {pestana === "vista-rapida" && <VistaRapidaScreen />}
        {pestana === "vista-detallada" && <VistaDetalladaScreen />}
        {pestana === "incidencias" && <IncidenciasScreen />}
        {pestana === "ceria" && <CeriaScreen />}
      </div>
    </div>
  );
}