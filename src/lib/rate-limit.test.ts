import { describe, it, expect } from 'vitest'
import { sharedRateLimited } from './rate-limit'

const rpcReturning = (result: { data?: unknown; error?: unknown }) => ({ rpc: () => Promise.resolve(result) }) as never

describe('sharedRateLimited', () => {
  it('reports limited when the database says the window is over', async () => {
    expect(await sharedRateLimited(rpcReturning({ data: true, error: null }), 'ip:1.2.3.4', 240, 60)).toBe(true)
  })
  it('reports not limited under the limit', async () => {
    expect(await sharedRateLimited(rpcReturning({ data: false, error: null }), 'ip:1.2.3.4', 240, 60)).toBe(false)
  })
  it('fails open on a database error', async () => {
    expect(await sharedRateLimited(rpcReturning({ data: null, error: { message: 'boom' } }), 'k', 1, 60)).toBe(false)
  })
  it('fails open when the call throws', async () => {
    const admin = { rpc: () => { throw new Error('network') } } as never
    expect(await sharedRateLimited(admin, 'k', 1, 60)).toBe(false)
  })
  it('fails open when the lookup is too slow', async () => {
    const slow = { rpc: () => new Promise(() => {}) } as never
    expect(await sharedRateLimited(slow, 'k', 1, 60, 20)).toBe(false)
  })
})
