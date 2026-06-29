'use client'

import { useState } from 'react'

const defaultSettings = {
  // Leave policy
  pto_tier_0_12: 120,
  pto_tier_13_24: 132,
  pto_tier_25_36: 144,
  pto_tier_36_plus: 156,
  sick_rate_per_pp: 3.69,
  personal_days_per_year: 3,
  pto_carryover_cap: 400,
  sick_carryover_cap: 0, // 0 = no cap
  personal_carryover: false,
  allow_negative_balance: true,
  new_hire_waiting_days: 90,
  leave_increment: 'hourly',
  blackout_dates_enabled: false,

  // Pay period
  pay_period: 'biweekly',
  pay_period_start: '2026-01-05',
  timesheet_due_days: 2,

  // Approval
  approver_name: 'Nico Sanders',
  approver_email: 'nsanders@communityhousingassociates.org',
  approval_reminder_days: 3,
  multi_step_approval: false,

  // Notifications
  notify_on_submit: true,
  notify_on_approve: true,
  notify_on_deny: true,
  notify_timesheet_due: true,
  notify_low_balance: false,
  low_balance_threshold: 16,

  // Portal
  org_name: 'Community Housing Associates',
  portal_subdomain: 'portal.communityhousingassociates.org',
  state: 'MD',
}

