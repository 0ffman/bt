// scripts/invite.js
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' }) // читаем именно .env.local

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REDIRECT_URL = process.env.REDIRECT_URL

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Задай SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function generateInvite(email) {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: REDIRECT_URL },
  })
  if (error) return console.error('Ошибка:', error.message)
  console.log('\n✅ Ссылка:\n' + data.properties.action_link + '\n')
}

generateInvite('boss@gmail.com')