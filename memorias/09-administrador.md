# 09 — Panel de administrador

Shell propio (`admin/AdminApp.tsx`), se muestra cuando `usuario.rol =
'administrador'`. El admin ve **todo** lo que ve el jefe (Vista
Rápida, Vista Detallada, Incidencias, Ceria — reutilizando
literalmente los componentes de `jefe/`, no duplicados) más sus
propias pestañas de gestión.

## Construido

- **Rotación** (`admin/AjustarLetrasScreen.tsx`, `lib/admin-usuarios.ts`)
  — cambiar la letra A/B/C/D de cualquier responsable u operario.
  Guardado inmediato por fila (sin botón "guardar todo"), con
  indicador de éxito/error junto al desplegable. Un simple `UPDATE`
  sobre `usuario.letra`, ya permitido por la política RLS
  `usuario_update_admin` — no hizo falta ninguna migración nueva.
  Aviso explícito en pantalla: cambiar la letra afecta a qué turno le
  toca **a partir de ahora**, nunca reescribe partes ya creados
  (`parte.operario_id` sigue siendo la fuente de verdad de quién hizo
  qué).
- **Corrección de partes sin límite de tiempo**
  (`admin/CorreccionPartesScreen.tsx`, `lib/admin-partes.ts`) —
  buscador (fecha desde/hasta, turno, línea, responsable) sobre
  partes vigentes+completados sin restringir a "hoy" ni a la ventana
  de 1h del responsable (máx. 150 resultados). Al seleccionar uno,
  reutiliza `obtenerParteDetalle` + `FotoPantallaMaquina` modo
  `"corregir"` tal cual, sin el candado de 1h — la política
  `parte_admin_todo` + el trigger `security definer` (sesión
  20/08/2026) ya lo permiten en BD. `contexto.responsableId` se
  rellena con el admin que corrige, no con el responsable original,
  igual que ya hacía el propio responsable al corregirse a sí mismo.
  Sesión 21/08/2026: de paso se corrigió un fallo que ya existía
  desde antes en `FotoPantallaMaquina` (afecta también al responsable,
  no solo al admin) — el tono/calibre nunca fueron editables al
  corregir un parte, el guardado enviaba siempre los valores
  originales a pelo. Ahora hay campos editables con la misma
  validación que el resto de la app (`esTonoCalibreValido`).
- **Prueba de cámara** (`admin/PruebaCamaraScreen.tsx`) — pestaña
  "Cámara", solo de test, no toca ningún parte ni sube nada a
  Cloudinary. Deja probar **tanto la cámara nativa** (`<input
  capture="environment">`, el método que usaba v2 y que el resto de
  la app abandonó por el bug de recarga en varios Xiaomi) **como la
  cámara en vivo del navegador** (`useCamaraLive`, el método actual en
  producción), una junto a la otra, para comparar nitidez/tamaño de
  archivo y comprobar si el bug de recarga sigue dándose en el
  dispositivo de turno. Confirmado en sesión 21/08/2026 en un Redmi
  Note 12 Pro+: la cámara nativa sigue recargando la app — sigue sin
  ser una opción viable para el flujo real, se mantiene la cámara en
  vivo. Pendiente de investigar la causa exacta (aparentemente ligada
  a que Chrome/MIUI descarta la pestaña en 2º plano, no a falta de
  RAM — a confirmar con `chrome://discards`).

- **Cambio de rol** (`admin/AjustarLetrasScreen.tsx`, mismo lib
  `admin-usuarios.ts`) — en la misma pantalla de Rotación, además de
  la letra, se puede cambiar el rol de cualquier usuario entre
  responsable/suplente/operario/jefe/producción/calidad. Al pasar a
  un rol sin letra se limpia `letra` en el mismo UPDATE. `suplente`
  sigue siendo fila única (índice parcial existente) — el error de
  Postgres se muestra tal cual si se intenta duplicar. Ascender a
  `administrador` está bloqueado con doble barrera: la UI no lo
  ofrece como opción, y además un trigger en BD
  (`fn_bloquear_ascenso_admin`, migración
  `20260821230000_bloquear_ascenso_admin.sql`) rechaza cualquier
  UPDATE que ponga `rol = 'administrador'` viniendo de un rol
  distinto — probado en real forzando el valor desde el inspector del
  navegador. El alta de la primera cuenta admin sigue siendo por SQL
  a mano (INSERT), eso no lo toca el trigger.
- **Cierre de fábrica** (`admin/CierreFabricaScreen.tsx`,
  `lib/admin-cierre-fabrica.ts`) — alta/baja de periodos de
  vacaciones sobre `cierre_fabrica` (listado + formulario
  desde/hasta + eliminar). La tabla y el trigger de bloqueo
  (`fn_bloquear_turno_en_cierre`) ya existían; esto era solo la
  pantalla. Permisos ya cubiertos por la política
  `cierre_fabrica_admin_todo`, sin migración nueva.
- **Checklist de limpieza** (`admin/ChecklistScreen.tsx`,
  `lib/admin-checklist.ts`) — activar/desactivar los 6 ítems de
  `checklist_items` y ajustar sus puntos. Un ítem desactivado
  desaparece de la pantalla de Limpieza del operario
  (`obtenerLineasParaLimpieza` ya filtra `activo = true`); el
  histórico de `operario_checklist` no se toca. Permisos ya cubiertos
  por `checklist_items_admin_todo`, sin migración nueva.

## Por construir

- **Fusión de modelos/marcas/productos/lotes duplicados** — el OCR
  puede crear un registro nuevo por un typo o variación de nombre
  cuando en realidad ya existía uno. Sin pantalla; hoy se corrige a
  mano por SQL. Pendiente de Edge Function con `service_role` (no
  encaja en el patrón de RLS por rol de usuario final).
- **Recalcular ciclo anterior** — bloqueado: depende de que
  `cerrar-ciclo` exista primero (ver `04-gamificacion.md`, pieza con
  fecha límite 28/09/2026). No tiene sentido construir el
  "recalcular" antes que el propio cierre.

## Descartado (decisión de sesión)

- **Alta de usuarios desde la app** — se queda en SQL a mano
  (`Dashboard → Authentication → Add user` + `INSERT` en `usuario`).
  Riesgo de seguridad valorado como mayor que la comodidad ganada,
  dado el tamaño de la fábrica (máx. 30 usuarios): automatizarlo mal
  abriría la puerta a que cualquier fallo de validación de rol en el
  frontend permitiera crear una cuenta `administrador`.
