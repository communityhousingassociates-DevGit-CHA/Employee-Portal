# CHA Employee Portal — Phase 2 Project Plan

**Goal:** Load real CHA employee data into the portal and run it in parallel with CHA's existing system for ~30 days, so staff and leadership can validate it before cutting over to production as the system of record.

**Status as of 2026-08-14:** CHA has confirmed they're ready to move forward. Supabase project (`hplqasxmldqlupbmrpko`) confirmed healthy and reachable; schema is applied but empty. See `LEVEL_OF_EFFORT.md` Phase 2 for hour estimates behind each milestone below.

---

## Role & approver decisions (confirmed 2026-08-19, not yet created in DB)

- **Nico Sanders** — President/CEO, nsanders@communityhousingmd.org — final approver. `role: 'ceo'`.
- **Carrileen Edwards** — Accounting Manager, cedwards@communityhousingmd.org — confirmed **`role: 'admin'`**, `job_title: 'Accounting Manager'` (not `role: 'accounting_manager'`). The portal's `role` column is a single value driving every permission check (approvals, Salary, Admin Console); it can't hold two roles at once. Setting `role: 'admin'` gives her full Admin Console access — including the bulk-import tool — so she can manage roster/balance/salary data herself rather than routing it through the admin account. `job_title` is a separate display field, so her profile/directory still shows "Accounting Manager," not "Admin."
- Both records stay **uncreated** until CHA's real data arrives (see Milestone 3) — only their name/title/email appear as reference info under Portal Settings → Approval Workflow so far. Creating either of them now via the bulk-import tool specifically was considered and rejected: the importer has no "update existing employee" mode (a repeat email is a blocking validation error, not an update) and no dedupe on leave-balance rows (a repeat import would insert a second balance row per employee) — so a manually-created record now would conflict with, not merge into, the real import later.
- An alternate/backup approver for Carrileen (to cover timesheet approvals in her absence) is still undesignated.
- **Import tool access:** admin-only for now (current account). Once Carrileen's account exists and is verified working, extend real day-to-day import usage to her — matches her actual role owning this data, and only needs her account to exist, no code change (access is already role-gated to `admin`, which she'll have).

---

## Milestone 1 — Wire remaining pages to real data
Replace `src/lib/mock-data.ts` usage with real Supabase queries, following the pattern already established for Admin Users (`src/app/actions/employees.ts` + `AdminUsersClient.tsx`).

- [ ] Dashboard — leave balance cards, recent requests, timesheet alert
- [ ] Request — leave request form writes to `leave_requests`
- [ ] History — reads real `leave_requests` for the logged-in employee
- [ ] Approvals — CEO queue reads/writes real `leave_requests` status
- [ ] Calendar — team leave calendar reads real approved requests
- [ ] Reports — bi-weekly export view; add a Timesheets tab with a manager-rollup query (per existing instruction, stays inside Reports rather than a separate page)
- [ ] Timesheet — bi-weekly editable grid reads/writes `timesheets` + `timesheet_rows`

## Milestone 2 — Accrual engine
- [ ] Build a function that calculates PTO/sick accrual per pay period by tenure tier and writes `accrual_log` rows
- [ ] Apply the 400-hr PTO carryover cap and the uncapped sick policy
- [ ] Update `leave_balances` from the accrual log rather than hand-editing balances

## Milestone 3 — Real data load
- [ ] Apply `supabase-migration-002-employee-address.sql` (adds `address_line1/2`, `city`, `state`, `postal_code` to `employees`) — not yet applied to the live project; needs the CLI relinked to CHA's Supabase account, or run manually via `psql`/`supabase db push`
- [ ] Send CHA `onboarding/Employee_Information_Intake.xlsx` — roster, contact info, address, hire date, dept/title
- [ ] Send CHA `onboarding/Leave_Balance_Validation.xlsx` — per-employee hire date + CHA's own current PTO/sick/personal balances and rates; sheet auto-calculates the portal's expected tier/accrual rate from hire date and flags any mismatch or 400-hr cap violation before data goes live
- [ ] Resolve any flagged discrepancies with CHA (rate mismatch, over-cap balance) before seeding
- [ ] Seed `employees` + `leave_balances` from the validated data
- [ ] Confirm Nico Sanders and Carrileen Edwards are created with the roles decided above (see "Role & approver decisions"), and that any other managers are represented with the right role

## Milestone 4 — Auth & access
- [ ] Create a real Supabase Auth user per employee (not the `cha-demo` mock-mode cookie bypass)
- [ ] Map each Auth user to their `employees` row
- [ ] Verify role-based access: employee / manager / admin views resolve correctly for real logins

## Milestone 5 — QA / UAT
- [ ] Walk every page end-to-end as an employee, a manager, and the admin/CEO role
- [ ] Confirm exports (CSV/PDF for timesheets and leave reports) match expected real data
- [ ] Fix anything broken before the pilot starts — don't start the parallel run on a known-broken flow

## Milestone 6 — Parallel run (≈30 days)
- [ ] CHA staff use both the portal and their existing system side by side
- [ ] Weekly check-in: compare portal balances/timesheets against the existing system's records, log discrepancies
- [ ] Track a running list of bugs/gaps found during real use; patch as they surface
- [ ] End-of-pilot review with CHA leadership: go/no-go decision on cutover

## Milestone 7 — Production cutover (post-pilot, pending go decision)
- [x] Point `portal.communityhousingassociates.org` at Vercel — **done 2026-08-19.** Domain attached to the `employee-portal` Vercel project (`vercel domains add`), then an `A` record was added at CHA's registrar (GoDaddy): `A  portal  76.76.21.21`. Verified live via `vercel domains verify` (`status: ok`, `misconfigured: false`, domain attached + verified). Optional: Vercel suggests upgrading to a `CNAME  portal  00f4d870281309d0.vercel-dns-017.com.` record instead of the A record for faster edge routing — not required, current setup works.
- [x] Point the portal live at `portal.communityhousingassociates.org` — **done 2026-08-19.** Both domains now alias to the same production deployment; `NEXT_PUBLIC_SITE_URL=https://portal.communityhousingassociates.org` set in Vercel Production env and a fresh prod deploy triggered to pick it up (so invite links/`inviteEmployees` now generate `portal.communityhousingassociates.org` URLs going forward). `employee-portal-virid.vercel.app` still works and still aliases to the same deployment — nothing was removed, just added.
- [ ] Retire/replace the existing system per CHA's own timeline
- [ ] Remove any remaining demo/mock artifacts (`cha-demo` cookie bypass, `/scope` walkthrough page) if CHA wants a clean production instance

---

## Open questions for CHA
- Format/source of the current employee roster and balance data (spreadsheet? existing HR system export?)
- Exact go-live date to anchor the "current balance as of X" data pull
- Who owns weekly discrepancy triage during the parallel run — CHA staff, or flagged back here?
