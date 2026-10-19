-- =========================================================
--  Navidad con Corazón — setup completo de Supabase
--  Copia TODO este archivo y pégalo en:  Supabase → SQL Editor → Run
--  Se puede volver a correr sin romper nada.
-- =========================================================

-- ---------- 0. QUIÉN ES ADMIN ----------
-- Sin esta tabla, CUALQUIERA que se registre con la anon key (que es pública,
-- va en js/config.js) quedaría como `authenticated` y podría editar regalos y
-- leer los datos de contacto de los donantes. El permiso no es "estar logueado",
-- es "estar en esta lista".
CREATE TABLE IF NOT EXISTS admins (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email     text,
  creado_at timestamptz DEFAULT now()
);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Cada admin solo puede verse a sí mismo; nadie puede agregarse desde el sitio.
DROP POLICY IF EXISTS admins_se_ve_a_si_mismo ON admins;
CREATE POLICY admins_se_ve_a_si_mismo ON admins
  FOR SELECT TO authenticated USING (id = auth.uid());

-- SECURITY DEFINER para que las políticas puedan consultar `admins` sin
-- chocar con la RLS de la propia tabla. `SET search_path` es obligatorio:
-- sin él, un esquema malicioso en el path puede secuestrar la función.
CREATE OR REPLACE FUNCTION es_admin() RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION es_admin TO anon, authenticated;

