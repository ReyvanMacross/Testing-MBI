create table if not exists public.user_capabilities (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  capability varchar not null,
  granted_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  primary key (user_id, capability)
);

create table if not exists public.dinsos_cases (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null references public.warga(id),
  current_stage varchar not null default 'MENUNGGU_ASESMEN',
  priority varchar not null default 'SEDANG',
  assigned_to uuid references public.user_profiles(id),
  queue_entered_at timestamptz not null default now(),
  closed_at timestamptz,
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dinsos_case_stage_check check (current_stage in (
    'MENUNGGU_ASESMEN', 'MENUNGGU_PENETAPAN_DESIL',
    'STABILISASI_DIBUTUHKAN', 'MENUNGGU_STABILISASI',
    'MENUNGGU_SPLIT_JALUR', 'REFERRAL_TERKIRIM',
    'SELESAI', 'DIBATALKAN'
  )),
  constraint dinsos_case_priority_check check (priority in ('TINGGI', 'SEDANG', 'RENDAH'))
);

create unique index if not exists uq_dinsos_active_case_per_warga
on public.dinsos_cases(warga_id)
where closed_at is null and current_stage not in ('SELESAI', 'DIBATALKAN');
create index if not exists idx_dinsos_cases_stage on public.dinsos_cases(current_stage);
create index if not exists idx_dinsos_cases_priority on public.dinsos_cases(priority);
create index if not exists idx_dinsos_cases_queue on public.dinsos_cases(queue_entered_at);

create table if not exists public.dinsos_asesmen_sosial (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.dinsos_cases(id) on delete cascade,
  status varchar not null default 'DRAFT',
  desil_dtsen_snapshot integer,
  pbi_snapshot boolean,
  pkh_snapshot boolean,
  bpnt_snapshot boolean,
  rentang_pendapatan varchar,
  status_bekerja varchar,
  jenis_pekerjaan varchar,
  penghasilan_bulanan varchar,
  pendidikan_tertinggi varchar,
  literasi_digital varchar,
  penyakit_kronis_disabilitas varchar,
  penyakit_detail text,
  balita_stunting varchar,
  lansia_disabilitas_tanpa_pendamping varchar,
  anak_putus_sekolah_count integer,
  kelayakan_rumah varchar,
  air_sanitasi varchar,
  nik_valid boolean,
  kk_terbaru boolean,
  bpjs_aktif boolean,
  rekening_bank boolean,
  motivasi_perubahan smallint,
  keterampilan text,
  catatan_petugas text,
  score_kemiskinan integer,
  score_pekerjaan integer,
  score_pendidikan integer,
  score_kesehatan integer,
  score_kondisi_keluarga integer,
  score_tempat_tinggal integer,
  score_administrasi integer,
  score_kapasitas_individu integer,
  readiness_level varchar,
  created_by uuid references public.user_profiles(id),
  completed_by uuid references public.user_profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dinsos_assessment_status_check check (status in ('DRAFT', 'COMPLETED')),
  constraint dinsos_work_status_check check (status_bekerja is null or status_bekerja in ('BEKERJA', 'TIDAK_BEKERJA')),
  constraint dinsos_literasi_check check (literasi_digital is null or literasi_digital in ('MAHIR', 'CUKUP', 'KURANG')),
  constraint dinsos_health_check check (penyakit_kronis_disabilitas is null or penyakit_kronis_disabilitas in ('ADA', 'TIDAK_ADA')),
  constraint dinsos_stunting_check check (balita_stunting is null or balita_stunting in ('YA', 'TIDAK', 'TIDAK_ADA_BALITA')),
  constraint dinsos_family_support_check check (lansia_disabilitas_tanpa_pendamping is null or lansia_disabilitas_tanpa_pendamping in ('YA', 'TIDAK')),
  constraint dinsos_house_check check (kelayakan_rumah is null or kelayakan_rumah in ('LAYAK', 'TIDAK_LAYAK')),
  constraint dinsos_water_check check (air_sanitasi is null or air_sanitasi in ('MEMADAI', 'TIDAK_MEMADAI')),
  constraint dinsos_motivation_check check (motivasi_perubahan is null or motivasi_perubahan between 1 and 5),
  constraint dinsos_children_count_check check (anak_putus_sekolah_count is null or anak_putus_sekolah_count >= 0),
  constraint dinsos_dimension_score_check check (
    (score_kemiskinan is null or score_kemiskinan between 0 and 100) and
    (score_pekerjaan is null or score_pekerjaan between 0 and 100) and
    (score_pendidikan is null or score_pendidikan between 0 and 100) and
    (score_kesehatan is null or score_kesehatan between 0 and 100) and
    (score_kondisi_keluarga is null or score_kondisi_keluarga between 0 and 100) and
    (score_tempat_tinggal is null or score_tempat_tinggal between 0 and 100) and
    (score_administrasi is null or score_administrasi between 0 and 100) and
    (score_kapasitas_individu is null or score_kapasitas_individu between 0 and 100)
  )
);

