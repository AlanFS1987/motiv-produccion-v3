-- =============================================================
-- Niveles: siembra de las 9 filas reales (v2) + eliminación de
-- niveles_responsable como tabla física, sustituida por 2 columnas
-- generadas en la propia `niveles` (×1,5 sobre los umbrales del
-- operario, redondeando y manteniendo tramos contiguos).
--
-- Decisión de sesión 22/08/2026: el responsable sube de nivel algo
-- más rápido que el operario (no igual, no el doble) — ×1,5 encaja
-- con el ritmo real observado en v2 y con las estimaciones de puntos
-- por turno de ambos roles. Al ser un cálculo fijo y derivado, se
-- guarda como columna generada (mismo patrón que
-- parte.calibre_std_pct), nunca como tabla aparte que haya que
-- mantener sincronizada a mano.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Añadir descripcion (existía en la documentación pero no se
--    llegó a crear en la tabla real) y las 2 columnas generadas.
-- -------------------------------------------------------------
alter table niveles
  add column if not exists descripcion text,
  add column umbral_min_responsable int
    generated always as (round(umbral_min * 1.5)::int) stored,
  add column umbral_max_responsable int
    generated always as (
      case when umbral_max is null then null
           else round(umbral_max * 1.5 + 0.5)::int
      end
    ) stored;

comment on column niveles.umbral_min_responsable is
  'Umbral del operario × 1,5, redondeado. Generada — se recalcula '
  'sola si cambia umbral_min, nunca se escribe a mano.';
comment on column niveles.umbral_max_responsable is
  'Umbral del operario × 1,5 + 0,5 (mantiene tramos contiguos sin '
  'huecos entre niveles), redondeado. NULL en el último nivel '
  '(Leyenda), igual que umbral_max.';

-- -------------------------------------------------------------
-- 2) Siembra de los 9 niveles reales (contenido de v2).
-- -------------------------------------------------------------
insert into niveles
  (nombre, umbral_min, umbral_max, descripcion, color_marco, estrellas, efecto_aura, prompt_base, prompt_imagen, orden)
