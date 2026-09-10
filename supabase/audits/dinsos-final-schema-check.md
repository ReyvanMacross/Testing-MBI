# Dinsos Final Hosted Schema Check

- Migration target: `202609080001_dinsos_final_hardening.sql`
- Local migration chain: PASS (19 unique, monotonic files)
- Local trigger-function ordering: PASS
- Hosted migration 013: PENDING SQL Editor execution
- Hosted tables, columns, constraints, index, RPC, RLS, and privileges: PENDING SQL Editor execution

Run `dinsos-final-schema-check.sql` in the linked Supabase SQL Editor after applying migration 013. Every expected table, column, constraint, index, and RLS row must report `PASS`. Every `SECURITY DEFINER` RPC must report `SEARCH_PATH_PASS`, and RPC privileges must not list `PUBLIC`, `anon`, or `authenticated`.

No database credential or secret is stored in this audit record.
