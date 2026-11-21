<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'

const email = ref('')
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  const { error } = await supabase.auth.signInWithOtp({ email: email.value })
  loading.value = false
  if (error) alert(error.message)
  else alert('Проверь почту — там ссылка для входа!')
}
</script>

<template>
  <div style="padding: 2rem; max-width: 400px; margin: auto;">
    <h2>Вход</h2>
    <p>Введи email, и мы отправим ссылку для входа.</p>
    <input v-model="email" type="email" placeholder="you@example.com" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem;" />
    <button @click="handleLogin" :disabled="loading" style="width: 100%; padding: 0.5rem;">
      {{ loading ? 'Отправка...' : 'Войти по ссылке' }}
    </button>
  </div>
</template>