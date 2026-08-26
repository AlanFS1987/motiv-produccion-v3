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
- **Prueba de cámara** (`admin/PruebaCamaraScreen.tsx`) — pestaña
  "Cámara", solo de test, no toca ningún parte ni sube nada a
  Cloudinary. Deja probar **tanto la cámara nativa** (`<input
  capture="environment">`, el método que usaba v2 y que el resto de
  la app abandonó por el bug de recarga) **como la cámara en vivo del
  navegador** (`useCamaraLive`, el método actual en producción), una
  junto a la otra, para comparar nitidez/tamaño de archivo y
  comprobar si el bug de recarga sigue dándose en el dispositivo de
  turno.

  **Investigación cerrada por el momento (sesión 26/08/2026)**: se
  probaron varias correcciones a distintos niveles durante horas
  (sin éxito, sin listar aquí cada intento individual) y el bug
  persiste. Se confirmó además que **no es un problema de gama del
  dispositivo**: se probó en un Redmi Note 12 Pro+ (gama media-alta,
  el mismo modelo ya probado en sesión 21/08/2026) con la batería en
  modo "Máximo rendimiento" (sin ninguna restricción de MIUI activa)
  y el bug sigue dándose igual — descarta tanto "falta de RAM" como
  "gestión agresiva de batería de MIUI" como causa.

  Hipótesis final, sin confirmar: **descarte de pestañas en segundo
  plano por el propio Chrome** (`chrome://discards`), independiente de
  MIUI — al abrir la app de Cámara nativa, la pestaña pasa a segundo
  plano de verdad (como cambiar de app) y Chrome puede liberar su
  memoria por su cuenta; a diferencia de las apps nativas, no existe
  ningún ajuste de usuario para eximir una pestaña concreta de esto.
  Si esta hipótesis es correcta, no hay arreglo posible desde el
  código de la app ni desde ajustes del sistema — solo evitar el
  patrón `<input capture>` por completo, que es lo que ya se hace en
  producción con `useCamaraLive`.

  **Solución permanente**: cámara en vivo (`useCamaraLive`), ya en
  producción en todos los flujos reales — la pestaña nunca pierde el
  foco, así que nunca se dispara el descarte. La cámara nativa se
  mantiene solo aquí, en esta pantalla de test, por si en el futuro
  cambia el comportamiento de Chrome/MIUI y vale la pena reconsiderarla.

  **Línea abierta, sin plan concreto todavía**: probar el mismo flujo
  con la app instalada como PWA (modo standalone) en vez de como
  pestaña de Chrome — conectado con el punto de PWA en `07`,
  "Por construir". Expectativa baja: si la causa real es el descarte
  de Chrome y no la gestión de apps de MIUI, pasar a PWA no debería
  cambiar nada (ya se descartó también la vía de la excepción de
  batería, que sí aplicaría distinto a una PWA instalada que a una
  pestaña suelta).

- **Cambio de rol** (`admin/AjustarLetrasScreen.tsx`, mismo lib
  `admin-usuarios.ts`) — en la misma pantalla de Rotación, además de
  la letra, se puede cambiar el rol de cualquier usuario entre
  responsable/suplente/operario/jefe/producción/calidad.