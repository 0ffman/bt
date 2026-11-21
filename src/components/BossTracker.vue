<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const bossName = ref('')
const kills = ref([])
const loading = ref(false)
const user = ref(null)

// Получаем текущего пользователя
async function getUser() {
  const { data } = await supabase.auth.getUser()
  user.value = data.user
}

// Загрузка всех записей
async function fetchKills() {
  const { data, error } = await supabase
    .from('boss_kills')
    .select('*')
    .order('killed_at', { ascending: false })
  if (!error) kills.value = data
}

// Добавление записи
async function addKill() {
  if (!bossName.value.trim() || !user.value) return
  loading.value = true
  const { error } = await supabase.from('boss_kills').insert({
    boss_name: bossName.value.trim(),
    user_id: user.value.id,
    killed_at: new Date().toISOString(), // всегда UTC
  })
  loading.value = false
  if (error) alert(error.message)
  else {
    bossName.value = ''
    await fetchKills()
  }
}

// Форматирование времени в часовом поясе зрителя
function formatTime(utcString) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(utcString))
}

async function signOut() {
  await supabase.auth.signOut()
  user.value = null
}

onMounted(async () => {
  await getUser()
  if (user.value) await fetchKills()
})
</script>

<template>
  <div style="padding: 1rem; max-width: 600px; margin: auto;">
    <div v-if="!user">
      <p>Пожалуйста, войди через форму выше.</p>
    </div>

    <div v-else>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <span>Привет, {{ user.email }}</span>
        <button @click="signOut">Выйти</button>
      </div>

      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
        <input
          v-model="bossName"
          placeholder="Имя босса"
          style="flex: 1; padding: 0.5rem;"
          @keyup.enter="addKill"
        />
        <button @click="addKill" :disabled="loading">
          {{ loading ? '...' : 'Убил!' }}
        </button>
      </div>

      <h3>История убийств</h3>
      <ul v-if="kills.length" style="list-style: none; padding: 0;">
        <li
          v-for="kill in kills"
          :key="kill.id"
          style="padding: 0.5rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;"
        >
          <strong>{{ kill.boss_name }}</strong>
          <span>{{ formatTime(kill.killed_at) }}</span>
        </li>
      </ul>
      <p v-else>Пока пусто. Убей первого босса!</p>
    </div>
  </div>
</template>