create table if not exists public.dinsos_case_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.dinsos_cases(id) on delete cascade,
  assessment_id uuid not null references public.dinsos_asesmen_sosial(id),
  status varchar not null default 'DRAFT',
  official_desil integer not null,
  operational_desil integer not null,
  disposition varchar not null,
  result_source varchar not null default 'SYSTEM',
  confirmed_by uuid references public.user_profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dinsos_result_status_check check (status in ('DRAFT', 'CONFIRMED')),
  constraint dinsos_official_desil_check check (official_desil between 1 and 10),
  constraint dinsos_operational_desil_check check (operational_desil between 1 and 10),
  constraint dinsos_result_source_check check (result_source in ('SYSTEM', 'OVERRIDE')),
  constraint dinsos_disposition_check check (disposition in ('STABILISASI_SOSIAL', 'SPLIT_JALUR'))
);

create table if not exists public.dinsos_desil_overrides (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.dinsos_cases(id) on delete cascade,
  old_desil integer not null check (old_desil between 1 and 10),
  new_desil integer not null check (new_desil between 1 and 10),
  reason text not null,
  actor_user_id uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.dinsos_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.dinsos_cases(id) on delete cascade,
  event_type varchar not null,
  from_stage varchar,
  to_stage varchar,
  actor_user_id uuid references public.user_profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_mbi (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.dinsos_cases(id) on delete cascade,
  warga_id uuid not null references public.warga(id),
  referral_type varchar not null,
  source_opd_id uuid references public.master_opd(id),
  target_opd_id uuid references public.master_opd(id),
  target_program varchar,
  status varchar not null default 'TERKIRIM',
  sent_by uuid references public.user_profiles(id),
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_status_check check (status in ('TERKIRIM', 'DITERIMA', 'DIPROSES', 'SELESAI', 'DIBATALKAN'))
);

create unique index if not exists uq_active_referral_per_case_type
on public.referral_mbi(case_id, referral_type)
where status in ('TERKIRIM', 'DITERIMA', 'DIPROSES');
create index if not exists idx_dinsos_assessment_case on public.dinsos_asesmen_sosial(case_id);
create index if not exists idx_dinsos_results_case on public.dinsos_case_results(case_id);
create index if not exists idx_dinsos_events_case on public.dinsos_case_events(case_id, created_at desc);
create index if not exists idx_referral_case on public.referral_mbi(case_id, sent_at desc);

create or replace function public.touch_dinsos_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_dinsos_cases on public.dinsos_cases;
create trigger trg_touch_dinsos_cases before update on public.dinsos_cases
for each row execute function public.touch_dinsos_updated_at();
drop trigger if exists trg_touch_dinsos_assessment on public.dinsos_asesmen_sosial;
create trigger trg_touch_dinsos_assessment before update on public.dinsos_asesmen_sosial
for each row execute function public.touch_dinsos_updated_at();
drop trigger if exists trg_touch_dinsos_results on public.dinsos_case_results;
create trigger trg_touch_dinsos_results before update on public.dinsos_case_results
for each row execute function public.touch_dinsos_updated_at();
drop trigger if exists trg_touch_referral_mbi on public.referral_mbi;
create trigger trg_touch_referral_mbi before update on public.referral_mbi
for each row execute function public.touch_dinsos_updated_at();

create or replace function public.dinsos_queue_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'waitingAssessment', count(*) filter (where current_stage = 'MENUNGGU_ASESMEN'),
    'waitingDesil', count(*) filter (where current_stage = 'MENUNGGU_PENETAPAN_DESIL'),
    'waitingStabilization', count(*) filter (where current_stage in ('STABILISASI_DIBUTUHKAN', 'MENUNGGU_STABILISASI')),
    'waitingSplit', count(*) filter (where current_stage = 'MENUNGGU_SPLIT_JALUR'),
    'referralsThisMonth', (
      select count(*) from public.referral_mbi r
      where r.sent_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
        and r.sent_at < (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta'
    )
  ) from public.dinsos_cases;
$$;

create or replace function public.list_dinsos_cases(
  p_search text default null,
  p_kelurahan text default null,
  p_stage text default null,
  p_sort text default 'priority',
  p_limit integer default 6,
  p_offset integer default 0
)
returns table (
  case_id uuid, warga_id uuid, nik varchar, nama varchar,
  kelurahan varchar, kecamatan varchar, location_resolved boolean,
  current_stage varchar, priority varchar, queue_entered_at timestamptz,
  total_count bigint
)
language sql stable security definer set search_path = public as $$
  select dc.id, w.id, w.nik, w.nama_lengkap,
    coalesce(mk.nama, w.kelurahan), coalesce(mc.nama, w.kecamatan),
    (w.kecamatan_id is not null and w.kelurahan_id is not null),
    dc.current_stage, dc.priority, dc.queue_entered_at, count(*) over()
  from public.dinsos_cases dc
  join public.warga w on w.id = dc.warga_id
  left join public.master_wilayah mk on mk.id = w.kelurahan_id and mk.jenis = 'KELURAHAN'
  left join public.master_wilayah mc on mc.id = w.kecamatan_id and mc.jenis = 'KECAMATAN'
  where dc.closed_at is null
    and dc.current_stage not in ('SELESAI', 'DIBATALKAN')
    and (p_search is null or trim(p_search) = '' or w.nama_lengkap ilike '%' || trim(p_search) || '%' or coalesce(w.nik, '') ilike '%' || trim(p_search) || '%')
    and (p_kelurahan is null or trim(p_kelurahan) = '' or lower(trim(coalesce(mk.nama, w.kelurahan, ''))) = lower(trim(p_kelurahan)))
    and (p_stage is null or trim(p_stage) = '' or dc.current_stage = p_stage)
  order by
    case when p_sort = 'oldest' then dc.queue_entered_at end asc,
    case when p_sort = 'newest' then dc.queue_entered_at end desc,
    case when p_sort = 'priority' then case dc.priority when 'TINGGI' then 1 when 'SEDANG' then 2 else 3 end end asc,
    dc.queue_entered_at asc, dc.id
  limit greatest(1, least(p_limit, 100)) offset greatest(p_offset, 0);
$$;

create or replace function public.dinsos_complete_assessment(p_case_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.dinsos_cases%rowtype; a public.dinsos_asesmen_sosial%rowtype;
begin
  select * into c from public.dinsos_cases where id = p_case_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CASE_NOT_FOUND'; end if;
  if c.current_stage <> 'MENUNGGU_ASESMEN' then raise exception using errcode = '23505', message = 'CASE_ALREADY_PROCESSED'; end if;
  select * into a from public.dinsos_asesmen_sosial where case_id = p_case_id for update;
  if not found then raise exception using errcode = '23514', message = 'ASSESSMENT_INCOMPLETE'; end if;
  if a.rentang_pendapatan is null or a.status_bekerja is null or a.penghasilan_bulanan is null
    or a.pendidikan_tertinggi is null or a.literasi_digital is null
    or a.penyakit_kronis_disabilitas is null or (a.penyakit_kronis_disabilitas = 'ADA' and nullif(trim(a.penyakit_detail), '') is null)
    or a.balita_stunting is null or a.lansia_disabilitas_tanpa_pendamping is null
    or a.anak_putus_sekolah_count is null or a.kelayakan_rumah is null or a.air_sanitasi is null
    or a.nik_valid is null or a.kk_terbaru is null or a.bpjs_aktif is null or a.rekening_bank is null
    or a.motivasi_perubahan is null or nullif(trim(a.keterampilan), '') is null
    or (a.status_bekerja = 'BEKERJA' and nullif(trim(a.jenis_pekerjaan), '') is null)
  then raise exception using errcode = '23514', message = 'ASSESSMENT_INCOMPLETE'; end if;
  update public.dinsos_asesmen_sosial set status='COMPLETED', completed_by=p_actor_id, completed_at=now() where id=a.id;
  update public.dinsos_cases set current_stage='MENUNGGU_PENETAPAN_DESIL' where id=p_case_id;
  insert into public.dinsos_case_events(case_id,event_type,from_stage,to_stage,actor_user_id)
  values(p_case_id,'ASSESSMENT_COMPLETED',c.current_stage,'MENUNGGU_PENETAPAN_DESIL',p_actor_id);
  return jsonb_build_object('assessmentId',a.id,'stage','MENUNGGU_PENETAPAN_DESIL');
end;
$$;

create or replace function public.dinsos_override_result(p_case_id uuid, p_actor_id uuid, p_new_desil integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.dinsos_cases%rowtype; a public.dinsos_asesmen_sosial%rowtype; r public.dinsos_case_results%rowtype; official integer; old_value integer;
begin
  if not exists(select 1 from public.user_capabilities where user_id=p_actor_id and capability='DINSOS_DESIL_OVERRIDE') then
    raise exception using errcode='42501', message='CAPABILITY_REQUIRED';
  end if;
  if p_new_desil not between 1 and 10 or length(trim(p_reason)) not between 20 and 1000 then raise exception using errcode='23514', message='INVALID_OVERRIDE'; end if;
  select * into c from public.dinsos_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002', message='CASE_NOT_FOUND'; end if;
  if c.current_stage <> 'MENUNGGU_PENETAPAN_DESIL' then raise exception using errcode='23505', message='CASE_ALREADY_PROCESSED'; end if;
  select * into a from public.dinsos_asesmen_sosial where case_id=p_case_id and status='COMPLETED';
  if not found then raise exception using errcode='23514', message='ASSESSMENT_INCOMPLETE'; end if;
  select pd.desil_dtsen into official from public.penetapan_desil pd where pd.warga_id=c.warga_id and pd.desil_dtsen is not null order by pd.created_at desc nulls last,pd.id desc limit 1;
  if official is null then raise exception using errcode='23514', message='OFFICIAL_DESIL_MISSING'; end if;
  select * into r from public.dinsos_case_results where case_id=p_case_id for update;
  if found and r.status='CONFIRMED' then raise exception using errcode='23505', message='CASE_ALREADY_PROCESSED'; end if;
  old_value := coalesce(r.operational_desil, official);
  insert into public.dinsos_case_results(case_id,assessment_id,official_desil,operational_desil,disposition,result_source)
  values(p_case_id,a.id,official,p_new_desil,case when p_new_desil<=2 then 'STABILISASI_SOSIAL' else 'SPLIT_JALUR' end,'OVERRIDE')
  on conflict(case_id) do update set operational_desil=excluded.operational_desil,disposition=excluded.disposition,result_source='OVERRIDE',updated_at=now();
  insert into public.dinsos_desil_overrides(case_id,old_desil,new_desil,reason,actor_user_id) values(p_case_id,old_value,p_new_desil,trim(p_reason),p_actor_id);
  return jsonb_build_object('oldDesil',old_value,'newDesil',p_new_desil);
end;
$$;

create or replace function public.dinsos_confirm_result(p_case_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.dinsos_cases%rowtype; a public.dinsos_asesmen_sosial%rowtype; r public.dinsos_case_results%rowtype; official integer; chosen integer; next_stage varchar;
begin
  select * into c from public.dinsos_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002', message='CASE_NOT_FOUND'; end if;
  if c.current_stage <> 'MENUNGGU_PENETAPAN_DESIL' then raise exception using errcode='23505', message='CASE_ALREADY_PROCESSED'; end if;
  select * into a from public.dinsos_asesmen_sosial where case_id=p_case_id and status='COMPLETED';
  if not found then raise exception using errcode='23514', message='ASSESSMENT_INCOMPLETE'; end if;
  select pd.desil_dtsen into official from public.penetapan_desil pd where pd.warga_id=c.warga_id and pd.desil_dtsen is not null order by pd.created_at desc nulls last,pd.id desc limit 1;
  if official is null then raise exception using errcode='23514', message='OFFICIAL_DESIL_MISSING'; end if;
  select * into r from public.dinsos_case_results where case_id=p_case_id for update;
  chosen := coalesce(r.operational_desil, official);
  next_stage := case when chosen<=2 then 'STABILISASI_DIBUTUHKAN' else 'MENUNGGU_SPLIT_JALUR' end;
  insert into public.dinsos_case_results(case_id,assessment_id,status,official_desil,operational_desil,disposition,result_source,confirmed_by,confirmed_at)
  values(p_case_id,a.id,'CONFIRMED',official,chosen,case when chosen<=2 then 'STABILISASI_SOSIAL' else 'SPLIT_JALUR' end,coalesce(r.result_source,'SYSTEM'),p_actor_id,now())
  on conflict(case_id) do update set status='CONFIRMED',official_desil=excluded.official_desil,operational_desil=excluded.operational_desil,disposition=excluded.disposition,confirmed_by=p_actor_id,confirmed_at=now(),updated_at=now();
  update public.dinsos_cases set current_stage=next_stage where id=p_case_id;
  insert into public.dinsos_case_events(case_id,event_type,from_stage,to_stage,actor_user_id,metadata) values(p_case_id,'RESULT_CONFIRMED',c.current_stage,next_stage,p_actor_id,jsonb_build_object('operationalDesil',chosen));
  return jsonb_build_object('stage',next_stage,'operationalDesil',chosen);
end;
$$;

create or replace function public.dinsos_send_stabilization(p_case_id uuid, p_actor_id uuid, p_source_opd_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.dinsos_cases%rowtype; r public.dinsos_case_results%rowtype; referral_id uuid;
begin
  select * into c from public.dinsos_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002', message='CASE_NOT_FOUND'; end if;
  if c.current_stage <> 'STABILISASI_DIBUTUHKAN' then raise exception using errcode='23505', message='REFERRAL_ALREADY_SENT'; end if;
  select * into r from public.dinsos_case_results where case_id=p_case_id and status='CONFIRMED' and disposition='STABILISASI_SOSIAL';
  if not found then raise exception using errcode='23514', message='RESULT_NOT_CONFIRMED'; end if;
  insert into public.referral_mbi(case_id,warga_id,referral_type,source_opd_id,target_opd_id,target_program,sent_by)
  values(p_case_id,c.warga_id,'PROTEKSI_STABILISASI',p_source_opd_id,p_source_opd_id,'Proteksi & Stabilisasi',p_actor_id)
  returning id into referral_id;
  update public.dinsos_cases set current_stage='MENUNGGU_STABILISASI' where id=p_case_id;
  insert into public.dinsos_case_events(case_id,event_type,from_stage,to_stage,actor_user_id,metadata) values(p_case_id,'STABILIZATION_REFERRAL_SENT',c.current_stage,'MENUNGGU_STABILISASI',p_actor_id,jsonb_build_object('referralId',referral_id));
  return jsonb_build_object('referralId',referral_id,'stage','MENUNGGU_STABILISASI');
exception when unique_violation then
  raise exception using errcode='23505', message='REFERRAL_ALREADY_SENT';
end;
$$;

do $$ declare t text; begin
  foreach t in array array['user_capabilities','dinsos_cases','dinsos_asesmen_sosial','dinsos_case_results','dinsos_desil_overrides','dinsos_case_events','referral_mbi'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
  end loop;
end $$;

revoke all on function public.dinsos_queue_summary() from public, anon, authenticated;
grant execute on function public.dinsos_queue_summary() to service_role;
revoke all on function public.list_dinsos_cases(text,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.list_dinsos_cases(text,text,text,text,integer,integer) to service_role;
revoke all on function public.dinsos_complete_assessment(uuid,uuid) from public, anon, authenticated;
grant execute on function public.dinsos_complete_assessment(uuid,uuid) to service_role;
revoke all on function public.dinsos_override_result(uuid,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.dinsos_override_result(uuid,uuid,integer,text) to service_role;
revoke all on function public.dinsos_confirm_result(uuid,uuid) from public, anon, authenticated;
grant execute on function public.dinsos_confirm_result(uuid,uuid) to service_role;
revoke all on function public.dinsos_send_stabilization(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.dinsos_send_stabilization(uuid,uuid,uuid) to service_role;
revoke all on function public.touch_dinsos_updated_at() from public, anon, authenticated;
