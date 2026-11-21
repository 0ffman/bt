<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
import { BOSSES, rollRespawnMs, RESPAWN_WINDOW, fixedRespawnMs } from '../bosses'

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

function statusOf(boss) {
  const last = lastKill(boss.id)
  if (!last) return 'alive'
  const respawn = last.respawn_at
    ? new Date(last.respawn_at).getTime()
    : new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
  if (Date.now() < respawn) return 'respawning'
  return 'dead'
}

function countdownMs(boss) {
  const last = lastKill(boss.id)
  if (!last) return 0
  const respawn = last.respawn_at
    ? new Date(last.respawn_at).getTime()
    : new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
  return Math.max(0, respawn - now.value)
}

function fixedLeft(boss) {
  const last = lastKill(boss.id)
  if (!last) return 0
  const fixedEnd = new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
  return Math.max(0, fixedEnd - now.value)
}

function randomLeft(boss) {
  const last = lastKill(boss.id)
  if (!last || !last.respawn_at) return 0
  const randomEnd = new Date(last.respawn_at).getTime()
  const fixedEnd = new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
  return Math.max(0, randomEnd - Math.max(now.value, fixedEnd))
}

function fmtMs(ms) {
  if (ms <= 0) return '0с'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${h}ч ${String(m).padStart(2, '0')}м ${String(s).padStart(2, '0')}с`
}

const STATUS_ORDER = { alive: 0, respawning: 1, dead: 2 }

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

function aliveCount(list) {
  return list.filter(b => statusOf(b) === 'alive').length
}

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
    <div v-if="!user" class="login-hint">
      <p>Пожалуйста, войди через форму выше.</p>
    </div>

    <template v-else>
      <header class="topbar">
        <span class="email">{{ user.email }}</span>
        <button class="btn-ghost" @click="signOut">Выйти</button>
      </header>

      <div class="columns">
        <section
          v-for="col in [
            { title: 'Low A', bosses: lowBosses },
            { title: 'High A', bosses: highBosses },
          ]"
          :key="col.title"
          class="column"
        >
          <h3 class="col-title">
            {{ col.title }}
            <span class="counter">{{ aliveCount(col.bosses) }}/{{ col.bosses.length }} живых</span>
          </h3>

          <div class="cards">
            <div
              v-for="boss in col.bosses"
              :key="boss.id"
              class="card"
              :class="`status-${statusOf(boss)}`"
            >
              <span class="dot" :class="`dot-${statusOf(boss)}`" />

              <div class="card-main">
                <div class="name-row">
                  <span class="name">{{ boss.name }}</span>
                  <span class="lvl">Lv.{{ boss.level }}</span>
                </div>
                <div v-if="lastKill(boss.id)" class="meta">
                  <span class="meta-item">Убит: {{ formatTime(lastKill(boss.id).killed_at) }}</span>

                  <template v-if="statusOf(boss) === 'respawning'">
                    <span v-if="fixedLeft(boss) > 0" class="meta-item respawn">
                      Респавн: {{ RESPAWN_WINDOW[boss.tier].fixed }}ч
                      <span class="dim">(осталось {{ fmtMs(countdownMs(boss)) }})</span>
                    </span>
                    <span v-else class="meta-item respawn">
                      Респавн: {{ RESPAWN_WINDOW[boss.tier].fixed }}ч
                      <span class="dim">(+{{ fmtMs(randomLeft(boss)) }})</span>
                    </span>
                  </template>

                  <span v-else-if="statusOf(boss) === 'dead'" class="meta-item respawn-dead">
                    Респавн: <b>пора проверять</b>
                  </span>
                </div>
              </div>

              <button
                class="kill-btn"
                @click="addKill(boss)"
                :disabled="loadingId === boss.id"
              >
                {{ loadingId === boss.id ? '…' : 'Убил' }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tracker {
  width: 100%;
  padding: 1.25rem 1.5rem;
  color: #2a2d34;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #e9ebef;
  min-height: 100vh;
  box-sizing: border-box;
}

.login-hint {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  padding: 0.6rem 0.9rem;
  background: #f4f5f7;
  border: 1px solid #d3d7de;
  border-radius: 10px;
}
.email {
  font-size: 0.85rem;
  color: #5a6068;
}

.btn-ghost {
  background: #ffffff;
  border: 1px solid #d3d7de;
  color: #2a2d34;
  padding: 0.35rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.btn-ghost:hover {
  background: #eef1f5;
  border-color: #5b8def;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 900px) {
  .columns { grid-template-columns: 1fr; }
}

.column {
  background: #f4f5f7;
  border: 1px solid #d3d7de;
  border-radius: 12px;
  padding: 0.9rem;
}

.col-title {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: #1f2328;
}
.counter {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 400;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid;
  border-radius: 8px;
  transition: transform 0.12s, box-shadow 0.15s;
}
.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card.status-alive {
  background: #e6f7ec;
  border-color: #a8dcb8;
}
.card.status-respawning {
  background: #fff5dd;
  border-color: #f0d38a;
}
.card.status-dead {
  background: #fde8e8;
  border-color: #f0b0b0;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-alive      { background: #34c26a; }
.dot-respawning { background: #e0a520; }
.dot-dead       { background: #e04a4a; }

.card-main {
  flex: 1;
  min-width: 0;
}

.name-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
}
.name {
  font-weight: 600;
  font-size: 0.88rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1f2328;
}
.lvl {
  font-size: 0.72rem;
  color: #6b7280;
  flex-shrink: 0;
}

.meta {
  margin-top: 2px;
  font-size: 0.74rem;
  line-height: 1.3;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.meta-item { color: #5a6068; white-space: nowrap; }
.meta-item.respawn { color: #a06e00; font-weight: 500; }
.meta-item.respawn-dead { color: #b03030; font-weight: 500; }
.dim { color: #8a9099; }

.kill-btn {
  flex-shrink: 0;
  background: #5b8def;
  color: #fff;
  border: none;
  padding: 0.35rem 0.85rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.08s;
}
.kill-btn:hover:not(:disabled) {
  background: #4a7ad6;
}
.kill-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.kill-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>