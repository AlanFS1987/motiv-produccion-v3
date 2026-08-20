import { useCallback, useEffect, useState } from "react";
import { LogOut, Home, Factory, History, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cerrarSesion } from "../../lib/auth";
import { calcularTurnoActual, calcularTurnoActualSuplente, type TurnoActual } from "../../lib/rotacion";
import { obtenerTurnoPorFechaTipo } from "../../lib/resumen-turno";
import { esRefuerzo } from "../../lib/turno";
import { InicioOperarioScreen } from "./InicioOperarioScreen";
import { MiLineaScreen } from "./MiLineaScreen";
import { HistorialOperarioScreen } from "./HistorialOperarioScreen";
import { LimpiezaScreen } from "./LimpiezaScreen";

// Orden pedido en sesión (19/08/2026): Inicio, Mi línea, Historial,
// Limpieza — distinto del orden de exploración inicial de
// 03-rol-operario.md 5.0. Solo una barra por ahora: la de
// gamificación (Ranking/Stats/Logros) queda pospuesta (08-pendientes.md).
type Pestana = "inicio" | "mi_linea" | "historial" | "limpieza";

const NOMBRE_TIPO: Record<"M" | "T" | "N", string> = { M: "Mañana", T: "Tarde", N: "Noche" };

export function OperarioApp() {
  const { usuario } = useAuth();
  const [pestana, setPestana] = useState<Pestana>("inicio");

  // turnoInfoPersonal: SOLO para el mensaje de Inicio ("hoy es tu
  // descanso") — se calcula por la rotación de SU letra. NO se usa
  // para decidir qué turnoId cargar en Mi línea/Limpieza (ver
  // turnoActivo más abajo) — mezclar ambas cosas fue el bug real
  // detectado en sesión: un operario cubriendo/cambiando de turno (más
  // habitual que un responsable haciéndolo) quedaba con turnoId=null
  // porque su rotación personal no coincidía con el turno en el que
  // de verdad estaba.
  const [turnoInfoPersonal, setTurnoInfoPersonal] = useState<TurnoActual | null>(null);

  // turnoActivo: el turno que está pasando AHORA MISMO por reloj,
  // letra-agnóstico (misma función que ya usa el responsable
  // suplente) — determina qué turnoId cargar en Mi línea/Limpieza,
  // independientemente de si es "su" letra o no.
  const [turnoActivo, setTurnoActivo] = useState<TurnoActual | null>(null);
  const [turnoId, setTurnoId] = useState<string | null>(null);

  // pertenece: ¿este operario tiene algo que hacer en turnoActivo?
  // Dos caminos, ninguno más (decisión de sesión 19/08/2026): su
  // letra coincide con la de turnoActivo, o está dado de alta como
  // refuerzo de ese turno (refuerzo_operario_turno). Si ninguno de
  // los dos se cumple, se trata igual que "sin turno" — no se le
  // muestran líneas ni limpieza de un turno ajeno.
  const [pertenece, setPertenece] = useState(false);

  const [cargandoTurno, setCargandoTurno] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarTurno = useCallback(async () => {
    if (!usuario) return;
    setCargandoTurno(true);
    setError(null);
    try {
      // 1) Mensaje personal de Inicio (rotación de su letra).
      const infoPersonal = usuario.letra ? await calcularTurnoActual(usuario.letra) : null;
      setTurnoInfoPersonal(infoPersonal);

      // 2) Turno real activo ahora mismo, por reloj puro — igual que
      // ya hace calcularTurnoActualSuplente para el responsable
      // suplente, reutilizado aquí para CUALQUIER operario.
      const activo = await calcularTurnoActualSuplente();
      setTurnoActivo(activo);

      if ((activo.estado === "abierto" || activo.estado === "en_revision") && activo.fecha && activo.tipo) {
        const turno = await obtenerTurnoPorFechaTipo(activo.fecha, activo.tipo);

        if (!turno || turno.cerrado_at) {
          setTurnoId(null);
          setPertenece(false);
          return;
        }

        // 3) Pertenencia: su letra coincide con la de ESTE turno
        // concreto (no basta con que su rotación general diga
        // "abierto" — hay que comprobar que sea justo este
        // fecha+tipo), o está de refuerzo.
        const perteneceLetra =
          infoPersonal !== null &&
          infoPersonal.fecha === activo.fecha &&
          infoPersonal.tipo === activo.tipo &&
          (infoPersonal.estado === "abierto" || infoPersonal.estado === "en_revision");

        const perteneceRefuerzo = perteneceLetra ? false : await esRefuerzo(turno.id, usuario.id);

        setTurnoId(turno.id);
        setPertenece(perteneceLetra || perteneceRefuerzo);
      } else {
        setTurnoId(null);
        setPertenece(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCargandoTurno(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargarTurno();
  }, [cargarTurno]);

  // El turnoId que se pasa a Mi línea/Limpieza es null si no
  // pertenece — así ambas pantallas muestran su mensaje de "sin
  // turno" en vez de intentar cargar datos de un turno ajeno.
  const turnoIdParaOperario = pertenece ? turnoId : null;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">
            Conectado como <strong className="text-slate-900">{usuario?.username}</strong>
          </span>
          <button
            onClick={() => cerrarSesion()}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-200"
          >
            <LogOut size={16} aria-hidden />
            Salir
          </button>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          <BotonPestana activa={pestana === "inicio"} onClick={() => setPestana("inicio")} icono={<Home size={16} />}>
            Inicio
          </BotonPestana>
          <BotonPestana activa={pestana === "mi_linea"} onClick={() => setPestana("mi_linea")} icono={<Factory size={16} />}>
            Mi línea
          </BotonPestana>
          <BotonPestana activa={pestana === "historial"} onClick={() => setPestana("historial")} icono={<History size={16} />}>
            Historial
          </BotonPestana>
          <BotonPestana activa={pestana === "limpieza"} onClick={() => setPestana("limpieza")} icono={<Sparkles size={16} />}>
            Limpieza
          </BotonPestana>
        </div>
      </div>

      <main className="mx-auto max-w-6xl p-4">
        {error && <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {pestana === "inicio" && (
          <InicioOperarioScreen turnoInfo={turnoInfoPersonal} cargando={cargandoTurno} nombreTipo={NOMBRE_TIPO} />
        )}

        {pestana === "mi_linea" && (
          <MiLineaScreen
            turnoInfo={turnoActivo}
            turnoId={turnoIdParaOperario}
            pertenece={pertenece}
            cargandoTurno={cargandoTurno}
            nombreTipo={NOMBRE_TIPO}
          />
        )}

        {pestana === "historial" && <HistorialOperarioScreen />}

        {pestana === "limpieza" && (
          <LimpiezaScreen
            turnoInfo={turnoActivo}
            turnoId={turnoIdParaOperario}
            pertenece={pertenece}
            cargandoTurno={cargandoTurno}
            nombreTipo={NOMBRE_TIPO}
          />
        )}
      </main>
    </div>
  );
}

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
      className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${
        activa ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      {icono}
      {children}
    </button>
  );
}