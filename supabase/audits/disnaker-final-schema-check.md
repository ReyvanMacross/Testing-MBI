# Disnaker Final Hosted Schema Check

- Migration targets: `202609090001_disnaker_workflow_foundation.sql`, `202609090002_disnaker_operational_master.sql`, and `202609090003_disnaker_final_hardening.sql`
- Local migration chain: PASS (22 unique, monotonic files)
- Local trigger function ordering: PASS
- Hosted migration 001: not applied; the service-role REST probe cannot find `disnaker_program_details`
- Hosted migration 002: pending migration 001 and SQL Editor execution
- Hosted workflow validation: pending migrations 001 and 002
- Hosted migration 003: intentionally not applied before hosted workflow validation
- Hosted tables, columns, constraints, indexes, RPC, RLS, and privileges: pending SQL Editor execution

The current environment has no Supabase CLI access token, direct database connection, or local Docker runtime, so DDL cannot be applied or verified from this workspace. Run `disnaker-final-schema-check.sql` in the linked Supabase SQL Editor after each ordered rollout step. Every expected table, column, constraint, index, trigger, RPC, and RLS row must report `PASS`. RPC privileges must not list `PUBLIC`, `anon`, or `authenticated`.

No database credential or secret is stored in this audit record.
