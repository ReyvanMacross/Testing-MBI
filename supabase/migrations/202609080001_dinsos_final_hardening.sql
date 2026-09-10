-- Tahap 14E: final integrity constraints for the Dinsos referral lifecycle.
-- This migration intentionally contains no feature or fixture data.

alter table public.referral_mbi
drop constraint if exists referral_mbi_jalur_lifecycle_check;

alter table public.referral_mbi
add constraint referral_mbi_jalur_lifecycle_check
check (
  referral_type <> 'JALUR_MBI'
  or (
    status = 'MENUNGGU_RUJUKAN'
    and sent_at is null
    and referral_date is null
    and program_id is null
  )
  or (
    status in ('TERKIRIM', 'DITERIMA', 'DIPROSES', 'SELESAI')
    and sent_at is not null
    and referral_date is not null
    and program_id is not null
  )
  or status = 'DIBATALKAN'
);

alter table public.referral_mbi
drop constraint if exists referral_mbi_received_timestamp_check;

alter table public.referral_mbi
add constraint referral_mbi_received_timestamp_check
check (
  status not in ('DITERIMA', 'DIPROSES', 'SELESAI')
  or received_at is not null
);

alter table public.referral_mbi
drop constraint if exists referral_mbi_processing_timestamp_check;

alter table public.referral_mbi
add constraint referral_mbi_processing_timestamp_check
check (
  status not in ('DIPROSES', 'SELESAI')
  or processing_started_at is not null
);

alter table public.referral_mbi
drop constraint if exists referral_mbi_completed_timestamp_check;

alter table public.referral_mbi
add constraint referral_mbi_completed_timestamp_check
check (
  status <> 'SELESAI'
  or completed_at is not null
);

alter table public.referral_mbi
drop constraint if exists referral_mbi_timestamp_order_check;

alter table public.referral_mbi
add constraint referral_mbi_timestamp_order_check
check (
  (
    received_at is null
    or (
      sent_at is not null
      and received_at >= sent_at
    )
  )
  and (
    processing_started_at is null
    or (
      received_at is not null
      and processing_started_at >= received_at
    )
  )
  and (
    completed_at is null
    or (
      processing_started_at is not null
      and completed_at >= processing_started_at
    )
  )
);

create unique index if not exists uq_referral_single_transition_event
on public.referral_mbi_events(referral_id, event_type)
where event_type in (
  'CREATED',
  'SENT',
  'RECEIVED',
  'PROCESS_STARTED',
  'COMPLETED',
  'CANCELLED'
);
