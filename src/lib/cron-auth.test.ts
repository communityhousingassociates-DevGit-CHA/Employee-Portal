import { describe, it, expect } from 'vitest'
import { isCronAuthorized } from './cron-auth'

describe('isCronAuthorized', () => {
  it('accepts the exact bearer secret', () => expect(isCronAuthorized('Bearer s3cret', 's3cret')).toBe(true))
  it('rejects a wrong secret of the same length', () => expect(isCronAuthorized('Bearer s3creX', 's3cret')).toBe(false))
  it('rejects a different length without throwing', () => expect(isCronAuthorized('Bearer short', 's3cret')).toBe(false))
  it('rejects a missing header', () => expect(isCronAuthorized(null, 's3cret')).toBe(false))
  it('rejects everything when the secret is unset', () => {
    expect(isCronAuthorized('Bearer ', undefined)).toBe(false)
    expect(isCronAuthorized('Bearer undefined', undefined)).toBe(false)
    expect(isCronAuthorized('Bearer ', '')).toBe(false)
  })
})
