<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from './supabase'
import Auth from './components/Auth.vue'
import SetUsername from './components/SetUsername.vue'
import BossTracker from './components/BossTracker.vue'

const session = ref(null)
const needsUsername = ref(false)

onMounted(() => {
  // Проверяем текущую сессию
  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session
    // Если сессия есть, но ника нет — нужно ввести
    needsUsername.value = data.session && !data.session.user.user_metadata?.username
  })

  // Слушаем изменения авторизации (например, после перехода по ссылке)
  const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    needsUsername.value = newSession && !newSession.user.user_metadata?.username
  })
  
  // Отписываемся при размонтировании (опционально)
  onUnmounted(() => data.subscription.unsubscribe())
})
</script>

<template>
  <div>
    
    <!-- Если не вошёл — показываем форму входа -->
    <Auth v-if="!session" />
    
    <!-- Если вошёл, но нет ника — форма ввода ника -->
    <SetUsername v-else-if="needsUsername" />
    
    <!-- Если всё есть — трекер -->
    <BossTracker v-else />
  </div>
</template>