type Settings = typeof defaultSettings

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-white rounded-xl border border-[#d4eef2] overflow-hidden mb-5">
      <div className="bg-gradient-to-r from-[#0b2b35] to-[#02ACC0] px-5 py-3">
        <h2 className="text-white font-bold text-[13px] uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-6 grid grid-cols-2 gap-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children, full }: { label: string; hint?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'col-span-2' : ''}`}>
      <label className="text-[11px] uppercase tracking-wide font-semibold text-[#0b2b35]">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [saved, setSaved] = useState(false)

  function set(key: keyof Settings, value: Settings[keyof Settings]) {
    setSettings(s => ({ ...s, [key]: value }))
  }

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const inputCls = "px-3 py-2 border border-[#d4eef2] rounded-lg text-[14px] focus:outline-none focus:border-[#02ACC0] w-full"
  const toggleCls = (on: boolean) =>
    `relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${on ? 'bg-[#02ACC0]' : 'bg-gray-200'}`

  function Toggle({ k }: { k: keyof Settings }) {
    const on = Boolean(settings[k])
    return (
      <button onClick={() => set(k, !on)} className={toggleCls(on)} type="button">
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    )
  }

  function ToggleRow({ k, label }: { k: keyof Settings; label: string }) {
    return (
      <div className="col-span-2 flex items-center justify-between py-2 border-b border-[#f0f7f8] last:border-0">
        <span className="text-[13px] text-gray-700">{label}</span>
        <Toggle k={k} />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[#0b2b35]">Portal Settings</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Configure leave policy, pay periods, approvals, and notifications</p>
        </div>
        <button onClick={save}
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#028a9e] transition-colors">
          Save All Settings
        </button>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          ✅ Settings saved — changes take effect on next pay period calculation
        </div>
      )}

      {/* Leave Policy */}
      <Section id="leave" title="Leave Policy &amp; Accrual Rules">
        <Field label="PTO — 0–12 Months (hrs/year)" hint="÷ 26 = per pay period rate">
          <input type="number" value={settings.pto_tier_0_12} onChange={e => set('pto_tier_0_12', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="PTO — 13–24 Months (hrs/year)">
          <input type="number" value={settings.pto_tier_13_24} onChange={e => set('pto_tier_13_24', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="PTO — 25–36 Months (hrs/year)">
          <input type="number" value={settings.pto_tier_25_36} onChange={e => set('pto_tier_25_36', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="PTO — 36+ Months (hrs/year)">
          <input type="number" value={settings.pto_tier_36_plus} onChange={e => set('pto_tier_36_plus', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Sick Accrual (hrs/pay period)" hint="Fixed rate — same for all employees">
          <input type="number" step="0.01" value={settings.sick_rate_per_pp} onChange={e => set('sick_rate_per_pp', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Personal Days (per calendar year)">
          <input type="number" value={settings.personal_days_per_year} onChange={e => set('personal_days_per_year', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="PTO Carryover Cap (hours)" hint="Set 0 to allow unlimited carryover">
          <input type="number" value={settings.pto_carryover_cap} onChange={e => set('pto_carryover_cap', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="New Hire Waiting Period (days)" hint="Employees cannot use leave until this period ends">
          <input type="number" value={settings.new_hire_waiting_days} onChange={e => set('new_hire_waiting_days', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Leave Increment">
          <select value={settings.leave_increment} onChange={e => set('leave_increment', e.target.value)} className={inputCls}>
            <option value="hourly">Hourly</option>
            <option value="half-day">Half-day</option>
            <option value="full-day">Full day only</option>
          </select>
        </Field>
        <Field label="Operating State" hint="Affects which leave laws apply">
          <select value={settings.state} onChange={e => set('state', e.target.value)} className={inputCls}>
            <option value="MD">Maryland (MD)</option>
            <option value="DC">Washington DC</option>
            <option value="VA">Virginia (VA)</option>
          </select>
        </Field>
        <ToggleRow k="allow_negative_balance" label="Allow negative leave balances (with approval)" />
        <ToggleRow k="personal_carryover" label="Allow personal days to carry over year to year" />
        <ToggleRow k="blackout_dates_enabled" label="Enable blackout date restrictions" />
      </Section>

      {/* Pay Period */}
      <Section id="payroll" title="Pay Period &amp; Payroll">
        <Field label="Pay Period Type">
          <select value={settings.pay_period} onChange={e => set('pay_period', e.target.value)} className={inputCls}>
            <option value="biweekly">Bi-weekly (26 per year)</option>
            <option value="semimonthly">Semi-monthly (24 per year)</option>
            <option value="weekly">Weekly (52 per year)</option>
          </select>
        </Field>
        <Field label="First Pay Period Start Date">
          <input type="date" value={settings.pay_period_start} onChange={e => set('pay_period_start', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Timesheet Due (days after period ends)" hint="e.g. 2 = timesheet due 2 business days after pay period closes">
          <input type="number" value={settings.timesheet_due_days} onChange={e => set('timesheet_due_days', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Payroll Software">
          <input type="text" defaultValue="Sage 50" className={inputCls} />
        </Field>
      </Section>

      {/* Approval */}
      <Section id="approval" title="Approval Workflow">
        <Field label="Primary Approver Name" full>
          <input type="text" value={settings.approver_name} onChange={e => set('approver_name', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Primary Approver Email" full>
          <input type="email" value={settings.approver_email} onChange={e => set('approver_email', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Reminder After (days of no response)">
          <input type="number" value={settings.approval_reminder_days} onChange={e => set('approval_reminder_days', Number(e.target.value))} className={inputCls} />
        </Field>
        <ToggleRow k="multi_step_approval" label="Require multi-step approval (supervisor + HR)" />
      </Section>

      {/* Notifications */}
      <Section id="notifications" title="Notification Settings">
        <ToggleRow k="notify_on_submit" label="Notify approver when a request is submitted" />
        <ToggleRow k="notify_on_approve" label="Notify employee when request is approved" />
        <ToggleRow k="notify_on_deny" label="Notify employee when request is denied" />
        <ToggleRow k="notify_timesheet_due" label="Remind employees when timesheet is due" />
        <ToggleRow k="notify_low_balance" label="Alert employee when PTO balance is low" />
        {settings.notify_low_balance && (
          <Field label="Low balance threshold (hours)" hint="Send alert when PTO drops below this">
            <input type="number" value={settings.low_balance_threshold} onChange={e => set('low_balance_threshold', Number(e.target.value))} className={inputCls} />
          </Field>
        )}
      </Section>

      {/* Portal info */}
      <Section id="portal" title="Portal Configuration">
        <Field label="Organization Name" full>
          <input type="text" value={settings.org_name} onChange={e => set('org_name', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Portal URL" full>
          <input type="text" value={settings.portal_subdomain} onChange={e => set('portal_subdomain', e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <div className="flex justify-end">
        <button onClick={save}
          className="bg-[#02ACC0] text-white text-[13px] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#028a9e] transition-colors">
          Save All Settings
        </button>
      </div>
    </div>
  )
}
