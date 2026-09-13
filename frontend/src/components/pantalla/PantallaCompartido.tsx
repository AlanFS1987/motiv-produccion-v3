// frontend/src/components/pantalla/PantallaCompartido.tsx
// Lo que comparten varias diapositivas del carrusel: los 3 estados
// genéricos (cargando/error/vacío) y el Donut (usado por Últimos
// modelos y Últimos turnos). Lo usado por una sola diapositiva
// (NOMBRE_TURNO, COLOR_MEDALLA...) sigue viviendo en su propio
// archivo de diapositiva, no aquí.

// Donut SVG simple (2-3 segmentos), sin librería externa.
export function Donut({ segmentos, size = 90 }: { segmentos: { valor: number; color: string }[]; size?: number }) {
  // Grosor del anillo — este es el único sitio donde tocarlo; antes
  // estaba repetido como strokeWidth={10} en dos círculos distintos
  // (fondo + cada segmento), que siempre tienen que ir iguales entre
  // sí. El radio resta grosor/2 (para que el trazo no se salga del
  // viewBox) + un margen de 2px de seguridad.
  const grosor = 25;
  const radio = size / 2 - grosor / 2 - 2;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radio} fill="none" stroke="var(--superficie-alt)" strokeWidth={grosor} />
      {segmentos.map((s, i) => {
        const largo = (s.valor / 100) * circunferencia;
        const dasharray = `${largo} ${circunferencia - largo}`;
        const offset = -((acumulado / 100) * circunferencia);
        acumulado += s.valor;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radio}
            fill="none"
            stroke={s.color}
            strokeWidth={grosor}
            strokeDasharray={dasharray}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}

export function SlideCargando() {
  return <div className="flex h-full items-center justify-center text-[var(--texto-tenue)]">Cargando...</div>;
}

export function SlideError({ mensaje }: { mensaje: string }) {
  return <div className="flex h-full items-center justify-center px-8 text-center text-red-400">{mensaje}</div>;
}

export function SlideVacio({ mensaje }: { mensaje: string }) {
  return <div className="flex h-full items-center justify-center text-[var(--texto-tenue)]">{mensaje}</div>;
}
