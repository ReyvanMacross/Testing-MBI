alter table public.penentuan_jalur
add column if not exists assessment_id uuid
  references public.dinsos_assessments(id),
add column if not exists case_id uuid
  references public.dinsos_cases(id),
add column if not exists decision_status varchar,
add column if not exists decision_source varchar,
add column if not exists approved_path_snapshot varchar,
add column if not exists target_opd_id uuid
  references public.master_opd(id),
add column if not exists route_reason text,
add column if not exists finalized_by uuid
  references public.user_profiles(id),
add column if not exists finalized_at timestamptz,
add column if not exists updated_at timestamptz
  not null default now();

update public.penentuan_jalur
set
  decision_status = coalesce(decision_status, 'FINAL'),
  decision_source = coalesce(decision_source, 'LEGACY')
where decision_status is null
   or decision_source is null;

alter table public.penentuan_jalur
alter column decision_status set default 'DRAFT',
alter column decision_status set not null,
alter column decision_source set default 'ASSESSMENT_REVIEW',
alter column decision_source set not null;

alter table public.penentuan_jalur
drop constraint if exists penentuan_jalur_decision_status_check;

alter table public.penentuan_jalur
add constraint penentuan_jalur_decision_status_check
check (decision_status in ('DRAFT', 'FINAL'));

alter table public.penentuan_jalur
drop constraint if exists penentuan_jalur_decision_source_check;

alter table public.penentuan_jalur
add constraint penentuan_jalur_decision_source_check
check (
  decision_source in (
    'LEGACY',
    'ASSESSMENT_REVIEW',
    'MANUAL_OVERRIDE'
  )
);

alter table public.penentuan_jalur
drop constraint if exists penentuan_jalur_approved_path_check;

alter table public.penentuan_jalur
add constraint penentuan_jalur_approved_path_check
check (
  approved_path_snapshot is null
  or approved_path_snapshot in (
    'PEKERJA',
    'WIRAUSAHA',
    'PENGUATAN_DASAR'
  )
);

create unique index if not exists uq_penentuan_jalur_assessment
on public.penentuan_jalur(assessment_id)
where assessment_id is not null;

create index if not exists idx_penentuan_jalur_case
on public.penentuan_jalur(case_id);

create index if not exists idx_penentuan_jalur_status
on public.penentuan_jalur(decision_status);

create table if not exists public.dinsos_path_overrides (
  id uuid primary key default gen_random_uuid(),
  path_decision_id uuid not null
    references public.penentuan_jalur(id)
    on delete cascade,
  assessment_id uuid not null
    references public.dinsos_assessments(id),
  old_path varchar not null,
  new_path varchar not null,
  reason text not null,
  actor_user_id uuid not null
    references public.user_profiles(id),
  created_at timestamptz not null default now(),
  constraint dinsos_path_override_path_check
  check (
    old_path in (
      'PEKERJA',
      'WIRAUSAHA',
      'PENGUATAN_DASAR'
    )
    and new_path in (
      'PEKERJA',
      'WIRAUSAHA',
      'PENGUATAN_DASAR'
    )
  ),
  constraint dinsos_path_override_reason_check
  check (length(trim(reason)) between 20 and 1000)
);

create index if not exists idx_dinsos_path_overrides_assessment
on public.dinsos_path_overrides(assessment_id, created_at desc);

alter table public.referral_mbi
add column if not exists referral_code varchar,
add column if not exists assessment_id uuid
  references public.dinsos_assessments(id),
add column if not exists path_decision_id uuid
  references public.penentuan_jalur(id),
add column if not exists jalur varchar,
add column if not exists instruction text,
add column if not exists is_fixture boolean
  not null default false;

alter table public.referral_mbi
drop constraint if exists referral_mbi_jalur_check;

alter table public.referral_mbi
add constraint referral_mbi_jalur_check
check (
  jalur is null
  or jalur in (
    'PEKERJA',
    'WIRAUSAHA',
    'PENGUATAN_DASAR'
  )
);

alter table public.referral_mbi
drop constraint if exists referral_status_check;

alter table public.referral_mbi
add constraint referral_status_check
check (
  status in (
    'MENUNGGU_RUJUKAN',
    'TERKIRIM',
    'DITERIMA',
    'DIPROSES',
    'SELESAI',
    'DIBATALKAN'
  )
);

alter table public.referral_mbi
alter column sent_at drop not null,
alter column sent_at drop default;

create sequence if not exists public.referral_mbi_code_seq;

create or replace function public.generate_referral_mbi_code()
returns text
language sql
volatile
set search_path = public
as $$
  select
    'REF-' ||
    to_char(
      timezone('Asia/Jakarta', now()),
      'YYYY'
    ) ||
    '-' ||
    lpad(
      nextval('public.referral_mbi_code_seq')::text,
      6,
      '0'
    );
