-- RPC transaksional Kelurahan. Handoff menulis ke workflow Kecamatan yang sama.

create or replace function public.kelurahan_actor_allowed(p_actor_id uuid, p_kelurahan_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_profiles profile
    join public.master_wilayah wilayah on wilayah.id = profile.wilayah_id
    join public.master_wilayah kecamatan on kecamatan.id = wilayah.parent_id
    where profile.id = p_actor_id and profile.status = 'AKTIF'
      and profile.role = 'Operator Kelurahan'
      and profile.wilayah_id = p_kelurahan_id
      and wilayah.jenis = 'KELURAHAN' and wilayah.is_active
      and kecamatan.jenis = 'KECAMATAN' and kecamatan.is_active
  );
$$;

create or replace function public.kelurahan_validate_jurisdiction(
  p_actor_id uuid, p_warga_id uuid
)
returns table(kelurahan_id uuid, kecamatan_id uuid)
language plpgsql volatile security definer set search_path = public as $$
declare actor_kelurahan uuid; actor_kecamatan uuid; warga_row public.warga%rowtype;
begin
  select wilayah.id, wilayah.parent_id into actor_kelurahan, actor_kecamatan
  from public.user_profiles profile
  join public.master_wilayah wilayah on wilayah.id = profile.wilayah_id
  join public.master_wilayah kecamatan on kecamatan.id = wilayah.parent_id
  where profile.id = p_actor_id and profile.status = 'AKTIF'
    and profile.role = 'Operator Kelurahan'
    and wilayah.jenis = 'KELURAHAN' and wilayah.is_active
    and kecamatan.jenis = 'KECAMATAN' and kecamatan.is_active;
  if actor_kelurahan is null then
    raise exception using errcode = '42501', message = 'KELURAHAN_ACTOR_REQUIRED';
  end if;
  select * into warga_row from public.warga where id = p_warga_id for share;
  if not found then raise exception using errcode = 'P0002', message = 'WARGA_NOT_FOUND'; end if;
  if warga_row.kelurahan_id is distinct from actor_kelurahan
     or warga_row.kecamatan_id is distinct from actor_kecamatan then
    raise exception using errcode = '42501', message = 'WARGA_OUTSIDE_KELURAHAN';
  end if;
  return query select actor_kelurahan, actor_kecamatan;
end;
$$;

