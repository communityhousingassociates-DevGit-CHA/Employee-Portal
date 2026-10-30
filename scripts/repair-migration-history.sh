#!/usr/bin/env bash
# One-time repair of Supabase's migration history table so `supabase db push` can be trusted again.
#
# Migrations 033-043, the funding migrations 047-050 (promoted from hand-run root SQL) and the three from 2026-10-29 were applied to production by other means (the Management API), so the CLI's
# history table does not list them and `supabase migration list` shows them as pending. `db push` would try to run them AGAIN.
# This marks them as applied WITHOUT running them. It writes only to supabase_migrations.schema_migrations.
#
# Verified read-only against production on 2026-10-30 before this script was written:
#   - 047-050 (funding): every table and column they create exists; the files use IF NOT EXISTS so a re-run is harmless
#   - 033-039, 041, 043, 20261029000044: every table, column and function they create exists
#   - 035, 042: notifications_kind_check allows 'cancelled' and 'submitted'
#   - 20261029000040 / 041: anon and authenticated hold no select/insert/update on the tables (spot-checked employees, leave_requests)
#   - 20260930000040_clear_future_autofill: data-only and idempotent, so marking it applied is harmless either way
#
# Do NOT add 20261030000045 or 20261030000046 here: they are new and must be applied for real (supabase db push) before the code deploys.
#
# Usage (needs the project linked and SUPABASE_ACCESS_TOKEN set):  bash scripts/repair-migration-history.sh
set -euo pipefail
VERSIONS=(
  20260929000033 20260929000034 20260929000035
  20260930000036 20260930000037 20260930000038 20260930000039 20260930000040
  20261005000041 20261013000042 20261027000043
  20261029000040 20261029000041 20261029000044
  20261001000047 20261001000048 20261001000049 20261001000050
)
echo "Marking ${#VERSIONS[@]} migrations as applied (no SQL is run)..."
supabase migration repair --status applied "${VERSIONS[@]}" --linked
echo; echo "History now:"; supabase migration list --linked
echo; echo "Expected: only 20261030000045 and 20261030000046 still pending."