-- ---------- 1. REGALOS ----------
CREATE TABLE IF NOT EXISTS regalos (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_nino       text NOT NULL,
  institucion       text NOT NULL,
  opcion1           text NOT NULL,
  opcion2           text,
  estado            text DEFAULT 'disponible',   -- disponible | reservado | entregado
  nombre_donador    text,
  contacto_donador  text,
  encargado         text,
  reservado_at      timestamptz,
  entregado_at      timestamptz,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE regalos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regalos_lectura_publica ON regalos;
CREATE POLICY regalos_lectura_publica ON regalos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS regalos_admin ON regalos;
CREATE POLICY regalos_admin ON regalos
  FOR ALL TO authenticated USING (es_admin()) WITH CHECK (es_admin());

-- El estado lo valida la base, no el formulario: aunque alguien mande otra
-- cosa por la API, Postgres la rechaza.
ALTER TABLE regalos DROP CONSTRAINT IF EXISTS regalos_estado_valido;
ALTER TABLE regalos ADD CONSTRAINT regalos_estado_valido
  CHECK (estado IN ('disponible', 'reservado', 'entregado'));

-- Foto opcional del regalo (se sube desde el panel).
ALTER TABLE regalos ADD COLUMN IF NOT EXISTS foto_url text;

-- La RLS filtra FILAS, no columnas: con `regalos_lectura_publica` cualquiera
-- que tome la anon key del sitio (es pública, va en js/config.js) podía pedir
-- ?select=* y llevarse el nombre y el contacto de TODOS los donantes.
-- El permiso por columna es lo único que lo corta de verdad.
REVOKE SELECT ON regalos FROM anon;
GRANT  SELECT (id, nombre_nino, institucion, opcion1, opcion2,
               estado, foto_url, created_at) ON regalos TO anon;

-- ---------- 2. COMENTARIOS (slider de la portada) ----------
CREATE TABLE IF NOT EXISTS comentarios (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  texto      text NOT NULL,
  autor      text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comentarios_lectura_publica ON comentarios;
CREATE POLICY comentarios_lectura_publica ON comentarios
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS comentarios_admin ON comentarios;
CREATE POLICY comentarios_admin ON comentarios
  FOR ALL TO authenticated USING (es_admin()) WITH CHECK (es_admin());

-- ---------- 3. MENSAJES (formulario de contacto) ----------
CREATE TABLE IF NOT EXISTS mensajes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text NOT NULL,
  email      text NOT NULL,
  texto      text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ESCRIBIR un mensaje, pero solo el admin puede LEERLOS.
DROP POLICY IF EXISTS mensajes_escritura_publica ON mensajes;
CREATE POLICY mensajes_escritura_publica ON mensajes
  FOR INSERT TO anon, authenticated WITH CHECK (
    length(nombre) BETWEEN 1 AND 200 AND
    length(email)  BETWEEN 3 AND 200 AND
    length(texto)  BETWEEN 1 AND 2000
  );

DROP POLICY IF EXISTS mensajes_admin ON mensajes;
CREATE POLICY mensajes_admin ON mensajes
  FOR ALL TO authenticated USING (es_admin()) WITH CHECK (es_admin());

-- ---------- 4. CONFIGURACIÓN DEL SITIO ----------
CREATE TABLE IF NOT EXISTS configuracion (
  clave text PRIMARY KEY,
  valor text
);

ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configuracion_lectura_publica ON configuracion;
CREATE POLICY configuracion_lectura_publica ON configuracion
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS configuracion_admin ON configuracion;
CREATE POLICY configuracion_admin ON configuracion
  FOR ALL TO authenticated USING (es_admin()) WITH CHECK (es_admin());

-- Valores iniciales (edítalos después desde el panel /admin del sitio)
INSERT INTO configuracion (clave, valor) VALUES
  ('nombre_campana',    'Navidad con Corazón'),
  ('anio',              '2026'),
  ('email_contacto',    'navidadconcorazon@gmail.com'),
  ('instagram',         'https://instagram.com/navidadconcorazon'),
  ('instagram_usuario', 'navidadconcorazon'),
  ('tiktok',            '#'),
  ('linkedin',          '#'),
  ('linkedin_usuario',  'Navidad con Corazón'),
  ('texto_footer',      'Por ahora, estamos hibernando como los elfos, pero pronto volveremos a armar la fiesta más linda del año. ¡Nos vemos en Noviembre!'),
  ('aviso_home',        '¡Ups! Aún estamos construyendo este sitio. ¡Regresa en Noviembre!'),
  ('legal',             'Corporación Corazón Solidario. Todos los derechos reservados.'),
  -- Apariencia editable desde el panel
  ('fotos_regalos',     'no'),        -- 'si' muestra las fotos de los regalos
  ('color_fondo',       '#012e29'),
  ('color_acento',      '#ef5151'),
  ('color_claro',       '#fff7db'),
  ('foto_sobre_1',      'https://framerusercontent.com/images/TTN63G7WlH0iqjgRXYVUKT2STHQ.jpg?scale-down-to=1024'),
  ('foto_sobre_2',      'https://framerusercontent.com/images/bH45L3qlZ8wn8kb2BhdeoESz9Sg.jpg?scale-down-to=1024'),
  ('foto_voluntarios_1','https://framerusercontent.com/images/X68KA1rl3ypROVGLocg9kbhyLY.jpg?scale-down-to=1024'),
  ('foto_voluntarios_2','https://framerusercontent.com/images/7IDzjlNviUsuxy0H1vhrnIpGUw.jpg?scale-down-to=1024')
ON CONFLICT (clave) DO NOTHING;

-- ---------- 4b. ALMACÉN DE IMÁGENES ----------
-- Bucket público para las fotos de regalos y de las páginas. El límite de
-- tamaño y los tipos permitidos los impone el bucket, no el formulario:
-- así no sirve de nada saltarse la validación del navegador.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('imagenes', 'imagenes', true, 3145728,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 3145728,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Cualquiera ve las imágenes; solo un admin puede subir, reemplazar o borrar.
DROP POLICY IF EXISTS imagenes_lectura_publica ON storage.objects;
CREATE POLICY imagenes_lectura_publica ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'imagenes');

DROP POLICY IF EXISTS imagenes_admin ON storage.objects;
CREATE POLICY imagenes_admin ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'imagenes' AND es_admin())
  WITH CHECK (bucket_id = 'imagenes' AND es_admin());

-- ---------- 5. RESERVA ATÓMICA ----------
-- El público NO puede hacer UPDATE directo sobre regalos (lo impide la RLS).
-- Esta función corre con privilegios del dueño y solo reserva si el regalo
-- SIGUE disponible: evita que dos personas se lleven el mismo regalo.
CREATE OR REPLACE FUNCTION reservar_regalo(
  regalo_id uuid,
  donador   text,
  contacto  text
)
RETURNS boolean AS $$
DECLARE
  filas int;
BEGIN
  IF coalesce(trim(donador), '') = '' OR coalesce(trim(contacto), '') = '' THEN
    RETURN false;
  END IF;

  UPDATE regalos
  SET estado = 'reservado',
      nombre_donador = left(donador, 200),
      contacto_donador = left(contacto, 200),
      reservado_at = now()
  WHERE id = regalo_id AND estado = 'disponible';

  GET DIAGNOSTICS filas = ROW_COUNT;
  RETURN filas > 0;  -- true = reservado; false = alguien se adelantó
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION reservar_regalo TO anon, authenticated;

-- ---------- 6. CHEQUEO ----------
-- Si algo de lo anterior se rompiera, este bloque aborta con error.
DO $$
DECLARE
  rid uuid;
  primera boolean;
  segunda boolean;
  estado_invalido boolean := false;
BEGIN
  INSERT INTO regalos (nombre_nino, institucion, opcion1)
  VALUES ('__test__', '__test__', 'test') RETURNING id INTO rid;

  primera := reservar_regalo(rid, 'Donador A', 'a@test.cl');
  segunda := reservar_regalo(rid, 'Donador B', 'b@test.cl');

  BEGIN
    UPDATE regalos SET estado = 'lo-que-sea' WHERE id = rid;
    estado_invalido := true;          -- si llega aquí, el CHECK no sirvió
  EXCEPTION WHEN check_violation THEN
    estado_invalido := false;
  END;

  DELETE FROM regalos WHERE id = rid;

  ASSERT primera = true,  'reservar_regalo debió reservar un regalo disponible';
  ASSERT segunda = false, 'reservar_regalo NO debe permitir doble reserva';
  ASSERT estado_invalido = false, 'regalos.estado debe rechazar valores fuera de la lista';
  ASSERT es_admin() = false, 'es_admin() debe ser false para quien no está en la tabla admins';
END $$;

-- =========================================================
--  LISTO. Ahora crea el usuario admin (son 3 pasos):
--
--  1) Authentication → Users → Add user → email + contraseña
--     (marca "Auto Confirm User").
--
--  2) Authentication → Providers → Email → APAGA "Enable sign ups".
--     Si queda encendido, cualquiera puede crearse una cuenta con la anon
--     key, que es pública. No lo dejes prendido.
--
--  3) Copia el UID del usuario recién creado (columna UID de la lista) y
--     corre esto en el SQL Editor, reemplazando las dos cosas:
--
--        INSERT INTO admins (id, email)
--        VALUES ('PEGA-AQUI-EL-UID', 'correo@del-admin.cl')
--        ON CONFLICT (id) DO NOTHING;
--
--     Sin este INSERT el usuario puede iniciar sesión pero NO puede editar
--     nada: entrar al panel y tener permisos son dos cosas distintas.
--
--  Para agregar otro admin más adelante: repite 1) y 3).
--  Para quitarle el acceso a alguien:  DELETE FROM admins WHERE email = '...';
-- =========================================================
