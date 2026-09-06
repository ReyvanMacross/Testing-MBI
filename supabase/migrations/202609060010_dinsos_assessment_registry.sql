create table if not exists public.dinsos_assessment_types (
  code varchar primary key,
  name varchar not null,
  list_label varchar not null,
  requires_recommendation boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.dinsos_assessment_types (
  code,
  name,
  list_label,
  requires_recommendation
)
values
  (
    'INTERVENSI_MBI',
    'Asesmen Kebutuhan Intervensi MBI',
    'Asesmen Intervensi MBI',
    true
  ),
  (
    'KEBUTUHAN_DASAR',
    'Asesmen Kebutuhan Dasar',
    'Asesmen Kebutuhan Dasar',
    false
  )
on conflict (code) do update
set
  name = excluded.name,
  list_label = excluded.list_label,
  requires_recommendation = excluded.requires_recommendation;

create sequence if not exists public.dinsos_assessment_code_seq;

create or replace function public.generate_dinsos_assessment_code()
returns text
language sql
volatile
set search_path = public
as $$
  select
    'ASM-' ||
    to_char(timezone('Asia/Jakarta', now()), 'YYYYMM') ||
    '-' ||
    lpad(nextval('public.dinsos_assessment_code_seq')::text, 6, '0');
$$;

create table if not exists public.dinsos_assessments (
  id uuid primary key default gen_random_uuid(),
  assessment_code varchar not null unique
    default public.generate_dinsos_assessment_code(),
  warga_id uuid not null references public.warga(id),
  case_id uuid references public.dinsos_cases(id) on delete set null,
  assessment_type_code varchar not null
    references public.dinsos_assessment_types(code),
  assessment_date date not null,
  observation text,
  field_recommendation varchar,
  status varchar not null default 'PERLU_REVIEW',
  reassessment_of_id uuid references public.dinsos_assessments(id),
  created_by uuid not null references public.user_profiles(id),
  submitted_at timestamptz not null default now(),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dinsos_assessment_path_check
    check (
      field_recommendation is null
      or field_recommendation in (
        'PEKERJA',
        'WIRAUSAHA',
        'PENGUATAN_DASAR'
      )
    ),
  constraint dinsos_assessment_registry_status_check
    check (
      status in (
        'DRAFT',
        'PERLU_REVIEW',
        'DISETUJUI',
        'MINTA_REASESMEN',
        'DIBATALKAN'
      )
    )
);

create index if not exists idx_dinsos_assessments_date
on public.dinsos_assessments(assessment_date desc);

create index if not exists idx_dinsos_assessments_status
on public.dinsos_assessments(status);

create index if not exists idx_dinsos_assessments_warga
on public.dinsos_assessments(warga_id);

create index if not exists idx_dinsos_assessments_type
on public.dinsos_assessments(assessment_type_code);

create table if not exists public.dinsos_assessment_reviews (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique
    references public.dinsos_assessments(id) on delete cascade,
  decision varchar not null,
  approved_path varchar,
  target_opd_id uuid references public.master_opd(id),
  target_unit varchar,
  reviewer_note text not null,
  reviewed_by uuid not null references public.user_profiles(id),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint dinsos_review_decision_check
    check (decision in ('APPROVED', 'REQUEST_REASSESSMENT')),
  constraint dinsos_review_path_check
    check (
      approved_path is null
      or approved_path in ('PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR')
    ),
  constraint dinsos_review_integrity_check
    check (
      (
        decision = 'APPROVED'
        and approved_path is not null
        and target_opd_id is not null
      )
      or
      (
        decision = 'REQUEST_REASSESSMENT'
        and approved_path is null
        and target_opd_id is null
      )
    )
);

alter table public.dinsos_asesmen_sosial
add column if not exists registry_assessment_id uuid
references public.dinsos_assessments(id);

create unique index if not exists uq_dinsos_social_assessment_registry
on public.dinsos_asesmen_sosial(registry_assessment_id)
where registry_assessment_id is not null;

create or replace function public.dinsos_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_dinsos_assessments_updated_at
on public.dinsos_assessments;

create trigger trg_dinsos_assessments_updated_at
before update on public.dinsos_assessments
for each row execute function public.dinsos_touch_updated_at();

create or replace function public.dinsos_assessment_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'totalThisYear', count(*) filter (
      where da.assessment_date >= make_date(
        extract(year from timezone('Asia/Jakarta', now()))::integer,
        1,
        1
      )
      and da.assessment_date < make_date(
        extract(year from timezone('Asia/Jakarta', now()))::integer + 1,
        1,
        1
      )
    ),
    'needsReview', count(*) filter (where da.status = 'PERLU_REVIEW'),
    'reconciledToPath', count(*) filter (
      where da.status = 'DISETUJUI'
        and review.approved_path is not null
    )
  )
  from public.dinsos_assessments da
  left join public.dinsos_assessment_reviews review
    on review.assessment_id = da.id;
