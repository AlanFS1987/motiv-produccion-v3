-- 03/10/2026 — operario_ledger (vista base de los puntos, sin prefijo v_) se escapó de la
-- revocación de vistas v_*. Sin consumidores en el frontend; anon ya fallaba por fn_ciclo_id
-- (revocada en M3), pero el permiso seguía concedido.
revoke all on operario_ledger from anon;
