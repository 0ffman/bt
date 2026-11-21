<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase'
import SetUsername from './components/SetUsername.vue'
import BossTracker from './components/BossTracker.vue'

const session = ref(null)
const needsUsername = ref(false)

onMounted(() => {
  supabase.auth.getSession().then(({ data }) => {
    session.value = data.session
    needsUsername.value = data.session && !data.session.user.user_metadata?.username
  })
  supabase.auth.onAuthStateChange((_e, s) => {
    session.value = s
    needsUsername.value = s && !s.user.user_metadata?.username
  })
})
</script>

<template>
  <div>
    <h1 style="text-align: center; margin-top: 1rem;">Boss Kill Tracker</h1>

    <!-- Не авторизован — только сообщение -->
    <div v-if="!session" style="max-width: 500px; margin: 4rem auto; padding: 1rem; text-align: center; color: #6b7280;">
      <h2>Доступ только по приглашению</h2>
      <p>Если у тебя есть инвайт-ссылка — перейди по ней. Если нет — попроси у администратора.</p>
    </div>

    <!-- Авторизован, но нет ника -->
    <SetUsername v-else-if="needsUsername" />

    <!-- Всё есть — трекер -->
    <BossTracker v-else />
  </div>
</template>