$$;

update public.referral_mbi
set referral_code = public.generate_referral_mbi_code()
where referral_code is null;

alter table public.referral_mbi
alter column referral_code
set default public.generate_referral_mbi_code(),
alter column referral_code set not null;

create unique index if not exists uq_referral_mbi_code
on public.referral_mbi(referral_code);

create unique index if not exists uq_active_referral_assessment
on public.referral_mbi(assessment_id)
where assessment_id is not null
  and status in (
    'MENUNGGU_RUJUKAN',
    'TERKIRIM',
    'DITERIMA',
    'DIPROSES'
  );

drop index if exists public.uq_active_referral_per_case_type;

create unique index uq_active_referral_per_case_type
on public.referral_mbi(case_id, referral_type)
where status in (
  'MENUNGGU_RUJUKAN',
  'TERKIRIM',
  'DITERIMA',
  'DIPROSES'
);

create index if not exists idx_referral_assessment
on public.referral_mbi(assessment_id, created_at desc);

drop trigger if exists trg_penentuan_jalur_updated_at
on public.penentuan_jalur;

create trigger trg_penentuan_jalur_updated_at
before update on public.penentuan_jalur
for each row
execute function public.dinsos_touch_updated_at();

alter table public.dinsos_path_overrides enable row level security;
alter table public.penentuan_jalur enable row level security;
alter table public.referral_mbi enable row level security;

revoke all on table public.dinsos_path_overrides
from anon, authenticated;

revoke all on table public.penentuan_jalur
from anon, authenticated;

revoke all on table public.referral_mbi
from anon, authenticated;

create or replace function public.dinsos_target_opd_allowed(
  p_path text,
  p_target_opd_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.master_opd opd
    where opd.id = p_target_opd_id
      and (
        (p_path = 'PEKERJA' and opd.kode_opd = 'DISNAKER')
        or (p_path = 'WIRAUSAHA' and opd.kode_opd = 'DISKOP')
        or (
          p_path = 'PENGUATAN_DASAR'
          and opd.kode_opd in (
            'DINSOS',
            'DISDIK',
            'DINKES',
            'DP3A',
            'DPPKB'
          )
        )
      )
  );
$$;

