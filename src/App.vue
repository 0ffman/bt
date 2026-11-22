<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from './supabase'
import SetUsername from './components/SetUsername.vue'
import BossTracker from './components/BossTracker.vue'

const session = ref(null)
const needsUsername = ref(false)
const inviteMode = ref(false)
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function signIn() {
  if (!email.value.trim() || !password.value.trim()) {
    errorMsg.value = 'Введите email и пароль'
    return
  }
  loading.value = true
  errorMsg.value = ''
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value.trim(),
  })
  
  loading.value = false
  if (error) {
    errorMsg.value = error.message
  } else {
    session.value = data.session
    needsUsername.value = !data.session.user.user_metadata?.username
  }
}

function toggleMode() {
  inviteMode.value = !inviteMode.value
  errorMsg.value = ''
}

onMounted(async () => {
  const { data: { session: currentSession } } = await supabase.auth.getSession()
  session.value = currentSession
  needsUsername.value = currentSession && !currentSession.user.user_metadata?.username

  const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
    session.value = newSession
    needsUsername.value = newSession && !newSession.user.user_metadata?.username
  })

  onUnmounted(() => authListener.subscription.unsubscribe())
})
</script>

<template>
  <div>
    <div v-if="!session" style="max-width: 400px; margin: 4rem auto; padding: 1.5rem; background: #f4f5f7; border: 1px solid #d3d7de; border-radius: 12px; text-align: center;">
      <h2 style="margin-top: 0;">Вход</h2>
      
      <div v-if="errorMsg" style="color: #e04a4a; margin-bottom: 1rem; font-size: 0.85rem;">
        {{ errorMsg }}
      </div>
      
      <input 
        v-model="email" 
        placeholder="Email" 
        style="width: 100%; padding: 0.6rem; margin-bottom: 0.5rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;" 
      />
      <input 
        v-model="password" 
        type="password" 
        placeholder="Пароль" 
        style="width: 100%; padding: 0.6rem; margin-bottom: 0.5rem; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;" 
      />
      <button 
        @click="signIn" 
        :disabled="loading"
        style="width: 100%; padding: 0.6rem; background: #5b8def; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;"
      >
        {{ loading ? 'Вход...' : 'Войти' }}
      </button>
      
      <p style="margin-top: 1rem; font-size: 0.85rem; color: #6b7280;">
        Получите email и пароль у администратора.
      </p>
    </div>
    <SetUsername v-else-if="needsUsername" />
    <BossTracker v-else />
  </div>
</template>