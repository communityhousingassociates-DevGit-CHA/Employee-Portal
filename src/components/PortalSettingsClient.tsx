'use client'

import { errMsg } from '@/lib/user-error'
import { useState, useTransition } from 'react'
import MileageRateClient from '@/components/MileageRateClient'
import { savePolicySettings, saveGeofenceSettings } from '@/app/actions/portal-settings'
import type { GeofenceSettings } from '@/lib/geofence'
import { setGeofenceOverride } from '@/app/actions/employees'
import { fmtDate } from '@/lib/format-date'

type TravelRow = { id: string; name: string; job_title: string | null; override_until: string | null; granted_by: string | null }
import { HOLIDAY_WORK_MULTIPLIER } from '@/lib/constants/holiday-work'
import type { PolicySettings } from '@/lib/policy'

const APPROVERS = [
  { role: 'Final Approver — President / CEO', name: 'Nico Sanders', email: 'nsanders@communityhousingmd.org' },
  { role: 'Accounting Manager', name: 'Carrileen Edwards', email: 'cedwards@communityhousingmd.org' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-5">
      <div className="bg-gradient-to-r from-[#0b2b35] to-[#02ACC0] px-5 py-3">
        <h2 className="text-white font-bold text-[13px] uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
  )
}

export default function PortalSettingsClient({
  mileageRates,
  canEditMileage,
  initialPolicy,
  initialGeofence,
  canEditGeofence,
  travel,
}: {
  mileageRates: { id: string; year: number; rate_per_mile: number; updated_at: string }[]
  canEditMileage: boolean
  initialPolicy: PolicySettings
  initialGeofence: GeofenceSettings
  canEditGeofence: boolean
  travel: TravelRow[]
}) {
  const [travelRows, setTravelRows] = useState<TravelRow[]>(travel)
  const [travelMsg, setTravelMsg] = useState<string | null>(null)
  const [travelPending, startTravel] = useTransition()
  function setTravel(id: string, days: number) {
    setTravelMsg(null)
    startTravel(async () => {
      try {
        await setGeofenceOverride(id, days)
        const until = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
        setTravelRows(rs => rs.map(r => r.id === id ? { ...r, override_until: until, granted_by: until ? 'you' : null } : r))
        setTravelMsg(days > 0 ? `Travel access granted for ${days} days.` : 'Travel access cleared.')
      } catch (e) { setTravelMsg(errMsg(e, 'Could not update travel access')) }
    })
  }
  const [geoEnabled, setGeoEnabled] = useState(initialGeofence.enabled)
  const [geoRegions, setGeoRegions] = useState(initialGeofence.regions.join(', '))
  const [geoMsg, setGeoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [geoPending, startGeo] = useTransition()
  function saveGeo() {
    setGeoMsg(null)
    startGeo(async () => {
      try { const r = await saveGeofenceSettings({ enabled: geoEnabled, regionsText: geoRegions }); setGeoEnabled(r.enabled); setGeoRegions(r.regions.join(', ')); setGeoMsg({ ok: true, text: 'Saved — applies to the next request.' }) }
      catch (e) { setGeoMsg({ ok: false, text: errMsg(e, 'Could not save') }) }
    })
  }

  const [settings, setSettings] = useState<PolicySettings>(initialPolicy)
  const [savedSettings, setSavedSettings] = useState<PolicySettings>(initialPolicy)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings)

  function set(key: keyof PolicySettings, value: number) {
    setSettings(s => ({ ...s, [key]: value }))
    setSaved(false)
  }

  function save() {
    setError('')
    startTransition(async () => {
      try {
        const result = await savePolicySettings(settings)
        setSettings(result)
        setSavedSettings(result)
        setSaved(true)
        setTimeout(() => setSaved(false), 4000)
      } catch (e) {
        setError(errMsg(e, 'Could not save settings'))
      }
    })
  }

  const inputCls = "px-3 py-2 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0] w-full"
  const num = (key: keyof PolicySettings, step = 1) => (
    <input type="number" min={0} step={step} value={Number.isFinite(settings[key]) ? settings[key] : ''} onChange={e => set(key, e.target.value === '' ? NaN : Number(e.target.value))} className={inputCls} />
  )
  const Static = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] text-[#0b2b35] py-2">{children}</p>
  const SaveButton = ({ className = '' }: { className?: string }) => (
    <button onClick={save} disabled={isPending || !dirty} className={`bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}>
      {isPending ? 'Saving…' : 'Save All Settings'}
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Portal Settings</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Leave policy numbers, approval reminders, and mileage rate. Everything you can edit here is saved and used by the portal; the rest is shown for reference.</p>
        </div>
        <SaveButton />
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4">
          ✅ Settings saved — they apply to the next accrual, request, and approval check.
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-lg px-4 py-2.5 mb-4">{error}</div>}

      <Section id="mileage" title="Mileage Reimbursement Rate">
        <div className="sm:col-span-2">
          <MileageRateClient initialRates={mileageRates} canEdit={canEditMileage} />
        </div>
      </Section>

      <Section id="leave" title="Leave Policy &amp; Accrual Rules">
        <Field label="Annual Leave (PTO) — 0–12 months (hrs/year)" hint="÷ 26 = per pay period">{num('pto_tier_0_12')}</Field>
        <Field label="Annual Leave (PTO) — 13–24 months (hrs/year)">{num('pto_tier_13_24')}</Field>
        <Field label="Annual Leave (PTO) — 25–36 months (hrs/year)">{num('pto_tier_25_36')}</Field>
        <Field label="Annual Leave (PTO) — over 36 months (hrs/year)">{num('pto_tier_36_plus')}</Field>
        <Field label="Sick Accrual (hrs/pay period)" hint="Same for all tenures">{num('sick_rate_per_pp', 0.01)}</Field>
        <Field label="Personal Days (hours granted each January 1)" hint="24 hrs = 3 days">{num('personal_hours_per_year')}</Field>
        <Field label="Carryover Cap — under 60 months (hours)" hint="Combined annual + personal + sick, applied at year-end">{num('carryover_cap_under_60_months')}</Field>
        <Field label="Carryover Cap — 60+ months (hours)" hint="Combined annual + personal + sick, applied at year-end">{num('carryover_cap_60_months_plus')}</Field>
        <Field label="New Hire Waiting Period (days)" hint="Annual (PTO) and sick leave cannot be taken until this period ends">{num('new_hire_waiting_days')}</Field>
        <Field label="Personal Days Waiting Period (months)" hint="Personal Days cannot be taken until this period ends">{num('personal_waiting_months')}</Field>
        <Field label="Holiday work — exempt employees" hint="Set per employee (Admin → Users → Exempt). Applied when the timesheet is approved."><Static>Flex time = {HOLIDAY_WORK_MULTIPLIER} × hours worked on the paid holiday</Static></Field>
        <Field label="Holiday work — non-exempt employees" hint="Shown on Reports → Timesheets for payroll."><Static>Time-and-a-half ({HOLIDAY_WORK_MULTIPLIER}×) for hours worked</Static></Field>
        <Field label="Election voting leave" hint="Approver reviews any request above the standard."><Static>4 hrs standard · up to 6 hrs with manager approval</Static></Field>
        <Field label="Resignation payout" hint="Director flag is set per employee (Admin → Users). Use the calculator on an employee's page."><Static>Up to 120 hrs annual leave · Director 4 weeks&apos; notice · non-Director 2 weeks · sick never paid</Static></Field>
      </Section>

      <Section id="security" title="Sign-in Location (Security)">
        <div className="sm:col-span-2 flex items-center justify-between py-1">
          <div>
            <p className="text-[13px] font-semibold text-[#0b2b35]">Only allow the portal to be used from these states</p>
            <p className="text-[11px] text-gray-400">Uses the location of the person&apos;s internet connection (approximate). Someone outside the list is signed out and can&apos;t use the portal. Individuals can be given travel access from User Management.</p>
          </div>
          <button type="button" disabled={!canEditGeofence} onClick={() => setGeoEnabled(v => !v)} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${geoEnabled ? 'bg-[#02ACC0]' : 'bg-gray-300'} disabled:opacity-50`} aria-pressed={geoEnabled}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${geoEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <Field label="Allowed states" hint="Two-letter codes, comma separated (Maryland region: MD, DC, VA, PA, DE)">
          <input type="text" value={geoRegions} disabled={!canEditGeofence} onChange={e => setGeoRegions(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex items-end gap-3">
          <button onClick={saveGeo} disabled={!canEditGeofence || geoPending} className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] disabled:opacity-40">{geoPending ? 'Saving…' : 'Save location rule'}</button>
          {geoMsg && <span className={`text-[12px] ${geoMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{geoMsg.text}</span>}
        </div>
        {!canEditGeofence && <p className="sm:col-span-2 text-[11px] text-gray-400">Only the super administrator can change this rule.</p>}
      </Section>

      <Section id="travel" title="Travel Access (temporary sign-in from anywhere)">
        <div className="sm:col-span-2 space-y-2">
          <p className="text-[11px] text-gray-400">If someone is traveling, or their phone shows up outside the allowed states, grant travel access before they sign in. It expires on its own, and who granted it is recorded. The System Administrator&apos;s account is always allowed from anywhere.</p>
          {travelRows.map(r => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 bg-[#f8fcfd] border border-[#e8f4f7] rounded-lg px-4 py-2.5">
              <div>
                <p className="text-[13px] font-semibold text-[#0b2b35]">{r.name}{r.job_title && <span className="font-normal text-gray-400"> · {r.job_title}</span>}</p>
                <p className={`text-[11px] ${r.override_until ? 'text-sky-700' : 'text-gray-400'}`}>{r.override_until ? `Travel access until ${fmtDate(r.override_until)}${r.granted_by ? ` (granted by ${r.granted_by})` : ''}` : 'Allowed states only'}</p>
              </div>
              <div className="flex gap-1.5">
                {[1, 7, 14].map(d => <button key={d} disabled={travelPending} onClick={() => setTravel(r.id, d)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-[#d4eef2] text-gray-600 hover:bg-[#f0f7f8] disabled:opacity-40">{d} day{d === 1 ? '' : 's'}</button>)}
                {r.override_until && <button disabled={travelPending} onClick={() => setTravel(r.id, 0)} className="text-[12px] font-semibold px-2.5 py-1 rounded border border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 disabled:opacity-40">Clear</button>}
              </div>
            </div>
          ))}
          {travelMsg && <p className="text-[12px] text-emerald-600">{travelMsg}</p>}
        </div>
      </Section>

      <Section id="payroll" title="Pay Period &amp; Payroll (reference)">
        <Field label="Pay Period"><Static>Bi-weekly, Sunday–Saturday, starting 09-13-2026</Static></Field>
        <Field label="Timesheet Due"><Static>2 calendar days after each period ends</Static></Field>
        <Field label="Pay Date"><Static>Direct deposit, the Tuesday 17 days after each period ends</Static></Field>
        <Field label="Payroll Software"><Static>Sage</Static></Field>
      </Section>

      <Section id="approval" title="Approval Workflow">
        <div className="sm:col-span-2 space-y-3">
          {APPROVERS.map(a => (
            <div key={a.email} className="flex flex-wrap items-center justify-between gap-2 bg-[#f8fcfd] border border-[#e8f4f7] rounded-lg px-4 py-3">
              <div>
                <p className="text-[13px] font-semibold text-[#0b2b35]">{a.name}</p>
                <p className="text-[11px] text-gray-400">{a.role}</p>
              </div>
              <p className="text-[12px] text-[#028a9e] font-medium">{a.email}</p>
            </div>
          ))}
          <p className="text-[11px] text-gray-400">
            Leave requests, expenses, and timesheets are approved by the Accounting Manager or CEO. The Accounting Manager&apos;s own items route to the CEO; the CEO may approve his own (during beta testing, both may approve their own). Notifications to approvers and employees are always on — by email and in the portal.
          </p>
        </div>
        <Field label="Approver reminder after (days of no response)" hint="Approvers get a weekday digest of anything waiting longer than this">{num('approval_reminder_days')}</Field>
      </Section>

      <div className="flex justify-end">
        <SaveButton className="px-6 py-2.5" />
      </div>
    </div>
  )
}
