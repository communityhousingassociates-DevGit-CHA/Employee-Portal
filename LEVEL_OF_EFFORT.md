# CHA Employee Portal — Level of Effort

Estimated from git commit timestamps and file modification times (session-clustering method: gaps under ~90 min counted as continuous work, plus a small buffer before each session's first event).

| Date | Window | Est. hours | Notes |
|---|---|---|---|
| 2026-06-29 | 13:10–17:31 (two sessions) + 22:02 | ~4.5h | Initial Phase 1 build (auth, leave mgmt, timesheets, approvals) in one big commit at 13:10, then admin console + profile/nav work 15:44–17:31. A lone logo file drop at 22:02 adds ~15 min. |
| 2026-06-30 | 10:31–11:59 | ~1.75–2h | Dense sprint — 11 commits in 88 min, revamping dashboard/leave/approvals/employees/timesheet/calendar/history pages + scope doc. |
| 2026-07-02 | 06:15–06:21 | ~0.25–0.5h | Uncommitted changes across ~19 files (ResponsiveShell, Sidebar, layout refactors) — all mtimes fall within a 5.5-minute window, which reads like a fast scripted/batch edit rather than sustained manual work. |
| **Total** | | **~6.5–7 hours** | Across 3 active days out of the last 14 (06/23–07/07) |

**Caveats:**
- No commits or file changes on the other 11 days in the window (06/23–06/28, 07/03–07/07 as of this writing).
- ~19 modified/untracked files from the 07/02 session are still uncommitted.
- This method only captures time reflected in file timestamps — it misses planning, Supabase console work, or testing done outside the repo, and likely undercounts prep time behind the large 13:10 initial commit on 06/29.

_Generated 2026-07-07._
