-- Fix pgvector operator errors if migration 009 partially applied with extensions.vector
-- Safe to run after 009 or if best_face_match_distance failed to create.

create extension if not exists vector;

create or replace function public.embedding_array_distance(a float8[], b float8[])
returns double precision
language plpgsql
immutable
as $$
declare
  i integer;
  sum_sq double precision := 0;
  len integer;
begin
  len := array_length(a, 1);
  if len is distinct from array_length(b, 1) or len is distinct from 128 then
    return null;
  end if;
  for i in 1..len loop
    sum_sq := sum_sq + power(a[i] - b[i], 2);
  end loop;
  return sqrt(sum_sq);
end;
$$;

create or replace function public.best_face_match_distance(
  p_staff_id uuid,
  p_query float8[]
)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select min(public.embedding_array_distance(fe.embedding_values, p_query))
  from face_embeddings fe
  where fe.staff_id = p_staff_id
    and fe.is_active = true;
$$;
