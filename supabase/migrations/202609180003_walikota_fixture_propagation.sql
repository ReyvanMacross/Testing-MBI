-- Preserve fixture provenance when an executive decision is created from a fixture recommendation.

create or replace function public.walikota_propagate_fixture_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare source_is_fixture boolean;
begin
  select recommendation.is_fixture into source_is_fixture
  from public.bapperida_recommendations recommendation
  where recommendation.id = new.recommendation_id;
  new.is_fixture := coalesce(source_is_fixture, false);
  return new;
end;
$$;

drop trigger if exists trg_walikota_decision_fixture_flag on public.walikota_decisions;
create trigger trg_walikota_decision_fixture_flag
before insert on public.walikota_decisions
for each row execute function public.walikota_propagate_fixture_flag();

update public.walikota_decisions decision
set is_fixture = recommendation.is_fixture
from public.bapperida_recommendations recommendation
where recommendation.id = decision.recommendation_id
  and decision.is_fixture is distinct from recommendation.is_fixture;

revoke all on function public.walikota_propagate_fixture_flag() from public, anon, authenticated;