values
  ('Aprendiz', 0, 499,
   'Primeros turnos. Aprendiendo el ritmo de la línea.',
   '#9CA3AF', 1,
   'Sin aura visible. Iluminación suave y neutra.',
   'Operario en sus primeros turnos. Aprende el ritmo de la línea. Uniforme limpio, postura insegura pero con potencial. Inicio de carrera.',
   'Marco simple de metal gris plateado con una estrella gris en la parte superior. El personaje viste uniforme industrial limpio y básico. Postura algo insegura pero con potencial. Iluminación suave. Entorno de fábrica simple al fondo.
Cyberpunk retrofuturista',
   1),

  ('Operario', 500, 1499,
   'Conoce la línea. Cumple con regularidad.',
   '#22C55E', 2,
   'Aura verde leve alrededor del cuerpo, casi imperceptible.',
   'Operario que conoce la línea y cumple con regularidad. Uniforme con uso, herramientas visibles, expresión decidida.',
   'Marco de metal verde con dos estrellas verdes en la parte superior. Leve brillo verde alrededor del personaje. Uniforme con señales de uso, herramientas básicas visibles. Expresión más decidida. Entorno de fábrica activo al fondo.',
   2),

  ('Especialista', 1500, 2999,
   'Domina los formatos. Rendimiento consistente.',
   '#3B82F6', 3,
   'Aura azul moderada, energía industrial visible en manos y hombros.',
   'Especialista que domina los formatos y tiene rendimiento consistente. Postura firme, herramientas avanzadas, sensación de control.',
   'Marco de metal azul con tres estrellas azules en la parte superior. Aura azul moderada alrededor del personaje, especialmente en manos y hombros. Uniforme con detalles técnicos, herramientas avanzadas. Postura firme y dominante. Maquinaria compleja al fondo.',
   3),

  ('Veterano', 3000, 4999,
   'Referente del turno. Alto rendimiento semana a semana.',
   '#A855F7', 4,
   'Aura púrpura estable y potente, visible claramente alrededor del cuerpo.',
   'Veterano referente del turno con alto rendimiento. Uniforme personalizado, expresión dominante, sensación de experiencia.',
   'Marco de metal púrpura con cuatro estrellas púrpuras en la parte superior. Aura púrpura estable y potente alrededor del personaje. Uniforme con marcas de uso y mejoras personalizadas. Expresión segura y dominante. Entorno industrial intenso al fondo.',
   4),

  ('Maestro', 5000, 7499,
   'Entre los mejores de la fábrica.',
   '#EAB308', 5,
   'Aura dorada brillante y estable, el entorno responde a su presencia.',
   'Maestro entre los mejores de la fábrica. Uniforme con insignias únicas, aura dorada, autoridad técnica absoluta.',
   'Marco dorado ornamentado con cinco estrellas doradas en la parte superior. Aura dorada brillante alrededor del personaje. Uniforme mejorado con insignias únicas. Sensación de autoridad técnica. El entorno de fábrica parece responder a su presencia.',
   5),

  ('Elite', 7500, 10499,
   'Cima del sistema. La línea no tiene secretos para este operario.',
   '#F59E0B', 6,
   'Aura dorada intensa con destellos, presencia imponente que domina el entorno.',
   'Elite en la cima del sistema. Uniforme híbrido industrial-tecnológico, aura intensa, dominio absoluto de la línea.',
   'Marco dorado avanzado con seis estrellas doradas brillantes en la parte superior y destellos en las esquinas. Aura dorada intensa con destellos alrededor del personaje. Uniforme híbrido industrial-tecnológico avanzado. Presencia imponente. La línea de producción parece optimizada a su alrededor.',
   6),

  ('Supremo', 10500, 13999,
   'Rendimiento fuera de lo normal. Marca el ritmo de toda la línea.',
   '#EF4444', 7,
   'Aura roja y dorada dinámica, efectos de energía visibles constantemente.',
   'Supremo con rendimiento fuera de lo normal. Marca el ritmo de toda la línea. Aura energética dinámica, casi mítico.',
   'Marco rojo y dorado con siete estrellas en la parte superior, efectos de energía en los bordes. Aura roja y dorada dinámica alrededor del personaje con efectos de energía visibles. Equipo con detalles brillantes. La fábrica parece reaccionar a su ritmo. Sensación casi mítica.',
   7),

  ('Titan', 14000, 17999,
   'Nivel imparable. Produce, resuelve y lidera sin esfuerzo.',
   '#1F2937', 8,
   'Aura negra y dorada poderosa que distorsiona ligeramente el entorno cercano.',
   'Titan imparable. Produce, resuelve y lidera sin esfuerzo. Presencia dominante, aura que distorsiona el entorno, fuerza inhumana.',
   'Marco negro con detalles dorados y ocho estrellas doradas en la parte superior, con efecto de distorsión en los bordes. Aura negra y dorada poderosa alrededor del personaje que distorsiona levemente el entorno. Uniforme reforzado con elementos industriales avanzados. Figura colosal en impacto visual. Sensación de fuerza inhumana.',
   8),

  ('Leyenda', 18000, null,
   'Nombre propio en la fábrica. Su nivel es referencia para todos.',
   '#FCD34D', 9,
   'Aura dorada mítica intensa, el entorno gira en torno a su figura legendaria.',
   'Leyenda con nombre propio en la fábrica. Su nivel es referencia para todos. Aura dorada mítica, figura legendaria absoluta.',
   'Marco dorado mítico ornamentado con nueve estrellas doradas en la parte superior, rayos de luz emanando de las esquinas y efectos épicos en los bordes. Aura dorada mítica e intensa alrededor del personaje. Diseño casi simbólico y legendario. El entorno de fábrica parece girar en torno a él. Sensación de mito industrial vivo.',
   9);

-- -------------------------------------------------------------
-- 3) Eliminar niveles_responsable — tabla vacía, sin nada
--    construido encima (RLS/policies asociadas se eliminan solas al
--    hacer DROP TABLE, no hace falta tocarlas a mano).
-- -------------------------------------------------------------
drop table if exists niveles_responsable;