$$;

create or replace function public.list_dinsos_assessments(
  p_search text default null,
  p_type text default null,
  p_path text default null,
  p_status text default null,
  p_limit integer default 3,
  p_offset integer default 0
)
returns table (
  assessment_id uuid,
  assessment_code varchar,
  assessment_date date,
  warga_id uuid,
  nik varchar,
  nama_lengkap varchar,
  kelurahan varchar,
  location_resolved boolean,
  desil integer,
  assessment_type_code varchar,
  assessment_type_label varchar,
  field_recommendation varchar,
  approved_path varchar,
  status varchar,
  created_by_name varchar,
  created_by_role text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    da.id as assessment_id,
    da.assessment_code,
    da.assessment_date,
    da.warga_id,
    w.nik,
    w.nama_lengkap,
    coalesce(mw.nama, w.kelurahan) as kelurahan,
    (w.kelurahan_id is not null and w.kecamatan_id is not null)
      as location_resolved,
    latest_desil.desil_dtsen as desil,
    da.assessment_type_code,
    assessment_type.list_label as assessment_type_label,
    da.field_recommendation,
    review.approved_path,
    da.status,
    creator.nama_lengkap as created_by_name,
    creator.role::text as created_by_role,
    count(*) over() as total_count
  from public.dinsos_assessments da
  join public.warga w on w.id = da.warga_id
  join public.dinsos_assessment_types assessment_type
    on assessment_type.code = da.assessment_type_code
  join public.user_profiles creator on creator.id = da.created_by
  left join public.master_wilayah mw
    on mw.id = w.kelurahan_id
   and mw.jenis = 'KELURAHAN'
  left join public.dinsos_assessment_reviews review
    on review.assessment_id = da.id
  left join lateral (
    select pd.desil_dtsen
    from public.penetapan_desil pd
    where pd.warga_id = da.warga_id
    order by pd.created_at desc nulls last, pd.id desc
    limit 1
  ) latest_desil on true
  where
    (
      p_search is null
      or trim(p_search) = ''
      or da.assessment_code ilike '%' || trim(p_search) || '%'
      or coalesce(w.nik, '') ilike '%' || trim(p_search) || '%'
      or w.nama_lengkap ilike '%' || trim(p_search) || '%'
    )
    and (
      p_type is null
      or trim(p_type) = ''
      or da.assessment_type_code = p_type
    )
    and (
      p_path is null
      or trim(p_path) = ''
      or coalesce(review.approved_path, da.field_recommendation) = p_path
    )
    and (
      p_status is null
      or trim(p_status) = ''
      or da.status = p_status
    )
  order by da.assessment_date desc, da.assessment_code desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(p_offset, 0);
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
    raise exception using errcode = '42501', message = 'CAPABILITY_REQUIRED';
  end if;

  select * into assessment
  from public.dinsos_assessments
  where id = p_assessment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ASSESSMENT_NOT_FOUND';
  end if;

  if assessment.status <> 'PERLU_REVIEW'
     or exists (
       select 1 from public.dinsos_assessment_reviews
       where assessment_id = p_assessment_id
     ) then
    raise exception using errcode = '23505', message = 'ASSESSMENT_ALREADY_REVIEWED';
  end if;

  if p_decision = 'APPROVED' then
    if p_path not in ('PEKERJA', 'WIRAUSAHA', 'PENGUATAN_DASAR')
       or p_target_opd_id is null
       or not exists (
         select 1 from public.master_opd where id = p_target_opd_id
       )
       or p_note is null
       or length(trim(p_note)) not between 10 and 2000 then
      raise exception using errcode = '23514', message = 'INVALID_REVIEW';
    end if;
    next_status := 'DISETUJUI';
  elsif p_decision = 'REQUEST_REASSESSMENT' then
    if p_path is not null
       or p_target_opd_id is not null
       or p_note is null
       or length(trim(p_note)) not between 20 and 2000 then
      raise exception using errcode = '23514', message = 'INVALID_REVIEW';
    end if;
    next_status := 'MINTA_REASESMEN';
  else
    raise exception using errcode = '23514', message = 'INVALID_REVIEW';
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
  ) returning id into review_id;

  update public.dinsos_assessments
  set status = next_status
  where id = p_assessment_id;

  return jsonb_build_object(
    'reviewId', review_id,
    'assessmentId', p_assessment_id,
    'status', next_status,
    'approvedPath', p_path
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'ASSESSMENT_ALREADY_REVIEWED';
end;
$$;

create or replace function public.dinsos_complete_assessment(
  p_case_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  case_row public.dinsos_cases%rowtype;
  social_assessment public.dinsos_asesmen_sosial%rowtype;
  registry_id uuid;
begin
  select * into case_row
  from public.dinsos_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CASE_NOT_FOUND';
  end if;
  if case_row.current_stage <> 'MENUNGGU_ASESMEN' then
    raise exception using errcode = '23505', message = 'CASE_ALREADY_PROCESSED';
  end if;

  select * into social_assessment
  from public.dinsos_asesmen_sosial
  where case_id = p_case_id
  for update;

  if not found
     or social_assessment.rentang_pendapatan is null
     or social_assessment.status_bekerja is null
     or social_assessment.penghasilan_bulanan is null
     or social_assessment.pendidikan_tertinggi is null
     or social_assessment.literasi_digital is null
     or social_assessment.penyakit_kronis_disabilitas is null
     or (
       social_assessment.penyakit_kronis_disabilitas = 'ADA'
       and nullif(trim(social_assessment.penyakit_detail), '') is null
     )
     or social_assessment.balita_stunting is null
     or social_assessment.lansia_disabilitas_tanpa_pendamping is null
     or social_assessment.anak_putus_sekolah_count is null
     or social_assessment.kelayakan_rumah is null
     or social_assessment.air_sanitasi is null
     or social_assessment.nik_valid is null
     or social_assessment.kk_terbaru is null
     or social_assessment.bpjs_aktif is null
     or social_assessment.rekening_bank is null
     or social_assessment.motivasi_perubahan is null
     or nullif(trim(social_assessment.keterampilan), '') is null
     or (
       social_assessment.status_bekerja = 'BEKERJA'
       and nullif(trim(social_assessment.jenis_pekerjaan), '') is null
     ) then
    raise exception using errcode = '23514', message = 'ASSESSMENT_INCOMPLETE';
  end if;

  registry_id := social_assessment.registry_assessment_id;
  if registry_id is null then
    insert into public.dinsos_assessments (
      warga_id,
      case_id,
      assessment_type_code,
      assessment_date,
      observation,
      field_recommendation,
      status,
      created_by,
      is_fixture
    ) values (
      case_row.warga_id,
      case_row.id,
      'INTERVENSI_MBI',
      timezone('Asia/Jakarta', now())::date,
      nullif(trim(social_assessment.catatan_petugas), ''),
      null,
      'PERLU_REVIEW',
      p_actor_id,
      case_row.is_fixture
    ) returning id into registry_id;
  end if;

  update public.dinsos_asesmen_sosial
  set
    status = 'COMPLETED',
    completed_by = p_actor_id,
    completed_at = now(),
    registry_assessment_id = registry_id
  where id = social_assessment.id;

  update public.dinsos_cases
  set current_stage = 'MENUNGGU_PENETAPAN_DESIL'
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
    'ASSESSMENT_COMPLETED',
    case_row.current_stage,
    'MENUNGGU_PENETAPAN_DESIL',
    p_actor_id,
    jsonb_build_object('registryAssessmentId', registry_id)
  );

  return jsonb_build_object(
    'assessmentId', social_assessment.id,
    'registryAssessmentId', registry_id,
    'stage', 'MENUNGGU_PENETAPAN_DESIL'
  );
end;
$$;

alter table public.dinsos_assessment_types enable row level security;
alter table public.dinsos_assessments enable row level security;
alter table public.dinsos_assessment_reviews enable row level security;

revoke all on table
  public.dinsos_assessment_types,
  public.dinsos_assessments,
  public.dinsos_assessment_reviews
from anon, authenticated;

revoke all on sequence public.dinsos_assessment_code_seq
from anon, authenticated;

revoke all on function public.generate_dinsos_assessment_code()
from public, anon, authenticated;
grant execute on function public.generate_dinsos_assessment_code()
to service_role;

revoke all on function public.dinsos_touch_updated_at()
from public, anon, authenticated;
grant execute on function public.dinsos_touch_updated_at()
to service_role;

revoke all on function public.dinsos_assessment_summary()
from public, anon, authenticated;
grant execute on function public.dinsos_assessment_summary()
to service_role;

revoke all on function public.list_dinsos_assessments(
  text, text, text, text, integer, integer
)
from public, anon, authenticated;
grant execute on function public.list_dinsos_assessments(
  text, text, text, text, integer, integer
)
to service_role;

revoke all on function public.dinsos_review_assessment(
  uuid, uuid, text, text, uuid, text
)
from public, anon, authenticated;
grant execute on function public.dinsos_review_assessment(
  uuid, uuid, text, text, uuid, text
)
to service_role;

revoke all on function public.dinsos_complete_assessment(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.dinsos_complete_assessment(uuid, uuid)
to service_role;
