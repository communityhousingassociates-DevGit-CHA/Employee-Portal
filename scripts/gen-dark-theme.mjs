#!/usr/bin/env node
// Generates src/app/dark-theme.css: dark-mode overrides for every color utility class actually used in src/.
// The app styles itself with hard-coded Tailwind colors (bg-white, text-[#0b2b35], bg-amber-50 ...), so instead of rewriting every
// component, html.dark remaps those classes. Rerun after adding new colors:  node scripts/gen-dark-theme.mjs
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../src', import.meta.url).pathname
const files = []
;(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(f) && files.push(p) } })(root)

const tokenRe = /(?<![\w-])((?:(?:hover|focus|disabled|group-hover):)?(?:bg|text|border|divide|ring|placeholder)-(?:\[#[0-9a-fA-F]{3,8}\]|(?:white|black)|(?:gray|slate|zinc|neutral)-\d{2,3}|(?:amber|emerald|red|rose|violet|sky|blue|green|teal|yellow|orange|indigo|purple|cyan|pink|lime|fuchsia)-\d{2,3}(?:\/\d+)?))(?![\w-])/g
const used = new Set()
for (const f of files) { if (f.endsWith('dark-theme.css')) continue; for (const m of readFileSync(f, 'utf8').matchAll(tokenRe)) used.add(m[1]) }

const HUES = { // [300, 400, 500]
  amber: ['#fcd34d', '#fbbf24', '#f59e0b'], emerald: ['#6ee7b7', '#34d399', '#10b981'], red: ['#fca5a5', '#f87171', '#ef4444'],
  rose: ['#fda4af', '#fb7185', '#f43f5e'], violet: ['#c4b5fd', '#a78bfa', '#8b5cf6'], sky: ['#7dd3fc', '#38bdf8', '#0ea5e9'],
  blue: ['#93c5fd', '#60a5fa', '#3b82f6'], green: ['#86efac', '#4ade80', '#22c55e'], teal: ['#5eead4', '#2dd4bf', '#14b8a6'],
  yellow: ['#fde047', '#facc15', '#eab308'], orange: ['#fdba74', '#fb923c', '#f97316'], indigo: ['#a5b4fc', '#818cf8', '#6366f1'],
  purple: ['#d8b4fe', '#c084fc', '#a855f7'], cyan: ['#67e8f9', '#22d3ee', '#06b6d4'], pink: ['#f9a8d4', '#f472b6', '#ec4899'],
  lime: ['#bef264', '#a3e635', '#84cc16'], fuchsia: ['#f0abfc', '#e879f9', '#d946ef'],
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }

// Palette (dark): page / card / subtle / hover / chip / border / text
const D = { card: '#10262e', subtle: '#0d2128', sunken: '#0b1d24', hover: '#16323b', chip: '#16404b', chipHover: '#1b4854', border: '#1f3b45', border2: '#2a4a56', text: '#e6f2f5' }
const GRAY_TEXT = { 300: '#587480', 400: '#7f98a3', 500: '#98afb8', 600: '#b4c6cd', 700: '#c9d8dd', 800: '#dce8eb', 900: D.text }
const SUBTLE_HEX = new Set(['f8fcfd', 'f9fefe', 'fafefe', 'fbfeff', 'f5fbfc', 'f0fafb', 'f0fbfc'])
const CHIP_HEX = new Set(['e0f5f8', 'e8f4f7', 'dff3f7', 'd4eef2'])
const BORDER_HEX = new Set(['d4eef2', 'e8f4f7', 'f0f7f8', 'eef6f8', 'b9dfe6'])

function rule(base) { // base without variant prefix -> [prop, value] | null
  let m
  if ((m = base.match(/^bg-\[#([0-9a-fA-F]+)\]$/))) {
    const h = m[1].toLowerCase()
    if (h === 'f0f7f8') return ['background-color', D.sunken]
    if (SUBTLE_HEX.has(h)) return ['background-color', D.subtle]
    if (CHIP_HEX.has(h)) return ['background-color', D.chip]
    if (h === 'fff8e6') return ['background-color', '#3a2f12']
    return null
  }
  if (base === 'bg-white') return ['background-color', D.card]
  if ((m = base.match(/^bg-(gray|slate|zinc|neutral)-(\d+)$/))) return { 50: ['background-color', D.subtle], 100: ['background-color', D.hover], 200: ['background-color', D.border] }[m[2]] ?? null
  if ((m = base.match(/^text-\[#([0-9a-fA-F]+)\]$/))) {
    const h = m[1].toLowerCase()
    if (h === '0b2b35') return ['color', D.text]
    if (h === '028a9e') return ['color', '#4fd1e0']
    return null
  }
  if ((m = base.match(/^text-(gray|slate|zinc|neutral)-(\d+)$/))) return GRAY_TEXT[m[2]] ? ['color', GRAY_TEXT[m[2]]] : null
  if ((m = base.match(/^border-\[#([0-9a-fA-F]+)\]$/))) {
    const h = m[1].toLowerCase()
    if (BORDER_HEX.has(h)) return ['border-color', D.border]
    if (h === '0b2b35') return ['border-color', '#5b8794']
    return null
  }
  if ((m = base.match(/^(?:border|divide)-(gray|slate|zinc|neutral)-(\d+)$/))) return { 100: ['border-color', D.border], 200: ['border-color', D.border], 300: ['border-color', D.border2] }[m[2]] ?? null
  if ((m = base.match(/^ring-\[#([0-9a-fA-F]+)\]$/))) return BORDER_HEX.has(m[1].toLowerCase()) ? ['--tw-ring-color', D.border] : null
  if ((m = base.match(/^(bg|text|border)-([a-z]+)-(\d+)(?:\/(\d+))?$/)) && HUES[m[2]]) {
    const [kind, hue, shade] = [m[1], m[2], Number(m[3])]
    const [c300, c400, c500] = HUES[hue]
    if (kind === 'bg') return shade <= 100 ? ['background-color', rgba(c500, 0.16)] : shade === 200 ? ['background-color', rgba(c500, 0.26)] : shade === 300 ? ['background-color', rgba(c500, 0.34)] : null
    if (kind === 'text') return shade >= 600 ? ['color', c300] : shade === 500 ? ['color', c400] : null
    return shade <= 300 ? ['border-color', rgba(c500, 0.4)] : null
  }
  return null
}

const esc = s => s.replace(/[^a-zA-Z0-9_-]/g, c => '\\' + c)
const out = []
const seen = new Set()
for (const tok of [...used].sort()) {
  const m = tok.match(/^(?:(hover|focus|disabled|group-hover):)?(.*)$/)
  const [variant, base] = [m[1], m[2]]
  let r = rule(base)
  if (variant === 'hover' || variant === 'group-hover') {
    if (base === 'bg-[#f0f7f8]') r = ['background-color', D.hover]
    else if (SUBTLE_HEX.has((base.match(/^bg-\[#(\w+)\]$/) || [])[1]?.toLowerCase())) r = ['background-color', '#12292f']
    else if (CHIP_HEX.has((base.match(/^bg-\[#(\w+)\]$/) || [])[1]?.toLowerCase())) r = ['background-color', D.chipHover]
    else if (base === 'text-[#0b2b35]') r = ['color', '#ffffff']
    else if (base === 'text-[#028a9e]') r = ['color', '#7fe0ec']
  }
  if (!r) continue
  const sel = '.' + esc(tok)
  const pseudo = variant === 'hover' ? ':hover' : variant === 'focus' ? ':focus' : variant === 'disabled' ? ':disabled' : variant === 'group-hover' ? '' : ''
  const full = variant === 'group-hover' ? `html.dark .group:hover ${sel}` : `html.dark ${sel}${pseudo}`
  if (tok.startsWith('divide-')) out.push(`html.dark ${sel} > * { ${r[0]}: ${r[1]}; }`)
  else out.push(`${full} { ${r[0]}: ${r[1]}; }`)
}

const css = `/* GENERATED by scripts/gen-dark-theme.mjs — do not edit by hand. Dark-mode overrides, screen only (print/PDF stay light). */
@media screen {
html.dark { color-scheme: dark; }
html.dark body { background: #081419; color: #d7e5e9; }
html.dark input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]), html.dark select, html.dark textarea { background-color: ${D.subtle}; color: ${D.text}; border-color: ${D.border2}; }
html.dark input::placeholder, html.dark textarea::placeholder { color: #6f8993; }
html.dark ::-webkit-scrollbar-thumb { background: #2a4a56; }
html.dark .dark-invert { filter: invert(1) hue-rotate(180deg); }
${out.join('\n')}
/* Surfaces that must stay light in dark mode (the company logo plaque holds a logo designed for white). Keep last. */
html.dark .keep-light { background-color: #fff; }
html.dark .keep-light, html.dark .keep-light * { color: #0b2b35; }
}
`
writeFileSync(join(root, 'app/dark-theme.css'), css)
console.log(`dark-theme.css: ${out.length} rules from ${used.size} color classes`)
