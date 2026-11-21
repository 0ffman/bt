<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
import {
  BOSSES, rollRespawnMs, fixedRespawnMs,
  RESPAWN_WINDOW, ESTIMATE_MIN_EXTRA_HOURS,
} from '../bosses'

const kills = ref([])
const monitors = ref([])
const loadingId = ref(null)
const user = ref(null)
const username = ref('')
const now = ref(Date.now())
let ticker = null
const manualEdit = ref(null)

async function getUser() {
  const { data } = await supabase.auth.getUser()
  user.value = data.user
  username.value = data.user?.user_metadata?.username || '—'
}

async function fetchKills() {
  const { data, error } = await supabase
    .from('boss_kills')
    .select('*')
    .order('killed_at', { ascending: false })
  if (!error) kills.value = data
}

async function fetchMonitors() {
  const { data, error } = await supabase
    .from('boss_monitors')
    .select('*')
  if (!error) monitors.value = data
}

function monitorsFor(bossId) {
  return monitors.value.filter(m => m.boss_id === bossId)
}

function isMonitoring(bossId) {
  return monitors.value.some(m => m.boss_id === bossId && m.user_id === user.value?.id)
}

async function toggleMonitor(boss) {
  if (!user.value) return
  if (isMonitoring(boss.id)) {
    await supabase
      .from('boss_monitors')
      .delete()
      .eq('boss_id', boss.id)
      .eq('user_id', user.value.id)
  } else {
    await supabase.from('boss_monitors').insert({
      boss_id: boss.id,
      user_id: user.value.id,
      username: username.value,
    })
  }
  await fetchMonitors()
}

function lastKill(bossId) {
  return kills.value.find(k => k.boss_name === bossId) || null
}

