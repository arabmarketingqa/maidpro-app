/**
 * Maid Pro — Supabase Migration Runner
 * Usage: node run-migration.mjs <service-role-key>
 *
 * Get your service role key from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://krijpvoonlpwxinohthb.supabase.co'
const PROJECT_REF  = 'krijpvoonlpwxinohthb'

const serviceKey = process.argv[2]

if (!serviceKey) {
  console.error('\n❌  No service role key provided.')
  console.error('   Usage: node run-migration.mjs <service_role_key>\n')
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role')
  console.error('\n   OR run the SQL manually:')
  console.error('   Supabase Dashboard → SQL Editor → paste supabase-setup.sql\n')
  process.exit(1)
}

const sql = readFileSync('./supabase-setup.sql', 'utf8')

console.log('🔄  Running migration via Supabase Management API…')

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

if (res.ok) {
  console.log('✅  Migration complete! Tables created with seed data.')
} else {
  const body = await res.text()
  console.error('❌  API error:', res.status, body)
  console.error('\n   Fallback: paste supabase-setup.sql into the Supabase SQL Editor.')
}
