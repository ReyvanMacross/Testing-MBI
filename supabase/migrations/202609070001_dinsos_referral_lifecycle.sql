alter table public.dinsos_cases
drop constraint if exists dinsos_case_stage_check;

alter table public.dinsos_cases
add constraint dinsos_case_stage_check
check (current_stage in (
  'MENUNGGU_ASESMEN',
  'MENUNGGU_PENETAPAN_DESIL',
  'STABILISASI_DIBUTUHKAN',
  'MENUNGGU_STABILISASI',
  'MENUNGGU_SPLIT_JALUR',
  'MENUNGGU_RUJUKAN',
  'REFERRAL_TERKIRIM',
  'SELESAI',
  'DIBATALKAN'
));

create table if not exists public.master_program_layanan (
  id uuid primary key default gen_random_uuid(),
  kode_program varchar not null unique,
  nama_program varchar not null,
  opd_id uuid not null references public.master_opd(id),
  jalur varchar,
  jenis_intervensi varchar,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_program_jalur_check check (
    jalur is null or jalur in ('PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR')
  )
);

create index if not exists idx_master_program_opd
on public.master_program_layanan(opd_id);
create index if not exists idx_master_program_jalur
on public.master_program_layanan(jalur);
create index if not exists idx_master_program_active
on public.master_program_layanan(is_active);

alter table public.referral_mbi
add column if not exists program_id uuid
  references public.master_program_layanan(id),
add column if not exists referral_date date,
add column if not exists received_at timestamptz,
add column if not exists processing_started_at timestamptz,
add column if not exists completed_at timestamptz;

create index if not exists idx_referral_status
on public.referral_mbi(status);
create index if not exists idx_referral_target_opd
on public.referral_mbi(target_opd_id);
create index if not exists idx_referral_program
on public.referral_mbi(program_id);
create index if not exists idx_referral_sent
on public.referral_mbi(sent_at desc);

create table if not exists public.referral_mbi_events (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.referral_mbi(id) on delete cascade,
  event_type varchar not null,
  from_status varchar,
  to_status varchar,
  title varchar not null,
  note text,
  event_at timestamptz not null default now(),
  target_date date,
  actor_user_id uuid references public.user_profiles(id),
  actor_opd_id uuid references public.master_opd(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint referral_event_type_check check (event_type in (
    'CREATED', 'SENT', 'RECEIVED', 'PROCESS_STARTED',
    'PROGRAM_PLANNED', 'COMPLETED', 'CANCELLED'
  ))
);

create index if not exists idx_referral_events_referral_time
on public.referral_mbi_events(referral_id, event_at asc);

drop trigger if exists trg_master_program_updated_at
on public.master_program_layanan;
create trigger trg_master_program_updated_at
before update on public.master_program_layanan
for each row execute function public.dinsos_touch_updated_at();

alter table public.master_program_layanan enable row level security;
alter table public.referral_mbi_events enable row level security;

revoke all on table public.master_program_layanan
from anon, authenticated;
revoke all on table public.referral_mbi_events
from anon, authenticated;

create or replace function public.dinsos_referral_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'waitingReferral', count(*) filter (where status = 'MENUNGGU_RUJUKAN'),
    'inOpdProcess', count(*) filter (where status in ('TERKIRIM', 'DITERIMA', 'DIPROSES')),
    'interventionCompleted', count(*) filter (where status = 'SELESAI')
  )
  from public.referral_mbi;
$$;