function statusOf(boss) {
  const last = lastKill(boss.id)
  if (!last) return 'alive'

  const killedAt = new Date(last.killed_at).getTime()
  const fixedEnd = killedAt + fixedRespawnMs(boss.tier)
  const respawnEnd = last.respawn_at
    ? new Date(last.respawn_at).getTime()
    : fixedEnd

  const nowMs = now.value

  if (last.estimate_min) {
    if (nowMs < respawnEnd) return 'estimate_min'
    return 'alive'
  }

  if (nowMs < fixedEnd) return 'respawning'
  if (nowMs < respawnEnd) return 'respawn_window'
  return 'alive'
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

const STATUS_ORDER = { respawning: 0, respawn_window: 1, estimate_min: 2, alive: 3 }

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

async function addKill(boss, estimateMin = false) {
  if (!user.value) return
  loadingId.value = boss.id
  const nowIso = new Date().toISOString()
  let killTime, respawnMs

  if (estimateMin) {
    // Время убийства = начало окна респавна (момент, когда босс перешёл из красного в оранжевый)
    const last = lastKill(boss.id)
    if (last) {
      const fixedEnd = new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
      killTime = new Date(fixedEnd).toISOString()
    } else {
      killTime = nowIso
    }
    respawnMs = fixedRespawnMs(boss.tier) + ESTIMATE_MIN_EXTRA_HOURS * 3600 * 1000
  } else {
    killTime = nowIso
    respawnMs = rollRespawnMs(boss.tier)
  }

  const respawnIso = new Date(new Date(killTime).getTime() + respawnMs).toISOString()

  const { error } = await supabase.from('boss_kills').insert({
    boss_name: boss.id,
    user_id: user.value.id,
    killed_at: killTime,
    respawn_at: respawnIso,
    estimate_min: estimateMin,
  })
  loadingId.value = null
  if (error) alert(error.message)
  else await fetchKills()
}

function openManual(boss) {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  manualEdit.value = { bossId: boss.id, tier: boss.tier, value: local }
}

function cancelManual() {
  manualEdit.value = null
}

async function saveManual() {
  if (!manualEdit.value || !user.value) return
  const { bossId, tier, value } = manualEdit.value
  const killed = new Date(value)
  if (isNaN(killed.getTime())) {
    alert('Некорректная дата/время')
    return
  }
  loadingId.value = bossId
  const respawnIso = new Date(killed.getTime() + rollRespawnMs(tier)).toISOString()
  const { error } = await supabase.from('boss_kills').insert({
    boss_name: bossId,
    user_id: user.value.id,
    killed_at: killed.toISOString(),
    respawn_at: respawnIso,
    estimate_min: false,
  })
  loadingId.value = null
  manualEdit.value = null
  if (error) alert(error.message)
  else await fetchKills()
}

async function clearKill(boss) {
  const last = lastKill(boss.id)
  if (!last) return
  if (!confirm(`Удалить запись убийства «${boss.name}»?`)) return
  loadingId.value = boss.id
  const { error } = await supabase
    .from('boss_kills')
    .delete()
    .eq('id', last.id)
  loadingId.value = null
  if (error) {
    alert(error.message)
  } else {
    await fetchKills()
    now.value = Date.now()
  }
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
  if (user.value) {
    await fetchKills()
    await fetchMonitors()
  }
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
        <span class="nick">Привет, <b>{{ username }}</b></span>
        <button class="btn-ghost" @click="signOut">Выйти</button>
      </header>

      <div class="categories">
        <section
          v-for="col in [
            { title: 'Low A', bosses: lowBosses },
            { title: 'High A', bosses: highBosses },
          ]"
          :key="col.title"
          class="category"
        >
          <h3 class="col-title">
            {{ col.title }}
            <span class="counter">{{ aliveCount(col.bosses) }}/{{ col.bosses.length }} живых</span>
          </h3>

          <div class="cards-grid">
            <div
              v-for="boss in col.bosses"
              :key="boss.id"
              class="card"
              :class="[`status-${statusOf(boss)}`, { 'is-monitored': isMonitoring(boss.id) }]"
              @click="toggleMonitor(boss)"
              :title="isMonitoring(boss.id) ? 'Перестать мониторить' : 'Мониторить'"
            >
              <span class="dot" :class="`dot-${statusOf(boss)}`" />

              <div class="card-main">
                <div class="name-row">
                  <span class="name">{{ boss.name }}</span>
                  <span class="lvl">Lv.{{ boss.level }}</span>
                  <span v-if="monitorsFor(boss.id).length" class="monitors">
                    👁 {{ monitorsFor(boss.id).map(m => m.username).join(', ') }}
                  </span>
                </div>

                <div v-if="manualEdit && manualEdit.bossId === boss.id" class="manual-form" @click.stop>
                  <input type="datetime-local" v-model="manualEdit.value" class="manual-input" />
                  <button class="kill-btn" @click.stop="saveManual" :disabled="loadingId === boss.id">
                    Сохранить
                  </button>
                  <button class="btn-ghost small" @click.stop="cancelManual">Отмена</button>
                </div>

                <div v-else-if="lastKill(boss.id)" class="meta">
                  <template v-if="statusOf(boss) === 'respawning'">
                    <span class="meta-item respawn">
                      Убит: {{ formatTime(lastKill(boss.id).killed_at) }}
                    </span>
                    <span class="meta-item respawn">
                      Фикс: {{ RESPAWN_WINDOW[boss.tier].fixed }}ч
                      <span class="dim">(осталось {{ fmtMs(fixedLeft(boss)) }})</span>
                    </span>
                  </template>

                  <template v-else-if="statusOf(boss) === 'respawn_window'">
                    <span class="meta-item respawn-window">
                      Убит: {{ formatTime(lastKill(boss.id).killed_at) }}
                    </span>
                    <span class="meta-item respawn-window">
                      Окно респавна: {{ RESPAWN_WINDOW[boss.tier].randomMax }}ч
                      <span class="dim">(осталось {{ fmtMs(randomLeft(boss)) }})</span>
                    </span>
                  </template>

                  <template v-else-if="statusOf(boss) === 'estimate_min'">
                    <span class="meta-item estimate-min">
                      Убит по мин.: {{ formatTime(lastKill(boss.id).killed_at) }}
                    </span>
                    <span class="meta-item estimate-min">
                      Респавн: {{ RESPAWN_WINDOW[boss.tier].fixed + ESTIMATE_MIN_EXTRA_HOURS }}ч
                      <span class="dim">(осталось {{ fmtMs(fixedLeft(boss)) }})</span>
                    </span>
                  </template>

                  <span v-else-if="statusOf(boss) === 'alive'" class="meta-item alive">
                    Реснулся в {{ formatTime(lastKill(boss.id).respawn_at) }}
                  </span>
                </div>
              </div>

              <div v-if="!manualEdit || manualEdit.bossId !== boss.id" class="actions" @click.stop>
                <button class="kill-btn" @click="addKill(boss, false)" :disabled="loadingId === boss.id">
                  {{ loadingId === boss.id ? '…' : 'Убил' }}
                </button>
                <button class="kill-btn min-btn" @click="addKill(boss, true)" :disabled="loadingId === boss.id" title="Время убийства = начало окна респавна">
                  По мин.
                </button>
                <button class="kill-btn ghost-btn" @click="openManual(boss)" :disabled="loadingId === boss.id" title="Ввести время вручную">
                  ⏱
                </button>
                <button
                  v-if="lastKill(boss.id)"
                  class="kill-btn clear-btn"
                  @click="clearKill(boss)"
                  :disabled="loadingId === boss.id"
                  title="Очистить запись"
                >
                  ✕
                </button>
              </div>
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

.login-hint { text-align: center; padding: 2rem; color: #6b7280; }

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
.nick { font-size: 0.85rem; color: #5a6068; }

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
.btn-ghost:hover { background: #eef1f5; border-color: #5b8def; }
.btn-ghost.small { padding: 0.25rem 0.5rem; font-size: 0.75rem; }

.categories {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 1100px) { .categories { grid-template-columns: 1fr; } }

.category {
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
.counter { font-size: 0.75rem; color: #6b7280; font-weight: 400; }

.cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}
@media (max-width: 720px) { .cards-grid { grid-template-columns: 1fr; } }

.card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid;
  border-radius: 8px;
  min-width: 0;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.15s;
}
.card:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.card.is-monitored {
  outline: 2px solid #5b8def;
  outline-offset: 1px;
}

/* Цвета статусов */
.card.status-respawning     { background: #fde8e8; border-color: #f0b0b0; } /* красный */
.card.status-respawn_window { background: #ffeddb; border-color: #f0bf85; } /* оранжевый */
.card.status-estimate_min   { background: #fff8cc; border-color: #e6d47a; } /* жёлтый */
.card.status-alive          { background: #e6f7ec; border-color: #a8dcb8; } /* зелёный */

.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.dot-respawning     { background: #e04a4a; } /* красный */
.dot-respawn_window { background: #e08a20; } /* оранжевый */
.dot-estimate_min   { background: #d4b820; } /* жёлтый */
.dot-alive          { background: #34c26a; } /* зелёный */

.card-main { flex: 1; min-width: 0; }

.name-row { display: flex; align-items: baseline; gap: 0.35rem; min-width: 0; flex-wrap: wrap; }
.name {
  font-weight: 600;
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #1f2328;
}
.lvl { font-size: 0.68rem; color: #6b7280; flex-shrink: 0; }

.monitors {
  font-size: 0.68rem;
  color: #5b8def;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.meta {
  margin-top: 1px;
  font-size: 0.7rem;
  line-height: 1.25;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.meta-item { color: #5a6068; white-space: nowrap; }
.meta-item.respawn { color: #b03030; font-weight: 500; }
.meta-item.respawn-window { color: #a05c00; font-weight: 500; }
.meta-item.estimate-min { color: #8a7a00; font-weight: 500; }
.meta-item.alive { color: #1a7a3a; font-weight: 500; }
.dim { color: #8a9099; }

.manual-form {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 4px;
  flex-wrap: wrap;
}
.manual-input {
  padding: 0.25rem 0.4rem;
  border: 1px solid #c4c9d2;
  border-radius: 6px;
  font-size: 0.72rem;
  background: #fff;
  color: #2a2d34;
}

.actions { display: flex; gap: 0.25rem; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

.kill-btn {
  background: #5b8def;
  color: #fff;
  border: none;
  padding: 0.3rem 0.55rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, transform 0.08s;
}
.kill-btn:hover:not(:disabled) { background: #4a7ad6; }
.kill-btn:active:not(:disabled) { transform: scale(0.97); }
.kill-btn:disabled { opacity: 0.6; cursor: default; }

.min-btn { background: #e0a520; }
.min-btn:hover:not(:disabled) { background: #c8901a; }

.ghost-btn {
  background: #eef1f5;
  color: #2a2d34;
  border: 1px solid #d3d7de;
}
.ghost-btn:hover:not(:disabled) { background: #e2e6ec; border-color: #5b8def; }

.clear-btn {
  background: #fde8e8;
  color: #b03030;
  border: 1px solid #f0b0b0;
}
.clear-btn:hover:not(:disabled) { background: #fbd6d6; }
</style>