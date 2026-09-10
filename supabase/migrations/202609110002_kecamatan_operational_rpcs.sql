-- RPC transaksional workflow Kecamatan. Semua operasi dipanggil server aplikasi.

create or replace function public.kecamatan_actor_allowed(
  p_actor_id uuid,
  p_kecamatan_id uuid
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_profiles profile
    join public.master_wilayah wilayah on wilayah.id = profile.wilayah_id
    where profile.id = p_actor_id
      and profile.status = 'AKTIF'
      and profile.role = 'Operator Kecamatan'
      and profile.wilayah_id = p_kecamatan_id
      and wilayah.jenis = 'KECAMATAN'
      and wilayah.is_active
  );
$$;

create or replace function public.kecamatan_validate_jurisdiction(
  p_actor_id uuid,
  p_warga_id uuid,
  p_kelurahan_id uuid
)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  actor_kecamatan uuid;
  warga_row public.warga%rowtype;
  kelurahan_parent uuid;
begin
  select profile.wilayah_id into actor_kecamatan
  from public.user_profiles profile
  join public.master_wilayah wilayah on wilayah.id = profile.wilayah_id
  where profile.id = p_actor_id and profile.status = 'AKTIF'
    and profile.role = 'Operator Kecamatan'
    and wilayah.jenis = 'KECAMATAN' and wilayah.is_active;
  if actor_kecamatan is null then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;

  select * into warga_row from public.warga where id = p_warga_id for share;
  if not found then raise exception using errcode = 'P0002', message = 'WARGA_NOT_FOUND'; end if;
  if warga_row.kecamatan_id is distinct from actor_kecamatan then
    raise exception using errcode = '42501', message = 'WARGA_OUTSIDE_JURISDICTION';
  end if;

  select parent_id into kelurahan_parent from public.master_wilayah
  where id = p_kelurahan_id and jenis = 'KELURAHAN' and is_active;
  if kelurahan_parent is distinct from actor_kecamatan
     or warga_row.kelurahan_id is distinct from p_kelurahan_id then
    raise exception using errcode = '42501', message = 'KELURAHAN_OUTSIDE_JURISDICTION';
  end if;
  return actor_kecamatan;
end;
$$;

