import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Задай SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function createUser(email, password, username) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  })
  if (error) return console.error('Ошибка:', error.message)
  console.log(`\n✅ Пользователь ${email} создан с паролем ${password} и ником ${username}\n`)
}

// Замени email, пароль и ник
createUser('skks@gmail.com', 'skks123', 'SKKS')