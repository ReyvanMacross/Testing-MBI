-- Operasi transaksional workflow perlindungan DP3A.

create or replace function public.dp3a_actor_allowed(p_actor_id uuid,p_opd_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_profiles p join public.master_opd o on o.id=p.opd_id where p.id=p_actor_id and p.status='AKTIF' and p.role='INTERVENSI' and p.opd_id=p_opd_id and o.kode_opd='DP3A');
$$;

create or replace function public.dp3a_start_case(p_referral_id uuid,p_actor_id uuid,p_actor_opd_id uuid,p_program_id uuid,p_unit_id uuid,p_start_date date,p_case_type text,p_support_item text,p_action_plan text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.referral_mbi%rowtype; p public.master_program_layanan%rowtype; d public.dp3a_program_details%rowtype; s public.dp3a_unit_layanan%rowtype; occupied bigint; new_case_id uuid;
begin
  if not public.dp3a_actor_allowed(p_actor_id,p_actor_opd_id) then raise exception using errcode='42501',message='DP3A_ACTOR_REQUIRED'; end if;
  if p_referral_id is null or p_program_id is null or p_unit_id is null or p_start_date is null or length(trim(coalesce(p_case_type,''))) not between 2 and 100 or length(trim(coalesce(p_support_item,''))) not between 3 and 500 or length(trim(coalesce(p_action_plan,''))) not between 10 and 2000 then raise exception using errcode='23514',message='INVALID_CASE_INPUT'; end if;
  select * into r from public.referral_mbi where id=p_referral_id for update; if not found then raise exception using errcode='P0002',message='REFERRAL_NOT_FOUND'; end if;
  if r.target_opd_id<>p_actor_opd_id or r.referral_type<>'JALUR_MBI' or r.jalur<>'PENGUATAN_DASAR' then raise exception using errcode='42501',message='TARGET_OPD_REQUIRED'; end if;
  if r.status<>'TERKIRIM' or exists(select 1 from public.dp3a_cases where referral_id=p_referral_id) then raise exception using errcode='23505',message='CASE_ALREADY_STARTED'; end if;
  select * into p from public.master_program_layanan where id=p_program_id; if not found or not p.is_active or p.opd_id<>p_actor_opd_id or p.jalur is distinct from 'PENGUATAN_DASAR' then raise exception using errcode='23514',message='INVALID_PROGRAM'; end if;
  select * into d from public.dp3a_program_details where program_id=p_program_id for update; if not found or d.unit_id<>p_unit_id then raise exception using errcode='23514',message='INVALID_PROGRAM'; end if;
  select * into s from public.dp3a_unit_layanan where id=p_unit_id and is_active; if not found then raise exception using errcode='23514',message='INVALID_UNIT'; end if;
  select count(*) into occupied from public.dp3a_cases where program_id=p_program_id and case_status<>'TIDAK_AKTIF'; if occupied>=d.capacity then raise exception using errcode='23505',message='PROGRAM_CAPACITY_FULL'; end if;
  insert into public.dp3a_cases(referral_id,program_id,unit_id,start_date,jenis_kasus,support_item,planned_budget,evaluation_note,is_fixture,created_by,updated_by) values(p_referral_id,p_program_id,p_unit_id,p_start_date,trim(p_case_type),trim(p_support_item),d.budget_per_beneficiary,trim(p_action_plan),r.is_fixture,p_actor_id,p_actor_id) returning id into new_case_id;
  perform public.transition_referral_status(p_referral_id,'DITERIMA',p_actor_id,p_actor_opd_id,'Rujukan diterima DP3A untuk verifikasi perlindungan.');
  perform public.transition_referral_status(p_referral_id,'DIPROSES',p_actor_id,p_actor_opd_id,'Intervensi perlindungan mulai diproses.');
  insert into public.dp3a_case_events(case_id,event_type,progress_percent,verification_status,note,actor_user_id) values(new_case_id,'STARTED',0,'MENUNGGU',trim(p_action_plan),p_actor_id);
  return jsonb_build_object('caseId',new_case_id,'referralId',p_referral_id,'status','DIPROSES');
end; $$;

create or replace function public.dp3a_update_case_progress(p_case_id uuid,p_actor_id uuid,p_actor_opd_id uuid,p_progress_percent integer,p_verification_status text,p_realized_amount bigint,p_evaluation_note text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare i public.dp3a_cases%rowtype; r public.referral_mbi%rowtype;
begin
  if not public.dp3a_actor_allowed(p_actor_id,p_actor_opd_id) then raise exception using errcode='42501',message='DP3A_ACTOR_REQUIRED'; end if;
  if p_progress_percent not between 1 and 99 or p_verification_status not in ('MENUNGGU','LULUS','DITOLAK') or p_realized_amount not between 0 and 1000000000000 or length(trim(coalesce(p_evaluation_note,''))) not between 10 and 2000 then raise exception using errcode='23514',message='INVALID_PROGRESS_INPUT'; end if;
  select * into i from public.dp3a_cases where id=p_case_id for update; if not found then raise exception using errcode='P0002',message='CASE_NOT_FOUND'; end if;
  select * into r from public.referral_mbi where id=i.referral_id for update; if not found then raise exception using errcode='P0002',message='REFERRAL_NOT_FOUND'; end if;
  if r.target_opd_id<>p_actor_opd_id or r.jalur<>'PENGUATAN_DASAR' then raise exception using errcode='42501',message='TARGET_OPD_REQUIRED'; end if;
  if r.status<>'DIPROSES' or i.case_status='SELESAI' then raise exception using errcode='23505',message='CASE_ALREADY_COMPLETED'; end if;
  if p_realized_amount>i.planned_budget then raise exception using errcode='23514',message='REALIZATION_EXCEEDS_BUDGET'; end if;
  update public.dp3a_cases set case_status='PENDAMPINGAN',verification_status=p_verification_status,progress_percent=p_progress_percent,evaluation_note=trim(p_evaluation_note),updated_by=p_actor_id where id=p_case_id;
  insert into public.dp3a_realisasi_layanan(case_id,support_item,realized_amount,realization_date,notes,created_by,updated_by) values(p_case_id,i.support_item,p_realized_amount,current_date,trim(p_evaluation_note),p_actor_id,p_actor_id) on conflict(case_id) do update set realized_amount=excluded.realized_amount,notes=excluded.notes,updated_by=p_actor_id,updated_at=now();
  insert into public.dp3a_case_events(case_id,event_type,progress_percent,verification_status,note,actor_user_id) values(p_case_id,'PROGRESS_UPDATED',p_progress_percent,p_verification_status,trim(p_evaluation_note),p_actor_id);
  return jsonb_build_object('caseId',p_case_id,'referralId',r.id,'status','DIPROSES');
end; $$;

create or replace function public.dp3a_complete_case(p_case_id uuid,p_actor_id uuid,p_actor_opd_id uuid,p_realized_amount bigint,p_completion_date date,p_support_item text,p_evaluation text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare i public.dp3a_cases%rowtype; r public.referral_mbi%rowtype; realization_id uuid;
begin
  if not public.dp3a_actor_allowed(p_actor_id,p_actor_opd_id) then raise exception using errcode='42501',message='DP3A_ACTOR_REQUIRED'; end if;
  if p_realized_amount not between 0 and 1000000000000 or p_completion_date is null or length(trim(coalesce(p_support_item,''))) not between 3 and 500 or length(trim(coalesce(p_evaluation,''))) not between 10 and 2000 then raise exception using errcode='23514',message='INVALID_COMPLETION_INPUT'; end if;
  select * into i from public.dp3a_cases where id=p_case_id for update; if not found then raise exception using errcode='P0002',message='CASE_NOT_FOUND'; end if;
  select * into r from public.referral_mbi where id=i.referral_id for update; if not found then raise exception using errcode='P0002',message='REFERRAL_NOT_FOUND'; end if;
  if r.target_opd_id<>p_actor_opd_id or r.jalur<>'PENGUATAN_DASAR' then raise exception using errcode='42501',message='TARGET_OPD_REQUIRED'; end if;
  if r.status<>'DIPROSES' or i.case_status='SELESAI' then raise exception using errcode='23505',message='CASE_ALREADY_COMPLETED'; end if;
  if p_completion_date<i.start_date then raise exception using errcode='23514',message='COMPLETION_BEFORE_START'; end if;
  if p_realized_amount>i.planned_budget then raise exception using errcode='23514',message='REALIZATION_EXCEEDS_BUDGET'; end if;
  update public.dp3a_cases set case_status='SELESAI',verification_status='LULUS',progress_percent=100,support_item=trim(p_support_item),evaluation_note=trim(p_evaluation),updated_by=p_actor_id where id=p_case_id;
  insert into public.dp3a_realisasi_layanan(case_id,support_item,realized_amount,realization_date,notes,created_by,updated_by) values(p_case_id,trim(p_support_item),p_realized_amount,p_completion_date,trim(p_evaluation),p_actor_id,p_actor_id) on conflict(case_id) do update set support_item=excluded.support_item,realized_amount=excluded.realized_amount,realization_date=excluded.realization_date,notes=excluded.notes,updated_by=p_actor_id,updated_at=now() returning id into realization_id;
  perform public.transition_referral_status(i.referral_id,'SELESAI',p_actor_id,p_actor_opd_id,'Intervensi perlindungan selesai dan bantuan telah direalisasikan.');
  insert into public.dp3a_case_events(case_id,event_type,progress_percent,verification_status,note,actor_user_id) values(p_case_id,'COMPLETED',100,'LULUS',trim(p_evaluation),p_actor_id);
  return jsonb_build_object('caseId',p_case_id,'realizationId',realization_id,'referralId',r.id,'status','SELESAI');
end; $$;

create or replace function public.dp3a_create_program(p_actor_id uuid,p_actor_opd_id uuid,p_code text,p_name text,p_category text,p_service_type text,p_unit_id uuid,p_duration_value integer,p_duration_unit text,p_execution_date date,p_budget_per_beneficiary bigint,p_capacity integer,p_description text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare program_id uuid;
begin
  if not public.dp3a_actor_allowed(p_actor_id,p_actor_opd_id) then raise exception using errcode='42501',message='DP3A_ACTOR_REQUIRED'; end if;
  if p_code!~'^PRG-PPA-[0-9]{2}$' or length(trim(coalesce(p_name,''))) not between 5 and 200 or length(trim(coalesce(p_category,''))) not between 2 and 100 or length(trim(coalesce(p_service_type,''))) not between 3 and 200 or p_duration_value not between 1 and 60 or p_duration_unit not in ('HARI','MINGGU','BULAN') or p_execution_date is null or p_budget_per_beneficiary not between 0 and 1000000000000 or p_capacity not between 1 and 10000 or length(trim(coalesce(p_description,''))) not between 10 and 3000 then raise exception using errcode='23514',message='INVALID_PROGRAM_INPUT'; end if;
  if not exists(select 1 from public.dp3a_unit_layanan where id=p_unit_id and is_active) then raise exception using errcode='23514',message='INVALID_UNIT'; end if;
  insert into public.master_program_layanan(kode_program,nama_program,opd_id,jalur,jenis_intervensi,is_active) values(upper(trim(p_code)),trim(p_name),p_actor_opd_id,'PENGUATAN_DASAR',trim(p_service_type),true) returning id into program_id;
  insert into public.dp3a_program_details(program_id,kategori_target,jenis_layanan,unit_id,duration_value,duration_unit,execution_date,budget_per_beneficiary,capacity,description) values(program_id,trim(p_category),trim(p_service_type),p_unit_id,p_duration_value,p_duration_unit,p_execution_date,p_budget_per_beneficiary,p_capacity,trim(p_description));
  return jsonb_build_object('programId',program_id,'code',upper(trim(p_code)));
exception when unique_violation then raise exception using errcode='23505',message='PROGRAM_CODE_EXISTS'; end; $$;

do $$ begin
  revoke all on function public.dp3a_actor_allowed(uuid,uuid) from public,anon,authenticated; grant execute on function public.dp3a_actor_allowed(uuid,uuid) to service_role;
  revoke all on function public.dp3a_start_case(uuid,uuid,uuid,uuid,uuid,date,text,text,text) from public,anon,authenticated; grant execute on function public.dp3a_start_case(uuid,uuid,uuid,uuid,uuid,date,text,text,text) to service_role;
  revoke all on function public.dp3a_update_case_progress(uuid,uuid,uuid,integer,text,bigint,text) from public,anon,authenticated; grant execute on function public.dp3a_update_case_progress(uuid,uuid,uuid,integer,text,bigint,text) to service_role;
  revoke all on function public.dp3a_complete_case(uuid,uuid,uuid,bigint,date,text,text) from public,anon,authenticated; grant execute on function public.dp3a_complete_case(uuid,uuid,uuid,bigint,date,text,text) to service_role;
  revoke all on function public.dp3a_create_program(uuid,uuid,text,text,text,text,uuid,integer,text,date,bigint,integer,text) from public,anon,authenticated; grant execute on function public.dp3a_create_program(uuid,uuid,text,text,text,text,uuid,integer,text,date,bigint,integer,text) to service_role;
end $$;
