#!/usr/bin/env node
// Asks the database for every exposed table and view using only the PUBLIC anon key (what any visitor to the site has) and fails if any
// of them hands back a row. All real data access in this app goes through server code, so the answer should always be "nothing".
// Run after adding a table or view, or on a schedule:   npm run probe:anon
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY from the environment or .env.local. Prints counts only, never row data.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function fromEnvFile(name) {
  try {
    const line = readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').find(l => l.startsWith(name + '='))
    return line?.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')
  } catch { return undefined }
}
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromEnvFile('NEXT_PUBLIC_SUPABASE_URL'))?.replace(/\/$/, '')
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? fromEnvFile('NEXT_PUBLIC_SUPABASE_ANON_KEY')
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'); process.exit(2) }
const headers = { apikey: key, Authorization: `Bearer ${key}` }

// Every table/view the code queries, found by scanning src for .from('name'). Used when the API will not list the schema (it should not).
function namesFromCode(dir) {
  const found = new Set()
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== 'node_modules') namesFromCode(p).forEach(n => found.add(n)); continue }
    if (!/\.(ts|tsx)$/.test(f)) continue
    for (const m of readFileSync(p, 'utf8').matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/g)) found.add(m[1])
  }
  return found
}
let names
if (process.argv.length > 2) names = process.argv.slice(2)
else {
  const spec = await fetch(`${url}/rest/v1/`, { headers })
  names = spec.ok
    ? Object.keys((await spec.json()).paths ?? {}).filter(p => p !== '/' && !p.startsWith('/rpc/')).map(p => p.slice(1))
    : [...namesFromCode(new URL('../src', import.meta.url).pathname)].sort()
  if (!spec.ok) console.log(`Schema listing refused for the anon key (HTTP ${spec.status}) - good. Probing the ${names.length} names the code queries instead.`)
}

const leaks = [], errors = []
let denied = 0, empty = 0
for (const name of names) {
  const res = await fetch(`${url}/rest/v1/${encodeURIComponent(name)}?select=*&limit=1`, { headers })
  if (res.status === 401 || res.status === 403 || res.status === 404) { denied++; continue }
  if (!res.ok) { errors.push(`${name}: HTTP ${res.status}`); continue }
  const rows = await res.json()
  if (Array.isArray(rows) && rows.length > 0) leaks.push(name)
  else empty++
}
console.log(`Probed ${names.length} relations with the anon key: ${denied} denied, ${empty} readable but empty, ${leaks.length} leaking, ${errors.length} errors.`)
for (const e of errors) console.log(`  ? ${e}`)
for (const l of leaks) console.log(`  LEAK ${l} returned at least one row to an anonymous request`)
process.exit(leaks.length ? 1 : errors.length ? 3 : 0)
