# Disnaker Final Hosted Schema Check

Verified against the hosted Supabase project on 2026-09-09.

- Migration 001 foundation: APPLIED
- Migration 001 verification: 3 tables, 4 functions, and 3 RLS-enabled tables PASS
- Migration 001 direct REST: anon `401`; authenticated Admin Disnaker `403`
- Migration 002 canonical operations: APPLIED
- Pre-hardening schema: 6 tables, 20 required columns, 12 foreign keys, 6 RLS-enabled tables, and 6 locked-down server RPCs PASS
- Hosted real workflow: start, progress, completion, placement, and real placement report PASS
- Hosted concurrency: last quota slot and duplicate completion each produce 1 success and 1 conflict; no duplicate event or placement PASS
- Fixture cleanup before hardening: DEV institutions, companies, programs, interventions, placements, referrals, cases, and assessments all `0`
- Migration 003 final hardening: APPLIED
- Migration 004 trigger rowtype correction: APPLIED after post-003 workflow validation exposed a rowtype-specific `NEW` field error
- Final schema objects: 6 tables, 20 required columns, 9 constraints, 8 indexes, 7 routines, and 5 integrity triggers PASS
- Final RLS: 6/6 tables PASS
- Unauthorized table grants: `0`
- Unauthorized RPC grants: `0`
- Local migration chain: PASS (23 unique, monotonic files)
- Local trigger function ordering: PASS
- Final readiness: application, Dinsos domain, Disnaker domain, security, privacy, and fixture blockers all `0`

No database credential or secret is stored in this audit record.
