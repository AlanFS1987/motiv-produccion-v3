// frontend/src/components/ThemeSwitcher.tsx
// Selector de tema — 5 puntos de color, mismo concepto que v2.
// Se coloca en la cabecera de cualquier shell (Operario, Responsable,
// Jefe, Administrador, Pantalla): un único componente, reutilizado.

import { useTheme, TEMAS } from "../context/ThemeContext";

export function ThemeSwitcher() {
  const { tema, setTema } = useTheme();

  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Selector de tema">
      {TEMAS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={tema === t.id}
          title={t.nombre}
          onClick={() => setTema(t.id)}
          className={`h-5 w-5 rounded-full ring-offset-2 transition ${
            tema === t.id ? "ring-2 ring-[var(--acento)]" : "opacity-70 hover:opacity-100"
          }`}
          style={{ background: t.colorPunto }}
        />
      ))}
    </div>
  );
}