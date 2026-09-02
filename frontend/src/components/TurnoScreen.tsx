import { useEffect, useState, useCallback, useRef } from "react";
import { Coffee, Clock, Users, AlertTriangle, ChevronDown, ChevronUp, Eye, Palette, Megaphone, Lock } from "lucide-react";
import { CapturaParteScreen } from "./captura-parte/CapturaParteScreen";
import { DetalleParteScreen } from "./captura-parte/DetalleParteScreen";
import { FormularioIncidencia } from "./incidencias/FormularioIncidencia";
import { ListaIncidenciasProduccion } from "./incidencias/ListaIncidenciasProduccion";
import { useAuth } from "../context/AuthContext";
import { OperariosRefuerzoCard } from "./OperariosRefuerzoCard";
import { obtenerSugerenciasContinuarPorLinea, type SugerenciaContinuar } from "../lib/parte";
import {
  calcularTurnoActual,
  calcularTurnoActualSuplente,
  proximoCambioEstado,
  proximaMedianocheLocal,
  type TurnoActual,
  type TipoTurno,
} from "../lib/rotacion";
import {
  listarLineas,
  listarOperariosParaAsignar,
  obtenerOCrearTurno,
  estaFabricaCerrada,
  listarAsignaciones,
  asignarOperario,
  cerrarTurnoManualmente,
  type Linea,
  type OperarioParaAsignar,
  type Asignacion,
} from "../lib/turno";
import {
  obtenerPartesPendientesPorLinea,
  contarPartesCompletadosPorLinea,
  obtenerPartesCompletadosHoy,
  type ParteResumen,
  type ParteDetalle,
} from "../lib/parte";
import { crearIncidenciaProduccion, contarIncidenciasProduccionPorLinea } from "../lib/incidencias";

const NOMBRE_TIPO: Record<TipoTurno, string> = {
  M: "Mañana",
  T: "Tarde",
  N: "Noche",
};

