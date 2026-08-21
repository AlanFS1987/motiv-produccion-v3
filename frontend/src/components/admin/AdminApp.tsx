// frontend/src/components/admin/AdminApp.tsx
// Shell del administrador. Ve todo lo que ve el jefe (Vista Rápida,
// Vista Detallada, Incidencias, Ceria) MÁS sus propias pestañas de
// gestión (Rotación, y las que se añadan después: fusión de
// catálogo, corrección sin límite, cierre de fábrica/checklist).

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { CeriaScreen } from "../ceria/CeriaScreen";
import { VistaRapidaScreen } from "../jefe/VistaRapidaScreen";
import { VistaDetalladaScreen } from "../jefe/VistaDetalladaScreen";
import { IncidenciasScreen } from "../jefe/IncidenciasScreen";
import { AjustarLetrasScreen } from "./AjustarLetrasScreen";
import { CorreccionPartesScreen } from "./CorreccionPartesScreen";
import { PruebaCamaraScreen } from "./PruebaCamaraScreen";

type PestanaAdmin = "vista-rapida" | "vista-detallada" | "incidencias" | "ceria" | "rotacion" | "partes" | "prueba-camara";

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
      className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
        activa ? "border-[var(--acento)] text-[var(--texto)]" : "border-transparent text-[var(--texto-tenue)] hover:text-[var(--texto-secundario)]"
      }`}
    >
      {children}
    </button>
  );
}

export function AdminApp({ username }: { username: string }) {
  const [pestana, setPestana] = useState<PestanaAdmin>("vista-rapida");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-sm text-[var(--texto-secundario)]">
            Administrador — <strong className="text-[var(--texto)]">{username}</strong>
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
          <BotonPestana activa={pestana === "rotacion"} onClick={() => setPestana("rotacion")}>
            Rotación
          </BotonPestana>
          <BotonPestana activa={pestana === "partes"} onClick={() => setPestana("partes")}>
            Partes
          </BotonPestana>
          <BotonPestana activa={pestana === "prueba-camara"} onClick={() => setPestana("prueba-camara")}>
            Cámara
          </BotonPestana>
        </div>
      </div>

      <div className="flex-1">
        {pestana === "vista-rapida" && <VistaRapidaScreen />}
        {pestana === "vista-detallada" && <VistaDetalladaScreen />}
        {pestana === "incidencias" && <IncidenciasScreen />}
        {pestana === "ceria" && <CeriaScreen />}
        {pestana === "rotacion" && <AjustarLetrasScreen />}
        {pestana === "partes" && <CorreccionPartesScreen />}
        {pestana === "prueba-camara" && <PruebaCamaraScreen />}
      </div>
    </div>
  );
}