// frontend/src/components/jefe/programacion/ProgramacionScreen.tsx
//
// Pestaña "Programación" del jefe. Solo el contenedor de las 2
// sub-pestañas — la lógica de cada una vive en su propio archivo
// (refactor de sesión, el archivo único había llegado a 746 líneas):
//   - ProgramacionRevisar.tsx — pegar CSV + diff editable + confirmar
//     + deshacer.
//   - ProgramacionConsultar.tsx — lista con estado en vivo + copiar +
//     exportar/imprimir.
// Detalle completo del diseño en memorias/20-programacion.md.

import { useState } from "react";
import { ProgramacionConsultar } from "./ProgramacionConsultar";
import { ProgramacionRevisar } from "./ProgramacionRevisar";

type SubVista = "revisar" | "consultar";

export function ProgramacionScreen() {
  const [vista, setVista] = useState<SubVista>("consultar");

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex gap-1 border-b border-slate-200 px-4 print:hidden">
        <button
          type="button"
          onClick={() => setVista("consultar")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            vista === "consultar"
              ? "border-[var(--acento)] text-[var(--texto)]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Consultar
        </button>
        <button
          type="button"
          onClick={() => setVista("revisar")}
          className={`border-b-2 px-3 py-2 text-sm font-medium ${
            vista === "revisar"
              ? "border-[var(--acento)] text-[var(--texto)]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Revisar
        </button>
      </div>

      {vista === "consultar" ? <ProgramacionConsultar /> : <ProgramacionRevisar />}
    </div>
  );
}
