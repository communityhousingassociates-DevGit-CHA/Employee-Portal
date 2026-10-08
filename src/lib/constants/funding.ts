export const FUNDING_STAGES = [
  'research', 'intro_call', 'loi_drafted', 'loi_submitted', 'invited_to_apply',
  'proposal_submitted', 'awarded', 'declined', 'reporting', 'skipped',
] as const
export type FundingStage = typeof FUNDING_STAGES[number]

export const STAGE_LABEL: Record<FundingStage, string> = {
  research: 'Research',
  intro_call: 'Intro call',
  loi_drafted: 'LOI drafted',
  loi_submitted: 'LOI submitted',
  invited_to_apply: 'Invited to apply',
  proposal_submitted: 'Proposal submitted',
  awarded: 'Awarded',
  declined: 'Declined',
  reporting: 'Reporting',
  skipped: 'Not pursuing',
}

// Stages where the ask is still live: counted in the weighted pipeline.
export const OPEN_STAGES: FundingStage[] = ['intro_call', 'loi_drafted', 'loi_submitted', 'invited_to_apply', 'proposal_submitted']

export const GEOGRAPHIES = ['baltimore', 'maryland', 'regional', 'federal', 'national'] as const
export type Geography = typeof GEOGRAPHIES[number]
export const GEO_LABEL: Record<Geography, string> = {
  baltimore: 'Baltimore',
  maryland: 'Maryland',
  regional: 'Mid-Atlantic',
  federal: 'Federal',
  national: 'National',
}

// How well CHA already knows the funder. 'existing' funders are tracked but not treated as new prospects.
export const RELATIONSHIPS = ['none', 'warm', 'existing'] as const
export type Relationship = typeof RELATIONSHIPS[number]
export const REL_LABEL: Record<Relationship, string> = { none: 'No relationship', warm: 'Warm intro', existing: 'Existing relationship' }

export type FundingRow = {
  id: string
  funder: string
  funder_type: string | null
  fit_notes: string | null
  ask_size_published: string | null
  process_notes: string | null
  eligibility_notes: string | null
  geography: Geography
  relationship: Relationship
  priority: 'A' | 'B' | 'C'
  stage: FundingStage
  ask_amount: number | null
  probability: number | null
  purpose: string | null
  owner: string | null
  next_step: string | null
  next_step_due: string | null
  loi_sent_on: string | null
  proposal_due: string | null
  decision_date: string | null
  awarded_amount: number | null
  website_url: string | null
  application_url: string | null
  source_url: string | null
  verification: string | null
  updated_at: string
}

export type FundingInput = Partial<Omit<FundingRow, 'id' | 'updated_at'>> & { funder: string }

export type FundingActivity = { id: string; note: string; created_at: string; author_name: string | null }

// ACCESS (testing phase): Executive Funding is visible to the system super admin ONLY, so it can be tested before it is shown to the
// President/CEO. Every funding action re-checks this server-side. Widen it (e.g. add the 'ceo' role) when it leaves testing.
export function canAccessFunding(employee: { role: string; is_super_admin?: boolean | null } | null | undefined): boolean {
  return !!employee && employee.is_super_admin === true
}

// Grants Profile: reusable organization facts and boilerplate for applications.
export const PROFILE_STATUSES = ['needed', 'draft', 'approved'] as const
export type ProfileStatus = typeof PROFILE_STATUSES[number]
export const PROFILE_STATUS_LABEL: Record<ProfileStatus, string> = { needed: 'Needed', draft: 'Draft: confirm', approved: 'Approved' }
export const PROFILE_KINDS = ['text', 'long', 'document'] as const
export type ProfileKind = typeof PROFILE_KINDS[number]

export type ProfileField = {
  id: string
  section: string
  field_key: string
  label: string
  value: string | null
  kind: ProfileKind
  status: ProfileStatus
  source_note: string | null
  sort: number
  updated_at: string
}

// AI funder search: proposals wait in a review queue until a super admin adds or dismisses them.
export type FundingSuggestion = {
  id: string
  funder: string
  funder_type: string | null
  geography: Geography
  priority: 'A' | 'B' | 'C'
  fit_notes: string | null
  ask_size_published: string | null
  process_notes: string | null
  eligibility_notes: string | null
  next_step: string | null
  next_step_due: string | null
  website_url: string | null
  application_url: string | null
  source_url: string | null
  verification: string | null
  created_at: string
}
export type SearchStatus = { configured: boolean; runsToday: number; dailyLimit: number; lastRunAt: string | null }
export const SEARCH_DAILY_LIMIT = 5

// Only http(s) links are ever rendered as hrefs or stored, so a pasted javascript: or data: URL cannot become a clickable link.
export function safeUrl(u: string | null | undefined): string | null {
  const t = (u ?? '').trim()
  return /^https?:\/\/\S+$/i.test(t) ? t : null
}
