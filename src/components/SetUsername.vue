<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'

const username = ref('')
const loading = ref(false)

async function save() {
  if (!username.value.trim()) return
  loading.value = true
  
  const { error } = await supabase.auth.updateUser({
    data: { username: username.value.trim() }
  })
  
  loading.value = false
  if (error) alert(error.message)
  else window.location.reload() // Перезагружаем, чтобы применилось
}
</script>

<template>
  <div style="max-width: 400px; margin: 4rem auto; padding: 1rem;">
    <h2>Придумай ник</h2>
    <p style="color: #666;">Это имя будут видеть другие пользователи.</p>
    <input 
      v-model="username" 
      placeholder="Твой ник" 
      style="width: 100%; padding: 0.6rem; margin-bottom: 0.5rem; border: 1px solid #ccc; border-radius: 6px;" 
    />
    <button 
      @click="save" 
      :disabled="loading" 
      style="width: 100%; padding: 0.6rem; background: #5b8def; color: white; border: none; border-radius: 6px; cursor: pointer;"
    >
      {{ loading ? '...' : 'Сохранить' }}
    </button>
  </div>
</template>