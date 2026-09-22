// frontend/src/components/produccion/ProduccionApp.tsx
// Shell propio del rol `produccion` (adjuntos de jefe de planta —
// sesión 22/09/2026). Ven exactamente lo mismo que `jefe` (mismo
// alcance: solo clasificación, no rectificado — el jefe tampoco lo
// controla) y puramente en modo lectura, así que este shell reutiliza
// tal cual los componentes de `jefe/` y `calidad/`, igual patrón que
// `AdminApp.tsx` — sin duplicar ni una pantalla.
//
// Siete pestañas: Vista Rápida, Vista Detallada, Incidencias, Calidad,
// Informes, Ceria y Chat. Qué canales de Chat ve (incidencia_calidad,
// incidencia_produccion, ceria — sin "general") se decide aparte desde
// `admin/ChatAccesoScreen.tsx`, no aquí: `ChatHomeScreen` ya filtra
// solo lo que el rol tiene permitido.
//
// RLS necesaria para que esto funcione: ver
// supabase/migrations/20260922120000_rol_produccion_rls.sql.

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { NotificacionesBell } from "../notificaciones/NotificacionesBell";
import { CeriaScreen } from "../ceria/CeriaScreen";
import { VistaRapidaScreen } from "../jefe/VistaRapidaScreen";
import { VistaDetalladaScreen } from "../jefe/VistaDetalladaScreen";
import { IncidenciasScreen } from "../jefe/IncidenciasScreen";
import { InformesScreen } from "../jefe/InformesScreen";
import { CalidadLotesScreen } from "../calidad/CalidadLotesScreen";
import { ChatHomeScreen } from "../chat/ChatHomeScreen";

type PestanaProduccion =
  | "vista-rapida"
  | "vista-detallada"
  | "incidencias"
  | "calidad"
  | "informes"
  | "ceria"
  | "chat";

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
        activa
          ? "border-[var(--acento)] text-[var(--texto)]"
          : "border-transparent text-[var(--texto-tenue)] hover:text-[var(--texto-secundario)]"
      }`}
    >
      {children}
    </button>
  );
}

export function ProduccionApp({ username }: { username: string }) {
  const [pestana, setPestana] = useState<PestanaProduccion>("vista-rapida");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
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
          <BotonPestana activa={pestana === "calidad"} onClick={() => setPestana("calidad")}>
            Calidad
          </BotonPestana>
          <BotonPestana activa={pestana === "informes"} onClick={() => setPestana("informes")}>
            Informes
          </BotonPestana>
          <BotonPestana activa={pestana === "ceria"} onClick={() => setPestana("ceria")}>
            Ceria
          </BotonPestana>
          <BotonPestana activa={pestana === "chat"} onClick={() => setPestana("chat")}>
            Chat
          </BotonPestana>
        </div>
      </div>

      <div className="flex-1">
        {pestana === "vista-rapida" && <VistaRapidaScreen />}
        {pestana === "vista-detallada" && <VistaDetalladaScreen />}
        {pestana === "incidencias" && <IncidenciasScreen />}
        {pestana === "calidad" && <CalidadLotesScreen />}
        {pestana === "informes" && <InformesScreen />}
        {pestana === "ceria" && <CeriaScreen />}
        {pestana === "chat" && <ChatHomeScreen />}
      </div>
    </div>
  );
}