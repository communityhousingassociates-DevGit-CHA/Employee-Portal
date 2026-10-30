import { describe, it, expect } from 'vitest'
import { staleJobProblem } from './job-watchdog'

const now = new Date('2026-10-30T14:00:00Z')

describe('staleJobProblem', () => {
  it('is fine when the job ran two hours ago', () => expect(staleJobProblem('2026-10-30T12:00:05Z', now, 26)).toBeNull())
  it('is fine right at the limit', () => expect(staleJobProblem('2026-10-29T12:00:00Z', now, 26)).toBeNull())
  it('flags a job that last ran two days ago', () => expect(staleJobProblem('2026-10-28T12:00:00Z', now, 26)).toMatch(/last ran 50 hours ago/))
  it('flags a job that has never run', () => expect(staleJobProblem(null, now, 26)).toMatch(/no recorded runs/))
})
