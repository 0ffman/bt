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

  async function removeMonitor(bossId, userId) {
    if (!user.value) return
    await supabase
      .from('boss_monitors')
      .delete()
      .eq('boss_id', bossId)
      .eq('user_id', userId)
  }

  function lastKill(bossId) {
    return kills.value.find(k => k.boss_name === bossId) || null
  }

  function statusOf(boss) {
    const last = lastKill(boss.id)
    if (!last) return 'alive'

    const killedAt = new Date(last.killed_at).getTime()
    const fixedEnd = killedAt + fixedRespawnMs(boss.tier)
    let windowEnd
    if (last.estimate_min) {
      windowEnd = fixedEnd + getEstimateMinExtraHours(boss.tier) * 3600 * 1000
    } else {
      windowEnd = fixedEnd + (RESPAWN_WINDOW[boss.tier]?.randomMax ?? 4) * 3600 * 1000
    }

    const nowMs = now.value

    if (nowMs < fixedEnd) return 'respawning'
    if (nowMs < windowEnd) return last.estimate_min ? 'estimate_min' : 'respawn_window'
    return 'alive'
  }

  function fixedLeft(boss) {
    const last = lastKill(boss.id)
    if (!last) return 0
    const killedAt = new Date(last.killed_at).getTime()
    let fixedEnd, windowEnd
    if (last.estimate_min) {
      fixedEnd = killedAt + fixedRespawnMs(boss.tier)
      windowEnd = fixedEnd + getEstimateMinExtraHours(boss.tier) * 3600 * 1000
    } else {
      fixedEnd = killedAt + fixedRespawnMs(boss.tier)
      windowEnd = fixedEnd + (RESPAWN_WINDOW[boss.tier]?.randomMax ?? 4) * 3600 * 1000
    }
    const nowMs = now.value
    if (nowMs < fixedEnd) return fixedEnd - nowMs
    if (nowMs < windowEnd) return windowEnd - nowMs
    return 0
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
    if (ms <= 0) return '0м'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h > 0 && m > 0) return `${h}ч ${m}м`
    if (h > 0) return `${h}ч`
    if (m > 0) return `${m}м`
    return '<1м'
  }

  const STATUS_ORDER = { alive: 0, estimate_min: 1, respawn_window: 2, respawning: 3 }

  function getSortMs(boss) {
    const status = statusOf(boss)
    if (status === 'respawning' || status === 'estimate_min' || status === 'respawn_window') {
      return fixedLeft(boss)
    }
    return Infinity
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
  const allBosses = computed(() => sortBosses([...lowBosses.value, ...highBosses.value]))

  function maxRespawnTime(boss) {
    const last = lastKill(boss.id)
    if (!last) return null
    const killedAt = new Date(last.killed_at).getTime()
    let windowEnd
    if (last.estimate_min) {
      windowEnd = killedAt + fixedRespawnMs(boss.tier) + getEstimateMinExtraHours(boss.tier) * 3600 * 1000
    } else {
      windowEnd = killedAt + fixedRespawnMs(boss.tier) + (RESPAWN_WINDOW[boss.tier]?.randomMax ?? 4) * 3600 * 1000
    }
    return new Date(windowEnd)
  }

  async function addKill(boss, estimateMin = false) {
    if (!user.value) return
    if (statusOf(boss) === 'respawning') {
      alert('Босс ещё не реснулся!')
      return
    }
    if (estimateMin) {
      if (!confirm(`Вы уверены, что хотите установить время по минутам для босса «${boss.name}»?`)) {
        return
      }
    }
    loadingId.value = boss.id

    let killTime
    if (estimateMin) {
      const last = lastKill(boss.id)
      if (last) {
        const fixedEnd = new Date(last.killed_at).getTime() + fixedRespawnMs(boss.tier)
        killTime = new Date(fixedEnd).toISOString()
      } else {
        killTime = new Date().toISOString()
      }
    } else {
      killTime = new Date().toISOString()
    }

    const insertData = {
      boss_name: boss.id,
      user_id: user.value.id,
      killed_at: killTime,
      estimate_min: estimateMin,
      killed_by_username: username.value,
    }
    if (!estimateMin) {
      const respawnMs = rollRespawnMs(boss.tier)
      insertData.respawn_at = new Date(new Date(killTime).getTime() + respawnMs).toISOString()
    }

    const { error } = await supabase.from('boss_kills').insert(insertData)
    loadingId.value = null
    if (error) {
      alert(error.message)
    } else {
      await supabase.from('boss_monitors').delete().eq('boss_id', boss.id)
    }
  }

  function openManual(boss) {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    manualEdit.value = { bossId: boss.id, tier: boss.tier, value: local }
  }

  function cancelManual() { manualEdit.value = null }

  async function saveManual() {
    if (!manualEdit.value || !user.value) return
    const { bossId, tier, value } = manualEdit.value
    const killed = new Date(value)
    if (isNaN(killed.getTime())) {
      alert('Некорректная дата/время')
      return
    }
    loadingId.value = bossId
    await supabase.from('boss_kills').delete().eq('boss_name', bossId)
    const respawnIso = new Date(killed.getTime() + rollRespawnMs(tier)).toISOString()
    const { error } = await supabase.from('boss_kills').insert({
      boss_name: bossId,
      user_id: user.value.id,
      killed_at: killed.toISOString(),
      respawn_at: respawnIso,
      estimate_min: false,
      killed_by_username: username.value,
    })
    loadingId.value = null
    manualEdit.value = null
    if (error) {
      alert(error.message)
    } else {
      await supabase.from('boss_monitors').delete().eq('boss_id', bossId)
    }
  }

  async function clearKill(boss) {
    if (!confirm(`Удалить все записи убийства «${boss.name}»?`)) return
    loadingId.value = boss.id
    const { error } = await supabase.from('boss_kills').delete().eq('boss_name', boss.id)
    loadingId.value = null
    if (error) {
      alert(error.message)
    } else {
      await supabase.from('boss_monitors').delete().eq('boss_id', boss.id)
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
      const killChannel = supabase.channel('boss_kills_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'boss_kills' }, () => fetchKills())
        .subscribe()
      const monitorChannel = supabase.channel('boss_monitors_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'boss_monitors' }, () => fetchMonitors())
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
    toggleMonitor, removeMonitor, fixedLeft, fmtHours, fmtMs,
    lowBosses, highBosses, testBosses, allBosses,
    addKill, openManual, cancelManual, saveManual, clearKill,
    formatTime, signOut,
    maxRespawnTime,
  }
}