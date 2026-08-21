interface RolSinInterfazProps {
  rol: string;
}

/**
 * Pantalla de aviso para cuentas cuyo rol no tiene todavía una
 * interfaz construida en la app (rol nuevo en la BD sin shell propio
 * asignado, o un valor inesperado/desconocido). Antes de esto, estos
 * casos caían por defecto al shell de responsable y fallaban en
 * silencio contra RLS — ver memorias/07-pendientes.md.
 */
export function RolSinInterfaz({ rol }: RolSinInterfazProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-center">
      <div>
        <p className="text-lg font-medium text-slate-900">
          Tu cuenta todavía no tiene una pantalla asignada
        </p>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Tu rol («{rol}») existe en el sistema pero no tiene una interfaz
          construida todavía. Contacta con el administrador.
        </p>
      </div>
    </div>
  );
}