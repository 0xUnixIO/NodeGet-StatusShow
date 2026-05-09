import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'public/config.json')

function parseSite(raw) {
  const out = {}
  const re = /(\w+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,]*))(?:\s*,\s*|\s*$)/g
  let m
  while ((m = re.exec(raw))) {
    const key = m[1]
    const val = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : (m[3] ?? '').trim()
    out[key] = val
  }
  return out
}

const tokens = []
for (let i = 1; ; i++) {
  const raw = process.env[`SITE_${i}`]
  if (!raw) break
  const fields = parseSite(raw)
  tokens.push({
    name: fields.name || `master-${i}`,
    backend_url: fields.backend_url || fields.url || '',
    token: fields.token || '',
  })
}

if (!tokens.length) {
  console.log('[build-config] no SITE_n env vars, keeping existing public/config.json')
  process.exit(0)
}

const config = {
  site_name: process.env.SITE_NAME || 'NodeGet Status',
  site_logo: process.env.SITE_LOGO || '',
  footer: process.env.SITE_FOOTER || 'Powered by NodeGet',
  site_tokens: tokens,
}

writeFileSync(out, JSON.stringify(config, null, 2) + '\n')
console.log(`[build-config] wrote ${tokens.length} site_tokens to public/config.json`)
