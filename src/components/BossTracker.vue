<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
import { BOSSES, rollRespawnMs } from '../bosses'

const kills = ref([])
const loadingId = ref(null)
const user = ref(null)
const now = ref(Date.now())
let ticker = null

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

function lastKill(bossId) {
  return kills.value.find(k => k.boss_name === bossId) || null
}

// Статус: 'alive' | 'respawning' | 'dead'
function statusOf(boss) {
  const last = lastKill(boss.id)
  if (!last) return 'alive'
  const respawn = last.respawn_at
    ? new Date(last.respawn_at).getTime()
    : new Date(last.killed_at).getTime() + 10 * 3600 * 1000 // fallback для старых записей
  if (Date.now() < respawn) return 'respawning'
  return 'dead' // таймер истёк, но живого не подтвердили
}

// Текст обратного отсчёта
function countdown(boss) {
  const last = lastKill(boss.id)
  if (!last) return ''
  const respawn = last.respawn_at
    ? new Date(last.respawn_at).getTime()
    : new Date(last.killed_at).getTime() + 10 * 3600 * 1000
  const diff = respawn - now.value
  if (diff <= 0) return 'пора проверять'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return `${h}ч ${String(m).padStart(2, '0')}м ${String(s).padStart(2, '0')}с`
}

const STATUS_ORDER = { alive: 0, respawning: 1, dead: 2 }
const STATUS_STYLE = {
  alive:      { border: '#2e7d32', bg: '#e8f5e9' },
  respawning: { border: '#f9a825', bg: '#fff8e1' },
  dead:       { border: '#c62828', bg: '#ffebee' },
}

function sortBosses(list) {
  return [...list].sort((a, b) => {
    const sa = STATUS_ORDER[statusOf(a)]
    const sb = STATUS_ORDER[statusOf(b)]
    if (sa !== sb) return sa - sb
    return a.level - b.level || a.name.localeCompare(b.name)
  })
}

const lowBosses = computed(() => sortBosses(BOSSES.filter(b => b.tier === 'low')))
const highBosses = computed(() => sortBosses(BOSSES.filter(b => b.tier === 'high')))

async function addKill(boss) {
  if (!user.value) return
  loadingId.value = boss.id
  const nowIso = new Date().toISOString()
  const respawnIso = new Date(Date.now() + rollRespawnMs(boss.tier)).toISOString()
  const { error } = await supabase.from('boss_kills').insert({
    boss_name: boss.id,
    user_id: user.value.id,
    killed_at: nowIso,
    respawn_at: respawnIso,
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
    timeStyle: 'short',
  }).format(d)
}

async function signOut() {
  await supabase.auth.signOut()
  user.value = null
}

onMounted(async () => {
  await getUser()
  if (user.value) await fetchKills()
  ticker = setInterval(() => { now.value = Date.now() }, 1000)
})

onUnmounted(() => {
  if (ticker) clearInterval(ticker)
})
</script>

<template>
  <div class="tracker">
    <div v-if="!user">
      <p>Пожалуйста, войди через форму выше.</p>
    </div>

    <template v-else>
      <div class="topbar">
        <span>Привет, {{ user.email }}</span>
        <button @click="signOut">Выйти</button>
      </div>

      <div class="columns">
        <section v-for="col in [
          { title: 'Low A', bosses: lowBosses },
          { title: 'High A', bosses: highBosses },
        ]" :key="col.title" class="column">
          <h3>{{ col.title }}</h3>
          <div class="cards">
            <div
              v-for="boss in col.bosses"
              :key="boss.id"
              class="card"
              :style="{
                borderColor: STATUS_STYLE[statusOf(boss)].border,
                background: STATUS_STYLE[statusOf(boss)].bg,
              }"
            >
              <div class="card-main">
                <div class="name">
                  {{ boss.name }}
                  <span class="lvl">Lv.{{ boss.level }}</span>
                </div>
                <div class="meta">
                  <template v-if="lastKill(boss.id)">
                    <div>Убит: {{ formatTime(lastKill(boss.id).killed_at) }}</div>
                    <div v-if="statusOf(boss) === 'respawning'">Респавн через: <b>{{ countdown(boss) }}</b></div>
                    <div v-else-if="statusOf(boss) === 'dead'">Респавн: <b>пора проверять</b></div>
                  </template>
                  <div v-else>Ещё не убит</div>
                </div>
              </div>
              <button
                class="kill-btn"
                @click="addKill(boss)"
                :disabled="loadingId === boss.id"
              >
                {{ loadingId === boss.id ? '...' : 'Убил' }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tracker { max-width: 1100px; margin: auto; padding: 1rem; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 800px) { .columns { grid-template-columns: 1fr; } }
.column h3 { margin: 0 0 0.5rem; font-size: 1rem; color: #333; }
.cards { display: flex; flex-direction: column; gap: 0.35rem; }
.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid;
  border-radius: 6px;
  font-size: 0.85rem;
}
.card-main { min-width: 0; flex: 1; }
.name { font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lvl { font-weight: 400; color: #666; font-size: 0.75rem; margin-left: 0.25rem; }
.meta { color: #555; font-size: 0.75rem; line-height: 1.25; margin-top: 1px; }
.kill-btn {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>