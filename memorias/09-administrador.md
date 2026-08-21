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

## Por construir

- **Fusión de modelos/marcas/productos/lotes duplicados** — el OCR
  puede crear un registro nuevo por un typo o variación de nombre
  cuando en realidad ya existía uno. Sin pantalla; hoy se corrige a
  mano por SQL.
- **Cierre de fábrica** (`cierre_fabrica`) — tabla y trigger de
  bloqueo (`fn_bloquear_turno_en_cierre`) ya existen; falta el
  formulario para dar de alta un periodo de vacaciones.
- **Checklist de limpieza** (`checklist_items`) — activar/desactivar
  ítems y sus puntos; tabla ya existe, sin pantalla.
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
