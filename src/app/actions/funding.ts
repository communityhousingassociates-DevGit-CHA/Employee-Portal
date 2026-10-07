'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee } from '@/lib/auth/session'
import { FUNDING_STAGES, canAccessFunding, type FundingActivity, type FundingInput, type FundingRow, type FundingStage } from '@/lib/constants/funding'

/** Funding is limited to the CEO (and the super admin while testing) — see canAccessFunding. */
async function requireFundingAccess() {
  const employee = await getCurrentEmployee()
  if (!canAccessFunding(employee)) throw new Error('Forbidden')
  return employee!
}

const COLUMNS = 'id, funder, funder_type, fit_notes, ask_size_published, process_notes, eligibility_notes, priority, stage, ask_amount, probability, purpose, owner, next_step, next_step_due, loi_sent_on, proposal_due, decision_date, awarded_amount, source_url, verification, updated_at'

// Empty strings from form inputs become null so dates/numbers don't fail on insert.
function clean(input: FundingInput) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) out[k] = v === '' ? null : v
  if (!FUNDING_STAGES.includes((out.stage ?? 'research') as FundingStage)) throw new Error('Invalid stage')
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
