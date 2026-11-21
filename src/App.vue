<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from './supabase'
import SetUsername from './components/SetUsername.vue'
import BossTracker from './components/BossTracker.vue'

const session = ref(null)
const needsUsername = ref(false)

async function handleAuth() {
  // Проверяем hash-параметры (если пришли с инвайт-ссылки)
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  
  if (accessToken) {
    console.log('Найден access_token в URL — восстанавливаем сессию')
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    })
    if (error) {
      console.error('Ошибка восстановления сессии:', error)
    } else {
      session.value = data.session
      needsUsername.value = data.session && !data.session.user.user_metadata?.username
      // Очищаем hash из URL
      window.history.replaceState(null, '', window.location.pathname)
      return
    }
  }
  
  // Если нет hash — просто получаем текущую сессию
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  needsUsername.value = data.session && !data.session.user.user_metadata?.username
}

onMounted(async () => {
  await handleAuth()
  
  const { data: authData } = supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    needsUsername.value = newSession && !newSession.user.user_metadata?.username
  })

  onUnmounted(() => authData.subscription.unsubscribe())
})
</script>

<template>
  <div>
    <div v-if="!session" style="max-width: 500px; margin: 4rem auto; padding: 1rem; text-align: center; color: #6b7280;">
      <h2>Доступ только по приглашению</h2>
      <p>Если у тебя есть инвайт-ссылка — перейди по ней. Если нет — попроси у администратора.</p>
    </div>
    <SetUsername v-else-if="needsUsername" />
    <BossTracker v-else />
  </div>
</template>