create or replace function public.dinsos_review_assessment(
  p_assessment_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_path text default null,
  p_target_opd_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  assessment public.dinsos_assessments%rowtype;
  review_id uuid;
  next_status varchar;
begin
  if not exists (
    select 1
    from public.user_capabilities capability
    where capability.user_id = p_actor_id
      and capability.capability = 'DINSOS_ASSESSMENT_REVIEW'
  ) then
    raise exception using
      errcode = '42501',
      message = 'CAPABILITY_REQUIRED';
  end if;

  select * into assessment
  from public.dinsos_assessments
  where id = p_assessment_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ASSESSMENT_NOT_FOUND';
  end if;

  if assessment.status <> 'PERLU_REVIEW'
     or exists (
       select 1
       from public.dinsos_assessment_reviews
       where assessment_id = p_assessment_id
     ) then
    raise exception using
      errcode = '23505',
      message = 'ASSESSMENT_ALREADY_REVIEWED';
  end if;

  if p_decision = 'APPROVED' then
    if p_path not in (
      'PEKERJA',
      'WIRAUSAHA',
      'PENGUATAN_DASAR'
    )
       or p_target_opd_id is null
       or length(trim(coalesce(p_note, ''))) not between 10 and 2000 then
      raise exception using
        errcode = '23514',
        message = 'INVALID_REVIEW';
    end if;

    if not public.dinsos_target_opd_allowed(p_path, p_target_opd_id) then
      raise exception using
        errcode = '23514',
        message = 'INVALID_TARGET_OPD';
    end if;

    next_status := 'DISETUJUI';
  elsif p_decision = 'REQUEST_REASSESSMENT' then
    if p_path is not null
       or p_target_opd_id is not null
       or length(trim(coalesce(p_note, ''))) not between 20 and 2000 then
      raise exception using
        errcode = '23514',
        message = 'INVALID_REVIEW';
    end if;

    next_status := 'MINTA_REASESMEN';
  else
    raise exception using
      errcode = '23514',
      message = 'INVALID_REVIEW';
  end if;

  insert into public.dinsos_assessment_reviews (
    assessment_id,
    decision,
    approved_path,
    target_opd_id,
    reviewer_note,
    reviewed_by
  ) values (
    p_assessment_id,
    p_decision,
    p_path,
    p_target_opd_id,
    trim(p_note),
    p_actor_id
  )
  returning id into review_id;

  update public.dinsos_assessments
  set status = next_status
  where id = p_assessment_id;

  return jsonb_build_object(
    'assessmentId', p_assessment_id,
    'reviewId', review_id,
    'status', next_status
  );
end;
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
  if p_path not in (
    'PEKERJA',
    'WIRAUSAHA',
    'PENGUATAN_DASAR'
  ) then
    raise exception using
      errcode = '23514',
      message = 'INVALID_PATH';
  end if;

  if length(coalesce(p_instruction, '')) > 3000 then
    raise exception using
      errcode = '23514',
      message = 'INVALID_INSTRUCTION';
  end if;

  select * into case_row
  from public.dinsos_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'CASE_NOT_FOUND';
  end if;

  if case_row.current_stage <> 'MENUNGGU_SPLIT_JALUR' then
    raise exception using
      errcode = '23505',
      message = 'PATH_ALREADY_PUBLISHED';
  end if;

  select candidate.* into assessment
  from public.dinsos_assessments candidate
  where candidate.case_id = p_case_id
    and candidate.status = 'DISETUJUI'
  order by candidate.submitted_at desc, candidate.id desc
  limit 1
  for update;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'APPROVED_ASSESSMENT_REQUIRED';
  end if;

  select * into review
  from public.dinsos_assessment_reviews
  where assessment_id = assessment.id;

  if not found
     or review.decision <> 'APPROVED'
     or review.approved_path is null then
    raise exception using
      errcode = '23514',
      message = 'APPROVED_ASSESSMENT_REQUIRED';
  end if;

  if exists (
    select 1
    from public.referral_mbi referral
    where referral.assessment_id = assessment.id
      and referral.status in (
        'MENUNGGU_RUJUKAN',
        'TERKIRIM',
        'DITERIMA',
        'DIPROSES'
      )
  ) then
    raise exception using
      errcode = '23505',
      message = 'PATH_ALREADY_PUBLISHED';
  end if;

  if not public.dinsos_target_opd_allowed(p_path, p_target_opd_id) then
    raise exception using
      errcode = '23514',
      message = 'INVALID_TARGET_OPD';
  end if;

  override_used := p_path <> review.approved_path;

  if override_used then
    if not exists (
      select 1
      from public.user_capabilities capability
      where capability.user_id = p_actor_id
        and capability.capability = 'DINSOS_PATH_OVERRIDE'
    ) then
      raise exception using
        errcode = '42501',
        message = 'CAPABILITY_REQUIRED';
    end if;

    if length(trim(coalesce(p_override_reason, ''))) not between 20 and 1000 then
      raise exception using
        errcode = '23514',
        message = 'INVALID_OVERRIDE';
    end if;
  end if;

  select id into source_opd_id
  from public.master_opd
  where kode_opd = 'DINSOS';

  if source_opd_id is null then
    raise exception using
      errcode = '23514',
      message = 'DINSOS_OPD_NOT_FOUND';
  end if;

  output_value := case p_path
    when 'PEKERJA' then 'PEKERJA'::public.jalur_intervensi_enum
    when 'WIRAUSAHA' then 'WIRAUSAHA'::public.jalur_intervensi_enum
    when 'PENGUATAN_DASAR' then 'PENGUATAN_DASAR'::public.jalur_intervensi_enum
  end;

  decision_source_value := case
    when override_used then 'MANUAL_OVERRIDE'
    else 'ASSESSMENT_REVIEW'
  end;

  select * into path_decision
  from public.penentuan_jalur
  where assessment_id = assessment.id
  for update;

  if found and path_decision.decision_status = 'FINAL' then
    raise exception using
      errcode = '23505',
      message = 'PATH_ALREADY_PUBLISHED';
  end if;

  if found then
    update public.penentuan_jalur
    set
      case_id = p_case_id,
      output_jalur = output_value,
      approved_path_snapshot = review.approved_path,
      target_opd_id = p_target_opd_id,
      route_reason = review.reviewer_note,
      decision_source = decision_source_value,
      decision_status = 'FINAL',
      finalized_by = p_actor_id,
      finalized_at = now()
    where id = path_decision.id
    returning * into path_decision;
  else
    insert into public.penentuan_jalur (
      warga_id,
      assessment_id,
      case_id,
      output_jalur,
      approved_path_snapshot,
      target_opd_id,
      route_reason,
      decision_source,
      decision_status,
      finalized_by,
      finalized_at
    ) values (
      case_row.warga_id,
      assessment.id,
      p_case_id,
      output_value,
      review.approved_path,
      p_target_opd_id,
      review.reviewer_note,
      decision_source_value,
      'FINAL',
      p_actor_id,
      now()
    )
    returning * into path_decision;
  end if;

  if override_used then
    insert into public.dinsos_path_overrides (
      path_decision_id,
      assessment_id,
      old_path,
      new_path,
      reason,
      actor_user_id
    ) values (
      path_decision.id,
      assessment.id,
      review.approved_path,
      p_path,
      trim(p_override_reason),
      p_actor_id
    );
  end if;

  insert into public.referral_mbi (
    case_id,
    warga_id,
    referral_type,
    source_opd_id,
    target_opd_id,
    status,
    sent_by,
    sent_at,
    assessment_id,
    path_decision_id,
    jalur,
    instruction,
    is_fixture
  ) values (
    p_case_id,
    case_row.warga_id,
    'JALUR_MBI',
    source_opd_id,
    p_target_opd_id,
    'TERKIRIM',
    p_actor_id,
    now(),
    assessment.id,
    path_decision.id,
    p_path,
    nullif(trim(coalesce(p_instruction, '')), ''),
    case_row.is_fixture
  )
  returning id, referral_code
  into referral_id, referral_code_value;

  update public.dinsos_cases
  set current_stage = 'REFERRAL_TERKIRIM'
  where id = p_case_id;

  insert into public.dinsos_case_events (
    case_id,
    event_type,
    from_stage,
    to_stage,
    actor_user_id,
    metadata
  ) values (
    p_case_id,
    'PATH_FINALIZED',
    case_row.current_stage,
    'REFERRAL_TERKIRIM',
    p_actor_id,
    jsonb_build_object(
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
    'stage', 'REFERRAL_TERKIRIM'
  );
end;
$$;

create or replace function public.dinsos_send_stabilization(
  p_case_id uuid,
  p_actor_id uuid,
  p_source_opd_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  case_row public.dinsos_cases%rowtype;
  result_row public.dinsos_case_results%rowtype;
  referral_id uuid;
begin
  select * into case_row
  from public.dinsos_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CASE_NOT_FOUND';
  end if;

  if case_row.current_stage <> 'STABILISASI_DIBUTUHKAN' then
    raise exception using errcode = '23505', message = 'REFERRAL_ALREADY_SENT';
  end if;

  select * into result_row
  from public.dinsos_case_results
  where case_id = p_case_id
    and status = 'CONFIRMED'
    and disposition = 'STABILISASI_SOSIAL';

  if not found then
    raise exception using errcode = '23514', message = 'RESULT_NOT_CONFIRMED';
  end if;

  insert into public.referral_mbi (
    case_id,
    warga_id,
    referral_type,
    source_opd_id,
    target_opd_id,
    target_program,
    status,
    sent_by,
    sent_at,
    is_fixture
  ) values (
    p_case_id,
    case_row.warga_id,
    'PROTEKSI_STABILISASI',
    p_source_opd_id,
    p_source_opd_id,
    'Proteksi & Stabilisasi',
    'TERKIRIM',
    p_actor_id,
    now(),
    case_row.is_fixture
  )
  returning id into referral_id;

  update public.dinsos_cases
  set current_stage = 'MENUNGGU_STABILISASI'
  where id = p_case_id;

  insert into public.dinsos_case_events (
    case_id,
    event_type,
    from_stage,
    to_stage,
    actor_user_id,
    metadata
  ) values (
    p_case_id,
    'STABILIZATION_REFERRAL_SENT',
    case_row.current_stage,
    'MENUNGGU_STABILISASI',
    p_actor_id,
    jsonb_build_object('referralId', referral_id)
  );

  return jsonb_build_object(
    'referralId', referral_id,
    'stage', 'MENUNGGU_STABILISASI'
  );
end;
$$;

revoke all on sequence public.referral_mbi_code_seq
from anon, authenticated;

revoke all on function public.generate_referral_mbi_code()
from public, anon, authenticated;
grant execute on function public.generate_referral_mbi_code()
to service_role;

revoke all on function public.dinsos_target_opd_allowed(text, uuid)
from public, anon, authenticated;
grant execute on function public.dinsos_target_opd_allowed(text, uuid)
to service_role;

revoke all on function public.dinsos_review_assessment(
  uuid, uuid, text, text, uuid, text
)
from public, anon, authenticated;
grant execute on function public.dinsos_review_assessment(
  uuid, uuid, text, text, uuid, text
)
to service_role;

revoke all on function public.dinsos_publish_path_referral(
  uuid, uuid, text, uuid, text, text
)
from public, anon, authenticated;
grant execute on function public.dinsos_publish_path_referral(
  uuid, uuid, text, uuid, text, text
)
to service_role;

revoke all on function public.dinsos_send_stabilization(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.dinsos_send_stabilization(uuid, uuid, uuid)
to service_role;