create or replace function public.kecamatan_create_proposal(
  p_actor_id uuid,
  p_warga_id uuid,
  p_kelurahan_id uuid,
  p_rt text,
  p_rw text,
  p_initial_desil integer,
  p_target_program_id uuid,
  p_reason text,
  p_is_fixture boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  kecamatan_id_value uuid;
  proposal public.kecamatan_warga_usulan%rowtype;
  program_row public.master_program_layanan%rowtype;
begin
  kecamatan_id_value := public.kecamatan_validate_jurisdiction(p_actor_id, p_warga_id, p_kelurahan_id);
  if p_initial_desil not between 1 and 5 or coalesce(trim(p_rt), '') !~ '^[0-9]{1,3}$'
     or coalesce(trim(p_rw), '') !~ '^[0-9]{1,3}$'
     or length(trim(coalesce(p_reason, ''))) not between 20 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_PROPOSAL_INPUT';
  end if;
  select * into program_row from public.master_program_layanan
  where id = p_target_program_id and is_active;
  if not found then raise exception using errcode = '23514', message = 'INVALID_TARGET_PROGRAM'; end if;

  begin
    insert into public.kecamatan_warga_usulan(
      warga_id, kecamatan_id, kelurahan_id, rt, rw, desil_awal,
      target_program_id, alasan, created_by, updated_by, is_fixture
    ) values (
      p_warga_id, kecamatan_id_value, p_kelurahan_id, trim(p_rt),
      trim(p_rw), p_initial_desil, p_target_program_id, trim(p_reason),
      p_actor_id, p_actor_id, p_is_fixture
    ) returning * into proposal;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'ACTIVE_PROPOSAL_EXISTS';
  end;
  insert into public.kecamatan_events(usulan_id, event_type, title, note, actor_user_id)
  values(proposal.id, 'PROPOSAL_CREATED', 'Usulan warga diterima Kecamatan', trim(p_reason), p_actor_id);
  return jsonb_build_object('proposalId', proposal.id, 'status', proposal.status);
end;
$$;

create or replace function public.kecamatan_assign_survey(
  p_proposal_id uuid,
  p_actor_id uuid,
  p_surveyor_name text,
  p_due_date date,
  p_instruction text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  proposal public.kecamatan_warga_usulan%rowtype;
  survey_id_value uuid;
begin
  select * into proposal from public.kecamatan_warga_usulan where id = p_proposal_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PROPOSAL_NOT_FOUND'; end if;
  if not public.kecamatan_actor_allowed(p_actor_id, proposal.kecamatan_id) then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;
  if proposal.status <> 'MENUNGGU_SURVEI' then
    raise exception using errcode = '23505', message = 'INVALID_PROPOSAL_TRANSITION';
  end if;
  if length(trim(coalesce(p_surveyor_name, ''))) not between 3 and 150
     or p_due_date < current_date
     or length(trim(coalesce(p_instruction, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_SURVEY_ASSIGNMENT';
  end if;
  insert into public.kecamatan_survei(
    usulan_id, petugas_nama, assigned_by, due_date, instruction, is_fixture
  ) values (
    proposal.id, trim(p_surveyor_name), p_actor_id, p_due_date, trim(p_instruction), proposal.is_fixture
  ) returning id into survey_id_value;
  update public.kecamatan_warga_usulan set status = 'SURVEI_DITUGASKAN', updated_by = p_actor_id where id = proposal.id;
  insert into public.kecamatan_events(usulan_id, event_type, title, note, actor_user_id, metadata)
  values(proposal.id, 'SURVEY_ASSIGNED', 'Survei lapangan ditugaskan', trim(p_instruction), p_actor_id,
    jsonb_build_object('surveyor', trim(p_surveyor_name), 'dueDate', p_due_date));
  return jsonb_build_object('surveyId', survey_id_value, 'status', 'SURVEI_DITUGASKAN');
end;
$$;

create or replace function public.kecamatan_submit_survey(
  p_survey_id uuid,
  p_actor_id uuid,
  p_score integer,
  p_factual_desil integer,
  p_notes text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  survey public.kecamatan_survei%rowtype;
  proposal public.kecamatan_warga_usulan%rowtype;
begin
  select * into survey from public.kecamatan_survei where id = p_survey_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'SURVEY_NOT_FOUND'; end if;
  select * into proposal from public.kecamatan_warga_usulan where id = survey.usulan_id for update;
  if not public.kecamatan_actor_allowed(p_actor_id, proposal.kecamatan_id) then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;
  if survey.status not in ('DITUGASKAN', 'SURVEI_ULANG') then
    raise exception using errcode = '23505', message = 'INVALID_SURVEY_TRANSITION';
  end if;
  if p_score not between 0 and 100 or p_factual_desil not between 1 and 5
     or length(trim(coalesce(p_notes, ''))) not between 20 and 3000 then
    raise exception using errcode = '23514', message = 'INVALID_SURVEY_RESULT';
  end if;
  update public.kecamatan_survei set status = 'MENUNGGU_PERSETUJUAN', skor = p_score,
    desil_faktual = p_factual_desil, catatan_faktual = trim(p_notes), surveyed_at = now()
  where id = survey.id;
  update public.kecamatan_warga_usulan set status = 'MENUNGGU_PERSETUJUAN',
    updated_by = p_actor_id where id = proposal.id;
  insert into public.kecamatan_events(usulan_id, event_type, title, note, actor_user_id, metadata)
  values(proposal.id, 'SURVEY_SUBMITTED', 'Hasil survei menunggu persetujuan Kecamatan', trim(p_notes), p_actor_id,
    jsonb_build_object('score', p_score, 'factualDesil', p_factual_desil));
  return jsonb_build_object('surveyId', survey.id, 'status', 'MENUNGGU_PERSETUJUAN');
end;
$$;

create or replace function public.kecamatan_review_survey(
  p_survey_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_target_program_id uuid,
  p_review_note text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  survey public.kecamatan_survei%rowtype;
  proposal public.kecamatan_warga_usulan%rowtype;
  next_survey_status text;
  next_proposal_status text;
begin
  select * into survey from public.kecamatan_survei where id = p_survey_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'SURVEY_NOT_FOUND'; end if;
  select * into proposal from public.kecamatan_warga_usulan where id = survey.usulan_id for update;
  if not public.kecamatan_actor_allowed(p_actor_id, proposal.kecamatan_id) then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;
  if survey.status <> 'MENUNGGU_PERSETUJUAN' then
    raise exception using errcode = '23505', message = 'INVALID_SURVEY_TRANSITION';
  end if;
  if p_decision not in ('APPROVE', 'REPEAT')
     or length(trim(coalesce(p_review_note, ''))) not between 10 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_REVIEW_INPUT';
  end if;
  if p_decision = 'APPROVE' and not exists (
    select 1 from public.master_program_layanan where id = p_target_program_id and is_active
  ) then raise exception using errcode = '23514', message = 'INVALID_TARGET_PROGRAM'; end if;

  next_survey_status := case when p_decision = 'APPROVE' then 'DISETUJUI' else 'SURVEI_ULANG' end;
  next_proposal_status := case when p_decision = 'APPROVE' then 'DISETUJUI' else 'SURVEI_DITUGASKAN' end;
  update public.kecamatan_survei set status = next_survey_status, reviewed_by = p_actor_id,
    reviewed_at = now(), review_note = trim(p_review_note) where id = survey.id;
  update public.kecamatan_warga_usulan set status = next_proposal_status,
    target_program_id = case when p_decision = 'APPROVE' then p_target_program_id else target_program_id end,
    updated_by = p_actor_id where id = proposal.id;
  insert into public.kecamatan_events(usulan_id, event_type, title, note, actor_user_id)
  values(proposal.id,
    case when p_decision = 'APPROVE' then 'SURVEY_APPROVED' else 'SURVEY_REPEAT_REQUESTED' end,
    case when p_decision = 'APPROVE' then 'Hasil survei disetujui Kecamatan' else 'Survei ulang diminta Kecamatan' end,
    trim(p_review_note), p_actor_id);
  return jsonb_build_object('surveyId', survey.id, 'status', next_survey_status, 'proposalStatus', next_proposal_status);
end;
$$;

create or replace function public.kecamatan_send_referral(
  p_proposal_id uuid,
  p_actor_id uuid,
  p_program_id uuid,
  p_category text,
  p_instruction text,
  p_sla_hours integer default 48
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  proposal public.kecamatan_warga_usulan%rowtype;
  survey public.kecamatan_survei%rowtype;
  program_row public.master_program_layanan%rowtype;
  referral_id_value uuid;
  referral_code_value text;
  source_opd uuid;
  generated_code text;
begin
  select * into proposal from public.kecamatan_warga_usulan where id = p_proposal_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PROPOSAL_NOT_FOUND'; end if;
  if not public.kecamatan_actor_allowed(p_actor_id, proposal.kecamatan_id) then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;
  if proposal.status <> 'DISETUJUI' then
    raise exception using errcode = '23505', message = 'INVALID_PROPOSAL_TRANSITION';
  end if;
  select * into survey from public.kecamatan_survei
  where usulan_id = proposal.id and status = 'DISETUJUI' for update;
  if not found then raise exception using errcode = '23514', message = 'APPROVED_SURVEY_REQUIRED'; end if;
  select * into program_row from public.master_program_layanan
  where id = p_program_id and is_active;
  if not found or program_row.jalur is null then
    raise exception using errcode = '23514', message = 'INVALID_TARGET_PROGRAM';
  end if;
  if p_program_id is distinct from proposal.target_program_id then
    raise exception using errcode = '23514', message = 'PROGRAM_MISMATCH';
  end if;
  if length(trim(coalesce(p_category, ''))) not between 3 and 250
     or length(trim(coalesce(p_instruction, ''))) not between 10 and 2000
     or p_sla_hours not between 1 and 720 then
    raise exception using errcode = '23514', message = 'INVALID_REFERRAL_INPUT';
  end if;
  select opd_id into source_opd from public.user_profiles where id = p_actor_id;
  generated_code := 'RUJ-KEC-' || to_char(timezone('Asia/Jakarta', now()), 'YYYY') || '-' ||
    lpad(nextval('public.kecamatan_referral_code_seq')::text, 6, '0');
  insert into public.referral_mbi(
    case_id, warga_id, referral_type, source_opd_id, target_opd_id, target_program,
    status, sent_by, sent_at, jalur, instruction, is_fixture, program_id,
    referral_date, referral_code
  ) values (
    null, proposal.warga_id, 'JALUR_MBI', source_opd, program_row.opd_id, program_row.nama_program,
    'TERKIRIM', p_actor_id, now(), program_row.jalur, trim(p_instruction), proposal.is_fixture,
    program_row.id, current_date, generated_code
  ) returning id, referral_code into referral_id_value, referral_code_value;
  insert into public.kecamatan_referral_details(
    referral_id, usulan_id, survei_id, kecamatan_id, kategori_layanan, sla_hours, is_fixture
  ) values (
    referral_id_value, proposal.id, survey.id, proposal.kecamatan_id, trim(p_category), p_sla_hours, proposal.is_fixture
  );
  insert into public.referral_mbi_events(
    referral_id, event_type, from_status, to_status, title, note, actor_user_id, actor_opd_id
  ) values (
    referral_id_value, 'SENT', null, 'TERKIRIM', 'Rujukan kewilayahan dikirim ke OPD',
    trim(p_instruction), p_actor_id, source_opd
  );
  update public.kecamatan_warga_usulan set status = 'DIRUJUK', updated_by = p_actor_id where id = proposal.id;
  insert into public.kecamatan_events(usulan_id, referral_id, event_type, title, note, actor_user_id, metadata)
  values(proposal.id, referral_id_value, 'REFERRAL_SENT', 'Rujukan diteruskan ke OPD teknis',
    trim(p_instruction), p_actor_id, jsonb_build_object('programId', program_row.id, 'targetOpdId', program_row.opd_id));
  return jsonb_build_object('referralId', referral_id_value, 'referralCode', referral_code_value, 'status', 'TERKIRIM');
end;
$$;

create or replace function public.kecamatan_create_helpdesk_ticket(
  p_actor_id uuid,
  p_warga_id uuid,
  p_category text,
  p_description text,
  p_is_fixture boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  kecamatan_id_value uuid;
  ticket_id_value uuid;
  ticket_code_value text;
begin
  select wilayah_id into kecamatan_id_value from public.user_profiles
  where id = p_actor_id and status = 'AKTIF' and role = 'Operator Kecamatan';
  if kecamatan_id_value is null or not public.kecamatan_actor_allowed(p_actor_id, kecamatan_id_value) then
    raise exception using errcode = '42501', message = 'KECAMATAN_ACTOR_REQUIRED';
  end if;
  if p_warga_id is not null and not exists (
    select 1 from public.warga where id = p_warga_id and kecamatan_id = kecamatan_id_value
  ) then raise exception using errcode = '42501', message = 'WARGA_OUTSIDE_JURISDICTION'; end if;
  if length(trim(coalesce(p_category, ''))) not between 3 and 100
     or length(trim(coalesce(p_description, ''))) not between 20 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_TICKET_INPUT';
  end if;
  ticket_code_value := 'HD-KEC-' || to_char(timezone('Asia/Jakarta', now()), 'YYYY') || '-' ||
    lpad(nextval('public.kecamatan_ticket_code_seq')::text, 6, '0');
  insert into public.kecamatan_helpdesk_tickets(
    ticket_code, kecamatan_id, warga_id, category, description, submitted_by, is_fixture
  ) values (
    ticket_code_value, kecamatan_id_value, p_warga_id, trim(p_category), trim(p_description), p_actor_id, p_is_fixture
  ) returning id into ticket_id_value;
  return jsonb_build_object('ticketId', ticket_id_value, 'ticketCode', ticket_code_value, 'status', 'TERKIRIM');
end;
$$;

do $$ declare signature regprocedure; begin
  foreach signature in array array[
    'public.kecamatan_actor_allowed(uuid,uuid)'::regprocedure,
    'public.kecamatan_validate_jurisdiction(uuid,uuid,uuid)'::regprocedure,
    'public.kecamatan_create_proposal(uuid,uuid,uuid,text,text,integer,uuid,text,boolean)'::regprocedure,
    'public.kecamatan_assign_survey(uuid,uuid,text,date,text)'::regprocedure,
    'public.kecamatan_submit_survey(uuid,uuid,integer,integer,text)'::regprocedure,
    'public.kecamatan_review_survey(uuid,uuid,text,uuid,text)'::regprocedure,
    'public.kecamatan_send_referral(uuid,uuid,uuid,text,text,integer)'::regprocedure,
    'public.kecamatan_create_helpdesk_ticket(uuid,uuid,text,text,boolean)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
    execute format('grant execute on function %s to service_role', signature);
  end loop;
end $$;
