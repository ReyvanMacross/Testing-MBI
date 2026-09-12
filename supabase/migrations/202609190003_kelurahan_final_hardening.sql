-- Penjagaan konsistensi domain dan audit akhir Kelurahan.

create or replace function public.kelurahan_guard_proposal_scope()
returns trigger language plpgsql set search_path = public as $$
declare warga_row public.warga%rowtype; village public.master_wilayah%rowtype;
begin
  select * into warga_row from public.warga where id=new.warga_id;
  select * into village from public.master_wilayah where id=new.kelurahan_id;
  if warga_row.id is null or village.id is null or village.jenis <> 'KELURAHAN'
     or not village.is_active or village.parent_id is distinct from new.kecamatan_id
     or warga_row.kelurahan_id is distinct from new.kelurahan_id
     or warga_row.kecamatan_id is distinct from new.kecamatan_id then
    raise exception using errcode='23514',message='INVALID_KELURAHAN_SCOPE';
  end if;
  if not exists(select 1 from public.master_program_layanan where id=new.target_program_id and is_active) then
    raise exception using errcode='23514',message='INVALID_TARGET_PROGRAM';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kelurahan_guard_proposal_scope on public.kelurahan_usulan;
create trigger trg_kelurahan_guard_proposal_scope
before insert or update of warga_id,kelurahan_id,kecamatan_id,target_program_id
on public.kelurahan_usulan for each row execute function public.kelurahan_guard_proposal_scope();

create or replace function public.kelurahan_validate_domain_integrity()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'scopeMismatch', (select count(*) from public.kelurahan_usulan proposal
      join public.warga warga on warga.id=proposal.warga_id
      join public.master_wilayah village on village.id=proposal.kelurahan_id
      where warga.kelurahan_id is distinct from proposal.kelurahan_id
         or warga.kecamatan_id is distinct from proposal.kecamatan_id
         or village.parent_id is distinct from proposal.kecamatan_id
         or village.jenis <> 'KELURAHAN'),
    'missingCreatedEvent', (select count(*) from public.kelurahan_usulan proposal
      where not exists(select 1 from public.kelurahan_events event
        where event.usulan_id=proposal.id and event.event_type='PROPOSAL_CREATED')),
    'sentWithoutKecamatan', (select count(*) from public.kelurahan_usulan
      where status='TERKIRIM_KECAMATAN' and kecamatan_usulan_id is null),
    'readyWithoutSurvey', (select count(*) from public.kelurahan_usulan proposal
      where proposal.status in ('SIAP_DIKIRIM_KECAMATAN','TERKIRIM_KECAMATAN')
        and not exists(select 1 from public.kelurahan_surveys survey
          where survey.usulan_id=proposal.id and survey.status='SELESAI'))
  ) into result;
  return result;
end;
$$;

do $$ declare signature text; begin
  foreach signature in array array[
    'public.kelurahan_guard_proposal_scope()',
    'public.kelurahan_validate_domain_integrity()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;
