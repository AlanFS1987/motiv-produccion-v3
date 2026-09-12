-- Acceso a NORA (copiloto de averías por voz) vía chat_acceso — mismo
-- patrón que Ceria (20260907180000_chat_acceso_por_rol.sql). No hace
-- falta tocar esquema: tipo_chat es texto libre en chat_acceso, sin
-- check constraint que ampliar.
--
-- Semilla inicial: jefe + administrador, igual que se hizo con Ceria
-- al principio (sesión 07/09/2026) — el admin puede añadir/quitar
-- roles después desde ChatAccesoScreen.tsx sin ninguna migración
-- nueva, exactamente como ya hace con Ceria.

insert into chat_acceso (tipo_chat, rol, puede_ver, puede_escribir)
values ('nora', 'jefe', true, true), ('nora', 'administrador', true, true)
on conflict (tipo_chat, rol) do nothing;
