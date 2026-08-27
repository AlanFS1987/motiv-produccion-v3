// frontend/src/components/rectificado/RectificadoApp.tsx
// Shell propio del rol jefe_rectificado — mismo patrón que JefeApp.tsx
// pero con solo 2 pestañas (sin Incidencias ni Ceria: esta sección no
// gestiona incidencias ni tiene asistente; sin gamificación, como el
// jefe a secas).

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { VistaRapidaRectificadoScreen } from "./VistaRapidaRectificadoScreen";
import { VistaDetalladaRectificadoScreen } from "./VistaDetalladaRectificadoScreen";

type PestanaRectificado = "vista-rapida" | "vista-detallada";

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
          : "border-transparent text-[var(--texto-secundario)] hover:text-[var(--texto)]"
      }`}
    >
      {children}
    </button>
  );
}

export function RectificadoApp({ username }: { username: string }) {
  const [pestana, setPestana] = useState<PestanaRectificado>("vista-rapida");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--fondo)]">
      <header className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
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

      <div className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          <BotonPestana activa={pestana === "vista-rapida"} onClick={() => setPestana("vista-rapida")}>
            Vista Rápida
          </BotonPestana>
          <BotonPestana activa={pestana === "vista-detallada"} onClick={() => setPestana("vista-detallada")}>
            Vista Detallada
          </BotonPestana>
        </div>
      </div>

      <main className="relative flex-1">
        <div className="mx-auto max-w-6xl p-4 pb-24">
          {pestana === "vista-rapida" ? <VistaRapidaRectificadoScreen /> : <VistaDetalladaRectificadoScreen />}
        </div>
      </main>
    </div>
  );
}