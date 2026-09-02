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
  Tono y calibre son editables al corregir (campos con
  `esTonoCalibreValido`, corregido 21/08/2026 para admin y responsable).
- **Añadir parte a un turno ya cerrado**
  (`admin/AdminNuevoParteScreen.tsx`) — pestaña "Añadir parte".
  Complementa a la anterior: esa permite EDITAR partes que ya
  existen, esta permite CREAR uno que nunca llegó a insertarse.

  Caso real que lo motivó (sesión 02/09/2026): un responsable en su
  primer turno no pudo abrir un segundo parte en una línea (el
  primero seguía pendiente, `uq_parte_pendiente_por_linea_turno`,
  ver `06`) y cerró el turno sin completarlo — el primer parte quedó
  huérfano y el segundo nunca se creó.

  El admin busca el turno por fecha+tipo con `obtenerTurnoPorFechaTipo`
  (lib/resumen-turno.ts, SIN crearlo si no existe — a diferencia de
  `obtenerOCrearTurno`) y, si lo encuentra, monta directamente
  `CapturaParteScreen` — el mismo wizard del responsable, sin ningún
  candado de "turno abierto". No hizo falta ninguna migración: la
  política `parte_insert_responsable` ya incluía `'administrador'`
  desde el principio (`20260101000010_rls.sql`) y no hay ningún
  trigger que bloquee un INSERT en `parte` por `turno.cerrado_at` — el
  único candado que existía era de UI (`TurnoScreen` solo monta el
  wizard para "mi turno de hoy").

  El turno **no se reabre**: `cerrado_at` se deja tal cual para no
  disparar de nuevo el envío del resumen a Telegram. Si la línea+turno
  ya tenía un parte pendiente huérfano, `CapturaParteScreen` lo
  detecta solo (`obtenerPartePendiente`) y retoma el wizard donde se
  quedó — mismo camino que "Continuar parte" del responsable, sin
  lógica especial aquí para ese caso. Si no había ninguno, arranca un
  parte nuevo desde "hoja" (segunda orden real para esa línea).
  `responsable_id` del parte insertado queda como el admin que lo
  crea, no el responsable original — mismo criterio que
  `CorreccionPartesScreen`.
- **Prueba de cámara** (`admin/PruebaCamaraScreen.tsx`) — pestaña
  "Cámara", solo de test, no toca ningún parte ni sube nada a
  Cloudinary. Deja probar **tanto la cámara nativa** (`<input
  capture="environment">`, el método que usaba v2 y que el resto de
  la app abandonó por el bug de recarga) **como la cámara en vivo del
  navegador** (`useCamaraLive`, el método actual en producción), una
  junto a la otra, para comparar nitidez/tamaño de archivo y
  comprobar si el bug de recarga sigue dándose en el dispositivo de
  turno.

  **Investigación cerrada (sesión 26/08/2026) — causa real encontrada y corregida**: se
  probaron varias correcciones a distintos niveles durante horas
  (sin éxito, sin listar aquí cada intento individual) y el bug
  persiste. Se confirmó además que **no es un problema de gama del
  dispositivo**: se probó en un Redmi Note 12 Pro+ (gama media-alta,
  el mismo modelo ya probado en sesión 21/08/2026) con la batería en
  modo "Máximo rendimiento" (sin ninguna restricción de MIUI activa)
  y el bug sigue dándose igual — descarta tanto "falta de RAM" como
  "gestión agresiva de batería de MIUI" como causa.

  **[RESUELTO 26/08/2026] Causa real encontrada, no era descarte de
  pestaña ni un bug de React**: la hipótesis del descarte de Chrome
  (`chrome://discards`) de arriba quedó descartada con
  `document.wasDiscarded === false` al reproducir en la PWA instalada.
  El verdadero culpable era un bug en `AuthContext.tsx`: Supabase
  reemite el evento `SIGNED_IN` (no solo `TOKEN_REFRESHED`, que era lo
  único contemplado) al recuperar el foco — y abrir la cámara nativa
  cuenta como perder y recuperar el foco. La guarda que ya existía
  para ignorar refrescos de sesión sin cambios reales comparaba contra
  la variable `usuario` capturada en un closure obsoleto (el efecto de
  `onAuthStateChange` se crea una sola vez al montar, `deps=[]`), así
  que ese valor quedaba congelado en `null` para siempre y la guarda
  nunca se cumplía. Cada `SIGNED_IN` disparaba `setCargando(true)` →
  pantalla completa de "Cargando..." → recarga del perfil → toda la
  app se desmontaba y volvía a montar desde cero, perdiendo cualquier
  estado en curso (foto de la cámara incluida). Este era también el
  motivo por el que el intento anterior de arreglarlo (commit
  `b50a6d0`) nunca llegó a funcionar de verdad, pese a que el
  comentario del código decía que ya estaba solucionado.

  Confirmado con un `console.log(evento)` temporal en consola remota:
  salía `SIGNED_IN`, nunca `TOKEN_REFRESHED`, con la app ya
  autenticada.

  Fix aplicado en `AuthContext.tsx`: la guarda ahora comprueba
  `usuarioRef.current` (el ref que ya existía para este propósito,
  pero que no se estaba usando en el sitio correcto) en vez de
  `usuario`, cubre tanto `TOKEN_REFRESHED` como `SIGNED_IN`, y añade
  una comprobación extra de que el `id` de usuario coincide antes de
  saltarse la recarga — para no ignorar por error un `SIGNED_IN` de un
  usuario distinto (login real desde `Login.tsx`).

  **Alcance real del fix**: no es solo un arreglo de la cámara. Afecta
  a cualquier situación en la que la PWA/pestaña pierda y recupere el
  foco (bloquear pantalla, cambiar de app, notificaciones) — antes de
  este fix, cualquier jefe/admin que hiciera eso mientras trabajaba
  podía perder su pestaña activa y sus datos cargados sin previo
  aviso, no solo al usar la cámara.

  La cámara nativa (`<input capture>`) se mantiene solo en esta
  pantalla de test; producción sigue usando `useCamaraLive` (nunca
  pierde el foco, así que nunca disparaba este bug de todos modos) —
  sin necesidad ya de reconsiderar el cambio a `<input capture>` en
  producción, pero el fix de `AuthContext.tsx` protege por igual a
  toda la app independientemente de qué método de cámara se use.

- **Cambio de rol** (`admin/AjustarLetrasScreen.tsx`, mismo lib
  `admin-usuarios.ts`) — en la misma pantalla de Rotación, además de
  la letra, se puede cambiar el rol de cualquier usuario entre
  responsable/suplente/operario/jefe/producción/calidad.