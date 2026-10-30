# Legacy SQL (not run by the CLI)

These are the original hand-run SQL files from before the project used `supabase/migrations`. They are kept for reference only.
`supabase db push` does not read this folder.

- `supabase-schema.sql` is the original base schema.
- `supabase-migration-002 ... 019` were applied by hand in the Supabase SQL editor. Their changes are also present in
  `supabase/migrations/2026081900000N_*.sql`; where both exist, the file in `supabase/migrations` is the one that counts.
- `supabase-migration-020 ... 023` (funding pipeline) existed ONLY as hand-run files, so they were promoted to real migrations
  `20261001000047` to `20261001000050` in `supabase/migrations`. They were already applied to production by hand.

New schema changes go in `supabase/migrations/` only. To make production's history table match what is already applied, see
`scripts/repair-migration-history.sh`.