create or replace function public.list_dinsos_referrals(
  p_search text default null,
  p_path text default null,
  p_status text default null,
  p_limit integer default 3,
  p_offset integer default 0
)
returns table (
  referral_id uuid,
  referral_code varchar,
  warga_id uuid,
  nik varchar,
  nama_lengkap varchar,
  jalur varchar,
  target_opd_id uuid,
  target_opd_name varchar,
  program_id uuid,
  program_name varchar,
  status varchar,
  created_at timestamptz,
  sent_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    referral.id,
    referral.referral_code,
    warga.id,
    warga.nik,
    warga.nama_lengkap,
    referral.jalur,
    referral.target_opd_id,
    opd.nama_opd,
    referral.program_id,
    program.nama_program,
    referral.status,
    referral.created_at,
    referral.sent_at,
    count(*) over()
  from public.referral_mbi referral
  join public.warga warga on warga.id = referral.warga_id
  left join public.master_opd opd on opd.id = referral.target_opd_id
  left join public.master_program_layanan program on program.id = referral.program_id
  where referral.referral_type = 'JALUR_MBI'
    and (
      p_search is null or trim(p_search) = ''
      or referral.referral_code ilike '%' || trim(p_search) || '%'
      or warga.nik ilike '%' || trim(p_search) || '%'
      or warga.nama_lengkap ilike '%' || trim(p_search) || '%'
      or coalesce(opd.nama_opd, '') ilike '%' || trim(p_search) || '%'
    )
    and (p_path is null or trim(p_path) = '' or referral.jalur = p_path)
    and (p_status is null or trim(p_status) = '' or referral.status = p_status)
  order by referral.created_at desc, referral.id desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
$$;

create or replace function public.dinsos_publish_path_referral(
  p_case_id uuid,
  p_actor_id uuid,
  p_path text,
  p_target_opd_id uuid,
  p_override_reason text default null,
  p_instruction text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  case_row public.dinsos_cases%rowtype;
  assessment public.dinsos_assessments%rowtype;
  review public.dinsos_assessment_reviews%rowtype;
  path_decision public.penentuan_jalur%rowtype;
  source_opd_id uuid;
  output_value public.jalur_intervensi_enum;
  decision_source_value varchar;
  referral_id uuid;
  referral_code_value varchar;
  override_used boolean;
begin
  if p_path not in ('PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR') then
    raise exception using errcode = '23514', message = 'INVALID_PATH';
  end if;

  select * into case_row from public.dinsos_cases
  where id = p_case_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CASE_NOT_FOUND';
  end if;
  if case_row.current_stage <> 'MENUNGGU_SPLIT_JALUR' then
    raise exception using errcode = '23505', message = 'PATH_ALREADY_PUBLISHED';
  end if;

  select candidate.* into assessment
  from public.dinsos_assessments candidate
  where candidate.case_id = p_case_id and candidate.status = 'DISETUJUI'
  order by candidate.submitted_at desc, candidate.id desc
  limit 1 for update;
  if not found then
    raise exception using errcode = '23514', message = 'APPROVED_ASSESSMENT_REQUIRED';
  end if;

  select * into review from public.dinsos_assessment_reviews
  where assessment_id = assessment.id;
  if not found or review.decision <> 'APPROVED' or review.approved_path is null then
    raise exception using errcode = '23514', message = 'APPROVED_ASSESSMENT_REQUIRED';
  end if;

  if exists (
    select 1 from public.referral_mbi referral
    where referral.assessment_id = assessment.id
      and referral.status in ('MENUNGGU_RUJUKAN', 'TERKIRIM', 'DITERIMA', 'DIPROSES')
  ) then
    raise exception using errcode = '23505', message = 'PATH_ALREADY_PUBLISHED';
  end if;

  if not public.dinsos_target_opd_allowed(p_path, p_target_opd_id) then
    raise exception using errcode = '23514', message = 'INVALID_TARGET_OPD';
  end if;

  override_used := p_path <> review.approved_path;
  if override_used then
    if not exists (
      select 1 from public.user_capabilities
      where user_id = p_actor_id and capability = 'DINSOS_PATH_OVERRIDE'
    ) then
      raise exception using errcode = '42501', message = 'CAPABILITY_REQUIRED';
    end if;
    if length(trim(coalesce(p_override_reason, ''))) not between 20 and 1000 then
      raise exception using errcode = '23514', message = 'INVALID_OVERRIDE';
    end if;
  end if;

  select id into source_opd_id from public.master_opd where kode_opd = 'DINSOS';
  if source_opd_id is null then
    raise exception using errcode = '23514', message = 'DINSOS_OPD_NOT_FOUND';
  end if;

  output_value := case p_path
    when 'PEKERJA' then 'PEKERJA'::public.jalur_intervensi_enum
    when 'WIRAUSAHA' then 'WIRAUSAHA'::public.jalur_intervensi_enum
    when 'PENGUATAN_DASAR' then 'PENGUATAN_DASAR'::public.jalur_intervensi_enum
  end;
  decision_source_value := case when override_used then 'MANUAL_OVERRIDE' else 'ASSESSMENT_REVIEW' end;

  select * into path_decision from public.penentuan_jalur
  where assessment_id = assessment.id for update;
  if found and path_decision.decision_status = 'FINAL' then
    raise exception using errcode = '23505', message = 'PATH_ALREADY_PUBLISHED';
  end if;

  if found then
    update public.penentuan_jalur set
      case_id = p_case_id,
      output_jalur = output_value,
      approved_path_snapshot = review.approved_path,
      target_opd_id = p_target_opd_id,
      route_reason = review.reviewer_note,
      decision_source = decision_source_value,
      decision_status = 'FINAL',
      finalized_by = p_actor_id,
      finalized_at = now()
    where id = path_decision.id returning * into path_decision;
  else
    insert into public.penentuan_jalur (
      warga_id, assessment_id, case_id, output_jalur,
      approved_path_snapshot, target_opd_id, route_reason,
      decision_source, decision_status, finalized_by, finalized_at
    ) values (
      case_row.warga_id, assessment.id, p_case_id, output_value,
      review.approved_path, p_target_opd_id, review.reviewer_note,
      decision_source_value, 'FINAL', p_actor_id, now()
    ) returning * into path_decision;
  end if;

  if override_used then
    insert into public.dinsos_path_overrides (
      path_decision_id, assessment_id, old_path, new_path, reason, actor_user_id
    ) values (
      path_decision.id, assessment.id, review.approved_path,
      p_path, trim(p_override_reason), p_actor_id
    );
  end if;

  insert into public.referral_mbi (
    case_id, warga_id, referral_type, source_opd_id, target_opd_id,
    status, sent_by, sent_at, assessment_id, path_decision_id,
    jalur, instruction, is_fixture, program_id, referral_date
  ) values (
    p_case_id, case_row.warga_id, 'JALUR_MBI', source_opd_id, p_target_opd_id,
    'MENUNGGU_RUJUKAN', null, null, assessment.id, path_decision.id,
    p_path, null, case_row.is_fixture, null, null
  ) returning id, referral_code into referral_id, referral_code_value;

  update public.dinsos_cases set current_stage = 'MENUNGGU_RUJUKAN'
  where id = p_case_id;

  insert into public.referral_mbi_events (
    referral_id, event_type, from_status, to_status, title,
    actor_user_id, actor_opd_id
  ) values (
    referral_id, 'CREATED', null, 'MENUNGGU_RUJUKAN',
    'Referral jalur MBI dibuat', p_actor_id, source_opd_id
  );

  insert into public.dinsos_case_events (
    case_id, event_type, from_stage, to_stage, actor_user_id, metadata
  ) values (
    p_case_id, 'PATH_FINALIZED', case_row.current_stage, 'MENUNGGU_RUJUKAN',
    p_actor_id, jsonb_build_object(
      'assessmentId', assessment.id,
      'finalPath', p_path,
      'targetOpdId', p_target_opd_id,
      'referralId', referral_id
    )
  );

  return jsonb_build_object(
    'assessmentId', assessment.id,
    'pathDecisionId', path_decision.id,
    'referralId', referral_id,
    'referralCode', referral_code_value,
    'finalPath', p_path,
    'targetOpdId', p_target_opd_id,
    'overrideUsed', override_used,
    'stage', 'MENUNGGU_RUJUKAN'
  );
end;
$$;

create or replace function public.dinsos_send_referral(
  p_referral_id uuid,
  p_actor_id uuid,
  p_program_id uuid,
  p_referral_date date,
  p_instruction text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_row public.referral_mbi%rowtype;
  program_row public.master_program_layanan%rowtype;
  case_row public.dinsos_cases%rowtype;
  actor_opd_id uuid;
  sent_time timestamptz := now();
begin
  if p_referral_date is null or p_referral_date > (now() at time zone 'Asia/Jakarta')::date then
    raise exception using errcode = '23514', message = 'INVALID_REFERRAL_DATE';
  end if;
  if length(coalesce(p_instruction, '')) > 3000 then
    raise exception using errcode = '23514', message = 'INVALID_INSTRUCTION';
  end if;

  select * into referral_row from public.referral_mbi
  where id = p_referral_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND';
  end if;
  if referral_row.status <> 'MENUNGGU_RUJUKAN' then
    raise exception using errcode = '23505', message = 'REFERRAL_ALREADY_SENT';
  end if;

  select * into program_row from public.master_program_layanan
  where id = p_program_id;
  if not found or not program_row.is_active then
    raise exception using errcode = '23514', message = 'INVALID_PROGRAM';
  end if;
  if program_row.opd_id is distinct from referral_row.target_opd_id then
    raise exception using errcode = '23514', message = 'PROGRAM_WRONG_OPD';
  end if;
  if program_row.jalur is not null and program_row.jalur is distinct from referral_row.jalur then
    raise exception using errcode = '23514', message = 'PROGRAM_WRONG_PATH';
  end if;

  select * into case_row from public.dinsos_cases
  where id = referral_row.case_id for update;
  if not found or case_row.current_stage <> 'MENUNGGU_RUJUKAN' then
    raise exception using errcode = '23505', message = 'REFERRAL_ALREADY_SENT';
  end if;
  select opd_id into actor_opd_id from public.user_profiles where id = p_actor_id;

  update public.referral_mbi set
    program_id = p_program_id,
    referral_date = p_referral_date,
    instruction = nullif(trim(coalesce(p_instruction, '')), ''),
    status = 'TERKIRIM',
    sent_by = p_actor_id,
    sent_at = sent_time
  where id = p_referral_id;

  update public.dinsos_cases set current_stage = 'REFERRAL_TERKIRIM'
  where id = referral_row.case_id;

  insert into public.referral_mbi_events (
    referral_id, event_type, from_status, to_status, title,
    event_at, actor_user_id, actor_opd_id
  ) values (
    p_referral_id, 'SENT', 'MENUNGGU_RUJUKAN', 'TERKIRIM',
    'Rujukan dikirim ke OPD', sent_time, p_actor_id, actor_opd_id
  );

  insert into public.dinsos_case_events (
    case_id, event_type, from_stage, to_stage, actor_user_id, metadata
  ) values (
    referral_row.case_id, 'REFERRAL_SENT', case_row.current_stage,
    'REFERRAL_TERKIRIM', p_actor_id,
    jsonb_build_object('referralId', p_referral_id, 'programId', p_program_id)
  );

  return jsonb_build_object(
    'referralId', p_referral_id,
    'status', 'TERKIRIM',
    'sentAt', sent_time,
    'stage', 'REFERRAL_TERKIRIM'
  );
end;
$$;

create or replace function public.transition_referral_status(
  p_referral_id uuid,
  p_to_status text,
  p_actor_user_id uuid default null,
  p_actor_opd_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  referral_row public.referral_mbi%rowtype;
  event_kind varchar;
  event_title varchar;
  transition_time timestamptz := now();
begin
  if length(coalesce(p_note, '')) > 3000 then
    raise exception using errcode = '23514', message = 'INVALID_NOTE';
  end if;

  select * into referral_row from public.referral_mbi
  where id = p_referral_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REFERRAL_NOT_FOUND';
  end if;
  if p_actor_opd_id is not null and p_actor_opd_id is distinct from referral_row.target_opd_id then
    raise exception using errcode = '42501', message = 'TARGET_OPD_REQUIRED';
  end if;

  if referral_row.status = 'TERKIRIM' and p_to_status = 'DITERIMA' then
    event_kind := 'RECEIVED';
    event_title := 'Rujukan diterima OPD';
  elsif referral_row.status = 'DITERIMA' and p_to_status = 'DIPROSES' then
    event_kind := 'PROCESS_STARTED';
    event_title := 'Proses intervensi dimulai';
  elsif referral_row.status = 'DIPROSES' and p_to_status = 'SELESAI' then
    event_kind := 'COMPLETED';
    event_title := 'Intervensi selesai';
  elsif referral_row.status in ('MENUNGGU_RUJUKAN', 'TERKIRIM') and p_to_status = 'DIBATALKAN' then
    event_kind := 'CANCELLED';
    event_title := 'Referral dibatalkan';
  else
    raise exception using errcode = '23505', message = 'INVALID_REFERRAL_TRANSITION';
  end if;

  update public.referral_mbi set
    status = p_to_status,
    received_at = case when p_to_status = 'DITERIMA' then transition_time else received_at end,
    processing_started_at = case when p_to_status = 'DIPROSES' then transition_time else processing_started_at end,
    completed_at = case when p_to_status = 'SELESAI' then transition_time else completed_at end
  where id = p_referral_id;

  insert into public.referral_mbi_events (
    referral_id, event_type, from_status, to_status, title, note,
    event_at, actor_user_id, actor_opd_id
  ) values (
    p_referral_id, event_kind, referral_row.status, p_to_status,
    event_title, nullif(trim(coalesce(p_note, '')), ''), transition_time,
    p_actor_user_id, p_actor_opd_id
  );

  return jsonb_build_object(
    'referralId', p_referral_id,
    'fromStatus', referral_row.status,
    'status', p_to_status,
    'transitionedAt', transition_time
  );
end;
$$;

revoke all on function public.dinsos_referral_summary()
from public, anon, authenticated;
grant execute on function public.dinsos_referral_summary()
to service_role;

revoke all on function public.list_dinsos_referrals(text, text, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.list_dinsos_referrals(text, text, text, integer, integer)
to service_role;

revoke all on function public.dinsos_publish_path_referral(uuid, uuid, text, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.dinsos_publish_path_referral(uuid, uuid, text, uuid, text, text)
to service_role;

revoke all on function public.dinsos_send_referral(uuid, uuid, uuid, date, text)
from public, anon, authenticated;
grant execute on function public.dinsos_send_referral(uuid, uuid, uuid, date, text)
to service_role;

revoke all on function public.transition_referral_status(uuid, text, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.transition_referral_status(uuid, text, uuid, uuid, text)
to service_role;
