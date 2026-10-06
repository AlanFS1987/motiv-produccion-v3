-- Añade el operario asignado a la línea+turno en el momento de crear
-- el `parte` (copiado de asignacion_operario_linea, mismo patrón que
-- modelo_id/producto_id/lote_id — ver 05-modelo-de-datos.md 7.4), y
-- la doble capa de verificación del operario (caja + códigos de
-- barras), independiente de la ya existente del responsable.
--
-- Ref. spec: 03-rol-operario.md "Mi línea" (nuevo), 11-esquema-
-- supabase.md 13.2. Sesión 18/08/2026 (tarde).
--
-- A diferencia de la limpieza (5.9), donde cualquier operario del
-- turno puede actuar sobre cualquier línea, la verificación aquí es
-- exclusiva del operario asignado a esa línea (`parte.operario_id`) —
-- por eso NO hace falta ninguna columna "verificado por": el autor ya
-- es operario_id. El operario tampoco tiene opción de confirmación
-- manual (a diferencia del responsable), así que los estados posibles
-- son un subconjunto de los del responsable, sin 'verificado_manual'
-- ni 'manual'.

alter table parte
  add column if not exists operario_id uuid references usuario(id),
  add column if not exists verificacion_caja_estado_operario text
    check (verificacion_caja_estado_operario in ('correcto', 'incorrecto', 'no_verificable')),
  add column if not exists fotos_caja_operario text[],
  add column if not exists verificacion_caja_detalle_operario jsonb,
  add column if not exists verificacion_codbar_estado_operario text
    check (verificacion_codbar_estado_operario in ('completo', 'parcial', 'no_realizada')),
  add column if not exists verificacion_codbar_detalle_operario jsonb;

create index if not exists idx_parte_operario on parte (operario_id);

comment on column parte.operario_id is
  'Operario asignado a esa línea+turno en el momento de crear el '
  'parte — copiado de asignacion_operario_linea al resolver el lote, '
  'no derivado por consulta. Nullable si la línea no tenía operario '
  'asignado en ese momento. Es quien puede verificar este parte en '
  '"Mi línea" (03-rol-operario.md) — a diferencia de la limpieza, '
  'aquí NO puede hacerlo cualquier operario del turno, solo este.';

comment on column parte.verificacion_caja_estado_operario is
  'Verificación de caja hecha por el operario asignado a la línea '
  '(operario_id), independiente de verificacion_caja_estado del '
  'responsable — capa adicional voluntaria, no sustituye ni depende '
  'de la del responsable. Sin estado "verificado_manual": el operario '
  'no tiene opción de confirmación manual, solo OCR real o sin '
  'verificar (estado null). Solo editable mientras completado = '
  'false (sin ventana de corrección posterior, a diferencia del '
  'responsable).';

comment on column parte.fotos_caja_operario is
  'URL(s) de la foto de verificación de caja hecha por el operario. '
  'Mismo patrón que parte.fotos_caja del responsable, pero en su '
  'propia columna para no mezclar autoría.';

comment on column parte.verificacion_caja_detalle_operario is
  'jsonb: array de los 4 campos (marca/modelo/tono/calibre) con '
  'estado + valores leído/esperado — mismo formato que '
  'verificacion_caja_detalle del responsable.';

comment on column parte.verificacion_codbar_estado_operario is
  'Verificación de códigos de barras hecha por el operario asignado a '
  'la línea, independiente de verificacion_codbar_estado del '
  'responsable. Sin estado "manual": mismo criterio que la caja, solo '
  'escaneo real o sin verificar (null).';

comment on column parte.verificacion_codbar_detalle_operario is
  'jsonb: mismo formato que verificacion_codbar_detalle del '
  'responsable — array de los campos con valor esperado en el lote, '
  'cada uno con {campo, etiqueta, valorEsperado, verificado}.';

notify pgrst, 'reload schema';
