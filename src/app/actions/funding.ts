'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee } from '@/lib/auth/session'
import { searchFunders, funderKey } from '@/lib/funding-search'
import { FUNDING_STAGES, SEARCH_DAILY_LIMIT, type FundingSuggestion, type SearchStatus, GEOGRAPHIES, PROFILE_KINDS, PROFILE_STATUSES, RELATIONSHIPS, canAccessFunding, safeUrl, type FundingActivity, type FundingInput, type FundingRow, type FundingStage, type ProfileField, type ProfileKind, type ProfileStatus } from '@/lib/constants/funding'

/** Funding is limited to the CEO (and the super admin while testing) — see canAccessFunding. */
async function requireFundingAccess() {
  const employee = await getCurrentEmployee()
  if (!canAccessFunding(employee)) throw new Error('Forbidden')
  return employee!
}

const COLUMNS = 'id, funder, funder_type, geography, relationship, fit_notes, ask_size_published, process_notes, eligibility_notes, priority, stage, ask_amount, probability, purpose, owner, next_step, next_step_due, loi_sent_on, proposal_due, decision_date, awarded_amount, website_url, application_url, source_url, verification, updated_at'

// Empty strings from form inputs become null so dates/numbers don't fail on insert.
function clean(input: FundingInput) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v
  for (const k of ['website_url', 'application_url', 'source_url'] as const) {
    if (out[k] != null && !safeUrl(out[k] as string)) throw new Error('Links must start with http:// or https://')
    if (out[k] != null) out[k] = safeUrl(out[k] as string)
  }
  if (!FUNDING_STAGES.includes((out.stage ?? 'research') as FundingStage)) throw new Error('Invalid stage')
  if (!GEOGRAPHIES.includes((out.geography ?? 'baltimore') as (typeof GEOGRAPHIES)[number])) throw new Error('Invalid geography')
  if (!RELATIONSHIPS.includes((out.relationship ?? 'none') as (typeof RELATIONSHIPS)[number])) throw new Error('Invalid relationship')
  if (out.probability != null && (Number(out.probability) < 0 || Number(out.probability) > 100)) throw new Error('Probability must be 0-100')
  return out
}

export async function getFunding(): Promise<FundingRow[]> {
  await requireFundingAccess()
  const admin = createAdminClient()
  const { data, error } = await admin.from('funding_pipeline').select(COLUMNS).order('priority').order('funder')
  if (error) throw new Error(error.message)
  return (data ?? []) as FundingRow[]
}

export async function saveFunding(id: string | null, input: FundingInput) {
  const employee = await requireFundingAccess()
  if (!input.funder?.trim()) throw new Error('Funder name is required')
  const admin = createAdminClient()
  const values = { ...clean(input), updated_at: new Date().toISOString() }
  const { error } = id
    ? await admin.from('funding_pipeline').update(values).eq('id', id)
    : await admin.from('funding_pipeline').insert({ ...values, created_by: employee.id })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/funding')
}

