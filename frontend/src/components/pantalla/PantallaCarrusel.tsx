// frontend/src/components/pantalla/PantallaCarrusel.tsx
// Pantalla de fábrica (rol 'pantalla', CON login — decisión de
// sesión: no se puede abrir la URL desde cualquier sitio y ver datos
// de producción sin autenticarse). Este archivo es solo el shell:
// cabecera, reloj, escalado a resolución, temporizador del carrusel
// y puntos de navegación. Cada diapositiva vive en su propio archivo
// (mismo patrón que admin/AdminApp.tsx con sus pestañas):
//   1. SlideProduccionCiclo — v_produccion_turno + v_calidad_turno
//   2. SlideUltimosModelos — v_calidad_modelo
//   3. SlideUltimosTurnos — v_produccion_turno, KPI1/KPI2 calculados ahí
//   4. SlideRanking — ciclo actual, sin toggle (misma lib/ranking.ts
//      que usa el operario; no hay "tu posición" aquí)
//   5. SlideReyesFormato — histórico + ciclo actual (misma lib)

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { cerrarSesion } from "../../lib/auth";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { SlideProduccionCiclo } from "./SlideProduccionCiclo";
import { SlideUltimosModelos } from "./SlideUltimosModelos";
import { SlideUltimosTurnos } from "./SlideUltimosTurnos";
import { SlideRanking } from "./SlideRanking";
import { SlideReyesFormato } from "./SlideReyesFormato";

const DURACION_SLIDE_MS = 12_000;

// ── Escalado a distintas resoluciones ──────────────────────────────
// Todo el carrusel se diseña y se mide a una resolución de
// referencia fija (1920×1080, la que ya se validó en local) y se
// escala entero con transform: scale() al tamaño real de la ventana
// — más simple y más fiable que convertir cada tamaño fijo de cada
// diapositiva a unidades relativas (vw/clamp), y garantiza las
// MISMAS proporciones en cualquier monitor, sea 1080p o el de mayor
// resolución de la fábrica. Se usa Math.min(escalaX, escalaY) para
// escalar de forma uniforme sin deformar nada — si la pantalla real
// no es exactamente 16:9, sobra un margen del color de fondo del
// tema a los lados o arriba/abajo, en vez de estirar el contenido.
const ANCHO_BASE = 1920;
const ALTO_BASE = 1080;

function calcularEscala(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.innerWidth / ANCHO_BASE, window.innerHeight / ALTO_BASE);
}

function useEscalaPantalla(): number {
  const [escala, setEscala] = useState(calcularEscala);
  useEffect(() => {
    const actualizar = () => setEscala(calcularEscala());
    window.addEventListener("resize", actualizar);
    return () => window.removeEventListener("resize", actualizar);
  }, []);
  return escala;
}

// ── Reloj en vivo de la cabecera ──────────────────────────────────
function useRelojEnVivo() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return ahora;
}

const SLIDES = [
  { componente: SlideProduccionCiclo },
  { componente: SlideUltimosModelos },
  { componente: SlideUltimosTurnos },
  { componente: SlideRanking },
  { componente: SlideReyesFormato },
];

export function PantallaCarrusel({ username }: { username: string }) {
  const [slideActual, setSlideActual] = useState(0);
  const ahora = useRelojEnVivo();
  const escala = useEscalaPantalla();

  // setTimeout (no setInterval) reiniciado en cada cambio de
  // slideActual — así, si alguien salta a una diapositiva a mano
  // tocando un punto de navegación, los 12s se cuentan de nuevo desde
  // ahí en vez de seguir la cuenta que llevaba el temporizador desde
  // el montaje (antes: un clic manual justo antes de que tocara
  // avanzar solo, y la pantalla saltaba casi al instante otra vez).
  useEffect(() => {
    const id = setTimeout(() => setSlideActual((i) => (i + 1) % SLIDES.length), DURACION_SLIDE_MS);
    return () => clearTimeout(id);
  }, [slideActual]);

  // Flechas ← → del teclado — mismo setSlideActual que los puntos de
  // navegación, así que el useEffect de arriba ya reinicia los 12s
  // solo, sin tocar nada más.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSlideActual((i) => (i + 1) % SLIDES.length);
      else if (e.key === "ArrowLeft") setSlideActual((i) => (i - 1 + SLIDES.length) % SLIDES.length);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  const SlideComponente = SLIDES[slideActual].componente;

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-[var(--fondo)]">
      <div
        className="flex shrink-0 flex-col bg-[var(--fondo)] text-[var(--texto)]"
        style={{ width: ANCHO_BASE, height: ALTO_BASE, transform: `scale(${escala})` }}
      >
        <header className="flex items-center justify-between border-b border-[var(--borde)] px-6 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[var(--acento)]">MOTIV</span>
            <span className="text-sm tracking-wide text-[var(--texto-secundario)]">PRODUCCIÓN</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--texto-secundario)]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {ahora.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })} —{" "}
              {ahora.toLocaleTimeString("es-ES")}
            </span>
            <ThemeSwitcher />
            <button
              onClick={() => cerrarSesion()}
              className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--superficie-alt)]"
              title={`Conectado como ${username}`}
            >
              <LogOut size={14} aria-hidden />
              Salir
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          <SlideComponente />
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-[var(--borde)] py-3">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideActual(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === slideActual ? "w-8 bg-[var(--acento)]" : "w-1.5 bg-[var(--borde)]"
              }`}
              aria-label={`Ir a la diapositiva ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}