function formatearHora(fecha: Date | null): string {
  if (!fecha) return "";
  return fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

interface NuevoTonoOrigen {
  linea: Linea;
  loteId: string;
  tonoAnterior: string;
  calibreAnterior: string | null;
}

interface VerEditarOrigen {
  parteId: string;
  linea: Linea;
}

export function TurnoScreen() {
  const { usuario } = useAuth();
  const [turnoInfo, setTurnoInfo] = useState<TurnoActual | null>(null);
  const [turnoId, setTurnoId] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [operarios, setOperarios] = useState<OperarioParaAsignar[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [partesPendientes, setPartesPendientes] = useState<Record<string, ParteResumen>>({});
  const [conteoCompletados, setConteoCompletados] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fabricaCerrada, setFabricaCerrada] = useState(false);
  const [guardandoLinea, setGuardandoLinea] = useState<string | null>(null);
  const [lineaEnCaptura, setLineaEnCaptura] = useState<Linea | null>(null);
  const [lineaConIncidencia, setLineaConIncidencia] = useState<Linea | null>(null);
  const [mostrandoIncidenciaGeneral, setMostrandoIncidenciaGeneral] = useState(false);
  const [refrescarIncidenciasProduccion, setRefrescarIncidenciasProduccion] = useState(0);
  const [lineaIncidenciasDesplegada, setLineaIncidenciasDesplegada] = useState<string | null>(null);
  const [conteoIncidenciasProduccion, setConteoIncidenciasProduccion] = useState<Record<string, number>>({});
  const [sugerenciasContinuar, setSugerenciasContinuar] = useState<Record<string, SugerenciaContinuar>>({});
  
  const [lineaDesplegada, setLineaDesplegada] = useState<string | null>(null);
  const [partesDesplegados, setPartesDesplegados] = useState<ParteDetalle[]>([]);
  const [cargandoDesplegado, setCargandoDesplegado] = useState(false);

  const [verEditar, setVerEditar] = useState<VerEditarOrigen | null>(null);
  const [nuevoTonoOrigen, setNuevoTonoOrigen] = useState<NuevoTonoOrigen | null>(null);
  const [continuarOrigen, setContinuarOrigen] = useState<{ linea: Linea; sugerencia: SugerenciaContinuar } | null>(null);
  const [cerrandoTurno, setCerrandoTurno] = useState(false);
  const cargar = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    setError(null);
    try {
      // El suplente no tiene letra, no le aplica la rotación — se
      // calcula por franja horaria directa (01-rol-responsable.md 3.1).
      let info: TurnoActual;
      if (usuario.rol === "suplente") {
        info = await calcularTurnoActualSuplente();
      } else if (usuario.letra) {
        info = await calcularTurnoActual(usuario.letra);
      } else {
        // Un responsable sin letra asignada es un dato de perfil
        // incompleto, no un caso normal — no se enmascara con un
        // valor por defecto (ver bug real corregido de "letra ?? A").
        throw new Error(
          "Tu perfil de responsable no tiene letra de turno asignada. Contacta con el administrador.",
        );
      }

      // Se calcula primero el turno "de reloj"; si el turno ya existe
      // y ya tiene `cerrado_at` (manual o automático), eso prevalece
      // sobre el cálculo por reloj — por eso no se pide en paralelo
      // con líneas/operarios: hace falta saberlo antes de decidir si
      // merece la pena traer el resto.
      if ((info.estado === "abierto" || info.estado === "en_revision") && info.fecha && info.tipo) {
        // Comprobar el cierre de fábrica ANTES de intentar crear el
        // turno — la rotación nunca se pausa por vacaciones, así que
        // sin este chequeo, `obtenerOCrearTurno` chocaría con el
        // trigger de BD (fn_bloquear_turno_en_cierre) y el
        // responsable vería un error crudo de Postgres en vez de un
        // aviso claro. Detectado en sesión 26/08/2026.
        const cerrada = await estaFabricaCerrada(info.fecha);
        if (cerrada) {
          setFabricaCerrada(true);
          setTurnoInfo(info);
          setTurnoId(null);
          return;
        }
        setFabricaCerrada(false);

        const turno = await obtenerOCrearTurno(info.fecha, info.tipo, usuario.id);

        if (turno.cerrado_at) {
          setTurnoInfo({ ...info, estado: "cerrado" });
          setTurnoId(null);
          return;
        }

        setTurnoInfo(info);
        setTurnoId(turno.id);

        const [listaLineas, listaOperarios] = await Promise.all([
          listarLineas(),
          listarOperariosParaAsignar(usuario.letra, turno.id),
        ]);
        setLineas(listaLineas);
        setOperarios(listaOperarios);
        setAsignaciones(await listarAsignaciones(turno.id));
        setPartesPendientes(await obtenerPartesPendientesPorLinea(turno.id));
        setConteoCompletados(await contarPartesCompletadosPorLinea(turno.id));
        setConteoIncidenciasProduccion(await contarIncidenciasProduccionPorLinea(turno.id));
        setSugerenciasContinuar(await obtenerSugerenciasContinuarPorLinea(turno.id));
      } else {
        setFabricaCerrada(false);
        setTurnoInfo(info);
        setTurnoId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando el turno");
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Recálculo automático del estado con el paso del tiempo (CLAUDE.md,
  // pendiente #1). Se programa un único setTimeout al instante EXACTO
  // del próximo cambio conocido (no un intervalo recurrente) — y se
  // vuelve a comprobar al recuperar el foco de la pestaña, porque el
  // navegador puede pausar temporizadores en segundo plano y perderse
  // el instante mientras la pestaña estaba oculta.
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  // No se debe disparar el refresco en segundo plano (visibilitychange /
  // setTimeout) mientras el responsable está dentro de un flujo de
  // captura activo — cargar() hace setCargando(true), y el render de
  // más abajo comprueba `cargando` ANTES que estos 4 estados, así que
  // desmontaría CapturaParteScreen/DetalleParteScreen a mitad de
  // proceso. Detectado en sesión: abrir la cámara nativa ya dispara
  // visibilitychange (la pestaña pasa a 2º plano mientras la app de
  // Cámara está abierta), así que sin esta guarda, CADA foto "en el
  // acto" perdía el progreso al volver.
  const enFlujoActivoRef = useRef(false);
  enFlujoActivoRef.current =
    lineaEnCaptura !== null ||
    verEditar !== null ||
    nuevoTonoOrigen !== null ||
    continuarOrigen !== null ||
    lineaConIncidencia !== null ||
    mostrandoIncidenciaGeneral;

useEffect(() => {
  if (!turnoInfo) return;

  const ahora = new Date();
  const proximo = proximoCambioEstado(turnoInfo) ?? proximaMedianocheLocal(ahora);
  const demoraMs = Math.max(proximo.getTime() - ahora.getTime(), 1000);

  const timeoutId = window.setTimeout(() => {
    if (!enFlujoActivoRef.current) cargarRef.current();
  }, demoraMs);

  function alRecuperarFoco() {
    if (document.visibilityState === "visible" && !enFlujoActivoRef.current) {
      cargarRef.current();
    }
  }
  document.addEventListener("visibilitychange", alRecuperarFoco);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", alRecuperarFoco);
    };
    // Solo se reprograma cuando cambia el candidato real (estado/tipo/
    // fecha) — no en cada render, ni cada vez que cargar() cambia de
    // identidad (usuario no cambia dentro de una sesión normal).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoInfo?.estado, turnoInfo?.tipo, turnoInfo?.fecha]);

  async function manejarCambioOperario(lineaId: string, operarioId: string) {
    if (!turnoId) return;
    setGuardandoLinea(lineaId);
    try {
      await asignarOperario(turnoId, lineaId, operarioId || null);
      setAsignaciones(await listarAsignaciones(turnoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la asignación");
    } finally {
      setGuardandoLinea(null);
    }
  }

  async function alternarDesplegado(linea: Linea) {
    if (lineaDesplegada === linea.id) {
      setLineaDesplegada(null);
      return;
    }
    setLineaDesplegada(linea.id);
    setCargandoDesplegado(true);
    try {
      setPartesDesplegados(await obtenerPartesCompletadosHoy(turnoId!, linea.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los partes de hoy");
    } finally {
      setCargandoDesplegado(false);
    }
  }

  async function guardarIncidenciaProduccion(descripcion: string, fotos: string[]) {
    if (!turnoId || !lineaConIncidencia || !usuario) return;
    await crearIncidenciaProduccion(turnoId, lineaConIncidencia.id, descripcion, fotos, usuario.id);
    setRefrescarIncidenciasProduccion((n) => n + 1);
    setConteoIncidenciasProduccion(await contarIncidenciasProduccionPorLinea(turnoId));
    setLineaConIncidencia(null);
  }

  async function guardarIncidenciaGeneral(descripcion: string, fotos: string[]) {
    if (!turnoId || !usuario) return;
    await crearIncidenciaProduccion(turnoId, null, descripcion, fotos, usuario.id);
    setRefrescarIncidenciasProduccion((n) => n + 1);
    setMostrandoIncidenciaGeneral(false);
  }

  async function manejarCerrarTurno() {
    if (!turnoId) return;
    setCerrandoTurno(true);
    setError(null);
    try {
      // Solo se escribe en `turno` — el envío del resumen a Telegram
      // lo dispara un trigger de BD sobre `cerrado_at`
      // (20260816230000_resumen_turno_automatico.sql), no el
      // navegador. Mismo patrón que incidencia_calidad/incidencia_
      // producción -> notificar-telegram: el frontend no espera ni
      // reporta el resultado de ese envío, es responsabilidad de la
      // base de datos.
      await cerrarTurnoManualmente(turnoId);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el turno");
    } finally {
      setCerrandoTurno(false);
    }
  }

  if (cargando) {
    return <div className="p-6 text-center text-slate-400">Cargando turno...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">{error}</div>;
  }

  if (fabricaCerrada) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <Lock size={40} className="text-slate-400" aria-hidden />
        <p className="text-lg font-medium text-slate-900">Fábrica cerrada (periodo de vacaciones)</p>
        <p className="max-w-sm text-sm text-slate-500">
          No hay ningún turno que abrir durante este periodo. Puedes seguir
          consultando tus partes, stats y ranking desde el menú.
        </p>
      </div>
    );
  }

  if (!turnoInfo || turnoInfo.estado === "descanso") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <Coffee size={40} className="text-amber-500" aria-hidden />
        <p className="text-lg font-medium text-slate-900">Hoy es tu día de descanso</p>
        <p className="max-w-sm text-sm text-slate-500">
          No hay ningún turno que abrir. Puedes seguir consultando tus partes, stats y ranking desde el menú.
        </p>
      </div>
    );
  }

  if (turnoInfo.estado === "antes") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <Clock size={40} className="text-slate-400" aria-hidden />
        <p className="text-lg font-medium text-slate-900">
          Tu turno de {NOMBRE_TIPO[turnoInfo.tipo!]} empieza a las {formatearHora(turnoInfo.inicioFranja)}
        </p>
        <p className="max-w-sm text-sm text-slate-500">
          Podrás abrirlo desde una hora antes del inicio.
        </p>
      </div>
    );
  }
  if (turnoInfo.estado === "cerrado") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-12 text-center shadow-sm">
        <Clock size={40} className="text-slate-400" aria-hidden />
        <p className="text-lg font-medium text-slate-900">
          Tu turno de {NOMBRE_TIPO[turnoInfo.tipo!]} ya ha terminado
        </p>
        <p className="max-w-sm text-sm text-slate-500">
          Ya no se pueden crear ni editar partes de este turno. Puedes seguir
          consultando tus partes, stats y ranking desde el menú.
        </p>
      </div>
    );
  }

  if (lineaEnCaptura) {
    return (
      <CapturaParteScreen
        turnoId={turnoId!}
        lineaId={lineaEnCaptura.id}
        lineaNombre={lineaEnCaptura.nombre}
        onCancelar={() => {
          setLineaEnCaptura(null);
          cargar();
        }}
        onFinalizado={() => {
          setLineaEnCaptura(null);
          cargar();
        }}
      />
    );
  }

  if (verEditar) {
    return (
      <DetalleParteScreen
        parteId={verEditar.parteId}
        turnoId={turnoId!}
        lineaId={verEditar.linea.id}
        onVolver={() => setVerEditar(null)}
        onCorregido={() => {
          setVerEditar(null);
          cargar();
        }}
      />
    );
  }
  if (continuarOrigen) {
    return (
      <CapturaParteScreen
        turnoId={turnoId!}
        lineaId={continuarOrigen.linea.id}
        lineaNombre={continuarOrigen.linea.nombre}
        origenContinuar={continuarOrigen.sugerencia}
        onCancelar={() => {
          setContinuarOrigen(null);
          cargar();
        }}
        onFinalizado={() => {
          setContinuarOrigen(null);
          cargar();
        }}
      />
    );
  }
  if (nuevoTonoOrigen) {
    return (
      <CapturaParteScreen
        turnoId={turnoId!}
        lineaId={nuevoTonoOrigen.linea.id}
        lineaNombre={nuevoTonoOrigen.linea.nombre}
        origenNuevoTono={{
          loteId: nuevoTonoOrigen.loteId,
          tonoAnterior: nuevoTonoOrigen.tonoAnterior,
          calibreAnterior: nuevoTonoOrigen.calibreAnterior,
        }}
        onCancelar={() => {
          setNuevoTonoOrigen(null);
          cargar();
        }}
        onFinalizado={() => {
          setNuevoTonoOrigen(null);
          cargar();
        }}
      />
    );
  }

  // estado === 'abierto' | 'en_revision'
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white">
          Turno {NOMBRE_TIPO[turnoInfo.tipo!]}
        </span>
        {turnoInfo.estado === "en_revision" && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
            En revisión — no se pueden abrir partes nuevos, solo corregir
          </span>
        )}
        <span className="text-sm text-slate-500">
          {formatearHora(turnoInfo.inicioFranja)} – {formatearHora(turnoInfo.finFranja)}
        </span>
      </div>
      {turnoId && (
        <OperariosRefuerzoCard turnoId={turnoId} onCambio={cargar} />
      )}
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600">
        <Users size={18} aria-hidden />
        Asignación de operarios por línea
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lineas.map((linea) => {
          const asignacion = asignaciones.find((a) => a.linea_id === linea.id);
          const pendiente = partesPendientes[linea.id];
          const completados = conteoCompletados[linea.id] ?? 0;
          const desplegada = lineaDesplegada === linea.id;

          return (
            <div key={linea.id} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="mb-2 font-medium text-slate-900">{linea.nombre}</p>
              <select
                value={asignacion?.operario_id ?? ""}
                onChange={(e) => manejarCambioOperario(linea.id, e.target.value)}
                disabled={guardandoLinea === linea.id || turnoInfo.estado === "en_revision"}
                className="w-full rounded-lg border border-slate-300 p-2 text-sm disabled:opacity-50"
              >
                <option value="">— Sin asignar (fuera de producción) —</option>
                {operarios.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.username}
                    {op.letra ? ` (${op.letra})` : ""}
                  </option>
                ))}
              </select>

              {pendiente ? (
                <div className="mt-2 rounded-lg bg-amber-50 p-2">
                  <p className="text-xs font-medium text-amber-900">
                    {pendiente.marcaNombre} {pendiente.formatoNombre} — {pendiente.modeloNombre}
                  </p>
                  <p className="text-xs text-amber-700">
                    Tono {pendiente.tono}
                    {pendiente.calibre ? ` · Cal. ${pendiente.calibre}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLineaEnCaptura(linea)}
                    className="mt-2 w-full rounded-lg bg-amber-600 py-2 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Continuar parte
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLineaEnCaptura(linea)}
                  disabled={turnoInfo.estado === "en_revision"}
                  className="mt-2 w-full rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600 disabled:opacity-50"
                >
                  Nueva orden
                </button>
              )}

              {(completados > 0 || sugerenciasContinuar[linea.id]) && (
                <button
                  type="button"
                  onClick={() => alternarDesplegado(linea)}
                  className="mt-2 flex w-full items-center justify-center gap-1 text-center text-xs text-slate-400 underline"
                >
                  {completados > 0 ? `Ver partes de hoy (${completados})` : "Turno anterior en esta línea"}
                  {desplegada ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                </button>
              )}

              {desplegada && (
                <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                  {sugerenciasContinuar[linea.id] && completados === 0 && (
                    <div className="rounded-lg bg-blue-50 p-2">
                      <p className="text-xs font-medium text-blue-900">
                        {sugerenciasContinuar[linea.id].marcaNombre} {sugerenciasContinuar[linea.id].formatoNombre} — {sugerenciasContinuar[linea.id].modeloNombre}
                      </p>
                      <p className="mb-1.5 text-xs text-blue-700">
                        Tono {sugerenciasContinuar[linea.id].tono}
                        {sugerenciasContinuar[linea.id].calibre ? ` · Cal. ${sugerenciasContinuar[linea.id].calibre}` : ""}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setContinuarOrigen({ linea, sugerencia: sugerenciasContinuar[linea.id] })}
                          disabled={turnoInfo.estado === "en_revision"}
                          className="flex flex-1 items-center justify-center rounded-md bg-blue-600 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Continuar
                        </button>
                          <button
                          type="button"
                          onClick={() =>
                            setNuevoTonoOrigen({
                              linea,
                              loteId: sugerenciasContinuar[linea.id].loteId,
                              tonoAnterior: sugerenciasContinuar[linea.id].tono,
                              calibreAnterior: sugerenciasContinuar[linea.id].calibre,
                            })
                          }
                          disabled={turnoInfo.estado === "en_revision"}
                          className="flex flex-1 items-center justify-center rounded-md bg-orange-500 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Nuevo tono/calibre
                        </button>
                      </div>
                    </div>
                  )}
                  {cargandoDesplegado ? (
                    <p className="text-center text-xs text-slate-400">Cargando...</p>
                  ) : (
                    partesDesplegados.map((p) => (
                      <div key={p.id} className="rounded-lg bg-slate-50 p-2">
                        <p className="text-xs font-medium text-slate-800">
                          {p.marcaNombre} {p.formatoNombre} — {p.modeloNombre}
                        </p>
                        <p className="mb-1.5 text-xs text-slate-500">
                          Tono {p.tono}
                          {p.calibre ? ` · Cal. ${p.calibre}` : ""}
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setVerEditar({ parteId: p.id, linea })}
                            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white"
                          >
                            <Eye size={12} aria-hidden />
                            Ver-editar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setNuevoTonoOrigen({ linea, loteId: p.loteId, tonoAnterior: p.tono, calibreAnterior: p.calibre })
                            }
                            disabled={turnoInfo.estado === "en_revision"}
                            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-orange-500 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          >
                            <Palette size={12} aria-hidden />
                            Nuevo tono/calibre
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {lineaConIncidencia?.id === linea.id ? (
                <div className="mt-2">
                  <FormularioIncidencia
                    titulo={`Incidencia de producción — ${linea.nombre}`}
                    publicIdPrefijo="INCIDENCIA-PROD"
                    categoria="incidencias-produccion"
                    onGuardar={guardarIncidenciaProduccion}
                    onCancelar={() => setLineaConIncidencia(null)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLineaConIncidencia(linea)}
                  className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-amber-700 underline"
                >
                  <AlertTriangle size={12} aria-hidden />
                  Incidencia de producción
                </button>
              )}

              {(conteoIncidenciasProduccion[linea.id] ?? 0) > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setLineaIncidenciasDesplegada(lineaIncidenciasDesplegada === linea.id ? null : linea.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1 text-center text-xs text-red-500 underline"
                  >
                    Ver incidencias de producción ({conteoIncidenciasProduccion[linea.id]})
                    {lineaIncidenciasDesplegada === linea.id ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                  </button>
                  {lineaIncidenciasDesplegada === linea.id && turnoId && (
                    <ListaIncidenciasProduccion turnoId={turnoId} lineaId={linea.id} refrescarTrigger={refrescarIncidenciasProduccion} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-600">
          <Megaphone size={16} aria-hidden />
          Incidencias generales del turno
        </div>

        {mostrandoIncidenciaGeneral ? (
          <FormularioIncidencia
            titulo="Incidencia general del turno"
            publicIdPrefijo="INCIDENCIA-GENERAL"
            categoria="incidencias-produccion"
            onGuardar={guardarIncidenciaGeneral}
            onCancelar={() => setMostrandoIncidenciaGeneral(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setMostrandoIncidenciaGeneral(true)}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-amber-300 py-2 text-xs font-medium text-amber-700"
          >
            <AlertTriangle size={12} aria-hidden />
            Nueva incidencia general (afecta a todo el turno)
          </button>
        )}

        {turnoId && <ListaIncidenciasProduccion turnoId={turnoId} lineaId={null} refrescarTrigger={refrescarIncidenciasProduccion} />}
      </div>

      <BotonCerrarTurno onConfirmar={manejarCerrarTurno} cerrando={cerrandoTurno} />
    </div>
  );
}

function BotonCerrarTurno({ onConfirmar, cerrando }: { onConfirmar: () => void; cerrando: boolean }) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 py-3 text-sm font-medium text-red-700"
      >
        <Lock size={16} aria-hidden />
        Cerrar turno
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-xl bg-red-50 p-4 text-center">
      <p className="mb-3 text-sm text-red-800">
        Esto cierra el turno para todas las líneas ahora mismo. No se podrán abrir partes nuevos — solo corregir
        los que ya existan, dentro de la ventana habitual de 1h. ¿Confirmas?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={cerrando}
          className="flex-1 rounded-lg border border-slate-300 py-2 text-sm disabled:opacity-50"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={cerrando}
          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {cerrando ? "Cerrando..." : "Sí, cerrar turno"}
        </button>
      </div>
    </div>
  );
}