export async function setFundingStage(id: string, stage: FundingStage) {
  const employee = await requireFundingAccess()
  if (!FUNDING_STAGES.includes(stage)) throw new Error('Invalid stage')
  const admin = createAdminClient()
  const { error } = await admin.from('funding_pipeline').update({ stage, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  // Stage moves are logged so the history of each funder stays auditable.
  await admin.from('funding_activity').insert({ pipeline_id: id, note: `Stage changed to ${stage.replace(/_/g, ' ')}`, author_id: employee.id })
  revalidatePath('/admin/funding')
}

export async function deleteFunding(id: string) {
  await requireFundingAccess()
  const admin = createAdminClient()
  const { error } = await admin.from('funding_pipeline').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/funding')
}

export async function getFundingActivity(pipelineId: string): Promise<FundingActivity[]> {
  await requireFundingAccess()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('funding_activity')
    .select('id, note, created_at, author:employees!funding_activity_author_id_fkey(name)')
    .eq('pipeline_id', pipelineId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  type Row = { id: string; note: string; created_at: string; author: { name: string | null } | { name: string | null }[] | null }
  return ((data ?? []) as unknown as Row[]).map(r => {
    const author = Array.isArray(r.author) ? r.author[0] : r.author
    return { id: r.id, note: r.note, created_at: r.created_at, author_name: author?.name ?? null }
  })
}

export async function addFundingNote(pipelineId: string, note: string) {
  const employee = await requireFundingAccess()
  if (!note.trim()) throw new Error('Note is empty')
  const admin = createAdminClient()
  const { error } = await admin.from('funding_activity').insert({ pipeline_id: pipelineId, note: note.trim(), author_id: employee.id })
  if (error) throw new Error(error.message)
  await admin.from('funding_pipeline').update({ updated_at: new Date().toISOString() }).eq('id', pipelineId)
  revalidatePath('/admin/funding')
}

// ---- Grants Profile ----

const PROFILE_COLUMNS = 'id, section, field_key, label, value, kind, status, source_note, sort, updated_at'

export async function getProfile(): Promise<ProfileField[]> {
  await requireFundingAccess()
  const admin = createAdminClient()
  const { data, error } = await admin.from('grants_profile').select(PROFILE_COLUMNS).order('section').order('sort').order('label')
  if (error) throw new Error(error.message)
  return (data ?? []) as ProfileField[]
}

export async function saveProfileField(id: string, input: { value: string | null; status: ProfileStatus; source_note?: string | null }) {
  const employee = await requireFundingAccess()
  if (!PROFILE_STATUSES.includes(input.status)) throw new Error('Invalid status')
  const value = input.value?.trim() ? input.value.trim() : null
  // A field with no content cannot be draft or approved.
  const status: ProfileStatus = value ? input.status : 'needed'
  const admin = createAdminClient()
  const update: Record<string, unknown> = { value, status, updated_by: employee.id, updated_at: new Date().toISOString() }
  if (input.source_note !== undefined) update.source_note = input.source_note?.trim() || null
  const { error } = await admin.from('grants_profile').update(update).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/funding')
}

export async function addProfileField(input: { section: string; label: string; kind: ProfileKind }) {
  const employee = await requireFundingAccess()
  const section = input.section.trim()
  const label = input.label.trim()
  if (!section || !label) throw new Error('Section and label are required')
  if (!PROFILE_KINDS.includes(input.kind)) throw new Error('Invalid field type')
  const admin = createAdminClient()
  const { data: last } = await admin.from('grants_profile').select('sort').eq('section', section).order('sort', { ascending: false }).limit(1)
  const sort = ((last?.[0]?.sort as number | undefined) ?? 0) + 10
  const field_key = `custom_${Date.now().toString(36)}`
  const { error } = await admin.from('grants_profile').insert({ section, label, kind: input.kind, field_key, sort, updated_by: employee.id })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/funding')
}

export async function deleteProfileField(id: string) {
  await requireFundingAccess()
  const admin = createAdminClient()
  const { error } = await admin.from('grants_profile').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/funding')
}

// ---- AI funder search (review queue) ----

const SUGGESTION_COLUMNS = 'id, funder, funder_type, geography, priority, fit_notes, ask_size_published, process_notes, eligibility_notes, next_step, next_step_due, website_url, application_url, source_url, verification, created_at'

export async function getSuggestions(): Promise<FundingSuggestion[]> {
  await requireFundingAccess()
  const admin = createAdminClient()
  const { data, error } = await admin.from('funding_suggestions').select(SUGGESTION_COLUMNS).eq('status', 'new').order('priority').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as FundingSuggestion[]
}

export async function getSearchStatus(): Promise<SearchStatus> {
  await requireFundingAccess()
  const admin = createAdminClient()
  const since = new Date(Date.now() - 24 * 3600e3).toISOString()
  const { data } = await admin.from('funding_search_runs').select('created_at').gte('created_at', since).order('created_at', { ascending: false })
  return { configured: !!process.env.ANTHROPIC_API_KEY, runsToday: data?.length ?? 0, dailyLimit: SEARCH_DAILY_LIMIT, lastRunAt: data?.[0]?.created_at ?? null }
}

export async function runFundingSearch(focus: string): Promise<{ added: number }> {
  const employee = await requireFundingAccess()
  const admin = createAdminClient()
  const status = await getSearchStatus()
  if (!status.configured) throw new Error('The funder search is not set up yet: add ANTHROPIC_API_KEY to the portal environment.')
  if (status.runsToday >= SEARCH_DAILY_LIMIT) throw new Error(`Daily search limit reached (${SEARCH_DAILY_LIMIT} runs per 24 hours).`)

  const cleanFocus = focus.trim().slice(0, 300) || null
  const [{ data: pipeline }, { data: suggestions }, { data: profile }] = await Promise.all([
    admin.from('funding_pipeline').select('funder, stage'),
    admin.from('funding_suggestions').select('funder'),
    admin.from('grants_profile').select('label, value').not('value', 'is', null),
  ])
  const known = [...(pipeline ?? []).map(r => `${r.funder}${r.stage === 'skipped' ? ' (screened out)' : ''}`), ...(suggestions ?? []).map(r => `${r.funder} (already suggested)`)]
  const knownKeys = new Set([...(pipeline ?? []), ...(suggestions ?? [])].map(r => funderKey(r.funder)))
  const facts = (profile ?? []).filter(f => f.value).map(f => `- ${f.label}: ${String(f.value).slice(0, 400)}`).join('\n') || '- (profile not filled in)'

  const { data: run, error: runErr } = await admin.from('funding_search_runs').insert({ focus: cleanFocus, started_by: employee.id }).select('id').single()
  if (runErr || !run) throw new Error(runErr?.message ?? 'Could not start the search')

  try {
    const today = new Date().toISOString().slice(0, 10)
    const result = await searchFunders({ focus: cleanFocus, profileFacts: facts, knownFunders: known, today })
    const fresh = result.candidates
      .map(c => ({ ...c, funder_key: funderKey(c.funder) }))
      .filter((c, i, all) => c.funder_key && !knownKeys.has(c.funder_key) && all.findIndex(x => x.funder_key === c.funder_key) === i)
    if (fresh.length) {
      const { error } = await admin.from('funding_suggestions').upsert(fresh.map(c => ({ ...c, run_id: run.id })), { onConflict: 'funder_key', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    }
    await admin.from('funding_search_runs').update({ candidates: fresh.length, input_tokens: result.inputTokens, output_tokens: result.outputTokens, searches: result.searches }).eq('id', run.id)
    revalidatePath('/admin/funding')
    return { added: fresh.length }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Search failed'
    await admin.from('funding_search_runs').update({ error: message.slice(0, 500) }).eq('id', run.id)
    throw new Error(message)
  }
}

export async function acceptSuggestion(id: string) {
  const employee = await requireFundingAccess()
  const admin = createAdminClient()
  const { data: s, error } = await admin.from('funding_suggestions').select('*').eq('id', id).eq('status', 'new').single()
  if (error || !s) throw new Error('Suggestion not found or already reviewed')
  const { error: insErr } = await admin.from('funding_pipeline').insert({
    funder: s.funder, funder_type: s.funder_type, geography: s.geography, relationship: 'none', priority: s.priority, stage: 'research',
    fit_notes: s.fit_notes, ask_size_published: s.ask_size_published, process_notes: s.process_notes, eligibility_notes: s.eligibility_notes,
    next_step: s.next_step, next_step_due: s.next_step_due, website_url: s.website_url, application_url: s.application_url, source_url: s.source_url,
    verification: `Suggested by AI search. ${s.verification ?? ''}`.trim(), created_by: employee.id,
  })
  if (insErr) throw new Error(insErr.message)
  await admin.from('funding_suggestions').update({ status: 'added', reviewed_by: employee.id, reviewed_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/admin/funding')
}

export async function dismissSuggestion(id: string) {
  const employee = await requireFundingAccess()
  const admin = createAdminClient()
  const { error } = await admin.from('funding_suggestions').update({ status: 'dismissed', reviewed_by: employee.id, reviewed_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/funding')
}
