-- 0019_profiles_email.sql
-- Copia del email en `profiles` (denormalizado a propósito) para que listar el equipo
-- de la organización no requiera leer auth.users, que exige privilegios elevados.
-- Se rellena en la creación de cada usuario nuevo (ver /api/users).

alter table profiles add column email text;

-- Backfill del usuario ya existente (creado a mano por SQL antes de que existiera esta
-- columna). Ejecuta esto una sola vez después de aplicar la migración:
--
-- update profiles p set email = u.email
-- from auth.users u
-- where u.id = p.id and p.email is null;
