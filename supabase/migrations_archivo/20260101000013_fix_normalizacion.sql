-- =============================================================
-- 0013 — Corrección de fn_normalizar_texto
--
-- La versión de 0003_catalogos.sql solo hacía mayúsculas + colapsar
-- espacios; no implementaba la regla completa de 01-rol-responsable.md
-- 3.2 / 05-modelo-de-datos.md 7.4: conservar letras (incluida Ñ y
-- vocales acentuadas), números, espacios y los símbolos - / . & ;
-- sustituir el resto por un espacio. Detectado al probar la Edge
-- Function resolver-catalogo con "café" → se comía la tilde.
-- =============================================================

create or replace function fn_normalizar_texto(p_texto text)
returns text
language sql immutable as $$
  select trim(
    regexp_replace(
      regexp_replace(upper(p_texto), '[^A-ZÑÁÉÍÓÚÜ0-9\s\-/.&]', ' ', 'g'),
      '\s+', ' ', 'g'
    )
  );
$$;

-- Re-normaliza los registros ya existentes (si los hubiera) para que
-- queden coherentes con la regla corregida — dispara los triggers
-- BEFORE UPDATE OF nombre ya definidos en 0003_catalogos.sql.
update modelo set nombre = nombre;
update marca set nombre = nombre;
