import { useState } from "react";
import { LogOut } from "lucide-react";
import { Login } from "./components/Login";
import { TurnoScreen } from "./components/TurnoScreen";
import { ResumenScreen } from "./components/ResumenScreen";
import { GestionLotes } from "./components/GestionLotes";
import { useAuth } from "./context/AuthContext";
import { cerrarSesion } from "./lib/auth";
import { OperarioApp } from "./components/operario/OperarioApp";
import { JefeApp } from "./components/jefe/JefeApp";
import { AdminApp } from "./components/admin/AdminApp";
import { PantallaCarrusel } from "./components/pantalla/PantallaCarrusel";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { RolSinInterfaz } from "./components/RolSinInterfaz";

type Pestana = "turno" | "resumen" | "lotes";

export default function App() {
  const { sesion, usuario, cargando, errorPerfil } = useAuth();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        Cargando...
      </div>
    );
  }

  if (!sesion) {
    return <Login />;
  }

  if (errorPerfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-center text-red-600">
        {errorPerfil}
      </div>
    );
  }

  return <AppAutenticada username={usuario?.username ?? ""} />;
}

function AppAutenticada({ username }: { username: string }) {
  const { usuario } = useAuth();
  const [pestana, setPestana] = useState<Pestana>("turno");

  // El operario tiene su propia app (navegación e header propios,
  // sin pestañas de Turno/Resumen/Lotes) — se bifurca aquí, antes de
  // montar el shell del responsable.
  if (usuario?.rol === "operario") {
    return <OperarioApp />;
  }

  if (usuario?.rol === "pantalla") {
    return <PantallaCarrusel username={username} />;
  }

  if (usuario?.rol === "administrador") {
    return <AdminApp username={username} />;
  }
  
  if (usuario?.rol === "jefe") {
    return <JefeApp username={username} />;
  }
  if (usuario?.rol !== "responsable" && usuario?.rol !== "suplente") {
    return <RolSinInterfaz rol={usuario?.rol ?? "desconocido"} />;
  }
  return (
  <div className="min-h-screen bg-[var(--fondo)]">
      {/* Cabecero de ancho completo */}
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

      {/* Pestañas */}
      <div className="border-b border-[var(--borde)] bg-[var(--superficie)]">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          <BotonPestana activa={pestana === "turno"} onClick={() => setPestana("turno")}>
            Turno
          </BotonPestana>
          <BotonPestana activa={pestana === "resumen"} onClick={() => setPestana("resumen")}>
            Resumen
          </BotonPestana>
          <BotonPestana activa={pestana === "lotes"} onClick={() => setPestana("lotes")}>
            Lotes
          </BotonPestana>
        </div>
      </div>

      {/* Contenido: se adapta al ancho disponible, sin quedarse en
          una tira estrecha en pantallas grandes ni desbordarse en
          móvil */}
      <main className="mx-auto max-w-6xl p-4">
        {pestana === "turno" ? (
          <TurnoScreen />
        ) : pestana === "resumen" ? (
          <ResumenScreen />
        ) : (
          <GestionLotes />
        )}
      </main>
    </div>
  );
}

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
      className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
        activa
          ? "border-[var(--acento)] text-[var(--texto)]"
          : "border-transparent text-[var(--texto-tenue)] hover:text-[var(--texto-secundario)]"
      }`}
    >
      {children}
    </button>
  );
}