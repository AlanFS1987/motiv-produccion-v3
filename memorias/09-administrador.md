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

## Por construir

- **Fusión de modelos/marcas/productos/lotes duplicados** — el OCR
  puede crear un registro nuevo por un typo o variación de nombre
  cuando en realidad ya existía uno. Sin pantalla; hoy se corrige a
  mano por SQL.
- **Corrección de partes sin límite de tiempo** — el responsable solo
  puede corregir su propio parte durante 1h (política RLS); el admin
  ya tiene permiso de `UPDATE`/`DELETE` en `parte` sin esa ventana
  (confirmado en RLS, 20/08/2026), solo falta la pantalla.
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