create or replace function public.kelurahan_create_proposal(
  p_actor_id uuid, p_warga_id uuid, p_rt text, p_rw text,
  p_estimated_desil integer, p_target_program_id uuid, p_reason text,
  p_is_fixture boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare scope record; proposal public.kelurahan_usulan%rowtype;
begin
  select * into scope from public.kelurahan_validate_jurisdiction(p_actor_id, p_warga_id);
  if p_estimated_desil not between 1 and 5
     or coalesce(trim(p_rt), '') !~ '^[0-9]{1,3}$'
     or coalesce(trim(p_rw), '') !~ '^[0-9]{1,3}$'
     or length(trim(coalesce(p_reason, ''))) not between 20 and 2000 then
    raise exception using errcode = '23514', message = 'INVALID_PROPOSAL_INPUT';
  end if;
  if not exists(select 1 from public.master_program_layanan where id = p_target_program_id and is_active) then
    raise exception using errcode = '23514', message = 'INVALID_TARGET_PROGRAM';
  end if;
  begin
    insert into public.kelurahan_usulan(
      warga_id, kelurahan_id, kecamatan_id, rt, rw, estimated_desil,
      target_program_id, reason, created_by, updated_by, is_fixture
    ) values (
      p_warga_id, scope.kelurahan_id, scope.kecamatan_id, trim(p_rt), trim(p_rw),
      p_estimated_desil, p_target_program_id, trim(p_reason), p_actor_id, p_actor_id, p_is_fixture
    ) returning * into proposal;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'ACTIVE_PROPOSAL_EXISTS';
  end;
  insert into public.kelurahan_events(usulan_id,event_type,title,note,actor_user_id)
  values(proposal.id,'PROPOSAL_CREATED','Pengajuan usulan awal dari RT/RW',trim(p_reason),p_actor_id);
  insert into public.kelurahan_documents(usulan_id,document_type,label,verification_status,is_fixture)
  values
    (proposal.id,'KTP','KTP Warga Fisik','VALID',p_is_fixture),
    (proposal.id,'KK','Kartu Keluarga (KK)','VALID',p_is_fixture),
    (proposal.id,'FORM_PENGANTAR_RT_RW','Form Pengantar RT/RW','TERLAMPIR',p_is_fixture);
  return jsonb_build_object('proposalId',proposal.id,'status',proposal.status,'version',proposal.version);
end;
$$;

create or replace function public.kelurahan_assign_survey(
  p_proposal_id uuid, p_actor_id uuid, p_surveyor_profile_id uuid,
  p_surveyor_name text, p_instruction text, p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare proposal public.kelurahan_usulan%rowtype; survey_id_value uuid;
begin
  select * into proposal from public.kelurahan_usulan where id=p_proposal_id for update;
  if not found then raise exception using errcode='P0002',message='PROPOSAL_NOT_FOUND'; end if;
  if not public.kelurahan_actor_allowed(p_actor_id,proposal.kelurahan_id) then
    raise exception using errcode='42501',message='KELURAHAN_ACTOR_REQUIRED';
  end if;
  if proposal.version <> p_expected_version then
    raise exception using errcode='40001',message='PROPOSAL_VERSION_CONFLICT';
  end if;
  if proposal.status <> 'MENUNGGU_VERIFIKASI_RT_RW' then
    raise exception using errcode='23505',message='INVALID_PROPOSAL_TRANSITION';
  end if;
  if length(trim(coalesce(p_surveyor_name,''))) not between 3 and 150
     or length(trim(coalesce(p_instruction,''))) not between 10 and 2000 then
    raise exception using errcode='23514',message='INVALID_SURVEY_ASSIGNMENT';
  end if;
  if p_surveyor_profile_id is not null and not exists(
    select 1 from public.user_profiles where id=p_surveyor_profile_id and status='AKTIF'
      and wilayah_id=proposal.kelurahan_id and role in ('Operator Kelurahan','Operator Lapangan')
  ) then raise exception using errcode='42501',message='SURVEYOR_OUTSIDE_KELURAHAN'; end if;
  insert into public.kelurahan_surveys(
    usulan_id,surveyor_profile_id,surveyor_name,instruction,is_fixture
  ) values(proposal.id,p_surveyor_profile_id,trim(p_surveyor_name),trim(p_instruction),proposal.is_fixture)
  returning id into survey_id_value;
  update public.kelurahan_usulan set status='SURVEI_LAPANGAN',updated_by=p_actor_id,version=version+1
  where id=proposal.id;
  insert into public.kelurahan_events(usulan_id,event_type,title,note,actor_user_id,metadata)
  values(proposal.id,'SURVEY_ASSIGNED','Survei lapangan dan verifikasi faktual PSM',trim(p_instruction),p_actor_id,
    jsonb_build_object('surveyor',trim(p_surveyor_name)));
  return jsonb_build_object('surveyId',survey_id_value,'status','SURVEI_LAPANGAN','version',proposal.version+1);
end;
$$;

create or replace function public.kelurahan_complete_survey(
  p_survey_id uuid, p_actor_id uuid, p_score integer, p_factual_desil integer,
  p_notes text, p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare survey public.kelurahan_surveys%rowtype; proposal public.kelurahan_usulan%rowtype;
begin
  select * into survey from public.kelurahan_surveys where id=p_survey_id for update;
  if not found then raise exception using errcode='P0002',message='SURVEY_NOT_FOUND'; end if;
  select * into proposal from public.kelurahan_usulan where id=survey.usulan_id for update;
  if not public.kelurahan_actor_allowed(p_actor_id,proposal.kelurahan_id) then
    raise exception using errcode='42501',message='KELURAHAN_ACTOR_REQUIRED';
  end if;
  if proposal.version <> p_expected_version then
    raise exception using errcode='40001',message='PROPOSAL_VERSION_CONFLICT';
  end if;
  if proposal.status <> 'SURVEI_LAPANGAN' or survey.status <> 'DITUGASKAN' then
    raise exception using errcode='23505',message='INVALID_SURVEY_TRANSITION';
  end if;
  if p_score not between 0 and 100 or p_factual_desil not between 1 and 5
     or length(trim(coalesce(p_notes,''))) not between 20 and 3000 then
    raise exception using errcode='23514',message='INVALID_SURVEY_RESULT';
  end if;
  update public.kelurahan_surveys set status='SELESAI',score=p_score,
    factual_desil=p_factual_desil,factual_notes=trim(p_notes),surveyed_at=now(),version=version+1
  where id=survey.id;
  update public.kelurahan_usulan set status='SIAP_DIKIRIM_KECAMATAN',
    estimated_desil=p_factual_desil,updated_by=p_actor_id,version=version+1 where id=proposal.id;
  insert into public.kelurahan_documents(usulan_id,survey_id,document_type,label,verification_status,is_fixture)
  values
    (proposal.id,survey.id,'FOTO_LAPANGAN','Foto Fisik Tempat Tinggal / Usaha','TERVERIFIKASI',proposal.is_fixture),
    (proposal.id,survey.id,'FORMULIR_SURVEI','Form Asesmen Faktual PSM','LENGKAP',proposal.is_fixture);
  insert into public.kelurahan_events(usulan_id,event_type,title,note,actor_user_id,metadata)
  values(proposal.id,'SURVEY_COMPLETED','Survei lapangan dan verifikasi faktual selesai',trim(p_notes),p_actor_id,
    jsonb_build_object('score',p_score,'factualDesil',p_factual_desil));
  return jsonb_build_object('proposalId',proposal.id,'status','SIAP_DIKIRIM_KECAMATAN','version',proposal.version+1);
end;
$$;

create or replace function public.kelurahan_send_to_kecamatan(
  p_proposal_id uuid, p_actor_id uuid, p_note text, p_expected_version integer
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  proposal public.kelurahan_usulan%rowtype; survey public.kelurahan_surveys%rowtype;
  kecamatan_proposal_id uuid; kecamatan_survey_id uuid;
begin
  select * into proposal from public.kelurahan_usulan where id=p_proposal_id for update;
  if not found then raise exception using errcode='P0002',message='PROPOSAL_NOT_FOUND'; end if;
  if not public.kelurahan_actor_allowed(p_actor_id,proposal.kelurahan_id) then
    raise exception using errcode='42501',message='KELURAHAN_ACTOR_REQUIRED';
  end if;
  if proposal.version <> p_expected_version then
    raise exception using errcode='40001',message='PROPOSAL_VERSION_CONFLICT';
  end if;
  if proposal.status <> 'SIAP_DIKIRIM_KECAMATAN' then
    raise exception using errcode='23505',message='INVALID_PROPOSAL_TRANSITION';
  end if;
  if length(trim(coalesce(p_note,''))) not between 10 and 2000 then
    raise exception using errcode='23514',message='INVALID_HANDOFF_NOTE';
  end if;
  select * into survey from public.kelurahan_surveys
  where usulan_id=proposal.id and status='SELESAI' for update;
  if not found then raise exception using errcode='23514',message='COMPLETED_SURVEY_REQUIRED'; end if;

  begin
    insert into public.kecamatan_warga_usulan(
      warga_id,kecamatan_id,kelurahan_id,rt,rw,desil_awal,target_program_id,
      alasan,status,created_by,updated_by,is_fixture
    ) values(
      proposal.warga_id,proposal.kecamatan_id,proposal.kelurahan_id,proposal.rt,proposal.rw,
      survey.factual_desil,proposal.target_program_id,proposal.reason,'MENUNGGU_PERSETUJUAN',
      p_actor_id,p_actor_id,proposal.is_fixture
    ) returning id into kecamatan_proposal_id;
  exception when unique_violation then
    raise exception using errcode='23505',message='ACTIVE_KECAMATAN_PROPOSAL_EXISTS';
  end;

  insert into public.kecamatan_survei(
    usulan_id,petugas_nama,petugas_user_id,assigned_by,due_date,instruction,status,
    skor,desil_faktual,catatan_faktual,surveyed_at,is_fixture
  ) values(
    kecamatan_proposal_id,survey.surveyor_name,survey.surveyor_profile_id,p_actor_id,
    (clock_timestamp() at time zone 'Asia/Jakarta')::date,survey.instruction,
    'MENUNGGU_PERSETUJUAN',survey.score,survey.factual_desil,survey.factual_notes,
    survey.surveyed_at,proposal.is_fixture
  ) returning id into kecamatan_survey_id;

  insert into public.kecamatan_documents(
    usulan_id,survei_id,document_type,label,storage_path,mime_type,size_bytes,
    verification_status,is_fixture
  ) select kecamatan_proposal_id,kecamatan_survey_id,
    case document_type
      when 'FORM_PENGANTAR_RT_RW' then 'SURAT_RUJUKAN'
      when 'FORMULIR_SURVEI' then 'FORMULIR_SURVEI'
      else document_type
    end,label,storage_path,mime_type,size_bytes,
    case when verification_status='LENGKAP' then 'TERVERIFIKASI' else verification_status end,
    is_fixture
  from public.kelurahan_documents where usulan_id=proposal.id;

  insert into public.kecamatan_events(usulan_id,event_type,title,note,actor_user_id,metadata)
  values
    (kecamatan_proposal_id,'PROPOSAL_CREATED','Usulan warga diterima dari Kelurahan',proposal.reason,p_actor_id,
      jsonb_build_object('kelurahanUsulanId',proposal.id)),
    (kecamatan_proposal_id,'SURVEY_ASSIGNED','Survei lapangan ditugaskan Kelurahan',survey.instruction,p_actor_id,
      jsonb_build_object('surveyor',survey.surveyor_name)),
    (kecamatan_proposal_id,'SURVEY_SUBMITTED','Hasil survei menunggu persetujuan Kecamatan',trim(p_note),p_actor_id,
      jsonb_build_object('score',survey.score,'factualDesil',survey.factual_desil));

  update public.kelurahan_usulan set status='TERKIRIM_KECAMATAN',
    kecamatan_usulan_id=kecamatan_proposal_id,submitted_to_kecamatan_at=now(),
    updated_by=p_actor_id,version=version+1 where id=proposal.id;
  insert into public.kelurahan_events(usulan_id,event_type,title,note,actor_user_id,metadata)
  values(proposal.id,'SENT_TO_KECAMATAN','Usulan disetujui dan terkirim ke Kecamatan',trim(p_note),p_actor_id,
    jsonb_build_object('kecamatanUsulanId',kecamatan_proposal_id));
  return jsonb_build_object('proposalId',proposal.id,'kecamatanProposalId',kecamatan_proposal_id,
    'status','TERKIRIM_KECAMATAN','version',proposal.version+1);
end;
$$;

create or replace function public.kelurahan_create_helpdesk_ticket(
  p_actor_id uuid,p_category text,p_description text,p_is_fixture boolean default false
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor_kelurahan uuid; ticket public.kelurahan_helpdesk_tickets%rowtype; code text;
begin
  select wilayah_id into actor_kelurahan from public.user_profiles
  where id=p_actor_id and status='AKTIF' and role='Operator Kelurahan';
  if actor_kelurahan is null or not public.kelurahan_actor_allowed(p_actor_id,actor_kelurahan) then
    raise exception using errcode='42501',message='KELURAHAN_ACTOR_REQUIRED';
  end if;
  if length(trim(coalesce(p_category,''))) not between 3 and 100
     or length(trim(coalesce(p_description,''))) not between 20 and 2000 then
    raise exception using errcode='23514',message='INVALID_HELPDESK_INPUT';
  end if;
  code := 'HD-KEL-' || to_char(timezone('Asia/Jakarta',now()),'YYYY') || '-' ||
    lpad(nextval('public.kelurahan_ticket_code_seq')::text,6,'0');
  insert into public.kelurahan_helpdesk_tickets(
    ticket_code,kelurahan_id,category,description,submitted_by,is_fixture
  ) values(code,actor_kelurahan,trim(p_category),trim(p_description),p_actor_id,p_is_fixture)
  returning * into ticket;
  return jsonb_build_object('ticketId',ticket.id,'ticketCode',ticket.ticket_code,'status',ticket.status);
end;
$$;

do $$ declare signature text; begin
  foreach signature in array array[
    'public.kelurahan_actor_allowed(uuid,uuid)',
    'public.kelurahan_validate_jurisdiction(uuid,uuid)',
    'public.kelurahan_create_proposal(uuid,uuid,text,text,integer,uuid,text,boolean)',
    'public.kelurahan_assign_survey(uuid,uuid,uuid,text,text,integer)',
    'public.kelurahan_complete_survey(uuid,uuid,integer,integer,text,integer)',
    'public.kelurahan_send_to_kecamatan(uuid,uuid,text,integer)',
    'public.kelurahan_create_helpdesk_ticket(uuid,text,text,boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;
