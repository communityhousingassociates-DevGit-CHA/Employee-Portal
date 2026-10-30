-- Shared request counter for the middleware rate limit. The old limiter kept its counts in each server instance's memory, so a client
-- landing on another warm instance started again from zero. This one counts in Postgres, so all instances see the same total.
-- Called only from server code with the service-role key (middleware.ts via lib/rate-limit.ts).
create table if not exists rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table rate_limit_hits enable row level security;

-- Counts one hit for `p_key` in the current fixed window and returns true when the window's total is over `p_limit`.
create or replace function rate_limit_hit(p_key text, p_window_seconds integer, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  total integer;
begin
  insert into rate_limit_hits as r (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into total;
  -- Tidy old windows now and then so the table stays tiny without needing a job.
  if random() < 0.01 then
    delete from rate_limit_hits where window_start < now() - interval '1 day';
  end if;
  return total > p_limit;
end;
$$;

-- Server code only: the browser roles must not be able to call it (it would let anyone fill the table or probe counters).
revoke all on function rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, integer, integer) to service_role;
