<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { BOSSES, RESPAWN_HOURS } from '../bosses'

const kills = ref([])
const loadingId = ref(null)
const user = ref(null)

async function getUser() {
  const { data } = await supabase.auth.getUser()
  user.value = data.user
}

async function fetchKills() {
  const { data, error } = await supabase
    .from('boss_kills')
    .select('*')
    .order('killed_at', { ascending: false })
  if (!error) kills.value = data
}

// Последнее убийство для каждого босса
function lastKill(bossId) {
  return kills.value.find(k => k.boss_name === bossId) || null
}

// Время следующего респавна (UTC ISO) или null
function respawnAt(bossId) {
  const last = lastKill(bossId)
  if (!last) return null
  return new Date(new Date(last.killed_at).getTime() + RESPAWN_HOURS * 3600 * 1000)
}

// Живой ли босс (нет убийства или респавн уже прошёл)
function isAlive(bossId) {
  const r = respawnAt(bossId)
  return !r || r.getTime() <= Date.now()
}

// Сортировка: живые сверху, убитые ниже; внутри группы — по имени
const sortedBosses = computed(() => {
  return [...BOSSES].sort((a, b) => {
    const aliveA = isAlive(a.id) ? 0 : 1
    const aliveB = isAlive(b.id) ? 0 : 1
    if (aliveA !== aliveB) return aliveA - aliveB
    return a.name.localeCompare(b.name)
  })
})

async function addKill(bossId) {
  if (!user.value) return
  loadingId.value = bossId
  const { error } = await supabase.from('boss_kills').insert({
    boss_name: bossId,
    user_id: user.value.id,
    killed_at: new Date().toISOString(),
  })
  loadingId.value = null
  if (error) alert(error.message)
  else await fetchKills()
}

function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(d)
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
  <div style="padding: 1rem; max-width: 700px; margin: auto;">
    <div v-if="!user">
      <p>Пожалуйста, войди через форму выше.</p>
    </div>

    <div v-else>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <span>Привет, {{ user.email }}</span>
        <button @click="signOut">Выйти</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div
          v-for="boss in sortedBosses"
          :key="boss.id"
          :style="{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid ' + (isAlive(boss.id) ? '#2e7d32' : '#c62828'),
            background: isAlive(boss.id) ? '#e8f5e9' : '#ffebee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }"
        >
          <div>
            <strong>{{ boss.name }}</strong>
            <div style="font-size: 0.85rem; color: #555; margin-top: 0.25rem;">
              <template v-if="lastKill(boss.id)">
                Убит: {{ formatTime(lastKill(boss.id).killed_at) }}<br />
                Респавн: {{ formatTime(respawnAt(boss.id)) }}
              </template>
              <template v-else>
                Ещё не убит
              </template>
            </div>
          </div>

          <button
            @click="addKill(boss.id)"
            :disabled="loadingId === boss.id"
            style="padding: 0.5rem 1rem; white-space: nowrap;"
          >
            {{ loadingId === boss.id ? '...' : 'Убил!' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>