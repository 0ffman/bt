import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
import {
  BOSSES, rollRespawnMs, fixedRespawnMs,
  RESPAWN_WINDOW, getEstimateMinExtraHours,
} from '../bosses'

export function useBossTracker() {
  const kills = ref([])
  const monitors = ref([])
  const loadingId = ref(null)
  const user = ref(null)
  const username = ref('')
  const now = ref(Date.now())
  const manualEdit = ref(null)
  const isDark = ref(false)
  let ticker = null

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('bossTrackerTheme', isDark.value ? 'dark' : 'light')
  }

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
  }

  function lastKill(bossId) {
    return kills.value.find(k => k.boss_name === bossId) || null
  }

  function statusOf(boss) {
    const last = lastKill(boss.id)
    if (!last) return 'alive'

    const killedAt = new Date(last.killed_at).getTime()
    const fixedEnd = killedAt + fixedRespawnMs(boss.tier)
    const windowEnd = fixedEnd + (RESPAWN_WINDOW[boss.tier]?.randomMax ?? 4) * 3600 * 1000

    const nowMs = now.value

    if (last.estimate_min) {
      const minEnd = killedAt + fixedRespawnMs(boss.tier) + getEstimateMinExtraHours(boss.tier) * 3600 * 1000
      if (nowMs < minEnd) return 'estimate_min'
      return 'alive'
    }

    if (nowMs < fixedEnd) return 'respawning'
    if (nowMs < windowEnd) return 'respawn_window'
    return 'alive'
  }

  function countdownMs(boss) {
    const last = lastKill(boss.id)
    if (!last) return 0

    const killedAt = new Date(last.killed_at).getTime()
    let respawnTime

    if (last.estimate_min) {
      respawnTime = killedAt + fixedRespawnMs(boss.tier) + getEstimateMinExtraHours(boss.tier) * 3600 * 1000
    } else if (last.respawn_at) {
      respawnTime = new Date(last.respawn_at).getTime()
    } else {
      respawnTime = killedAt + fixedRespawnMs(boss.tier) + rollRespawnMs(boss.tier)
    }

    return Math.max(0, respawnTime - now.value)
  }

  function fixedLeft(boss) {
    const last = lastKill(boss.id)
    if (!last) return 0

    let fixedEnd
    if (last.estimate_min) {
      fixedEnd = new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier) + getEstimateMinExtraHours(boss.tier) * 3600 * 1000
    } else {
      fixedEnd = new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
    }
    return Math.max(0, fixedEnd - now.value)
  }

  function randomLeft(boss) {
    const last = lastKill(boss.id)
    if (!last || last.estimate_min) return 0
    const killedAt = new Date(last.killed_at).getTime()
    const fixedEnd = killedAt + fixedRespawnMs(boss.tier)
    const windowEnd = fixedEnd + (RESPAWN_WINDOW[boss.tier]?.randomMax ?? 4) * 3600 * 1000
    return Math.max(0, windowEnd - Math.max(now.value, fixedEnd))
  }

  function fmtHours(hours) {
    if (hours >= 1) {
      if (Number.isInteger(hours)) return `${hours}ч`
      return `${hours.toFixed(1)}ч`
    } else {
      const totalSeconds = Math.round(hours * 3600)
      if (totalSeconds >= 60) {
        const minutes = Math.round(hours * 60)
        return `${minutes}м`
      } else {
        return `${totalSeconds}с`
      }
    }
  }

  function fmtMs(ms) {
    if (ms <= 0) return '0с'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${h}ч ${String(m).padStart(2, '0')}м ${String(s).padStart(2, '0')}с`
  }

  const STATUS_ORDER = { alive: 0, respawn_window: 1, respawning: 2, estimate_min: 3 }

function getSortMs(boss) {
  const status = statusOf(boss)
  if (status === 'respawning' || status === 'estimate_min') {
    return fixedLeft(boss)
  }
  if (status === 'respawn_window') {
    return randomLeft(boss)
  }
  return Infinity // для alive — без таймера, сортируем по уровню/имени
}

function sortBosses(list) {
  return [...list].sort((a, b) => {
    const sa = STATUS_ORDER[statusOf(a)]
    const sb = STATUS_ORDER[statusOf(b)]
    if (sa !== sb) return sa - sb

    const timeA = getSortMs(a)
    const timeB = getSortMs(b)
    if (timeA !== timeB) return timeA - timeB

    return a.level - b.level || a.name.localeCompare(b.name)
  })
}

  const lowBosses = computed(() => sortBosses(BOSSES.filter(b => b.tier === 'low')))
  const highBosses = computed(() => sortBosses(BOSSES.filter(b => b.tier === 'high')))
  const testBosses = computed(() => sortBosses(BOSSES.filter(b => b.tier.startsWith('test_'))))

  function aliveCount(list) {
    return list.filter(b => statusOf(b) === 'alive').length
  }

  async function addKill(boss, estimateMin = false) {
    if (!user.value) return
    if (statusOf(boss) === 'respawning') {
      alert('Босс ещё не реснулся!')
      return
    }
    if (estimateMin && statusOf(boss) === 'estimate_min') {
      alert('Босс уже в режиме «По мин.»')
      return
    }
    loadingId.value = boss.id

    let killTime
    let respawnMs

    if (estimateMin) {
      const last = lastKill(boss.id)
      if (last) {
        const fixedEnd = new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
        killTime = new Date(fixedEnd).toISOString()
      } else {
        killTime = new Date().toISOString()
      }
      respawnMs = fixedRespawnMs(boss.tier) + getEstimateMinExtraHours(boss.tier) * 3600 * 1000
    } else {
      killTime = new Date().toISOString()
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
    if (error) {
      alert(error.message)
    } else {
      await supabase
        .from('boss_monitors')
        .delete()
        .eq('boss_id', boss.id)
    }
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

  // Сначала удаляем все старые записи для этого босса
  await supabase
    .from('boss_kills')
    .delete()
    .eq('boss_name', bossId)

  // Теперь вставляем новую
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
  if (error) {
    alert(error.message)
  } else {
    // Удаляем мониторы этого босса (тоже важно)
    await supabase
      .from('boss_monitors')
      .delete()
      .eq('boss_id', bossId)
    // Данные обновятся через Realtime, но можно вызвать fetchKills для верности
  }
}

  async function clearKill(boss) {
    if (!confirm(`Удалить все записи убийства «${boss.name}»?`)) return
    loadingId.value = boss.id
    const { error } = await supabase
      .from('boss_kills')
      .delete()
      .eq('boss_name', boss.id)
    loadingId.value = null
    if (error) {
      alert(error.message)
    } else {
      await supabase
        .from('boss_monitors')
        .delete()
        .eq('boss_id', boss.id)
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
    const saved = localStorage.getItem('bossTrackerTheme')
    isDark.value = saved === 'dark'
    await getUser()
    if (user.value) {
      await fetchKills()
      await fetchMonitors()

      const killChannel = supabase
        .channel('boss_kills_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'boss_kills' },
          () => fetchKills()
        )
        .subscribe()

      const monitorChannel = supabase
        .channel('boss_monitors_changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'boss_monitors' },
          () => fetchMonitors()
        )
        .subscribe()

      onUnmounted(() => {
        supabase.removeChannel(killChannel)
        supabase.removeChannel(monitorChannel)
        if (ticker) clearInterval(ticker)
      })
    }
    ticker = setInterval(() => { now.value = Date.now() }, 1000)
  })

  return {
    kills, monitors, loadingId, user, username, now, manualEdit, isDark,
    toggleTheme, lastKill, statusOf, monitorsFor, isMonitoring,
    toggleMonitor, countdownMs, fixedLeft, randomLeft, fmtHours, fmtMs,
    lowBosses, highBosses, testBosses, aliveCount,
    addKill, openManual, cancelManual, saveManual, clearKill,
    formatTime, signOut,
  }
}