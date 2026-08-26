// frontend/src/components/responsable/HistorialResponsableScreen.tsx
//
// Historial de partes propio (sesión 25/08/2026) — reutiliza
// VistaDetalladaScreen del jefe TAL CUAL (mismo acordeón turno →
// línea → parte), solo fijando el filtro de responsable al propio
// usuario y ocultando el selector (ver el prop nuevo
// `responsableFijo` añadido en VistaDetalladaScreen.tsx). El
// responsable ya tiene el mismo SELECT amplio que el jefe sobre
// parte/turno/incidencia_* — sin RLS nueva.

import { useAuth } from "../../context/AuthContext";
import { VistaDetalladaScreen } from "../jefe/VistaDetalladaScreen";

export function HistorialResponsableScreen() {
  const { usuario } = useAuth();
  if (!usuario) return null;
  return <VistaDetalladaScreen responsableFijo={usuario.username} />;
}
