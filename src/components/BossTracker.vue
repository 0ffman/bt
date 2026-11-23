<script setup>
import { useBossTracker } from '../composables/useBossTracker'

const {
  user, username, isDark, toggleTheme,
  monitorsFor, isMonitoring, toggleMonitor, removeMonitor, lastKill, statusOf,
  fixedLeft, randomLeft, fmtHours, fmtMs,
  testBosses, allBosses,
  loadingId, manualEdit,
  addKill, openManual, cancelManual, saveManual, clearKill,
  formatTime, signOut,
  maxRespawnTime,  // <-- добавлено
} = useBossTracker()
</script>

<template>
  <div class="tracker" :class="{ 'dark-theme': isDark }">
    <header class="topbar">
      <span class="nick">Привет, <b>{{ username }}</b></span>
      <div class="topbar-center">
        <div class="theme-toggle-container" @click="toggleTheme">
          <span class="theme-icon moon">🌙</span>
          <div class="toggle-slider" :class="{ active: isDark }">
            <div class="toggle-knob" :class="{ active: isDark }"></div>
          </div>
          <span class="theme-icon sun">☀️</span>
        </div>
      </div>
      <button class="btn-ghost" @click="signOut">Выйти</button>
    </header>

    <table class="boss-table">
      <thead>
        <tr>
          <th class="th-name">Имя</th>
          <th class="th-level">Ур.</th>
          <th class="th-status">Время</th>
          <th class="th-killedby">Кем убит</th>
          <th class="th-eta">ETA</th>
          <th class="th-follow">Отслеживать</th>
          <th class="th-watchers">Кто смотрит</th>
          <th class="th-actions">Действия</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="boss in allBosses"
          :key="boss.id"
          class="boss-row"
          :class="`status-${statusOf(boss)}`"
        >
          <td class="td-name">
            <span class="monitor-dot" :class="{ active: isMonitoring(boss.id) }"></span>
            <span class="name">{{ boss.name }}</span>
          </td>
          <td class="td-level"><span class="lvl">{{ boss.level }}</span></td>
          <td class="td-status">
            <div v-if="lastKill(boss.id)" class="meta">
              <template v-if="statusOf(boss) === 'respawning'">
                <span class="meta-item respawn">Убит: {{ formatTime(lastKill(boss.id).killed_at) }}</span>
              </template>
              <template v-else-if="statusOf(boss) === 'respawn_window'">
                <span class="meta-item respawn-window">Убит: {{ formatTime(lastKill(boss.id).killed_at) }}</span>
              </template>
              <template v-else-if="statusOf(boss) === 'estimate_min'">
                <span class="meta-item estimate-min">По мин.: {{ formatTime(lastKill(boss.id).killed_at) }}</span>
              </template>
              <!-- Для alive показываем максимальное время респа -->
              <span v-else class="meta-item alive">Реснулся: {{ formatTime(maxRespawnTime(boss)) }}</span>
            </div>
          </td>
          <td class="td-killedby">
            <span v-if="lastKill(boss.id) && lastKill(boss.id).killed_by_username" class="killer-name">
              {{ lastKill(boss.id).killed_by_username }}
            </span>
            <span v-else class="no-killer">—</span>
          </td>
          <td class="td-eta">
            <template v-if="statusOf(boss) === 'respawning'">
              <span class="dim">{{ fmtMs(fixedLeft(boss)) }}</span>
            </template>
            <template v-else-if="statusOf(boss) === 'respawn_window'">
              <span class="dim">{{ fmtMs(randomLeft(boss)) }}</span>
            </template>
            <template v-else-if="statusOf(boss) === 'estimate_min'">
              <span class="dim">{{ fmtMs(fixedLeft(boss)) }}</span>
            </template>
            <template v-else>—</template>
          </td>
          <td class="td-follow">
            <button
              v-if="statusOf(boss) !== 'respawning'"
              class="follow-btn"
              :class="{ following: isMonitoring(boss.id) }"
              @click.stop="toggleMonitor(boss)"
            >
              {{ isMonitoring(boss.id) ? '✓' : '+' }}
            </button>
          </td>
          <td class="td-watchers">
            <div v-if="monitorsFor(boss.id).length" class="watchers-list">
              <span v-for="m in monitorsFor(boss.id)" :key="m.user_id" class="watcher-item">
                <span class="watcher-name">{{ m.username }}</span>
                <button
                  class="watcher-remove"
                  @click.stop="removeMonitor(boss.id, m.user_id)"
                  title="Убрать наблюдателя"
                >✕</button>
              </span>
            </div>
            <span v-else class="no-watchers">—</span>
          </td>
          <td class="td-actions">
            <div class="actions-wrapper">
              <div v-if="!manualEdit || manualEdit.bossId !== boss.id" class="actions" @click.stop>
                <button class="kill-btn kill-main" @click="addKill(boss, false)" :disabled="loadingId === boss.id || statusOf(boss) === 'respawning'">
                  {{ loadingId === boss.id ? '…' : 'Убил' }}
                </button>
                <button class="kill-btn kill-min" @click="addKill(boss, true)" :disabled="loadingId === boss.id || statusOf(boss) === 'respawning' || statusOf(boss) === 'estimate_min'">
                  <span class="btn-icon-min">⏱️</span>
                  <span>min</span>
                </button>
                <button class="kill-btn ghost-btn" @click="openManual(boss)" :disabled="loadingId === boss.id" title="Ввести время">⏱</button>
                <button v-if="lastKill(boss.id)" class="kill-btn clear-btn" @click="clearKill(boss)" :disabled="loadingId === boss.id" title="Очистить">✕</button>
              </div>
              <div v-else class="manual-form" @click.stop>
                <input type="datetime-local" v-model="manualEdit.value" class="manual-input" />
                <button class="kill-btn" @click.stop="saveManual" :disabled="loadingId === boss.id">Сохранить</button>
                <button class="btn-ghost small" @click.stop="cancelManual">Отмена</button>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <section v-if="testBosses.length" class="test-section">
      <h3 class="test-title">TEST</h3>
      <table class="boss-table">
        <thead>
          <tr>
            <th class="th-name">Имя</th>
            <th class="th-level">Ур.</th>
            <th class="th-status">Время</th>
            <th class="th-killedby">Кем убит</th>
            <th class="th-eta">ETA</th>
            <th class="th-follow">Отслеживать</th>
            <th class="th-watchers">Кто смотрит</th>
            <th class="th-actions">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="boss in testBosses"
            :key="boss.id"
            class="boss-row"
            :class="`status-${statusOf(boss)}`"
          >
            <td class="td-name">
              <span class="monitor-dot" :class="{ active: isMonitoring(boss.id) }"></span>
              <span class="name">{{ boss.name }}</span>
            </td>
            <td class="td-level"><span class="lvl">{{ boss.level }}</span></td>
            <td class="td-status">
              <div v-if="lastKill(boss.id)" class="meta">
                <template v-if="statusOf(boss) === 'respawning'">
                  <span class="meta-item respawn">Убит: {{ formatTime(lastKill(boss.id).killed_at) }}</span>
                </template>
                <template v-else-if="statusOf(boss) === 'respawn_window'">
                  <span class="meta-item respawn-window">Убит: {{ formatTime(lastKill(boss.id).killed_at) }}</span>
                </template>
                <template v-else-if="statusOf(boss) === 'estimate_min'">
                  <span class="meta-item estimate-min">По мин.: {{ formatTime(lastKill(boss.id).killed_at) }}</span>
                </template>
                <span v-else class="meta-item alive">Реснулся: {{ formatTime(maxRespawnTime(boss)) }}</span>
              </div>
            </td>
            <td class="td-killedby">
              <span v-if="lastKill(boss.id) && lastKill(boss.id).killed_by_username" class="killer-name">
                {{ lastKill(boss.id).killed_by_username }}
              </span>
              <span v-else class="no-killer">—</span>
            </td>
            <td class="td-eta">
              <template v-if="statusOf(boss) === 'respawning'"><span class="dim">{{ fmtMs(fixedLeft(boss)) }}</span></template>
              <template v-else-if="statusOf(boss) === 'respawn_window'"><span class="dim">{{ fmtMs(randomLeft(boss)) }}</span></template>
              <template v-else-if="statusOf(boss) === 'estimate_min'"><span class="dim">{{ fmtMs(fixedLeft(boss)) }}</span></template>
              <template v-else>—</template>
            </td>
            <td class="td-follow">
              <button
                v-if="statusOf(boss) !== 'respawning'"
                class="follow-btn"
                :class="{ following: isMonitoring(boss.id) }"
                @click.stop="toggleMonitor(boss)"
              >
                {{ isMonitoring(boss.id) ? '✓' : '+' }}
              </button>
            </td>
            <td class="td-watchers">
              <div v-if="monitorsFor(boss.id).length" class="watchers-list">
                <span v-for="m in monitorsFor(boss.id)" :key="m.user_id" class="watcher-item">
                  <span class="watcher-name">{{ m.username }}</span>
                  <button
                    class="watcher-remove"
                    @click.stop="removeMonitor(boss.id, m.user_id)"
                    title="Убрать наблюдателя"
                  >✕</button>
                </span>
              </div>
              <span v-else class="no-watchers">—</span>
            </td>
            <td class="td-actions">
              <div class="actions-wrapper">
                <div v-if="!manualEdit || manualEdit.bossId !== boss.id" class="actions" @click.stop>
                  <button class="kill-btn kill-main" @click="addKill(boss, false)" :disabled="loadingId === boss.id || statusOf(boss) === 'respawning'">{{ loadingId === boss.id ? '…' : 'Убил' }}</button>
                  <button class="kill-btn kill-min" @click="addKill(boss, true)" :disabled="loadingId === boss.id || statusOf(boss) === 'respawning' || statusOf(boss) === 'estimate_min'">
                    <span class="btn-icon-min">⏱️</span>
                    <span>min</span>
                  </button>
                  <button class="kill-btn ghost-btn" @click="openManual(boss)" :disabled="loadingId === boss.id" title="Ввести время">⏱</button>
                  <button v-if="lastKill(boss.id)" class="kill-btn clear-btn" @click="clearKill(boss)" :disabled="loadingId === boss.id" title="Очистить">✕</button>
                </div>
                <div v-else class="manual-form" @click.stop>
                  <input type="datetime-local" v-model="manualEdit.value" class="manual-input" />
                  <button class="kill-btn" @click.stop="saveManual" :disabled="loadingId === boss.id">Сохранить</button>
                  <button class="btn-ghost small" @click.stop="cancelManual">Отмена</button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.tracker {
  width: 100%;
  padding: 1.25rem 1.5rem;
  color: #1e2024;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #e9ebef;
  min-height: 100vh;
  box-sizing: border-box;
  transition: background 0.3s, color 0.3s;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0.6rem 0.9rem;
  background: #ffffff;
  border: 1px solid #cbd0d9;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.nick { font-size: 0.85rem; color: #4a5058; }
.topbar-center { display: flex; align-items: center; gap: 0.5rem; }
.theme-toggle-container {
  display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none;
}
.theme-icon { font-size: 1.1rem; line-height: 1; opacity: 0.6; transition: opacity 0.2s; }
.dark-theme .theme-icon.moon { opacity: 1; }
.dark-theme .theme-icon.sun { opacity: 0.4; }
.toggle-slider {
  width: 36px; height: 18px; background: #d0d0d0; border-radius: 18px; position: relative; transition: background 0.3s;
}
.toggle-slider.active { background: #555; }
.toggle-knob {
  width: 14px; height: 14px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px;
  transition: left 0.3s, background 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.toggle-knob.active { left: 20px; background: #f0c674; }
.btn-ghost {
  background: #ffffff; border: 1px solid #cbd0d9; color: #1e2024; padding: 0.35rem 0.8rem;
  border-radius: 6px; font-size: 0.8rem; cursor: pointer; transition: background 0.15s, border-color 0.15s;
}
.btn-ghost:hover { background: #eef1f5; border-color: #5b8def; }
.btn-ghost.small { padding: 0.25rem 0.5rem; font-size: 0.75rem; }

.boss-table {
  width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 12px; overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04); margin-bottom: 1.25rem;
}
.boss-table thead { background: #f0f2f5; }
.boss-table th {
  text-align: left; padding: 0.5rem 0.6rem; font-size: 0.72rem; font-weight: 600; color: #5a6068;
  border-bottom: 1px solid #cbd0d9;
}
.th-name { width: 16%; }
.th-level { width: 5%; }
.th-status { width: 15%; }
.th-killedby { width: 12%; }
.th-eta { width: 10%; }
.th-follow { width: 8%; text-align: center; }
.th-watchers { width: 12%; }
.th-actions { width: 22%; }

.boss-row { cursor: default; transition: background 0.12s; border-bottom: 1px solid #e2e4e8; }
.boss-row:hover { background: #f5f6f8; }
.boss-row.status-respawning     { background: #ffe6e6; }
.boss-row.status-respawn_window { background: #ffe4c4; }
.boss-row.status-estimate_min   { background: #fff2b0; }
.boss-row.status-alive          { background: #daf0e0; }
.boss-row td { padding: 0.4rem 0.6rem; vertical-align: middle; }

.td-name {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.monitor-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
  flex-shrink: 0;
  transition: background 0.2s;
}
.monitor-dot.active {
  background: #3a7bd5;
  box-shadow: 0 0 4px rgba(58, 123, 213, 0.5);
}
.td-name .name { font-weight: 600; font-size: 0.85rem; color: #1e2024; }
.td-level .lvl { font-size: 0.78rem; font-weight: 600; color: #374151; }
.td-status .meta { display: flex; flex-wrap: wrap; gap: 0.3rem; font-size: 0.72rem; }
.meta-item { white-space: nowrap; }
.meta-item.respawn { color: #b03030; font-weight: 600; }
.meta-item.respawn-window { color: #a05c00; font-weight: 600; }
.meta-item.estimate-min { color: #8a7a00; font-weight: 600; }
.meta-item.alive { color: #1a7a3a; font-weight: 600; }
.td-killedby { font-size: 0.75rem; }
.killer-name { color: #3a6edb; font-weight: 600; }
.no-killer { color: #8a9099; }
.td-eta { font-size: 0.82rem; font-weight: 700; color: #1e2024; }
.dim { font-size: 0.82rem; font-weight: 700; color: #374151; }
.td-watchers { font-size: 0.7rem; }
.watchers-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.watcher-item {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
}
.watcher-name { color: #3a6edb; font-weight: 600; }
.watcher-remove {
  background: none;
  border: none;
  color: #8a9099;
  cursor: pointer;
  font-size: 0.6rem;
  padding: 0;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.watcher-item:hover .watcher-remove {
  opacity: 1;
}
.watcher-remove:hover {
  color: #b03030;
}
.no-watchers { color: #8a9099; }

.td-follow { text-align: center; }
.follow-btn {
  width: 28px; height: 28px; border: 1px solid #3a7bd5; background: white; color: #3a7bd5;
  border-radius: 50%; font-size: 1rem; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s;
}
.follow-btn:hover { background: #3a7bd5; color: white; }
.follow-btn.following { background: #3a7bd5; color: white; border-color: #3a7bd5; }
.follow-btn.following:hover { background: #b03030; border-color: #b03030; }

.actions-wrapper { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.kill-btn {
  border: none; cursor: pointer; transition: background 0.15s, transform 0.1s;
  display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem;
  white-space: nowrap;
}
.kill-btn:hover:not(:disabled) { transform: translateY(-1px); }
.kill-btn:active:not(:disabled) { transform: translateY(0); }
.kill-btn:disabled { opacity: 0.5; cursor: default; }

.kill-main {
  background: #2563eb;
  color: #ffffff;
  padding: 0.45rem 1rem;
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}
.kill-main:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 3px 10px rgba(37, 99, 235, 0.4); }
.kill-main:disabled { background: #7a8eb0; }

.kill-min {
  background: transparent;
  color: #b45309;
  border: 1.5px solid #b45309;
  padding: 0.35rem 0.65rem;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
}
.kill-min:hover:not(:disabled) { background: #fef3c7; border-color: #d97706; color: #d97706; }
.kill-min:disabled { border-color: #a08250; color: #a08250; opacity: 0.6; background: transparent; }
.btn-icon-min { font-size: 0.8rem; line-height: 1; }

.ghost-btn { background: #f0f2f5; color: #1e2024; border: 1px solid #cbd0d9; box-shadow: none; padding: 0.3rem 0.5rem; border-radius: 6px; font-size: 0.7rem; }
.ghost-btn:hover:not(:disabled) { background: #e2e6ec; border-color: #5b8def; }
.clear-btn { background: #e6d0d0; color: #b03030; border: 1px solid #c09292; box-shadow: none; padding: 0.3rem 0.5rem; border-radius: 6px; font-size: 0.7rem; }
.clear-btn:hover:not(:disabled) { background: #dbb8b8; }

.manual-form { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
.manual-input { padding: 0.2rem 0.3rem; border: 1px solid #c4c9d2; border-radius: 6px; font-size: 0.7rem; background: #fff; color: #1e2024; }

@media (max-width: 720px) {
  .boss-table, .boss-table tbody, .boss-table tr, .boss-table td, .boss-table th { display: block; }
  .boss-table thead { display: none; }
  .boss-row { margin-bottom: 0.5rem; border-radius: 8px; padding: 0.4rem 0.5rem; }
  .boss-row td { padding: 0.2rem 0.3rem; border: none; }
  .td-status .meta { flex-direction: column; gap: 0.2rem; }
  .td-actions .actions-wrapper { flex-wrap: wrap; }
}

/* ====== Тёмная тема ====== */
.tracker.dark-theme { background: #141517; color: #d1d5db; }
.tracker.dark-theme .topbar { background: #1f2126; border-color: #2f323a; }
.tracker.dark-theme .nick { color: #9ca3af; }
.tracker.dark-theme .btn-ghost { background: #1f2126; border-color: #374151; color: #d1d5db; }
.tracker.dark-theme .btn-ghost:hover { background: #2a2d34; border-color: #5b8def; }
.tracker.dark-theme .boss-table { background: #1f2126; box-shadow: 0 1px 4px rgba(0,0,0,0.5); }
.tracker.dark-theme .boss-table thead { background: #181a1f; }
.tracker.dark-theme .boss-table th { color: #9ca3af; border-bottom-color: #2f323a; }
.tracker.dark-theme .boss-row { border-bottom-color: #2f323a; }
.tracker.dark-theme .boss-row:hover { background: #2a2d34; }
.tracker.dark-theme .boss-row.status-respawning { background: #3a1a1a; border-left: 3px solid #d93030; }
.tracker.dark-theme .boss-row.status-respawn_window { background: #3a2a10; border-left: 3px solid #d98020; }
.tracker.dark-theme .boss-row.status-estimate_min { background: #3a3410; border-left: 3px solid #c4a000; }
.tracker.dark-theme .boss-row.status-alive { background: #1a2a1a; border-left: 3px solid #28a05a; }
.tracker.dark-theme .td-name .name { color: #e5e7eb; }
.tracker.dark-theme .monitor-dot.active { background: #6a9eff; box-shadow: 0 0 4px rgba(106, 158, 255, 0.5); }
.tracker.dark-theme .td-level .lvl { color: #d1d5db; }
.tracker.dark-theme .killer-name { color: #7aa3ff; }
.tracker.dark-theme .no-killer { color: #6b7280; }
.tracker.dark-theme .td-status .meta-item { color: #9ca3af; }
.tracker.dark-theme .meta-item.respawn { color: #f87171; }
.tracker.dark-theme .meta-item.respawn-window { color: #fb923c; }
.tracker.dark-theme .meta-item.estimate-min { color: #eab308; }
.tracker.dark-theme .meta-item.alive { color: #4ade80; }
.tracker.dark-theme .td-eta { color: #e5e7eb; }
.tracker.dark-theme .dim { color: #e5e7eb; }
.tracker.dark-theme .kill-main { background: #2563eb; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.5); }
.tracker.dark-theme .kill-main:hover:not(:disabled) { background: #1d4ed8; }
.tracker.dark-theme .kill-main:disabled { background: #3a4a6b; }
.tracker.dark-theme .kill-min { color: #fbbf24; border-color: #fbbf24; }
.tracker.dark-theme .kill-min:hover:not(:disabled) { background: #3a2a10; border-color: #f59e0b; color: #f59e0b; }
.tracker.dark-theme .kill-min:disabled { border-color: #7a6630; color: #7a6630; }
.tracker.dark-theme .ghost-btn { background: #2a2d34; border-color: #374151; color: #d1d5db; }
.tracker.dark-theme .ghost-btn:hover { background: #374151; }
.tracker.dark-theme .clear-btn { background: #3a1a1a; border-color: #5a2020; color: #f87171; }
.tracker.dark-theme .clear-btn:hover { background: #4a2020; }
.tracker.dark-theme .manual-input { background: #2a2d34; border-color: #374151; color: #d1d5db; }
.tracker.dark-theme .test-section { background: #1f2126; }
.tracker.dark-theme .test-title { color: #9ca3af; }
.tracker.dark-theme .follow-btn { background: #2a2d34; border-color: #6a9eff; color: #6a9eff; }
.tracker.dark-theme .follow-btn:hover { background: #6a9eff; color: #1f2126; }
.tracker.dark-theme .follow-btn.following { background: #6a9eff; color: #1f2126; }
.tracker.dark-theme .follow-btn.following:hover { background: #f87171; border-color: #f87171; color: white; }
.tracker.dark-theme .watcher-name { color: #7aa3ff; }
.tracker.dark-theme .no-watchers { color: #6b7280; }
.tracker.dark-theme .watcher-remove { color: #6b7280; }
.tracker.dark-theme .watcher-remove:hover { color: #f87171; }

.test-section {
  margin-top: 2rem; padding: 0.9rem;
  background: #f4f5f7; border-radius: 12px; transition: background 0.3s;
}
.test-title {
  margin: 0 0 0.75rem; font-size: 0.95rem; font-weight: 600;
  color: #6b7280; font-style: italic;
}
</style>